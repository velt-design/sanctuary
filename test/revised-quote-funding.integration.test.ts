// @vitest-environment node
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createRevisedQuoteDatabase } from './support/revisedQuoteDatabase';
import { seedRevisedQuoteScenario } from './support/revisedQuoteScenario';

const project = '10000000-0000-4000-8000-000000000001';
const otherProject = '10000000-0000-4000-8000-000000000002';
const quote = '20000000-0000-4000-8000-000000000001';
const otherQuote = '20000000-0000-4000-8000-000000000002';
const feeVersion = '30000000-0000-4000-8000-000000000001';
const oldVersion = '30000000-0000-4000-8000-000000000002';
const version = '30000000-0000-4000-8000-000000000003';
const fee = '40000000-0000-4000-8000-000000000001';
const topup = '40000000-0000-4000-8000-000000000002';
const draft = '40000000-0000-4000-8000-000000000003';
const cmd = '50000000-0000-4000-8000-000000000001';
let db: PGlite;
let oldInvoice: string;

const term = (amount: number, percent = 100) => JSON.stringify([{ id: 'payment-1', label: 'Payment', calculationType: 'percentage', percentageOfRemainder: percent, resolvedAmountIncGstCents: amount }, ...(percent === 50 ? [{ id: 'payment-2', label: 'Final', calculationType: 'percentage', percentageOfRemainder: 50, resolvedAmountIncGstCents: amount }] : [])]);
const content = (amount: number) => ({ version: 1, billingName: 'Synthetic customer', billingEmail: 'customer@example.invalid', billingAddress: '', notes: '', items: [{ id: '60000000-0000-4000-8000-000000000001', description: 'Synthetic outdoor work', qty: 1, unitPriceIncGstCents: amount, lineTotalIncGstCents: amount }] });
async function reconcile(invoice: string, treatment: string, target: string | null, amount: number, revision = 0, command = crypto.randomUUID(), fingerprint?: string) {
  const hash = fingerprint ?? (await db.query<{ value: string }>('select public.commercial_invoice_scope_fingerprint($1) value', [invoice])).rows[0].value;
  return db.query<{ result: unknown }>('select public.commercial_reconcile_invoice_scope($1,$2,$3,$4,\'PAID\',$5,$6,$7,$8,$9) result', [invoice, treatment, target, amount, revision, hash, command, 'Explicit synthetic reconciliation', 'synthetic-operator']);
}
const accept = () => db.query<any>('select * from public.commercial_accept_quote_with_project_lock_v2($1,$2)', [version, 'synthetic-staff']);
const truth = async () => (await db.query<any>('select * from public.commercial_project_financial_truth($1)', [project])).rows[0];
async function reject(action: () => Promise<unknown>, pattern: RegExp) {
  await db.exec('savepoint expected_failure');
  await expect(action()).rejects.toThrow(pattern);
  await db.exec('rollback to savepoint expected_failure');
}
async function stableHistory() {
  return (await db.query(`select jsonb_build_object(
    'invoices',(select jsonb_agg(to_jsonb(i) order by id) from public.deposit_invoices i),
    'entries',(select jsonb_agg(to_jsonb(e) order by id) from public.project_payment_entries e),
    'allocations',(select jsonb_agg(to_jsonb(a) order by id) from public.project_payment_allocations a),
    'transfers',(select jsonb_agg(to_jsonb(t) order by id) from private.xero_invoice_transfers t),
    'requests',(select jsonb_agg(to_jsonb(r)) from private.xero_invoice_requests r),
    'emails',(select jsonb_agg(to_jsonb(e) order by id) from private.commercial_email_intents e)) value`)).rows[0].value;
}

