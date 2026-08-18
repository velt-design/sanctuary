-- PR-AI-005: exact, expiring, single-use approval envelopes.
-- This slice records only a deterministic synthetic receipt. It authorises no
-- customer/project mutation, external communication, provider call, or spend.

create type public.ai_approval_status as enum (
  'pending',
  'approved',
  'rejected',
  'consumed',
  'invalidated',
  'expired'
);

create type public.ai_approval_decision as enum (
  'approved',
  'rejected'
);

create table public.ai_approvals (
  id uuid primary key default gen_random_uuid(),
  contract_version integer not null default 1 check (contract_version = 1),
  task_id uuid not null references public.ai_tasks(id) on delete restrict,
  action_type text not null default 'synthetic.effect' check (
    action_type = 'synthetic.effect'
  ),
  target_type text not null default 'synthetic.fixture' check (
    target_type = 'synthetic.fixture'
  ),
  target_id text not null check (
    length(target_id) between 1 and 160
    and target_id ~ '^[a-z0-9][a-z0-9._:-]*$'
  ),
  payload_hash text not null check (payload_hash ~ '^sha256:[0-9a-f]{64}$'),
  payload_summary text not null check (
    public.ai_task_safe_text(payload_summary, 500)
  ),
  required_role text not null default 'admin' check (required_role = 'admin'),
  requested_by_kind text not null default 'agent' check (
    requested_by_kind = 'agent'
  ),
  requested_by_key text not null default 'sanctuary.synthetic' check (
    requested_by_key = 'sanctuary.synthetic'
  ),
  requested_by_user_id uuid not null references auth.users(id) on delete restrict,
  requested_at timestamptz not null default now(),
  expires_at timestamptz not null,
  single_use boolean not null default true check (single_use),
  impact jsonb not null check (
    jsonb_typeof(impact) = 'array'
    and jsonb_array_length(impact) between 1 and 20
    and octet_length(impact::text) <= 4096
  ),
  validations jsonb not null check (
    jsonb_typeof(validations) = 'array'
    and jsonb_array_length(validations) between 1 and 50
    and octet_length(validations::text) <= 8192
  ),
  status public.ai_approval_status not null default 'pending',
  decision public.ai_approval_decision null,
  decided_by_user_id uuid null references auth.users(id) on delete restrict,
  decided_by_role text null check (
    decided_by_role is null or decided_by_role = 'admin'
  ),
  decided_at timestamptz null,
  consumed_by_user_id uuid null references auth.users(id) on delete restrict,
  consumed_at timestamptz null,
  invalidated_by_user_id uuid null references auth.users(id) on delete restrict,
  invalidated_at timestamptz null,
  invalidation_reason_code text null check (
    invalidation_reason_code is null
    or invalidation_reason_code in (
      'payload_changed',
      'task_cancelled',
      'superseded',
      'test_cleanup'
    )
  ),
  expired_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > requested_at and expires_at <= requested_at + interval '30 minutes'),
  check (updated_at >= created_at),
  check (decided_at is null or decided_at >= requested_at),
  check (consumed_at is null or consumed_at >= decided_at),
  check (invalidated_at is null or invalidated_at >= requested_at),
  check (expired_at is null or expired_at >= requested_at),
  check (
    (decision is null and decided_by_user_id is null and decided_by_role is null and decided_at is null)
    or
    (decision is not null and decided_by_user_id is not null and decided_by_role is not null and decided_at is not null)
  ),
  check (
    (status = 'pending' and decision is null)
    or (status = 'approved' and decision = 'approved')
    or (status = 'rejected' and decision = 'rejected')
    or (status = 'consumed' and decision = 'approved')
    or (status in ('invalidated', 'expired') and decision is distinct from 'rejected')
  ),
  check (
    (status = 'consumed' and consumed_by_user_id is not null and consumed_at is not null)
    or (status <> 'consumed' and consumed_by_user_id is null and consumed_at is null)
  ),
  check (
    (
      status = 'invalidated'
      and invalidated_by_user_id is not null
      and invalidated_at is not null
      and invalidation_reason_code is not null
    )
    or (
      status <> 'invalidated'
      and invalidated_by_user_id is null
      and invalidated_at is null
      and invalidation_reason_code is null
    )
  ),
  check (
    (status = 'expired' and expired_at is not null)
    or (status <> 'expired' and expired_at is null)
  )
);

