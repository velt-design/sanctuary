// @vitest-environment node
// Exact grant migration with a synthetic domain core: boundary evidence only.
// Actual Project Work cancellation/history semantics are verified separately.
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

const db = new PGlite();
const ADMIN = '00000000-0000-4000-8000-000000000001';
const STAFF = '00000000-0000-4000-8000-000000000002';
const PROJECT = '00000000-0000-4000-8000-000000000003';
const OTHER = '00000000-0000-4000-8000-000000000004';
const COMMAND = '00000000-0000-4000-8000-000000000005';
const UNKNOWN = '00000000-0000-4000-8000-000000000006';
const HASH = 'a'.repeat(64);
const OTHER_HASH = 'b'.repeat(64);
let initiallyDisabled: boolean;
const future = (hours = 1) => new Date(Date.now() + hours * 3_600_000).toISOString();
const action = (patch: Record<string, unknown> = {}) => ({ commandId: COMMAND, projectId: PROJECT,
  command: 'CLOSE', expectedRowVersion: 1, expiresAt: future(), outcome: 'LOST_NO_RESPONSE',
  note: 'Synthetic approved closure', cancellationReason: 'Synthetic cancellation', ...patch });
const manifest = (patch: Record<string, unknown> = {}) => ({ version: 'portal_actions_v1', environment: 'staging',
  taskReference: 'synthetic boundary verification', label: 'Synthetic grant', expiresAt: future(2),
  projectIds: [PROJECT], actions: [action()], ...patch });

async function asRole(role: 'authenticated' | 'anon' | 'service_role', sql: string, params: unknown[] = [], actor = ADMIN) {
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [actor]);
  await db.exec(`set role ${role}`);
  try { return await db.query(sql, params); } finally { await db.exec('reset role'); }
}
async function issue(grant = manifest(), hash = HASH, actor = ADMIN) {
  const result = await asRole('authenticated', 'select public.portal_action_grant_issue($1,$2::jsonb) as value', [hash, JSON.stringify(grant)], actor);
  return result.rows[0].value as Record<string, unknown>;
}
async function execute(hash = HASH, environment = 'staging', commandId = COMMAND) {
  const result = await asRole('service_role', 'select public.portal_action_execute($1,$2,$3::uuid) as value', [hash, environment, commandId]);
  return result.rows[0].value as Record<string, unknown>;
}
async function connection(hash = HASH, environment = 'staging') {
  return asRole('service_role', 'select public.portal_action_connection($1,$2) as value', [hash, environment]);
}
async function counts() {
  return (await db.query('select (select count(*)::int from private.core_calls) as calls, (select count(*)::int from private.portal_action_receipts) as receipts')).rows[0];
}

