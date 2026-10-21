// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';

const migration = readFileSync('supabase/migrations/20261021010001_portal_performance_measurement.sql', 'utf8');
let db: PGlite;
// PGlite cannot run pg_cron. This fixture verifies the exact job registration
// contract; actual extension/job existence is separately checked before rollout.
const prerequisites = `
  create role authenticated; create role anon;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
  alter default privileges in schema public grant execute on functions to anon;
  create function public.has_portal_access() returns boolean language sql stable as
    $$select current_setting('test.access',true) in ('staff','admin')$$;
  create function public.is_portal_admin() returns boolean language sql stable as
    $$select current_setting('test.access',true) = 'admin'$$;
  create schema cron;
  create table cron.job(jobid bigint generated always as identity,jobname text,schedule text,command text,active boolean default true,database text default current_database(),username text default current_user);
  create function cron.schedule(text,text,text) returns bigint language sql as
    $$insert into cron.job(jobname,schedule,command) values($1,$2,$3) returning jobid$$;
`;
const insert = (route = '/staff/site-visits') => `insert into public.portal_performance_metrics
  (metric_name,metric_value,rating,route_template,navigation_type,device_class)
  values('TTFB',123,'good','${route}','navigate','desktop')`;
const rows = async (sql: string) => (await db.query(sql)).rows;

beforeAll(async () => {
  db = new PGlite(); await db.exec(prerequisites); await db.exec(migration);
}, 30_000);
beforeEach(async () => { await db.exec('reset role; truncate public.portal_performance_metrics;'); });
afterAll(async () => { await db.close(); });

it('installs only the canonical objects, repeats without loss and keeps one exact retention job', async () => {
  await db.exec(insert('/staff/projects'));
  const jobs = await rows('select * from cron.job');
  await db.exec('grant all on public.portal_performance_metrics to anon, authenticated; grant all on sequence public.portal_performance_metrics_id_seq to anon, authenticated;');
  await db.exec(migration);
  expect(await rows('select * from cron.job')).toEqual(jobs);
  expect(jobs).toEqual([expect.objectContaining({ jobname: 'portal-performance-retention-daily', schedule: '17 3 * * *', command: 'select public.purge_portal_performance_metrics();', active: true })]);
  expect(await rows('select count(*)::int as count from public.portal_performance_metrics')).toEqual([{ count: 1 }]);
  expect(await rows("select prosecdef from pg_proc where oid='public.portal_performance_summary(integer)'::regprocedure")).toEqual([{ prosecdef: false }]);
  expect(await rows("select prosecdef from pg_proc where oid='public.purge_portal_performance_metrics()'::regprocedure")).toEqual([{ prosecdef: true }]);
});

it('upgrades the existing route constraint without losing historical metrics or changing the job', async () => {
  await db.exec(insert('/staff/projects'));
  await db.exec(`alter table public.portal_performance_metrics drop constraint portal_performance_metrics_route_template_check;
    alter table public.portal_performance_metrics add constraint portal_performance_metrics_route_template_check
    check(route_template in ('/staff/projects','/staff/schedule'));`);
  const jobs = await rows('select * from cron.job');
  await db.exec(migration);
  await db.exec(insert());
  expect(await rows('select route_template from public.portal_performance_metrics order by id')).toEqual([
    { route_template: '/staff/projects' }, { route_template: '/staff/site-visits' },
  ]);
  expect(await rows('select * from cron.job')).toEqual(jobs);
});