create unique index ai_approvals_one_active_exact_envelope_idx
  on public.ai_approvals(task_id, action_type, payload_hash)
  where status in ('pending', 'approved');
create index ai_approvals_task_requested_idx
  on public.ai_approvals(task_id, requested_at desc, id);
create index ai_approvals_inbox_idx
  on public.ai_approvals(status, expires_at, requested_at, id)
  where status in ('pending', 'approved');
create index ai_approvals_requester_idx
  on public.ai_approvals(requested_by_user_id, requested_at desc, id);

create table private.ai_approval_envelopes (
  approval_id uuid primary key references public.ai_approvals(id) on delete cascade,
  contract_version integer not null default 1 check (contract_version = 1),
  payload_hash text not null check (payload_hash ~ '^sha256:[0-9a-f]{64}$'),
  payload jsonb not null check (
    jsonb_typeof(payload) = 'object'
    and octet_length(payload::text) <= 65536
  ),
  created_at timestamptz not null default now(),
  retain_until timestamptz not null default (now() + interval '30 days'),
  check (retain_until >= created_at and retain_until <= created_at + interval '90 days')
);

create index ai_approval_envelopes_retention_idx
  on private.ai_approval_envelopes(retain_until);

create table private.ai_approval_command_receipts (
  command_id uuid primary key,
  command_type text not null check (
    command_type in ('request', 'approve', 'reject', 'consume', 'invalidate')
  ),
  requested_by_user_id uuid not null references auth.users(id) on delete restrict,
  task_id uuid not null references public.ai_tasks(id) on delete restrict,
  approval_id uuid not null references public.ai_approvals(id) on delete restrict,
  command_hash text not null check (command_hash ~ '^sha256:[0-9a-f]{64}$'),
  result_status public.ai_approval_status not null,
  applied boolean not null,
  created_at timestamptz not null default now()
);

create index ai_approval_command_receipts_approval_idx
  on private.ai_approval_command_receipts(approval_id, created_at, command_id);

create or replace function public.ai_approval_transition_allowed(
  p_from public.ai_approval_status,
  p_to public.ai_approval_status
)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select p_from = p_to or case p_from
    when 'pending' then p_to in ('approved', 'rejected', 'invalidated', 'expired')
    when 'approved' then p_to in ('consumed', 'invalidated', 'expired')
    else false
  end;
$$;

create or replace function public.ai_approvals_before_update()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if old.contract_version is distinct from new.contract_version
     or old.task_id is distinct from new.task_id
     or old.action_type is distinct from new.action_type
     or old.target_type is distinct from new.target_type
     or old.target_id is distinct from new.target_id
     or old.payload_hash is distinct from new.payload_hash
     or old.payload_summary is distinct from new.payload_summary
     or old.required_role is distinct from new.required_role
     or old.requested_by_kind is distinct from new.requested_by_kind
     or old.requested_by_key is distinct from new.requested_by_key
     or old.requested_by_user_id is distinct from new.requested_by_user_id
     or old.requested_at is distinct from new.requested_at
     or old.expires_at is distinct from new.expires_at
     or old.single_use is distinct from new.single_use
     or old.impact is distinct from new.impact
     or old.validations is distinct from new.validations
     or old.created_at is distinct from new.created_at then
    raise exception 'AI approval identity and frozen envelope metadata are immutable'
      using errcode = '22023';
  end if;

  if old.status is distinct from new.status
     and not public.ai_approval_transition_allowed(old.status, new.status) then
    raise exception 'invalid AI approval transition: % -> %', old.status, new.status
      using errcode = '22023';
  end if;

  if (old.decision is not null and old.decision is distinct from new.decision)
     or (
       old.decided_by_user_id is not null
       and old.decided_by_user_id is distinct from new.decided_by_user_id
     )
     or (
       old.decided_by_role is not null
       and old.decided_by_role is distinct from new.decided_by_role
     )
     or (old.decided_at is not null and old.decided_at is distinct from new.decided_at)
     or (
       old.consumed_by_user_id is not null
       and old.consumed_by_user_id is distinct from new.consumed_by_user_id
     )
     or (old.consumed_at is not null and old.consumed_at is distinct from new.consumed_at)
     or (
       old.invalidated_by_user_id is not null
       and old.invalidated_by_user_id is distinct from new.invalidated_by_user_id
     )
     or (
       old.invalidated_at is not null
       and old.invalidated_at is distinct from new.invalidated_at
     )
     or (
       old.invalidation_reason_code is not null
       and old.invalidation_reason_code is distinct from new.invalidation_reason_code
     )
     or (old.expired_at is not null and old.expired_at is distinct from new.expired_at) then
    raise exception 'recorded AI approval decision evidence is immutable'
      using errcode = '22023';
  end if;

  if old.status is not distinct from new.status
     and (
       old.decision is distinct from new.decision
       or old.decided_by_user_id is distinct from new.decided_by_user_id
       or old.decided_by_role is distinct from new.decided_by_role
       or old.decided_at is distinct from new.decided_at
       or old.consumed_by_user_id is distinct from new.consumed_by_user_id
       or old.consumed_at is distinct from new.consumed_at
       or old.invalidated_by_user_id is distinct from new.invalidated_by_user_id
       or old.invalidated_at is distinct from new.invalidated_at
       or old.invalidation_reason_code is distinct from new.invalidation_reason_code
       or old.expired_at is distinct from new.expired_at
     ) then
    raise exception 'AI approval evidence may change only with a valid status transition'
      using errcode = '22023';
  end if;

  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create trigger ai_approvals_before_update_trigger
