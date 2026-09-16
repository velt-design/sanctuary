// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const read = (name: string) => readFileSync(name, 'utf8');
const migration = read('supabase/migrations/20260916000005_retire_generic_stage_reviews.sql');
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

describe('retirement of generic stage reviews', () => {
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

  it('cancels existing reviews with history, preserves leads and is replay safe', async () => {
    const before = await db.query("select id,status from public.project_work_items where source_type='STAGE_REVIEW'");
    expect(before.rows.length).toBeGreaterThan(0);
    const leads = await db.query("select * from public.project_work_items where source_type <> 'STAGE_REVIEW' order by id");
    await db.exec(migration);
    expect((await db.query("select status from public.project_work_items where source_type='STAGE_REVIEW'")).rows)
      .toEqual(before.rows.map(() => ({ status: 'CANCELLED' })));
    expect((await db.query("select * from public.project_work_items where source_type <> 'STAGE_REVIEW' order by id")).rows).toEqual(leads.rows);
    const events = await db.query("select * from public.project_work_item_events where reason like 'Generic stage reminder retired%' order by id");
    expect(events.rows.length).toBe(before.rows.length);
    await db.exec(migration);
    expect((await db.query("select * from public.project_work_item_events where reason like 'Generic stage reminder retired%' order by id")).rows).toEqual(events.rows);
  });

  it('does not recreate reminders on stage changes or later imports', async () => {
    await db.exec(`update public.projects set pipeline_stage='SENT' where id='${project}';
      insert into public.projects(id,contact_id,name,pipeline_stage,region)
      values ('40000000-0000-4000-8000-000000000003','${contact}','Later import','DEPOSIT','Auckland');`);
    expect((await db.query("select id from public.project_work_items where source_type='STAGE_REVIEW' and status in ('OPEN','BLOCKED')")).rows).toHaveLength(0);
  });

  it('prevents reopening retired history even through a governed writer', async () => {
    await db.exec("select set_config('sanctuary.project_work_command','allowed',false)");
    await expect(db.exec("update public.project_work_items set status='OPEN' where source_type='STAGE_REVIEW'")).rejects.toThrow(/RETIRED_PROJECT_WORK/);
    await db.exec("select set_config('sanctuary.project_work_command','',false)");
  });

  it('preserves automatic paid closure and reopening rules', async () => {
    await db.exec(`update public.projects set pipeline_stage='PAID' where id='${project}'`);
    expect((await db.query(`select state,closed_outcome from public.project_operational_states where project_id='${project}'`)).rows)
      .toEqual([{ state: 'CLOSED', closed_outcome: 'COMPLETE' }]);
    await db.exec(`update public.projects set pipeline_stage='COMPLETED' where id='${project}'`);
    expect((await db.query(`select state from public.project_operational_states where project_id='${project}'`)).rows).toEqual([{ state: 'ACTIVE' }]);
  });
});
