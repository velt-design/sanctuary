// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
const db = new PGlite();
const migration = readFileSync('supabase/migrations/20260923040001_project_index_stage_timing.sql', 'utf8');
const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const call = (sort: string, page = 1, order = 'null') => `select public.staff_projects_index_v4(p_sort => '${sort}', p_page => ${page}, p_page_size => 10, p_due_project_ids => ${order}) as result`;
async function report(sql: string) { return (await db.query<{result: { totalCount: number; rows: Array<{id: string; stage_changed_at: string | null}> }}>(sql)).rows[0].result; }

beforeAll(async () => {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema extensions;
    create function public.has_portal_access() returns boolean language sql stable as $$ select coalesce(current_setting('test.portal_access',true),'')='yes' $$;
    select set_config('test.portal_access','yes',false);
    create table public.projects(id uuid primary key, contact_id uuid, name text, quote_ref text, region text, site_address text, pipeline_stage text, follow_up_date date, archived_at timestamptz, notes text, created_at timestamptz default now(), updated_at timestamptz default now(), deposit_amount_cents int, deposit_paid_date date, final_payment_date date, portal_search_document text default '');
    create table public.contacts(id uuid primary key,name text,email text,phone text,created_at timestamptz,updated_at timestamptz,portal_search_document text);
    create table public.project_work_model_versions(project_id uuid,model_version int);
    create table public.project_operational_states(project_id uuid,state text,waiting_until timestamptz,waiting_reason text,closed_outcome text);
    create table public.project_owner_assignments(project_id uuid,owner_key text);
    grant select on all tables in schema public to authenticated;
  `);
  for (let n = 1; n <= 25; n++) await db.exec(`insert into projects(id,name,pipeline_stage) values ('${id(n)}','Project ${n}','SENT'); insert into project_work_model_versions values ('${id(n)}',2); insert into project_operational_states(project_id,state) values ('${id(n)}','ACTIVE');`);
  await db.exec(migration);
}, 30000);
afterAll(async () => { await db.close(); });

describe('Projects timing database contract', () => {
  it('does not backfill history or reset dates for unrelated edits, and prevents supplied-date spoofing', async () => {
    expect((await report(call('stage_oldest'))).rows.every(row => row.stage_changed_at === null)).toBe(true);
    await db.exec('begin');
    try {
      await db.exec(`update projects set name='Renamed',stage_changed_at='2000-01-01' where id='${id(1)}'`);
      expect((await db.query<{stage_changed_at: string|null}>(`select stage_changed_at from projects where id='${id(1)}'`)).rows[0].stage_changed_at).toBeNull();
      await db.exec(`update projects set pipeline_stage='QUOTING' where id='${id(1)}'`);
      const first = (await db.query<{stage_changed_at: string}>(`select stage_changed_at from projects where id='${id(1)}'`)).rows[0].stage_changed_at;
      expect(first).toBeTruthy();
      await db.exec(`update projects set name='Again',stage_changed_at='2000-01-01' where id='${id(1)}'`);
      expect((await db.query<{stage_changed_at: string}>(`select stage_changed_at from projects where id='${id(1)}'`)).rows[0].stage_changed_at).toEqual(first);
      await db.exec(`update projects set pipeline_stage='SENT' where id='${id(1)}'`);
      expect(Date.parse((await db.query<{stage_changed_at: string}>(`select stage_changed_at from projects where id='${id(1)}'`)).rows[0].stage_changed_at)).toBeGreaterThanOrEqual(Date.parse(first));
      await db.exec(`insert into projects(id,name,pipeline_stage,stage_changed_at) values ('${id(99)}','New','NEW','2000-01-01')`);
      expect(Date.parse((await db.query<{stage_changed_at: string}>(`select stage_changed_at from projects where id='${id(99)}'`)).rows[0].stage_changed_at)).toBeGreaterThan(Date.parse('2000-01-02'));
    } finally { await db.exec('rollback'); }
  });
  it('sorts all matching results before paging, with unknowns last and stable ties', async () => {
    await db.exec('begin');
    try {
      // Synthetic history only in this disposable database; never live backfill.
      await db.exec(`alter table projects disable trigger projects_capture_stage_changed_at; update projects set stage_changed_at='2026-09-01' where id='${id(25)}'; alter table projects enable trigger projects_capture_stage_changed_at;`);
      const first = await report(call('stage_oldest'));
      const second = await report(call('stage_oldest',2));
      expect(first.totalCount).toBe(25); expect(first.rows[0].id).toBe(id(25));
      expect(new Set([...first.rows,...second.rows].map(row => row.id)).size).toBe(20);
      const ordered = `array['${id(25)}','${id(22)}']::uuid[]`;
      expect((await report(call('next_action_asc',1,ordered))).rows.slice(0,2).map(row=>row.id)).toEqual([id(25),id(22)]);
      expect((await report(`select public.staff_projects_index_v4(p_status => 'QUOTING') as result`)).totalCount).toBe(0);
    } finally { await db.exec('rollback'); }
  });
  it('preserves the merged open-pipeline filter with both new sorts', async () => {
    await db.exec('begin');
    try {
      await db.exec(`update project_operational_states set state='CLOSED' where project_id='${id(1)}'; update project_operational_states set state='WAITING' where project_id='${id(2)}'; update projects set archived_at=now() where id='${id(3)}'`);
      for (const sort of ['stage_oldest', 'next_action_asc']) {
        const result = await report(`select public.staff_projects_index_v4(p_archive => 'all', p_state => 'OPEN', p_sort => '${sort}', p_page_size => 100) as result`);
        expect(result.totalCount).toBe(23);
        expect(result.rows.map(row => row.id)).toContain(id(2));
        expect(result.rows.map(row => row.id)).not.toContain(id(1));
        expect(result.rows.map(row => row.id)).not.toContain(id(3));
      }
    } finally { await db.exec('rollback'); }
  });
  it('honours all current owner choices instead of silently widening the population', async () => {
    await db.exec('begin');
    try {
      await db.exec(`insert into project_owner_assignments values ('${id(1)}','ellen'),('${id(2)}','dave')`);
      for (const [owner, projectId] of [['ellen', id(1)], ['dave', id(2)]]) {
        const result = await report(`select public.staff_projects_index_v4(p_owner => '${owner}', p_sort => 'stage_oldest') as result`);
        expect(result.totalCount).toBe(1);
        expect(result.rows.map(row => row.id)).toEqual([projectId]);
      }
    } finally { await db.exec('rollback'); }
  });
  it('preserves access denial and completeness failure', async () => {
    await db.exec('begin');
    await db.exec(`set local role authenticated; select set_config('test.portal_access','no',true);`);
    expect((await report(call('stage_oldest'))).totalCount).toBe(0);
    await db.exec('rollback');
    await db.exec('begin; set local role anon');
    await expect(report(call('stage_oldest'))).rejects.toThrow(/permission denied/);
    await db.exec('rollback');
    await db.exec(`begin; delete from project_work_model_versions where project_id='${id(1)}'`);
    await expect(report(call('stage_oldest'))).rejects.toThrow(/ROLLOUT_INCOMPLETE/);
    await db.exec('rollback');
  });
});
