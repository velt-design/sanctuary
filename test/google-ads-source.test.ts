// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import postgres from 'postgres';
import { beforeAll, afterAll, beforeEach, afterEach, expect, it } from 'vitest';
import { prepareSale, saleSourceSchema } from '../apps/portal/lib/marketingIntegrations/googleAds/sales';
import { runGoogleConnection } from '../apps/portal/lib/marketingIntegrations/googleAds/worker';
import { ADS_SCOPE,DATA_SCOPE } from '../apps/portal/lib/marketingIntegrations/googleAds/config';
import { statusSchema } from '../apps/portal/lib/marketingIntegrations/googleAds/contract';
const id=(n:number)=>`44444444-4444-4444-8444-${String(n).padStart(12,'0')}`, binding='a'.repeat(64);
let db:{exec:(sql:string)=>Promise<unknown>;query:<T>(sql:string,args?:unknown[])=>Promise<{rows:T[]}>;close:()=>Promise<void>};
const command=async(action:string,input:unknown={},run:string|null=null)=>(await db.query<{value:any}>('select public.google_ads_command($1,$2,$3,$4,$5) value',[id(90),binding,action,run,JSON.stringify(input)])).rows[0].value;
const sources=async()=> (await db.query<{source:unknown}>('select source from private.google_ads_sources()')).rows.map(r=>saleSourceSchema.parse(r.source));
const policy={enhancedMatchingApproved:true,allowedConsentBases:['user_choice','regional_default'],consentEffectiveFrom:'2026-01-01T00:00:00Z',disclosureVersion:'2026-10-sale-measurement-v1'};
const enable=async()=>db.exec(`update private.google_ads_control set actor_id='${id(90)}',binding_sha256='${binding}',conversion_customer_id='6328516633',action_id='123',reports_enabled=true,upload_mode='routine',uploads_enabled=true,consent_policy_approved=true,enhanced_matching_approved=true,allowed_consent_bases=array['user_choice','regional_default'],consent_effective_from='2026-01-01';`);
const begin=()=>command('begin',{lane:'sales'});
const sale=async()=>(await db.query<Record<string,any>>('select * from private.google_ads_sales')).rows[0];
const staffRead=async()=>(await db.query<{value:any}>('select public.google_ads_staff_read() value')).rows[0].value;
async function rejects(action:()=>Promise<unknown>,message:string) { await db.exec('savepoint rejected'); await expect(action()).rejects.toThrow(message);await db.exec('rollback to savepoint rejected'); }
async function freeze(run:string) { const source=(await sources())[0],prepared=prepareSale(source,policy);await command('freeze',{quoteId:source.quoteId,fingerprint:source.fingerprint,...prepared},run);return source; }
beforeAll(async()=>{
  const native=process.env.GOOGLE_ADS_NATIVE_TEST_URL;
  if(native){const url=new URL(native);if(url.hostname!=='127.0.0.1'||url.username!=='postgres'||url.pathname!=='/google_ads_fixture')throw Error('Disposable local database only');
    const client=postgres(native,{max:1});db={exec:sql=>client.unsafe(sql),query:async<T>(sql:string,args:unknown[]=[])=>({rows:await client.unsafe(sql,args.map(value=>typeof value==='string'&&/^[{[]/.test(value)?client.json(JSON.parse(value)):value) as never[]) as unknown as T[]}),close:()=>client.end()};
  }else db=new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema private;
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
    create function auth.role() returns text language sql as $$select current_setting('test.role',true)$$;
    create function has_portal_access() returns boolean language sql as $$select current_setting('test.staff',true)='yes'$$;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);
    create table portal_users(user_id uuid,role text);
    create table projects(id uuid primary key);
    create table quotes(id uuid primary key,project_id uuid);
    create table quote_versions(id uuid primary key,quote_id uuid,version_number int,status text,created_at timestamptz,accepted_at timestamptz,total_inc_gst_cents int);
    create table enquiry_requests(id uuid primary key,project_id uuid,created_at timestamptz,raw_payload jsonb);
    create table deposit_invoices(id uuid primary key,quote_id uuid,quote_version_id uuid,payment_term_position int,status text,currency text,total_inc_gst_cents int,paid_at timestamptz);
    create table project_payment_entries(id uuid primary key,source_invoice_id uuid,entry_type text,amount_inc_gst_cents int,occurred_at timestamptz,reverses_entry_id uuid);
    create table xero_deposit_matches(invoice_id uuid,payment_entry_id uuid,amount_inc_gst_cents int,reversed_at timestamptz);
    create table project_operational_states(project_id uuid,state text,closed_outcome text);
    insert into auth.users values('${id(90)}','jordan@sanctuarypergolas.co.nz',now(),null,null);
    insert into portal_users values('${id(90)}','admin');
    set test.uid='${id(90)}';set test.role='service_role';set test.staff='yes';`);
  await db.exec(readFileSync('supabase/migrations/20260813000003_commercial_truth_invariants.sql','utf8').split('create or replace function public.commercial_project_financial_truth')[0]);
  await db.exec(readFileSync('supabase/migrations/20261013000001_google_ads_source.sql','utf8'));
  await db.exec(readFileSync('supabase/migrations/20261013000002_google_ads_commands.sql','utf8'));
},30000);
beforeEach(async()=>{
  await db.exec(`begin;insert into projects values('${id(1)}');insert into quotes values('${id(2)}','${id(1)}');
    insert into quote_versions values('${id(3)}','${id(2)}',1,'ACCEPTED',now()-interval '20 days',now()-interval '19 days',1500000);
    insert into enquiry_requests values('${id(4)}','${id(1)}',now()-interval '30 days','{"advertisingDisclosureVersion":"2026-10-sale-measurement-v1","email":"demo@example.test","phone":"+64211234567","attribution":{"consent":{"marketing":true,"basis":"regional_default"}}}');
    insert into deposit_invoices values('${id(5)}','${id(2)}','${id(3)}',1,'PAID','NZD',500000,now()-interval '10 days');`);
});
afterEach(async()=>db.exec('rollback'));afterAll(async()=>db.close());
it('installs dark and denies unbound or inactive operators',async()=>{
  await rejects(begin,'authority');await enable();
  await db.exec(`delete from portal_users where user_id='${id(90)}'`);await rejects(begin,'authority');
});
it.each(['role','unconfirmed','banned','deleted'])('rejects revoked actor authority: %s',async(reason)=>{
  await enable();
  if(reason==='role')await db.exec("update portal_users set role='installer'");
  if(reason==='unconfirmed')await db.exec('update auth.users set email_confirmed_at=null');
  if(reason==='banned')await db.exec("update auth.users set banned_until=now()+interval '1 day'");
  if(reason==='deleted')await db.exec('update auth.users set deleted_at=now()');
  await rejects(begin,'authority');
});
it.each([null,'old-version'])('holds old tabs submitted after the cutoff with disclosure %s in worker and database',async(version)=>{
  await enable();const {runId}=await begin();const approved=(await sources())[0],prepared=prepareSale(approved,policy);
  await db.query("update enquiry_requests set raw_payload=jsonb_set(raw_payload,'{advertisingDisclosureVersion}',$1::jsonb)",[JSON.stringify(version)]);
  const old=(await sources())[0];expect(prepareSale(old,policy)).toEqual({reason:'ADVERTISING_DISCLOSURE_NOT_CURRENT'});
  await rejects(()=>command('freeze',{quoteId:old.quoteId,fingerprint:old.fingerprint,...prepared},runId),'Invalid sale freeze');
  await freeze(runId);expect((await sale()).state).toBe('SKIPPED');
});
it('requires a pinned canary and fences all source, freeze, claim and effect paths to that one family',async()=>{
  await enable();await db.exec(`insert into quotes values('${id(12)}','${id(1)}');insert into quote_versions values('${id(13)}','${id(12)}',1,'ACCEPTED',now(),now(),900000);
    insert into deposit_invoices values('${id(15)}','${id(12)}','${id(13)}',1,'PAID','NZD',300000,now()-interval '1 day')`);
  await rejects(()=>db.exec("update private.google_ads_control set upload_mode='canary',canary_quote_id=null"),'check constraint');
  let run=await begin();const all=await sources(),other=all.find(row=>row.quoteId===id(12))!;
  await command('freeze',{quoteId:other.quoteId,fingerprint:other.fingerprint,...prepareSale(other,policy)},run.runId);
  await db.exec(`update private.google_ads_control set upload_mode='canary',canary_quote_id='${id(2)}'`);
  await rejects(()=>command('claim',{},run.runId),'lease');run=await begin();
  expect((await command('sources',{},run.runId)).map((row:any)=>row.quoteId)).toEqual([id(2)]);
  await rejects(()=>command('freeze',{quoteId:other.quoteId,fingerprint:other.fingerprint,...prepareSale(other,policy)},run.runId),'outside canary');
  expect(await command('claim',{},run.runId)).toBeNull();
  await freeze(run.runId);const claimed=await command('claim',{},run.runId);expect(claimed.quoteId).toBe(id(2));
  // Even an inconsistent stale lease cannot authorize a different family effect.
  await db.query('update private.google_ads_sales set lease_id=$1 where quote_id=$2',[run.runId,id(12)]);
  await rejects(()=>command('check',{quoteId:id(12)},run.runId),'outside canary');
  await command('complete',{quoteId:id(2),state:'SUBMITTED',requestId:'canary-only'},run.runId);
  expect(await command('claim',{},run.runId)).toBeNull();
});
it('deduplicates first instalment invoices by scope and keeps deposited revisions',async()=>{
  await db.exec(`insert into deposit_invoices values('${id(6)}','${id(2)}','${id(3)}',1,'PAID','NZD',500000,now()-interval '5 days');
    insert into quote_versions values('${id(7)}','${id(2)}',2,'ACCEPTED',now(),now(),1800000);`);
  const result=await sources();expect(result).toHaveLength(1);expect(result[0].valueCents).toBe(1800000);expect(result[0].active).toBe(true);
  expect(Date.now()-Date.parse(result[0].occurredAt!)).toBeGreaterThan(9*86400000);
});
it('recognises partial verified deposits with an OPEN invoice and reversal cancels eligibility',async()=>{
  await db.exec(`update deposit_invoices set status='OPEN',paid_at=null;
    insert into project_payment_entries values('${id(8)}',null,'PAYMENT',10000,now()-interval '2 days',null);
    insert into xero_deposit_matches values('${id(5)}','${id(8)}',10000,null);`);
  expect((await sources())[0].active).toBe(true);
  await db.exec(`update xero_deposit_matches set reversed_at=now()`);expect((await sources())[0].active).toBe(false);
});
it('requires boolean marketing consent and respects separately recorded opt-outs',async()=>{
  await db.exec(`update enquiry_requests set raw_payload=jsonb_set(raw_payload,'{attribution,consent,marketing}','"true"')`);
  expect((await sources())[0].marketingConsent).toBe(false);
  await db.exec(`update enquiry_requests set raw_payload=jsonb_set(raw_payload,'{attribution,consent,marketing}','true');
    insert into private.google_ads_suppressions values('${id(1)}',now(),'CUSTOMER_OPT_OUT','test operator')`);
  expect((await sources())[0].marketingConsent).toBe(false);
});
it('executes the privileged withdrawal runbook for every verified project and leaves uploads off',async()=>{
  await enable();await db.exec(`insert into projects values('${id(11)}')`);
  const guide=readFileSync('docs/google-ads-connection.md','utf8'),block=guide.split('```sql')[1].split('```')[0];
  const operation=block.slice(block.indexOf('do $$'),block.indexOf('commit;'))
    .replace('array[]::uuid[]',`array['${id(1)}','${id(11)}']::uuid[]`).replace("operator_reference text := ''","operator_reference text := 'synthetic operator / request'");
  await db.exec(operation);
  expect((await db.query<{uploads_enabled:boolean}>('select uploads_enabled from private.google_ads_control')).rows[0].uploads_enabled).toBe(false);
  expect((await db.query<{n:number}>('select count(*)::int n from private.google_ads_suppressions')).rows[0].n).toBe(2);
  expect((await sources())[0].marketingConsent).toBe(false);
});
it('freezes once, retries same identity, confirms ingestion then queues real cancellation',async()=>{
  await enable();const {runId}=await begin();await freeze(runId);await freeze(runId);
  const first=await command('claim',{},runId);expect(first.event.transactionId).toBe(`sanctuary-scope-${id(2)}`);
  await command('complete',{quoteId:id(2),state:'SUBMITTED',requestId:'synthetic-request'},runId);
  await db.exec('update private.google_ads_sales set next_attempt_at=now()');
  const pending=await command('claim',{},runId);expect(pending.state).toBe('SUBMITTED');
  await command('complete',{quoteId:id(2),state:'ACCEPTED'},runId);
  await db.exec(`insert into project_operational_states values('${id(1)}','CLOSED','CANCELLED')`);
  await freeze(runId);
  expect((await db.query<{state:string}>('select state from private.google_ads_sales')).rows[0].state).toBe('RETRACTION_READY');
});
it('immediate disable fences active dispatch and preserves correction evidence on reenable',async()=>{
  await enable();const {runId}=await begin();await freeze(runId);const claim=await command('claim',{},runId);
  await db.exec('update private.google_ads_control set uploads_enabled=false');
  await rejects(()=>command('check',{quoteId:id(2)},runId),'lease');
  const retained=(await db.query<{payload:any;destination:any}>('select payload,destination from private.google_ads_sales')).rows[0];
  expect(retained.payload).toEqual(claim.event);expect(retained.destination.actionId).toBe('123');
  await db.exec('update private.google_ads_control set uploads_enabled=true');const resumed=await begin();
  expect((await command('claim',{},resumed.runId)).event).toEqual(claim.event);
});
it('rechecks source consent immediately before dispatch and forbids raw table access',async()=>{
  await enable();const {runId}=await begin();await freeze(runId);await command('claim',{},runId);
  await db.exec(`insert into private.google_ads_suppressions values('${id(1)}',now(),'CUSTOMER_OPT_OUT','test operator')`);
  await rejects(()=>command('check',{quoteId:id(2)},runId),'changed');
});
it('quarantines uncertain credential rotation rather than reusing a stale refresh token',async()=>{
  await enable();const {runId}=await begin();await command('credential_pending',{},runId);
  await rejects(()=>command('check',{},runId),'lease');
  await db.query('select google_ads_credential_settled($1,$2,$3)',[id(90),binding,runId]);await command('check',{},runId);
});
it('real SQL and worker reach one durable provider submission through refresh, policy and action preflight',async()=>{
  await enable();const calls:string[]=[];
  const fetcher:typeof fetch=async(url,init)=>{
    calls.push(String(url));
    if(String(url).includes('oauth2'))return Response.json({access_token:'fake-access',token_type:'Bearer',scope:`${ADS_SCOPE} ${DATA_SCOPE}`,expires_in:3600});
    if(String(url).includes('events:ingest')){const body=JSON.parse(String(init!.body));expect(body.validateOnly).toBe(false);expect(body.events[0].transactionId).toBe(`sanctuary-scope-${id(2)}`);expect(JSON.stringify(body)).not.toContain('example.test');return Response.json({requestId:'provider-request'});}
    const query=JSON.parse(String(init!.body)).query;
    if(query.includes('FROM customer'))return Response.json({results:[{customer:{id:'6328516633',conversionTrackingSetting:{googleAdsConversionCustomer:'customers/6328516633'}}}]});
    return Response.json({results:[{conversionAction:{id:'123',type:'UPLOAD_CLICKS',status:'ENABLED',category:'PURCHASE',primaryForGoal:false,countingType:'MANY_PER_CLICK',valueSettings:{alwaysUseDefaultValue:false},clickThroughLookbackWindowDays:'90'}}]});
  };
  const runtime:Parameters<typeof runGoogleConnection>[0]={lane:'sales',config:{actorId:id(90),binding,clientId:'fake-client',clientSecret:'fake-secret',vaultId:'a'.repeat(26),itemId:'b'.repeat(26),vaultToken:'fake-vault'},
    vault:{authenticate:async()=>{},read:async()=>({refreshToken:'fake-refresh',version:1}),write:async()=>({version:2})},
    store:async(action,input,run)=>action==='credential_settled'?db.query('select google_ads_credential_settled($1,$2,$3)',[id(90),binding,run]):command(action,input,run),
    signal:new AbortController().signal,fetcher};
  const result=await runGoogleConnection(runtime);
  expect(result.completed).toBe(true);expect(calls.filter(url=>url.includes('events:ingest'))).toHaveLength(1);
  expect((await db.query<{state:string;request_id:string}>('select state,request_id from private.google_ads_sales')).rows[0]).toEqual({state:'SUBMITTED',request_id:'provider-request'});
  await db.exec('update private.google_ads_sales set next_attempt_at=now()');
  await runGoogleConnection({...runtime,fetcher:async(url,init)=>String(url).includes('requestStatus')?Response.json({requestStatusPerDestination:[{destination:{operatingAccount:{accountType:'GOOGLE_ADS',accountId:'6328516633'},loginAccount:{accountType:'GOOGLE_ADS',accountId:'6596874249'},productDestinationId:'123'},requestStatus:'FAILED',eventsIngestionStatus:{recordCount:'1'},errorInfo:{errorCounts:[{reason:'PROCESSING_ERROR_REASON_INTERNAL_ERROR',recordCount:'1'}]}}]}):fetcher(url,init)});
  expect(await sale()).toMatchObject({state:'RETRY',reason:'GOOGLE_TRANSIENT_REJECTION',diagnostics:{requestId:'provider-request',errors:[{code:'PROCESSING_ERROR_REASON_INTERNAL_ERROR',count:1}]}});
  await db.exec('update private.google_ads_sales set next_attempt_at=now()');await runGoogleConnection(runtime);
  await db.exec("update private.google_ads_sales set submitted_at=now()-interval '25 hours',next_attempt_at=now()");
  await runGoogleConnection({...runtime,fetcher:async(url,init)=>String(url).includes('requestStatus')?new Response('',{status:503}):fetcher(url,init)});
  expect((await db.query<{state:string;reason:string}>('select state,reason from private.google_ads_sales')).rows[0]).toEqual({state:'REVIEW_REQUIRED',reason:'GOOGLE_DIAGNOSTIC_TIMEOUT'});
});
it('preserves a confirmed sale when an import window passes and requires new cycle after true retraction',async()=>{
  await enable();const {runId}=await begin();const source=await freeze(runId);await command('claim',{},runId);
  await command('complete',{quoteId:id(2),state:'SUBMITTED',requestId:'request'},runId);
  await db.exec('update private.google_ads_sales set next_attempt_at=now()');await command('claim',{},runId);
  await command('complete',{quoteId:id(2),state:'ACCEPTED'},runId);
  await command('freeze',{quoteId:id(2),fingerprint:source.fingerprint,reason:'SALE_OUTSIDE_IMPORT_WINDOW'},runId);
  expect((await db.query<{state:string}>('select state from private.google_ads_sales')).rows[0].state).toBe('ACCEPTED');
  await db.exec("update private.google_ads_sales set state='RETRACTED'");await freeze(runId);
  expect((await db.query<{reason:string}>('select reason from private.google_ads_sales')).rows[0].reason).toBe('RESTORED_SALE_REQUIRES_NEW_CYCLE');
});
it('excludes never-paid scopes from delivery coverage and locks down RPC and private tables',async()=>{
  await enable();await db.exec(`update deposit_invoices set status='OPEN',paid_at=null`);const {runId}=await begin();
  expect(await command('sources',{},runId)).toEqual([]);
  await db.exec('set local role authenticated');
  await rejects(()=>db.query('select * from private.google_ads_sales'),'permission denied');
  await rejects(()=>command('sources',{},runId),'permission denied');
  await db.exec('reset role');
});
it.each(['date','identity','value'])('preserves uncertain dispatch payload and destination when %s changes',async(change)=>{
  await enable();const {runId}=await begin();await freeze(runId);const first=await command('claim',{},runId),original=await sale();
  await command('complete',{quoteId:id(2),state:'RETRY',reason:'TRANSPORT_UNCERTAIN'},runId);
  if(change==='date')await db.exec("update deposit_invoices set paid_at=paid_at+interval '1 hour'");
  if(change==='identity')await db.exec("update enquiry_requests set raw_payload=jsonb_set(raw_payload,'{email}','\"other@example.test\"')");
  if(change==='value')await db.exec('update quote_versions set total_inc_gst_cents=1800000');
  await freeze(runId);const after=await sale();expect(after.state).toBe('REVIEW_REQUIRED');expect(after.payload).toEqual(first.event);
  expect(after.destination).toEqual(original.destination);expect(after.attempts).toBe(1);expect(after.request_id).toBeNull();
});
it('preserves expired possibly-sent evidence and prevents provenance changes from resetting attempts',async()=>{
  await enable();const {runId}=await begin();await freeze(runId);const first=await command('claim',{},runId);
  await db.exec(`update private.google_ads_runs set expires_at=clock_timestamp()-interval '1 second' where id='${runId}';update deposit_invoices set paid_at=paid_at+interval '1 hour'`);
  const resumed=await begin();await freeze(resumed.runId);expect((await sale()).state).toBe('REVIEW_REQUIRED');expect((await sale()).payload).toEqual(first.event);
});
it('only confirmed acceptance permits a deliberate same-identity value restatement',async()=>{
  await enable();const {runId}=await begin();await freeze(runId);const first=await command('claim',{},runId);
  await command('complete',{quoteId:id(2),state:'SUBMITTED',requestId:'original'},runId);
  await db.exec('update private.google_ads_sales set next_attempt_at=now()');await command('claim',{},runId);await command('complete',{quoteId:id(2),state:'ACCEPTED'},runId);
  await db.exec('update quote_versions set total_inc_gst_cents=1800000');await freeze(runId);const correction=await command('claim',{},runId);
  expect(correction.event).toEqual({...first.event,conversionValue:18000});expect(correction.attempts).toBe(1);
});
it('cancels after the eighth accepted ingestion attempt using its separate retraction budget',async()=>{
  await enable();await db.exec('update private.google_ads_control set retractions_enabled=true');const {runId}=await begin();await freeze(runId);
  for(let n=1;n<=8;n++){
    const claimed=await command('claim',{},runId);expect(claimed.attempts).toBe(n);
    await command('complete',{quoteId:id(2),state:n===8?'SUBMITTED':'RETRY',...(n===8?{requestId:'eighth'}:{reason:'TRANSPORT_UNCERTAIN'})},runId);
    await db.exec('update private.google_ads_sales set next_attempt_at=now()');
  }
  await command('claim',{},runId);await command('complete',{quoteId:id(2),state:'ACCEPTED'},runId);
  await db.exec(`insert into project_operational_states values('${id(1)}','CLOSED','CANCELLED')`);await freeze(runId);
  await db.exec('update private.google_ads_sales set next_attempt_at=now()');expect((await command('claim',{},runId)).state).toBe('RETRACTING');
  expect((await sale()).attempts).toBe(8);expect((await sale()).retraction_attempts).toBe(1);
  await command('complete',{quoteId:id(2),state:'RETRACTED'},runId);expect((await sale()).state).toBe('RETRACTED');
});
it('makes an expired eighth dispatch explicitly reviewable rather than leaving an unclaimable retry',async()=>{
  await enable();const {runId}=await begin();await freeze(runId);
  await db.exec('update private.google_ads_sales set attempts=7');const first=await command('claim',{},runId);
  await db.exec(`update private.google_ads_runs set expires_at=clock_timestamp()-interval '1 second' where id='${runId}'`);const resumed=await begin();
  expect(await command('claim',{},resumed.runId)).toBeNull();expect(await sale()).toMatchObject({state:'REVIEW_REQUIRED',reason:'DELIVERY_RETRY_EXHAUSTED',attempts:8,payload:first.event});
});
it('does not dispatch a pending cancellation after the sale becomes active again',async()=>{
  await enable();const {runId}=await begin();await freeze(runId);await command('claim',{},runId);await command('complete',{quoteId:id(2),state:'RETRY'},runId);
  await db.exec(`insert into project_operational_states values('${id(1)}','CLOSED','CANCELLED')`);await freeze(runId);
  await db.exec(`delete from project_operational_states where project_id='${id(1)}'`);await freeze(runId);
  expect(await sale()).toMatchObject({state:'REVIEW_REQUIRED',reason:'SALE_RESTORED_BEFORE_RETRACTION'});expect(await command('claim',{},runId)).toBeNull();
});
it.each([['report','sales'],['sales','report']])('retains %s failure after a successful %s run until the failed lane recovers',async(failed,healthy)=>{
  await enable();const first=await command('begin',{lane:failed});await command('finish',{error:'GOOGLE_CONNECTION_REQUIRES_REVIEW'},first.runId);
  const second=await command('begin',{lane:healthy});await command('finish',{},second.runId);
  expect(statusSchema.parse(await staffRead()).health[failed].error).toBe('GOOGLE_CONNECTION_REQUIRES_REVIEW');expect((await staffRead()).health[healthy].error).toBeNull();
  const recovery=await command('begin',{lane:failed});expect((await staffRead()).health[failed]).toMatchObject({error:'GOOGLE_CONNECTION_REQUIRES_REVIEW',pending:'RUNNING'});
  await command('finish',{},recovery.runId);expect((await staffRead()).health[failed].error).toBeNull();
});
it('exposes an expired credential quarantine even when another lane last succeeded',async()=>{
  await enable();const report=await command('begin',{lane:'report'});await command('finish',{},report.runId);
  const {runId}=await begin();await command('credential_pending',{},runId);await db.exec(`update private.google_ads_runs set expires_at=clock_timestamp()-interval '1 second' where id='${runId}'`);
  expect((await staffRead()).health.sales).toMatchObject({pending:'EXPIRED',credentialUncertain:true});
  await rejects(()=>command('begin',{lane:'report'}),'reconciliation');
});
it('retains sanitized provider diagnostics with private request evidence and exposes only code aggregates',async()=>{
  await enable();const {runId}=await begin();await freeze(runId);await command('claim',{},runId);await command('complete',{quoteId:id(2),state:'SUBMITTED',requestId:'private-request'},runId);
  await db.exec('update private.google_ads_sales set next_attempt_at=now()');await command('claim',{},runId);
  const diagnostics={status:'FAILED',recordCount:1,recovery:'REVIEW',requestId:'private-request',destination:{customerId:'6328516633',actionId:'123'},errors:[{code:'PROCESSING_ERROR_REASON_DENIED_CONSENT',count:1}],warnings:[]};
  await command('complete',{quoteId:id(2),state:'REVIEW_REQUIRED',reason:'GOOGLE_DIAGNOSTICS_REQUIRE_REVIEW',diagnostics},runId);
  expect((await sale()).diagnostics).toEqual(diagnostics);const evidence=await staffRead();expect(evidence.diagnostics).toEqual([{severity:'errors',code:'PROCESSING_ERROR_REASON_DENIED_CONSENT',count:1}]);
  expect(JSON.stringify(evidence)).not.toContain('private-request');expect(JSON.stringify(evidence)).not.toContain('transactionId');
});
it('uses a qualified singleton delete on authority rotation and retains prior sale destination',async()=>{
  await enable();const {runId}=await command('begin',{lane:'report'});await command('report',{report:{customerId:'6328516633'}},runId);await command('finish',{},runId);
  const sales=await begin();await freeze(sales.runId);const original=await sale();
  await db.exec("update private.google_ads_control set action_id='456' where singleton=true");
  expect((await db.query<{n:number}>('select count(*)::int n from private.google_ads_report')).rows[0].n).toBe(0);
  expect((await sale()).destination).toEqual(original.destination);expect((await sale()).reason).toBe('AUTHORITY_CHANGED');
  const source=readFileSync('supabase/migrations/20261013000001_google_ads_source.sql','utf8');
  expect(source).toContain('delete from private.google_ads_report where singleton=true;');expect(source).not.toContain('delete from private.google_ads_report;');
});
