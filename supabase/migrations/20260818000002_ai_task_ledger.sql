-- PR-AI-004: hosted Sanctuary AI task ledger for synthetic work only.
-- Public rows contain bounded staff-safe metadata. Frozen objective/input data
-- lives in the private schema and is not directly granted to application roles.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated, service_role;

create type public.ai_task_status as enum (
  'proposed',
  'approved',
  'queued',
  'running',
  'awaiting_approval',
  'rejected',
  'succeeded',
  'failed',
  'needs_attention',
  'cancelled',
  'evaluated'
);

create type public.ai_task_event_type as enum (
  'created',
  'status_changed',
  'assignment_changed',
  'policy_decision',
  'approval_requested',
  'approval_decided',
  'tool_summary',
  'retry_scheduled',
  'result_recorded',
  'evaluation_recorded'
);

create type public.ai_task_risk_class as enum (
  'low',
  'medium',
  'high',
  'critical'
);

create type public.ai_data_classification as enum (
  'public',
  'internal',
  'confidential',
  'restricted'
);

create or replace function public.ai_task_transition_allowed(
  p_from public.ai_task_status,
  p_to public.ai_task_status
)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select p_from = p_to or case p_from
    when 'proposed' then p_to in ('approved', 'cancelled')
    when 'approved' then p_to in ('queued', 'cancelled')
    when 'queued' then p_to in ('running', 'cancelled')
    when 'running' then p_to in (
      'awaiting_approval',
      'succeeded',
      'failed',
      'needs_attention'
    )
    when 'awaiting_approval' then p_to in ('running', 'rejected')
    when 'rejected' then p_to = 'cancelled'
    when 'failed' then p_to = 'queued'
    when 'needs_attention' then p_to = 'queued'
    when 'succeeded' then p_to = 'evaluated'
    else false
  end;
$$;

create or replace function public.ai_task_safe_text(p_value text, p_maximum integer)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select p_value is not null
    and length(p_value) between 1 and p_maximum
    and btrim(p_value) <> ''
    and p_value !~* '(@|https?://|token|secret|password|api[._ -]?key)';
$$;

create table public.ai_tasks (
  id uuid primary key default gen_random_uuid(),
  contract_version integer not null default 1 check (contract_version = 1),
  task_type text not null check (
    length(task_type) between 1 and 120
    and task_type ~ '^synthetic\.[a-z0-9._-]+$'
  ),
  agent_key text not null check (
    length(agent_key) between 1 and 120
    and agent_key ~ '^[a-z][a-z0-9._-]*$'
  ),
  agent_version text not null check (
    length(agent_version) between 1 and 64
    and agent_version ~ '^[A-Za-z0-9][A-Za-z0-9.+_-]*$'
  ),
  capability_key text not null check (
    length(capability_key) between 1 and 120
    and capability_key ~ '^synthetic\.[a-z0-9._-]+$'
  ),
  capability_version text not null check (
    length(capability_version) between 1 and 64
    and capability_version ~ '^[A-Za-z0-9][A-Za-z0-9.+_-]*$'
  ),
  policy_version text not null check (
    length(policy_version) between 1 and 64
    and policy_version ~ '^[A-Za-z0-9][A-Za-z0-9.+_-]*$'
  ),
  safe_objective text not null check (public.ai_task_safe_text(safe_objective, 500)),
  status public.ai_task_status not null default 'proposed',
  risk_class public.ai_task_risk_class not null default 'low',
  data_classification public.ai_data_classification not null default 'internal',
  execution_mode text not null default 'synthetic' check (execution_mode = 'synthetic'),
  effect_class text not null default 'none' check (effect_class = 'none'),
  requested_by_user_id uuid not null references auth.users(id) on delete restrict,
  project_id uuid null references public.projects(id) on delete set null,
  parent_task_id uuid null references public.ai_tasks(id) on delete set null,
  idempotency_key text not null check (
    length(idempotency_key) between 1 and 120
    and idempotency_key ~ '^[a-z][a-z0-9._-]*$'
  ),
  input_snapshot_hash text not null check (
    input_snapshot_hash ~ '^sha256:[0-9a-f]{64}$'
  ),
  max_cost_cents integer not null default 0 check (max_cost_cents = 0),
  actual_cost_cents integer not null default 0 check (actual_cost_cents = 0),
  failure_code text null check (
    failure_code is null
    or (
      length(failure_code) between 1 and 120
      and failure_code ~ '^[a-z][a-z0-9._-]*$'
    )
  ),
  safe_failure_summary text null check (
    safe_failure_summary is null
    or public.ai_task_safe_text(safe_failure_summary, 500)
  ),
  cancellation_reason_code text null check (
    cancellation_reason_code is null
    or cancellation_reason_code in ('operator_requested', 'superseded', 'test_cleanup')
  ),
  cancelled_by_user_id uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz null,
  completed_at timestamptz null,
  cancelled_at timestamptz null,
  unique (requested_by_user_id, idempotency_key),
  check (parent_task_id is null or parent_task_id <> id),
  check (updated_at >= created_at),
  check (started_at is null or started_at >= created_at),
  check (completed_at is null or completed_at >= coalesce(started_at, created_at)),
  check (
    (
      status = 'cancelled'
      and cancellation_reason_code is not null
      and cancelled_by_user_id is not null
      and cancelled_at is not null
      and completed_at is not null
    )
    or (
      status <> 'cancelled'
      and cancellation_reason_code is null
      and cancelled_by_user_id is null
      and cancelled_at is null
    )
  )
);