it('retains staff insert, admin-only aggregate read and denies anonymous/no-access writes and purge', async () => {
  await db.exec("set role authenticated; set test.access='staff';");
  await db.exec(insert());
  expect(await rows('select * from public.portal_performance_metrics')).toEqual([]);
  await expect(db.query('select * from public.portal_performance_summary(7)')).rejects.toMatchObject({ code: '42501' });
  await expect(db.query('select public.purge_portal_performance_metrics()')).rejects.toMatchObject({ code: '42501' });
  await expect(db.exec('truncate public.portal_performance_metrics')).rejects.toMatchObject({ code: '42501' });
  await expect(db.exec('delete from public.portal_performance_metrics')).rejects.toMatchObject({ code: '42501' });
  await expect(db.exec('update public.portal_performance_metrics set metric_value=1')).rejects.toMatchObject({ code: '42501' });
  await db.exec("set test.access='admin';");
  await expect(db.exec('truncate public.portal_performance_metrics')).rejects.toMatchObject({ code: '42501' });
  expect(await rows('select * from public.portal_performance_summary(7)')).toEqual([expect.objectContaining({ route_template: '/staff/site-visits', metric_name: 'TTFB', sample_count: 1, p75: 123 })]);
  await expect(db.query('select * from public.portal_performance_summary(3)')).rejects.toMatchObject({ code: '22023' });
  await db.exec("set test.access='none';");
  await expect(db.exec(insert())).rejects.toMatchObject({ code: '42501' });
  await db.exec('reset role; set role anon;');
  await expect(db.exec(insert())).rejects.toMatchObject({ code: '42501' });
  await expect(db.exec('truncate public.portal_performance_metrics')).rejects.toMatchObject({ code: '42501' });
  await expect(db.query("select nextval('public.portal_performance_metrics_id_seq')")).rejects.toMatchObject({ code: '42501' });
  await expect(db.query('select * from public.portal_performance_summary(7)')).rejects.toMatchObject({ code: '42501' });
});

it('accepts the forward route and rejects identifiers, invalid numeric data and unrestricted fields', async () => {
  await db.exec(insert());
  await expect(db.exec(insert('/staff/projects/private-id'))).rejects.toMatchObject({ code: '23514' });
  await expect(db.exec(insert().replace('123', "'NaN'"))).rejects.toMatchObject({ code: '23514' });
  await expect(db.exec(insert().replace('123', '-1'))).rejects.toMatchObject({ code: '23514' });
  await expect(db.exec(insert().replace("'TTFB'", "'user-id'"))).rejects.toMatchObject({ code: '23514' });
});

it('keeps the exact 30-day cutoff and the existing 7/30-day aggregate windows', async () => {
  await db.exec('begin');
  for (const age of ['30 days 1 second', '30 days', '8 days', '1 day']) {
    await db.exec(insert());
    await db.exec(`update public.portal_performance_metrics set captured_at=now()-interval '${age}' where id=(select max(id) from public.portal_performance_metrics)`);
  }
  await db.exec("set local test.access='admin';");
  expect(await rows('select sample_count from public.portal_performance_summary(7)')).toEqual([{ sample_count: 1 }]);
  expect(await rows('select sample_count from public.portal_performance_summary(30)')).toEqual([{ sample_count: 3 }]);
  expect(await rows('select public.purge_portal_performance_metrics() as deleted')).toEqual([{ deleted: 1 }]);
  expect(await rows("select count(*)::int as count from public.portal_performance_metrics where captured_at=now()-interval '30 days'")).toEqual([{ count: 1 }]);
  await db.exec('rollback');
});

it('refuses missing prerequisites or a conflicting retention owner transactionally', async () => {
  await db.exec('begin; drop function public.has_portal_access() cascade;');
  await expect(db.exec(migration)).rejects.toThrow('Existing Portal access helpers and cron scheduler required');
  await db.exec('rollback; begin; update cron.job set schedule=\'0 1 * * *\';');
  await expect(db.exec(migration)).rejects.toThrow('Existing Portal performance retention job requires review');
  await db.exec('rollback');
  expect((await rows('select schedule from cron.job'))[0]).toEqual({ schedule: '17 3 * * *' });
});

it.each(['database', 'username'] as const)('refuses a same-text retention job in another %s', async (column) => {
  await db.exec(`begin; update cron.job set ${column}='different-owner';`);
  await expect(db.exec(migration)).rejects.toThrow('Existing Portal performance retention job requires review');
  await db.exec('rollback');
  expect(await rows('select (database=current_database() and username=current_user) as correct from cron.job')).toEqual([{ correct: true }]);
});
