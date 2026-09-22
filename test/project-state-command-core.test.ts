// @vitest-environment node
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const original = readFileSync('supabase/migrations/20260729_000002_project_work_items_v2.sql', 'utf8').replaceAll('\r\n', '\n');
const migration = readFileSync('supabase/migrations/20260922042401_project_state_command_core.sql', 'utf8').replaceAll('\r\n', '\n');
const rollout = readFileSync('supabase/migrations/20260731000002_project_work_portfolio_rollout.sql', 'utf8').replaceAll('\r\n', '\n');
const grantMigration = readFileSync('supabase/migrations/20260922042402_portal_action_grants.sql', 'utf8');
const deliveryMigration = readFileSync('supabase/migrations/20260911000001_project_delivery_completion.sql', 'utf8').replaceAll('\r\n', '\n');
const financialMigration = readFileSync('supabase/migrations/20260911000006_financial_followup_reopening.sql', 'utf8').replaceAll('\r\n', '\n');
function functionSql(source: string, name: string) {
  const start = source.indexOf(`create or replace function ${name}(`);
  if (start < 0) throw new Error(`Missing SQL function ${name}`);
  return source.slice(start, source.indexOf('\n$$;', start) + 4);
}
function body(sql: string) { return sql.split('as $$\n')[1].split('\n$$;')[0]; }
const actor = '11111111-1111-4111-8111-111111111111';
const otherActor = '22222222-2222-4222-8222-222222222222';
const project = '33333333-3333-4333-8333-333333333333';
const command = '44444444-4444-4444-8444-444444444444';
const secondCommand = '55555555-5555-4555-8555-555555555555';
const payload = { expectedRowVersion: 1, outcome: 'LOST_NO_RESPONSE', cancellationReason: 'Synthetic approved close', note: 'Synthetic audit evidence' };
const coreSignature = 'private.project_operational_state_command_core(uuid,uuid,text,jsonb,uuid)';
const publicSignature = 'public.project_operational_state_command(uuid,uuid,text,jsonb)';
const db = new PGlite();
let previousPublicAcl: unknown;
let currentCanonicalBody: string;

