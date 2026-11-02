// @vitest-environment node
import {PGlite} from '@electric-sql/pglite';
import {beforeAll,afterAll,beforeEach,afterEach,expect,it} from 'vitest';
import {prepareAdvertisingFunding,advertisingFundingMigration,advertisingActor as actor,advertisingBinding as binding} from './fixtures/advertising-funding-db';
import {paymentSql,seedPaymentProject,paymentId as id} from './fixtures/verified-payment-conversion-db';
import {prepareSale,saleSourceSchema} from '../apps/portal/lib/marketingIntegrations/googleAds/sales';
import {runGoogleConnection} from '../apps/portal/lib/marketingIntegrations/googleAds/worker';
import {ADS_SCOPE,DATA_SCOPE} from '../apps/portal/lib/marketingIntegrations/googleAds/config';
import {metaSaleSourceSchema} from '../apps/portal/lib/marketingIntegrations/metaSales/sales';
const policy={enhancedMatchingApproved:false,allowedConsentBases:['user_choice'],consentEffectiveFrom:'2026-01-01T00:00:00Z',disclosureVersion:'2026-10-sale-measurement-v2'};
let db:PGlite;
const source=async(family=1)=>saleSourceSchema.parse((await db.query<any>('select source from private.google_ads_sources() where quote_id=$1',[id(family)])).rows[0].source);
const meta=async(family=1)=>metaSaleSourceSchema.parse((await db.query<any>('select source from private.meta_sale_sources() where quote_id=$1',[id(family)])).rows[0].source);
const paid=(family=1)=>db.query('select * from commercial_mark_invoice_paid_with_project_lock($1,$2,now()-interval \'2 hours\',null,null,null)',[id(3000+family),'synthetic-admin']);
const command=async(action:string,input:unknown={},run:string|null=null)=>(await db.query<any>('select google_ads_command($1,$2,$3,$4,$5) v',[actor,binding,action,run,JSON.stringify(input)])).rows[0].v;
const sale=async(family=1)=>(await db.query<any>('select * from private.google_ads_sales where quote_id=$1',[id(family)])).rows[0];
async function enable(canary:number|null=null) {await db.query(`update private.google_ads_control set actor_id=$1,binding_sha256=$2,conversion_customer_id='6328516633',action_id='123',uploads_enabled=true,consent_policy_approved=true,disclosure_version=$3,allowed_consent_bases=array['user_choice'],consent_effective_from='2026-01-01',upload_mode=$4,canary_quote_id=$5`,[actor,binding,policy.disclosureVersion,canary?'canary':'routine',canary?id(canary):null]);}
async function freeze(run:string,family=1){const s=await source(family),prepared=prepareSale(s,policy);await command('freeze',{quoteId:s.quoteId,fingerprint:s.fingerprint,...prepared},run);return s;}
async function denied(action:()=>Promise<unknown>,message:string){await db.exec('savepoint expected');await expect(action()).rejects.toThrow(message);await db.exec('rollback to savepoint expected;release savepoint expected');}
async function reconcile(invoice:string,treatment:string,target:string|null,total:number,revision=0,status='PAID') {
 const hash=(await db.query<any>('select commercial_invoice_scope_fingerprint($1) hash',[invoice])).rows[0].hash;
 return db.query('select commercial_reconcile_invoice_scope($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[invoice,treatment,target,total,status,revision,hash,crypto.randomUUID(),'Synthetic reconciliation','synthetic-admin']);
}
async function standalone(){const invoice=crypto.randomUUID();const content={version:1,billingName:'Synthetic customer',billingEmail:'synthetic@example.invalid',billingAddress:'',notes:'',items:[{id:crypto.randomUUID(),description:'Synthetic deposit',qty:1,unitPriceIncGstCents:1000,lineTotalIncGstCents:1000}]};
 await db.query('select commercial_invoice_save_draft($1,$2,0,null,$3,$4)',[invoice,id(1),JSON.stringify(content),JSON.stringify({mode:'custom',label:'Deposit',amountIncGstCents:1000,dueDate:'2026-11-10'})]);
 await db.query('select commercial_invoice_issue_draft($1,1,$2,$3)',[invoice,crypto.randomUUID(),'Synthetic payment details']);return invoice;}
async function allocation(entry:string,targets:Array<[number,number]>){await db.query('select commercial_replace_payment_allocations_with_project_lock($1,$2,$3,$4)',[entry,JSON.stringify(targets.map(([family,amount])=>({quote_version_id:id(2000+family),payment_term_id:'deposit',amount_inc_gst_cents:amount}))),'Synthetic allocation','synthetic-admin']);}
async function xero(invoice:string,amount=1000){const reviewer=crypto.randomUUID();await db.query('insert into auth.users(id) values($1)',[reviewer]);await db.query("insert into xero_payment_approvers(user_id,granted_by) values($1,'Synthetic operator')",[reviewer]);
 const context=(await db.query<any>('select xero_deposit_review_context($1) v',[invoice])).rows[0].v;
 const tenant=crypto.randomUUID(),contact=crypto.randomUUID();const args=[crypto.randomUUID(),reviewer,tenant,crypto.randomUUID(),contact,id(1),invoice,amount,new Date().toISOString().slice(0,10),context.invoiceFingerprint,context.ledgerFingerprint,'a'.repeat(64),'Synthetic verified receipt'];
 if((await db.query<any>('select invoice_kind from deposit_invoices where id=$1',[invoice])).rows[0].invoice_kind==='STANDALONE'){const transfer=crypto.randomUUID(),provider=crypto.randomUUID();await db.query('insert into private.xero_invoice_transfer_control values(true,$1)',[tenant]);await db.query('insert into private.xero_invoice_transfers(id,invoice_id,project_id,tenant_id,provider_invoice_id) values($1,$2,$3,$4,$5)',[transfer,invoice,id(1),tenant,provider]);await db.query('insert into private.xero_invoice_requests values($1,$2)',[transfer,JSON.stringify({Invoices:[{Contact:{ContactID:contact}}]})]);return db.query('select xero_approve_invoice_payment($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',[...args,provider]);}
 return db.query('select xero_approve_deposit_match($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',args);}
async function historical(){await db.query("update quote_versions set status='SUPERSEDED' where id=$1",[id(2001)]);await db.query(`insert into quote_versions(id,quote_id,version_number,status,accepted_at,total_inc_gst_cents,total_ex_gst_cents,gst_cents,payment_terms)
 values($1,$2,2,'ACCEPTED',now(),30001,26088,3913,'[{"id":"deposit","resolvedAmountIncGstCents":15001},{"id":"final","resolvedAmountIncGstCents":15000}]')`,[id(12001),id(1)]);}
beforeAll(async()=>{db=new PGlite();await prepareAdvertisingFunding(db);},30000);
afterAll(async()=>db.close());beforeEach(async()=>{await db.exec('begin');await seedPaymentProject(db);await db.query(`update enquiry_requests set raw_payload=$1`,[JSON.stringify({email:'synthetic@example.invalid',advertisingDisclosureVersion:policy.disclosureVersion,attribution:{consent:{analytics:true,marketing:true,basis:'user_choice'},clickIds:{gclid:'synthetic-click'}}})]);});afterEach(async()=>db.exec('rollback'));
it('reproduces and repairs separate-charge false funding with actual revised ownership',async()=>{
 await paid();await historical();await reconcile(id(3001),'SEPARATE_CHARGE',null,10001);
 const current=await source();expect(current.active).toBe(false);expect(current.occurredAt).toBeNull();expect((await meta()).active).toBe(false);
 await db.exec(paymentSql('migrations/20261014000001_advertising_scope_source.sql').split('create or replace function private.google_ads_sources()')[0].replace('create function private.advertising_scope_facts','create or replace function private.advertising_scope_facts').replace("r.id<>'f3229ccf-6a1a-4e1a-bcf4-2edf5cc85e70'::uuid",'not private.marketing_test_enquiry(r.id,r.project_id)').replace("q.project_id<>'10c5db1a-602c-4f0c-8193-855b186215bb'::uuid",'not private.marketing_test_project(q.project_id)'));
 expect((await source()).active).toBe(true);await db.exec(paymentSql(advertisingFundingMigration));expect(await source()).toEqual(current);
 await db.query(`insert into deposit_invoices(id,project_id,quote_id,quote_version_id,quote_ref,quote_version_number,invoice_ref,status,quote_total_inc_gst_cents,total_inc_gst_cents,total_ex_gst_cents,gst_cents,payment_term_id,payment_term_label,payment_term_position)
 values($1,$2,$3,$4,'SYNTHETIC-CONSTRUCTION',2,'SYNTHETIC-CONSTRUCTION-INVOICE','OPEN',30001,15001,13044,1957,'deposit','Construction initial payment',1)`,[id(13001),id(1),id(1),id(12001)]);
 await db.query("select * from commercial_mark_invoice_paid_with_project_lock($1,'synthetic-admin',now()-interval '1 hour',null,null,null)",[id(13001)]);const construction=await source();expect(construction.active).toBe(true);expect(construction.valueCents).toBe(30001);
 const date=(await db.query<any>("select occurred_at::text date from project_payment_entries where source_invoice_id=$1 and entry_type='PAYMENT'",[id(13001)])).rows[0].date;expect(Date.parse(construction.occurredAt!)).toBe(Date.parse(date));
});
it('has no paid-label/date fallback and preserves dark controls with unchanged catalog authority',async()=>{
 await db.exec("update deposit_invoices set status='PAID',paid_at=now()-interval '1 hour'");expect((await source()).active).toBe(false);
 expect((await db.query<any>('select uploads_enabled,enhanced_matching_approved,consent_policy_approved from private.google_ads_control')).rows[0]).toEqual({uploads_enabled:false,enhanced_matching_approved:false,consent_policy_approved:false});
 expect((await db.query<any>('select uploads_enabled from private.meta_sale_control')).rows[0].uploads_enabled).toBe(false);
 const before=(await db.query<any>("select to_jsonb(p)-'prosrc' catalog from pg_proc p where oid='private.advertising_scope_facts()'::regprocedure")).rows[0];await db.exec(paymentSql(advertisingFundingMigration));expect((await db.query<any>("select to_jsonb(p)-'prosrc' catalog from pg_proc p where oid='private.advertising_scope_facts()'::regprocedure")).rows[0]).toEqual(before);
});
it('preserves valid native projection/fingerprint, truthful date, full value and stable transaction identity',async()=>{
 await paid();const s=await source();expect(s).toMatchObject({active:true,valueCents:20001,marketingConsent:true});expect((await meta()).occurredAt).toBe(s.occurredAt);
 const event=prepareSale(s,policy);expect(event).toMatchObject({event:{transactionId:`sanctuary-scope-${id(1)}`,conversionValue:200.01,eventTimestamp:s.occurredAt}});
 const metadata=(await db.query<any>("select pg_get_functiondef('private.advertising_scope_facts()'::regprocedure) definition")).rows[0].definition;
 await db.exec(paymentSql('migrations/20261014000001_advertising_scope_source.sql').split('create or replace function private.google_ads_sources()')[0].replace('create function private.advertising_scope_facts','create or replace function private.advertising_scope_facts'));expect(await source()).toEqual(s);await db.exec(metadata);
});
it('qualifies a paid standalone only after explicit QUOTE_PAYMENT assignment, with original receipt date',async()=>{
 const invoice=await standalone();await db.query("select * from commercial_mark_invoice_paid_with_project_lock($1,'synthetic-admin',now()-interval '1 hour',null,null,null)",[invoice]);expect((await source()).active).toBe(false);
 await reconcile(invoice,'QUOTE_PAYMENT',id(1),1000);const s=await source();expect(s.active).toBe(true);expect((await meta()).active).toBe(true);
 const date=(await db.query<any>("select occurred_at::text date from project_payment_entries where source_invoice_id=$1 and entry_type='PAYMENT'",[invoice])).rows[0].date;expect(Date.parse(s.occurredAt!)).toBe(Date.parse(date));
 await enable();const {runId}=await command('begin',{lane:'sales'});await freeze(runId);expect((await command('claim',{},runId)).event.eventTimestamp).toBe(s.occurredAt);await command('check',{quoteId:id(1)},runId);
});
it('recognises manual allocated partial first deposits; unallocated credit and final terms do not qualify',async()=>{
 await db.query("select commercial_void_open_invoice($1,'synthetic-admin','Use allocated manual deposit')",[id(3001)]);const entry=crypto.randomUUID();await db.query('select * from commercial_record_project_payment_entry($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[id(1),'PAYMENT',1000,new Date(Date.now()-3600000).toISOString(),'BANK_TRANSFER',null,'Synthetic partial','Synthetic partial','synthetic-admin',entry]);
 const payment=(await db.query<any>('select id from project_payment_entries where client_intent_id=$1',[entry])).rows[0].id;expect((await source()).active).toBe(false);
 await db.query('select commercial_replace_payment_allocations_with_project_lock($1,$2,$3,$4)',[payment,JSON.stringify([{quote_version_id:id(2001),payment_term_id:'final',amount_inc_gst_cents:1000}]),'Synthetic final allocation','synthetic-admin']);expect((await source()).active).toBe(false);
 await allocation(payment,[[1,1000]]);expect((await source()).active).toBe(true);expect((await db.query<any>('select status from deposit_invoices')).rows[0].status).toBe('VOID');
});
it('follows split allocations and only positive residual, then fences funding removed after Google claim',async()=>{
 await seedPaymentProject(db,1,2);await seedPaymentProject(db,1,3);await db.query("select commercial_void_open_invoice($1,'synthetic-admin','Use split receipt')",[id(3002)]);await db.query("select commercial_void_open_invoice($1,'synthetic-admin','Use split receipt')",[id(3003)]);await paid();const payment=(await db.query<any>("select id from project_payment_entries where source_invoice_id=$1 and entry_type='PAYMENT'",[id(3001)])).rows[0].id;
 await allocation(payment,[[2,1000]]);expect((await source()).active).toBe(true);expect((await source(2)).active).toBe(true);expect((await meta(2)).active).toBe(true);
 await enable();const {runId}=await command('begin',{lane:'sales'});await freeze(runId);await command('claim',{},runId);
 await allocation(payment,[[2,5000],[3,5001]]);expect((await source()).active).toBe(false);expect((await source(2)).active).toBe(true);expect((await source(3)).active).toBe(true);
 await denied(()=>command('check',{quoteId:id(1)},runId),'Sale changed before dispatch');
});
it.each([false,true])('uses approved Xero partial while OPEN and excludes separate assessment=%s',async separate=>{
 if(separate){await historical();await reconcile(id(3001),'SEPARATE_CHARGE',null,10001,0,'OPEN');}await xero(id(3001));const s=await source();expect(s.active).toBe(!separate);expect((await meta()).active).toBe(!separate);
 if(!separate){expect(s.valueCents).toBe(20001);expect(s.occurredAt).not.toBeNull();expect((await db.query<any>('select status from deposit_invoices')).rows[0].status).toBe('OPEN');}
});
it('reversal removes funding from both projections and prevents stale freeze or dispatch',async()=>{
 await paid();await enable();const {runId}=await command('begin',{lane:'sales'});const s=await freeze(runId);await command('claim',{},runId);
 const payment=(await db.query<any>("select id from project_payment_entries where entry_type='PAYMENT'")).rows[0].id;await db.query('select commercial_reverse_payment_entry($1,$2,$3)',[payment,'synthetic-admin','Synthetic reversal']);
 expect((await source()).active).toBe(false);expect((await meta()).active).toBe(false);await denied(()=>command('check',{quoteId:id(1)},runId),'Sale changed before dispatch');await denied(()=>command('freeze',{quoteId:s.quoteId,fingerprint:s.fingerprint,...prepareSale(s,policy)},runId),'Source changed');
});
it('canary scopes sources/freeze/claim and repeat scan retains one accepted event and its exact payload',async()=>{
 await seedPaymentProject(db,1,2);await paid();await paid(2);await enable(1);const {runId}=await command('begin',{lane:'sales'});expect((await command('sources',{},runId)).map((s:any)=>s.quoteId)).toEqual([id(1)]);
 await denied(()=>freeze(runId,2),'outside canary');const s=await freeze(runId);const claim=await command('claim',{},runId);expect(claim.event).toEqual((prepareSale(s,policy) as any).event);await command('check',{quoteId:id(1)},runId);
 await command('complete',{quoteId:id(1),state:'SUBMITTED',requestId:'synthetic-request'},runId);await db.exec('update private.google_ads_sales set next_attempt_at=now()');await command('claim',{},runId);await command('complete',{quoteId:id(1),state:'ACCEPTED'},runId);
 const original=await sale();await freeze(runId);expect(await command('claim',{},runId)).toBeNull();expect((await sale()).payload).toEqual(original.payload);expect((await sale()).attempts).toBe(1);expect((await db.query<any>('select count(*)::int n from private.meta_sales')).rows[0].n).toBe(0);
});

it('retains a genuine fully allocated frozen admin first term despite missing historical schedule metadata',async()=>{
 await db.query("select commercial_void_open_invoice($1,'synthetic-admin','Use historical administrative invoice')",[id(3001)]);
 await adminInvoice();await db.query("select * from commercial_mark_invoice_paid_with_project_lock($1,'synthetic-admin',now()-interval '3 hours',null,null,null)",[id(13001)]);
 const s=await source();expect(s.active).toBe(true);expect(s.valueCents).toBe(20001);await db.exec('set constraints all immediate');expect((await db.query<any>("select payload from audit_events where type='marketing.deposit_received'")).rows[0].payload).toMatchObject({depositInvoiceId:id(13001),valueIncGstCents:20001});
 const payment=(await db.query<any>("select id,occurred_at::text date from project_payment_entries where source_invoice_id=$1 and entry_type='PAYMENT'",[id(13001)])).rows[0];expect(Date.parse(s.occurredAt!)).toBe(Date.parse(payment.date));
 expect((await db.query<any>('select amount_inc_gst_cents from project_payment_allocations where payment_entry_id=$1 and reversed_at is null',[payment.id])).rows[0].amount_inc_gst_cents).toBe(10001);
 await seedPaymentProject(db,1,2);await db.query("select commercial_void_open_invoice($1,'synthetic-admin','Use split receipt')",[id(3002)]);await db.query(`update quote_versions set payment_terms='[{"id":"deposit","resolvedAmountIncGstCents":10000},{"id":"admin-synthetic","resolvedAmountIncGstCents":10001}]' where id=$1`,[id(2002)]);
 await db.query('select commercial_replace_payment_allocations_with_project_lock($1,$2,$3,$4)',[payment.id,JSON.stringify([{quote_version_id:id(2002),payment_term_id:'admin-synthetic',amount_inc_gst_cents:10001}]),'Synthetic wrong family','synthetic-admin']);
 expect((await source()).active).toBe(false);expect((await source(2)).active).toBe(false);
});
async function adminInvoice(){await db.query(`insert into deposit_invoices(id,project_id,quote_id,quote_version_id,quote_ref,quote_version_number,invoice_ref,status,quote_total_inc_gst_cents,total_inc_gst_cents,total_ex_gst_cents,gst_cents,payment_term_id,payment_term_label,payment_term_position)
 values($1,$2,$3,$4,'SYNTHETIC-ADMIN',1,'SYNTHETIC-ADMIN-INVOICE','OPEN',20001,10001,8697,1304,'admin-synthetic','Historical initial payment',1)`,[id(13001),id(1),id(1),id(2001)]);}

it('preserves original non-test receipt and policy gates, cancellation and confirmed test exclusion',async()=>{
 await paid();const first=await source();await db.query(`insert into enquiry_requests(id,project_id,created_at,raw_payload) values($1,$2,now()-interval '2 days','{"attribution":{"verification":true}}')`,[crypto.randomUUID(),id(1)]);expect((await source()).receiptId).toBe(first.receiptId);
 await db.exec("update enquiry_requests set raw_payload=jsonb_set(raw_payload,'{attribution,consent,marketing}','false') where not private.marketing_test_enquiry(id,project_id)");expect(prepareSale(await source(),policy)).toEqual({reason:'MARKETING_CONSENT_NOT_GRANTED'});
 await db.exec("insert into project_operational_states(project_id,state,closed_outcome) values('"+id(1)+"','CLOSED','CANCELLED')");expect((await source()).active).toBe(false);expect((await meta()).active).toBe(false);
 await db.exec("insert into private.project_sales_outcomes values('"+id(1)+"','test')");expect((await db.query('select * from private.advertising_scope_facts()')).rows).toEqual([]);
});
it('keeps current accepted value restatement separate from frozen first GA4 value',async()=>{
 await paid();await db.exec('set constraints all immediate');const audit=(await db.query<any>("select payload from audit_events where type='marketing.deposit_received'")).rows[0].payload;
 const first=await source();await historical();const revised=await source();expect(revised).toMatchObject({active:true,valueCents:30001,occurredAt:first.occurredAt});expect(revised.fingerprint).not.toBe(first.fingerprint);
 expect((await db.query<any>("select payload from audit_events where type='marketing.deposit_received'")).rows[0].payload).toEqual(audit);expect(audit.valueIncGstCents).toBe(20001);
});
it('actual runtime denies ingestion when economic ownership changes after claim and retains frozen evidence',async()=>{
 await paid();await historical();await enable();let ingestion=0,denials=0;
 const runtime:Parameters<typeof runGoogleConnection>[0]={lane:'sales',config:{actorId:actor,binding,clientId:'fake-client',clientSecret:'fake-secret',vaultId:'a'.repeat(26),itemId:'b'.repeat(26),vaultToken:'fake-vault'},signal:new AbortController().signal,
 vault:{authenticate:async()=>{},read:async()=>({refreshToken:'fake-refresh',version:1}),write:async()=>({version:2})},
 store:async(action,input,run)=>{await db.exec('savepoint rpc');try{const result=action==='credential_settled'?await db.query('select google_ads_credential_settled($1,$2,$3)',[actor,binding,run]):await command(action,input,run);
 if(action==='claim'&&result?.state==='SENDING')await reconcile(id(3001),'SEPARATE_CHARGE',null,10001);
 await db.exec('release savepoint rpc');return result;}catch(error){await db.exec('rollback to savepoint rpc;release savepoint rpc');if(action==='check'&&input?.quoteId)denials++;throw error;}},
 fetcher:async(url,init)=>{if(String(url).includes('oauth2'))return Response.json({access_token:'fake-access',token_type:'Bearer',scope:`${ADS_SCOPE} ${DATA_SCOPE}`,expires_in:3600});const body=JSON.parse(String(init?.body));
 if(body.query?.includes('FROM customer'))return Response.json({results:[{customer:{id:'6328516633',conversionTrackingSetting:{googleAdsConversionCustomer:'customers/6328516633'}}}]});
 if(body.query?.includes('FROM conversion_action'))return Response.json({results:[{conversionAction:{id:'123',type:'UPLOAD_CLICKS',status:'ENABLED',category:'PURCHASE',primaryForGoal:false,countingType:'MANY_PER_CLICK',valueSettings:{alwaysUseDefaultValue:false},clickThroughLookbackWindowDays:'90'}}]});
 ingestion++;throw Error('Ingestion must be fenced');}};
 expect((await runGoogleConnection(runtime)).completed).toBe(true);expect(ingestion).toBe(0);expect(denials).toBe(1);expect(await sale()).toMatchObject({state:'FAILED',reason:'DELIVERY_UNCONFIRMED',attempts:1,payload:{transactionId:`sanctuary-scope-${id(1)}`,conversionValue:300.01}});
});

it('qualifies approved partial Xero invoice payment on an assigned standalone family',async()=>{
 const invoice=await standalone();await reconcile(invoice,'QUOTE_PAYMENT',id(1),1000,0,'OPEN');await xero(invoice,100);
 expect((await source()).active).toBe(true);expect((await source()).valueCents).toBe(20001);expect((await meta()).active).toBe(true);expect((await db.query<any>('select status from deposit_invoices where id=$1',[invoice])).rows[0].status).toBe('OPEN');
});
it('retains no-ledger legacy PAID dates as unsupported qualification without rewriting history',async()=>{
 await db.exec("update deposit_invoices set status='PAID',paid_at=now()-interval '10 days'");const before=(await db.query<any>('select to_jsonb(i) row from deposit_invoices i')).rows;
 expect((await source()).occurredAt).toBeNull();await db.exec(paymentSql(advertisingFundingMigration));expect((await db.query<any>('select to_jsonb(i) row from deposit_invoices i')).rows).toEqual(before);
});

it('replacing readers preserves existing financial rows, GA4 audit/outbox and trigger identities without enqueue',async()=>{
 await paid();await db.exec('set constraints all immediate');
 const snapshots=async()=>(await db.query<any>(`select jsonb_build_object('payments',(select jsonb_agg(to_jsonb(r)) from project_payment_entries r),'allocations',(select jsonb_agg(to_jsonb(r)) from project_payment_allocations r),'audit',(select jsonb_agg(to_jsonb(r)) from audit_events r),'outbox',(select jsonb_agg(to_jsonb(r)) from marketing_conversion_deliveries r),'triggers',(select jsonb_agg(jsonb_build_object('oid',oid,'def',pg_get_triggerdef(oid)) order by oid) from pg_trigger where not tgisinternal)) v`)).rows[0].v;
 const before=await snapshots();await db.exec(paymentSql(advertisingFundingMigration));expect(await snapshots()).toEqual(before);
});