create table private.ai_task_payloads (
  task_id uuid primary key references public.ai_tasks(id) on delete cascade,
  contract_version integer not null default 1 check (contract_version = 1),
  input_snapshot_hash text not null check (
    input_snapshot_hash ~ '^sha256:[0-9a-f]{64}$'
  ),
  objective text not null check (length(objective) between 1 and 8000),
  payload jsonb not null check (
    jsonb_typeof(payload) = 'object'
    and octet_length(payload::text) <= 262144
  ),
  created_at timestamptz not null default now(),
  retain_until timestamptz not null default (now() + interval '7 days'),
  check (retain_until >= created_at and retain_until <= created_at + interval '30 days')
);

create table public.ai_task_events (
  id bigint generated always as identity primary key,
  task_id uuid not null references public.ai_tasks(id) on delete cascade,
  sequence integer not null check (sequence > 0),
  event_type public.ai_task_event_type not null,
  from_status public.ai_task_status null,
  to_status public.ai_task_status null,
  actor_kind text not null check (actor_kind in ('human', 'service', 'agent', 'node')),
  actor_key text not null check (
    length(actor_key) between 1 and 120
    and actor_key ~ '^[a-z][a-z0-9._-]*$'
  ),
  actor_user_id uuid null references auth.users(id) on delete set null,
  node_id text null check (
    node_id is null
    or (
      length(node_id) between 1 and 120
      and node_id ~ '^[a-z][a-z0-9._-]*$'
    )
  ),
  safe_summary text null check (
    safe_summary is null
    or public.ai_task_safe_text(safe_summary, 500)
  ),
  created_at timestamptz not null default now(),
  unique (task_id, sequence),
  check (
    (event_type = 'status_changed' and from_status is not null and to_status is not null)
    or (event_type <> 'status_changed' and from_status is null and to_status is null)
  )
);

create table private.ai_task_command_receipts (
  command_id uuid primary key,
  command_type text not null check (command_type in ('cancel_synthetic')),
  requested_by_user_id uuid not null references auth.users(id) on delete restrict,
  task_id uuid not null references public.ai_tasks(id) on delete restrict,
  command_hash text not null check (command_hash ~ '^sha256:[0-9a-f]{64}$'),
  result_status public.ai_task_status not null,
  applied boolean not null,
  created_at timestamptz not null default now()
);

create index ai_tasks_requester_created_idx
  on public.ai_tasks(requested_by_user_id, created_at desc, id);
create index ai_tasks_project_created_idx
  on public.ai_tasks(project_id, created_at desc, id)
  where project_id is not null;
create index ai_tasks_status_updated_idx
  on public.ai_tasks(status, updated_at desc, id);
create index ai_tasks_attention_idx
  on public.ai_tasks(updated_at desc, id)
  where status in ('failed', 'needs_attention');
create index ai_task_events_task_sequence_idx
  on public.ai_task_events(task_id, sequence);
create index ai_task_payloads_retention_idx
  on private.ai_task_payloads(retain_until);

