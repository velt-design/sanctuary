import type { PGlite } from '@electric-sql/pglite';
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
const term = (amount: number, percent = 100) => JSON.stringify([{ id: 'payment-1', label: 'Payment', calculationType: 'percentage', percentageOfRemainder: percent, resolvedAmountIncGstCents: amount }, ...(percent === 50 ? [{ id: 'payment-2', label: 'Final', calculationType: 'percentage', percentageOfRemainder: 50, resolvedAmountIncGstCents: amount }] : [])]);
const content = (amount: number) => ({ version: 1, billingName: 'Synthetic customer', billingEmail: 'customer@example.invalid', billingAddress: '', notes: '', items: [{ id: '60000000-0000-4000-8000-000000000001', description: 'Synthetic outdoor work', qty: 1, unitPriceIncGstCents: amount, lineTotalIncGstCents: amount }] });
export const revisedQuoteIds = { project, quote, feeVersion, oldVersion, version, fee, topup, draft, cmd };
export async function seedRevisedQuoteScenario(db: PGlite) {
    await db.query('insert into public.projects(id,name) values($1,\'Synthetic revised project\'),($2,\'Other synthetic project\')', [project, otherProject]);
    await db.query('insert into public.quotes(id,project_id,quote_ref) values($1,$2,\'Q-SYNTHETIC\'),($3,$4,\'Q-OTHER\')', [quote, project, otherQuote, otherProject]);
    await db.query(`insert into public.quote_versions(id,quote_id,version_number,status,customer_name,total_inc_gst_cents,total_ex_gst_cents,gst_cents,accepted_at,payment_terms)
      values($1,$4,1,'SUPERSEDED','Synthetic customer',5000,4348,652,now(),$5),($2,$4,2,'SENT','Synthetic customer',100000,86957,13043,null,$6),($3,$4,3,'SENT','Synthetic customer',160000,139130,20870,null,$7)`, [feeVersion, oldVersion, version, quote, term(5000), term(50000, 50), term(160000)]);
    await db.query(`insert into public.deposit_invoices(id,project_id,quote_id,quote_version_id,quote_ref,quote_version_number,invoice_ref,status,quote_total_inc_gst_cents,total_inc_gst_cents,total_ex_gst_cents,gst_cents,payment_term_id,payment_term_label)
      values($1,$2,$3,$4,'Q-SYNTHETIC',1,'INV-FEE','OPEN',5000,5000,4348,652,'payment-1','Assessment')`, [fee, project, quote, feeVersion]);
    await db.query('select * from public.commercial_mark_invoice_paid_with_project_lock($1,$2,null,null,null,null)', [fee, 'synthetic-admin']);
    const fingerprint = (await db.query<any>('select public.commercial_invoice_scope_fingerprint($1) value', [fee])).rows[0].value;
    await db.query('select public.commercial_reconcile_invoice_scope($1,\'SEPARATE_CHARGE\',null,5000,\'PAID\',0,$2,$3,$4,$5)', [fee, fingerprint, crypto.randomUUID(), 'Assessment is separate work', 'synthetic-operator']);
    const original = (await db.query<any>('select * from public.commercial_accept_quote_with_project_lock($1,$2)', [oldVersion, 'synthetic-admin'])).rows[0];
    const oldInvoice = original.invoice_id;
    await db.query('select * from public.commercial_mark_invoice_paid_with_project_lock($1,$2,null,null,null,null)', [oldInvoice, 'synthetic-admin']);
    await db.query('select public.commercial_invoice_save_draft($1,$2,0,null,$3,$4)', [topup, project, JSON.stringify(content(20000)), JSON.stringify({ mode: 'custom', label: 'Deposit top-up', amountIncGstCents: 20000, dueDate: '2026-10-30' })]);
    await db.query('select public.commercial_invoice_issue_draft($1,1,$2,$3)', [topup, cmd, 'Synthetic payment details']);
    await db.query('select * from public.commercial_mark_invoice_paid_with_project_lock($1,$2,null,null,null,null)', [topup, 'synthetic-admin']);
    await db.query('select * from public.commercial_mark_quote_superseded($1,$2)', [oldVersion, 'synthetic-admin']);
    await db.query('insert into public.quote_line_items values($1,$2,0,$3,1,160000,160000)', [content(160000).items[0].id, version, 'Synthetic outdoor work']);
  return oldInvoice;
}
