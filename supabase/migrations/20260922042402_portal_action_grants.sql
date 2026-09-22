-- Dark by default. Activation requires an explicitly verified installation identity.
-- No raw credentials, customer messages, generic SQL or commercial actions.
begin;
create table private.portal_action_installation (
  singleton boolean primary key default true check (singleton),
  environment text check (environment in ('staging','production')),
  enabled boolean not null default false,
  check (not enabled or environment is not null)
);
insert into private.portal_action_installation(singleton) values (true);

create table private.portal_action_grants (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  -- Historical attribution must survive membership removal (which revokes access).
  actor_user_id uuid not null,
  environment text not null check (environment in ('staging','production')),
  task_reference text not null check (char_length(task_reference) between 1 and 200),
  label text not null check (char_length(label) between 1 and 100),
  project_ids uuid[] not null check (cardinality(project_ids) between 1 and 1000),
  created_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_by uuid,
  check (expires_at > created_at and expires_at <= created_at + interval '30 days')
);
create table private.portal_action_approvals (
  command_id uuid primary key,
  grant_id uuid not null references private.portal_action_grants(id),
  project_id uuid not null references public.projects(id),
  command text not null check (command in ('CLOSE','REOPEN')),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  expires_at timestamptz not null,
  unique(grant_id, project_id)
);
create table private.portal_action_receipts (
  command_id uuid primary key references private.portal_action_approvals(command_id),
  grant_id uuid not null references private.portal_action_grants(id),
  actor_user_id uuid not null,
  committed_at timestamptz not null default clock_timestamp(),
  result jsonb not null
);
alter table private.portal_action_installation enable row level security;
alter table private.portal_action_grants enable row level security;
alter table private.portal_action_approvals enable row level security;
alter table private.portal_action_receipts enable row level security;
revoke all on private.portal_action_installation, private.portal_action_grants,
  private.portal_action_approvals, private.portal_action_receipts
  from public, anon, authenticated, service_role;

create function public.portal_action_grant_issue(p_token_hash text, p_grant jsonb)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_actor uuid := auth.uid();
  v_now timestamptz;
  v_grant private.portal_action_grants%rowtype;
  v_projects uuid[];
  v_action jsonb;
  v_payload jsonb;
  v_environment text;
  v_expiry timestamptz;
