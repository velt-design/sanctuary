// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const read = (name: string) => readFileSync(name, 'utf8');
const migration = read('supabase/migrations/20260917000002_defer_project_follow_ups.sql');
const source = read('test/project-work-items-v2-migration.test.ts');
const bootstrap = source.match(/const bootstrap = String\.raw`([\s\S]*?)`;\r?\n\r?\ndescribe\(/)?.[1];
if (!bootstrap) throw new Error('Missing existing V2 database fixture');
const portfolioFixture = read('test/project-work-portfolio-rollout-migration.test.ts');
const compatibility = portfolioFixture.match(/await database\.exec\(`\r?\n(\s+alter table public\.projects[\s\S]*?)`\);/)?.[1];
if (!compatibility) throw new Error('Missing portfolio compatibility fixture');
const admin = '11111111-1111-4111-8111-111111111111';
const contact = '22222222-2222-4222-8222-222222222222';
const project = '40000000-0000-4000-8000-000000000001';
const lead = '40000000-0000-4000-8000-000000000002';

describe('deferral of unused project follow-ups', () => {
  const db = new PGlite();
  beforeAll(async () => {
    await db.waitReady;
    await db.exec(bootstrap);
    await db.exec(read('supabase/migrations/20260729_000002_project_work_items_v2.sql'));
    await db.exec(read('supabase/migrations/20260729_000003_project_work_items_v2_schema_cache.sql'));
    await db.exec(compatibility);
    await db.exec(read('supabase/migrations/20260729_000004_project_work_queue_and_legacy_triage.sql'));
    await db.exec(`
      insert into auth.users(id,email) values ('${admin}','admin@example.invalid');
      insert into public.portal_users(user_id,role) values ('${admin}','admin');
      select set_config('request.jwt.claim.sub','${admin}',false);
      insert into public.contacts(id,name,email) values ('${contact}','Fixture','fixture@example.invalid');
      insert into public.projects(id,contact_id,name,pipeline_stage,region)
      values ('${project}','${contact}','Review retirement fixture','QUOTING','Auckland'),
             ('${lead}','${contact}','Preserved lead fixture','NEW','Auckland');
    `);
    await db.exec(read('supabase/migrations/20260731000002_project_work_portfolio_rollout.sql'));
    await db.exec(`
      select set_config('sanctuary.project_work_command','allowed',false);
      insert into public.project_work_items(project_id,title,responsibility_area,due_at,origin,source_type,source_key,series_key,subject_kind,subject_id)
      values ('${project}','Confirm measurements','DESIGN',now()+interval '1 day','MANUAL','MANUAL',null,null,null,null),
             ('${project}','Follow up on sent quote','COMMERCIAL',now()+interval '2 days','AUTOMATION','QUOTE_CADENCE','quote:follow-up:retirement-fixture','quote:fixture','QUOTE_VERSION','50000000-0000-4000-8000-000000000001');
      select set_config('sanctuary.project_work_command','',false);
    `);
  }, 30_000);
  afterAll(async () => { await db.close(); });


  it('retires active cadence with audit, preserves manual work and replays safely', async () => {
    await db.exec(read('supabase/migrations/20260916000006_retire_generic_stage_reviews.sql'));
    await db.exec("insert into public.quotes(id,project_id) values ('50000000-0000-4000-8000-000000000010','40000000-0000-4000-8000-000000000001'); insert into public.quote_versions(id,quote_id,version_number,status) values ('50000000-0000-4000-8000-000000000011','50000000-0000-4000-8000-000000000010',1,'SENT'); select public.project_work_quote_repair_signal_command('40000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000010','QUOTE_SENT','50000000-0000-4000-8000-000000000011','OPEN','FIXTURE','Fixture repair')");
    await db.exec(`
      select set_config('sanctuary.project_work_command','allowed',false);
      insert into public.project_confirmation_events(id,project_id,command_id,event_kind,confirmation_type,occurred_at,recorded_by)
      values ('70000000-0000-4000-8000-000000000001','${lead}','70000000-0000-4000-8000-000000000002','CONFIRMED','SITE_VISIT_COMPLETED',now(),'${admin}');
      select set_config('sanctuary.project_work_command','',false);
      select public.project_confirmation_retraction_command('${lead}','70000000-0000-4000-8000-000000000003','70000000-0000-4000-8000-000000000001','Fixture correction');
    `);
    const corrections = await db.query("select * from public.project_work_repair_signals where repair_kind='CONFIRMATION_RETRACTION_REVIEW' order by id");
    const confirmationHistory = await db.query("select * from public.project_confirmation_events order by id");
    const manual = await db.query("select * from public.project_work_items where source_type='MANUAL' order by id");
    const cadence = await db.query("select id from public.project_work_items where source_type in ('LEAD_CADENCE','QUOTE_CADENCE') and status in ('OPEN','BLOCKED')");
    expect(cadence.rows.length).toBeGreaterThan(0);
    await db.exec(migration);
    expect((await db.query("select * from public.project_work_repair_signals where repair_kind='CONFIRMATION_RETRACTION_REVIEW' order by id")).rows).toEqual(corrections.rows);
    expect((await db.query("select * from public.project_confirmation_events order by id")).rows).toEqual(confirmationHistory.rows);
    expect((await db.query("select status from public.project_work_repair_signals where repair_kind='QUOTE_CADENCE_RECONCILIATION'")).rows).toEqual([{ status: 'RESOLVED' }]);
    expect((await db.query("select * from public.project_command_receipts where command_type='MIGRATION_DEFER_QUOTE_FOLLOW_UP'")).rows).toHaveLength(1);
    await expect(db.exec("select public.project_work_quote_repair_signal_command('40000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000012','QUOTE_SENT','50000000-0000-4000-8000-000000000011','OPEN','FIXTURE','Fixture repair')")).rejects.toThrow('FOLLOW_UP_WORKFLOW_DEFERRED');

    expect((await db.query("select id from public.project_work_items where source_type in ('LEAD_CADENCE','QUOTE_CADENCE') and status in ('OPEN','BLOCKED')")).rows).toEqual([]);
    expect((await db.query("select * from public.project_work_items where source_type='MANUAL' order by id")).rows).toEqual(manual.rows);
    const events = await db.query("select * from public.project_work_item_events where reason like 'Unused email follow-up%' order by id");
    expect(events.rows.length).toBe(cadence.rows.length);
    await db.exec(migration);
    expect((await db.query("select * from public.project_work_item_events where reason like 'Unused email follow-up%' order by id")).rows).toEqual(events.rows);
  });
  it('initializes new projects without fabricated email work and preserves reconciliation receipts', async () => {
    await db.exec("insert into public.projects(id,contact_id,name,pipeline_stage,region) values ('40000000-0000-4000-8000-000000000009','22222222-2222-4222-8222-222222222222','New fixture','NEW','Auckland')");
    expect((await db.query("select * from public.project_work_items where project_id='40000000-0000-4000-8000-000000000009'")).rows).toEqual([]);
    await db.exec("select public.project_work_item_reconcile('40000000-0000-4000-8000-000000000009','60000000-0000-4000-8000-000000000001','RECONCILE_PROJECT','{}')");
    const again = await db.query("select public.project_work_item_reconcile('40000000-0000-4000-8000-000000000009','60000000-0000-4000-8000-000000000001','RECONCILE_PROJECT','{}') as result");
    expect((again.rows[0] as { result: { replayed: boolean } }).result.replayed).toBe(true);
    expect((await db.query("select * from public.project_work_items where project_id='40000000-0000-4000-8000-000000000009'")).rows).toEqual([]);
  });
  it('queues genuine manual work without inventing triage for empty projects', async () => {
    const queue = await db.query("select project_id, action_kind, source_type from public.project_work_queue_v3(now(),5000)");
    expect(queue.rows).toEqual([{project_id: lead, action_kind: 'REPAIR', source_type: null}, {project_id: project, action_kind: 'WORK_ITEM', source_type: 'MANUAL'}]);
    const grants = await db.query("select has_function_privilege('authenticated','public.project_work_queue_v3(timestamptz,integer)','EXECUTE') as staff, has_function_privilege('anon','public.project_work_queue_v3(timestamptz,integer)','EXECUTE') as anonymous, has_function_privilege('service_role','public.project_work_queue_v3(timestamptz,integer)','EXECUTE') as service");
    expect(grants.rows).toEqual([{staff:true, anonymous:false, service:false}]);
  });
  it.each(['FIRST_ENQUIRY_EMAIL_SENT','ENQUIRY_FOLLOW_UP_EMAIL_SENT','ENQUIRY_CUSTOMER_REPLY_RECEIVED','QUOTE_FOLLOW_UP_EMAIL_SENT','QUOTE_CUSTOMER_REPLY_RECEIVED'])('rejects historical callers recording %s', async (type) => {
    await expect(db.query(`insert into public.project_confirmation_events(project_id,command_id,event_kind,confirmation_type,occurred_at) values ($1,gen_random_uuid(),'CONFIRMED',$2,now())`, [lead,type])).rejects.toThrow('FOLLOW_UP_WORKFLOW_DEFERRED');
  });
  it.each(['QUOTE_SENT','QUOTE_RESENT','QUOTE_OUTCOME'])('preserves quote binding and replay for %s without creating work', async (event) => {
    const payload = {quote_version_id:'50000000-0000-4000-8000-000000000011'};
    const before = (await db.query("select * from public.quote_versions order by id")).rows;
    const command = (await db.query<{id:string}>('select gen_random_uuid() as id')).rows[0].id;
    const result = await db.query<{result:{replayed:boolean}}>('select public.project_work_item_reconcile($1,$2,$3,$4::jsonb) as result',[project,command,event,JSON.stringify(payload)]);
    expect(result.rows[0].result.replayed).toBe(false);
    const replay = await db.query<{result:{replayed:boolean}}>('select public.project_work_item_reconcile($1,$2,$3,$4::jsonb) as result',[project,command,event,JSON.stringify(payload)]);
    expect(replay.rows[0].result.replayed).toBe(true);
    await expect(db.query('select public.project_work_item_reconcile($1,gen_random_uuid(),$2,$3::jsonb)',[lead,event,JSON.stringify(payload)])).rejects.toThrow('QUOTE_VERSION_NOT_FOUND');
    await expect(db.query("select public.project_work_item_reconcile($1,gen_random_uuid(),$2,'{}'::jsonb)",[project,event])).rejects.toThrow('quote_version_id is required');
    expect((await db.query("select * from public.quote_versions order by id")).rows).toEqual(before);
    expect((await db.query("select id from public.project_work_items where source_type='QUOTE_CADENCE' and status in ('OPEN','BLOCKED')")).rows).toEqual([]);
  });
  it('rejects reopening retired work and stale sent/reply commands', async () => {
    await expect(db.exec("select set_config('sanctuary.project_work_command','allowed',false); update public.project_work_items set status='OPEN' where source_type='LEAD_CADENCE'")).rejects.toThrow('RETIRED_PROJECT_WORK');
    await expect(db.exec("select public.project_confirmation_command('40000000-0000-4000-8000-000000000002','60000000-0000-4000-8000-000000000002','RECORD_FIRST_ENQUIRY_EMAIL_SENT','{}')")).rejects.toThrow('FOLLOW_UP_WORKFLOW_DEFERRED');
  });
});