before update on public.ai_approvals
for each row execute function public.ai_approvals_before_update();

create or replace function private.ai_approval_envelopes_reject_update()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception 'AI approval envelopes are frozen' using errcode = '22023';
end;
$$;

create trigger ai_approval_envelopes_immutable_trigger
before update on private.ai_approval_envelopes
for each row execute function private.ai_approval_envelopes_reject_update();

create or replace function private.ai_approval_command_receipts_append_only()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception 'AI approval command receipts are append-only'
    using errcode = '22023';
end;
$$;

create trigger ai_approval_command_receipts_append_only_trigger
before update or delete on private.ai_approval_command_receipts
for each row execute function private.ai_approval_command_receipts_append_only();

create or replace function private.ai_approval_command_hash(p_value jsonb)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select 'sha256:' || encode(
    extensions.digest(convert_to(p_value::text, 'UTF8'), 'sha256'),
    'hex'
  );
$$;

create or replace function private.ai_approval_append_task_event(
  p_task_id uuid,
  p_event_type public.ai_task_event_type,
  p_actor_kind text,
  p_actor_key text,
  p_actor_user_id uuid,
  p_safe_summary text,
  p_created_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_sequence integer;
begin
  select coalesce(max(event.sequence), 0) + 1
  into v_sequence
  from public.ai_task_events event
  where event.task_id = p_task_id;

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
    p_task_id,
    v_sequence,
    p_event_type,
    p_actor_kind,
    p_actor_key,
    p_actor_user_id,
    p_safe_summary,
    p_created_at
  );
end;
$$;

alter table public.ai_approvals enable row level security;
alter table private.ai_approval_envelopes enable row level security;
alter table private.ai_approval_command_receipts enable row level security;

create policy ai_approvals_staff_safe_select
on public.ai_approvals
for select
to authenticated
using (
  exists (
    select 1
    from public.ai_tasks visible_task
    where visible_task.id = ai_approvals.task_id
  )
);

