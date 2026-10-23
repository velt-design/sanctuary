// @vitest-environment node
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createFinanceRegisterDatabase, financeActor, seedFinanceRegisterScenario } from './support/financeRegisterDatabase';
import { revisedQuoteIds as ids } from './support/revisedQuoteScenario';
import { parseRegisterQuery, registerSchema, type RegisterData } from '../apps/portal/lib/finance/register';

let db: PGlite;
const read = async (tab = 'invoices', view = 'all', search = '', sent = 'all', offset = 0, actor = financeActor): Promise<RegisterData> =>
  registerSchema.parse((await db.query<{ result: unknown }>('select public.finance_register_v1($1,$2,$3,$4,$5,$6) result', [actor, tab, view, search, sent, offset])).rows[0].result);
const one = async (id: string) => (await read()).rows.find(row => row.id === id)!;
async function deliveryIntent(subject: string, kind: 'quote_send' | 'quote_resend' | 'deposit_invoice_send', status: string, key?: string) {
  const intentKey=key ?? `${kind==='quote_send'?'quote-send':'quote-resend'}:${subject}:${crypto.randomUUID()}`;
  await db.query(`insert into private.commercial_email_intents(intent_key,kind,subject_id,project_id,payload_hash,protected_payload,status,
    provider_idempotency_key,provider_idempotency_expires_at,provider_message_id)
    values($1,$2,$3,$4,repeat('a',64),$5,$6,$1,now()+interval '1 day',$7)`,
    [intentKey,kind,subject,ids.project,JSON.stringify({to:['synthetic-private@example.invalid'],body:'SYNTHETIC_PRIVATE_PAYLOAD_MUST_NOT_ESCAPE'}),status,status==='provider_accepted'?'synthetic-provider-message':null]);
}
async function preparedQuote() {
  return (await db.query<{id:string}>(`insert into public.quote_versions(quote_id,version_number,status,customer_name,total_inc_gst_cents,total_ex_gst_cents,gst_cents,
    is_current_draft,delivery_prepared_at,created_at) values($1,4,'DRAFT','Prepared synthetic customer',100000,86957,13043,true,now()-interval '1 day',now()-interval '2 days') returning id`,[ids.quote])).rows[0].id;
}

