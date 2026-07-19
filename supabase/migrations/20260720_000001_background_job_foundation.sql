-- Wave 3 JOB-01: durable background-job ledger and logged PGMQ queue.
-- Queue messages intentionally contain only jobId and contractVersion. Sensitive
-- execution inputs live in the service-role-only payload table below.

create extension if not exists pgcrypto;
create extension if not exists pgmq;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated, service_role;

do $$
declare
  v_is_unlogged boolean;
begin
  select queue.is_unlogged
  into v_is_unlogged
  from pgmq.list_queues() queue
  where queue.queue_name = 'portal_background_jobs';

  if found and v_is_unlogged then
    raise exception 'portal_background_jobs must be a logged queue'
      using errcode = '55000';
  elsif not found then
    perform pgmq.create('portal_background_jobs');
  end if;
end;
$$;

create type public.background_job_status as enum (
  'queued',
  'claimed',
  'preparing',
  'running',
  'dispatching',
  'provider_accepted',
  'finalising',
  'retrying',
  'succeeded',
  'cancelled',
  'needs_attention',
  'permanent_failed'
);

create type public.background_job_effect_state as enum (
  'prepared',
  'dispatch_started',
  'provider_accepted',
  'finalised',
  'uncertain',
  'failed'
);

create type public.background_job_rollout_mode as enum (
  'disabled',
  'legacy',
  'shadow',
  'worker_cohort',
  'worker_enabled'
);

create type public.background_job_execution_owner as enum (
  'legacy',
  'shadow',
  'worker'
);

create type public.background_job_event_type as enum (
  'enqueued',
  'duplicate_enqueue',
  'claimed',
  'phase_progress',
  'heartbeat',
  'effect_checkpoint',
  'retry_scheduled',
  'lease_expired',
  'provider_dispatch',
  'provider_accepted',
  'finalised',
  'succeeded',
  'needs_attention',
  'permanent_failed',
  'manual_retry',
  'cancellation_requested',
  'cancelled',
  'reconciled',
  'queue_repaired',
  'duplicate_message',
  'orphaned_message',
  'queue_archive_missing'
);

create or replace function public.background_job_safe_json(p_value jsonb)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  v_key text;
  v_child jsonb;
