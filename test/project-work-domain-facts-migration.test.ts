// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(file, 'utf8');
const migration = read('supabase/migrations/20261013000004_project_work_domain_facts.sql');
const source = read('test/project-work-items-v2-migration.test.ts');
const bootstrap = source.match(/const bootstrap = String\.raw`([\s\S]*?)`;\r?\n\r?\ndescribe\(/)?.[1];
const portfolio = read('test/project-work-portfolio-rollout-migration.test.ts');
const compatibility = portfolio.match(/await database\.exec\(`\r?\n(\s+alter table public\.projects[\s\S]*?)`\);/)?.[1];
if (!bootstrap || !compatibility) throw new Error('Existing Project Work database prerequisites not found');
const id = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const actor = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const functionName = 'public.staff_project_work_domain_facts_v1';
const staff = `set role authenticated; set request.jwt.claim.sub='${actor(2)}';`;
const call = (ids: (string | null)[] | null) => `select ${functionName}(${ids === null ? 'null' : `array[${ids.map((value) => value === null ? 'null' : `'${value}'`).join(',')}]::uuid[]`}) as facts`;

describe('Project Work raw-facts migration (minimal source fixture)', () => {
  const db = new PGlite();
  const rows = async (sql: string) => (await db.query<any>(sql)).rows;
  const facts = async (ids: (string | null)[] | null) => (await rows(call(ids)))[0].facts;
  beforeAll(async () => {
    await db.waitReady;
    await db.exec(bootstrap);
    await db.exec(`grant usage on schema auth to authenticated, anon, service_role;
      create function auth.role() returns text language sql stable as $$ select current_user::text $$;`);
    for (const file of ['20260729_000002_project_work_items_v2.sql', '20260729_000003_project_work_items_v2_schema_cache.sql']) {
      await db.exec(read(`supabase/migrations/${file}`));
    }
    await db.exec(compatibility);
    for (const file of ['20260729_000004_project_work_queue_and_legacy_triage.sql', '20260731000002_project_work_portfolio_rollout.sql']) {
      await db.exec(read(`supabase/migrations/${file}`));
    }
    // Selected commercial columns/indexes, not a full application schema.
    await db.exec(read('test/fixtures/project-work-domain-facts-commercial.sql'));
    const security = read('supabase/migrations/20260408_000001_portal_security_hardening.sql');
    await db.exec(security.slice(0, security.indexOf('alter table if exists public.portal_users')));
    await db.exec(read('supabase/migrations/20260722_000004_portal_search_rls_initplan.sql'));
    const owner = read('supabase/migrations/20260721_000001_project_command_single_owner.sql');
    await db.exec(owner.slice(owner.indexOf('alter table public.project_owner_assignments enable'), owner.indexOf('-- Retire the three-role writer')));
    await db.exec(`insert into auth.users(id,email) values
      ('${actor(1)}','admin@example.invalid'),('${actor(2)}','staff@example.invalid'),('${actor(3)}','outside@example.invalid');
      insert into public.portal_users(user_id,role) values ('${actor(1)}','admin'),('${actor(2)}','staff');`);
    await db.exec(read('test/fixtures/project-work-domain-facts-seed.sql'));
    await db.exec(migration.replace(/commit;\s*notify pgrst, 'reload schema';\s*$/i, 'rollback;'));
    expect((await rows(`select to_regprocedure('${functionName}(uuid[])') is null as absent`))[0].absent).toBe(true);
    await db.exec(migration);
    await db.exec(migration);
  }, 30_000);
  afterEach(async () => { await db.exec('rollback; reset role;'); });
  afterAll(async () => { await db.close(); });

  it('is stable, invoker, RLS-on and executable only by authenticated callers', async () => {
    const [attributes] = await rows(`select p.provolatile, p.prosecdef, p.proconfig,
      has_function_privilege('authenticated',p.oid,'execute') as staff,
      has_function_privilege('anon',p.oid,'execute') as anon,
      has_function_privilege('service_role',p.oid,'execute') as service
      from pg_proc p where p.oid='${functionName}(uuid[])'::regprocedure`);
    expect(attributes).toEqual({ provolatile: 's', prosecdef: false,
      proconfig: ['search_path=pg_catalog, public, pg_temp', 'row_security=on'], staff: true, anon: false, service: false });
  });

  it('accounts for every active, waiting, closed and archived identity and complete raw relations', async () => {
    await db.exec(staff);
    expect(await facts([])).toEqual({ version: 1, requestedCount: 0, rows: [] });
    const result = await facts([id(4), id(3), id(2), id(1), id(1)]);
    expect(result.requestedCount).toBe(4);
    expect(result.rows.map((row: any) => row.projectId)).toEqual([id(1), id(2), id(3), id(4)]);
    expect(result.rows[0].counts).toEqual({ estimates: 2, quotes: 1, quoteVersions: 2, sendLogs: 2, confirmations: 2 });
    expect(result.rows[0].confirmations[1].retracts_event_id).toBe(result.rows[0].confirmations[0].id);
    expect(result.rows.slice(1).every((row: any) => !row.eligible && row.project === null && row.confirmations.length === 0)).toBe(true);
  });

  it.each([null, [null], Array(501).fill(id(1))])('rejects invalid input without a partial result: %j', async (ids) => {
    await db.exec(staff);
    await expect(facts(ids)).rejects.toThrow('Expected at most 500');
  });
  it.each([id(5), id(6), id(7)])('denies missing project/model/state through the same generic error: %s', async (missing) => {
    await db.exec(staff);
    await expect(facts([id(1), missing])).rejects.toThrow('PROJECT_WORK_INVENTORY_INCOMPLETE');
  });
  it.each(['anon', 'service_role'])('denies %s execute', async (role) => {
    await db.exec(`set role ${role}`);
    await expect(facts([id(1)])).rejects.toThrow('permission denied');
  });
  it('denies a nonstaff authenticated identity and accepts the existing admin role', async () => {
    await db.exec(`set role authenticated; set request.jwt.claim.sub='${actor(3)}'`);
    await expect(facts([id(1)])).rejects.toThrow('Portal access required');
    await db.exec(`set request.jwt.claim.sub='${actor(1)}'`);
    expect((await facts([id(1)])).rows).toHaveLength(1);
  });
  it('does not bypass a restrictive parent RLS policy or disclose existence', async () => {
    await db.exec(`begin; create policy facts_hide on public.projects as restrictive for select to authenticated using (false); ${staff}`);
    await expect(facts([id(1)])).rejects.toThrow('PROJECT_WORK_INVENTORY_INCOMPLETE');
  });
  it.each([
    ['estimates', 'estimates'], ['quotes', 'quotes'], ['quote_versions', 'quoteVersions'],
    ['quote_send_logs', 'sendLogs'], ['project_confirmation_events', 'confirmations'],
  ])('counts only RLS-visible %s facts', async (table, count) => {
    await db.exec(`begin; create policy facts_hide on public.${table} as restrictive for select to authenticated using (false); ${staff}`);
    expect((await facts([id(1)])).rows[0].counts[count]).toBe(0);
  });
  it('returns 1,001 confirmations and 1,001 send logs, including the last retraction, without API row clipping', async () => {
    await db.exec(`begin; set local session_replication_role=replica;
      insert into public.project_confirmation_events(id,project_id,command_id,event_kind,confirmation_type,occurred_at)
      select ('71000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'${id(1)}',gen_random_uuid(),
        'CONFIRMED','SITE_VISIT_COMPLETED',now() from generate_series(1,999) n;
      insert into public.quote_send_logs(id,project_id,quote_version_id,status,created_at)
      select gen_random_uuid(),'${id(1)}','50000000-0000-4000-8000-000000000001','FAILED',now() from generate_series(1,999);
      set local session_replication_role=origin; ${staff}`);
    const row = (await facts([id(1)])).rows[0];
    expect(row.counts.confirmations).toBe(1001);
    expect(row.confirmations).toHaveLength(1001);
    expect(row.confirmations.some((event: any) => event.event_kind === 'RETRACTED')).toBe(true);
    expect(row.counts.sendLogs).toBe(1001);
    expect(row.project.quotes[0].quoteVersions[0].sendLogs).toHaveLength(1001);
  });
  it('rejects a singleton over its conservative byte budget before relation aggregation', async () => {
    await db.exec(`begin; set local session_replication_role=replica;
      update public.projects set name=repeat('x',700000) where id='${id(1)}';
      set local session_replication_role=origin; ${staff}`);
    await expect(facts([id(1)])).rejects.toThrow('PROJECT_WORK_FACTS_BATCH_TOO_LARGE');
  });
  it('does not charge unused archived metadata against the small inactive envelope', async () => {
    await db.exec(`begin; set local session_replication_role=replica;
      update public.projects set name=repeat('x',700000) where id='${id(4)}';
      set local session_replication_role=origin; ${staff}`);
    expect((await facts([id(4)])).rows[0]).toMatchObject({ eligible: false, project: null, confirmations: [] });
  });
  it('rejects over 50,000 child rows without returning truncated history', async () => {
    await db.exec(`begin; set local session_replication_role=replica;
      insert into public.project_confirmation_events(id,project_id,command_id,event_kind,confirmation_type,occurred_at)
      select gen_random_uuid(),'${id(1)}',gen_random_uuid(),'CONFIRMED','SITE_VISIT_COMPLETED',now()
      from generate_series(1,50001);
      set local session_replication_role=origin; ${staff}`);
    await expect(facts([id(1)])).rejects.toThrow('PROJECT_WORK_FACTS_BATCH_TOO_LARGE');
  });
});
