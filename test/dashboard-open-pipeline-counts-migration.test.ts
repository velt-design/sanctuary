// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Execute the committed LF migration payload on Windows checkouts too. The old
// stored function is deliberately CRLF below to retain the regression scenario.
const migration = readFileSync('supabase/migrations/20260923030001_dashboard_open_pipeline_counts.sql', 'utf8').replace(/\r\n/g, '\n');
const indexMigration = readFileSync('supabase/migrations/20260731000003_project_pipeline_accountability_reads.sql', 'utf8');
const signature = 'public.staff_projects_index_v3(text,text,text,text,date,integer,integer,text,text,text[],text)';
const db = new PGlite();
type IndexResult = { rows: { id: string; effective_state: string; pipeline_stage: string }[]; totalCount: number };
async function index(state: string, stages: string[], page = 1, archive = 'active') {
  const result = await db.query<{ result: IndexResult }>(
    'select public.staff_projects_index_v3(p_state => $1, p_stages => $2, p_page => $3, p_page_size => 10, p_archive => $4) result',
    [state, stages, page, archive],
  );
  return result.rows[0].result;
}
async function counts() {
  return (await db.query<{ result: { scope: string; counts: Record<string, number> } }>(
    'select public.staff_dashboard_pipeline_counts_v1() result',
  )).rows[0].result;
}

describe('open opportunity dashboard and bounded index', () => {
  beforeAll(async () => {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema extensions;
      create function public.has_portal_access() returns boolean language sql stable as $$
        select coalesce(current_setting('test.portal_access', true), 'yes') = 'yes'
      $$;
      create table public.contacts(id uuid primary key, name text, email text, phone text, created_at timestamptz, updated_at timestamptz, portal_search_document text);
      create table public.projects(id uuid primary key, contact_id uuid, name text, pipeline_stage text, archived_at timestamptz,
        quote_ref text, region text, site_address text, follow_up_date date, notes text, created_at timestamptz default now(), updated_at timestamptz default now(),
        deposit_amount_cents bigint, deposit_paid_date date, final_payment_date date, portal_search_document text);
      create table public.project_work_model_versions(project_id uuid primary key, model_version integer);
      create table public.project_operational_states(project_id uuid primary key, state text, waiting_until timestamptz, waiting_reason text, closed_outcome text);
      create table public.project_owner_assignments(project_id uuid primary key, owner_key text);
      insert into public.projects(id,name,pipeline_stage,archived_at)
      select md5(stage || state || n)::uuid, 'Synthetic ' || stage || state || n, stage,
        case when state='ARCHIVED' then now() end
      from unnest(array['NEW','CONTACTED','SITE_VISIT','QUOTING','SENT','DEPOSIT','SCHEDULED','COMPLETED','PAID']) stage
      cross join unnest(array['ACTIVE','WAITING','CLOSED','ARCHIVED']) state cross join generate_series(1,6) n;
      insert into public.project_operational_states(project_id,state)
      select md5(stage || state || n)::uuid, case when state='ARCHIVED' then 'ACTIVE' else state end
      from unnest(array['NEW','CONTACTED','SITE_VISIT','QUOTING','SENT','DEPOSIT','SCHEDULED','COMPLETED','PAID']) stage
      cross join unnest(array['ACTIVE','WAITING','CLOSED','ARCHIVED']) state cross join generate_series(1,6) n;
      insert into public.project_work_model_versions select id,2 from public.projects;
    `);
    // Exercise the stored Windows CRLF definition as well as the actual old RPC.
    await db.exec(indexMigration.replace(/\r?\n/g, '\r\n'));
    await db.exec(migration);
  }, 30_000);
  afterAll(async () => { await db.close(); });

  it('counts all open early stages and retains closed later journeys without archived rows', async () => {
    const result = await counts();
    expect(result.scope).toBe('open_enquiry_proposal_v1');
    expect(result.counts).toEqual({ NEW: 12, CONTACTED: 12, SITE_VISIT: 12, QUOTING: 12, SENT: 12, DEPOSIT: 18, SCHEDULED: 18, COMPLETED: 18, PAID: 18 });
  });

  it.each([['NEW', 'CONTACTED'], ['SITE_VISIT', 'QUOTING', 'SENT']])('matches every OPEN page to the exact displayed journey population (%s)', async (...stages) => {
    const expected = stages.reduce((sum, stage) => sum + 12, 0);
    const rows: IndexResult['rows'] = [];
    for (let page = 1; page <= Math.ceil(expected / 10); page++) {
      const result = await index('OPEN', stages, page);
      expect(result.totalCount).toBe(expected);
      rows.push(...result.rows);
    }
    expect(new Set(rows.map((row) => row.id)).size).toBe(expected);
    expect(rows.every((row) => ['ACTIVE', 'WAITING'].includes(row.effective_state))).toBe(true);
    const direct = await db.query<{ id: string }>('select p.id from projects p join project_operational_states s on s.project_id=p.id where p.archived_at is null and s.state in (\'ACTIVE\',\'WAITING\') and p.pipeline_stage=any($1)', [stages]);
    expect(rows.map((row) => row.id).sort()).toEqual(direct.rows.map((row) => row.id).sort());
  });

  it('retains separate closed/archive access and all-state later journey drilldowns', async () => {
    expect((await index('CLOSED', ['NEW', 'CONTACTED'])).totalCount).toBe(12);
    expect((await index('ARCHIVED', ['NEW', 'CONTACTED'], 1, 'archived')).totalCount).toBe(12);
    expect((await index('all', ['PAID'])).totalCount).toBe(18);
    expect((await index('OPEN', ['NEW'], 1, 'all')).totalCount).toBe(12);
  });

  it('preserves index invoker/ACL and refuses unauthorized aggregate reads', async () => {
    const result = await db.query<{ prosecdef: boolean; allowed: boolean; anonymous: boolean }>(`select prosecdef,has_function_privilege('authenticated',oid,'execute') allowed,has_function_privilege('anon',oid,'execute') anonymous from pg_proc where oid=$1::regprocedure`, [signature]);
    expect(result.rows[0]).toEqual({ prosecdef: false, allowed: true, anonymous: false });
    await db.exec("set test.portal_access='no'");
    await expect(counts()).rejects.toThrow('PORTAL_ACCESS_REQUIRED');
    expect((await index('OPEN', ['NEW'])).totalCount).toBe(0);
    await db.exec("set test.portal_access='yes'");
  });

  it('fails closed on incomplete state/model and refuses repeated source patching', async () => {
    await db.exec('begin; delete from project_work_model_versions where project_id=(select id from projects limit 1)');
    await expect(counts()).rejects.toThrow('PROJECT_WORK_ROLLOUT_INCOMPLETE');
    await db.exec('rollback');
    await expect(db.exec(migration)).rejects.toThrow('OPEN_PIPELINE_INDEX_CONTRACT_MISMATCH');
    expect((await counts()).counts.NEW).toBe(12);
  });
});
