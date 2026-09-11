// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const read = (name: string) => readFileSync(`supabase/${name}`, 'utf8').replace(/\r/g, '');
function command(source: string, name: string) {
  const start = source.indexOf(`create or replace function public.${name}(`);
  if (start < 0) throw new Error(`Missing production command ${name}`);
  return source.slice(start, source.indexOf('\n$$;', start) + 4);
}
const project = '10000000-0000-4000-8000-000000000001';
const quote = '20000000-0000-4000-8000-000000000001';
const version = '30000000-0000-4000-8000-000000000001';
const draft = '40000000-0000-4000-8000-000000000001';
const issue = '50000000-0000-4000-8000-000000000001';
const line = { id: '60000000-0000-4000-8000-000000000001', description: 'Pergola', qty: 2, unitPriceIncGstCents: 5750, lineTotalIncGstCents: 11500 };
const snapshot = { version: 1, items: [line], billingName: 'Test customer', billingEmail: 'test@example.test', billingAddress: '', notes: 'Test only' };
const options = { mode: 'custom', label: 'Deposit', dueDate: '2026-09-30', amountIncGstCents: 5750 };
let db: PGlite;
async function save(linked = true, content = snapshot, expected = 0) {
  return db.query<{ draft_revision: number; status: string }>('select * from public.commercial_invoice_save_draft($1,$2,$3,$4,$5,$6)',
    [draft, project, expected, linked ? version : null, JSON.stringify(content), JSON.stringify(options)]);
}
async function issueDraft(expected = 1, commandId = issue) {
  return db.query<{ id: string; status: string; invoice_ref: string }>('select * from public.commercial_invoice_issue_draft($1,$2,$3,$4)', [draft, expected, commandId, 'Test bank']);
}

