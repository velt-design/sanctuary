import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { prepareXeroPaymentDatabase } from './xero-payment-db-fixture.mjs';
const db = new PGlite();
const read = name => readFileSync(new URL('../supabase/'+name, import.meta.url),'utf8').replace(/\r/g,'');
const id=n=>`33333333-3333-4333-8333-${String(n).padStart(12,'0')}`;
async function sql(q) {
  const results=await db.exec(q); const row=results.at(-1)?.rows?.[0];
  if(!row) return '';
  const value=Object.values(row)[0]; return typeof value==='object'?JSON.stringify(value):String(value);
}
async function fixture() {
  await sql(`truncate private.xero_invoice_transfer_control,private.xero_invoice_transfers,private.xero_invoice_requests,
    public.xero_deposit_matches,public.xero_payment_approvers,auth.users,public.projects,public.quotes,public.quote_versions,
    public.deposit_invoices,public.project_payment_entries,public.project_payment_allocations,public.project_invoice_plan_items,public.audit_events cascade;
    insert into auth.users(id) values('${id(99)}');
    insert into public.xero_payment_approvers(user_id,granted_by) values('${id(99)}','Disposable test');
    insert into public.projects(id,name) values('${id(1)}','Synthetic concurrency');
    insert into public.quotes(id,project_id,quote_ref) values('${id(1)}','${id(1)}','QA');
    insert into public.quote_versions(id,quote_id,version_number,status,accepted_at,total_inc_gst_cents,total_ex_gst_cents,gst_cents,payment_terms)
      values('${id(1)}','${id(1)}',1,'ACCEPTED',now(),20000,17391,2609,'[{"id":"deposit","resolvedAmountIncGstCents":10000}]');
    insert into public.deposit_invoices(id,project_id,quote_id,quote_version_id,quote_ref,quote_version_number,invoice_ref,status,
      quote_total_inc_gst_cents,total_inc_gst_cents,total_ex_gst_cents,gst_cents,payment_term_id,payment_term_label)
      values('${id(1)}','${id(1)}','${id(1)}','${id(1)}','QA',1,'QA','OPEN',20000,10000,8696,1304,'deposit','Deposit');
    insert into private.xero_invoice_transfer_control(singleton,tenant_id) values(true,'${id(98)}');
    insert into private.xero_invoice_transfers values('${id(80)}','${id(1)}','${id(1)}','${id(98)}','${id(81)}');
    insert into private.xero_invoice_requests values('${id(80)}','{"Invoices":[{"Contact":{"ContactID":"${id(97)}"}}]}');`);
  return JSON.parse(await sql(`select public.xero_deposit_review_context('${id(1)}');`));
}
function invocation(context, receipt=20, amount=4000) {
  return `public.xero_record_invoice_payment('${id(receipt)}','${id(98)}','${id(receipt)}','${id(97)}',
    '${id(1)}','${id(1)}',${amount},current_date,'${context.invoiceFingerprint}','${context.ledgerFingerprint}',repeat('a',64),'Synthetic automatic','${id(81)}')`;
}
async function denied(statement, message) {
  try { await sql(statement); } catch(error) { if(error.message.includes(message)) return; throw error; }
  throw new Error('Expected rejection: '+message);
}
try {
  await prepareXeroPaymentDatabase(q=>sql(q),read);
  await sql(read('migrations/20260915000006_xero_automatic_payments.sql'));
  let context=await fixture();
  await denied('select '+invocation(context),'disabled');
  await sql('update private.xero_invoice_transfer_control set auto_record_payments_enabled=true');
  const first=JSON.parse(await sql('select '+invocation(context)));
  const replay=JSON.parse(await sql('select '+invocation(context)));
  if(!replay.replayed || replay.paymentEntryId!==first.paymentEntryId) throw new Error('Lost response replay duplicated receipt');
  await sql(`do $$ begin
    if (select approved_by is not null or recording_method<>'AUTOMATIC' from public.xero_deposit_matches limit 1)
      or (select created_by from public.project_payment_entries limit 1)<>'xero-automatic'
      or (select count(*) from public.audit_events where type='payment.xero_match_recorded')<>1
      or (select status from public.deposit_invoices limit 1)<>'OPEN'
    then raise exception 'Incorrect partial payment or machine attribution'; end if;
  end $$;`);
  await denied('select '+invocation(context,21,6000),'Payment evidence changed');
  context=JSON.parse(await sql(`select public.xero_automatic_payment_context('${id(1)}','${id(98)}')`));
  if(context.matchedCents!==4000 || !context.customerWon) throw new Error('Partial payment must win customer');
  await sql('select '+invocation(context,21,6000));
  await sql(`do $$ begin
    if (select status from public.deposit_invoices limit 1)<>'PAID'
      or (select sum(amount_inc_gst_cents) from public.project_payment_entries)<>10000
      or (select sum(amount_inc_gst_cents) from public.project_payment_allocations)<>10000
      or (select count(*) from public.xero_deposit_matches)<>2 then raise exception 'Full settlement is incorrect';end if;
    if has_function_privilege('authenticated','public.xero_record_invoice_payment(uuid,uuid,uuid,uuid,uuid,uuid,integer,date,text,text,text,text,uuid)','EXECUTE')
      or has_function_privilege('service_role','private.xero_commit_payment_match(uuid,uuid,uuid,uuid,uuid,uuid,uuid,integer,date,text,text,text,text,text,uuid,boolean)','EXECUTE')
      then raise exception 'Automatic internal boundary exposed'; end if;
  end $$;`);
  const history=JSON.parse(await sql(`select public.xero_invoice_payment_history('${id(99)}','${id(1)}','${id(98)}')`));
  if(history.matches.some(m=>m.approvedBy!=='Automatic Xero sync')) throw new Error('History impersonates a staff approver');
  context=await fixture();
  await sql('update private.xero_invoice_transfer_control set auto_record_payments_enabled=true');
  await sql(`select public.xero_record_deposit_review_note('${id(30)}','${id(99)}','${id(98)}','${id(20)}','${id(1)}','INVESTIGATE','Synthetic ambiguity')`);
  await denied('select '+invocation(context),'finance decision');
  await denied(`select public.xero_approve_invoice_payment('${id(21)}',null,'${id(98)}','${id(21)}','${id(97)}','${id(1)}','${id(1)}',4000,current_date,'${context.invoiceFingerprint}','${context.ledgerFingerprint}',repeat('a',64),'Synthetic','${id(81)}')`, 'permission is required');
  context=await fixture();
  await sql(`select public.xero_approve_invoice_payment('${id(21)}','${id(99)}','${id(98)}','${id(21)}','${id(97)}','${id(1)}','${id(1)}',4000,current_date,'${context.invoiceFingerprint}','${context.ledgerFingerprint}',repeat('a',64),'Synthetic manual','${id(81)}')`);
  await sql(`do $$ begin if (select recording_method<>'MANUAL' or approved_by is null from public.xero_deposit_matches limit 1) then raise exception 'Manual attribution changed';end if;end $$;`);
  console.log('Automatic payment SQL passed: disabled gate, partial/full, customer won, replay, stale balance, machine audit and permissions');
} finally { await db.close(); }