describe('Finance register, current commercial migrations and actual read SQL', () => {
  beforeAll(async () => { db = await createFinanceRegisterDatabase(); }, 30000);
  afterAll(async () => { await db?.close(); });
  beforeEach(async () => { await db.exec('begin'); await seedFinanceRegisterScenario(db); });
  afterEach(async () => { await db.exec('rollback'); });

  it('preserves direct paid receipt evidence after funding is allocated to a newer quote', async () => {
    const topup = await one(ids.topup);
    expect(topup).toMatchObject({ status: 'PAID', paidCents: 20000, balanceCents: 0, checkReason: null });
    expect((await read('invoices', 'outstanding')).rows.every(row => row.status === 'OPEN')).toBe(true);
    expect((await read('invoices', 'outstanding')).rows.some(row => row.id === ids.topup)).toBe(false);
  });

  it('reads partial Xero receipts once, even when also allocated; reversal restores owing', async () => {
    // The existing seed issues the old base invoice through canonical acceptance.
    const invoice = (await db.query<any>("select * from public.deposit_invoices where project_id=$1 and status='OPEN'", [ids.project])).rows[0];
    await db.query(`insert into public.project_payment_entries(id,project_id,entry_type,amount_inc_gst_cents,occurred_at,created_by)
      values($1,$2,'PAYMENT',4000,now(),'Synthetic')`, [financeActor, ids.project]);
    await db.query(`insert into public.xero_deposit_matches(id,tenant_id,receipt_id,contact_id,project_id,invoice_id,payment_entry_id,amount_inc_gst_cents,receipt_date,evidence_fingerprint,approved_by)
      values(gen_random_uuid(),$1,gen_random_uuid(),gen_random_uuid(),$2,$3,$1,4000,current_date,repeat('a',64),$1)`, [financeActor, ids.project, invoice.id]);
    expect(await one(invoice.id)).toMatchObject({ paidCents: 4000, balanceCents: invoice.total_inc_gst_cents - 4000, checkReason: null });
    // Match-owner canonical full settlement is the only allocation permitted.
    // A fixture supplement models old source+match evidence for dedup coverage.
    await db.exec('alter table public.project_payment_entries disable trigger all');
    await db.query('update public.project_payment_entries set source_invoice_id=$1 where id=$2', [invoice.id, financeActor]);
    await db.exec('alter table public.project_payment_entries enable trigger all');
    expect((await one(invoice.id)).paidCents).toBe(4000);
    await db.query("select public.commercial_reverse_payment_entry_with_project_lock($1,$2,$3)", [financeActor, 'Synthetic reversal', financeActor]);
    expect(await one(invoice.id)).toMatchObject({ paidCents: 0, balanceCents: invoice.total_inc_gst_cents });
  });

  it('keeps internally consistent portal balances when Xero is missing, stale or unavailable', async () => {
    const invoice = (await db.query<any>("select * from public.deposit_invoices where project_id=$1 and status='OPEN'", [ids.project])).rows[0];
    await db.query('insert into private.xero_invoice_transfers(id,invoice_id,project_id,tenant_id,provider_invoice_id) values($1,$2,$3,$1,$1)', [financeActor, invoice.id, ids.project]);
    expect(await one(invoice.id)).toMatchObject({ balanceCents: invoice.total_inc_gst_cents, providerNote: 'Xero has not confirmed this invoice yet.' });
    await db.query(`insert into private.xero_invoice_observations values($1,1,'OPEN','{"state":"posted","amountPaidCents":0}',now()-interval '3 days')`, [financeActor]);
    expect(await one(invoice.id)).toMatchObject({ balanceCents: invoice.total_inc_gst_cents, providerNote: 'Xero payment check is out of date.' });
    await db.query(`insert into private.xero_invoice_observations values($1,2,'OPEN','{"state":"unavailable","amountPaidCents":null}',now())`, [financeActor]);
    expect(await one(invoice.id)).toMatchObject({ balanceCents: invoice.total_inc_gst_cents, providerNote: 'Xero could not confirm the portal position.' });
  });

  it('keeps unassigned credit visible for checking and labels incomplete owing totals', async () => {
    await db.query(`select public.commercial_record_project_payment_entry($1,'PAYMENT',1000,now(),'bank','Synthetic credit',null,null,'Synthetic',$2)`, [ids.project, 'finance-credit']);
    const result = await read('invoices', 'outstanding');
    expect(result.rows[0].balanceCents).toBeNull();
    expect(result.rows[0].checkReason).toContain('Project credit');
    expect(result.totals[0].unconfirmedCount).toBe(1);
  });

  it('does not mistake historic delivery evidence for a restored invoice send', async () => {
    const invoice = (await db.query<any>("select * from public.deposit_invoices where project_id=$1 and status='OPEN'", [ids.project])).rows[0];
    await db.query(`insert into public.deposit_invoice_send_logs(deposit_invoice_id,status,sent_at) values($1,'SENT',now())`, [invoice.id]);
    expect((await one(invoice.id)).sendState).toBe('sent');
    await db.exec('alter table public.deposit_invoices disable trigger all');
    await db.query('update public.deposit_invoices set restore_command_id=$1,restored_at=now() where id=$2', [financeActor, invoice.id]);
    await db.exec('alter table public.deposit_invoices enable trigger all');
    expect(await one(invoice.id)).toMatchObject({ sendState: 'needs', sentAt: null });
    await db.query(`insert into private.commercial_email_intents(id,intent_key,kind,subject_id,project_id,payload_hash,protected_payload,status,
      provider_idempotency_key,provider_idempotency_expires_at) values($1,$2,'deposit_invoice_send',$3,$4,repeat('a',64),'{}','dispatching',$2,now()+interval '1 day')`,
      [financeActor, `deposit-invoice-send:${invoice.id}:restore:${financeActor}`, invoice.id, ids.project]);
    expect((await one(invoice.id)).sendState).toBe('pending');
    await db.query(`insert into public.deposit_invoice_send_logs(deposit_invoice_id,delivery_intent_id,status,sent_at) values($1,$2,'SENT',now())`, [invoice.id, financeActor]);
    expect((await one(invoice.id)).sendState).toBe('sent');
  });

  it('rechecks finance grant and preserves admin-only invoice drafts', async () => {
    expect((await read('invoices','drafts')).rows).toHaveLength(1);
    await db.query("update public.portal_users set role='staff' where user_id=$1", [financeActor]);
    expect((await read()).draftsAllowed).toBe(false);
    expect((await read('invoices','drafts')).rows).toHaveLength(0);
    const permissions = await db.query<any>(`select has_function_privilege('authenticated','public.finance_register_v1(uuid,text,text,text,text,integer)','execute') browser,
      has_function_privilege('service_role','public.finance_register_v1(uuid,text,text,text,text,integer)','execute') service`);
    expect(permissions.rows[0]).toEqual({ browser: false, service: true });
    await db.query('update public.xero_payment_approvers set revoked_at=now() where user_id=$1',[financeActor]);
    await expect(read()).rejects.toThrow('Payment approval permission');
  });

  it('shows pending draft separately and never revives an accepted lifecycle tombstone', async () => {
    const awaiting = await read('quotes', 'awaiting');
    expect(awaiting.rows.find(row => row.quoteId === ids.quote)).toMatchObject({ id: ids.version, status: 'SENT', acceptedVersion: null });
    await db.query(`insert into public.quote_versions(quote_id,version_number,status,total_inc_gst_cents,total_ex_gst_cents,gst_cents,is_current_draft)
      values($1,4,'DRAFT',200000,173913,26087,true)`,[ids.quote]);
    expect((await read('quotes','awaiting')).rows.find(row => row.quoteId===ids.quote)).toMatchObject({ id: ids.version, pendingDraftVersion: 4 });
    expect((await read('quotes','drafts')).rows.find(row => row.quoteId===ids.quote)).toMatchObject({ version: 4, status: 'DRAFT' });
    expect((await read('quotes','accepted')).rows.find(row => row.quoteId===ids.quote)).toBeUndefined();
    expect((await read('quotes','all')).rows.find(row => row.quoteId===ids.quote)?.history).toHaveLength(4);
  });

  it('keeps actual accepted, expired and declined lifecycles distinct and searches snapshot customer names', async () => {
    await db.query(`insert into public.quote_versions(quote_id,version_number,status,customer_name,total_inc_gst_cents,total_ex_gst_cents,gst_cents,accepted_at)
      select id,1,'ACCEPTED','Synthetic snapshot customer',30000,26087,3913,now() from public.quotes where quote_ref='Q-OTHER'`);
    const accepted=(await read('quotes','accepted','snapshot customer')).rows[0];
    expect(accepted).toMatchObject({status:'ACCEPTED',acceptedVersion:1,customer:'Synthetic snapshot customer'});
    await db.query("update public.quote_versions set status='SUPERSEDED' where id=$1",[accepted.id]);
    expect((await read('quotes','accepted','snapshot customer')).rows).toHaveLength(0);
    await db.query('update public.quote_versions set expires_at=current_date-2 where id=$1',[ids.version]);
    expect((await read('quotes','expired')).rows.find(row=>row.id===ids.version)).toMatchObject({status:'SENT',expired:true});
    expect((await read('quotes','awaiting')).rows.find(row=>row.id===ids.version)).toBeUndefined();
    await db.query(`insert into public.quote_versions(quote_id,version_number,status,total_inc_gst_cents,total_ex_gst_cents,gst_cents)
      values($1,4,'DECLINED',200000,173913,26087)`,[ids.quote]);
    expect((await read('quotes','declined')).rows.find(row=>row.quoteId===ids.quote)).toMatchObject({version:4,status:'DECLINED'});
  });

  it('retains successful send evidence and reports a later failed attempt truthfully', async () => {
    const invoice=(await db.query<any>("select id from public.deposit_invoices where invoice_ref='INV-REGISTER'")).rows[0];
    await db.query(`insert into public.deposit_invoice_send_logs(deposit_invoice_id,status,created_at,sent_at)
      values($1,'SENT',now()-interval '1 day',now()-interval '1 day'),($1,'FAILED',now(),null)`,[invoice.id]);
    expect(await one(invoice.id)).toMatchObject({sendState:'sent',sendNote:'Latest send attempt failed.'});
    expect((await read('invoices','outstanding','','sent')).rows).toHaveLength(1);
    expect((await read('invoices','outstanding','','needs')).rows).toHaveLength(0);
  });

  it.each([
    ['prepared','prepared','prepared'],['dispatching','pending','being confirmed'],['provider_accepted','pending','being confirmed'],
    ['failed','failed','failed'],['needs_attention','review','needs attention'],
  ])('preserves canonical %s quote delivery while the lifecycle is still DRAFT',async(status,state,note)=>{
    const quote=await preparedQuote();await deliveryIntent(quote,'quote_send',status);
    const result=await read('quotes','drafts');const selected=result.rows.find(row=>row.id===quote)!;
    expect(selected).toMatchObject({status:'DRAFT',sentAt:null,sendState:state,deliveryState:status});
    expect(selected.sendNote).toContain(note);expect(selected.lastAttemptAt).not.toBeNull();
    const pending=['dispatching','provider_accepted'].includes(status);
    expect((await read('quotes','drafts','','pending')).rows.some(row=>row.id===quote)).toBe(pending);
    expect((await read('quotes','drafts','','needs')).rows.some(row=>row.id===quote)).toBe(!pending);
    const raw=(await db.query<any>("select public.finance_register_v1($1,'quotes','drafts','','all',0) result",[financeActor])).rows[0].result;
    expect(JSON.stringify(raw)).not.toContain('SYNTHETIC_PRIVATE_PAYLOAD');expect(JSON.stringify(raw)).not.toContain('synthetic-private@example.invalid');
    expect(JSON.stringify(raw)).not.toContain('synthetic-provider-message');expect(selected).not.toHaveProperty('protected_payload');
  });

  it.each(['prepared','dispatching','provider_accepted','failed','needs_attention'])('keeps a successful send distinct from an unfinished %s resend',async status=>{
    await db.query('update public.quote_versions set sent_at=now()-interval \'2 days\' where id=$1',[ids.version]);
    await deliveryIntent(ids.version,'quote_resend',status);
    const selected=(await read('quotes','awaiting')).rows.find(row=>row.id===ids.version)!;
    expect(selected).toMatchObject({sendState:'sent',deliveryState:status});expect(selected.sentAt).not.toBeNull();expect(selected.sendNote).toContain('Resend');
    expect((await read('quotes','awaiting','','sent')).rows.some(row=>row.id===ids.version)).toBe(true);
    expect((await read('quotes','awaiting','','pending')).rows.some(row=>row.id===ids.version)).toBe(['dispatching','provider_accepted'].includes(status));
    expect((await read('quotes','awaiting','','needs')).rows.some(row=>row.id===ids.version)).toBe(['prepared','failed','needs_attention'].includes(status));
  });

  it('finds a pending draft revision in All without hiding or retiring its earlier sent version',async()=>{
    await db.query('update public.quote_versions set sent_at=now()-interval \'2 days\' where id=$1',[ids.version]);
    const revised=await preparedQuote();await deliveryIntent(revised,'quote_send','provider_accepted');
    expect((await read('quotes','all')).rows.find(row=>row.quoteId===ids.quote)).toMatchObject({id:ids.version,status:'SENT',sendState:'sent',pendingDraftVersion:4});
    expect((await read('quotes','all','','pending')).rows.find(row=>row.quoteId===ids.quote)).toMatchObject({id:revised,status:'DRAFT',sendState:'pending',pendingDraftVersion:4});
    expect((await read('quotes','all','','sent')).rows.find(row=>row.quoteId===ids.quote)).toMatchObject({id:ids.version,status:'SENT',sendState:'sent'});
    expect((await read('quotes','all','','needs')).rows.find(row=>row.quoteId===ids.quote)).toBeUndefined();
    expect((await db.query<any>('select status from public.quote_versions where id=$1',[ids.version])).rows[0].status).toBe('SENT');
  });

  it('ignores cancelled/finalised attempts, leaves ordinary drafts unsent, and gives initial-send recovery precedence',async()=>{
    const quote=await preparedQuote();
    expect((await read('quotes','drafts')).rows.find(row=>row.id===quote)).toMatchObject({sendState:'needs',deliveryState:null,sendNote:null});
    // Current restoration ownership forbids quote cancellation altogether.
    await db.exec('savepoint rejected_quote_cancel');
    await expect(deliveryIntent(quote,'quote_send','cancelled')).rejects.toThrow('Only invoice restoration');
    await db.exec('rollback to savepoint rejected_quote_cancel; release savepoint rejected_quote_cancel');
    expect((await read('quotes','drafts')).rows.find(row=>row.id===quote)).toMatchObject({sendState:'needs',deliveryState:null,sendNote:null});
    await db.query('update public.quote_versions set sent_at=now()-interval \'2 days\' where id=$1',[ids.version]);
    await deliveryIntent(ids.version,'quote_resend','finalised');
    expect((await read('quotes','awaiting')).rows.find(row=>row.id===ids.version)).toMatchObject({sendState:'sent',deliveryState:null,sendNote:null});
    await deliveryIntent(quote,'quote_send','failed');await deliveryIntent(quote,'quote_resend','provider_accepted');
    expect((await read('quotes','drafts')).rows.find(row=>row.id===quote)).toMatchObject({sendState:'failed',deliveryState:'failed'});
  });

  it.each(['prepared','dispatching','provider_accepted','failed','needs_attention'])('keeps invoice %s delivery out of an ordinary fresh-send interpretation',async status=>{
    const invoice=(await db.query<any>("select id from public.deposit_invoices where invoice_ref='INV-REGISTER'")).rows[0].id;
    await deliveryIntent(invoice,'deposit_invoice_send',status,`deposit-invoice-send:${invoice}`);
    const selected=await one(invoice);expect(selected.deliveryState).toBe(status);
    const pending=['dispatching','provider_accepted'].includes(status);
    expect((await read('invoices','outstanding','','pending')).rows.some(row=>row.id===invoice)).toBe(pending);
    expect((await read('invoices','outstanding','','needs')).rows.some(row=>row.id===invoice)).toBe(!pending);
    expect(selected.sendState).toBe(pending?'pending':status==='needs_attention'?'review':status==='failed'?'failed':'prepared');
  });

  it.each(['cancelled','finalised'])('does not treat a terminal %s invoice intent as pending',async status=>{
    const invoice=(await db.query<any>("select id from public.deposit_invoices where invoice_ref='INV-REGISTER'")).rows[0].id;
    await deliveryIntent(invoice,'deposit_invoice_send',status,`deposit-invoice-send:${invoice}`);
    if(status==='finalised')await db.query('update public.deposit_invoices set sent_at=now()-interval \'1 day\' where id=$1',[invoice]);
    expect(await one(invoice)).toMatchObject({deliveryState:null,sendState:status==='finalised'?'sent':'needs',sendNote:null});
    expect((await read('invoices','outstanding','','pending')).rows.some(row=>row.id===invoice)).toBe(false);
  });

  it('bounds pagination and totals the full matching set separately by currency', async () => {
    // Synthetic issued standalone invoices, not customer operations.
    await db.exec(`alter table public.deposit_invoices disable trigger all;
      insert into public.deposit_invoices select (jsonb_populate_record(null::public.deposit_invoices,to_jsonb(i)||jsonb_build_object(
        'id',gen_random_uuid(),'invoice_ref','REGISTER-'||lpad(n::text,4,'0'),'issue_command_id',null,'due_date',current_date-1,
        'currency',case when n<=60 then 'NZD' else 'AUD' end,'total_inc_gst_cents',1000,'total_ex_gst_cents',870,'gst_cents',130))).*
      from public.deposit_invoices i cross join generate_series(1,65) n where i.invoice_ref='INV-REGISTER';      alter table public.deposit_invoices enable trigger all;`);
    const first = await read('invoices','overdue','REGISTER-');
    const next = await read('invoices','overdue','REGISTER-','all',50);
    expect(first.rows).toHaveLength(50); expect(first.count).toBe(65); expect(first.hasMore).toBe(true);
    expect(next.rows).toHaveLength(15); expect(next.hasMore).toBe(false);
    expect(new Set([...first.rows,...next.rows].map(row=>row.id)).size).toBe(65);
    expect(first.totals.map(total => [total.currency,total.balanceCents])).toEqual([['AUD',5000],['NZD',60000]]);
    expect(first.rows.every(row=>row.status==='OPEN')).toBe(true);
  });
});