begin
  perform 1 from public.portal_users where user_id = v_actor and role = 'admin' for share;
  if not found then raise exception 'admin access required' using errcode = '42501'; end if;
  select environment into v_environment from private.portal_action_installation
    where singleton and enabled for share;
  if not found then raise exception 'Portal actions disabled' using errcode = '42501'; end if;
  v_now := clock_timestamp();
  if jsonb_typeof(p_grant) is distinct from 'object'
    or p_grant->>'version' is distinct from 'portal_actions_v1'
    or p_grant->>'environment' is distinct from v_environment
    or (p_grant - array['version','environment','taskReference','label','expiresAt','projectIds','actions']) <> '{}'::jsonb
    or jsonb_typeof(p_grant->'projectIds') is distinct from 'array'
    or jsonb_typeof(p_grant->'actions') is distinct from 'array'
    or jsonb_typeof(p_grant->'taskReference') is distinct from 'string'
    or jsonb_typeof(p_grant->'label') is distinct from 'string'
  then raise exception 'invalid grant' using errcode = '22023'; end if;
  if jsonb_array_length(p_grant->'actions') > 100 then
    raise exception 'invalid grant' using errcode = '22023';
  end if;
  select array_agg(value::uuid order by value) into v_projects
    from jsonb_array_elements_text(p_grant->'projectIds');
  if cardinality(v_projects) is null or cardinality(v_projects) not between 1 and 1000
    or cardinality(v_projects) <> (select count(distinct x) from unnest(v_projects) x)
    or exists (select 1 from unnest(v_projects) x where not exists (select 1 from public.projects p where p.id = x))
  then raise exception 'invalid project scope' using errcode = '22023'; end if;
  v_expiry := (p_grant->>'expiresAt')::timestamptz;
  if v_expiry is null or v_expiry <= v_now or v_expiry > v_now + interval '30 days' then
    raise exception 'invalid grant expiry' using errcode = '22023';
  end if;
  insert into private.portal_action_grants(token_hash, actor_user_id, environment,
    task_reference, label, project_ids, created_at, expires_at)
  values (p_token_hash, v_actor, v_environment, btrim(p_grant->>'taskReference'),
    btrim(p_grant->>'label'), v_projects, v_now, v_expiry) returning * into v_grant;
  -- Deterministic command lock order, also shared with the canonical staff command.
  for v_action in select value from jsonb_array_elements(p_grant->'actions') order by (value->>'commandId')::uuid loop
    if jsonb_typeof(v_action) is distinct from 'object'
      or v_action->>'command' is null or v_action->>'command' not in ('CLOSE','REOPEN')
      or (v_action->>'projectId')::uuid is null
      or not ((v_action->>'projectId')::uuid = any(v_projects))
      or (v_action->>'commandId')::uuid is null
      or jsonb_typeof(v_action->'expectedRowVersion') is distinct from 'number'
      or (v_action->>'expectedRowVersion') !~ '^[1-9][0-9]*$'
      or (v_action->>'expectedRowVersion')::numeric > 9007199254740991
      or (v_action - array['commandId','projectId','command','expectedRowVersion','expiresAt','outcome','note','cancellationReason','reason']) <> '{}'::jsonb
    then raise exception 'invalid action' using errcode = '22023'; end if;
    v_expiry := (v_action->>'expiresAt')::timestamptz;
    if v_expiry is null or v_expiry <= v_now or v_expiry > v_now + interval '24 hours' or v_expiry > v_grant.expires_at then
      raise exception 'invalid approval expiry' using errcode = '22023';
    end if;
    v_payload := jsonb_build_object('expectedRowVersion', (v_action->>'expectedRowVersion')::bigint);
    if v_action->>'command' = 'CLOSE' then
      if v_action ? 'reason' or v_action->>'outcome' is null or v_action->>'outcome' not in
        ('LOST_NO_RESPONSE','LOST_BUDGET_PRICE','LOST_OTHER_SUPPLIER','LOST_TIMING_DEFERRED','LOST_NOT_SUITABLE','CANCELLED')
        or jsonb_typeof(v_action->'note') is distinct from 'string'
        or char_length(btrim(v_action->>'note')) not between 1 and 1000
        or jsonb_typeof(v_action->'cancellationReason') is distinct from 'string'
        or char_length(btrim(v_action->>'cancellationReason')) not between 1 and 500
      then raise exception 'invalid close approval' using errcode = '22023'; end if;
      v_payload := v_payload || jsonb_build_object('outcome', v_action->>'outcome',
        'note', btrim(v_action->>'note'), 'cancellationReason', btrim(v_action->>'cancellationReason'));
    else
      if v_action ?| array['outcome','note','cancellationReason']
        or jsonb_typeof(v_action->'reason') is distinct from 'string'
        or char_length(btrim(v_action->>'reason')) not between 1 and 500
      then raise exception 'invalid reopen approval' using errcode = '22023'; end if;
      v_payload := v_payload || jsonb_build_object('reason', btrim(v_action->>'reason'));
    end if;
    perform pg_advisory_xact_lock(hashtextextended(((v_action->>'commandId')::uuid)::text, 1));
    if exists (select 1 from public.project_command_receipts where command_id = (v_action->>'commandId')::uuid) then
      raise exception 'command already used' using errcode = 'PT409';
    end if;
    insert into private.portal_action_approvals(command_id, grant_id, project_id, command, payload, expires_at)
    values ((v_action->>'commandId')::uuid, v_grant.id, (v_action->>'projectId')::uuid,
      v_action->>'command', v_payload, v_expiry);
  end loop;
  return jsonb_build_object('grantId', v_grant.id, 'actorUserId', v_actor,
    'environment', v_grant.environment, 'expiresAt', v_grant.expires_at);
end;
$$;

