// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import postgres from 'postgres';
import { beforeAll, afterAll, beforeEach, afterEach, expect, it } from 'vitest';
import { metaSaleSourceSchema, prepareMetaSale } from '../apps/portal/lib/marketingIntegrations/metaSales/sales';
import { runMetaSales } from '../apps/portal/lib/marketingIntegrations/metaSales/worker';
import { metaSaleStatusSchema } from '../apps/portal/lib/marketingIntegrations/metaSales/contract';
const id=(n:number)=>`44444444-4444-4444-8444-${String(n).padStart(12,'0')}`,binding='b'.repeat(64);
let db:{exec:(sql:string)=>Promise<unknown>;query:<T>(sql:string,args?:unknown[])=>Promise<{rows:T[]}>;close:()=>Promise<void>};
const policy={consentPolicyApproved:true,contactMatchingApproved:true,historicalEnabled:false,allowedConsentBases:['regional_default','user_choice'],disclosureVersion:'2026-10-sale-measurement-v2',consentEffectiveFrom:'2026-01-01T00:00:00Z'};
const command=async(action:string,input:unknown={},run:string|null=null)=>(await db.query<{v:any}>('select public.meta_sale_command($1,$2,$3,$4,$5) v',[id(90),binding,action,run,JSON.stringify(input)])).rows[0].v;
const source=async()=>metaSaleSourceSchema.parse((await db.query<{source:unknown}>('select source from private.meta_sale_sources() order by quote_id limit 1')).rows[0].source);
const sale=async()=>(await db.query<Record<string,any>>('select * from private.meta_sales order by quote_id limit 1')).rows[0];
const enable=()=>db.exec(`update private.meta_sale_control set actor_id='${id(90)}',binding_sha256='${binding}',dataset_id='123',credential_expires_at=now()+interval '10 days',assignment_verified_at=now(),uploads_enabled=true,contact_matching_approved=true,consent_policy_approved=true,allowed_consent_bases=array['regional_default','user_choice'],consent_effective_from='2026-01-01',canary_quote_id='${id(2)}' where singleton=true`);
const begin=()=>command('begin',{lane:'sales'});
async function rejects(action:()=>Promise<unknown>,text:string){await db.exec('savepoint failure');await expect(action()).rejects.toThrow(text);await db.exec('rollback to savepoint failure');}
async function freeze(run:string){const s=await source();await command('freeze',{quoteId:s.quoteId,fingerprint:s.fingerprint,...prepareMetaSale(s,policy)},run);return s;}
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
    create table contacts(id uuid primary key,email text,phone text);
    create table projects(id uuid primary key,contact_id uuid);
    create table quotes(id uuid primary key,project_id uuid);
    create table quote_versions(id uuid primary key,quote_id uuid,version_number int,status text,created_at timestamptz,accepted_at timestamptz,total_inc_gst_cents int);
    create table enquiry_requests(id uuid primary key,project_id uuid,created_at timestamptz,raw_payload jsonb);
    create table deposit_invoices(id uuid primary key,quote_id uuid,quote_version_id uuid,payment_term_position int,status text,currency text,total_inc_gst_cents int,paid_at timestamptz);
    create table project_payment_entries(id uuid primary key,source_invoice_id uuid,entry_type text,amount_inc_gst_cents int,occurred_at timestamptz,reverses_entry_id uuid);
    create table xero_deposit_matches(invoice_id uuid,payment_entry_id uuid,amount_inc_gst_cents int,reversed_at timestamptz);
    create table project_operational_states(project_id uuid,state text,closed_outcome text);
    insert into auth.users values('${id(90)}','jordan@sanctuarypergolas.co.nz',now(),null,null);
    insert into portal_users values('${id(90)}','admin');set test.uid='${id(90)}';set test.role='service_role';set test.staff='yes';`);
  await db.exec(readFileSync('supabase/migrations/20260813000003_commercial_truth_invariants.sql','utf8').split('create or replace function public.commercial_project_financial_truth')[0]);
  for(const file of ['20261013000001_google_ads_source.sql','20261013000002_google_ads_commands.sql','20261013000003_google_ads_retraction_source_fence.sql','20261013000005_google_ads_current_generation_health.sql'])await db.exec(readFileSync(`supabase/migrations/${file}`,'utf8'));
  // Retain the actual prior function for byte-for-byte output/fingerprint comparison.
  const definition=(await db.query<{definition:string}>("select pg_get_functiondef('private.google_ads_sources()'::regprocedure) definition")).rows[0].definition;
  await db.exec(definition.replace('private.google_ads_sources()','private.original_google_ads_sources()'));
  for(const file of ['20261014000001_advertising_scope_source.sql','20261014000002_meta_sale_source.sql','20261014000003_meta_sale_commands.sql'])await db.exec(readFileSync(`supabase/migrations/${file}`,'utf8'));
},30000);
beforeEach(async()=>{await db.exec(`begin;insert into contacts values('${id(9)}','current@example.test','+64212345678');insert into projects values('${id(1)}','${id(9)}');
  insert into quotes values('${id(2)}','${id(1)}');insert into quote_versions values('${id(3)}','${id(2)}',1,'ACCEPTED',now()-interval '4 days',now()-interval '3 days',1500000);
  insert into enquiry_requests values('${id(4)}','${id(1)}',now()-interval '5 days','{"advertisingDisclosureVersion":"2026-10-sale-measurement-v2","email":"demo@example.test","phone":"+64211234567","attribution":{"consent":{"marketing":true,"basis":"regional_default"}}}');
  insert into deposit_invoices values('${id(5)}','${id(2)}','${id(3)}',1,'PAID','NZD',500000,now()-interval '1 day');`);});
afterEach(async()=>db.exec('rollback'));afterAll(async()=>db.close());
it('installs dark and assessment cannot create sendable rows',async()=>{
  await rejects(begin,'authority');await enable();await db.exec('update private.meta_sale_control set uploads_enabled=false where singleton=true');
  await rejects(begin,'disabled');const run=await command('begin',{lane:'assess'});const s=await source();
  await command('assess',{quoteId:s.quoteId,fingerprint:s.fingerprint,...prepareMetaSale(s,policy)},run.runId);
  await rejects(()=>command('freeze',{quoteId:s.quoteId,fingerprint:s.fingerprint,...prepareMetaSale(s,policy)},run.runId),'cannot send');
  expect(await sale()).toBeUndefined();
});
it('preserves Google output and fingerprints through shared source extraction including revisions and duplicate invoices',async()=>{
  await db.exec(`insert into deposit_invoices values('${id(6)}','${id(2)}','${id(3)}',1,'PAID','NZD',500000,now());insert into quote_versions values('${id(7)}','${id(2)}',2,'ACCEPTED',now(),now(),1800000)`);
  const actual=(await db.query<{source:unknown}>('select source from private.google_ads_sources()')).rows;
  expect(actual).toEqual((await db.query<{source:unknown}>('select source from private.original_google_ads_sources()')).rows);
  expect((await source()).valueCents).toBe(1800000);
});
it('sends once, uses full value and retains acceptance across ordinary scans',async()=>{
  await enable();const run=await begin();await freeze(run.runId);const claimed=await command('claim',{},run.runId);
  expect(claimed.event.custom_data.value).toBe(15000);await command('check',{quoteId:id(2)},run.runId);
  await command('complete',{quoteId:id(2),state:'ACCEPTED',receiptId:'trace_synthetic',diagnostics:{warningCount:0}},run.runId);
  await freeze(run.runId);expect(await command('claim',{},run.runId)).toBeNull();expect((await sale()).attempts).toBe(1);
});
it.each(['suppression','payment','approval'])('fences a %s change after claim before the provider request',async(change)=>{
  await enable();const run=await begin();await freeze(run.runId);await command('claim',{},run.runId);
  if(change==='suppression')await db.exec(`insert into private.advertising_sale_suppressions(project_id,provider,recorded_by,reason) values('${id(1)}','meta','synthetic','CUSTOMER_OPT_OUT')`);
  if(change==='payment')await db.exec("update deposit_invoices set status='OPEN',paid_at=null where id='"+id(5)+"'");
  if(change==='approval')await db.exec("update private.meta_sale_control set contact_matching_approved=false where singleton=true");
  await rejects(()=>command('check',{quoteId:id(2)},run.runId),change==='approval'?'lease':'changed');expect((await sale()).attempts).toBe(1);
});
it('retains uncertain identity and refuses a changed sale on retry',async()=>{
  await enable();const run=await begin();await freeze(run.runId);const claim=await command('claim',{},run.runId);
  await command('complete',{quoteId:id(2),state:'RETRY',reason:'TRANSPORT_UNCERTAIN',diagnostics:{}},run.runId);
  await db.exec(`update deposit_invoices set paid_at=paid_at+interval '1 hour' where id='${id(5)}'`);await freeze(run.runId);
  expect((await sale()).state).toBe('REVIEW_REQUIRED');expect((await sale()).payload).toEqual(claim.event);expect(await command('claim',{},run.runId)).toBeNull();
});
it('retains and reports accepted cancellation instead of replaying a zero purchase',async()=>{
  await enable();const run=await begin();await freeze(run.runId);await command('claim',{},run.runId);
  await command('complete',{quoteId:id(2),state:'ACCEPTED',receiptId:'trace_synthetic'},run.runId);
  await db.exec(`insert into project_operational_states values('${id(1)}','CLOSED','CANCELLED')`);await freeze(run.runId);
  expect((await sale()).state).toBe('REVIEW_REQUIRED');expect((await sale()).payload.custom_data.value).toBe(15000);
});
it('limits retries across expired runs and preserves the first attempt time',async()=>{
  await enable();let run=await begin();await freeze(run.runId);await command('claim',{},run.runId);
  await db.exec(`update private.meta_sale_runs set expires_at=now()-interval '1 second' where id='${run.runId}';update private.meta_sales set first_attempt_at=now()-interval '25 hours' where quote_id='${id(2)}'`);
  run=await begin();expect(await command('claim',{},run.runId)).toBeNull();expect((await sale()).state).toBe('REVIEW_REQUIRED');expect((await sale()).attempts).toBe(1);
});
it('requires exact history evidence and rechecks revocation after claim',async()=>{
  await enable();await db.exec(`update enquiry_requests set raw_payload=raw_payload-'advertisingDisclosureVersion' where id='${id(4)}';update private.meta_sale_control set historical_enabled=true,upload_mode='historical' where singleton=true`);
  const original=await source();expect(prepareMetaSale(original,{...policy,historicalEnabled:true}).event).toBeUndefined();
  await db.exec(`insert into private.meta_sale_history_approvals(quote_id,source_fingerprint,identity_source,evidence_ref,owner_approval_ref,recorded_by) values('${id(2)}','${original.fingerprint}','crm','synthetic-evidence','synthetic-owner','synthetic')`);
  const s=await source(),run=await begin();await command('freeze',{quoteId:s.quoteId,fingerprint:s.fingerprint,...prepareMetaSale(s,{...policy,historicalEnabled:true})},run.runId);
  expect(await command('claim',{},run.runId)).not.toBeNull();await db.exec(`update private.meta_sale_history_approvals set revoked_at=now() where quote_id='${id(2)}'`);
  await rejects(()=>command('check',{quoteId:id(2)},run.runId),'changed');
});
it('rejects forged matching data even with the current source fingerprint',async()=>{
  await enable();const run=await begin(),s=await source(),prepared=prepareMetaSale(s,policy);prepared.event!.user_data.em=['a'.repeat(64)];
  await rejects(()=>command('freeze',{quoteId:s.quoteId,fingerprint:s.fingerprint,...prepared},run.runId),'matching');
});
it('keeps the canary scoped even if another ready sale already exists',async()=>{
  await enable();await db.exec(`insert into quotes values('${id(12)}','${id(1)}');insert into quote_versions values('${id(13)}','${id(12)}',1,'ACCEPTED',now(),now(),900000);insert into deposit_invoices values('${id(15)}','${id(12)}','${id(13)}',1,'PAID','NZD',300000,now());`);
  const run=await begin();expect((await command('sources',{},run.runId)).map((s:any)=>s.quoteId)).toEqual([id(2)]);
  const other=metaSaleSourceSchema.parse((await db.query<{source:unknown}>(`select source from private.meta_sale_sources() where quote_id='${id(12)}'`)).rows[0].source);
  await rejects(()=>command('freeze',{quoteId:other.quoteId,fingerprint:other.fingerprint,...prepareMetaSale(other,policy)},run.runId),'selected');
});
it('runs source through the real worker, provider boundary and staff-safe aggregate DTO',async()=>{
  await enable();let sends=0;
  await runMetaSales({lane:'sales',credential:{datasetId:'123',token:'synthetic'},store:command,signal:new AbortController().signal,fetcher:async(_url,init)=>{
    sends++;const request=JSON.parse(String(init?.body));expect(request.data[0].user_data.em[0]).toHaveLength(64);expect(request.test_event_code).toBeUndefined();
    return Response.json({events_received:1,messages:[],fbtrace_id:'synthetic_trace'});
  }});
  expect(sends).toBe(1);const status=metaSaleStatusSchema.parse((await db.query<{v:unknown}>('select public.meta_sale_staff_read() v')).rows[0].v);
  expect(status.counts.ACCEPTED).toBe(1);expect(JSON.stringify(status)).not.toContain('demo@example');
});
it('retries uncertain transport with exactly the same event and retains a bounded attempt budget',async()=>{
  await enable();const payloads:string[]=[];
  const input={lane:'sales' as const,credential:{datasetId:'123',token:'synthetic'},store:command,signal:new AbortController().signal};
  await runMetaSales({...input,fetcher:async(_url,init)=>{payloads.push(String(init?.body));throw Error('lost response');}});
  expect((await sale()).state).toBe('RETRY');const first=(await sale()).first_attempt_at;
  await db.exec(`update private.meta_sales set next_attempt_at=now()-interval '1 second' where quote_id='${id(2)}'`);
  await runMetaSales({...input,fetcher:async(_url,init)=>{payloads.push(String(init?.body));return Response.json({events_received:1,fbtrace_id:'retry_trace',messages:[]});}});
  expect(payloads[1]).toBe(payloads[0]);expect((await sale()).attempts).toBe(2);expect((await sale()).first_attempt_at).toEqual(first);
});
it('stops after the fifth unconfirmed request rather than leaving forever-pending retries',async()=>{
  await enable();const run=await begin();await freeze(run.runId);await command('finish',{},run.runId);
  await db.exec(`update private.meta_sales set attempts=4,first_attempt_at=now()-interval '1 hour' where quote_id='${id(2)}'`);
  await runMetaSales({lane:'sales',credential:{datasetId:'123',token:'synthetic'},store:command,signal:new AbortController().signal,fetcher:async()=>{throw Error('lost');}});
  expect((await sale()).state).toBe('REVIEW_REQUIRED');expect((await sale()).reason).toBe('RETRY_WINDOW_EXHAUSTED');expect((await sale()).attempts).toBe(5);
});
it('does not make a provider request after the source changes between claim and check',async()=>{
  await enable();let sends=0;
  await runMetaSales({lane:'sales',credential:{datasetId:'123',token:'synthetic'},signal:new AbortController().signal,
    store:async(action,input,run)=>{
      if(action==='check') {
        await db.exec(`insert into private.advertising_sale_suppressions(project_id,provider,recorded_by,reason) values('${id(1)}','meta','synthetic','CUSTOMER_OPT_OUT');savepoint provider_check`);
        // PostgREST gives each RPC its own transaction; isolate the expected SQL error.
        try { return await command(action,input,run); } catch(error) { await db.exec('rollback to savepoint provider_check');throw error; }
      }
      return command(action,input,run);
    },fetcher:async()=>{sends++;return Response.json({events_received:1,fbtrace_id:'unexpected'});}});
  expect(sends).toBe(0);expect((await sale()).state).toBe('REVIEW_REQUIRED');expect((await sale()).reason).toBe('SOURCE_CHECK_FAILED');
});