beforeAll(async () => {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth; create schema private;
    create table auth.users(id uuid primary key);
    create table public.portal_users(user_id uuid primary key references auth.users, role text not null);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table public.projects(id uuid primary key, name text, pipeline_stage text, archived_at timestamptz);
    create table public.project_operational_states(project_id uuid primary key references public.projects,
      state text, row_version bigint, closed_outcome text, closed_note text);
    create table public.project_command_receipts(command_id uuid primary key);
    create table private.core_calls(project_id uuid, command_id uuid, command text, payload jsonb, actor_user_id uuid);
    create function private.project_operational_state_command_core(p_project uuid,p_command_id uuid,p_command text,p_payload jsonb,p_actor uuid)
    returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
    declare v_version bigint;
    begin
      select row_version into v_version from public.project_operational_states where project_id=p_project for update;
      if v_version is distinct from (p_payload->>'expectedRowVersion')::bigint then
        raise exception 'synthetic stale state' using errcode='40001';
      end if;
      insert into private.core_calls values(p_project,p_command_id,p_command,p_payload,p_actor);
      update public.project_operational_states set state=case when p_command='CLOSE' then 'CLOSED' else 'ACTIVE' end,
        row_version=row_version+1, closed_outcome=p_payload->>'outcome',closed_note=p_payload->>'note' where project_id=p_project;
      insert into public.project_command_receipts values(p_command_id);
      return jsonb_build_object('project_id',p_project,'row_version',v_version+1,'replayed',false);
    end $$;
    revoke all on function private.project_operational_state_command_core(uuid,uuid,text,jsonb,uuid) from public,anon,authenticated,service_role;
    insert into auth.users values('${ADMIN}'),('${STAFF}');
    insert into public.portal_users values('${ADMIN}','admin'),('${STAFF}','staff');
    insert into public.projects values('${PROJECT}','Synthetic A','NEW',null),('${OTHER}','Synthetic B','SENT',null);
    insert into public.project_operational_states values('${PROJECT}','ACTIVE',1,null,null),('${OTHER}','ACTIVE',1,null,null);
  `);
  await db.exec(readFileSync(new URL('../supabase/migrations/20260922042402_portal_action_grants.sql', import.meta.url), 'utf8'));
  initiallyDisabled = (await db.query('select enabled=false and environment is null as disabled from private.portal_action_installation')).rows[0].disabled as boolean;
}, 30_000);
beforeEach(async () => {
  await db.exec(`reset role;
    truncate private.portal_action_receipts,private.portal_action_approvals,private.portal_action_grants,private.core_calls,public.project_command_receipts;
    update private.portal_action_installation set enabled=true,environment='staging';
    insert into public.portal_users values('${ADMIN}','admin'),('${STAFF}','staff')
      on conflict(user_id) do update set role=excluded.role;
    update public.projects set pipeline_stage='NEW',archived_at=null;
    update public.project_operational_states set state='ACTIVE',row_version=1,closed_outcome=null,closed_note=null;
  `);
});

it('retains historical attribution while membership deletion immediately denies access', async () => {
  const grant = await issue();
  await db.query('delete from public.portal_users where user_id=$1', [ADMIN]);
  await expect(connection()).rejects.toThrow('access denied');
  expect((await db.query('select actor_user_id from private.portal_action_grants where id=$1', [grant.grantId])).rows)
    .toEqual([{ actor_user_id: ADMIN }]);
});

it('lists grant metadata for admin recovery without credentials or approval payloads', async () => {
  await issue();
  const listed = await asRole('authenticated', 'select public.portal_action_grants_list() as value');
  const body = JSON.stringify(listed.rows);
  expect(body).toContain('Synthetic grant');
  expect(body).not.toContain(HASH);
  expect(body).not.toContain('token_hash');
  expect(body).not.toContain('Synthetic approved closure');
  await expect(asRole('authenticated', 'select public.portal_action_grants_list()', [], STAFF)).rejects.toThrow('admin access required');
});

it.each(['taskReference', 'label'])('rejects non-string %s in the direct SQL contract', async key => {
  await expect(issue(manifest({ [key]: 123 }))).rejects.toThrow('invalid grant');
});

it('previews actual project evidence and reports stale or protected actions without issuing authority', async () => {
  const preview = async () => (await asRole('authenticated', 'select public.portal_action_grant_preview($1::jsonb) as value', [JSON.stringify(manifest())])).rows[0].value as any;
  const fresh = await preview();
  expect(fresh.actions).toEqual([{ commandId: COMMAND, projectId: PROJECT, eligible: true, reason: null }]);
  expect(fresh.projects[0]).toMatchObject({ projectId: PROJECT, stage: 'NEW', state: 'ACTIVE', rowVersion: 1 });
  await db.query('update public.project_operational_states set row_version=2 where project_id=$1', [PROJECT]);
  expect((await preview()).actions[0]).toMatchObject({ eligible: false, reason: 'Project changed; refresh the approved action' });
  await db.query("update public.projects set pipeline_stage='DEPOSIT' where id=$1", [PROJECT]);
  expect((await preview()).actions[0]).toMatchObject({ eligible: false, reason: 'Project has moved beyond enquiry or proposal' });
  expect((await db.query('select count(*)::int as n from private.portal_action_grants')).rows).toEqual([{ n: 0 }]);
  await expect(asRole('authenticated', 'select public.portal_action_grant_preview($1::jsonb)', [JSON.stringify(manifest())], STAFF)).rejects.toThrow('admin access required');
});
afterAll(async () => { await db.close(); });

describe('Portal action grant migration boundary', () => {
  it('installs dark and refuses issue or execution when disabled', async () => {
    expect(initiallyDisabled).toBe(true);
    await issue();
    await db.exec('update private.portal_action_installation set enabled=false');
    await expect(issue(manifest({ actions: [] }), OTHER_HASH)).rejects.toMatchObject({ code: '42501' });
    await expect(execute()).rejects.toMatchObject({ code: '42501' });
    expect(await counts()).toEqual({ calls: 0, receipts: 0 });
  });

  it('only a current admin can issue or revoke and actor comes from auth', async () => {
    await expect(issue(manifest(), HASH, STAFF)).rejects.toMatchObject({ code: '42501' });
    const grant = await issue();
    expect(grant.actorUserId).toBe(ADMIN);
    await expect(asRole('authenticated', 'select public.portal_action_grant_revoke($1)', [grant.grantId], STAFF)).rejects.toMatchObject({ code: '42501' });
    await expect(asRole('service_role', 'select public.portal_action_grant_issue($1,$2::jsonb)', [OTHER_HASH, JSON.stringify(manifest())])).rejects.toMatchObject({ code: '42501' });
  });

  it('keeps private tables and internal core inaccessible to external roles', async () => {
    for (const role of ['anon', 'authenticated', 'service_role'] as const) {
      for (const table of ['portal_action_installation', 'portal_action_grants', 'portal_action_approvals', 'portal_action_receipts']) {
        const rights = await db.query('select has_table_privilege($1,$2,\'SELECT,INSERT,UPDATE,DELETE\') as permitted', [role, `private.${table}`]);
        expect(rights.rows[0].permitted).toBe(false);
        await expect(asRole(role, `select * from private.${table}`)).rejects.toMatchObject({ code: '42501' });
      }
      const rights = await db.query("select has_function_privilege($1,'private.project_operational_state_command_core(uuid,uuid,text,jsonb,uuid)','EXECUTE') as permitted", [role]);
      expect(rights.rows[0].permitted).toBe(false);
      if (role !== 'service_role') await expect(asRole(role, 'select public.portal_action_connection($1,$2)', [HASH, 'staging'])).rejects.toMatchObject({ code: '42501' });
    }
  });

  it.each([[OTHER_HASH, 'staging', COMMAND], [HASH, 'production', COMMAND], [HASH, 'staging', UNKNOWN]])('rejects wrong token, environment, or unsaved action (%s,%s,%s)', async (hash, environment, commandId) => {
    await issue();
    await expect(execute(hash, environment, commandId)).rejects.toMatchObject({ code: '42501' });
    expect(await counts()).toEqual({ calls: 0, receipts: 0 });
  });

  it('returns only explicitly scoped projects and excludes the token hash', async () => {
    await issue();
    const result = await asRole('service_role', 'select public.portal_action_projects($1,$2) as value', [HASH, 'staging']);
    expect(result.rows[0].value.projects.map((project: { projectId: string }) => project.projectId)).toEqual([PROJECT]);
    expect(JSON.stringify((await connection()).rows)).not.toContain(HASH);
  });

  it('supports a read-only grant without manufacturing an executable action', async () => {
    await issue(manifest({ actions: [] }));
    expect((await connection()).rows[0].value).toMatchObject({ version: 'portal_actions_v1', environment: 'staging' });
    await expect(execute()).rejects.toMatchObject({ code: '42501' });
  });

  it.each(['revoked', 'demoted', 'grant expired', 'approval expired'])('rejects %s authority', async (condition) => {
    const grant = await issue();
    if (condition === 'revoked') await asRole('authenticated', 'select public.portal_action_grant_revoke($1)', [grant.grantId]);
    if (condition === 'demoted') await db.query("update public.portal_users set role='staff' where user_id=$1", [ADMIN]);
    if (condition === 'grant expired') await db.exec("update private.portal_action_grants set created_at=now()-interval '2 days',expires_at=now()-interval '1 day'");
    if (condition === 'approval expired') await db.exec("update private.portal_action_approvals set expires_at=now()-interval '1 second'");
    await expect(execute()).rejects.toMatchObject({ code: '42501' });
    expect(await counts()).toEqual({ calls: 0, receipts: 0 });
  });

  it.each([
    { projectIds: [PROJECT, PROJECT] }, { projectIds: [UNKNOWN] }, { environment: 'production' },
    { actorUserId: STAFF }, { expiresAt: future(24 * 31) },
    { actions: [action({ projectId: OTHER })] }, { actions: [action({ command: 'WAIT' })] },
    { actions: [action({ outcome: 'COMPLETE' })] }, { actions: [action({ expectedRowVersion: 0 })] },
    { actions: [action({ expectedRowVersion: 1.5 })] }, { actions: [action({ note: ' ' })] },
    { actions: [action({ expiresAt: future(25) })] }, { actions: [action({ actorUserId: STAFF })] },
  ])('rejects invalid grant or action atomically: %j', async (patch) => {
    await expect(issue(manifest(patch))).rejects.toBeDefined();
    expect((await db.query('select count(*)::int as count from private.portal_action_grants')).rows[0].count).toBe(0);
  });

  it.each(['CONFIRMED', 'DELIVERY', 'SETTLED', '', 'ARCHIVED'])('blocks protected/unknown stage %s', async (stage) => {
    await issue();
    await db.query('update public.projects set pipeline_stage=$1 where id=$2', [stage, PROJECT]);
    await expect(execute()).rejects.toMatchObject({ code: 'PT409' });
    expect(await counts()).toEqual({ calls: 0, receipts: 0 });
  });

  it.each(['NEW', 'CONTACTED', 'SITE_VISIT', 'QUOTING', 'SENT'])('allows an exact approved closure in %s', async (stage) => {
    await issue();
    await db.query('update public.projects set pipeline_stage=$1 where id=$2', [stage, PROJECT]);
    expect(await execute()).toMatchObject({ command: 'CLOSE', replayed: false });
    expect((await db.query('select pipeline_stage from public.projects where id=$1', [PROJECT])).rows[0].pipeline_stage).toBe(stage);
  });

  it('blocks archived projects and removed project scope', async () => {
    await issue();
    await db.query('update public.projects set archived_at=now() where id=$1', [PROJECT]);
    await expect(execute()).rejects.toMatchObject({ code: 'PT409' });
    await db.query('update public.projects set archived_at=null where id=$1', [PROJECT]);
    await db.query('update private.portal_action_grants set project_ids=$1::uuid[]', [[OTHER]]);
    await expect(execute()).rejects.toMatchObject({ code: 'PT409' });
    expect(await counts()).toEqual({ calls: 0, receipts: 0 });
  });

  it('maps stale domain state to PT409 without a partial receipt or effect', async () => {
    await issue();
    await db.query('update public.project_operational_states set row_version=2 where project_id=$1', [PROJECT]);
    await expect(execute()).rejects.toMatchObject({ code: 'PT409' });
    expect(await counts()).toEqual({ calls: 0, receipts: 0 });
  });

  it('executes saved payload once and returns a stable receipt even after approval expiry', async () => {
    const grant = await issue();
    const first = await execute();
    expect(first).toMatchObject({ grantId: grant.grantId, commandId: COMMAND, actorUserId: ADMIN, row_version: 2, replayed: false });
    await db.exec("update private.portal_action_approvals set expires_at=now()-interval '1 second'");
    expect(await execute()).toEqual({ ...first, replayed: true });
    expect(await counts()).toEqual({ calls: 1, receipts: 1 });
    expect((await db.query('select * from private.core_calls')).rows[0]).toMatchObject({ project_id: PROJECT,
      actor_user_id: ADMIN, command: 'CLOSE', payload: { expectedRowVersion: 1, outcome: 'LOST_NO_RESPONSE', note: 'Synthetic approved closure', cancellationReason: 'Synthetic cancellation' } });
  });

  it('rejects cross-grant command collision and never lets another grant replay it', async () => {
    await issue();
    await expect(issue(manifest(), OTHER_HASH)).rejects.toMatchObject({ code: '23505' });
    await issue(manifest({ actions: [] }), OTHER_HASH);
    await execute();
    await expect(execute(OTHER_HASH)).rejects.toMatchObject({ code: '42501' });
    expect(await counts()).toEqual({ calls: 1, receipts: 1 });
  });

  it('revocation prevents both new effects and reading a previously committed receipt', async () => {
    const grant = await issue();
    await execute();
    await asRole('authenticated', 'select public.portal_action_grant_revoke($1)', [grant.grantId]);
    await expect(execute()).rejects.toMatchObject({ code: '42501' });
    await expect(connection()).rejects.toMatchObject({ code: '42501' });
    expect(await counts()).toEqual({ calls: 1, receipts: 1 });
  });

  it('rejects prior external receipts both at issuance and after approval', async () => {
    await db.query('insert into public.project_command_receipts values($1)', [COMMAND]);
    await expect(issue()).rejects.toMatchObject({ code: 'PT409' });
    await db.exec('truncate public.project_command_receipts');
    await issue();
    await db.query('insert into public.project_command_receipts values($1)', [COMMAND]);
    await expect(execute()).rejects.toMatchObject({ code: 'PT409' });
    expect(await counts()).toEqual({ calls: 0, receipts: 0 });
  });

  it('accepts a separately saved REOPEN command with only its approved reason', async () => {
    await db.query("update public.project_operational_states set state='CLOSED' where project_id=$1", [PROJECT]);
    await issue(manifest({ actions: [{ commandId: COMMAND, projectId: PROJECT, command: 'REOPEN', expectedRowVersion: 1, expiresAt: future(), reason: 'Synthetic correction' }] }));
    expect(await execute()).toMatchObject({ command: 'REOPEN', outcome: null, row_version: 2 });
    expect((await db.query('select payload from private.core_calls')).rows[0].payload).toEqual({ expectedRowVersion: 1, reason: 'Synthetic correction' });
  });
});
