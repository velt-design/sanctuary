// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, afterAll, expect, it } from 'vitest';
import { reportSchema, summarize, filteredRows, validPeriod, aucklandDay, UNKNOWN_SOURCE } from '../apps/portal/lib/marketingPerformance/contract';

const db = new PGlite();
const id = (n: number) => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;
const sql = (name: string) => readFileSync(`supabase/migrations/${name}.sql`, 'utf8');
const read = async (start = '2026-09-01', end = '2026-09-22') => {
  const result = await db.query<{ value: unknown }>('select public.marketing_performance_read($1,$2) value', [start, end]);
  return reportSchema.parse(result.rows[0].value);
};
beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated; create schema auth; create schema private;
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql as $$ select '{}'::jsonb $$;
    create function public.has_portal_access() returns boolean language sql as $$ select current_setting('test.staff',true)='yes' $$;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create table public.projects(id uuid primary key,name text);
    create table public.enquiry_requests(id uuid primary key,project_id uuid,created_at timestamptz,raw_payload jsonb,utm jsonb);
    create table private.marketing_enquiry_deliveries(enquiry_request_id uuid primary key,draft_estimate jsonb);
    create table public.site_visit_events(project_id uuid,status text,confirmed_at timestamptz);
    create table public.quotes(id uuid primary key,project_id uuid);
    create table public.quote_versions(id uuid primary key,quote_id uuid,version_number integer,status text,sent_at timestamptz,accepted_at timestamptz,created_at timestamptz,total_inc_gst_cents integer);
    create table public.xero_deposit_matches(project_id uuid,reversed_at timestamptz,amount_inc_gst_cents integer);
    create table public.deposit_invoices(project_id uuid,quote_version_id uuid,status text,payment_term_position integer,total_inc_gst_cents integer);
    create table public.project_operational_states(project_id uuid,state text,closed_outcome text);
  `);
  await db.exec(sql('20260917000003_configured_enquiry_qualification'));
  await db.exec(sql('20260917000004_enquiry_qualification_reassignment'));
  // Execute the exact commercial acceptance owner, including lifecycle tombstones.
  await db.exec(sql('20260813000003_commercial_truth_invariants').split('create or replace function public.commercial_project_financial_truth')[0]);
  await db.exec(sql('20260922000002_marketing_performance_read'));
  await db.exec(sql('20260922000003_marketing_performance_developer_access'));
  await db.query('insert into auth.users values ($1,$2,now()),($3,$4,now()),($5,$2,null)',
    [id(90),'jordan@sanctuarypergolas.co.nz',id(93),'other@example.test',id(94)]);
  const payload = { requestType: 'project-discussion', customerBrief: { version: 1, audience: 'residential', design: { input: {}, roof: {} } },
    attribution: { consent: { marketing: true }, utm: { utm_source: 'google', utm_campaign: 'Spring' } } };
  await db.query('insert into projects values ($1,$2),($3,$4)', [id(1),'Synthetic first project',id(2),'Synthetic second project']);
  await db.query('insert into enquiry_requests values ($1,$2,$3,$4,$5),($6,$2,$7,$8,$5),($9,$10,$11,$12,$5)',
    [id(11),id(1),'2026-08-31T12:00:00Z',JSON.stringify(payload),'{}',id(12),'2026-09-05T00:00:00Z',JSON.stringify({ attribution: { consent: { marketing: true }, utm: { utm_source: 'meta' } } }), id(13),id(2),'2026-09-02T00:00:00Z','{}']);
  await db.query('insert into site_visit_events values ($1,$2,$3)',[id(1),'CONFIRMED','2026-09-10T00:00:00Z']);
  await db.query('insert into quotes values ($1,$2)',[id(21),id(1)]);
  await db.query('insert into quote_versions values ($1,$2,1,$3,$4,$4,$4,100000)',[id(31),id(21),'ACCEPTED','2026-09-20T00:00:00Z']);
  await db.query('insert into xero_deposit_matches values ($1,null,20000)',[id(1)]);
  await db.query('insert into project_operational_states values ($1,$2,$3)',[id(2),'CLOSED','LOST_NO_RESPONSE']);
}, 30000);
afterAll(async () => { await db.close(); });
it('rejects anonymous/nonstaff RPC reads and hides raw tables from staff', async () => {
  await expect(read()).rejects.toThrow('Staff access');
  await db.exec(`set test.uid='${id(90)}'; set test.staff='no'`);
  await expect(read()).rejects.toThrow('Staff access');
  await db.exec("set test.staff='yes'; set role authenticated");
  await expect(db.query('select * from public.xero_deposit_matches')).rejects.toThrow('permission denied');
  await db.exec(`set test.uid='${id(93)}'`);
  await expect(read()).rejects.toThrow('Developer access');
  await db.exec(`set test.uid='${id(94)}'`);
  await expect(read()).rejects.toThrow('Developer access');
  await db.exec(`set test.uid='${id(90)}'`);
  expect((await read()).rows).toHaveLength(3);
});
it('reconciles enquiries, origin projects and observed sources without double-crediting repeats', async () => {
  const report = await read();
  expect(summarize(report.rows)).toMatchObject({ enquiries: 3, projects: 2, origins: 2, repeats: 1, attributed: 2, visit: 1, quote: 1, accepted: 1, won: 1, lost: 1 });
  expect(summarize(filteredRows(report,{ start: report.start,end:report.end,source:'meta',campaign:'' }))).toMatchObject({ enquiries:1,origins:0,won:0 });
  expect(filteredRows(report,{ start:report.start,end:report.end,source:UNKNOWN_SOURCE,campaign:'' })).toHaveLength(1);
  expect(JSON.stringify(report)).not.toMatch(/raw_payload|customerBrief|clickIds|actorId|contact|email|reason|criteria"/);
});
it('uses Auckland inclusive days and keeps project credit outside a repeat-only period', async () => {
  expect((await read('2026-08-31','2026-08-31')).rows).toHaveLength(0);
  expect((await read('2026-09-01','2026-09-01')).rows).toHaveLength(1);
  expect(summarize((await read('2026-09-05','2026-09-05')).rows)).toMatchObject({ enquiries:1,repeats:1,origins:0,won:0 });
  expect(aucklandDay(new Date('2026-09-27T11:00:00Z'))).toBe('2026-09-28');
  expect(validPeriod('2026-02-30','2026-03-01')).toBe(false);
  expect(validPeriod('2026-09-22','2026-09-01')).toBe(false);
  await expect(read('2025-01-01','2026-09-01')).rejects.toThrow('366 days');
});
it('uses actual qualification contract and subsequent corrections', async () => {
  const criteria = JSON.stringify({ location:true,project:true,contactAndConfiguration:true,intent:true });
  await db.query('select enquiry_qualification_record($1,$2,$3,0,$4,$5,$6)',[id(1),id(11),id(91),'qualified',criteria,'']);
  expect(summarize((await read()).rows)).toMatchObject({ qualified:1,eligible:1 });
  await db.query('select enquiry_qualification_record($1,$2,$3,1,$4,$5,$6)',[id(1),id(11),id(92),'unreviewed',criteria,'Rechecking customer intent']);
  expect(summarize((await read()).rows)).toMatchObject({ qualified:0,unreviewed:1 });
});
it('does not resurrect withdrawn acceptance or count reversed verified payments', async () => {
  await db.exec('reset role');
  await db.query('update quote_versions set status=$1 where id=$2',['WITHDRAWN',id(31)]);
  await db.query('update xero_deposit_matches set reversed_at=$1',['2026-09-21T00:00:00Z']);
  await db.exec('set role authenticated');
  expect(summarize((await read()).rows)).toMatchObject({ quote:1,accepted:0,won:0 });
});
it('counts paid first instalment only on current accepted scope', async () => {
  await db.exec('reset role');
  await db.query('insert into deposit_invoices values ($1,$2,$3,1,50000)',[id(1),id(31),'PAID']);
  expect(summarize((await read()).rows).won).toBe(0);
  await db.query('update quote_versions set status=$1 where id=$2',['ACCEPTED',id(31)]);
  expect(summarize((await read()).rows).won).toBe(1);
  await db.query('update deposit_invoices set status=$1',['OPEN']);
  expect(summarize((await read()).rows).won).toBe(0);
});
it('excludes only the known labelled test and retains missing projects and consent gaps', async () => {
  await db.query('insert into enquiry_requests values ($1,null,$2,$3,$4),($5,null,$2,$3,$4)',
    ['f3229ccf-6a1a-4e1a-bcf4-2edf5cc85e70','2026-09-03T00:00:00Z',JSON.stringify({attribution:{consent:{marketing:false},utm:{utm_source:'not-permitted'}}}),JSON.stringify({utm_source:'not-permitted'}),id(14)]);
  const report = await read();
  expect(report.excludedTests).toBe(1);
  expect(report.rows.find(row => row.enquiryId === id(14))).toMatchObject({ projectId:null,qualification:'unavailable',source:null,origin:false });
  expect(summarize(report.rows).unlinked).toBe(1);
});
it('fails closed above the read bound instead of displaying truncated totals', async () => {
  await db.exec(`insert into enquiry_requests select gen_random_uuid(),null,'2026-09-01'::timestamptz,'{}'::jsonb,'{}'::jsonb from generate_series(1,2001)`);
  await expect(read()).rejects.toThrow('shorter period');
});