describe('invoice drafts against production SQL owners', () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(read('tests/commercial_truth_invariants_bootstrap.sql'));
    // Complete only missing schema prerequisites in the existing commercial test
    // harness; execute the actual billing commands rather than stub their logic.
    await db.exec(`
      create function public.is_portal_admin() returns boolean language sql as $$ select coalesce(current_setting('test.admin',true),'yes') = 'yes' $$;
      alter table public.projects add column archived_at timestamptz;
      alter table public.projects add column contact_id uuid;
      create table public.contacts(id uuid primary key,name text,email text);
      create table public.project_operational_states(project_id uuid primary key, state text, row_version bigint default 1,
        waiting_until timestamptz, waiting_reason text, closed_outcome text, closed_note text, updated_by uuid);
      create table public.project_state_events(project_id uuid,command_id uuid,event_sequence int,event_type text,before_state jsonb,after_state jsonb,reason text,actor_user_id uuid,actor_kind text);
      create table public.project_command_receipts(command_id uuid primary key,project_id uuid,command_type text,intent_hash text,actor_user_id uuid,actor_kind text,committed_result jsonb);
      create table public.scheduled_jobs(id uuid primary key default gen_random_uuid(),job_id uuid,status text,actual_finish date);
      create table public.project_confirmation_events(id uuid primary key default gen_random_uuid(),project_id uuid,command_id uuid,event_kind text,
        confirmation_type text constraint project_confirmation_events_confirmation_type_check check(confirmation_type='SITE_VISIT_COMPLETED'),
        subject_kind text,subject_id uuid,occurred_at timestamptz,recorded_by uuid,actor_kind text,retracts_event_id uuid);
      create function public.project_work_items_assert_v2(uuid,boolean) returns void language sql as $$ select $$;
      create function public.project_work_items_refresh_projection(uuid) returns void language sql as $$ select $$;
      create function public.project_work_items_cancel_active(uuid,uuid,text,uuid,text) returns integer language sql as $$ select 0 $$;
      alter table public.deposit_invoices add column pdf_file_id uuid, add column sent_at timestamptz;
      alter index public.deposit_invoices_active_term_unique rename to deposit_invoices_quote_version_term_active_unique;
      create table public.quote_line_items(id uuid primary key,quote_version_id uuid,sort_order integer,description text,qty numeric,unit_price_inc_gst_cents integer,line_total_inc_gst_cents integer);
    `);
    const reconciliation = read('migrations/20260810000004_admin_payment_reconciliation.sql');
    for (const name of ['commercial_replace_payment_allocations', 'commercial_reverse_payment_entry']) await db.exec(command(reconciliation, name));
    await db.exec(read('migrations/20260813000003_commercial_truth_invariants.sql'));
    const work = read('migrations/20260729_000002_project_work_items_v2.sql');
    for (const name of ['project_work_items_intent_hash','project_work_items_receipt_replay','project_work_items_store_receipt','project_operational_state_command']) {
      await db.exec(command(work, name));
    }
    for (const name of ['20260911000001_project_delivery_completion.sql','20260911000002_invoice_draft_storage.sql','20260911000003_invoice_draft_commands.sql',
      '20260911000004_invoice_draft_issuance.sql','20260911000005_standalone_invoice_balances.sql',
      '20260911000006_financial_followup_reopening.sql','20260911000007_invoice_payment_reapplication.sql']) {
      // Exercise Windows checkouts too: textual owner patches must normalize
      // their anchors as well as PostgreSQL's stored function definitions.
      await db.exec(read(`migrations/${name}`).replace(/\n/g, '\r\n'));
    }
  }, 30_000);
  beforeEach(async () => {
    await db.exec('begin');
    await db.exec("select set_config('test.admin','yes',true)");
    await db.query('insert into public.projects(id,name) values ($1,$2)', [project, 'Test project']);
    await db.query("insert into public.project_operational_states(project_id,state) values ($1,'ACTIVE')", [project]);
    await db.query('insert into public.quotes(id,project_id,quote_ref) values ($1,$2,$3)', [quote,project,'Q-TEST']);
    await db.query(`insert into public.quote_versions(id,quote_id,version_number,status,customer_name,total_inc_gst_cents,total_ex_gst_cents,gst_cents,accepted_at)
      values ($1,$2,1,'ACCEPTED','Test customer',11500,10000,1500,now())`, [version,quote]);
    await db.query('insert into public.quote_line_items values ($1,$2,0,$3,2,5750,11500)', [line.id,version,line.description]);
  });
  afterEach(async () => { await db.exec('rollback'); });
  afterAll(async () => { await db?.close(); });

  it('saves an editable draft without a number, link or balance reservation', async () => {
    await save();
    const row = (await db.query('select invoice_ref,portal_token_hash,status from public.deposit_invoices')).rows[0];
    expect(row).toEqual({ invoice_ref: null, portal_token_hash: null, status: 'DRAFT' });
    const truth = (await db.query('select * from public.commercial_project_financial_truth($1)', [project])).rows[0];
    expect(truth.remaining_to_invoice_inc_gst_cents).toBe(11500);
    const changed = await save(true, { ...snapshot, notes: 'Edited after navigation' }, 1);
    expect(Number(changed.rows[0].draft_revision)).toBe(2);
    await expect(save(true, snapshot, 1)).rejects.toThrow(/Draft changed/);
  });
  it('keeps quoted scope fixed while allowing invoice descriptions', async () => {
    await save(true, { ...snapshot, items: [{ ...line, description: 'Invoice wording' }] });
    await expect(save(true, { ...snapshot, items: [{ ...line, qty: 1, lineTotalIncGstCents: 5750 }] }, 1)).rejects.toThrow(/fixed/);
  });

  it('rejects malformed snapshots before they can become unreadable saved drafts', async () => {
    await expect(save(false, { ...snapshot, billingEmail: null } as unknown as typeof snapshot)).rejects.toThrow(/must be text/);
  });
  it('issues once under a stable command, preserving the draft identifier', async () => {
    await save();
    const result = await issueDraft();
    expect(result.rows[0].id).toBe(draft);
    expect(result.rows[0].status).toBe('OPEN');
    expect((await issueDraft()).rows[0].invoice_ref).toBe(result.rows[0].invoice_ref);
    expect((await db.query('select count(*)::int as count from public.deposit_invoices')).rows[0].count).toBe(1);
    await expect(db.query('update public.deposit_invoices set content_snapshot=$1 where id=$2', [JSON.stringify({ ...snapshot, notes: 'Changed' }), draft])).rejects.toThrow(/immutable/);
  });
  it('adds standalone issued value and allocates payment only to that invoice', async () => {
    await save(false);
    await issueDraft();
    const value = (await db.query('select public.commercial_project_value_breakdown($1) as value',[project])).rows[0].value;
    expect(value).toEqual({ acceptedQuoteIncGstCents: 11500, standaloneIncGstCents: 11500, billableIncGstCents: 23000 });
    await db.query('select * from public.commercial_mark_invoice_paid_with_project_lock($1,$2,null,null,null,null)', [draft,'test-admin']);
    const allocation = (await db.query('select quote_version_id,standalone_invoice_id,amount_inc_gst_cents from public.project_payment_allocations')).rows[0];
    expect(allocation).toEqual({ quote_version_id: null, standalone_invoice_id: draft, amount_inc_gst_cents: 11500 });
  });
  it('rejects non-admin draft mutations', async () => {
    await db.exec("select set_config('test.admin','no',true)");
    await expect(save()).rejects.toThrow(/Admin authentication/);
  });

  it('closes standalone-only delivery and reopens financial follow-up after payment reversal', async () => {
    await db.exec('delete from public.quote_line_items; delete from public.quote_versions; delete from public.quotes');
    await save(false);
    await issueDraft();
    await db.query("insert into public.scheduled_jobs(job_id,status,actual_finish) values ($1,'done','2026-01-01')",[project]);
    const payment = (await db.query<{ payment_entry_id: string }>('select * from public.commercial_mark_invoice_paid_with_project_lock($1,$2,null,null,null,null)', [draft,'test-admin'])).rows[0];
    await db.query("select public.commercial_complete_project_operational_state_command($1,$2,$3)",
      [project,crypto.randomUUID(),JSON.stringify({ expectedRowVersion: 1, outcome: 'COMPLETE', cancellationReason: 'Delivery and payment complete' })]);
    expect((await db.query('select state from public.project_operational_states')).rows[0].state).toBe('CLOSED');
    await db.query('select public.commercial_reverse_payment_entry_with_project_lock($1,$2,$3)',[payment.payment_entry_id,'Incorrect receipt','test-admin']);
    expect((await db.query('select state,closed_outcome from public.project_operational_states')).rows[0]).toEqual({ state: 'ACTIVE', closed_outcome: null });
    expect((await db.query('select pipeline_stage from public.projects')).rows[0].pipeline_stage).toBe('COMPLETED');
    expect((await db.query('select status,total_inc_gst_cents from public.deposit_invoices')).rows[0]).toEqual({ status: 'OPEN', total_inc_gst_cents: 11500 });
    const reapplied = (await db.query<{ payment_entry_id: string }>('select * from public.commercial_mark_invoice_paid_with_project_lock($1,$2,null,null,null,null)', [draft,'test-admin'])).rows[0];
    expect(reapplied.payment_entry_id).not.toBe(payment.payment_entry_id);
    const ledger = (await db.query('select sum(amount_inc_gst_cents)::int as total,count(*)::int as count from public.project_payment_entries')).rows[0];
    expect(ledger).toEqual({ total: 11500, count: 3 });
  });

  it('voids standalone value and exposure together without changing quoted scope', async () => {
    await save(false); await issueDraft();
    await db.query('select public.commercial_void_open_invoice($1,$2,$3)', [draft,'Cancelled extra work','test-admin']);
    const truth = (await db.query('select * from public.commercial_project_financial_truth($1)',[project])).rows[0];
    expect(truth.accepted_total_inc_gst_cents).toBe(11500);
    expect(truth.open_invoice_inc_gst_cents).toBe(0);
  });

  it('reopens a settled project when its delivery evidence is corrected', async () => {
    await db.exec('delete from public.quote_line_items; delete from public.quote_versions; delete from public.quotes');
    await save(false); await issueDraft();
    await db.query("insert into public.scheduled_jobs(job_id,status,actual_finish) values ($1,'done','2026-01-01')",[project]);
    await db.query('select * from public.commercial_mark_invoice_paid_with_project_lock($1,$2,null,null,null,null)', [draft,'test-admin']);
    await db.query('select public.commercial_complete_project_operational_state_command($1,$2,$3)',
      [project,crypto.randomUUID(),JSON.stringify({ expectedRowVersion: 1, outcome: 'COMPLETE', cancellationReason: 'Settled' })]);
    await db.query("update public.scheduled_jobs set status='in_progress',actual_finish=null where job_id=$1",[project]);
    expect((await db.query('select state from public.project_operational_states')).rows[0].state).toBe('ACTIVE');
    expect((await db.query('select pipeline_stage from public.projects')).rows[0].pipeline_stage).toBe('SCHEDULED');
    expect((await db.query('select status from public.deposit_invoices')).rows[0].status).toBe('PAID');
  });

  it('rounds standalone lines once and rejects stale deletion and issuance', async () => {
    const rounded = { ...snapshot, items: [{ ...line, qty: 1.5, unitPriceIncGstCents: 101, lineTotalIncGstCents: 152 }] };
    await save(false, rounded);
    await save(false, { ...rounded, notes: 'Updated' }, 1);
    await db.exec('savepoint stale_issue');
    await expect(issueDraft(1)).rejects.toThrow(/changed/);
    await db.exec('rollback to savepoint stale_issue');
    await expect(db.query('select public.commercial_invoice_delete_draft($1,$2)',[draft,1])).rejects.toThrow(/changed/);
    await db.exec('rollback to savepoint stale_issue');
    await issueDraft(2);
    expect((await db.query('select total_inc_gst_cents,total_ex_gst_cents,gst_cents from public.deposit_invoices')).rows[0])
      .toEqual({ total_inc_gst_cents: 152, total_ex_gst_cents: 132, gst_cents: 20 });
  });

  it('checks balance again at issue after another draft consumes the available amount', async () => {
    await save();
    await db.query('select * from public.commercial_invoice_save_draft($1,$2,0,$3,$4,$5)',
      [crypto.randomUUID(),project,version,JSON.stringify(snapshot),JSON.stringify({ ...options, amountIncGstCents: 11500 })]);
    const other = (await db.query<{ id: string }>('select id from public.deposit_invoices where id<>$1',[draft])).rows[0].id;
    await db.query('select * from public.commercial_invoice_issue_draft($1,1,$2,$3)',[other,crypto.randomUUID(),'Test bank']);
    await expect(issueDraft()).rejects.toThrow(/exceeds/);
  });

  it.each([
    ['next_stage', 5750], ['full_remaining', 11500], ['split', 3833],
  ] as const)('preserves %s quote billing through draft issuance', async (mode, amount) => {
    await db.query('update public.quote_versions set payment_terms=$1 where id=$2', [JSON.stringify([
      { id: 'deposit', label: 'Deposit', calculation: 'percentage', percentage: 50, resolvedAmountIncGstCents: 5750 },
      { id: 'final', label: 'Final', calculation: 'percentage', percentage: 50, resolvedAmountIncGstCents: 5750 },
    ]), version]);
    await db.query('select * from public.commercial_invoice_save_draft($1,$2,0,$3,$4,$5)',
      [draft, project, version, JSON.stringify(snapshot), JSON.stringify({ ...options, mode, paymentTermId: 'deposit', splitCount: 3 })]);
    await issueDraft();
    const row = (await db.query('select total_inc_gst_cents from public.deposit_invoices where id=$1', [draft])).rows[0];
    expect(row.total_inc_gst_cents).toBe(amount);
    if (mode === 'split') expect((await db.query('select sum(amount_inc_gst_cents)::int as total from public.project_invoice_plan_items')).rows[0].total).toBe(11500);
  });

  it('serializes competing issue commands so only one can issue the saved revision', async () => {
    await save();
    await issueDraft();
    await expect(issueDraft(1, crypto.randomUUID())).rejects.toThrow(/changed/);
  });

  it('rechecks admin role when issuing or deleting an existing draft', async () => {
    await save();
    await db.exec("select set_config('test.admin','no',true); savepoint denied");
    await expect(issueDraft()).rejects.toThrow(/Admin authentication/);
    await db.exec('rollback to savepoint denied');
    await expect(db.query('select public.commercial_invoice_delete_draft($1,1)', [draft])).rejects.toThrow(/Admin authentication/);
  });
});