begin
  if p_value is null then
    return true;
  end if;

  if octet_length(p_value::text) > 8192 then
    return false;
  end if;

  if jsonb_typeof(p_value) = 'object' then
    for v_key, v_child in select key, value from jsonb_each(p_value)
    loop
      if v_key ~* '(email|recipient|token|secret|password|body|html|attachment|content|api.?key)' then
        return false;
      end if;
      if not public.background_job_safe_json(v_child) then
        return false;
      end if;
    end loop;
  elsif jsonb_typeof(p_value) = 'array' then
    for v_child in select value from jsonb_array_elements(p_value)
    loop
      if not public.background_job_safe_json(v_child) then
        return false;
      end if;
    end loop;
  elsif jsonb_typeof(p_value) = 'string' and length(p_value #>> '{}') > 1024 then
    return false;
  end if;

  return true;
end;
$$;

create or replace function public.background_job_transition_allowed(
  p_from public.background_job_status,
  p_to public.background_job_status
)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select p_from = p_to or case p_from
    when 'queued' then p_to in ('claimed', 'cancelled', 'needs_attention', 'permanent_failed')
    when 'claimed' then p_to in ('preparing', 'running', 'retrying', 'cancelled', 'needs_attention', 'permanent_failed')
    when 'preparing' then p_to in ('running', 'dispatching', 'retrying', 'cancelled', 'needs_attention', 'permanent_failed')
    when 'running' then p_to in ('dispatching', 'finalising', 'retrying', 'cancelled', 'needs_attention', 'permanent_failed')
    when 'dispatching' then p_to in ('provider_accepted', 'retrying', 'needs_attention', 'permanent_failed')
    when 'provider_accepted' then p_to in ('finalising', 'needs_attention', 'permanent_failed')
    when 'finalising' then p_to in ('succeeded', 'retrying', 'needs_attention', 'permanent_failed')
    when 'retrying' then p_to in ('claimed', 'queued', 'cancelled', 'needs_attention', 'permanent_failed')
    when 'needs_attention' then p_to = 'queued'
    when 'permanent_failed' then p_to = 'queued'
    else false
  end;
$$;

create or replace function public.background_job_effect_transition_allowed(
  p_from public.background_job_effect_state,
  p_to public.background_job_effect_state
)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select p_from = p_to or case p_from
    when 'prepared' then p_to in ('dispatch_started', 'failed')
    when 'dispatch_started' then p_to in ('provider_accepted', 'uncertain', 'failed')
    when 'provider_accepted' then p_to = 'finalised'
    when 'uncertain' then p_to in ('dispatch_started', 'provider_accepted', 'failed')
    when 'failed' then p_to = 'dispatch_started'
    else false
  end;
$$;

create or replace function public.background_job_effect_kind_array_valid(p_values text[])
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select p_values is not null
    and array_position(p_values, null) is null
    and not exists (
      select 1
      from unnest(p_values) as effect_kind(value)
      where effect_kind.value !~ '^[a-z][a-z0-9_]{1,63}$'
    )
    and cardinality(p_values) = (
      select count(distinct effect_kind.value)
      from unnest(p_values) as effect_kind(value)
    );
$$;

create table public.background_job_kinds (
  kind text primary key check (kind ~ '^[a-z][a-z0-9_]{1,63}$'),
  contract_version integer not null check (contract_version > 0),
  handler_owner text not null check (handler_owner ~ '^[a-z][a-z0-9_-]{1,95}$'),
  max_attempts integer not null check (max_attempts between 1 and 100),
  timeout_seconds integer not null check (timeout_seconds between 1 and 86400),
  concurrency_class text not null check (concurrency_class in ('documents', 'email', 'orchestration')),
  has_external_side_effect boolean not null,
  required_effect_kinds text[] not null default '{}'::text[]
    check (public.background_job_effect_kind_array_valid(required_effect_kinds)),
  cancellation_allowed boolean not null,
  default_rollout_mode public.background_job_rollout_mode not null default 'legacy',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.background_job_kinds (
  kind,
  contract_version,
  handler_owner,
  max_attempts,
  timeout_seconds,
  concurrency_class,
  has_external_side_effect,
  required_effect_kinds,
  cancellation_allowed
)
values
  ('deposit_invoice_prepare_and_send', 1, 'deposit-invoice-workflow', 6, 300, 'email', true, array['email_dispatch'], false),
  ('quote_send', 1, 'quote-delivery-workflow', 6, 300, 'email', true, array['email_dispatch'], false),
  ('quote_resend', 1, 'quote-delivery-workflow', 6, 300, 'email', true, array['email_dispatch'], false),
  ('job_pack_generate', 1, 'job-pack-generation-workflow', 4, 600, 'documents', false, array[]::text[], true),
  ('automation_event', 1, 'automation-event-workflow', 4, 120, 'orchestration', false, array[]::text[], true),
  ('email_outbox_deliver', 1, 'email-outbox-delivery-workflow', 6, 120, 'email', true, array['email_dispatch'], false);

create table public.background_jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null references public.background_job_kinds(kind),
  contract_version integer not null check (contract_version > 0),
  subject_type text not null check (subject_type ~ '^[a-z][a-z0-9_]{1,63}$'),
  subject_id text not null check (subject_id ~ '^[A-Za-z0-9._:-]{1,128}$'),
  project_id uuid null references public.projects(id) on delete set null,
  requested_by_user_id uuid null references auth.users(id) on delete set null,
  requested_by_actor text not null check (requested_by_actor in ('staff', 'system')),
  status public.background_job_status not null default 'queued',
  current_phase text not null default 'queued' check (current_phase ~ '^[a-z][a-z0-9_]{1,63}$'),
  priority smallint not null default 100 check (priority between 0 and 1000),
  intent_key text not null check (
    length(intent_key) between 1 and 256
    and intent_key ~ '^[A-Za-z0-9._:/-]+$'
  ),
  input_hash text not null check (input_hash ~ '^[0-9a-f]{64}$'),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null check (max_attempts between 1 and 100),
  next_attempt_at timestamptz not null default now(),
  queue_message_id bigint null unique,
  lease_owner text null check (lease_owner is null or lease_owner ~ '^[A-Za-z0-9._:-]{1,128}$'),
  lease_token uuid null,
  lease_started_at timestamptz null,
  lease_expires_at timestamptz null,
  last_heartbeat_at timestamptz null,
  safe_progress jsonb not null default '{}'::jsonb check (
    jsonb_typeof(safe_progress) = 'object' and public.background_job_safe_json(safe_progress)
  ),
  safe_result jsonb not null default '{}'::jsonb check (
    jsonb_typeof(safe_result) = 'object' and public.background_job_safe_json(safe_result)
  ),
  error_code text null check (error_code is null or error_code ~ '^[A-Z0-9_]{1,96}$'),
  error_message text null check (
    error_message is null
    or (length(error_message) between 1 and 1000 and error_message !~ '@|https?://')
  ),
  cancellation_requested_at timestamptz null,
  cancellation_requested_by uuid null references auth.users(id) on delete set null,
  cancellation_reason text null check (
    cancellation_reason is null
    or (length(cancellation_reason) between 1 and 500 and cancellation_reason !~ '@|https?://')
  ),
  rollout_mode public.background_job_rollout_mode not null,
  execution_owner public.background_job_execution_owner not null,
  rollout_cohort text null check (
    rollout_cohort is null or rollout_cohort ~ '^[A-Za-z0-9._:-]{1,96}$'
  ),
  provider_name text null check (provider_name is null or provider_name ~ '^[A-Za-z0-9._-]{1,64}$'),
  provider_message_id text null check (
    provider_message_id is null
    or (length(provider_message_id) between 1 and 256 and provider_message_id ~ '^[A-Za-z0-9._:-]+$')
  ),
  provider_idempotency_expires_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz null,
  completed_at timestamptz null,
  check (
    requested_by_actor = 'system'
    or requested_by_user_id is not null
  ),
  check (
    (
      lease_owner is null
      and lease_token is null
      and lease_started_at is null
      and lease_expires_at is null
      and last_heartbeat_at is null
    )
    or (
      lease_owner is not null
      and lease_token is not null
      and lease_started_at is not null
      and lease_expires_at is not null
      and last_heartbeat_at is not null
    )
  ),
  unique (kind, intent_key)
);

create table private.background_job_payloads (
  job_id uuid primary key references public.background_jobs(id) on delete cascade,
  contract_version integer not null check (contract_version > 0),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  payload jsonb not null check (
    jsonb_typeof(payload) = 'object'
    and octet_length(payload::text) <= 262144
  ),
  created_at timestamptz not null default now()
);

create table public.background_job_effects (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.background_jobs(id) on delete cascade,
  effect_key text not null check (
    length(effect_key) between 1 and 256 and effect_key ~ '^[A-Za-z0-9._:/-]+$'
  ),
  effect_kind text not null check (effect_kind ~ '^[a-z][a-z0-9_]{1,63}$'),
  state public.background_job_effect_state not null,
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  provider_name text null check (provider_name is null or provider_name ~ '^[A-Za-z0-9._-]{1,64}$'),
  provider_idempotency_key text null check (
    provider_idempotency_key is null
    or (
      length(provider_idempotency_key) between 1 and 256
      and provider_idempotency_key ~ '^[A-Za-z0-9._:/-]+$'
    )
  ),
  provider_idempotency_expires_at timestamptz null,
  provider_message_id text null check (
    provider_message_id is null
    or (length(provider_message_id) between 1 and 256 and provider_message_id ~ '^[A-Za-z0-9._:-]+$')
  ),
  dispatch_started_at timestamptz null,
  provider_accepted_at timestamptz null,
  finalised_at timestamptz null,
  safe_metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(safe_metadata) = 'object' and public.background_job_safe_json(safe_metadata)
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, effect_key)
);