create or replace function public.ai_approval_request_synthetic(
  p_task_id uuid,
  p_command_id uuid,
  p_ttl_seconds integer default 900
)
returns table (
  requested_approval_id uuid,
  requested_status public.ai_approval_status,
  requested_payload_hash text,
  requested_expires_at timestamptz,
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
  v_receipt private.ai_approval_command_receipts%rowtype;
  v_task public.ai_tasks%rowtype;
  v_task_payload private.ai_task_payloads%rowtype;
  v_action_payload jsonb;
  v_payload_hash text;
  v_approval public.ai_approvals%rowtype;
  v_approval_id uuid;
  v_expires_at timestamptz;
begin
  if v_actor is null or not public.has_portal_access() then
    raise exception 'staff authentication is required' using errcode = '42501';
  end if;
  if p_task_id is null or p_command_id is null then
    raise exception 'task and command IDs are required' using errcode = '22004';
  end if;
  if p_ttl_seconds is null or p_ttl_seconds not between 1 and 1800 then
    raise exception 'approval TTL must be between 1 and 1800 seconds'
      using errcode = '22023';
  end if;

  v_command_hash := private.ai_approval_command_hash(jsonb_build_object(
    'commandType', 'request',
    'taskId', p_task_id,
    'ttlSeconds', p_ttl_seconds
  ));
  perform pg_advisory_xact_lock(hashtextextended(
    'ai-approval-command:' || p_command_id::text,
    0
  ));

  select receipt.*
  into v_receipt
  from private.ai_approval_command_receipts receipt
  where receipt.command_id = p_command_id;

  if found then
    if v_receipt.command_type <> 'request'
       or v_receipt.requested_by_user_id <> v_actor
       or v_receipt.task_id <> p_task_id
       or v_receipt.command_hash <> v_command_hash then
      raise exception 'AI approval command ID was reused with changed input or authority'
        using errcode = '23505';
    end if;
    select approval.* into strict v_approval
    from public.ai_approvals approval
    where approval.id = v_receipt.approval_id;
    return query select
      v_receipt.approval_id,
      v_receipt.result_status,
      v_approval.payload_hash,
      v_approval.expires_at,
      true,
      not v_receipt.applied;
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
  if v_task.status in ('rejected', 'succeeded', 'cancelled', 'evaluated') then
    raise exception 'task status % cannot request approval', v_task.status
      using errcode = '22023';
  end if;
  if v_task.requested_by_user_id <> v_actor and not public.is_portal_admin() then
    raise exception 'approval request requires the task requester or an admin'
      using errcode = '42501';
  end if;

  select payload.*
  into strict v_task_payload
  from private.ai_task_payloads payload
  where payload.task_id = p_task_id;

  if v_task_payload.input_snapshot_hash <> v_task.input_snapshot_hash then
    raise exception 'AI task payload identity is inconsistent' using errcode = '55000';
  end if;

  v_action_payload := jsonb_build_object(
    'contractVersion', 1,
    'taskId', p_task_id,
    'actionType', 'synthetic.effect',
    'targetType', 'synthetic.fixture',
    'targetId', v_task_payload.payload ->> 'fixtureKey',
    'taskInputSnapshotHash', v_task.input_snapshot_hash,
    'effectClass', 'none',
    'effectIdentity', 'synthetic-receipt:' || p_task_id::text
  );
  v_payload_hash := private.ai_approval_command_hash(v_action_payload);
  v_expires_at := v_now + make_interval(secs => p_ttl_seconds);

  select approval.*
  into v_approval
  from public.ai_approvals approval
  where approval.task_id = p_task_id
    and approval.action_type = 'synthetic.effect'
    and approval.payload_hash = v_payload_hash
    and approval.status in ('pending', 'approved')
  for update;

  if found and v_approval.expires_at <= v_now then
    update public.ai_approvals
    set status = 'expired', expired_at = v_now
    where id = v_approval.id;
    perform private.ai_approval_append_task_event(
      p_task_id,
      'approval_decided',
      'service',
      'sanctuary.policy',
      null,
      'Synthetic approval expired.',
      v_now
    );
    v_approval.id := null;
  end if;

  if v_approval.id is not null then
    insert into private.ai_approval_command_receipts (
      command_id,
      command_type,
      requested_by_user_id,
      task_id,
      approval_id,
      command_hash,
      result_status,
      applied,
      created_at
    ) values (
      p_command_id,
      'request',
      v_actor,
      p_task_id,
      v_approval.id,
      v_command_hash,
      v_approval.status,
      false,
      v_now
    );
    return query select
      v_approval.id,
      v_approval.status,
      v_approval.payload_hash,
      v_approval.expires_at,
      false,
      true;
    return;
  end if;

  insert into public.ai_approvals (
    task_id,
    target_id,
    payload_hash,
    payload_summary,
    requested_by_user_id,
    requested_at,
    expires_at,
    impact,
    validations,
    created_at,
    updated_at
  ) values (
    p_task_id,
    v_task_payload.payload ->> 'fixtureKey',
    v_payload_hash,
    'Record one deterministic synthetic effect receipt.',
    v_actor,
    v_now,
    v_expires_at,
    jsonb_build_array('Creates one synthetic audit receipt only.'),
    jsonb_build_array(
      jsonb_build_object(
        'validationKey', 'synthetic.only',
        'passed', true,
        'evidenceId', null
      ),
      jsonb_build_object(
        'validationKey', 'effect.none',
        'passed', true,
        'evidenceId', null
      )
    ),
    v_now,
    v_now
  )
  returning id into v_approval_id;

  insert into private.ai_approval_envelopes (
    approval_id,
    payload_hash,
    payload,
    created_at,
    retain_until
  ) values (
    v_approval_id,
    v_payload_hash,
    v_action_payload,
    v_now,
    v_now + interval '30 days'
  );

  perform private.ai_approval_append_task_event(
    p_task_id,
    'approval_requested',
    'agent',
    'sanctuary.synthetic',
    null,
    'Exact synthetic approval requested.',
    v_now
  );

  insert into private.ai_approval_command_receipts (
    command_id,
    command_type,
    requested_by_user_id,
    task_id,
    approval_id,
    command_hash,
    result_status,
    applied,
    created_at
  ) values (
    p_command_id,
    'request',
    v_actor,
    p_task_id,
    v_approval_id,
    v_command_hash,
    'pending',
    true,
    v_now
  );

  return query select
    v_approval_id,
    'pending'::public.ai_approval_status,
    v_payload_hash,
    v_expires_at,
    false,
    false;
end;
$$;

create or replace function public.ai_approval_decide_synthetic(
  p_approval_id uuid,
  p_command_id uuid,
  p_decision text
)
returns table (
  decided_approval_id uuid,
  decided_status public.ai_approval_status,
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
  v_command_type text;
  v_command_hash text;
  v_receipt private.ai_approval_command_receipts%rowtype;
  v_approval public.ai_approvals%rowtype;
  v_result_status public.ai_approval_status;
  v_applied boolean := false;
  v_already boolean := false;
begin
  if v_actor is null or not public.has_portal_access() or not public.is_portal_admin() then
    raise exception 'admin authentication is required' using errcode = '42501';
  end if;
  if p_approval_id is null or p_command_id is null then
    raise exception 'approval and command IDs are required' using errcode = '22004';
  end if;
  if p_decision is null or p_decision not in ('approved', 'rejected') then
    raise exception 'decision must be approved or rejected' using errcode = '22023';
  end if;

  v_command_type := case p_decision when 'approved' then 'approve' else 'reject' end;
  v_command_hash := private.ai_approval_command_hash(jsonb_build_object(
    'commandType', v_command_type,
    'approvalId', p_approval_id,
    'decision', p_decision
  ));
  perform pg_advisory_xact_lock(hashtextextended(
    'ai-approval-command:' || p_command_id::text,
    0
  ));

  select receipt.* into v_receipt
  from private.ai_approval_command_receipts receipt
  where receipt.command_id = p_command_id;

  if found then
    if v_receipt.command_type <> v_command_type
       or v_receipt.requested_by_user_id <> v_actor
       or v_receipt.approval_id <> p_approval_id
       or v_receipt.command_hash <> v_command_hash then
      raise exception 'AI approval command ID was reused with changed input or authority'
        using errcode = '23505';
    end if;
    return query select
      p_approval_id,
      v_receipt.result_status,
      true,
      not v_receipt.applied;
    return;
  end if;

  select approval.* into v_approval
  from public.ai_approvals approval
  where approval.id = p_approval_id;
  if not found then
    raise exception 'AI approval not found' using errcode = 'P0002';
  end if;
  perform 1 from public.ai_tasks task where task.id = v_approval.task_id for update;
  select approval.* into strict v_approval
  from public.ai_approvals approval
  where approval.id = p_approval_id
  for update;

  if v_approval.required_role <> 'admin' then
    raise exception 'approval requires unsupported role %', v_approval.required_role
      using errcode = '42501';
  end if;

  if v_approval.status in ('pending', 'approved') and v_approval.expires_at <= v_now then
    update public.ai_approvals
    set status = 'expired', expired_at = v_now
    where id = p_approval_id;
    v_result_status := 'expired';
    v_applied := true;
    perform private.ai_approval_append_task_event(
      v_approval.task_id,
      'approval_decided',
      'service',
      'sanctuary.policy',
      null,
      'Synthetic approval expired.',
      v_now
    );
  elsif v_approval.status = 'pending' then
    update public.ai_approvals
    set status = p_decision::public.ai_approval_status,
        decision = p_decision::public.ai_approval_decision,
        decided_by_user_id = v_actor,
        decided_by_role = 'admin',
        decided_at = v_now
    where id = p_approval_id;
    v_result_status := p_decision::public.ai_approval_status;
    v_applied := true;
    perform private.ai_approval_append_task_event(
      v_approval.task_id,
      'approval_decided',
      'human',
      'portal.admin',
      v_actor,
      case p_decision
        when 'approved' then 'Exact synthetic approval granted.'
        else 'Exact synthetic approval rejected.'
      end,
      v_now
    );
  elsif v_approval.status::text = p_decision then
    v_result_status := v_approval.status;
    v_already := true;
  else
    raise exception 'approval cannot be decided from status %', v_approval.status
      using errcode = '22023';
  end if;

  insert into private.ai_approval_command_receipts (
    command_id, command_type, requested_by_user_id, task_id, approval_id,
    command_hash, result_status, applied, created_at
  ) values (
    p_command_id, v_command_type, v_actor, v_approval.task_id, p_approval_id,
    v_command_hash, v_result_status, v_applied, v_now
  );

  return query select p_approval_id, v_result_status, false, v_already;
end;
$$;

create or replace function public.ai_approval_consume_synthetic(
  p_approval_id uuid,
  p_command_id uuid,
  p_expected_payload_hash text
)
returns table (
  consumed_approval_id uuid,
  consumed_status public.ai_approval_status,
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
  v_receipt private.ai_approval_command_receipts%rowtype;
  v_approval public.ai_approvals%rowtype;
  v_envelope private.ai_approval_envelopes%rowtype;
  v_task public.ai_tasks%rowtype;
  v_result_status public.ai_approval_status;
begin
  if v_actor is null or not public.has_portal_access() or not public.is_portal_admin() then
    raise exception 'admin authentication is required' using errcode = '42501';
  end if;
  if p_approval_id is null or p_command_id is null then
    raise exception 'approval and command IDs are required' using errcode = '22004';
  end if;
  if p_expected_payload_hash is null
     or p_expected_payload_hash !~ '^sha256:[0-9a-f]{64}$' then
    raise exception 'valid expected payload hash is required' using errcode = '22023';
  end if;

  v_command_hash := private.ai_approval_command_hash(jsonb_build_object(
    'commandType', 'consume',
    'approvalId', p_approval_id,
    'expectedPayloadHash', p_expected_payload_hash
  ));
  perform pg_advisory_xact_lock(hashtextextended(
    'ai-approval-command:' || p_command_id::text,
    0
  ));

  select receipt.* into v_receipt
  from private.ai_approval_command_receipts receipt
  where receipt.command_id = p_command_id;

  if found then
    if v_receipt.command_type <> 'consume'
       or v_receipt.requested_by_user_id <> v_actor
       or v_receipt.approval_id <> p_approval_id
       or v_receipt.command_hash <> v_command_hash then
      raise exception 'AI approval command ID was reused with changed input or authority'
        using errcode = '23505';
    end if;
    return query select
      p_approval_id,
      v_receipt.result_status,
      true,
      not v_receipt.applied;
    return;
  end if;

  select approval.* into v_approval
  from public.ai_approvals approval
  where approval.id = p_approval_id;
  if not found then
    raise exception 'AI approval not found' using errcode = 'P0002';
  end if;
  select task.* into strict v_task
  from public.ai_tasks task
  where task.id = v_approval.task_id
  for update;
  select approval.* into strict v_approval
  from public.ai_approvals approval
  where approval.id = p_approval_id
  for update;
  select envelope.* into strict v_envelope
  from private.ai_approval_envelopes envelope
  where envelope.approval_id = p_approval_id;

  if v_approval.payload_hash <> p_expected_payload_hash
     or v_envelope.payload_hash <> p_expected_payload_hash
     or v_envelope.payload ->> 'taskInputSnapshotHash' <> v_task.input_snapshot_hash then
    raise exception 'approval payload hash or frozen task input changed'
      using errcode = '22023';
  end if;
  if v_approval.status in ('pending', 'approved') and v_approval.expires_at <= v_now then
    update public.ai_approvals
    set status = 'expired', expired_at = v_now
    where id = p_approval_id;
    v_result_status := 'expired';
    perform private.ai_approval_append_task_event(
      v_approval.task_id,
      'approval_decided',
      'service',
      'sanctuary.policy',
      null,
      'Synthetic approval expired.',
      v_now
    );
  elsif v_task.status = 'cancelled' and v_approval.status in ('pending', 'approved') then
    update public.ai_approvals
    set status = 'invalidated',
        invalidated_by_user_id = v_actor,
        invalidated_at = v_now,
        invalidation_reason_code = 'task_cancelled'
    where id = p_approval_id;
    v_result_status := 'invalidated';
    perform private.ai_approval_append_task_event(
      v_approval.task_id,
      'approval_decided',
      'service',
      'sanctuary.policy',
      null,
      'Synthetic approval invalidated after task cancellation.',
      v_now
    );
  elsif v_approval.status = 'consumed' then
    raise exception 'approval is single-use and was already consumed'
      using errcode = '23505';
  elsif v_approval.status <> 'approved' or v_approval.decision <> 'approved' then
    raise exception 'approval cannot be consumed from status %', v_approval.status
      using errcode = '22023';
  elsif v_approval.required_role <> 'admin'
        or v_approval.decided_by_role is distinct from 'admin' then
    raise exception 'approval authority does not satisfy the required role'
      using errcode = '42501';
  else
    update public.ai_approvals
    set status = 'consumed',
        consumed_by_user_id = v_actor,
        consumed_at = v_now
    where id = p_approval_id;
    v_result_status := 'consumed';
    perform private.ai_approval_append_task_event(
      v_approval.task_id,
      'result_recorded',
      'human',
      'portal.admin',
      v_actor,
      'Synthetic approval consumed; no external effect occurred.',
      v_now
    );
  end if;

  insert into private.ai_approval_command_receipts (
    command_id, command_type, requested_by_user_id, task_id, approval_id,
    command_hash, result_status, applied, created_at
  ) values (
    p_command_id, 'consume', v_actor, v_approval.task_id, p_approval_id,
    v_command_hash, v_result_status, true, v_now
  );

  return query select p_approval_id, v_result_status, false, false;
end;
$$;

create or replace function public.ai_approval_invalidate_synthetic(
  p_approval_id uuid,
  p_command_id uuid,
  p_expected_payload_hash text,
  p_reason_code text default 'superseded'
)
returns table (
  invalidated_approval_id uuid,
  invalidated_status public.ai_approval_status,
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
  v_receipt private.ai_approval_command_receipts%rowtype;
  v_approval public.ai_approvals%rowtype;
  v_envelope private.ai_approval_envelopes%rowtype;
  v_task public.ai_tasks%rowtype;
  v_already boolean := false;
begin
  if v_actor is null or not public.has_portal_access() then
    raise exception 'staff authentication is required' using errcode = '42501';
  end if;
  if p_approval_id is null or p_command_id is null then
    raise exception 'approval and command IDs are required' using errcode = '22004';
  end if;
  if p_expected_payload_hash is null
     or p_expected_payload_hash !~ '^sha256:[0-9a-f]{64}$' then
    raise exception 'valid expected payload hash is required' using errcode = '22023';
  end if;
  if p_reason_code is null
     or p_reason_code not in ('payload_changed', 'task_cancelled', 'superseded', 'test_cleanup') then
    raise exception 'unsupported invalidation reason' using errcode = '22023';
  end if;

  v_command_hash := private.ai_approval_command_hash(jsonb_build_object(
    'commandType', 'invalidate',
    'approvalId', p_approval_id,
    'expectedPayloadHash', p_expected_payload_hash,
    'reasonCode', p_reason_code
  ));
  perform pg_advisory_xact_lock(hashtextextended(
    'ai-approval-command:' || p_command_id::text,
    0
  ));

  select receipt.* into v_receipt
  from private.ai_approval_command_receipts receipt
  where receipt.command_id = p_command_id;

  if found then
    if v_receipt.command_type <> 'invalidate'
       or v_receipt.requested_by_user_id <> v_actor
       or v_receipt.approval_id <> p_approval_id
       or v_receipt.command_hash <> v_command_hash then
      raise exception 'AI approval command ID was reused with changed input or authority'
        using errcode = '23505';
    end if;
    return query select
      p_approval_id,
      v_receipt.result_status,
      true,
      not v_receipt.applied;
    return;
  end if;

  select approval.* into v_approval
  from public.ai_approvals approval
  where approval.id = p_approval_id;
  if not found then
    raise exception 'AI approval not found' using errcode = 'P0002';
  end if;
  select task.* into strict v_task
  from public.ai_tasks task
  where task.id = v_approval.task_id
  for update;
  select approval.* into strict v_approval
  from public.ai_approvals approval
  where approval.id = p_approval_id
  for update;
  select envelope.* into strict v_envelope
  from private.ai_approval_envelopes envelope
  where envelope.approval_id = p_approval_id;

  if v_task.requested_by_user_id <> v_actor and not public.is_portal_admin() then
    raise exception 'approval invalidation requires the task requester or an admin'
      using errcode = '42501';
  end if;
  if v_approval.payload_hash <> p_expected_payload_hash
     or v_envelope.payload_hash <> p_expected_payload_hash then
    raise exception 'approval payload hash changed' using errcode = '22023';
  end if;

  if v_approval.status in ('pending', 'approved') then
    update public.ai_approvals
    set status = 'invalidated',
        invalidated_by_user_id = v_actor,
        invalidated_at = v_now,
        invalidation_reason_code = p_reason_code
    where id = p_approval_id;
    perform private.ai_approval_append_task_event(
      v_approval.task_id,
      'approval_decided',
      'human',
      case when public.is_portal_admin() then 'portal.admin' else 'portal.staff' end,
      v_actor,
      'Exact synthetic approval invalidated.',
      v_now
    );
  elsif v_approval.status = 'invalidated'
        and v_approval.invalidation_reason_code = p_reason_code then
    v_already := true;
  else
    raise exception 'approval cannot be invalidated from status %', v_approval.status
      using errcode = '22023';
  end if;

  insert into private.ai_approval_command_receipts (
    command_id, command_type, requested_by_user_id, task_id, approval_id,
    command_hash, result_status, applied, created_at
  ) values (
    p_command_id, 'invalidate', v_actor, v_approval.task_id, p_approval_id,
    v_command_hash, 'invalidated', not v_already, v_now
  );

  return query select p_approval_id, 'invalidated'::public.ai_approval_status, false, v_already;
end;
$$;

revoke all on table public.ai_approvals from public, anon, authenticated, service_role;
revoke all on table private.ai_approval_envelopes from public, anon, authenticated, service_role;
revoke all on table private.ai_approval_command_receipts from public, anon, authenticated, service_role;
grant select on table public.ai_approvals to authenticated;

revoke all on type public.ai_approval_status from public, anon, authenticated, service_role;
revoke all on type public.ai_approval_decision from public, anon, authenticated, service_role;
grant usage on type public.ai_approval_status to authenticated;
grant usage on type public.ai_approval_decision to authenticated;

revoke all on function public.ai_approval_transition_allowed(public.ai_approval_status, public.ai_approval_status)
  from public, anon, authenticated, service_role;
revoke all on function public.ai_approvals_before_update()
  from public, anon, authenticated, service_role;
revoke all on function private.ai_approval_envelopes_reject_update()
  from public, anon, authenticated, service_role;
revoke all on function private.ai_approval_command_receipts_append_only()
  from public, anon, authenticated, service_role;
revoke all on function private.ai_approval_command_hash(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.ai_approval_append_task_event(
  uuid, public.ai_task_event_type, text, text, uuid, text, timestamptz
) from public, anon, authenticated, service_role;
revoke all on function public.ai_approval_request_synthetic(uuid, uuid, integer)
  from public, anon, authenticated, service_role;
revoke all on function public.ai_approval_decide_synthetic(uuid, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.ai_approval_consume_synthetic(uuid, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.ai_approval_invalidate_synthetic(uuid, uuid, text, text)
  from public, anon, authenticated, service_role;

grant execute on function public.ai_approval_request_synthetic(uuid, uuid, integer)
  to authenticated;
grant execute on function public.ai_approval_decide_synthetic(uuid, uuid, text)
  to authenticated;
grant execute on function public.ai_approval_consume_synthetic(uuid, uuid, text)
  to authenticated;
grant execute on function public.ai_approval_invalidate_synthetic(uuid, uuid, text, text)
  to authenticated;

notify pgrst, 'reload schema';
