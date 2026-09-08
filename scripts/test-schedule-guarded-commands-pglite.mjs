import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';

// Disposable PostgreSQL only. Uses the production schema and command bodies.
const database = new PGlite();
const crew = '00000000-0000-4000-8000-000000000001';
const otherCrew = '00000000-0000-4000-8000-000000000002';
const project = '00000000-0000-4000-8000-000000000003';
const job = '00000000-0000-4000-8000-000000000004';
try {
  await database.exec(`
    create role anon; create role authenticated; create role service_role;
    create function public.has_portal_access() returns boolean language sql as 'select true';
    create function public.set_updated_at() returns trigger language plpgsql as $$ begin NEW.updated_at := now(); return NEW; end $$;
    create table public.projects(id uuid primary key);
    create table public.schedule_crews(id uuid primary key, name text not null, color text, sort_order int default 0, is_active boolean default true);
  `);
  const migrations = [
    '20260210_000003_schedule_v2_schema.sql', '20260212_000004_schedule_v2_commitments.sql',
    ...readdirSync(new URL('../supabase/migrations/', import.meta.url)).filter((name) => /^202604(07|14)_.*\.sql$/.test(name)).sort(),
  ];
  for (const name of migrations) {
    const sql = readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8').replace(/create extension if not exists "pgcrypto";/g, '');
    await database.exec(sql);
  }
  const migration = readFileSync(new URL('../supabase/migrations/20260908000001_schedule_guarded_commands.sql', import.meta.url), 'utf8');
  await database.exec('begin;');
  await database.exec(migration);
  await database.exec('rollback;');
  await database.exec(migration);
  await database.exec(migration);
  await database.exec(`
    insert into public.schedule_crews(id,name) values ('${crew}','First'), ('${otherCrew}','Other');
    insert into public.projects(id) values ('${project}');
    insert into public.scheduled_jobs(id,job_id,crew_id,mode,forecast_start,forecast_duration_days,forecast_end_exclusive)
      values ('${job}','${project}','${crew}','pinned','2026-09-21',6,'2026-09-29');
    insert into public.crew_schedule_items(crew_id,item_type,job_id,position) values ('${crew}','job','${job}',0);
  `);
  const revision = async (id = crew) => Number((await database.query('select schedule_revision from public.schedule_crews where id = $1', [id])).rows[0].schedule_revision);
  const dates = async () => (await database.query('select forecast_start::text,forecast_end_exclusive::text,forecast_duration_days from public.scheduled_jobs where id = $1', [job])).rows[0];
  const patch = (start, end, duration) => ({ p_scheduled_job_id: job, p_job_patch: { mode: 'pinned', forecast_start: start }, p_forecast_updates: [{ id: job, forecast_start: start, forecast_end_exclusive: end, forecast_duration_days: duration }] });
  const guardPayload = (guards) => Object.fromEntries(Object.entries(guards).map(([id, revision]) => [id, { revision, anchor_date: '2026-09-21' }]));
  const command = (args, guards) => database.query('select public.schedule_v2_guarded_command($1,$2::jsonb,$3::jsonb)', ['schedule_v2_apply_job_patch', JSON.stringify(args), JSON.stringify(guardPayload(guards))]);
  const baseline = await revision();
  await command(patch('2026-09-28','2026-10-06',6), { [crew]: baseline });
  assert.equal((await database.query('select queue_anchor_date::text from public.schedule_crews where id = $1', [crew])).rows[0].queue_anchor_date, '2026-09-21');
  assert.deepEqual(await dates(), { forecast_start: '2026-09-28', forecast_end_exclusive: '2026-10-06', forecast_duration_days: 6 });
  await assert.rejects(command(patch('2026-09-21','2026-09-29',6), { [crew]: baseline }), { code: 'PT409' });
  assert.equal((await dates()).forecast_start, '2026-09-28', 'stale staff write must not overwrite the accepted dates');
  const current = await revision();
  await assert.rejects(command(patch('2026-09-21','2026-09-29',6), { [otherCrew]: await revision(otherCrew) }), { code: 'PT409' });
  assert.equal(await revision(), current, 'out-of-scope writes and revision increments must roll back together');
  assert.equal((await dates()).forecast_start, '2026-09-28');
  await command(patch('2026-09-21','2026-09-29',6), { [crew]: current });
  assert.equal((await dates()).forecast_start, '2026-09-21', 'fresh deliberate inverse edit must persist');
  const overlapKey = `${crew}|${job}:2026-09-21:2026-09-29|other:2026-09-21:2026-09-23`;
  await database.query('select public.schedule_v2_guarded_command($1,$2::jsonb,$3::jsonb)', ['schedule_v2_keep_overlap', JSON.stringify({ p_scheduled_job_id: job, p_overlap_key: overlapKey }), JSON.stringify(guardPayload({ [crew]: await revision() }))]);
  assert.deepEqual((await database.query('select accepted_overlaps from public.scheduled_jobs where id = $1', [job])).rows[0].accepted_overlaps, [overlapKey]);
  const beforeCalendar = await revision();
  await database.exec("insert into public.company_closures(date,name) values ('2026-10-01','Fixture closure');");
  await assert.rejects(command(patch('2026-09-28','2026-10-06',6), { [crew]: beforeCalendar }), { code: 'PT409' });
  await assert.rejects(command(patch('2026-09-28','2026-10-06',6), {}), { code: 'PT409' });
  await database.exec('set role authenticated;');
  await assert.rejects(command(patch('2026-09-28','2026-10-06',6), { [crew]: current }), { code: '42501' });
  await database.exec('reset role;');
  await database.exec('grant all on all tables in schema public to service_role; set role service_role;');
  await command(patch('2026-09-21','2026-09-29',6), { [crew]: await revision() });
  await database.exec('reset role;');
  const itemId = (await database.query('select id from public.crew_schedule_items where job_id = $1', [job])).rows[0].id;
  await database.query('select public.schedule_v2_guarded_command($1,$2::jsonb,$3::jsonb)', ['schedule_v2_unassign_job', JSON.stringify({ p_scheduled_job_id: job, p_job_item_id: itemId, p_positions: [], p_forecast_updates: [] }), JSON.stringify(guardPayload({ [crew]: await revision() }))]);
  assert.equal((await database.query('select queue_anchor_date from public.schedule_crews where id = $1', [crew])).rows[0].queue_anchor_date, null);
  console.log('schedule-db: migration rollback/replay, persisted forward/inverse dates, stale writer rejection, crew scope rollback and RPC access passed');
} finally {
  await database.close();
}
