// @vitest-environment node
import {afterEach,beforeEach,describe,expect,it} from 'vitest';
import type {PGlite} from '@electric-sql/pglite';
import {createRevisedQuoteDatabase} from './support/revisedQuoteDatabase';
import {paymentConversionMigration,paymentSql,preparePaymentConversionAnalytics} from './fixtures/verified-payment-conversion-db';
const project='10000000-0000-4000-8000-000000000011',quote='20000000-0000-4000-8000-000000000011';
const feeVersion='30000000-0000-4000-8000-000000000011',version='30000000-0000-4000-8000-000000000012',fee='40000000-0000-4000-8000-000000000011';
let db:PGlite;
const events=async()=>(await db.query<any>("select created_at,payload from audit_events where type='marketing.deposit_received' order by idempotency_key")).rows;
const paid=(invoice:string,age="interval '2 hours'")=>db.query(`select * from commercial_mark_invoice_paid_with_project_lock($1,$2,now()-(${age}),null,null,null)`,[invoice,'synthetic-admin']);
async function reconcile(invoice:string,treatment:string,target:string|null,total:number,revision=0,status='PAID') {
 const hash=(await db.query<any>('select commercial_invoice_scope_fingerprint($1) hash',[invoice])).rows[0].hash;
 return db.query('select commercial_reconcile_invoice_scope($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[invoice,treatment,target,total,status,revision,hash,crypto.randomUUID(),'Synthetic ownership reconciliation','synthetic-admin']);
}
const accept=async()=>(await db.query<any>('select * from commercial_accept_quote_with_project_lock_v2($1,$2)',[version,'synthetic-admin'])).rows[0];
async function standalone(amount=20000) {
 const invoice=crypto.randomUUID();
 const content={version:1,billingName:'Synthetic customer',billingEmail:'synthetic@example.invalid',billingAddress:'',notes:'',items:[{id:crypto.randomUUID(),description:'Synthetic deposit',qty:1,unitPriceIncGstCents:amount,lineTotalIncGstCents:amount}]};
 await db.query('select commercial_invoice_save_draft($1,$2,0,null,$3,$4)',[invoice,project,JSON.stringify(content),JSON.stringify({mode:'custom',label:'Standalone deposit',amountIncGstCents:amount,dueDate:'2026-11-10'})]);
 await db.query('select commercial_invoice_issue_draft($1,1,$2,$3)',[invoice,crypto.randomUUID(),'Synthetic payment details']);
 return invoice;
}
async function addFamily(amount:number) {
 const family=crypto.randomUUID(),v=crypto.randomUUID();
 await db.query('insert into quotes(id,project_id,quote_ref,commercial_scope_id) values($1,$2,$3,$1)',[family,project,`SYNTHETIC-${family}`]);
 await db.query(`insert into quote_versions(id,quote_id,version_number,status,accepted_at,total_inc_gst_cents,total_ex_gst_cents,gst_cents,payment_terms)
  values($1,$2,1,'ACCEPTED',now(),$3,$3,0,$4)`,[v,family,amount,JSON.stringify([{id:'payment-1',resolvedAmountIncGstCents:amount}])]);
 return {family,version:v};
}
const funding=async(v=version)=>(await db.query<any>('select * from commercial_quote_scope_funding($1)',[v])).rows[0].paid_inc_gst_cents;
async function approveXero(invoice:string,amount:number) {
 const actor=crypto.randomUUID();await db.query('insert into auth.users(id) values($1)',[actor]);
 await db.query("insert into xero_payment_approvers(user_id,granted_by) values($1,'Synthetic operator')",[actor]);
 const context=(await db.query<any>('select xero_deposit_review_context($1) v',[invoice])).rows[0].v;
 const tenant=crypto.randomUUID(),contact=crypto.randomUUID();
 const args=[crypto.randomUUID(),actor,tenant,crypto.randomUUID(),contact,project,invoice,amount,new Date().toISOString().slice(0,10),context.invoiceFingerprint,context.ledgerFingerprint,'a'.repeat(64),'Synthetic verified receipt'];
 if((await db.query<any>('select invoice_kind from deposit_invoices where id=$1',[invoice])).rows[0].invoice_kind==='STANDALONE') {
  const transfer=crypto.randomUUID(),provider=crypto.randomUUID();
  await db.query('insert into private.xero_invoice_transfer_control values(true,$1)',[tenant]);
  await db.query('insert into private.xero_invoice_transfers(id,invoice_id,project_id,tenant_id,provider_invoice_id) values($1,$2,$3,$4,$5)',[transfer,invoice,project,tenant,provider]);
  await db.query('insert into private.xero_invoice_requests values($1,$2)',[transfer,JSON.stringify({Invoices:[{Contact:{ContactID:contact}}]})]);
  return db.query('select xero_approve_invoice_payment($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',[...args,provider]);
 }
 return db.query('select xero_approve_deposit_match($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',args);
}
describe('payment conversions follow the current revised-quote funding owner',()=>{
 beforeEach(async()=>{
  db=await createRevisedQuoteDatabase();await preparePaymentConversionAnalytics(db);await db.exec(paymentSql(paymentConversionMigration));
  await db.query("insert into projects(id,name) values($1,'Synthetic revised funding')",[project]);
  await db.query("insert into quotes(id,project_id,quote_ref) values($1,$2,'SYNTHETIC-FUNDING')",[quote,project]);
  await db.query(`insert into enquiry_requests(id,project_id,created_at,raw_payload) values($1,$2,now()-interval '1 day','{"attribution":{"analyticsClientId":"123.456","consent":{"analytics":true,"marketing":true}}}')`,[crypto.randomUUID(),project]);
  await db.query(`insert into quote_versions(id,quote_id,version_number,status,accepted_at,total_inc_gst_cents,total_ex_gst_cents,gst_cents,payment_terms)
    values($1,$3,1,'SUPERSEDED',now(),5000,4348,652,'[{"id":"payment-1","resolvedAmountIncGstCents":5000}]'),
    ($2,$3,2,'SENT',null,160000,139130,20870,'[{"id":"payment-1","resolvedAmountIncGstCents":160000}]')`,[feeVersion,version,quote]);
  await db.query(`insert into deposit_invoices(id,project_id,quote_id,quote_version_id,quote_ref,quote_version_number,invoice_ref,status,quote_total_inc_gst_cents,total_inc_gst_cents,total_ex_gst_cents,gst_cents,payment_term_id,payment_term_label)
    values($1,$2,$3,$4,'SYNTHETIC-FUNDING',1,'SYNTHETIC-ASSESSMENT','OPEN',5000,5000,4348,652,'payment-1','Assessment')`,[fee,project,quote,feeVersion]);
 },30000);
 afterEach(async()=>db?.close());
 it('does not turn a separate historical assessment into a construction sale; uses the later real construction deposit',async()=>{
  await paid(fee);await reconcile(fee,'SEPARATE_CHARGE',null,5000);
  const accepted=await accept();
  expect((await db.query<any>('select * from commercial_quote_scope_funding($1)',[version])).rows[0].paid_inc_gst_cents).toBe(0);
  expect(await events()).toEqual([]);
  await paid(accepted.invoice_id,"interval '1 hour'");
  expect(await events()).toHaveLength(1);
  expect((await events())[0].payload).toMatchObject({quoteId:quote,depositInvoiceId:accepted.invoice_id,valueIncGstCents:160000});
  const actual=(await db.query<any>('select occurred_at from project_payment_entries where source_invoice_id=$1 and entry_type=\'PAYMENT\'',[accepted.invoice_id])).rows[0];
  expect(new Date((await events())[0].created_at).getTime()).toBe(new Date(actual.occurred_at).getTime());
 });
 it('captures paid standalone credit only when QUOTE_PAYMENT assigns it to the accepted family',async()=>{
  await db.query('select commercial_void_open_invoice($1,$2,$3)',[fee,'synthetic-admin','Use explicit construction billing']);
  const accepted=await accept();await db.query('select commercial_void_open_invoice($1,$2,$3)',[accepted.invoice_id,'synthetic-admin','Use standalone deposit billing']);
  const invoice=await standalone();await paid(invoice);expect(await events()).toEqual([]);expect(await funding()).toBe(0);
  await reconcile(invoice,'QUOTE_PAYMENT',quote,20000);
  expect(await funding()).toBe(20000);expect(await events()).toHaveLength(1);
  expect((await events())[0].payload).toMatchObject({quoteId:quote,depositInvoiceId:invoice,valueIncGstCents:160000});
  const actual=(await db.query<any>("select occurred_at from project_payment_entries where source_invoice_id=$1 and entry_type='PAYMENT'",[invoice])).rows[0];
  expect(new Date((await events())[0].created_at).getTime()).toBe(new Date(actual.occurred_at).getTime());
  const original=await events();await reconcile(invoice,'QUOTE_PAYMENT',quote,20000,1);expect(await events()).toEqual(original);
 });
 it.each(['manual','xero'])('routes a subsequent %s payment through an already assigned QUOTE_PAYMENT family',async source=>{
  await db.query('select commercial_void_open_invoice($1,$2,$3)',[fee,'synthetic-admin','Use explicit construction billing']);
  const accepted=await accept();await db.query('select commercial_void_open_invoice($1,$2,$3)',[accepted.invoice_id,'synthetic-admin','Use standalone deposit billing']);
  const invoice=await standalone();await reconcile(invoice,'QUOTE_PAYMENT',quote,20000,0,'OPEN');expect(await events()).toEqual([]);
  if(source==='manual')await paid(invoice);else await approveXero(invoice,1000);
  expect(await funding()).toBe(source==='manual'?20000:1000);expect(await events()).toHaveLength(1);
  expect((await events())[0].payload).toMatchObject({quoteId:quote,depositInvoiceId:invoice,valueIncGstCents:160000});
 });
 it('recognises an explicit NATIVE restoration as qualification without rewriting later historical evidence',async()=>{
  await paid(fee);await reconcile(fee,'SEPARATE_CHARGE',null,5000);await accept();expect(await events()).toEqual([]);
  await reconcile(fee,'NATIVE',null,5000,1);expect(await funding()).toBe(5000);expect(await events()).toHaveLength(1);
  expect((await events())[0].payload).toMatchObject({quoteId:quote,depositInvoiceId:fee,valueIncGstCents:160000});
  const original=await events();await reconcile(fee,'SEPARATE_CHARGE',null,5000,2);expect(await funding()).toBe(0);expect(await events()).toEqual(original);
 });
 it.each([1000,5000])('excludes a separate assessment from %i cents of approved Xero matching',async amount=>{
  await reconcile(fee,'SEPARATE_CHARGE',null,5000,0,'OPEN');const accepted=await accept();
  const historical=(await db.query<any>('select status,voided_at::text voided_at from deposit_invoices where id=$1',[fee])).rows[0];
  if(historical.status==='VOID')await db.query('select commercial_restore_invoice($1,$2,$3,$4,$5)',[fee,historical.voided_at,crypto.randomUUID(),'Restore the separate assessment','synthetic-admin']);
  await approveXero(fee,amount);
  expect(await funding()).toBe(0);expect(await events()).toEqual([]);
  await paid(accepted.invoice_id,"interval '1 hour'");expect(await events()).toHaveLength(1);
  expect((await events())[0].payload.depositInvoiceId).toBe(accepted.invoice_id);
 });
 it('attributes a fully split receipt to its actual funded families, leaving the immutable invoice family unfunded',async()=>{
  await paid(fee);await reconcile(fee,'SEPARATE_CHARGE',null,5000);const accepted=await accept();
  const first=await addFamily(80000),second=await addFamily(80000);
  await db.exec('begin');
  try {
   await paid(accepted.invoice_id,"interval '1 hour'");
   const entry=(await db.query<any>("select id from project_payment_entries where source_invoice_id=$1 and entry_type='PAYMENT'",[accepted.invoice_id])).rows[0].id;
   await db.query('select commercial_replace_payment_allocations_with_project_lock($1,$2,$3,$4)',[entry,JSON.stringify([
    {quote_version_id:first.version,payment_term_id:'payment-1',amount_inc_gst_cents:80000},
    {quote_version_id:second.version,payment_term_id:'payment-1',amount_inc_gst_cents:80000}]),'Synthetic complete split','synthetic-admin']);
   await db.exec('commit');
  }catch(error){await db.exec('rollback');throw error;}
  expect(await funding()).toBe(0);expect(await funding(first.version)).toBe(80000);expect(await funding(second.version)).toBe(80000);
  expect((await events()).map(e=>e.payload.quoteId).sort()).toEqual([first.family,second.family].sort());
 });
 it('retains only genuine source residual while also recognising an explicit first-term allocation elsewhere',async()=>{
  await paid(fee);await reconcile(fee,'SEPARATE_CHARGE',null,5000);const accepted=await accept();const target=await addFamily(80000);
  await db.exec('begin');
  try {
   await paid(accepted.invoice_id,"interval '1 hour'");
   const entry=(await db.query<any>("select id from project_payment_entries where source_invoice_id=$1 and entry_type='PAYMENT'",[accepted.invoice_id])).rows[0].id;
   await db.query('select commercial_replace_payment_allocations_with_project_lock($1,$2,$3,$4)',[entry,JSON.stringify([
    {quote_version_id:target.version,payment_term_id:'payment-1',amount_inc_gst_cents:80000}]),'Synthetic partial split','synthetic-admin']);
   await db.exec('commit');
  }catch(error){await db.exec('rollback');throw error;}
  expect(await funding()).toBe(80000);expect(await funding(target.version)).toBe(80000);
  expect((await events()).map(e=>e.payload.quoteId).sort()).toEqual([quote,target.family].sort());
 });
});