create unique index background_job_effects_provider_message_unique
  on public.background_job_effects(provider_name, provider_message_id)
  where provider_name is not null and provider_message_id is not null;

create unique index background_job_effects_provider_idempotency_unique
  on public.background_job_effects(provider_name, provider_idempotency_key)
  where provider_name is not null and provider_idempotency_key is not null;

create table public.background_job_events (
  id bigint generated always as identity primary key,
  job_id uuid null references public.background_jobs(id) on delete set null,
  queue_message_id bigint null,
  event_type public.background_job_event_type not null,
  from_status public.background_job_status null,
  to_status public.background_job_status null,
  phase text null check (phase is null or phase ~ '^[a-z][a-z0-9_]{1,63}$'),
  attempt_number integer null check (attempt_number is null or attempt_number >= 0),
  worker_id text null check (worker_id is null or worker_id ~ '^[A-Za-z0-9._:-]{1,128}$'),
  actor_user_id uuid null references auth.users(id) on delete set null,
  error_code text null check (error_code is null or error_code ~ '^[A-Z0-9_]{1,96}$'),
  safe_detail jsonb not null default '{}'::jsonb check (
    jsonb_typeof(safe_detail) = 'object' and public.background_job_safe_json(safe_detail)
  ),
  created_at timestamptz not null default now()
);

