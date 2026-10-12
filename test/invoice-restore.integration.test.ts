// @vitest-environment node
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createInvoiceRestoreDatabase } from './support/invoiceDatabase';

const project = '10000000-0000-4000-8000-000000000001';
const quote = '20000000-0000-4000-8000-000000000001';
const version = '30000000-0000-4000-8000-000000000001';
const invoice = '40000000-0000-4000-8000-000000000001';
const command = '50000000-0000-4000-8000-000000000001';
let db: PGlite;
let voidedAt: string;
const restore = (id = command) =>
  db.query('select public.commercial_restore_invoice($1,$2,$3,$4,$5)', [
    invoice,
    voidedAt,
    id,
    'Voided by mistake',
    'admin',
  ]);
const prepareEmail = (key = `deposit-invoice-send:${invoice}`) =>
  db.query<{ id: string }>(
    "select * from public.commercial_email_prepare($1,'deposit_invoice_send',$2,$3,repeat('a',64),'{}'::jsonb,now()+interval '1 hour')",
    [key, invoice, project],
  );
async function voidAgain() {
  await db.query('select public.commercial_void_open_invoice($1,$2,$3)', [invoice, 'admin', 'Accidental void']);
  voidedAt = (
    await db.query<{ value: string }>('select voided_at::text as value from public.deposit_invoices where id=$1', [
      invoice,
    ])
  ).rows[0].value;
}
async function match(amount: number) {
  await db.query('insert into auth.users values($1)', [command]);
  await db.query(
    "insert into public.project_payment_entries(id,project_id,entry_type,amount_inc_gst_cents,occurred_at) values($1,$2,'PAYMENT',$3,now())",
    [command, project, amount],
  );
  await db.query(
    `insert into public.xero_deposit_matches(id,tenant_id,receipt_id,contact_id,project_id,invoice_id,payment_entry_id,amount_inc_gst_cents,receipt_date,evidence_fingerprint,approved_by)
    values($1,$1,$1,$1,$2,$3,$1,$4,current_date,repeat('a',64),$1)`,
    [command, project, invoice, amount],
  );
}
async function reject(query: () => Promise<unknown>, message: RegExp) {
  await db.exec('savepoint rejection');
  await expect(query()).rejects.toThrow(message);
  await db.exec('rollback to savepoint rejection');
}
describe('restore invoice through real production SQL', () => {
  beforeAll(async () => {
    db = await createInvoiceRestoreDatabase();
  }, 30000);
  beforeEach(async () => {
    await db.exec('begin');
    await db.query('insert into public.projects(id,name) values($1,$2)', [project, 'Synthetic restore project']);
    await db.query("insert into public.project_operational_states(project_id,state) values($1,'ACTIVE')", [project]);
    await db.query('insert into public.quotes(id,project_id,quote_ref) values($1,$2,$3)', [quote, project, 'Q-TEST']);
    await db.query(
      "insert into public.quote_versions(id,quote_id,version_number,status,total_inc_gst_cents,total_ex_gst_cents,gst_cents,accepted_at) values($1,$2,1,'ACCEPTED',11500,10000,1500,now())",
      [version, quote],
    );
    const content = {
      version: 1,
      items: [
        {
          id: '60000000-0000-4000-8000-000000000001',
          description: 'Synthetic work',
          qty: 1,
          unitPriceIncGstCents: 11500,
          lineTotalIncGstCents: 11500,
        },
      ],
      billingName: 'Test customer',
      billingEmail: 'test@example.invalid',
      billingAddress: '',
      notes: '',
    };
    await db.query('insert into public.quote_line_items values($1,$2,0,$3,1,11500,11500)', [
      '60000000-0000-4000-8000-000000000001',
      version,
      'Synthetic work',
    ]);
    await db.query('select public.commercial_invoice_save_draft($1,$2,0,$5,$3,$4)', [
      invoice,
      project,
      JSON.stringify(content),
      JSON.stringify({ mode: 'custom', label: 'Invoice', dueDate: '2026-10-20', amountIncGstCents: 11500 }),
      version,
    ]);
    await db.query('select public.commercial_invoice_issue_draft($1,1,$2,$3)', [invoice, command, 'Test bank']);
    await db.query('select public.commercial_void_open_invoice($1,$2,$3)', [invoice, 'admin', 'Voided by mistake']);
    voidedAt = (
      await db.query<{ value: string }>('select voided_at::text as value from public.deposit_invoices where id=$1', [
        invoice,
      ])
    ).rows[0].value;
  });
  afterEach(async () => {
    await db.exec('rollback');
  });
  afterAll(async () => {
    await db?.close();
  });

  it('restores original immutable invoice, keeps revoked token, replay and repeated void audit', async () => {
    const before = (
      await db.query('select invoice_ref,total_inc_gst_cents,content_snapshot,due_date from public.deposit_invoices')
    ).rows[0];
    await restore();
    await restore();
    const after = (
      await db.query('select invoice_ref,total_inc_gst_cents,content_snapshot,due_date from public.deposit_invoices')
    ).rows[0];
    expect(after).toEqual(before);
    expect(
      (await db.query('select status,portal_token_hash,void_reason from public.deposit_invoices')).rows[0],
    ).toEqual({ status: 'OPEN', portal_token_hash: null, void_reason: null });
    expect(
      (await db.query("select count(*)::int as n from public.audit_events where type='invoice.restored'")).rows[0].n,
    ).toBe(1);
    await db.query('select public.commercial_void_open_invoice($1,$2,$3)', [invoice, 'admin', 'Second mistake']);
    await restore(); // Old successful intent must never unvoid a later episode.
    expect((await db.query('select status from public.deposit_invoices')).rows[0].status).toBe('VOID');
    expect(
      (await db.query("select count(*)::int as n from public.audit_events where type='invoice.voided'")).rows[0].n,
    ).toBe(2);
    await reject(() => restore('50000000-0000-4000-8000-000000000002'), /changed/);
  });
  it('denies browser SQL mutations even for an authenticated caller', async () => {
    await db.exec('set local role authenticated');
    await reject(() => restore(), /permission denied/);
    await db.exec('reset role');
  });
  it('rolls back restoration when audit insertion fails', async () => {
    await db.exec(
      "create function public.reject_restore_audit() returns trigger language plpgsql as $$ begin if new.type='invoice.restored' then raise exception 'audit unavailable'; end if; return new; end; $$; create trigger reject_restore_audit before insert on public.audit_events for each row execute function public.reject_restore_audit();",
    );
    await reject(() => restore(), /audit unavailable/);
    expect((await db.query('select status from public.deposit_invoices')).rows[0].status).toBe('VOID');
  });
  it('refuses obsolete quote and replacement invoices', async () => {
    await db.query("update public.quote_versions set status='SUPERSEDED' where id=$1", [version]);
    await reject(() => restore(), /no longer the current/);
    await db.query("update public.quote_versions set status='ACCEPTED' where id=$1", [version]);
    await db.exec(
      "insert into public.deposit_invoices select (jsonb_populate_record(null::public.deposit_invoices,to_jsonb(i)||jsonb_build_object('id','40000000-0000-4000-8000-000000000002','invoice_ref','INV-REPLACEMENT','status','OPEN','issue_command_id',null,'admin_client_intent_id',null))).* from public.deposit_invoices i;",
    );
    await reject(() => restore(), /Another active invoice/);
  });
  it('refuses unverified or externally void Xero invoice, permits fresh unchanged match', async () => {
    await db.query(
      'insert into private.xero_invoice_transfers(id,invoice_id,project_id,tenant_id,provider_invoice_id) values($1,$2,$3,$4,$5)',
      [command, invoice, project, quote, version],
    );
    await reject(() => restore(), /Xero could not confirm/);
    await db.query("insert into private.xero_invoice_observations values($1,1,'VOID',$2,clock_timestamp())", [
      command,
      JSON.stringify({ state: 'correction_complete', reason: 'BOTH_SYSTEMS_VOIDED', amountPaidCents: 0 }),
    ]);
    await reject(() => restore(), /also voided/);
    await db.query("insert into private.xero_invoice_observations values($1,2,'VOID',$2,clock_timestamp())", [
      command,
      JSON.stringify({ state: 'correction_pending', reason: 'PORTAL_VOID_REQUIRES_XERO_REVIEW', amountPaidCents: 0 }),
    ]);
    await restore();
    expect((await db.query('select status from public.deposit_invoices')).rows[0].status).toBe('OPEN');
  });
  it('does not revive genuinely uncertain email delivery', async () => {
    await db.exec("update public.deposit_invoices set status='OPEN'");
    const prepared = await prepareEmail();
    await db.query('select public.commercial_email_mark_dispatching($1)', [prepared.rows[0].id]);
    await db.exec(
      "update private.commercial_email_intents set status='needs_attention',last_error_code='RESEND_TIMEOUT'",
    );
    await voidAgain();
    await reject(() => restore(), /delivery reconciliation/);
  });
  it('requires restoring an archived project first', async () => {
    await db.exec('update public.projects set archived_at=now()');
    await reject(() => restore(), /archived/);
  });
  it('rejects late old-generation preparation after void and restoration', async () => {
    await restore();
    await reject(() => prepareEmail(), /changed before sending/);
    expect((await db.query('select count(*)::int as n from private.commercial_email_intents')).rows[0].n).toBe(0);
  });
  it('cancels a provably unsent generation, rejects its stale dispatch, and permits explicit new send', async () => {
    await db.exec("update public.deposit_invoices set status='OPEN'");
    const old = await prepareEmail();
    await voidAgain();
    await reject(
      () => db.query('select public.commercial_email_mark_dispatching($1)', [old.rows[0].id]),
      /changed before sending/,
    );
    await restore();
    expect((await db.query('select status from private.commercial_email_intents')).rows[0].status).toBe('cancelled');
    await reject(
      () => db.query('select public.commercial_email_mark_dispatching($1)', [old.rows[0].id]),
      /Cancelled delivery/,
    );
    const next = await prepareEmail(`deposit-invoice-send:${invoice}:restore:${command}`);
    await db.query('select public.commercial_email_mark_dispatching($1)', [next.rows[0].id]);
    expect(
      (
        await db.query(
          "select count(*)::int as n from public.commercial_email_read_unfinished('deposit_invoice_send',$1)",
          [invoice],
        )
      ).rows[0].n,
    ).toBe(1);
  });
  it('prevents void while a provider dispatch is still in flight', async () => {
    await db.exec("update public.deposit_invoices set status='OPEN'");
    const old = await prepareEmail();
    await db.query('select public.commercial_email_mark_dispatching($1)', [old.rows[0].id]);
    await reject(() => voidAgain(), /still being confirmed/);
  });
  it('recovers a first definitive rejection without pretending it was delivered', async () => {
    await db.exec("update public.deposit_invoices set status='OPEN'");
    const old = await prepareEmail();
    await db.query('select public.commercial_email_mark_dispatching($1)', [old.rows[0].id]);
    await db.exec(
      "update private.commercial_email_intents set status='needs_attention',last_error_code='RESEND_VALIDATION_REJECTED'",
    );
    await voidAgain();
    await restore();
    expect((await db.query('select status,provider_message_id from private.commercial_email_intents')).rows[0]).toEqual(
      { status: 'cancelled', provider_message_id: null },
    );
  });
  it('retains partial receipts and restores only outstanding exposure', async () => {
    await match(2000);
    await restore();
    const truth = (await db.query('select * from public.commercial_project_financial_truth($1)', [project])).rows[0];
    expect(truth.paid_inc_gst_cents).toBe(2000);
    expect(truth.open_invoice_inc_gst_cents).toBe(9500);
    expect(truth.over_committed_inc_gst_cents).toBe(0);
    expect((await db.query('select count(*)::int as n from public.project_payment_entries')).rows[0].n).toBe(1);
  });
  it('refuses fully covered anomalous void instead of claiming it is unpaid', async () => {
    await match(11500);
    await reject(() => restore(), /already covers/);
  });
  it('refuses a replacement on another term when the balance is consumed', async () => {
    await db.exec(
      "insert into public.deposit_invoices select (jsonb_populate_record(null::public.deposit_invoices,to_jsonb(i)||jsonb_build_object('id','40000000-0000-4000-8000-000000000002','invoice_ref','INV-REPLACEMENT','status','OPEN','payment_term_id','replacement','issue_command_id',null,'admin_client_intent_id',null))).* from public.deposit_invoices i;",
    );
    await reject(() => restore(), /remaining agreed balance/);
  });
  it('reopens settled project follow-up without fabricating payment or delivery', async () => {
    await db.exec(
      "update public.project_operational_states set state='CLOSED',closed_outcome='COMPLETE'; update public.projects set pipeline_stage='PAID';",
    );
    await restore();
    expect((await db.query('select state from public.project_operational_states')).rows[0].state).toBe('ACTIVE');
    expect((await db.query('select count(*)::int as n from public.project_payment_entries')).rows[0].n).toBe(0);
  });
});
