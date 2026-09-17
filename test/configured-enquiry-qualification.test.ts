// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, afterAll, expect, it } from 'vitest';
import { marketingEnquiryTestIntakeSql } from '../scripts/lib/marketing-enquiry-test-intake.mjs';
const db = new PGlite();
const project = '11111111-1111-4111-8111-111111111111';
const enquiry = '22222222-2222-4222-8222-222222222222';
const other = '33333333-3333-4333-8333-333333333333';
const command = '44444444-4444-4444-8444-444444444444';
const all = { location: true, project: true, contactAndConfiguration: true, intent: true };
const unknown = { ...all, intent: null };
const failed = { ...all, location: false };
const read = (e = enquiry, p = project) => db.query<{ result: any }>('select public.enquiry_qualification_read($1,$2) result', [p,e]);
const record = (state = 'qualified', criteria: Record<string, unknown> = all, version = 0, reason = '', id = command, e = enquiry, p = project) =>
  db.query<{ result: any }>('select public.enquiry_qualification_record($1,$2,$3,$4,$5,$6,$7) result', [p,e,id,version,state,JSON.stringify(criteria),reason]);
beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated; create schema auth; create schema private;
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql as $$ select '{"email":"synthetic.staff@example.test"}'::jsonb $$;
    create function public.has_portal_access() returns boolean language sql as $$ select current_setting('test.staff',true)='yes' $$;
    create table public.enquiry_requests(id uuid primary key,project_id uuid,raw_payload jsonb);
    create table private.marketing_enquiry_deliveries(enquiry_request_id uuid primary key,draft_estimate jsonb);
  `);
  await db.exec(readFileSync('supabase/migrations/20260917000003_configured_enquiry_qualification.sql','utf8'));
  const brief = { version: 1, audience: 'residential', design: { input: { widthMm: 4000 }, roof: { family: 'mono' } } };
  await db.query('insert into enquiry_requests values ($1,$2,$3),($4,$2,$5)', [enquiry, project, JSON.stringify({ requestType:'project-discussion',customerBrief:brief }),other,JSON.stringify({ requestType:'site-measure',customerBrief:brief })]);
},30000);
afterAll(async () => { await db.close(); });
it('denies anonymous and nonstaff reads and writes; authenticated staff cannot write the audit directly', async () => {
  await expect(read()).rejects.toThrow('Forbidden');
  await expect(record()).rejects.toThrow('Forbidden');
  await db.exec(`set test.uid='${other}'; set test.staff='no'`);
  await expect(record()).rejects.toThrow('Forbidden');
  await db.exec("set test.staff='yes'; set role authenticated");
  await expect(db.query('select * from private.enquiry_qualification_events')).rejects.toThrow('permission denied');
  expect((await read()).rows[0].result).toMatchObject({ eligible:true,current:{version:0,state:'unreviewed'},history:[] });
});
it('binds exact project/source and excludes legacy/nonconfigured enquiries', async () => {
  await expect(read(enquiry,other)).rejects.toThrow('Enquiry not found');
  await expect(record('qualified',all,0,'',command,enquiry,other)).rejects.toThrow('Enquiry not found');
  expect((await read(other)).rows[0].result.eligible).toBe(false);
  await expect(record('qualified',all,0,'',command,other)).rejects.toThrow('Only submitted');
});
it('rejects unknown qualified, absent/replaced criteria and unexplained not-qualified without creating history', async () => {
  await expect(record('qualified',unknown)).rejects.toThrow('all four');
  await expect(record('qualified',{...all,budget:true})).rejects.toThrow('Invalid assessment');
  await expect(record('qualified',{...all,intent:'yes'})).rejects.toThrow('Invalid assessment');
  await expect(record('qualified',{})).rejects.toThrow('Invalid assessment');
  await expect(record('not_qualified',failed)).rejects.toThrow('failed criterion and a reason');
  await expect(record('not_qualified',unknown,0,'Unknown is not a failure')).rejects.toThrow('failed criterion');
  expect((await read()).rows[0].result.current.version).toBe(0);
});
it('saves unknown as unreviewed without an invented reason and authenticates its actor', async () => {
  const result = (await record('unreviewed',unknown)).rows[0].result;
  expect(result.current).toMatchObject({ version:1,state:'unreviewed',criteria:unknown,reason:'',actorId:other,actorEmail:'synthetic.staff@example.test',criteriaVersion:'configured-enquiry-v1' });
  expect(JSON.stringify(result)).not.toMatch(/widthMm|customerBrief|raw_payload|request"|command_id/);
});
it('replays identically but rejects changed payload, actor, stale update and unreasoned corrections', async () => {
  expect((await record('unreviewed',unknown)).rows[0].result.replayed).toBe(true);
  await expect(record('qualified',all)).rejects.toThrow('different assessment');
  await db.exec(`set test.uid='${project}'`);
  await expect(record('unreviewed',unknown)).rejects.toThrow('different assessment');
  await db.exec(`set test.uid='${other}'`);
  await expect(record('qualified',all,0,'Confirmed',other)).rejects.toThrow('Another staff review');
  await expect(record('qualified',all,1,'',other)).rejects.toThrow('Explain the correction');
});
it('retains correction history and returns newest state when an older command is retried', async () => {
  const result = (await record('qualified',all,1,'Confirmed serviceability and customer intent',other)).rows[0].result;
  expect(result.current).toMatchObject({ version:2,state:'qualified' });
  expect(result.history.map((entry: any) => entry.state)).toEqual(['qualified','unreviewed']);
  const retry = (await record('unreviewed',unknown)).rows[0].result;
  expect(retry).toMatchObject({ replayed:true,current:{version:2,state:'qualified'} });
  const rejected = (await record('not_qualified',failed,2,'Customer confirmed site outside service area',project)).rows[0].result;
  expect(rejected.history).toHaveLength(3);
  expect(rejected.current.state).toBe('not_qualified');
});
it('enforces append-only even for table owner and prioritizes frozen submitted configuration', async () => {
  await db.exec('reset role');
  await expect(db.query('delete from private.enquiry_qualification_events')).rejects.toThrow('append-only');
  await expect(db.query("update private.enquiry_qualification_events set state='unreviewed'")).rejects.toThrow('append-only');
  await db.query('insert into private.marketing_enquiry_deliveries values($1,$2)',[enquiry,JSON.stringify({outputs:{snapshot:{customerBrief:{version:1,audience:'commercial',design:{input:{},roof:{}}}}}})]);
  await db.exec('set role authenticated');
  expect((await read()).rows[0].result.eligible).toBe(false);
  await db.exec('reset role; set role anon');
  await expect(read()).rejects.toThrow('permission denied');
});

it('qualifies the exact real-intake result, not submission ID, without changing pipeline or outbox', async () => {
  const intakeDb = new PGlite();
  try {
    await intakeDb.exec(`create role anon; create role authenticated; create role service_role; create schema auth; create schema private;
      create table projects(id uuid primary key);
      create function auth.uid() returns uuid language sql as $$ select '${other}'::uuid $$;
      create function auth.jwt() returns jsonb language sql as $$ select '{"email":"synthetic.staff@example.test"}'::jsonb $$;
      create function public.has_portal_access() returns boolean language sql as $$ select true $$;`);
    await intakeDb.exec(readFileSync('supabase/tests/marketing_enquiry_delivery_bootstrap.sql','utf8'));
    await intakeDb.exec(readFileSync('supabase/enquiry_requests.sql','utf8').replace('create extension if not exists pgcrypto;',''));
    await intakeDb.exec(marketingEnquiryTestIntakeSql(process.cwd()));
    await intakeDb.exec('create table private.marketing_enquiry_deliveries(enquiry_request_id uuid primary key,draft_estimate jsonb)');
    await intakeDb.exec(readFileSync('supabase/migrations/20260917000003_configured_enquiry_qualification.sql','utf8'));
    const payload = {enquiryType:'residential',name:'Qualification fixture',email:'qualification@example.test',phone:'+6400000002',files:[],
      rawPayload:{requestType:'project-discussion',customerBrief:{version:1,audience:'residential',design:{input:{widthMm:4000},roof:{family:'mono'}}}}};
    const result=(await intakeDb.query<{enquiry_request_id:string;project_id:string}>('select * from marketing_enquiry_intake($1,$2,$3)',[command,'',JSON.stringify(payload)])).rows[0];
    const replay=(await intakeDb.query<{enquiry_request_id:string}>('select * from marketing_enquiry_intake($1,$2,$3)',[command,'',JSON.stringify(payload)])).rows[0];
    expect(replay.enquiry_request_id).toBe(result.enquiry_request_id);
    expect(result.enquiry_request_id).not.toBe(command);
    const before=(await intakeDb.query('select * from projects')).rows;
    await intakeDb.exec('set role authenticated');
    await expect(intakeDb.query('select enquiry_qualification_read($1,$2)',[result.project_id,command])).rejects.toThrow('Enquiry not found');
    const saved=(await intakeDb.query<{result:any}>('select enquiry_qualification_record($1,$2,$3,0,$4,$5,$6) result',
      [result.project_id,result.enquiry_request_id,project,'qualified',JSON.stringify(all),''])).rows[0].result;
    expect(saved).toMatchObject({enquiryId:result.enquiry_request_id,projectId:result.project_id,current:{state:'qualified',version:1}});
    await intakeDb.exec('reset role');
    expect((await intakeDb.query('select * from projects')).rows).toEqual(before);
    expect((await intakeDb.query('select count(*)::int n from email_outbox')).rows).toEqual([{n:0}]);
    expect((await intakeDb.query('select count(*)::int n from audit_events')).rows).toEqual([{n:0}]);
  } finally { await intakeDb.close(); }
},30000);