create or replace function public.ai_tasks_before_update()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if old.contract_version is distinct from new.contract_version
     or old.task_type is distinct from new.task_type
     or old.agent_key is distinct from new.agent_key
     or old.agent_version is distinct from new.agent_version
     or old.capability_key is distinct from new.capability_key
     or old.capability_version is distinct from new.capability_version
     or old.policy_version is distinct from new.policy_version
     or old.safe_objective is distinct from new.safe_objective
     or old.risk_class is distinct from new.risk_class
     or old.data_classification is distinct from new.data_classification
     or old.execution_mode is distinct from new.execution_mode
     or old.effect_class is distinct from new.effect_class
     or old.requested_by_user_id is distinct from new.requested_by_user_id
     or old.project_id is distinct from new.project_id
     or old.parent_task_id is distinct from new.parent_task_id
     or old.idempotency_key is distinct from new.idempotency_key
     or old.input_snapshot_hash is distinct from new.input_snapshot_hash
     or old.max_cost_cents is distinct from new.max_cost_cents then
    raise exception 'AI task identity and frozen policy are immutable'
      using errcode = '22023';
  end if;

  if old.status is distinct from new.status
     and not public.ai_task_transition_allowed(old.status, new.status) then
    raise exception 'invalid AI task transition: % -> %', old.status, new.status
      using errcode = '22023';
  end if;

  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create trigger ai_tasks_before_update_trigger
before update on public.ai_tasks
for each row execute function public.ai_tasks_before_update();

create or replace function private.ai_task_payloads_reject_update()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception 'AI task payloads are frozen; create a new intent for changed input'
    using errcode = '22023';
end;
$$;

create trigger ai_task_payloads_immutable_trigger
before update on private.ai_task_payloads
for each row execute function private.ai_task_payloads_reject_update();

create or replace function public.ai_task_events_append_only()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception 'AI task event history is append-only' using errcode = '22023';
end;
$$;

create trigger ai_task_events_append_only_trigger
before update or delete on public.ai_task_events
for each row execute function public.ai_task_events_append_only();

create or replace function private.ai_task_command_receipts_append_only()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception 'AI task command receipts are append-only' using errcode = '22023';
end;
$$;

create trigger ai_task_command_receipts_append_only_trigger
before update or delete on private.ai_task_command_receipts
for each row execute function private.ai_task_command_receipts_append_only();

alter table public.ai_tasks enable row level security;
alter table public.ai_task_events enable row level security;
alter table private.ai_task_payloads enable row level security;
alter table private.ai_task_command_receipts enable row level security;

create policy ai_tasks_staff_safe_select
on public.ai_tasks
for select
to authenticated
using (
  public.has_portal_access()
  and (
    requested_by_user_id = (select auth.uid())
    or public.is_portal_admin()
    or (
      project_id is not null
      and exists (
        select 1
        from public.projects visible_project
        where visible_project.id = ai_tasks.project_id
      )
    )
  )
);

create policy ai_task_events_staff_safe_select
on public.ai_task_events
for select
to authenticated
using (
  exists (
    select 1
    from public.ai_tasks visible_task
    where visible_task.id = ai_task_events.task_id
  )
);

