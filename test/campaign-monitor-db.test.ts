// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { outcomesSchema } from '../apps/portal/lib/marketingIntegrations/campaignMonitor/contract';
import { metaFixtureDb, metaFixtureId } from './fixtures/meta-source-db';
import { installReportingTestExclusions } from './fixtures/reporting-test-exclusion-db';
const scope = { account: '99100', campaign: '99200', adset: '99300', ads: [{ id: '99401', label: 'Riverhead photo' }, { id: '99402', label: 'Riverhead video' }, { id: '99403', label: 'Acrylic video' }, { id: '99404', label: 'Acrylic photo' }], launchDay: '2026-01-01', dailyAverage: 100, maximumDay: 175, weeklyAllowance: 700, weekStartsOn: 0, weeklyWindowVerified: true };
it('executes scoped campaign source lifecycle and exact cohort without customer payloads', async () => {
 const db = await metaFixtureDb(), actor = metaFixtureId(90), connection = metaFixtureId(91), binding = 'a'.repeat(64);
 try {
  await db.exec(`alter table enquiry_requests add column utm jsonb;alter table quote_versions add column sent_at timestamptz;
   alter table deposit_invoices add column project_id uuid;alter table xero_deposit_matches add column project_id uuid;
   create table public.site_visit_events(project_id uuid,status text,confirmed_at timestamptz);
   create table private.enquiry_qualification_events(enquiry_id uuid,project_id uuid,version integer,state text);
   insert into praxis_reporting.source_identity_v1 values(true,'fixture','${connection}','test');
   insert into private.sanctuary_meta_control(actor_id,account_id,binding_hash,enabled,expires_at,source_key,connection_id,environment)
   values('${actor}','99100','${binding}',true,now()+interval '1 day','fixture','${connection}','test');`);
  await db.exec((await readFile('supabase/migrations/20261014000006_campaign_health.sql', 'utf8')).replace(/\r?\n/g,'\r\n'));
  await installReportingTestExclusions(db);
  await db.query('insert into private.sanctuary_campaign_monitor_scope(scope,enabled) values($1,true)', [JSON.stringify(scope)]);
  const today = (await db.query<{today:string;start:string}>("select to_char(clock_timestamp() at time zone 'Pacific/Auckland','YYYY-MM-DD') today,to_char((clock_timestamp() at time zone 'Pacific/Auckland')::date-extract(dow from clock_timestamp() at time zone 'Pacific/Auckland')::integer,'YYYY-MM-DD') start")).rows[0]!;
  const command = async (action: string, op: string | null = null, query: unknown = null, step: string | null = null, payload: unknown = null) =>
    (await db.query<{r:Record<string,unknown>}>('select public.sanctuary_meta_command($1,$2,$3,$4,$5,$6,$7,$8,$9::text,$10,$11::text) r', [actor,scope.account,binding,'fixture',connection,'test',action,op,query ? JSON.stringify(query):null,step,payload ? JSON.stringify(payload):null])).rows[0]!.r;
  const query = { start: today.start, end: today.today, retain: false, health: true, scope };
  await expect(command('claim',null,{...query,scope:{...scope,campaign:'99999'}})).rejects.toThrow();
  const op = String((await command('claim',null,query)).operation);
  await expect(command('claim',null,query)).rejects.toThrow();
  for(const step of ['identity_check','account_read','report_read','report_read','report_read']) { await command('before',op,null,step);await command('after',op,null,step); }
  await expect(command('before',op,null,'report_read')).rejects.toThrow();
  const report = { version:'sanctuary-campaign-health-v1',account:scope.account,campaign:scope.campaign,adset:scope.adset,currency:'NZD',timezone:'Pacific/Auckland',observedAt:new Date().toISOString(),periods:{week:{start:today.start,end:today.today}} };
  await command('complete',op,null,null,report);await command('deliver',op);
  const project=metaFixtureId(1),enquiry=metaFixtureId(2);
  await db.query('insert into contacts(id,email) values($1,$2)',[metaFixtureId(3),'private@example.test']);
  await db.query('insert into projects(id,contact_id) values($1,$2)',[project,metaFixtureId(3)]);
  await db.query('insert into enquiry_requests(id,project_id,created_at,raw_payload) values($1,$2,now(),$3)',[enquiry,project,JSON.stringify({name:'Private sentinel',email:'private@example.test',attribution:{consent:{marketing:true},utm:{utm_campaign:scope.campaign,utm_term:scope.adset,utm_content:'99401'}}})]);
  await db.exec(`insert into private.enquiry_qualification_events values('${enquiry}','${project}',1,'qualified');insert into public.site_visit_events values('${project}','CONFIRMED',now());`);
  const outcome = (await db.query<{r:{ads:Array<{id:string;enquiries:number;qualified:number;confirmedVisits:number}>}}>('select public.sanctuary_campaign_outcomes($1,$2,$3,$4,$5,$6,$7) r',[actor,scope.account,binding,'fixture',connection,'test',op])).rows[0]!.r;
  expect(outcome.ads.find(row=>row.id==='99401')).toMatchObject({enquiries:1,qualified:1,confirmedVisits:1});
  expect(outcomesSchema.safeParse(outcome).success).toBe(true);
  expect(outcomesSchema.parse(outcome).correspondence.contacts[0]).toMatchObject({email:'private@example.test',projectId:project,multipleProjects:false});
  const { correspondence, ...aggregate } = outcomesSchema.parse(outcome);expect(correspondence.total).toBe(1);
  expect(JSON.stringify(aggregate)).not.toMatch(/Private sentinel|private@example|projectId|customerName/);
  await db.exec('begin');
  try {
   const payload = JSON.stringify({ name:'TEST ONLY synthetic verification', attribution:{consent:{marketing:true},utm:{utm_campaign:scope.campaign,utm_term:scope.adset,utm_content:'99401'}} });
   for (const [testId, testProject] of [['fdb7aa7a-bb3f-4fb3-89ed-ac3483d21118', null], ['f3229ccf-6a1a-4e1a-bcf4-2edf5cc85e70', null], [metaFixtureId(401), '9d98b82b-679a-4ecb-8265-9fa05eaa78ef'], [metaFixtureId(402), '10c5db1a-602c-4f0c-8193-855b186215bb']]) {
    await db.query('insert into enquiry_requests(id,project_id,created_at,raw_payload) values($1,$2,now(),$3)', [testId,testProject,payload]);
   }
   const readOutcomes = async () => outcomesSchema.parse((await db.query<{r:unknown}>('select public.sanctuary_campaign_outcomes($1,$2,$3,$4,$5,$6,$7) r',[actor,scope.account,binding,'fixture',connection,'test',op])).rows[0].r);
   expect((await readOutcomes()).ads.find(row=>row.id==='99401')?.enquiries).toBe(1);
   await db.query('insert into enquiry_requests(id,project_id,created_at,raw_payload) values($1,null,now(),$2)', [metaFixtureId(403),payload]);
   expect((await readOutcomes()).ads.find(row=>row.id==='99401')?.enquiries).toBe(2);
  } finally { await db.exec('rollback'); }
  // Duplicate contact rows do not create independent mailbox identities.
  await db.query('insert into contacts(id,email) values($1,$2)',[metaFixtureId(4),'  PRIVATE@Example.Test  ']);
  await db.query('insert into projects(id,contact_id) values($1,$2)',[metaFixtureId(5),metaFixtureId(4)]);
  const duplicateMailbox=(await db.query<{r:unknown}>('select public.sanctuary_campaign_outcomes($1,$2,$3,$4,$5,$6,$7) r',[actor,scope.account,binding,'fixture',connection,'test',op])).rows[0]!.r;
  expect(outcomesSchema.parse(duplicateMailbox).correspondence.contacts[0]).toMatchObject({email:'private@example.test',projectId:project,multipleProjects:true});
  await db.query('update contacts set email=$1 where id=$2',['different@example.test',metaFixtureId(4)]);
  const distinctMailbox=(await db.query<{r:unknown}>('select public.sanctuary_campaign_outcomes($1,$2,$3,$4,$5,$6,$7) r',[actor,scope.account,binding,'fixture',connection,'test',op])).rows[0]!.r;
  expect(outcomesSchema.parse(distinctMailbox).correspondence.contacts[0]?.multipleProjects).toBe(false);
  await db.exec('update private.sanctuary_campaign_monitor_scope set enabled=false');await expect(command('deliver',op)).rejects.toThrow();
  await db.exec('set role authenticated');await expect(command('claim',null,query)).rejects.toThrow();await db.exec('reset role');
 } finally { await db.close(); }
},60000);