create function public.portal_action_grant_preview(p_grant jsonb)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare v_projects jsonb; v_actions jsonb; v_environment text; v_enabled boolean;
begin
  if not exists (select 1 from public.portal_users where user_id = auth.uid() and role = 'admin') then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_grant) is distinct from 'object'
    or jsonb_typeof(p_grant->'projectIds') is distinct from 'array'
    or jsonb_typeof(p_grant->'actions') is distinct from 'array'
  then raise exception 'invalid preview' using errcode = '22023'; end if;
  if jsonb_array_length(p_grant->'projectIds') not between 1 and 1000
    or jsonb_array_length(p_grant->'actions') > 100 then
    raise exception 'invalid preview' using errcode = '22023';
  end if;
  select environment, enabled into v_environment, v_enabled from private.portal_action_installation where singleton;
  select coalesce(jsonb_agg(jsonb_build_object('projectId',p.id,'name',p.name,
    'stage',p.pipeline_stage,'archivedAt',p.archived_at,'state',s.state,
    'rowVersion',s.row_version,'closedOutcome',s.closed_outcome) order by p.id),'[]'::jsonb)
    into v_projects from public.projects p left join public.project_operational_states s on s.project_id=p.id
    where p.id in (select value::uuid from jsonb_array_elements_text(p_grant->'projectIds'));
  select coalesce(jsonb_agg(jsonb_build_object('commandId',action->>'commandId',
    'projectId',action->>'projectId','eligible',reason is null,'reason',reason)), '[]'::jsonb)
  into v_actions from (
    select a.value as action, case
      when p.id is null then 'Project unavailable'
      when p.archived_at is not null then 'Project is archived'
      when upper(btrim(coalesce(p.pipeline_stage::text,''))) not in ('NEW','CONTACTED','SITE_VISIT','QUOTING','SENT') then 'Project has moved beyond enquiry or proposal'
      when s.row_version is null then 'Project state unavailable'
      when s.row_version is distinct from (a.value->>'expectedRowVersion')::bigint then 'Project changed; refresh the approved action'
      when a.value->>'command' = 'CLOSE' and s.state not in ('ACTIVE','WAITING') then 'Project is already closed'
      when a.value->>'command' = 'REOPEN' and s.state <> 'CLOSED' then 'Project is not closed'
      when a.value->>'command' is null or a.value->>'command' not in ('CLOSE','REOPEN') then 'Unsupported action'
      else null end as reason
    from jsonb_array_elements(p_grant->'actions') a
    left join public.projects p on p.id=(a.value->>'projectId')::uuid
    left join public.project_operational_states s on s.project_id=p.id
  ) reviewed;
  return jsonb_build_object('environment',v_environment,'enabled',coalesce(v_enabled,false),
    'projects',v_projects,'actions',v_actions);
end;
$$;

create function public.portal_action_grants_list()
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare v_grants jsonb;
begin
  if not exists (select 1 from public.portal_users where user_id = auth.uid() and role = 'admin') then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  -- Metadata only; issuance response loss can be recovered by finding/revoking
  -- the grant. Credentials and private approval payloads are never returned.
  select coalesce(jsonb_agg(to_jsonb(g) order by g.created_at desc), '[]'::jsonb) into v_grants
  from (select id, actor_user_id, environment, task_reference, label,
    created_at, expires_at, revoked_at, cardinality(project_ids) as project_count,
    (select count(*) from private.portal_action_approvals a where a.grant_id = grant_row.id) as action_count,
    (select count(*) from private.portal_action_receipts r where r.grant_id = grant_row.id) as committed_count
    from private.portal_action_grants grant_row order by created_at desc limit 200) g;
  return jsonb_build_object('grants',v_grants);
end;
$$;

create function public.portal_action_grant_revoke(p_grant_id uuid)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare v_actor uuid := auth.uid(); v_grant private.portal_action_grants%rowtype;
begin
  -- Same lock order as execution: grant, membership, installation.
  select * into v_grant from private.portal_action_grants where id = p_grant_id for update;
  perform 1 from public.portal_users where user_id = v_actor and role = 'admin' for share;
  if not found then raise exception 'admin access required' using errcode = '42501'; end if;
  if v_grant.id is null then raise exception 'grant not found' using errcode = '22023'; end if;
  update private.portal_action_grants set revoked_at = coalesce(revoked_at, clock_timestamp()),
    revoked_by = coalesce(revoked_by, v_actor) where id = p_grant_id;
  return jsonb_build_object('grantId', p_grant_id, 'revoked', true);
end;
$$;

create function private.portal_action_require_grant(p_token_hash text, p_environment text)
returns private.portal_action_grants language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare v_grant private.portal_action_grants%rowtype;
begin
  select * into v_grant from private.portal_action_grants where token_hash = p_token_hash for share;
  if v_grant.id is null then raise exception 'access denied' using errcode = '42501'; end if;
  perform 1 from public.portal_users where user_id = v_grant.actor_user_id and role = 'admin' for share;
  if not found then raise exception 'access denied' using errcode = '42501'; end if;
  perform 1 from private.portal_action_installation
    where singleton and enabled and environment = p_environment and environment = v_grant.environment for share;
  if not found or v_grant.revoked_at is not null or v_grant.expires_at <= clock_timestamp() then
    raise exception 'access denied' using errcode = '42501';
  end if;
  return v_grant;
end;
$$;

create function public.portal_action_connection(p_token_hash text, p_environment text)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare v_grant private.portal_action_grants%rowtype;
begin
  v_grant := private.portal_action_require_grant(p_token_hash, p_environment);
  return jsonb_build_object('version','portal_actions_v1','environment',v_grant.environment,
    'grantId',v_grant.id,'actorUserId',v_grant.actor_user_id,'expiresAt',v_grant.expires_at);
end;
$$;