create table public.background_workers (
  worker_id text primary key check (worker_id ~ '^[A-Za-z0-9._:-]{1,128}$'),
  mode text not null check (mode in ('dark', 'active', 'once', 'drain', 'reconcile')),
  lifecycle_state text not null check (lifecycle_state in ('starting', 'ready', 'draining', 'stopped', 'unhealthy')),
  build_version text null check (build_version is null or build_version ~ '^[A-Za-z0-9._:-]{1,128}$'),
  global_concurrency integer not null check (global_concurrency between 1 and 100),
  active_job_count integer not null default 0 check (active_job_count between 0 and 100),
  safe_metadata jsonb not null default '{}'::jsonb check (
    jsonb_typeof(safe_metadata) = 'object' and public.background_job_safe_json(safe_metadata)
  ),
  started_at timestamptz not null default now(),
  last_heartbeat_at timestamptz not null default now(),
  shutdown_requested_at timestamptz null,
  stopped_at timestamptz null,
  updated_at timestamptz not null default now()
);

create index background_jobs_claimable_idx
  on public.background_jobs(priority, next_attempt_at, created_at)
  where status in ('queued', 'retrying');
create index background_jobs_project_created_idx
  on public.background_jobs(project_id, created_at desc)
  where project_id is not null;
create index background_jobs_subject_created_idx
  on public.background_jobs(subject_type, subject_id, created_at desc);
create index background_jobs_attention_idx
  on public.background_jobs(updated_at desc)
  where status in ('needs_attention', 'permanent_failed');
create index background_jobs_lease_expiry_idx
  on public.background_jobs(lease_expires_at)
  where lease_expires_at is not null;
create index background_job_events_job_created_idx
  on public.background_job_events(job_id, created_at, id)
  where job_id is not null;
create index background_job_events_queue_message_idx
  on public.background_job_events(queue_message_id, created_at)
  where queue_message_id is not null;
create index background_workers_heartbeat_idx
  on public.background_workers(last_heartbeat_at desc);

create or replace function public.background_jobs_before_update()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if old.status is distinct from new.status
     and not public.background_job_transition_allowed(old.status, new.status) then
    raise exception 'invalid background-job transition: % -> %', old.status, new.status
      using errcode = '22023';
  end if;

  new.updated_at := now();

  if new.status in ('claimed', 'preparing', 'running', 'dispatching', 'provider_accepted', 'finalising')
     and new.started_at is null then
    new.started_at := now();
  end if;

  if new.status in ('succeeded', 'cancelled', 'needs_attention', 'permanent_failed') then
    new.completed_at := coalesce(new.completed_at, now());
  elsif old.status in ('needs_attention', 'permanent_failed') and new.status = 'queued' then
    new.completed_at := null;
  end if;

  return new;
end;
$$;

create trigger background_jobs_before_update_trigger
before update on public.background_jobs
for each row execute function public.background_jobs_before_update();