it.skipIf(!process.env.VELT_META_MIGRATION_ROOT)('executes paired Velt durable claims, ownership, dedupe, model reservation and stop fences', async () => {
 const db = await metaFixtureDb(), owner = metaFixtureId(90), hash = 'b'.repeat(64), root = process.env.VELT_META_MIGRATION_ROOT!;
 try {
  await db.exec(`create table public.nodes(id uuid primary key);insert into public.nodes values('${metaFixtureId(1)}');
   create table public.velt_connection_controls(owner_id uuid primary key,stopped boolean,generation bigint);
   create table public.velt_connection_operations(owner_id uuid,provider text,kind text,inbox_query jsonb,started_at timestamptz default clock_timestamp());
   create function public.velt_connection_event_immutable() returns trigger language plpgsql as $$begin raise exception 'immutable';end$$;
   insert into public.velt_connection_controls values('${owner}',false,1);
   create type public.work_inbox_source_kind as enum('manual','praxis_message');
   create table public.work_inbox_items(id uuid default gen_random_uuid(),node_id uuid,raw_input text,source_kind public.work_inbox_source_kind,captured_by uuid,source_praxis_message_id uuid,
    constraint work_inbox_source_shape check ((source_kind='manual' and source_praxis_message_id is null) or (source_kind='praxis_message' and source_praxis_message_id is not null)));`);
  let original=await readFile(join(root,'supabase/migrations/202609160002_portal_customer_reads.sql'),'utf8');
  original=original.replaceAll("('customers','context','receipts','summary')","('customers','context','receipts','summary','marketing','overview','workload','specialist-workload','finance-history','briefing','finance-position')");
  await db.exec(original);
  for(const file of ['202609230005_sanctuary_meta_reads.sql','202609230006_meta_migration_authority.sql','202609230007_meta_validation.sql','202610140001_campaign_monitor_inbox_source.sql','202610140002_campaign_monitor.sql']) await db.exec(await readFile(join(root,'supabase/migrations',file),'utf8'));
  await db.exec(`insert into public.velt_meta_source_controls values('${owner}','sanctuary',false);
   insert into public.velt_campaign_monitor_controls(owner_id,scope_hash,node_id,enabled,admitted_until,review_maximum_usd)
   values('${owner}','${hash}','${metaFixtureId(1)}',true,now()+interval '1 day',0.1);`);
  const command=async(stage:string,run:string|null=null,payload:unknown=null,id=owner)=>(await db.query<{r:Record<string,unknown>|null}>('select public.velt_campaign_monitor_command($1,$2,$3,$4,$5) r',[id,hash,stage,run,payload ? JSON.stringify(payload):null])).rows[0]!.r;
  await expect(command('claim',null,null,metaFixtureId(92))).rejects.toThrow();
  const claim=await command('claim');expect(claim?.run).toBeTruthy();expect(await command('claim')).toBeNull();
  const run=String(claim!.run); await command('check',run);
  await db.exec(`update public.velt_campaign_monitor_runs set daily_day=(clock_timestamp() at time zone 'Pacific/Auckland')::date where id='${run}'`);
  await command('model',run,{maximumUsd:0.035,phase:'customer'});await expect(command('model',run,{maximumUsd:0.035,phase:'customer'})).rejects.toThrow();
  await expect(command('model',run,{maximumUsd:0.08,phase:'assessment'})).rejects.toThrow();await command('model',run,{maximumUsd:0.052,phase:'assessment'});
  await expect(command('model',run,{maximumUsd:0.001,phase:'assessment'})).rejects.toThrow();
  await command('complete',run,{version:1,checkedAt:new Date().toISOString(),alerts:['meta_unavailable']});
  expect((await db.query('select * from public.work_inbox_items')).rows).toHaveLength(1);expect(await command('claim')).toBeNull();
  await db.exec(`update public.velt_campaign_monitor_runs set slot=slot-1,started_at=started_at-interval '4 hours';`);
  const next=await command('claim');await command('complete',String(next!.run),{version:1,checkedAt:new Date().toISOString(),alerts:['meta_unavailable']});
  expect((await db.query('select * from public.work_inbox_items')).rows).toHaveLength(1);
  await db.exec(`update public.velt_campaign_monitor_runs set slot=slot-2,started_at=started_at-interval '8 hours';`);
  const failed=await command('claim');await command('failed',String(failed!.run));
  expect((await command('read'))?.state).toBe('failed');expect((await command('read'))?.payload).toMatchObject({version:1});
  expect((await db.query('select * from public.work_inbox_items')).rows).toHaveLength(2);
  await db.exec(`update public.velt_campaign_monitor_runs set slot=slot-3,started_at=started_at-interval '12 hours';`);
  const hung=await command('claim');await db.exec(`update public.velt_campaign_monitor_runs set expires_at=now()-interval '1 second' where id='${hung!.run}'`);
  expect((await command('read'))?.state).toBe('expired');expect(await command('claim')).toBeNull();
  expect((await db.query('select * from public.work_inbox_items')).rows).toHaveLength(3);expect(await command('claim')).toBeNull();
  expect((await db.query('select * from public.work_inbox_items')).rows).toHaveLength(3);
  await db.exec(`update public.velt_campaign_monitor_controls set admitted_until=now()-interval '1 second';`);
  expect(await command('claim')).toMatchObject({skip:'admission_expired'});expect(await command('claim')).toMatchObject({skip:'admission_expired'});
  expect((await db.query('select * from public.work_inbox_items')).rows).toHaveLength(4);expect((await command('read'))?.payload).toMatchObject({version:1});
  await db.exec(`update public.velt_campaign_monitor_controls set admitted_until=now()+interval '1 day';update public.velt_campaign_monitor_runs set slot=slot-4,started_at=started_at-interval '16 hours';`);
  const pending=await command('claim');await db.exec('update public.velt_connection_controls set stopped=true,generation=generation+1');
  await expect(command('complete',String(pending!.run),{version:1,checkedAt:new Date().toISOString(),alerts:[]})).rejects.toThrow();
  await db.exec('set role authenticated');await expect(command('read')).rejects.toThrow();await db.exec('reset role');
 }finally{await db.close();}
},60000);
