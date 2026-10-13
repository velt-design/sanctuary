// @vitest-environment node
import { metaFixtureDb } from './fixtures/meta-source-db';
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
  db=await metaFixtureDb();
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
it.each(['interrupted','expired'] as const)('does not retry frozen contact hashes after matching authority is revoked during a %s dispatch',async(mode)=>{
  await enable();const run=await begin();await freeze(run.runId);const first=await command('claim',{},run.runId);
  if(mode==='expired')await db.exec(`update private.meta_sale_runs set expires_at=now()-interval '1 second' where id='${run.runId}'`);
  await db.exec('update private.meta_sale_control set contact_matching_approved=false where singleton=true');
  let sends=0;
  await runMetaSales({lane:'sales',credential:{datasetId:'123',token:'synthetic'},store:command,signal:new AbortController().signal,
    fetcher:async()=>{sends++;return Response.json({events_received:1,fbtrace_id:'unexpected'});}});
  expect(sends).toBe(0);expect((await sale()).state).toBe('REVIEW_REQUIRED');expect((await sale()).attempts).toBe(1);
  expect((await sale()).payload).toEqual(first.event);
});
it('retries an expired unchanged dispatch with the exact original frozen identity and body',async()=>{
  await enable();const run=await begin();await freeze(run.runId);const first=await command('claim',{},run.runId);
  await db.exec(`update private.meta_sale_runs set expires_at=now()-interval '1 second' where id='${run.runId}'`);
  let sent:unknown;
  await runMetaSales({lane:'sales',credential:{datasetId:'123',token:'synthetic'},store:command,signal:new AbortController().signal,
    fetcher:async(_url,init)=>{sent=JSON.parse(String(init?.body)).data[0];return Response.json({events_received:1,fbtrace_id:'recovered_trace'});}});
  expect(sent).toEqual(first.event);expect((await sale()).state).toBe('ACCEPTED');expect((await sale()).attempts).toBe(2);
});
it('keeps an unchanged already accepted event accepted after its import deadline passes',async()=>{
  await enable();await db.exec(`update enquiry_requests set created_at=now()-interval '10 days' where id='${id(4)}';update deposit_invoices set paid_at=now()-interval '8 days' where id='${id(5)}'`);
  const s=await source(),then=new Date(Date.now()-7*86400000),event=prepareMetaSale(s,policy,then).event!;expect(event).toBeDefined();
  // Seed the authentic shape of a receipt accepted seven days ago, without altering
  // source facts during reconciliation or pretending to advance Postgres's clock.
  await db.query(`insert into private.meta_sales(quote_id,project_id,generation,source_fingerprint,payload,dataset_id,state,attempts,first_attempt_at,accepted_at,receipt_id)
    select $1,$2,generation,$3,$4,'123','ACCEPTED',1,now()-interval '7 days',now()-interval '7 days','aged_trace' from private.meta_sale_control where singleton=true`,[s.quoteId,s.projectId,s.fingerprint,JSON.stringify(event)]);
  let sends=0;await runMetaSales({lane:'sales',credential:{datasetId:'123',token:'synthetic'},store:command,signal:new AbortController().signal,
    fetcher:async()=>{sends++;throw Error('Unexpected');}});
  expect(sends).toBe(0);expect((await sale()).state).toBe('ACCEPTED');expect((await sale()).payload).toEqual(event);
  expect((await sale()).receipt_id).toBe('aged_trace');
});
it.each(['value','matching-permission'] as const)('keeps a real %s change reviewable after acceptance',async(change)=>{
  await enable();let run=await begin();await freeze(run.runId);const first=await command('claim',{},run.runId);
  await command('complete',{quoteId:id(2),state:'ACCEPTED',receiptId:'accepted_trace'},run.runId);await command('finish',{},run.runId);
  if(change==='value')await db.exec(`update quote_versions set total_inc_gst_cents=1800000 where id='${id(3)}'`);
  else await db.exec('update private.meta_sale_control set contact_matching_approved=false where singleton=true');
  await runMetaSales({lane:'sales',credential:{datasetId:'123',token:'synthetic'},store:command,signal:new AbortController().signal,fetcher:async()=>{throw Error('Unexpected');}});
  expect((await sale()).state).toBe('REVIEW_REQUIRED');expect((await sale()).payload).toEqual(first.event);expect((await sale()).receipt_id).toBe('accepted_trace');
});
it.each(['none','missing','regional_default','missing_setting','user_choice'] as const)('distinguishes %s marketing evidence from explicit refusal before individual historical approval',async(basis)=>{
  await enable();await db.query(`update enquiry_requests set raw_payload=jsonb_set(raw_payload-'advertisingDisclosureVersion','{attribution,consent}',$1::jsonb) where id=$2`,[JSON.stringify({...(basis==='missing_setting'?{}:{marketing:false}),...(['missing','missing_setting'].includes(basis)?{}:{basis})}),id(4)]);
  await db.exec("update private.meta_sale_control set historical_enabled=true,upload_mode='historical' where singleton=true");
  const unapproved=await source();expect(unapproved.marketingDenied).toBe(basis==='user_choice');expect(prepareMetaSale(unapproved,{...policy,historicalEnabled:true}).event).toBeUndefined();
  await db.exec(`insert into private.meta_sale_history_approvals(quote_id,source_fingerprint,identity_source,evidence_ref,owner_approval_ref,recorded_by) values('${id(2)}','${unapproved.fingerprint}','original','separate-rights-evidence','approved-batch','synthetic')`);
  const s=await source(),prepared=prepareMetaSale(s,{...policy,historicalEnabled:true});expect(Boolean(prepared.event)).toBe(basis!=='user_choice');
  const run=await begin();await command('freeze',{quoteId:s.quoteId,fingerprint:s.fingerprint,...prepared},run.runId);
  expect(Boolean(await command('claim',{},run.runId))).toBe(basis!=='user_choice');
});
it.each(['expired','revoked'] as const)('exposes %s effective sending authority even when begin cannot create a run',async(problem)=>{
  await enable();if(problem==='expired')await db.exec("update private.meta_sale_control set credential_expires_at=now()-interval '1 minute',upload_mode='routine' where singleton=true");
  else await db.exec(`update portal_users set role='installer' where user_id='${id(90)}'`);
  await rejects(begin,problem==='expired'?'disabled':'authority');
  const status=metaSaleStatusSchema.parse((await db.query<{v:unknown}>('select public.meta_sale_staff_read() v')).rows[0].v);
  expect(status.enabled).toBe(true);expect(status.deliveryAuthority).toBe(problem==='expired'?'CREDENTIAL_EXPIRED':'ACTOR_UNAVAILABLE');
  expect(status.error).toBeNull();expect(status.lastCompletedAt).toBeNull();
});