// Execute the real command, receipt, cancellation, projection and write-guard SQL.
// Minimal synthetic tables isolate this extraction; this is not a full-schema,
// PostgREST, production PostgreSQL-version or concurrent-session rehearsal.
// Financial truth is an injected read projection; the actual current command's
// settlement predicates and actual delivery/financial-reopening helpers execute.
beforeAll(async () => {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create table public.portal_users(user_id uuid primary key, role text);
    create function public.has_portal_access() returns boolean language sql stable as $$
      select exists(select 1 from public.portal_users where user_id = auth.uid())
    $$;
    create table public.projects(
      id uuid primary key, name text, pipeline_stage text, archived_at timestamptz,
      final_payment_date date, deposit_paid_date date,
      next_action text, next_action_type text, next_action_at timestamptz,
      next_action_date date, follow_up_date date
    );
    create table public.project_operational_states(
      project_id uuid primary key, state text, waiting_until timestamptz,
      waiting_reason text, closed_outcome text, closed_note text,
      row_version bigint, updated_by uuid
    );
    create table public.project_work_model_versions(project_id uuid, model_version integer);
    create table public.project_work_items(
      id uuid primary key, project_id uuid, status text, source_type text, series_key text,
      created_at timestamptz default now(), blocked_reason text, cancellation_reason text,
      cancelled_at timestamptz, cancelled_by uuid, updated_by uuid, row_version bigint,
      priority text, due_at timestamptz, title text
    );
    create table public.project_state_events(
      project_id uuid, command_id uuid, event_sequence integer, event_type text,
      before_state jsonb, after_state jsonb, reason text, actor_user_id uuid, actor_kind text
    );
    create table public.project_work_item_events(like public.project_state_events);
    alter table public.project_work_item_events add column work_item_id uuid;
    create table public.project_command_receipts(
      command_id uuid primary key, project_id uuid, command_type text, intent_hash text,
      actor_user_id uuid, actor_kind text, committed_result jsonb
    );
    create table public.scheduled_jobs(job_id uuid, status text, actual_finish timestamptz);
    create table public.quotes(id uuid, project_id uuid);
    create table public.quote_versions(quote_id uuid, status text);
    create table public.deposit_invoices(project_id uuid, status text);
    create table public.project_confirmation_events(
      id uuid, project_id uuid, confirmation_type text, event_kind text, retracts_event_id uuid
    );
    create table public.fixture_financial_truth(
      project_id uuid, accepted_total_inc_gst_cents bigint, paid_inc_gst_cents bigint, open_invoice_inc_gst_cents bigint
    );
    create function public.commercial_project_financial_truth(p_project_id uuid)
    returns table(accepted_total_inc_gst_cents bigint, paid_inc_gst_cents bigint, open_invoice_inc_gst_cents bigint)
    language sql as $$ select accepted_total_inc_gst_cents, paid_inc_gst_cents, open_invoice_inc_gst_cents
      from public.fixture_financial_truth where project_id = p_project_id $$;
  `);
  for (const name of ['intent_hash', 'assert_v2', 'receipt_replay', 'store_receipt', 'cancel_active', 'refresh_projection', 'governed_write_guard', 'compatibility_write_guard']) {
    await db.exec(functionSql(original, `public.project_work_items_${name}`));
  }
  await db.exec(functionSql(rollout, 'public.project_work_items_governed_write_guard'));
  await db.exec(functionSql(original, 'public.project_operational_state_command'));
  // Apply the real subsequent owner rewrites, not a hand-copied approximation.
  const deliveryPatch = deliveryMigration.slice(deliveryMigration.indexOf('do $migration$'), deliveryMigration.indexOf('$migration$;') + '$migration$;'.length);
  const financialPatch = financialMigration.slice(financialMigration.indexOf('do $patch$'), financialMigration.indexOf('$patch$;') + '$patch$;'.length);
  await db.exec(deliveryPatch);
  await db.exec(financialPatch);
  await db.exec(functionSql(deliveryMigration, 'public.project_has_delivery_completion'));
  await db.exec(functionSql(financialMigration, 'public.project_reopen_financial_followup'));
  currentCanonicalBody = (await db.query<{ prosrc: string }>(`select prosrc from pg_proc where oid = '${publicSignature}'::regprocedure`)).rows[0].prosrc.trim();
  await db.exec(`revoke all on function ${publicSignature} from public, anon, authenticated, service_role;
    grant execute on function ${publicSignature} to authenticated;`);
  previousPublicAcl = (await db.query(`select proacl::text from pg_proc where oid = '${publicSignature}'::regprocedure`)).rows;
  await db.exec(migration);
  await db.exec(grantMigration);
  await db.exec(`
    create trigger state_guard before update on public.project_operational_states
      for each row execute function public.project_work_items_governed_write_guard();
    create trigger item_guard before update on public.project_work_items
      for each row execute function public.project_work_items_governed_write_guard();
    create trigger projection_guard before update on public.projects
      for each row execute function public.project_work_items_compatibility_write_guard();
  `);
}, 30000);
beforeEach(async () => {
  await db.exec(`reset role;
    truncate public.portal_users, public.projects, public.project_operational_states,
      public.project_work_model_versions, public.project_work_items, public.project_state_events,
      public.project_work_item_events, public.project_command_receipts, public.scheduled_jobs,
      public.quotes, public.quote_versions, public.deposit_invoices,
      public.project_confirmation_events, public.fixture_financial_truth,
      private.portal_action_receipts, private.portal_action_approvals, private.portal_action_grants;
    update private.portal_action_installation set enabled = false, environment = null;
    select set_config('request.jwt.claim.sub', '', false);
    select set_config('sanctuary.project_work_command', '', false);
    select set_config('sanctuary.financial_reopen', '', false);
    insert into public.portal_users values ('${actor}', 'admin'), ('${otherActor}', 'staff');
    insert into public.projects(id, pipeline_stage, next_action) values ('${project}', 'SENT', 'Synthetic pending work');
    insert into public.project_operational_states(project_id, state, row_version) values ('${project}', 'ACTIVE', 1);
    insert into public.project_work_model_versions values ('${project}', 2);
    insert into public.fixture_financial_truth values ('${project}', 100, 100, 0);
    insert into public.project_work_items(id, project_id, status, row_version, title, priority, due_at)
      values ('66666666-6666-4666-8666-666666666666', '${project}', 'OPEN', 1, 'Synthetic pending work', 'NORMAL', now());
  `);
});

describe('approved grant to canonical state command integration', () => {
  const tokenHash = createHash('sha256').update('synthetic integration token; never a live credential').digest('hex');

  async function issueClose(expectedRowVersion = 1) {
    await db.exec("update private.portal_action_installation set enabled = true, environment = 'staging'");
    await db.query("update public.projects set pipeline_stage = 'NEW', name = 'Synthetic integration project' where id = $1", [project]);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [actor]);
    const request = {
      version: 'portal_actions_v1', environment: 'staging', taskReference: 'synthetic-core-integration',
      label: 'Synthetic bounded close', expiresAt: new Date(Date.now() + 3600000).toISOString(),
      projectIds: [project], actions: [{ ...payload, expectedRowVersion, commandId: command,
        projectId: project, command: 'CLOSE', expiresAt: new Date(Date.now() + 1800000).toISOString() }],
    };
    await db.exec('set role authenticated');
    const grant = (await db.query<{ result: { grantId: string } }>(
      'select public.portal_action_grant_issue($1, $2::jsonb) as result', [tokenHash, JSON.stringify(request)],
    )).rows[0].result;
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
    return grant;
  }

  async function executeClose() {
    await db.exec('set role service_role');
    try {
      return (await db.query<{ result: Record<string, unknown> }>(
        'select public.portal_action_execute($1, $2, $3::uuid) as result', [tokenHash, 'staging', command],
      )).rows[0].result;
    } finally { await db.exec('reset role'); }
  }

  async function expectNoEffects() {
    expect((await db.query('select state, row_version, updated_by from public.project_operational_states')).rows)
      .toEqual([{ state: 'ACTIVE', row_version: 1, updated_by: null }]);
    expect((await db.query('select status, cancelled_by from public.project_work_items')).rows)
      .toEqual([{ status: 'OPEN', cancelled_by: null }]);
    for (const table of ['private.portal_action_receipts', 'public.project_command_receipts', 'public.project_state_events', 'public.project_work_item_events']) {
      expect((await db.query(`select count(*)::integer as count from ${table}`)).rows).toEqual([{ count: 0 }]);
    }
  }

  it('closes through the real core and returns one durable delegated and domain receipt on replay', async () => {
    const grant = await issueClose();
    const first = await executeClose();
    expect(first).toMatchObject({ grantId: grant.grantId, commandId: command, actorUserId: actor,
      command: 'CLOSE', outcome: 'LOST_NO_RESPONSE', row_version: 2, cancelled_count: 1, replayed: false });
    expect(await executeClose()).toEqual({ ...first, replayed: true });
    expect((await db.query('select pipeline_stage, next_action from public.projects')).rows)
      .toEqual([{ pipeline_stage: 'NEW', next_action: null }]);
    expect((await db.query('select state, closed_outcome, row_version, updated_by from public.project_operational_states')).rows)
      .toEqual([{ state: 'CLOSED', closed_outcome: 'LOST_NO_RESPONSE', row_version: 2, updated_by: actor }]);
    expect((await db.query('select status, cancelled_by from public.project_work_items')).rows)
      .toEqual([{ status: 'CANCELLED', cancelled_by: actor }]);
    expect((await db.query('select command_id, grant_id, actor_user_id, result from private.portal_action_receipts')).rows)
      .toEqual([{ command_id: command, grant_id: grant.grantId, actor_user_id: actor, result: first }]);
    expect((await db.query('select command_id, command_type, actor_user_id from public.project_command_receipts')).rows)
      .toEqual([{ command_id: command, command_type: 'PROJECT_STATE_CLOSE', actor_user_id: actor }]);
    expect((await db.query('select command_id, event_type, actor_user_id from public.project_state_events')).rows)
      .toEqual([{ command_id: command, event_type: 'CLOSE', actor_user_id: actor }]);
    expect((await db.query('select command_id, event_type, actor_user_id from public.project_work_item_events')).rows)
      .toEqual([{ command_id: command, event_type: 'CANCELLED', actor_user_id: actor }]);
    expect((await db.query('select auth.uid() as actor')).rows).toEqual([{ actor: null }]);
  });

  it('maps actual core stale conflicts to PT409 and leaves no partial effects', async () => {
    await issueClose(2);
    await expect(executeClose()).rejects.toMatchObject({ code: 'PT409' });
    await expectNoEffects();
  });

  it('does not let a delegated approval inherit internal financial SYSTEM context', async () => {
    await issueClose();
    await db.exec("select set_config('sanctuary.financial_reopen', 'allowed', false)");
    await expect(executeClose()).rejects.toMatchObject({ code: '42501' });
    await expectNoEffects();
  });

  it.each(['DEPOSIT', 'SCHEDULED', 'COMPLETED', 'PAID'])('rejects %s after approval without invoking a domain write', async (stage) => {
    await issueClose();
    await db.query('update public.projects set pipeline_stage = $1 where id = $2', [stage, project]);
    await expect(executeClose()).rejects.toMatchObject({ code: 'PT409' });
    await expectNoEffects();
    expect((await db.query('select pipeline_stage from public.projects')).rows).toEqual([{ pipeline_stage: stage }]);
  });
});
afterAll(async () => { await db.close(); });

async function runCore(action = 'CLOSE', input: object = payload, id = command, actingUser: string | null = actor) {
  const result = await db.query<{ result: Record<string, unknown> }>(
    'select private.project_operational_state_command_core($1::uuid,$2::uuid,$3::text,$4::jsonb,$5::uuid) as result',
    [project, id, action, JSON.stringify(input), actingUser],
  );
  return result.rows[0].result;
}

describe('project state command core extraction', () => {
  it('retains the fully rewritten current business body with only explicit actor authorization', () => {
    const expected = currentCanonicalBody
      .replace('v_actor uuid := auth.uid();', 'v_actor uuid := p_actor;')
      .replace('if not public.has_portal_access() and not (', 'if not exists (\n    select 1 from public.portal_users where user_id = v_actor\n  ) and not (');
    expect(body(functionSql(migration, 'private.project_operational_state_command_core')).trim()).toBe(expected);
    expect(expected).not.toContain('auth.uid');
    expect(expected).not.toContain('request.jwt');
  });

  it('preserves public RPC grants/default and denies every API role access to the explicit actor core', async () => {
    await db.exec(migration);
    expect((await db.query(`select proacl::text from pg_proc where oid = '${publicSignature}'::regprocedure`)).rows).toEqual(previousPublicAcl);
    const rows = (await db.query(`select pronargdefaults, prosecdef from pg_proc where oid = '${publicSignature}'::regprocedure`)).rows;
    expect(rows).toEqual([{ pronargdefaults: 1, prosecdef: true }]);
    for (const role of ['anon', 'authenticated', 'service_role']) {
      expect((await db.query(`select has_function_privilege('${role}', '${coreSignature}', 'execute') as allowed`)).rows).toEqual([{ allowed: false }]);
      await db.exec(`set role ${role}`);
      await expect(runCore()).rejects.toMatchObject({ code: '42501' });
      await db.exec('reset role');
    }
    const core = (await db.query(`select pg_get_userbyid(proowner) as owner, prosecdef, proconfig from pg_proc where oid = '${coreSignature}'::regprocedure`)).rows;
    expect(core).toEqual([{ owner: 'postgres', prosecdef: true, proconfig: ['search_path=pg_catalog, public, pg_temp'] }]);
  });

  it('attributes state, work cancellation, events and receipt to the supplied member without changing JWT identity', async () => {
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [otherActor]);
    expect(await runCore()).toMatchObject({ row_version: 2, cancelled_count: 1, replayed: false });
    expect((await db.query('select state, updated_by, closed_note from public.project_operational_states')).rows).toEqual([{ state: 'CLOSED', updated_by: actor, closed_note: payload.note }]);
    expect((await db.query('select status, cancelled_by from public.project_work_items')).rows).toEqual([{ status: 'CANCELLED', cancelled_by: actor }]);
    expect((await db.query('select actor_user_id from public.project_state_events union all select actor_user_id from public.project_work_item_events union all select actor_user_id from public.project_command_receipts')).rows).toEqual(Array(3).fill({ actor_user_id: actor }));
    expect((await db.query('select pipeline_stage, next_action from public.projects')).rows).toEqual([{ pipeline_stage: 'SENT', next_action: null }]);
    expect((await db.query('select auth.uid() as actor')).rows).toEqual([{ actor: otherActor }]);
  });

  it('keeps the public wrapper bound to authenticated session membership', async () => {
    await db.exec('set role authenticated');
    await expect(db.query(`select public.project_operational_state_command($1::uuid,$2::uuid,'CLOSE',$3::jsonb)`, [project, command, JSON.stringify(payload)])).rejects.toMatchObject({ code: '42501' });
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [otherActor]);
    await db.query(`select public.project_operational_state_command($1::uuid,$2::uuid,'CLOSE',$3::jsonb)`, [project, command, JSON.stringify(payload)]);
    await db.exec('reset role');
    expect((await db.query('select updated_by from public.project_operational_states')).rows).toEqual([{ updated_by: otherActor }]);
  });

  it('rejects absent or removed actors even on receipt replay', async () => {
    await expect(runCore('CLOSE', payload, command, null)).rejects.toMatchObject({ code: '42501' });
    await runCore();
    await db.query('delete from public.portal_users where user_id = $1', [actor]);
    await expect(runCore()).rejects.toMatchObject({ code: '42501' });
  });

  it('replays exact committed intent once and rejects changed intent', async () => {
    await runCore();
    expect(await runCore()).toMatchObject({ row_version: 2, replayed: true });
    await expect(runCore('CLOSE', { ...payload, note: 'Changed intent' })).rejects.toMatchObject({ code: '40001' });
    expect((await db.query('select count(*)::integer as count from public.project_state_events')).rows).toEqual([{ count: 1 }]);
    expect((await db.query('select count(*)::integer as count from public.project_work_item_events')).rows).toEqual([{ count: 1 }]);
  });

  it('rejects stale commands without cancelling work or recording a receipt', async () => {
    await expect(runCore('CLOSE', { ...payload, expectedRowVersion: 2 })).rejects.toMatchObject({ code: '40001' });
    expect((await db.query('select status from public.project_work_items')).rows).toEqual([{ status: 'OPEN' }]);
    expect((await db.query('select count(*)::integer as count from public.project_command_receipts')).rows).toEqual([{ count: 0 }]);
  });

  it('retains reopen and wait/activate transitions', async () => {
    await runCore();
    expect(await runCore('REOPEN', { expectedRowVersion: 2, reason: 'Synthetic reopen' }, secondCommand)).toMatchObject({ row_version: 3 });
    await runCore('WAIT', { expectedRowVersion: 3, reason: 'Synthetic hold', cancellationReason: 'Synthetic hold', waitingUntil: '2099-01-01T00:00:00Z' }, '77777777-7777-4777-8777-777777777777');
    expect((await db.query('select state from public.project_operational_states')).rows).toEqual([{ state: 'WAITING' }]);
    await runCore('ACTIVATE', { expectedRowVersion: 4 }, '88888888-8888-4888-8888-888888888888');
    expect((await db.query('select state, row_version from public.project_operational_states')).rows).toEqual([{ state: 'ACTIVE', row_version: 5 }]);
  });

  it('retains existing completion checks and rolls back failed writes', async () => {
    await expect(runCore('CLOSE', { ...payload, outcome: 'COMPLETE' })).rejects.toThrow('PROJECT_NOT_COMPLETE');
    expect((await db.query('select state from public.project_operational_states')).rows).toEqual([{ state: 'ACTIVE' }]);
    await db.query("insert into public.scheduled_jobs values ($1, 'done', now())", [project]);
    expect(await runCore('CLOSE', { ...payload, outcome: 'COMPLETE' })).toMatchObject({ row_version: 2 });
  });

  it.each([
    { accepted: 0, paid: 0, open: 0 },
    { accepted: 100, paid: 99, open: 0 },
    { accepted: 100, paid: 100, open: 1 },
  ])('retains commercial COMPLETE settlement predicates: %j', async ({ accepted, paid, open }) => {
    await db.query("insert into public.scheduled_jobs values ($1, 'done', now())", [project]);
    await db.query('update public.fixture_financial_truth set accepted_total_inc_gst_cents=$1, paid_inc_gst_cents=$2, open_invoice_inc_gst_cents=$3', [accepted, paid, open]);
    await expect(runCore('CLOSE', { ...payload, outcome: 'COMPLETE' })).rejects.toThrow('delivery and reconciled billing are required');
    expect((await db.query('select state, row_version from public.project_operational_states')).rows).toEqual([{ state: 'ACTIVE', row_version: 1 }]);
    expect((await db.query('select count(*)::integer as count from public.project_command_receipts')).rows).toEqual([{ count: 0 }]);
  });

  it('accepts unretracted confirmation delivery evidence without a scheduled job', async () => {
    await db.query("insert into public.project_confirmation_events values ($1,$2,'DELIVERY_COMPLETED','CONFIRMED',null)", [command, project]);
    expect(await runCore('CLOSE', { ...payload, outcome: 'COMPLETE' })).toMatchObject({ row_version: 2 });
  });

  it('preserves internal financial follow-up reopening with a null SYSTEM actor', async () => {
    await db.query("insert into public.scheduled_jobs values ($1, 'done', now())", [project]);
    await runCore('CLOSE', { ...payload, outcome: 'COMPLETE' });
    await expect(db.query("select public.project_operational_state_command($1,$2,'REOPEN',$3::jsonb)", [project, secondCommand, JSON.stringify({ expectedRowVersion: 2 })])).rejects.toMatchObject({ code: '42501' });
    await db.query('select public.project_reopen_financial_followup($1,$2)', [project, 'Synthetic settlement correction']);
    expect((await db.query('select state, row_version, updated_by from public.project_operational_states')).rows)
      .toEqual([{ state: 'ACTIVE', row_version: 3, updated_by: null }]);
    expect((await db.query("select actor_user_id, actor_kind from public.project_state_events where event_type='REOPEN'")).rows)
      .toEqual([{ actor_user_id: null, actor_kind: 'SYSTEM' }]);
    expect((await db.query("select actor_user_id, actor_kind from public.project_command_receipts where command_type='PROJECT_STATE_REOPEN'")).rows)
      .toEqual([{ actor_user_id: null, actor_kind: 'SYSTEM' }]);
    expect((await db.query("select current_setting('sanctuary.financial_reopen',true) as context")).rows).toEqual([{ context: '' }]);
  });

  it('keeps lost closures out of internal financial reopening', async () => {
    await runCore();
    await db.query('select public.project_reopen_financial_followup($1,$2)', [project, 'Synthetic settlement correction']);
    expect((await db.query('select state, row_version from public.project_operational_states')).rows).toEqual([{ state: 'CLOSED', row_version: 2 }]);
  });

  it('refuses to overwrite an unreviewed deployed command owner', async () => {
    const wrapper = functionSql(migration, 'public.project_operational_state_command');
    await db.exec(wrapper.replace('begin\n', 'begin\n  -- Unreviewed owner change\n'));
    try {
      await expect(db.exec(migration)).rejects.toThrow('Operational state command owner changed');
    } finally {
      await db.exec('rollback');
      await db.exec(wrapper);
    }
  });

  it('refuses a private core collision even while the public command matches the reviewed predecessor', async () => {
    const wrapper = functionSql(migration, 'public.project_operational_state_command');
    const core = functionSql(migration, 'private.project_operational_state_command_core');
    await db.exec(wrapper.replace(body(wrapper), currentCanonicalBody));
    await db.exec(core.replace('begin\n', 'begin\n  -- Existing unrelated private core\n'));
    try {
      await expect(db.exec(migration)).rejects.toThrow('Operational state command owner changed');
      await db.exec('rollback');
      const existing = (await db.query<{ prosrc: string }>(`select prosrc from pg_proc where oid = '${coreSignature}'::regprocedure`)).rows[0].prosrc;
      expect(existing).toContain('-- Existing unrelated private core');
    } finally {
      await db.exec('rollback');
      await db.exec(core);
      await db.exec(wrapper);
    }
  });

  it('retains archive/model guards', async () => {
    await db.query('update public.projects set archived_at = now() where id = $1', [project]);
    await expect(runCore()).rejects.toThrow('archived projects');
    await db.exec('delete from public.project_work_model_versions');
    await expect(runCore()).rejects.toThrow('PROJECT_WORK_MODEL_NOT_V2');
  });

  it('restores the command write guard after success and failure', async () => {
    await runCore();
    await expect(db.exec("update public.project_operational_states set state = 'ACTIVE'")).rejects.toMatchObject({ code: '42501' });
    await expect(runCore('WAIT', { expectedRowVersion: 2 }, secondCommand)).rejects.toMatchObject({ code: '22023' });
    await expect(db.exec("update public.project_work_items set status = 'OPEN'")).rejects.toMatchObject({ code: '42501' });
  });
});