it('normalises browser queries without accepting arbitrary views or unbounded pages', () => {
  expect(parseRegisterQuery(new URLSearchParams('tab=quotes&view=paid&offset=-1'))).toMatchObject({tab:'quotes',view:'awaiting',offset:0});
  expect(parseRegisterQuery(new URLSearchParams('offset=999999999'))).toMatchObject({offset:0});
});

it('declares a read-write RPC transaction for the canonical grant-row lock without weakening that guard',async()=>{
  const transportDb=await createFinanceRegisterDatabase();
  try{
    await seedFinanceRegisterScenario(transportDb);
    const metadata=(await transportDb.query<{provolatile:string;guard:string}>(`select p.provolatile,
      pg_get_functiondef('public.xero_require_payment_approver(uuid)'::regprocedure) guard
      from pg_proc p where p.oid='public.finance_register_v1(uuid,text,text,text,text,integer)'::regprocedure`)).rows[0];
    // PostgREST uses read-write transactions for POST VOLATILE RPCs. STABLE
    // would put this permission check in a read-only transaction and return 25006.
    expect(metadata.provolatile).toBe('v');expect(metadata.guard).toMatch(/for\s+share/i);
    await transportDb.exec('begin read only');
    await expect(transportDb.query("select public.finance_register_v1($1,'invoices','outstanding','','all',0)",[financeActor]))
      .rejects.toThrow('cannot execute SELECT FOR SHARE in a read-only transaction');
    await transportDb.exec('rollback; begin read write');
    const result=(await transportDb.query<{result:unknown}>("select public.finance_register_v1($1,'invoices','outstanding','','all',0) result",[financeActor])).rows[0].result;
    expect(registerSchema.parse(result).rows.length).toBeGreaterThan(0);
    await transportDb.exec('rollback');
  }finally{await transportDb.close();}
},30000);