create or replace function public.background_job_effects_before_update()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if old.job_id is distinct from new.job_id
     or old.effect_key is distinct from new.effect_key
     or old.effect_kind is distinct from new.effect_kind
     or old.payload_hash is distinct from new.payload_hash
     or old.provider_idempotency_key is distinct from new.provider_idempotency_key
     or (old.provider_name is not null and old.provider_name is distinct from new.provider_name)
     or (
       old.provider_idempotency_expires_at is not null
       and old.provider_idempotency_expires_at is distinct from new.provider_idempotency_expires_at
     )
     or (
       old.provider_message_id is not null
       and old.provider_message_id is distinct from new.provider_message_id
     ) then
    raise exception 'background-job effect identity is immutable' using errcode = '22023';
  end if;

  if old.state is distinct from new.state
     and not public.background_job_effect_transition_allowed(old.state, new.state) then
    raise exception 'invalid background-job effect transition: % -> %', old.state, new.state
      using errcode = '22023';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger background_job_effects_before_update_trigger
before update on public.background_job_effects
for each row execute function public.background_job_effects_before_update();

create or replace function private.background_job_payloads_reject_update()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception 'background-job payloads are frozen; create a new intent for changed input'
    using errcode = '22023';
end;
$$;

create trigger background_job_payloads_immutable_trigger
before update on private.background_job_payloads
for each row execute function private.background_job_payloads_reject_update();

create or replace function public.background_job_events_append_only()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if tg_op = 'UPDATE' then
    if (to_jsonb(new) - array['job_id', 'actor_user_id']) =
       (to_jsonb(old) - array['job_id', 'actor_user_id'])
       and (
         new.job_id is not distinct from old.job_id
         or (old.job_id is not null and new.job_id is null)
       )
       and (
         new.actor_user_id is not distinct from old.actor_user_id
         or (old.actor_user_id is not null and new.actor_user_id is null)
       ) then
      return new;
    end if;
  end if;

  raise exception 'background-job event history is append-only' using errcode = '22023';
end;
$$;

create trigger background_job_events_append_only_trigger
before update or delete on public.background_job_events
for each row execute function public.background_job_events_append_only();

alter table public.background_job_kinds enable row level security;
alter table public.background_jobs enable row level security;
alter table private.background_job_payloads enable row level security;
alter table public.background_job_effects enable row level security;
alter table public.background_job_events enable row level security;
alter table public.background_workers enable row level security;

revoke all on table public.background_job_kinds from public, anon, authenticated, service_role;
revoke all on table public.background_jobs from public, anon, authenticated;
revoke all on table private.background_job_payloads from public, anon, authenticated, service_role;
revoke all on table public.background_jobs from service_role;
revoke all on table public.background_job_effects from public, anon, authenticated, service_role;
revoke all on table public.background_job_events from public, anon, authenticated, service_role;
revoke all on table public.background_workers from public, anon, authenticated, service_role;
revoke all on sequence public.background_job_events_id_seq from public, anon, authenticated, service_role;

revoke all on function public.background_job_safe_json(jsonb) from public, anon, authenticated;
revoke all on function public.background_job_transition_allowed(public.background_job_status, public.background_job_status)
  from public, anon, authenticated;
revoke all on function public.background_job_effect_transition_allowed(public.background_job_effect_state, public.background_job_effect_state)
  from public, anon, authenticated;
revoke all on function public.background_job_effect_kind_array_valid(text[]) from public, anon, authenticated;
revoke all on function public.background_jobs_before_update() from public, anon, authenticated;
revoke all on function public.background_job_effects_before_update() from public, anon, authenticated;
revoke all on function private.background_job_payloads_reject_update() from public, anon, authenticated, service_role;
revoke all on function public.background_job_events_append_only() from public, anon, authenticated;

revoke all on schema pgmq from public, anon, authenticated, service_role;
revoke all on all tables in schema pgmq from public, anon, authenticated, service_role;
revoke all on all sequences in schema pgmq from public, anon, authenticated, service_role;
revoke all on all functions in schema pgmq from public, anon, authenticated, service_role;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'pgmq_public') then
    execute 'revoke all on schema pgmq_public from public, anon, authenticated, service_role';
    execute 'revoke all on all functions in schema pgmq_public from public, anon, authenticated, service_role';
  end if;
end;
$$;

notify pgrst, 'reload schema';