create function public.portal_action_projects(p_token_hash text, p_environment text)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare v_grant private.portal_action_grants%rowtype; v_projects jsonb;
begin
  v_grant := private.portal_action_require_grant(p_token_hash, p_environment);
  select coalesce(jsonb_agg(jsonb_build_object('projectId',p.id,'name',p.name,
    'stage',p.pipeline_stage,'archivedAt',p.archived_at,'state',s.state,
    'rowVersion',s.row_version,'closedOutcome',s.closed_outcome,'closedNote',s.closed_note)
    order by p.id), '[]'::jsonb) into v_projects
  from public.projects p left join public.project_operational_states s on s.project_id = p.id
  where p.id = any(v_grant.project_ids);
  return jsonb_build_object('projects',v_projects);
end;
$$;

create function public.portal_action_execute(p_token_hash text, p_environment text, p_command_id uuid)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, pg_temp as $$
declare
  v_grant private.portal_action_grants%rowtype;
  v_action private.portal_action_approvals%rowtype;
  v_result jsonb;
  v_project public.projects%rowtype;
begin
  v_grant := private.portal_action_require_grant(p_token_hash, p_environment);
  perform pg_advisory_xact_lock(hashtextextended(p_command_id::text, 1));
  if current_setting('sanctuary.financial_reopen', true) = 'allowed' then
    raise exception 'delegated actions cannot use financial system context' using errcode = '42501';
  end if;
  select * into v_action from private.portal_action_approvals
    where command_id = p_command_id and grant_id = v_grant.id;
  if v_action.command_id is null then raise exception 'action not approved' using errcode = '42501'; end if;
  -- Revocation/role/installation locks survive to transaction commit. Recheck the
  -- clock after waiting for the command lock. Committed receipt retrieval remains
  -- available after approval expiry, but only while the grant is still valid.
  if v_grant.expires_at <= clock_timestamp() then raise exception 'access denied' using errcode = '42501'; end if;
  select result into v_result from private.portal_action_receipts
    where command_id = p_command_id and grant_id = v_grant.id;
  if found then return v_result || jsonb_build_object('replayed', true); end if;
  if v_action.expires_at <= clock_timestamp() then raise exception 'approval expired' using errcode = '42501'; end if;
  if exists (select 1 from public.project_command_receipts where command_id = p_command_id) then
    raise exception 'command already used outside this grant' using errcode = 'PT409';
  end if;
  select * into v_project from public.projects where id = v_action.project_id for update;
  if not found or v_project.archived_at is not null
    or upper(btrim(coalesce(v_project.pipeline_stage::text,''))) not in ('NEW','CONTACTED','SITE_VISIT','QUOTING','SENT')
    or not (v_action.project_id = any(v_grant.project_ids)) then
    raise exception 'project outside approved pipeline' using errcode = 'PT409';
  end if;
  -- Core also locks state. Acquire that lock before the final expiry check so a
  -- queued state writer cannot carry an expired approval across this boundary.
  perform 1 from public.project_operational_states where project_id = v_action.project_id for update;
  if v_action.expires_at <= clock_timestamp() or v_grant.expires_at <= clock_timestamp() then
    raise exception 'approval expired' using errcode = '42501';
  end if;
  v_result := private.project_operational_state_command_core(v_action.project_id,
    p_command_id, v_action.command, v_action.payload, v_grant.actor_user_id);
  v_result := v_result || jsonb_build_object('grantId',v_grant.id,'commandId',p_command_id,
    'actorUserId',v_grant.actor_user_id,'command',v_action.command,'outcome',v_action.payload->>'outcome');
  insert into private.portal_action_receipts(command_id,grant_id,actor_user_id,result)
    values(p_command_id,v_grant.id,v_grant.actor_user_id,v_result);
  return v_result;
exception when sqlstate '40001' then
  -- Domain stale state is an owner conflict, never an automatic PostgREST retry.
  raise exception 'project state changed; review required' using errcode = 'PT409';
end;
$$;

revoke all on function public.portal_action_grant_issue(text,jsonb),
  public.portal_action_grant_preview(jsonb), public.portal_action_grants_list(), public.portal_action_grant_revoke(uuid), private.portal_action_require_grant(text,text),
  public.portal_action_connection(text,text), public.portal_action_projects(text,text),
  public.portal_action_execute(text,text,uuid) from public, anon, authenticated, service_role;
grant execute on function public.portal_action_grant_issue(text,jsonb),
  public.portal_action_grant_preview(jsonb), public.portal_action_grants_list(), public.portal_action_grant_revoke(uuid) to authenticated;
grant execute on function public.portal_action_connection(text,text),
  public.portal_action_projects(text,text), public.portal_action_execute(text,text,uuid) to service_role;
commit;