describe('funded revised quote and explicit deposit reconciliation, production SQL', () => {
  beforeAll(async () => { db = await createRevisedQuoteDatabase(); }, 30000);
  afterAll(async () => { await db?.close(); });
  beforeEach(async () => {
    await db.exec('begin');
    oldInvoice = await seedRevisedQuoteScenario(db);
  });
  afterEach(async () => { await db.exec('rollback'); });

  it('retains the initial construction invoice when the historical assessment is explicitly separate', async () => {
    expect(oldInvoice).toBeTruthy();
    expect((await db.query<any>('select total_inc_gst_cents from public.deposit_invoices where id=$1', [oldInvoice])).rows[0].total_inc_gst_cents).toBe(50000);
  });
  it('reconciles the top-up without modifying any issued financial or provider evidence', async () => {
    const before = await stableHistory();
    await reconcile(topup, 'QUOTE_PAYMENT', quote, 20000);
    expect(await stableHistory()).toEqual(before);
    const beforeAcceptance = await truth();
    expect(beforeAcceptance.accepted_total_inc_gst_cents).toBe(5000);
    expect(beforeAcceptance.paid_inc_gst_cents).toBe(75000);
    expect((await db.query('select * from public.commercial_current_accepted_quote_versions($1)', [project])).rows).toHaveLength(0);
    const accepted = (await accept()).rows[0];
    expect(accepted.invoice_id).toBeNull();
    expect(accepted.invoice_created).toBe(false);
    expect(accepted.invoice_created_at).toBeTruthy();
    expect(await stableHistory()).toEqual(before);
    expect(await truth()).toMatchObject({ accepted_total_inc_gst_cents: 165000, paid_inc_gst_cents: 75000, open_invoice_inc_gst_cents: 0, remaining_to_invoice_inc_gst_cents: 90000 });
    expect((await db.query<any>('select * from public.commercial_quote_scope_funding($1)', [version])).rows[0]).toEqual({ paid_inc_gst_cents: 70000, open_inc_gst_cents: 0, carried_paid_inc_gst_cents: 70000 });
  });
  it('keeps old invoice-guaranteed callers safe while the new application rolls out', async () => {
    await reconcile(topup, 'QUOTE_PAYMENT', quote, 20000);
    await reject(() => db.query('select * from public.commercial_accept_quote_with_project_lock($1,$2)', [version,'legacy-staff']), /exceeds/);
    expect((await db.query<any>('select status from public.quote_versions where id=$1', [version])).rows[0].status).toBe('SENT');
    const accepted = (await accept()).rows[0];
    expect(accepted.invoice_id).toBeNull();
    await reject(() => db.query('select * from public.commercial_accept_quote_with_project_lock($1,$2)', [version,'legacy-staff']), /current application/);
    expect((await accept()).rows[0].invoice_id).toBeNull();
  });
  it('preserves intentional no-invoice acceptance on repeated requests', async () => {
    await reconcile(topup, 'QUOTE_PAYMENT', quote, 20000);
    const first = (await accept()).rows[0];
    const again = (await accept()).rows[0];
    expect(again).toMatchObject({ invoice_id: null, invoice_created: false, already_accepted: true, invoice_created_at: first.invoice_created_at });
    expect((await db.query('select * from public.deposit_invoices')).rows).toHaveLength(3);
  });
  it('creates a chosen custom progress draft, issues once, reloads and retains the final balance', async () => {
    await reconcile(topup, 'QUOTE_PAYMENT', quote, 20000); await accept();
    await db.query('select public.commercial_invoice_save_draft($1,$2,0,$3,$4,$5)', [draft, project, version, null, JSON.stringify({ mode: 'custom', label: 'Progress payment', amountIncGstCents: 60000, dueDate: '2026-10-30' })]);
    expect((await truth()).remaining_to_invoice_inc_gst_cents).toBe(90000);
    const result = (await db.query<any>('select * from public.commercial_invoice_issue_draft($1,1,$2,$3)', [draft, crypto.randomUUID(), 'Synthetic payment details'])).rows[0];
    expect(result.status).toBe('OPEN');
    expect((await truth()).remaining_to_invoice_inc_gst_cents).toBe(30000);
    expect((await db.query<any>('select total_inc_gst_cents,status from public.deposit_invoices where id=$1', [draft])).rows[0]).toEqual({ total_inc_gst_cents: 60000, status: 'OPEN' });
  });
  it('supports the explicit assessment-credit choice without changing its paid document', async () => {
    await reconcile(fee, 'NATIVE', null, 5000, 1);
    await reconcile(topup, 'QUOTE_PAYMENT', quote, 20000); await accept();
    expect(await truth()).toMatchObject({ accepted_total_inc_gst_cents: 160000, paid_inc_gst_cents: 75000, remaining_to_invoice_inc_gst_cents: 85000 });
  });
  it('rejects stale ledger evidence, cross-project links and conflicting command reuse', async () => {
    const hash = (await db.query<any>('select public.commercial_invoice_scope_fingerprint($1) value', [topup])).rows[0].value;
    await db.query("insert into public.project_payment_entries(project_id,entry_type,amount_inc_gst_cents,occurred_at) values($1,'PAYMENT',100,now())", [project]);
    await reject(() => reconcile(topup, 'QUOTE_PAYMENT', quote, 20000, 0, crypto.randomUUID(), hash), /Payment evidence changed/);
    await reject(() => reconcile(topup, 'QUOTE_PAYMENT', otherQuote, 20000), /same project/);
    const command = crypto.randomUUID();
    const fingerprint = (await db.query<any>('select public.commercial_invoice_scope_fingerprint($1) value', [topup])).rows[0].value;
    const first = await reconcile(topup, 'QUOTE_PAYMENT', quote, 20000, 0, command, fingerprint);
    expect(await reconcile(topup, 'QUOTE_PAYMENT', quote, 20000, 0, command, fingerprint)).toEqual(first);
    await reject(() => reconcile(topup, 'NATIVE', null, 20000, 1, command), /different input/);
  });
  it('does not resend a later custom invoice on a quote acceptance replay', async () => {
    await reconcile(topup, 'QUOTE_PAYMENT', quote, 20000); await accept();
    await db.query('select * from public.commercial_create_admin_invoice_idempotent($1,$2,\'custom\',null,30000,null,\'Progress\',null,null,\'Synthetic details\',false,null,\'synthetic-admin\',\'synthetic-progress-one\')', [project, version]);
    expect((await accept()).rows[0]).toMatchObject({ invoice_id: null, invoice_created: false, already_accepted: true });
    expect((await truth()).remaining_to_invoice_inc_gst_cents).toBe(60000);
  });
  it('uses carried funding for ordinary stage billing and enforces the lower scope balance', async () => {
    await reconcile(topup, 'QUOTE_PAYMENT', quote, 20000); await accept();
    const stage = (await db.query<any>("select * from public.commercial_create_admin_invoice_idempotent($1,$2,'next_stage','payment-1',null,null,'Progress',null,null,'Synthetic details',false,null,'synthetic-admin','synthetic-stage-intent')", [project, version])).rows[0];
    expect(stage.remaining_before_inc_gst_cents).toBe(90000);
    expect((await db.query<any>('select total_inc_gst_cents from public.deposit_invoices where id=$1', [stage.invoice_id])).rows[0].total_inc_gst_cents).toBe(90000);
    await reject(() => db.query("select * from public.commercial_create_admin_invoice_idempotent($1,$2,'custom',null,100,null,'Extra',null,null,'Synthetic details',false,null,'synthetic-admin','synthetic-over-limit')", [project, version]), /remaining/);
  });
  it('preserves an explicit division of quote receipts between separate families', async () => {
    await reconcile(topup, 'QUOTE_PAYMENT', quote, 20000); await accept();
    const addOn = '20000000-0000-4000-8000-000000000003';
    const addOnVersion = '30000000-0000-4000-8000-000000000004';
    await db.query("insert into public.quotes(id,project_id,quote_ref,commercial_scope_id) values($1,$2,'Q-ADDON',$1)", [addOn, project]);
    await db.query("insert into public.quote_versions(id,quote_id,version_number,status,total_inc_gst_cents,total_ex_gst_cents,gst_cents,accepted_at,payment_terms) values($1,$2,1,'ACCEPTED',40000,34783,5217,now(),$3)", [addOnVersion, addOn, term(40000)]);
    const payment = (await db.query<any>('select id from public.project_payment_entries where source_invoice_id=$1', [oldInvoice])).rows[0].id;
    await db.query('select public.commercial_replace_payment_allocations($1,$2,$3,$4)', [payment, JSON.stringify([{ quote_version_id: version, payment_term_id: 'payment-1', amount_inc_gst_cents: 30000 }, { quote_version_id: addOnVersion, payment_term_id: 'payment-1', amount_inc_gst_cents: 20000 }]), 'Explicit division between scopes', 'synthetic-admin']);
    expect((await db.query<any>('select * from public.commercial_quote_scope_funding($1)', [version])).rows[0].paid_inc_gst_cents).toBe(50000);
    expect((await db.query<any>('select * from public.commercial_quote_scope_funding($1)', [addOnVersion])).rows[0].paid_inc_gst_cents).toBe(20000);
  });
  it('accepts an explicitly funded family without requiring a historical acceptance', async () => {
    const importedVersion = '30000000-0000-4000-8000-000000000005';
    await db.query("insert into public.quote_versions(id,quote_id,version_number,status,total_inc_gst_cents,total_ex_gst_cents,gst_cents,payment_terms) values($1,$2,1,'SENT',80000,69565,10435,$3)", [importedVersion, otherQuote, term(80000)]);
    // An explicit source invoice can be linked before any quote was accepted.
    await db.query('update public.quotes set project_id=$1 where id=$2', [project, otherQuote]);
    await reconcile(topup, 'QUOTE_PAYMENT', otherQuote, 20000);
    const accepted = (await db.query<any>('select * from public.commercial_accept_quote_with_project_lock_v2($1,$2)', [importedVersion, 'synthetic-admin'])).rows[0];
    expect(accepted.invoice_id).toBeNull();
    expect((await db.query<any>('select * from public.commercial_quote_scope_funding($1)', [importedVersion])).rows[0].paid_inc_gst_cents).toBe(20000);
  });
  it('retains the scheduled replacement path for an unpaid revision', async () => {
    const first = '30000000-0000-4000-8000-000000000005', next = '30000000-0000-4000-8000-000000000006';
    await db.query("insert into public.quote_versions(id,quote_id,version_number,status,total_inc_gst_cents,total_ex_gst_cents,gst_cents,payment_terms) values($1,$3,1,'SENT',80000,69565,10435,$4),($2,$3,2,'SENT',100000,86957,13043,$5)", [first, next, otherQuote, term(40000,50), term(50000,50)]);
    const old = (await db.query<any>('select * from public.commercial_accept_quote_with_project_lock_v2($1,$2)', [first, 'synthetic-admin'])).rows[0];
    const revised = (await db.query<any>('select * from public.commercial_accept_quote_with_project_lock_v2($1,$2)', [next, 'synthetic-admin'])).rows[0];
    expect(revised.invoice_id).toBeTruthy();
    expect((await db.query<any>('select status from public.deposit_invoices where id=$1', [old.invoice_id])).rows[0].status).toBe('VOID');
    expect((await db.query<any>('select total_inc_gst_cents from public.deposit_invoices where id=$1', [revised.invoice_id])).rows[0].total_inc_gst_cents).toBe(50000);
  });
  it('retains already-issued unpaid exposure alongside a funded revision', async () => {
    // An existing additional stage remains payable after the scope is revised.
    await db.query("insert into public.deposit_invoices(id,project_id,quote_id,quote_version_id,quote_ref,quote_version_number,invoice_ref,status,quote_total_inc_gst_cents,total_inc_gst_cents,total_ex_gst_cents,gst_cents,payment_term_id,payment_term_label) values($1,$2,$3,$4,'Q-SYNTHETIC',2,'INV-EXISTING','OPEN',100000,10000,8696,1304,'payment-2','Existing stage')", [draft, project, quote, oldVersion]);
    await reconcile(topup, 'QUOTE_PAYMENT', quote, 20000);
    await db.query('insert into auth.users values($1)', [cmd]);
    await db.query("insert into public.project_payment_entries(id,project_id,entry_type,amount_inc_gst_cents,occurred_at) values($1,$2,'PAYMENT',2000,now())", [cmd,project]);
    await db.query("insert into public.xero_deposit_matches(id,tenant_id,receipt_id,contact_id,project_id,invoice_id,payment_entry_id,amount_inc_gst_cents,receipt_date,evidence_fingerprint,approved_by) values($1,$1,$1,$1,$2,$3,$1,2000,current_date,repeat('a',64),$1)", [cmd,project,draft]);
    const history = await stableHistory();
    expect((await accept()).rows[0].invoice_id).toBeNull();
    expect(await stableHistory()).toEqual(history);
    expect(await truth()).toMatchObject({ paid_inc_gst_cents: 77000, open_invoice_inc_gst_cents: 8000, remaining_to_invoice_inc_gst_cents: 80000 });
  });
  it('checks a reconciled top-up against current family limits when restoring', async () => {
    await reconcile(topup, 'QUOTE_PAYMENT', quote, 20000);
    const unpaid = '40000000-0000-4000-8000-000000000004';
    await db.query('select public.commercial_invoice_save_draft($1,$2,0,null,$3,$4)', [unpaid,project,JSON.stringify(content(20000)),JSON.stringify({ mode: 'custom', label: 'Additional deposit', amountIncGstCents: 20000, dueDate: '2026-10-30' })]);
    await db.query('select public.commercial_invoice_issue_draft($1,1,$2,$3)', [unpaid,crypto.randomUUID(),'Synthetic details']);
    const fingerprint = (await db.query<any>('select public.commercial_invoice_scope_fingerprint($1) value',[unpaid])).rows[0].value;
    await db.query("select public.commercial_reconcile_invoice_scope($1,'QUOTE_PAYMENT',$2,20000,'OPEN',0,$3,$4,'Explicit additional deposit','synthetic-admin')",[unpaid,quote,fingerprint,crypto.randomUUID()]);
    await db.query('select public.commercial_void_open_invoice($1,$2,$3)',[unpaid,'synthetic-admin','Accidental void']);
    const voided = (await db.query<any>('select voided_at::text value from public.deposit_invoices where id=$1',[unpaid])).rows[0].value;
    const restore = () => db.query('select public.commercial_restore_invoice($1,$2,$3,$4,$5)',[unpaid,voided,crypto.randomUUID(),'Restore valid deposit','synthetic-admin']);
    await reject(restore,/no current accepted quote/);
    await accept();
    await db.exec('savepoint replacement');
    await db.query("select * from public.commercial_create_admin_invoice_idempotent($1,$2,'custom',null,90000,null,'Remaining',null,null,'Synthetic details',false,null,'synthetic-admin','synthetic-full-limit')",[project,version]);
    await reject(restore,/remaining agreed balance/);
    await db.exec('rollback to savepoint replacement');
    await restore();
    expect((await truth()).remaining_to_invoice_inc_gst_cents).toBe(70000);
  });
  it('keeps manual acceptance stable after canonical payment reversal removes its funding', async () => {
    await reconcile(topup, 'QUOTE_PAYMENT', quote, 20000); await accept();
    for (const invoice of [topup,oldInvoice]) {
      const payment=(await db.query<any>("select id from public.project_payment_entries where source_invoice_id=$1 and entry_type='PAYMENT'",[invoice])).rows[0].id;
      await db.query('select public.commercial_reverse_payment_entry($1,$2,$3)',[payment,'Synthetic refund correction','synthetic-admin']);
    }
    expect((await db.query<any>('select * from public.commercial_quote_scope_funding($1)',[version])).rows[0].paid_inc_gst_cents).toBe(0);
    expect((await accept()).rows[0].invoice_id).toBeNull();
  });
  it('settles a reversed separate assessment against its own frozen stage without funding construction', async () => {
    await reconcile(topup, 'QUOTE_PAYMENT', quote, 20000); await accept();
    const receipt=(await db.query<any>("select id from public.project_payment_entries where source_invoice_id=$1 and entry_type='PAYMENT'",[fee])).rows[0].id;
    await db.query('select public.commercial_reverse_payment_entry_with_project_lock($1,$2,$3)',[receipt,'Correct assessment receipt','synthetic-admin']);
    expect((await db.query<any>('select status from public.deposit_invoices where id=$1',[fee])).rows[0].status).toBe('OPEN');
    await db.query('select * from public.commercial_mark_invoice_paid_with_project_lock($1,$2,null,null,null,null)',[fee,'synthetic-admin']);
    const repayment=(await db.query<any>("select id from public.project_payment_entries e where source_invoice_id=$1 and entry_type='PAYMENT' and not exists(select 1 from public.project_payment_entries r where r.reverses_entry_id=e.id)",[fee])).rows[0].id;
    expect(repayment).not.toBe(receipt);
    expect((await db.query<any>('select quote_version_id,payment_term_id from public.project_payment_allocations where payment_entry_id=$1 and reversed_at is null',[repayment])).rows).toEqual([{ quote_version_id: feeVersion, payment_term_id: 'payment-1' }]);
    await reject(()=>db.query('select public.commercial_replace_payment_allocations_with_project_lock($1,$2,$3,$4)',[repayment,JSON.stringify([{quote_version_id:version,payment_term_id:'payment-1',amount_inc_gst_cents:5000}]),'Cannot fund construction','synthetic-admin']),/Separate charge receipts/);
    expect((await db.query<any>('select * from public.commercial_quote_scope_funding($1)',[version])).rows[0].paid_inc_gst_cents).toBe(70000);
    expect(await truth()).toMatchObject({ accepted_total_inc_gst_cents:165000, paid_inc_gst_cents:75000, remaining_to_invoice_inc_gst_cents:90000 });
  });
  it.each(['BANK_TRANSACTION','INVOICE_PAYMENT'])('settles and corrects separate historical work from %s receipts', async source => {
    const separateVersion='30000000-0000-4000-8000-000000000005', invoice='40000000-0000-4000-8000-000000000005';
    const provider='60000000-0000-4000-8000-000000000005';
    await db.query("insert into public.quote_versions(id,quote_id,version_number,status,accepted_at,total_inc_gst_cents,total_ex_gst_cents,gst_cents,payment_terms) values($1,$2,1,'SUPERSEDED',now(),5000,4348,652,$3)",[separateVersion,otherQuote,term(5000)]);
    await db.query("insert into public.deposit_invoices(id,project_id,quote_id,quote_version_id,quote_ref,quote_version_number,invoice_ref,status,quote_total_inc_gst_cents,total_inc_gst_cents,total_ex_gst_cents,gst_cents,payment_term_id,payment_term_label) values($1,$2,$3,$4,'Q-OTHER',1,'INV-SEPARATE','OPEN',5000,5000,4348,652,'payment-1','Assessment')",[invoice,otherProject,otherQuote,separateVersion]);
    const fingerprint=(await db.query<any>('select public.commercial_invoice_scope_fingerprint($1) value',[invoice])).rows[0].value;
    await db.query("select public.commercial_reconcile_invoice_scope($1,'SEPARATE_CHARGE',null,5000,'OPEN',0,$2,$3,'Separate historical work','synthetic-admin')",[invoice,fingerprint,crypto.randomUUID()]);
    await db.query('insert into auth.users values($1)',[cmd]);
    await db.query("insert into public.xero_payment_approvers(user_id,granted_by) values($1,'Synthetic payment test')",[cmd]);
    if(source==='INVOICE_PAYMENT') {
      await db.query('insert into private.xero_invoice_transfer_control(singleton,tenant_id) values(true,$1)',[cmd]);
      await db.query('insert into private.xero_invoice_transfers(id,invoice_id,project_id,tenant_id,provider_invoice_id) values($1,$2,$3,$1,$4)',[cmd,invoice,otherProject,provider]);
      await db.query('insert into private.xero_invoice_requests(transfer_id,body) values($1,$2)',[cmd,JSON.stringify({Invoices:[{Contact:{ContactID:cmd}}]})]);
    }
    const approve=async(amount:number)=>{
      const context=(await db.query<any>('select public.xero_deposit_review_context($1) value',[invoice])).rows[0].value;
      const args=[crypto.randomUUID(),cmd,cmd,crypto.randomUUID(),cmd,otherProject,invoice,amount,'2026-10-22',context.invoiceFingerprint,context.ledgerFingerprint,'a'.repeat(64),'Synthetic receipt'];
      const call=source==='INVOICE_PAYMENT'?'select public.xero_approve_invoice_payment($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) result':'select public.xero_approve_deposit_match($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) result';
      return (await db.query<any>(call,source==='INVOICE_PAYMENT'?[...args,provider]:args)).rows[0].result;
    };
    const first=await approve(2000); await approve(3000);
    expect((await db.query<any>('select status from public.deposit_invoices where id=$1',[invoice])).rows[0].status).toBe('PAID');
    await db.query('select public.commercial_reverse_payment_entry_with_project_lock($1,$2,$3)',[first.paymentEntryId,'Correct provider receipt',cmd]);
    expect((await db.query<any>('select status from public.deposit_invoices where id=$1',[invoice])).rows[0].status).toBe('OPEN');
    const corrected=await approve(2000);
    // Reconciliation recognises provider-owned allocations to this frozen source.
    await reconcile(invoice,'NATIVE',null,5000,1);
    await reconcile(invoice,'SEPARATE_CHARGE',null,5000,2);
    expect((await db.query<any>('select status from public.deposit_invoices where id=$1',[invoice])).rows[0].status).toBe('PAID');
    expect((await db.query<any>('select coalesce(sum(amount_inc_gst_cents),0)::int value from public.project_payment_allocations where quote_version_id=$1 and reversed_at is null',[separateVersion])).rows[0].value).toBe(5000);
    // An otherwise valid same-project future scope cannot consume that receipt.
    await db.query("insert into public.quote_versions(id,quote_id,version_number,status,total_inc_gst_cents,total_ex_gst_cents,gst_cents,payment_terms) values($1,$2,2,'SENT',10000,8696,1304,$3)",[draft,otherQuote,term(10000)]);
    await reject(()=>db.query('select public.commercial_replace_payment_allocations_with_project_lock($1,$2,$3,$4)',[corrected.paymentEntryId,JSON.stringify([{quote_version_id:draft,payment_term_id:'payment-1',amount_inc_gst_cents:2000}]),'Cannot move assessment receipt',cmd]),/reserved for its invoice|Separate charge receipts/);
    expect((await db.query<any>('select * from public.commercial_quote_scope_funding($1)',[draft])).rows[0].paid_inc_gst_cents).toBe(0);
  });
  it('denies public/staff direct assignment writes and operator command execution', async () => {
    expect((await db.query<any>("select has_table_privilege('service_role','public.commercial_invoice_scope_assignments','UPDATE') value")).rows[0].value).toBe(false);
    expect((await db.query<any>("select has_function_privilege('authenticated','public.commercial_reconcile_invoice_scope(uuid,text,uuid,integer,text,integer,text,uuid,text,text)','EXECUTE') value")).rows[0].value).toBe(false);
    expect((await db.query<any>("select has_function_privilege('anon','public.commercial_accept_quote_with_project_lock_v2(uuid,text)','EXECUTE') value")).rows[0].value).toBe(false);
  });
});
