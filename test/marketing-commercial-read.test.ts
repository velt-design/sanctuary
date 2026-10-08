// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, afterAll, expect, it } from 'vitest';
import { commercialSchema, contributions, metricValue, commercialTrend } from '../apps/portal/lib/marketingPerformance/commercial';

const db = new PGlite(), id = (n: number) => `44444444-4444-4444-8444-${String(n).padStart(12, '0')}`;
const read = async (start = '2026-09-01', end = '2026-09-30') => commercialSchema.parse((await db.query<{ value: unknown }>('select marketing_commercial_performance_read($1,$2) value', [start, end])).rows[0].value);
beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
    create function public.has_portal_access() returns boolean language sql as $$ select current_setting('test.staff',true)='yes' $$;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create table projects(id uuid primary key);
    create table quotes(id uuid primary key,project_id uuid,quote_ref text,commercial_scope_id uuid);
    create table quote_versions(id uuid primary key,quote_id uuid,version_number integer,status text,created_at timestamptz,sent_at timestamptz,accepted_at timestamptz,total_inc_gst_cents integer);
    create table enquiry_requests(id uuid primary key,project_id uuid,created_at timestamptz);
    insert into auth.users values ('${id(90)}','jordan@sanctuarypergolas.co.nz',now()),('${id(91)}','other@example.test',now()),('${id(92)}','jordan@sanctuarypergolas.co.nz',null);
    insert into projects values ('${id(1)}'),('${id(2)}'),('${id(3)}');
    insert into quotes values ('${id(11)}','${id(1)}','DEMO-1',null),('${id(12)}','${id(1)}','DEMO-ADDON','${id(100)}'),('${id(13)}','${id(2)}','DEMO-RETIRED',null),('${id(14)}','${id(3)}','DEMO-UNDATED',null);
    insert into enquiry_requests values ('${id(40)}','${id(1)}','2026-08-01'),('${id(41)}','${id(1)}','2026-09-15');
    insert into quote_versions values
      ('${id(21)}','${id(11)}',1,'SUPERSEDED','2026-08-10','2026-08-10',null,1000000),
      ('${id(22)}','${id(11)}',2,'SUPERSEDED','2026-09-02','2026-09-02',null,1100000),
      ('${id(23)}','${id(11)}',3,'ACCEPTED','2026-09-20','2026-09-20','2026-09-21',1200000),
      ('${id(24)}','${id(12)}',1,'ACCEPTED','2026-09-22','2026-09-22','2026-09-23',200000),
      ('${id(25)}','${id(13)}',1,'ACCEPTED','2026-08-15','2026-08-15','2026-09-05',500000),
      ('${id(26)}','${id(13)}',2,'WITHDRAWN','2026-09-07','2026-09-07','2026-09-08',600000),
      ('${id(27)}','${id(14)}',1,'ACCEPTED','2026-09-09',null,null,400000);
  `);
  await db.exec(readFileSync('supabase/migrations/20260813000003_commercial_truth_invariants.sql', 'utf8').split('create or replace function public.commercial_project_financial_truth')[0]);
  await db.exec(readFileSync('supabase/migrations/20261008000002_marketing_commercial_performance.sql', 'utf8'));
  await db.exec(readFileSync('supabase/migrations/20261008000003_marketing_commercial_send_coverage.sql', 'utf8'));
}, 30000);
afterAll(async () => db.close());
it('requires staff and confirmed exact developer identity, with private table/helper access', async () => {
  await expect(read()).rejects.toThrow('Staff access');
  await db.exec(`set test.uid='${id(90)}'; set test.staff='no'; set role authenticated`);
  await expect(read()).rejects.toThrow('Staff access');
  await db.exec(`set test.staff='yes'; set test.uid='${id(91)}'`); await expect(read()).rejects.toThrow('Developer access');
  await db.exec(`set test.uid='${id(92)}'`); await expect(read()).rejects.toThrow('Developer access');
  await db.exec(`set test.uid='${id(90)}'`);
  expect((await read()).rows).toHaveLength(4);
  await expect(db.query('select * from quote_versions')).rejects.toThrow('permission denied');
  await db.exec('set role anon'); await expect(read()).rejects.toThrow('permission denied'); await db.exec('set role authenticated');
});
it('counts sent revisions once per family, retains add-ons, excludes withdrawn acceptance and undated acceptance from periods', async () => {
  const report = await read(), current = contributions(report, report.rows), prior = contributions(report, report.rows, true);
  expect(current.quoted.map(r => r.row.quoteRef)).toEqual(['DEMO-1', 'DEMO-ADDON', 'DEMO-RETIRED']);
  expect(metricValue('quoted', current.quoted)).toBe(2000000);
  expect(metricValue('accepted', current.accepted)).toBe(1400000);
  expect(metricValue('average', current.average)).toBe(700000);
  expect(current.accepted).toHaveLength(2);
  expect(report.rows.find(r => r.quoteId === id(13))?.accepted).toBeNull();
  expect(report.rows.filter(r => r.accepted && !r.accepted.acceptedAt)).toHaveLength(1);
  expect(metricValue('quoted', prior.quoted)).toBe(1500000);
  expect(commercialTrend(report, current).reduce((n, m) => n + m.quoted!, 0)).toBe(2000000);
  expect(current.enquiryDays).toHaveLength(0); // both base families were first sent before September
  expect(current.acceptanceDays).toHaveLength(1); // excludes add-on and withdrawn family
  expect(metricValue('acceptanceDays', current.acceptanceDays)).toBe(42);
  expect(JSON.stringify(report)).not.toMatch(/customer|email|token|raw_payload|pricing_source/);
});
it('honours Auckland boundaries, rejects oversize periods and changes acceptance when the canonical owner withdraws it', async () => {
  await expect(read('2025-01-01', '2026-09-30')).rejects.toThrow('366 days');
  await db.exec('reset role; begin');
  await db.query('update quote_versions set sent_at=$1 where id=$2', ['2026-08-31T12:00:00Z', id(22)]);
  expect((await read('2026-09-01', '2026-09-01')).rows.find(r => r.quoteId === id(11))?.currentSent?.versionNumber).toBe(2);
  await db.query('update quote_versions set status=$1 where id=$2', ['WITHDRAWN', id(23)]);
  expect(contributions(await read(), (await read()).rows).accepted).toHaveLength(1);
  await db.exec('rollback');
});
it('never changes source records and refuses a truncated quote inventory', async () => {
  await db.exec('reset role');
  const before = (await db.query('select * from quote_versions order by id')).rows;
  await read(); expect((await db.query('select * from quote_versions order by id')).rows).toEqual(before);
  await db.exec('begin');
  await db.exec(`insert into quotes select gen_random_uuid(),'${id(1)}','DEMO-BOUND',null from generate_series(1,5000)`);
  await expect(read()).rejects.toThrow('bound exceeded'); await db.exec('rollback');
});

it('retains known undated send evidence, excludes drafts and never infers first-send timing from a later revision', async () => {
 await db.exec('reset role; begin');
 await db.exec(`insert into quotes values ('${id(15)}','${id(2)}','DEMO-SENT-NO-DATE',null),('${id(16)}','${id(2)}','DEMO-DRAFT',null);
 insert into quote_versions values ('${id(28)}','${id(15)}',1,'SENT','2026-09-01',null,null,300000),('${id(29)}','${id(16)}',1,'DRAFT','2026-09-01',null,null,300000);
 update quote_versions set sent_at=null where id='${id(21)}';
 update quote_versions set sent_at=null where id='${id(24)}';`);
 const report=await read(),values=contributions(report,report.rows);
 expect(report.rows.find(r=>r.quoteId===id(15))?.undatedSendCount).toBe(1);
 expect(report.rows.find(r=>r.quoteId===id(16))?.undatedSendCount).toBe(0);
 expect(report.rows.find(r=>r.quoteId===id(11))?.undatedSendCount).toBe(0); // superseded without acceptance is not known sent evidence
 await db.exec(`update quote_versions set accepted_at='2026-08-11' where id='${id(21)}'`);
 const updated=await read(),updatedValues=contributions(updated,updated.rows);
 expect(updated.rows.find(r=>r.quoteId===id(11))?.undatedSendCount).toBe(1);
 expect(updatedValues.acceptanceDays[0].days).toBeNull();expect(updatedValues.enquiryDays.find(r=>r.row.quoteId===id(11))?.days).toBeNull();
 expect(report.rows.find(r=>r.quoteId===id(12))?.undatedSendCount).toBe(1);
 expect(metricValue('accepted',values.accepted)).toBe(1400000);expect(metricValue('average',values.average)).toBe(700000);
 expect(metricValue('accepted',updatedValues.accepted)).toBe(1400000);
 await db.exec('rollback');
});
