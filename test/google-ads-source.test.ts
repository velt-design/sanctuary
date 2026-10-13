// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, afterAll, beforeEach, afterEach, expect, it } from 'vitest';
import { prepareSale, saleSourceSchema } from '../apps/portal/lib/marketingIntegrations/googleAds/sales';
import { runGoogleConnection } from '../apps/portal/lib/marketingIntegrations/googleAds/worker';
import { ADS_SCOPE,DATA_SCOPE } from '../apps/portal/lib/marketingIntegrations/googleAds/config';
const db=new PGlite(), id=(n:number)=>`44444444-4444-4444-8444-${String(n).padStart(12,'0')}`, binding='a'.repeat(64);
const command=async(action:string,input:unknown={},run:string|null=null)=>(await db.query<{value:any}>('select public.google_ads_command($1,$2,$3,$4,$5) value',[id(90),binding,action,run,JSON.stringify(input)])).rows[0].value;
const sources=async()=> (await db.query<{source:unknown}>('select source from private.google_ads_sources()')).rows.map(r=>saleSourceSchema.parse(r.source));
const policy={enhancedMatchingApproved:true,allowedConsentBases:['user_choice','regional_default'],consentEffectiveFrom:'2026-01-01T00:00:00Z'};
const enable=async()=>db.exec(`update private.google_ads_control set actor_id='${id(90)}',binding_sha256='${binding}',conversion_customer_id='6328516633',action_id='123',reports_enabled=true,uploads_enabled=true,consent_policy_approved=true,enhanced_matching_approved=true,allowed_consent_bases=array['user_choice','regional_default'],consent_effective_from='2026-01-01';`);
const begin=()=>command('begin',{lane:'sales'});
async function rejects(action:()=>Promise<unknown>,message:string) { await db.exec('savepoint rejected'); await expect(action()).rejects.toThrow(message);await db.exec('rollback to savepoint rejected'); }
async function freeze(run:string) { const source=(await sources())[0],prepared=prepareSale(source,policy);await command('freeze',{quoteId:source.quoteId,fingerprint:source.fingerprint,...prepared},run);return source; }
beforeAll(async()=>{
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema private;
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
    create function auth.role() returns text language sql as $$select current_setting('test.role',true)$$;
    create function has_portal_access() returns boolean language sql as $$select current_setting('test.staff',true)='yes'$$;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);
    create table portal_users(user_id uuid,is_active boolean);
    create table projects(id uuid primary key);
    create table quotes(id uuid primary key,project_id uuid);
    create table quote_versions(id uuid primary key,quote_id uuid,version_number int,status text,created_at timestamptz,accepted_at timestamptz,total_inc_gst_cents int);
    create table enquiry_requests(id uuid primary key,project_id uuid,created_at timestamptz,raw_payload jsonb);
    create table deposit_invoices(id uuid primary key,quote_id uuid,quote_version_id uuid,payment_term_position int,status text,currency text,total_inc_gst_cents int,paid_at timestamptz);
    create table project_payment_entries(id uuid primary key,source_invoice_id uuid,entry_type text,amount_inc_gst_cents int,occurred_at timestamptz,reverses_entry_id uuid);
    create table xero_deposit_matches(invoice_id uuid,payment_entry_id uuid,amount_inc_gst_cents int,reversed_at timestamptz);
    create table project_operational_states(project_id uuid,state text,closed_outcome text);
    insert into auth.users values('${id(90)}','jordan@sanctuarypergolas.co.nz',now(),null,null);
    insert into portal_users values('${id(90)}',true);
    set test.uid='${id(90)}';set test.role='service_role';set test.staff='yes';`);
  await db.exec(readFileSync('supabase/migrations/20260813000003_commercial_truth_invariants.sql','utf8').split('create or replace function public.commercial_project_financial_truth')[0]);
  await db.exec(readFileSync('supabase/migrations/20261013000001_google_ads_source.sql','utf8'));
  await db.exec(readFileSync('supabase/migrations/20261013000002_google_ads_commands.sql','utf8'));
},30000);
beforeEach(async()=>{
  await db.exec(`begin;insert into projects values('${id(1)}');insert into quotes values('${id(2)}','${id(1)}');
    insert into quote_versions values('${id(3)}','${id(2)}',1,'ACCEPTED',now()-interval '20 days',now()-interval '19 days',1500000);
    insert into enquiry_requests values('${id(4)}','${id(1)}',now()-interval '30 days','{"email":"demo@example.test","phone":"+64211234567","attribution":{"consent":{"marketing":true,"basis":"regional_default"}}}');
    insert into deposit_invoices values('${id(5)}','${id(2)}','${id(3)}',1,'PAID','NZD',500000,now()-interval '10 days');`);
});
afterEach(async()=>db.exec('rollback'));afterAll(async()=>db.close());
it('installs dark and denies unbound or inactive operators',async()=>{
  await rejects(begin,'authority');await enable();
  await db.exec(`update portal_users set is_active=false`);await rejects(begin,'authority');
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