create or replace function public.ai_task_create_synthetic(
  p_idempotency_key text,
  p_fixture_key text default 'echo_v1'
)
returns table (
  created_task_id uuid,
  created_status public.ai_task_status,
  created_input_snapshot_hash text,
  was_replayed boolean
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_actor uuid := auth.uid();
  v_now timestamptz := statement_timestamp();
  v_task_type text;
  v_capability_key text;
  v_safe_objective text;
  v_private_objective text;
  v_payload jsonb;
  v_snapshot jsonb;
  v_hash text;
  v_existing public.ai_tasks%rowtype;
  v_task_id uuid;
begin
  if v_actor is null or not public.has_portal_access() then
    raise exception 'staff authentication is required' using errcode = '42501';
  end if;
  if p_idempotency_key is null
     or length(p_idempotency_key) not between 1 and 120
     or p_idempotency_key !~ '^[a-z][a-z0-9._-]*$' then
    raise exception 'invalid AI task idempotency key' using errcode = '22023';
  end if;
  if p_fixture_key is null
     or p_fixture_key not in ('echo_v1', 'classification_v1') then
    raise exception 'unsupported synthetic fixture' using errcode = '22023';
  end if;

  if p_fixture_key = 'echo_v1' then
    v_task_type := 'synthetic.echo';
    v_capability_key := 'synthetic.echo';
    v_safe_objective := 'Run the deterministic echo fixture.';
    v_private_objective := 'Return the fixed SYNTHETIC_OK fixture result.';
    v_payload := jsonb_build_object(
      'fixtureKey', p_fixture_key,
      'expectedResultCode', 'SYNTHETIC_OK'
    );
  else
    v_task_type := 'synthetic.classification';
    v_capability_key := 'synthetic.classification';
    v_safe_objective := 'Run the deterministic classification fixture.';
    v_private_objective := 'Classify the fixed fixture as SYNTHETIC_ONLY.';
    v_payload := jsonb_build_object(
      'fixtureKey', p_fixture_key,
      'expectedClassification', 'SYNTHETIC_ONLY'
    );
  end if;

  v_snapshot := jsonb_build_object(
    'contractVersion', 1,
    'taskType', v_task_type,
    'agentKey', 'sanctuary.synthetic',
    'agentVersion', '1.0.0',
    'capabilityKey', v_capability_key,
    'capabilityVersion', '1.0.0',
    'policyVersion', '1.0.0',
    'safeObjective', v_safe_objective,
    'privateObjective', v_private_objective,
    'riskClass', 'low',
    'dataClassification', 'internal',
    'executionMode', 'synthetic',
    'effectClass', 'none',
    'maxCostCents', 0,
    'payload', v_payload
  );
  v_hash := 'sha256:' || encode(
    extensions.digest(convert_to(v_snapshot::text, 'UTF8'), 'sha256'),
    'hex'
  );

  perform pg_advisory_xact_lock(
    hashtextextended('ai-task-create:' || v_actor::text || ':' || p_idempotency_key, 0)
  );

  select task.*
  into v_existing
  from public.ai_tasks task
  where task.requested_by_user_id = v_actor
    and task.idempotency_key = p_idempotency_key
  for update;

  if found then
    if v_existing.input_snapshot_hash <> v_hash then
      raise exception 'AI task idempotency key was reused with changed input'
        using errcode = '23505';
    end if;
    if not exists (
      select 1
      from private.ai_task_payloads payload
      where payload.task_id = v_existing.id
        and payload.input_snapshot_hash = v_hash
    ) then
      raise exception 'AI task private payload identity is missing or inconsistent'
        using errcode = '55000';
    end if;
    return query
    select v_existing.id, v_existing.status, v_existing.input_snapshot_hash, true;
    return;
  end if;

  insert into public.ai_tasks (
    contract_version,
    task_type,
    agent_key,
    agent_version,
    capability_key,
    capability_version,
    policy_version,
    safe_objective,
    status,
    risk_class,
    data_classification,
    execution_mode,
    effect_class,
    requested_by_user_id,
    idempotency_key,
    input_snapshot_hash,
    max_cost_cents,
    actual_cost_cents,
    created_at,
    updated_at
  ) values (
    1,
    v_task_type,
    'sanctuary.synthetic',
    '1.0.0',
    v_capability_key,
    '1.0.0',
    '1.0.0',
    v_safe_objective,
    'proposed',
    'low',
    'internal',
    'synthetic',
    'none',
    v_actor,
    p_idempotency_key,
    v_hash,
    0,
    0,
    v_now,
    v_now
  )
  returning id into v_task_id;

  insert into private.ai_task_payloads (
    task_id,
    contract_version,
    input_snapshot_hash,
    objective,
    payload,
    created_at,
    retain_until
  ) values (
    v_task_id,
    1,
    v_hash,
    v_private_objective,
    v_payload,
    v_now,
    v_now + interval '7 days'
  );

  insert into public.ai_task_events (
    task_id,
    sequence,
    event_type,
    actor_kind,
    actor_key,
    actor_user_id,
    safe_summary,
    created_at
  ) values (
    v_task_id,
    1,
    'created',
    'human',
    'portal.staff',
    v_actor,
    'Synthetic task created.',
    v_now
  );

  return query select v_task_id, 'proposed'::public.ai_task_status, v_hash, false;
end;
$$;

create or replace function public.ai_task_cancel_synthetic(
  p_task_id uuid,
  p_command_id uuid,
  p_reason_code text default 'operator_requested'
)
returns table (
  cancelled_task_id uuid,
  cancelled_status public.ai_task_status,
  was_replayed boolean,
  was_already_applied boolean
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_actor uuid := auth.uid();
  v_now timestamptz := statement_timestamp();
  v_command_hash text;
  v_receipt private.ai_task_command_receipts%rowtype;
  v_task public.ai_tasks%rowtype;
  v_sequence integer;
  v_applied boolean := false;
  v_already_applied boolean := false;
begin
  if v_actor is null or not public.has_portal_access() then
    raise exception 'staff authentication is required' using errcode = '42501';
  end if;
  if p_task_id is null or p_command_id is null then
    raise exception 'task and command IDs are required' using errcode = '22004';
  end if;
  if p_reason_code is null
     or p_reason_code not in ('operator_requested', 'superseded', 'test_cleanup') then
    raise exception 'unsupported cancellation reason' using errcode = '22023';
  end if;

  v_command_hash := 'sha256:' || encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'taskId', p_task_id,
          'reasonCode', p_reason_code
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );

  perform pg_advisory_xact_lock(hashtextextended('ai-task-cancel:' || p_command_id::text, 0));

  select receipt.*
  into v_receipt
  from private.ai_task_command_receipts receipt
  where receipt.command_id = p_command_id;

  if found then
    if v_receipt.requested_by_user_id <> v_actor
       or v_receipt.task_id <> p_task_id
       or v_receipt.command_hash <> v_command_hash then
      raise exception 'AI task command ID was reused with changed input or authority'
        using errcode = '23505';
    end if;
    return query
    select v_receipt.task_id, v_receipt.result_status, true, not v_receipt.applied;
    return;
  end if;

  select task.*
  into v_task
  from public.ai_tasks task
  where task.id = p_task_id
  for update;

  if not found then
    raise exception 'AI task not found' using errcode = 'P0002';
  end if;
  if v_task.execution_mode <> 'synthetic' or v_task.effect_class <> 'none' then
    raise exception 'only effect-free synthetic tasks are supported'
      using errcode = '42501';
  end if;
  if v_task.requested_by_user_id <> v_actor and not public.is_portal_admin() then
    raise exception 'task cancellation requires the requester or an admin'
      using errcode = '42501';
  end if;

  if v_task.status = 'cancelled' then
    v_already_applied := true;
  elsif v_task.status in ('proposed', 'approved', 'queued') then
    update public.ai_tasks
    set status = 'cancelled',
        cancellation_reason_code = p_reason_code,
        cancelled_by_user_id = v_actor,
        cancelled_at = v_now,
        completed_at = v_now
    where id = p_task_id;

    select coalesce(max(event.sequence), 0) + 1
    into v_sequence
    from public.ai_task_events event
    where event.task_id = p_task_id;

    insert into public.ai_task_events (
      task_id,
      sequence,
      event_type,
      from_status,
      to_status,
      actor_kind,
      actor_key,
      actor_user_id,
      safe_summary,
      created_at
    ) values (
      p_task_id,
      v_sequence,
      'status_changed',
      v_task.status,
      'cancelled',
      'human',
      'portal.staff',
      v_actor,
      'Synthetic task cancelled.',
      v_now
    );
    v_applied := true;
  else
    raise exception 'AI task cannot be cancelled from status %', v_task.status
      using errcode = '22023';
  end if;

  insert into private.ai_task_command_receipts (
    command_id,
    command_type,
    requested_by_user_id,
    task_id,
    command_hash,
    result_status,
    applied,
    created_at
  ) values (
    p_command_id,
    'cancel_synthetic',
    v_actor,
    p_task_id,
    v_command_hash,
    'cancelled',
    v_applied,
    v_now
  );

  return query
  select p_task_id, 'cancelled'::public.ai_task_status, false, v_already_applied;
end;
$$;

revoke all on table public.ai_tasks from public, anon, authenticated, service_role;
revoke all on table public.ai_task_events from public, anon, authenticated, service_role;
revoke all on sequence public.ai_task_events_id_seq from public, anon, authenticated, service_role;
revoke all on table private.ai_task_payloads from public, anon, authenticated, service_role;
revoke all on table private.ai_task_command_receipts from public, anon, authenticated, service_role;

grant select on table public.ai_tasks to authenticated;
grant select on table public.ai_task_events to authenticated;

revoke all on type public.ai_task_status from public, anon, authenticated, service_role;
revoke all on type public.ai_task_event_type from public, anon, authenticated, service_role;
revoke all on type public.ai_task_risk_class from public, anon, authenticated, service_role;
revoke all on type public.ai_data_classification from public, anon, authenticated, service_role;
grant usage on type public.ai_task_status to authenticated;
grant usage on type public.ai_task_event_type to authenticated;
grant usage on type public.ai_task_risk_class to authenticated;
grant usage on type public.ai_data_classification to authenticated;

revoke all on function public.ai_task_transition_allowed(public.ai_task_status, public.ai_task_status)
  from public, anon, authenticated, service_role;
revoke all on function public.ai_task_safe_text(text, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.ai_tasks_before_update()
  from public, anon, authenticated, service_role;
revoke all on function private.ai_task_payloads_reject_update()
  from public, anon, authenticated, service_role;
revoke all on function public.ai_task_events_append_only()
  from public, anon, authenticated, service_role;
revoke all on function private.ai_task_command_receipts_append_only()
  from public, anon, authenticated, service_role;
revoke all on function public.ai_task_create_synthetic(text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.ai_task_cancel_synthetic(uuid, uuid, text)
  from public, anon, authenticated, service_role;

grant execute on function public.ai_task_create_synthetic(text, text) to authenticated;
grant execute on function public.ai_task_cancel_synthetic(uuid, uuid, text) to authenticated;

notify pgrst, 'reload schema';
