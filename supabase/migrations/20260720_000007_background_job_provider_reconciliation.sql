-- Wave 3 JOB-03: bounded provider identity, append-only verified webhook
-- receipts, and atomic out-of-band provider-acceptance reconciliation.

-- Resend retains idempotency keys for 24 hours. Keep the durable retry window
-- conservative even if a caller supplies a later timestamp.
alter table public.background_job_effects
  add constraint background_job_effects_resend_idempotency_window_bounded
  check (
    provider_name is null
    or lower(provider_name) <> 'resend'
    or provider_idempotency_expires_at is null
    or provider_idempotency_expires_at <= created_at + interval '24 hours'
  );

-- A verified provider callback may prove acceptance after the original worker
-- has released or lost its lease. These additional edges are usable only by
-- the service-owned reconciliation RPC; generic worker progress still cannot
-- write provider_accepted.
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
    when 'queued' then p_to in ('claimed', 'provider_accepted', 'cancelled', 'needs_attention', 'permanent_failed')
    when 'claimed' then p_to in ('preparing', 'running', 'provider_accepted', 'retrying', 'cancelled', 'needs_attention', 'permanent_failed')
    when 'preparing' then p_to in ('running', 'dispatching', 'provider_accepted', 'retrying', 'cancelled', 'needs_attention', 'permanent_failed')
    when 'running' then p_to in ('dispatching', 'provider_accepted', 'finalising', 'retrying', 'cancelled', 'needs_attention', 'permanent_failed')
    when 'dispatching' then p_to in ('provider_accepted', 'retrying', 'needs_attention', 'permanent_failed')
    when 'provider_accepted' then p_to in ('finalising', 'needs_attention', 'permanent_failed')
    when 'finalising' then p_to in ('succeeded', 'retrying', 'needs_attention', 'permanent_failed')
    when 'retrying' then p_to in ('claimed', 'queued', 'provider_accepted', 'cancelled', 'needs_attention', 'permanent_failed')
    when 'succeeded' then p_to = 'needs_attention'
    when 'cancelled' then p_to = 'needs_attention'
    when 'needs_attention' then p_to in ('queued', 'provider_accepted')
    when 'permanent_failed' then p_to in ('queued', 'provider_accepted')
    else false
  end;
$$;

-- A verified provider receipt is stronger than a locally classified failure.
-- This edge is used by reconciliation only; ordinary retries still move a
-- failed effect back through dispatch_started with the same frozen identity.
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
    when 'failed' then p_to in ('dispatch_started', 'provider_accepted')
    else false
  end;
$$;

create table private.background_job_provider_receipts (
  id bigint generated always as identity primary key,
  provider_name text not null check (provider_name = 'resend'),
  provider_event_id text not null check (
    length(provider_event_id) between 1 and 256
    and provider_event_id ~ '^[A-Za-z0-9._:-]+$'
  ),
  provider_event_type text not null check (provider_event_type = 'email.sent'),
  provider_message_id text not null check (
    length(provider_message_id) between 1 and 256
    and provider_message_id ~ '^[A-Za-z0-9._:-]+$'
  ),
  provider_created_at timestamptz not null,
  tagged_job_id uuid null,
  tagged_effect_ref text null check (
    tagged_effect_ref is null or tagged_effect_ref ~ '^[0-9a-f]{64}$'
  ),
  reconciliation_outcome text not null check (
    reconciliation_outcome in ('accepted', 'reconciled', 'already_accepted', 'unmatched', 'conflict')
  ),
  matched_job_id uuid null,
  matched_effect_id uuid null,
  received_at timestamptz not null default now(),
  unique (provider_name, provider_event_id),
  check (
    reconciliation_outcome not in ('accepted', 'reconciled', 'already_accepted')
    or (matched_job_id is not null and matched_effect_id is not null)
  )
);

create index background_job_provider_receipts_message_idx
  on private.background_job_provider_receipts(provider_name, provider_message_id, received_at);
create index background_job_provider_receipts_match_idx
  on private.background_job_provider_receipts(matched_job_id, received_at)
  where matched_job_id is not null;

create or replace function private.background_job_provider_receipts_append_only()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception 'background-job provider receipts are append-only'
    using errcode = '22023';
end;
$$;

create trigger background_job_provider_receipts_append_only_trigger
before update or delete on private.background_job_provider_receipts
for each row execute function private.background_job_provider_receipts_append_only();

alter table private.background_job_provider_receipts enable row level security;

-- This exact digest is also authored by the Node provider gateway. The
-- provider sees only a job UUID and this digest; the frozen idempotency key is
-- never copied into tags, receipts, logs, or safe job projections.
create or replace function private.background_job_provider_effect_ref(
  p_provider_name text,
  p_provider_idempotency_key text
)
returns text
language sql
immutable
strict
set search_path = pg_catalog
as $$
  select encode(
    sha256(convert_to(
      'sanctuary:provider-effect:v1|' || p_provider_name || '|' || p_provider_idempotency_key,
      'UTF8'
    )),
    'hex'
  );
$$;

create or replace function private.background_job_safe_error_copy(p_error_code text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select case
    when p_error_code = 'RETRY_EXHAUSTED' then 'The background job exhausted its automatic attempts.'
    when p_error_code = 'LEASE_EXPIRED_DURING_DISPATCH' then 'Provider outcome must be reconciled before another delivery attempt.'
    when p_error_code = 'PROVIDER_IDEMPOTENCY_WINDOW_EXPIRED' then 'The provider idempotency window expired before a safe retry.'
    when p_error_code = 'PROVIDER_OUTCOME_UNCERTAIN' then 'Provider outcome remains uncertain and requires reconciliation.'
    when p_error_code = 'PROVIDER_WEBHOOK_CONFLICT' then 'Provider acceptance conflicted with the durable effect identity.'
    when p_error_code = 'QUEUE_CONTRACT_MISMATCH' then 'Queue contract version does not match the durable job.'
    when p_error_code ~ 'TIMEOUT$' then 'The background job timed out.'
    when p_error_code ~ 'CANCEL' then 'The background job was cancelled.'
    else 'The background job could not be completed.'
  end;
$$;

-- Replace the JOB-01 visibility helper forward so a missing/archived message
-- never dereferences an unassigned record. PL/pgSQL does not guarantee that a
-- boolean AND will skip its right-hand expression.
create or replace function private.background_job_set_visibility_or_repair(
  p_job_id uuid,
  p_contract_version integer,
  p_message_id bigint,
  p_delay_seconds integer,
  p_worker_id text,
  p_reason text
)
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_job public.background_jobs%rowtype;
  v_message record;
  v_existing_message jsonb;
  v_pointer_found boolean := false;
  v_pointer_matches boolean := false;
  v_message_found boolean := false;
  v_replacement_message_id bigint;
  v_missing_reason text;
begin
  if p_delay_seconds is null or p_delay_seconds not between 0 and 72000 then
    raise exception 'queue visibility delay must be between 0 seconds and 20 hours'
      using errcode = '22023';
  end if;
  if p_reason is null or not private.background_job_safe_code(p_reason) then
    raise exception 'invalid queue repair reason' using errcode = '22023';
  end if;

  select job.*
  into strict v_job
  from public.background_jobs job
  where job.id = p_job_id
  for update;

  if v_job.contract_version <> p_contract_version
     or v_job.queue_message_id is distinct from p_message_id then
    raise exception 'queue visibility request does not match the locked job pointer'
      using errcode = '55000';
  end if;

  if p_message_id is not null then
    select queue_message.message
    into v_existing_message
    from pgmq.q_portal_background_jobs queue_message
    where queue_message.msg_id = p_message_id;
    v_pointer_found := found;
    v_pointer_matches := v_pointer_found and private.background_job_queue_message_matches(
      v_existing_message,
      p_job_id,
      p_contract_version
    );
  end if;

  if v_pointer_matches then
    select updated_message.*
    into v_message
    from pgmq.set_vt('portal_background_jobs', p_message_id, p_delay_seconds) updated_message;
    v_message_found := found;
  end if;

  if v_message_found then
    if private.background_job_queue_message_matches(
      v_message.message,
      p_job_id,
      p_contract_version
    ) then
      return p_message_id;
    end if;
  end if;

  v_missing_reason := p_reason || case
    when v_pointer_found and not v_pointer_matches then '_stale_message'
    else '_missing_message'
  end;
  perform private.background_job_insert_event(
    v_job.id,
    p_message_id,
    'queue_archive_missing',
    v_job.status,
    v_job.status,
    v_job.current_phase,
    v_job.attempt_count,
    p_worker_id,
    null,
    'QUEUE_MESSAGE_MISSING',
    jsonb_build_object('reason', v_missing_reason)
  );

  v_replacement_message_id := private.background_job_send_message(
    v_job.id,
    v_job.contract_version,
    p_delay_seconds
  );

  update public.background_jobs
  set queue_message_id = v_replacement_message_id
  where id = v_job.id
    and queue_message_id is not distinct from p_message_id;

  if not found then
    raise exception 'background-job queue pointer changed during repair' using errcode = '40001';
  end if;

  perform private.background_job_insert_event(
    v_job.id,
    v_replacement_message_id,
    'queue_repaired',
    v_job.status,
    v_job.status,
    v_job.current_phase,
    v_job.attempt_count,
    p_worker_id,
    null,
    null,
    jsonb_build_object('reason', v_missing_reason)
  );

  return v_replacement_message_id;
end;
$$;

-- A signed provider acceptance supersedes only classifications that the
-- acceptance itself proves stale. Identity conflicts and business-finaliser
-- failures deliberately remain operator-visible.
create or replace function private.background_job_provider_acceptance_wins(p_error_code text)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select p_error_code in (
    'RESEND_AUTH_REJECTED',
    'RESEND_VALIDATION_REJECTED',
    'RESEND_QUOTA_REJECTED',
    'RESEND_REQUEST_REJECTED',
    'EMAIL_PROVIDER_GATEWAY_INVALID',
    'EMAIL_IDEMPOTENCY_WINDOW_EXPIRED',
    'PROVIDER_IDEMPOTENCY_WINDOW_EXPIRED',
    'PROVIDER_OUTCOME_UNCERTAIN',
    'RETRY_EXHAUSTED',
    'RUNTIME_CONTEXT_MISMATCH'
  );
$$;

-- The HTTP owner must verify the raw Resend/Svix signature before invoking
-- this RPC. The database deliberately accepts only the minimal parsed envelope
-- and grants the capability to service_role, never to the public webhook role.
create function public.background_job_reconcile_verified_provider_acceptance(
  p_provider_name text,
  p_provider_event_id text,
  p_provider_event_type text,
  p_provider_message_id text,
  p_provider_created_at timestamptz,
  p_tagged_job_id uuid,
  p_tagged_effect_ref text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_existing_receipt private.background_job_provider_receipts%rowtype;
  v_job public.background_jobs%rowtype;
  v_effect public.background_job_effects%rowtype;
  v_previous_status public.background_job_status;
  v_message_id bigint;
  v_live_lease boolean := false;
  v_new_acceptance boolean := false;
  v_acceptance_known boolean := false;
  v_conflict boolean := false;
  v_outcome text := 'unmatched';
  v_matched_job_id uuid;
  v_matched_effect_id uuid;
  v_canonical_metadata constant jsonb := jsonb_build_object(
    'effectKind', 'email_dispatch',
    'checkpoint', 'provider_accepted',
    'providerName', 'resend',
    'providerAccepted', true
  );
begin
  if p_provider_name is distinct from 'resend' then
    raise exception 'unsupported provider acceptance source' using errcode = '22023';
  end if;
  if p_provider_event_type is distinct from 'email.sent' then
    raise exception 'unsupported provider acceptance event' using errcode = '22023';
  end if;
  if p_provider_event_id is null
     or length(p_provider_event_id) not between 1 and 256
     or p_provider_event_id !~ '^[A-Za-z0-9._:-]+$' then
    raise exception 'invalid provider event ID' using errcode = '22023';
  end if;
  if p_provider_message_id is null
     or length(p_provider_message_id) not between 1 and 256
     or p_provider_message_id !~ '^[A-Za-z0-9._:-]+$' then
    raise exception 'invalid provider message ID' using errcode = '22023';
  end if;
  if p_provider_created_at is null then
    raise exception 'provider event timestamp is required' using errcode = '22023';
  end if;
  if p_tagged_effect_ref is not null
     and p_tagged_effect_ref !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid provider effect reference' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_provider_name || ':' || p_provider_event_id, 0)
  );

  select receipt.*
  into v_existing_receipt
  from private.background_job_provider_receipts receipt
  where receipt.provider_name = p_provider_name
    and receipt.provider_event_id = p_provider_event_id
  for update;

  if found then
    if v_existing_receipt.provider_event_type is distinct from p_provider_event_type
       or v_existing_receipt.provider_message_id is distinct from p_provider_message_id
       or v_existing_receipt.provider_created_at is distinct from p_provider_created_at
       or v_existing_receipt.tagged_job_id is distinct from p_tagged_job_id
       or v_existing_receipt.tagged_effect_ref is distinct from p_tagged_effect_ref then
      raise exception 'provider event identity was reused with different content'
        using errcode = '23505';
    end if;
    return 'duplicate';
  end if;

  if p_tagged_job_id is not null and p_tagged_effect_ref is not null then
    select job.*
    into v_job
    from public.background_jobs job
    where job.id = p_tagged_job_id
    for update;

    if found then
      select effect.*
      into v_effect
      from public.background_job_effects effect
      where effect.job_id = v_job.id
        and effect.effect_kind = 'email_dispatch'
        and effect.provider_name = p_provider_name
        and effect.provider_idempotency_key is not null
        and private.background_job_provider_effect_ref(
          effect.provider_name,
          effect.provider_idempotency_key
        ) = p_tagged_effect_ref
      for update;

      if found then
        v_matched_job_id := v_job.id;
        v_matched_effect_id := v_effect.id;

        if (v_effect.provider_message_id is not null
              and v_effect.provider_message_id <> p_provider_message_id)
           or (v_job.provider_name is not null and v_job.provider_name <> p_provider_name)
           or (v_job.provider_message_id is not null
              and v_job.provider_message_id <> p_provider_message_id) then
          v_conflict := true;
        elsif v_effect.state in ('dispatch_started', 'uncertain', 'failed')
              and v_job.status in (
                'queued', 'claimed', 'preparing', 'running', 'dispatching',
                'retrying', 'needs_attention', 'permanent_failed'
              ) then
          if exists (
            select 1
            from public.background_job_effects other_effect
            where other_effect.provider_name = p_provider_name
              and other_effect.provider_message_id = p_provider_message_id
              and other_effect.id <> v_effect.id
          ) then
            v_conflict := true;
          else
            begin
              update public.background_job_effects
              set state = 'provider_accepted',
                  provider_message_id = p_provider_message_id,
                  provider_accepted_at = coalesce(provider_accepted_at, now()),
                  safe_metadata = v_canonical_metadata
              where id = v_effect.id
              returning * into v_effect;
              v_new_acceptance := true;
              v_acceptance_known := true;
            exception when unique_violation then
              v_conflict := true;
            end;
          end if;
        elsif v_effect.state in ('provider_accepted', 'finalised')
              and v_effect.provider_message_id = p_provider_message_id then
          v_acceptance_known := true;
        else
          v_conflict := true;
        end if;

        if v_acceptance_known and not v_conflict then
          if v_effect.state = 'provider_accepted'
             and v_job.status in (
               'queued', 'claimed', 'preparing', 'running', 'dispatching',
               'retrying', 'needs_attention', 'permanent_failed'
             )
             and (
               v_job.status not in ('needs_attention', 'permanent_failed')
               or private.background_job_provider_acceptance_wins(v_job.error_code)
             ) then
            v_previous_status := v_job.status;
            v_live_lease := v_job.lease_owner is not null
              and v_job.lease_token is not null
              and v_job.lease_expires_at is not null
              and v_job.lease_expires_at > now();
            v_message_id := v_job.queue_message_id;

            if not v_live_lease then
              v_message_id := private.background_job_set_visibility_or_repair(
                v_job.id,
                v_job.contract_version,
                v_job.queue_message_id,
                0,
                'provider-webhook',
                'provider_webhook_acceptance'
              );
            end if;

            update public.background_jobs
            set status = 'provider_accepted',
                current_phase = 'provider_accepted',
                next_attempt_at = now(),
                queue_message_id = v_message_id,
                provider_name = p_provider_name,
                provider_message_id = p_provider_message_id,
                provider_idempotency_expires_at = v_effect.provider_idempotency_expires_at,
                safe_progress = jsonb_build_object(
                  'phase', 'provider_accepted',
                  'progressCode', 'provider_webhook_reconciled',
                  'retryable', false
                ),
                error_code = null,
                error_message = null,
                completed_at = null,
                lease_owner = case when v_live_lease then lease_owner else null end,
                lease_token = case when v_live_lease then lease_token else null end,
                lease_started_at = case when v_live_lease then lease_started_at else null end,
                lease_expires_at = case when v_live_lease then lease_expires_at else null end,
                last_heartbeat_at = case when v_live_lease then last_heartbeat_at else null end
            where id = v_job.id
            returning * into v_job;

            perform private.background_job_insert_event(
              v_job.id,
              v_job.queue_message_id,
              case
                when v_new_acceptance then 'provider_accepted'::public.background_job_event_type
                else 'reconciled'::public.background_job_event_type
              end,
              v_previous_status,
              'provider_accepted',
              'provider_accepted',
              v_job.attempt_count,
              null,
              null,
              null,
              jsonb_build_object(
                'reason', case
                  when v_new_acceptance then 'provider_webhook_acceptance'
                  else 'provider_webhook_reconciled'
                end,
                'effectKind', 'email_dispatch',
                'checkpoint', 'provider_accepted',
                'providerName', 'resend',
                'providerAccepted', true
              )
            );
            v_outcome := case when v_new_acceptance then 'accepted' else 'reconciled' end;
          elsif v_effect.state = 'provider_accepted'
                and v_job.status in (
                  'provider_accepted', 'finalising', 'needs_attention', 'permanent_failed'
                ) then
            v_outcome := case when v_new_acceptance then 'accepted' else 'already_accepted' end;
          elsif v_effect.state = 'finalised'
                and v_job.status in (
                  'provider_accepted', 'finalising', 'succeeded', 'needs_attention'
                ) then
            v_outcome := 'already_accepted';
          else
            v_conflict := true;
          end if;
        end if;

        if v_conflict then
          v_outcome := 'conflict';

          if v_effect.state = 'dispatch_started' then
            update public.background_job_effects
            set state = 'uncertain',
                safe_metadata = jsonb_build_object(
                  'effectKind', effect_kind,
                  'checkpoint', 'uncertain',
                  'providerName', provider_name
                ),
                updated_at = now()
            where id = v_effect.id
            returning * into v_effect;
          end if;

          if v_job.status not in ('needs_attention', 'permanent_failed') then
            v_previous_status := v_job.status;
            if v_job.status not in ('succeeded', 'cancelled')
               or private.background_job_queue_contains(v_job.queue_message_id) then
              perform private.background_job_archive_canonical(v_job.id, v_job.queue_message_id);
            end if;
            update public.background_jobs
            set status = 'needs_attention',
                current_phase = 'provider_reconciliation',
                error_code = 'PROVIDER_WEBHOOK_CONFLICT',
                error_message = private.background_job_safe_error_copy('PROVIDER_WEBHOOK_CONFLICT'),
                safe_progress = jsonb_build_object(
                  'phase', 'provider_reconciliation',
                  'progressCode', 'provider_webhook_conflict',
                  'retryable', false
                ),
                lease_owner = null,
                lease_token = null,
                lease_started_at = null,
                lease_expires_at = null,
                last_heartbeat_at = null
            where id = v_job.id
            returning * into v_job;
            perform private.background_job_insert_event(
              v_job.id,
              v_job.queue_message_id,
              'needs_attention',
              v_previous_status,
              'needs_attention',
              'provider_reconciliation',
              v_job.attempt_count,
              null,
              null,
              'PROVIDER_WEBHOOK_CONFLICT',
              jsonb_build_object(
                'reason', 'provider_webhook_conflict',
                'effectKind', 'email_dispatch',
                'providerName', 'resend'
              )
            );
          else
            perform private.background_job_insert_event(
              v_job.id,
              v_job.queue_message_id,
              'reconciled',
              v_job.status,
              v_job.status,
              v_job.current_phase,
              v_job.attempt_count,
              null,
              null,
              'PROVIDER_WEBHOOK_CONFLICT',
              jsonb_build_object(
                'reason', 'provider_webhook_conflict',
                'effectKind', 'email_dispatch',
                'providerName', 'resend'
              )
            );
          end if;
        end if;
      end if;
    end if;
  end if;

  insert into private.background_job_provider_receipts (
    provider_name,
    provider_event_id,
    provider_event_type,
    provider_message_id,
    provider_created_at,
    tagged_job_id,
    tagged_effect_ref,
    reconciliation_outcome,
    matched_job_id,
    matched_effect_id
  )
  values (
    p_provider_name,
    p_provider_event_id,
    p_provider_event_type,
    p_provider_message_id,
    p_provider_created_at,
    p_tagged_job_id,
    p_tagged_effect_ref,
    v_outcome,
    v_matched_job_id,
    v_matched_effect_id
  );

  return v_outcome;
end;
$$;

-- The shared transition predicate permits verified provider evidence to repair
-- stale failed or uncertain classifications. Keep that system-level edge out
-- of the generic worker command: a local acceptance must follow a fresh
-- dispatch_started checkpoint, while an exact accepted-state replay remains
-- idempotent.
create or replace function public.background_job_record_effect_checkpoint(
  p_job_id uuid,
  p_worker_id text,
  p_lease_token uuid,
  p_effect_key text,
  p_effect_kind text,
  p_state public.background_job_effect_state,
  p_payload_hash text,
  p_provider_name text default null,
  p_provider_idempotency_key text default null,
  p_provider_idempotency_expires_at timestamptz default null,
  p_provider_message_id text default null,
  p_safe_metadata jsonb default '{}'::jsonb
)
returns public.background_job_effects
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_job public.background_jobs%rowtype;
  v_effect public.background_job_effects%rowtype;
  v_previous_job_status public.background_job_status;
  v_previous_state public.background_job_effect_state;
  v_event_type public.background_job_event_type := 'effect_checkpoint';
begin
  v_job := private.background_job_lock_owned(p_job_id, p_worker_id, p_lease_token);
  v_previous_job_status := v_job.status;

  if not v_job.has_external_side_effect
     or not (p_effect_kind = any(v_job.allowed_effect_kinds)) then
    raise exception 'external effect % is not allowed for background-job kind % v%',
      p_effect_kind, v_job.kind, v_job.contract_version
      using errcode = '22023';
  end if;
  if not public.background_job_safe_summary('effect', coalesce(p_safe_metadata, '{}'::jsonb)) then
    raise exception 'unsafe background-job effect metadata' using errcode = '22023';
  end if;
  if v_job.execution_owner <> 'shadow'
     and p_state = 'prepared'
     and (
       p_provider_name is null
       or p_provider_idempotency_key is null
       or p_provider_idempotency_expires_at is null
       or p_provider_idempotency_expires_at <= now()
     ) then
    raise exception 'effect preparation requires frozen provider identity and a live idempotency window'
      using errcode = '22023';
  end if;

  select effect.*
  into v_effect
  from public.background_job_effects effect
  where effect.job_id = p_job_id
    and effect.effect_kind = p_effect_kind
  for update;

  if not found then
    if p_state <> 'prepared' then
      raise exception 'the first effect checkpoint must be prepared' using errcode = '22023';
    end if;
    if v_job.status not in ('claimed', 'preparing', 'running') then
      raise exception 'effect preparation is incompatible with the current job state'
        using errcode = '22023';
    end if;

    insert into public.background_job_effects (
      job_id,
      effect_key,
      effect_kind,
      state,
      payload_hash,
      provider_name,
      provider_idempotency_key,
      provider_idempotency_expires_at,
      provider_message_id,
      safe_metadata
    )
    values (
      p_job_id,
      p_effect_key,
      p_effect_kind,
      p_state,
      p_payload_hash,
      p_provider_name,
      p_provider_idempotency_key,
      p_provider_idempotency_expires_at,
      p_provider_message_id,
      coalesce(p_safe_metadata, '{}'::jsonb)
    )
    returning * into v_effect;
    v_previous_state := null;
  else
    if v_effect.effect_key <> p_effect_key
       or v_effect.payload_hash <> p_payload_hash
       or v_effect.provider_name is distinct from p_provider_name
       or v_effect.provider_idempotency_key is distinct from p_provider_idempotency_key
       or v_effect.provider_idempotency_expires_at is distinct from p_provider_idempotency_expires_at
       or (
         v_effect.provider_message_id is not null
         and v_effect.provider_message_id is distinct from p_provider_message_id
       ) then
      raise exception 'effect checkpoint identity does not match its frozen preparation'
        using errcode = '23505';
    end if;

    if v_effect.state = p_state then
      if v_effect.safe_metadata is distinct from coalesce(p_safe_metadata, '{}'::jsonb)
         or v_effect.provider_message_id is distinct from p_provider_message_id then
        raise exception 'repeated effect checkpoint does not exactly match the durable checkpoint'
          using errcode = '23505';
      end if;
      return v_effect;
    end if;

    if p_state = 'provider_accepted'
       and v_effect.state <> 'dispatch_started' then
      raise exception 'provider acceptance requires a fresh dispatch_started checkpoint'
        using errcode = '22023';
    end if;

    if v_job.execution_owner = 'shadow' then
      raise exception 'shadow jobs can retain only a prepared non-dispatch checkpoint'
        using errcode = '22023';
    end if;

    v_previous_state := v_effect.state;

    if p_state = 'dispatch_started' then
      if v_job.status not in ('preparing', 'running', 'dispatching') then
        raise exception 'provider dispatch is incompatible with the current job state'
          using errcode = '22023';
      end if;
    elsif p_state in ('failed', 'uncertain') then
      if v_job.status not in ('preparing', 'running', 'dispatching') then
        raise exception 'provider failure checkpoint is incompatible with the current job state'
          using errcode = '22023';
      end if;
      if p_state = 'uncertain' and v_effect.state <> 'dispatch_started' then
        raise exception 'only a started provider dispatch can become uncertain'
          using errcode = '22023';
      end if;
    elsif p_state = 'provider_accepted' and v_job.status not in ('dispatching', 'provider_accepted') then
      raise exception 'provider acceptance is incompatible with the current job state'
        using errcode = '22023';
    elsif p_state = 'finalised' and v_job.status not in ('provider_accepted', 'finalising') then
      raise exception 'effect finalisation is incompatible with the current job state'
        using errcode = '22023';
    end if;

    update public.background_job_effects
    set state = p_state,
        provider_message_id = coalesce(background_job_effects.provider_message_id, p_provider_message_id),
        dispatch_started_at = case
          when p_state = 'dispatch_started' then coalesce(dispatch_started_at, now())
          else dispatch_started_at
        end,
        provider_accepted_at = case
          when p_state = 'provider_accepted' then coalesce(provider_accepted_at, now())
          else provider_accepted_at
        end,
        finalised_at = case
          when p_state = 'finalised' then coalesce(finalised_at, now())
          else finalised_at
        end,
        safe_metadata = coalesce(p_safe_metadata, '{}'::jsonb)
    where id = v_effect.id
    returning * into v_effect;
  end if;

  if p_state = 'dispatch_started' then
    if v_job.cancellation_requested_at is not null then
      raise exception 'background-job cancellation must be acknowledged before provider dispatch'
        using errcode = '22023';
    end if;
    if v_job.execution_owner = 'shadow' then
      raise exception 'shadow jobs cannot start external dispatch' using errcode = '22023';
    end if;
    if p_provider_name is null
       or p_provider_idempotency_key is null
       or p_provider_idempotency_expires_at is null
       or p_provider_idempotency_expires_at <= now() then
      raise exception 'provider dispatch requires frozen identity and a live idempotency window'
        using errcode = '22023';
    end if;
    update public.background_jobs
    set status = 'dispatching',
        current_phase = 'provider_dispatch'
    where id = p_job_id
      and lease_owner = p_worker_id
      and lease_token = p_lease_token
      and status in ('preparing', 'running', 'dispatching')
    returning * into v_job;
    if not found then
      raise exception 'job is not ready for provider dispatch' using errcode = '22023';
    end if;
    v_event_type := 'provider_dispatch';
  elsif p_state = 'provider_accepted' then
    if p_provider_name is null
       or p_provider_message_id is null
       or p_provider_idempotency_key is null
       or p_provider_idempotency_expires_at is null then
      raise exception 'provider acceptance requires provider identity and idempotency metadata'
        using errcode = '22023';
    end if;
    update public.background_jobs
    set status = 'provider_accepted',
        current_phase = 'provider_accepted',
        provider_name = p_provider_name,
        provider_message_id = p_provider_message_id,
        provider_idempotency_expires_at = p_provider_idempotency_expires_at
    where id = p_job_id
      and lease_owner = p_worker_id
      and lease_token = p_lease_token
      and status in ('dispatching', 'provider_accepted')
    returning * into v_job;
    if not found then
      raise exception 'job is not dispatching this provider effect' using errcode = '22023';
    end if;
    v_event_type := 'provider_accepted';
  elsif p_state = 'finalised' then
    v_event_type := 'finalised';
  end if;

  perform private.background_job_insert_event(
    p_job_id,
    v_job.queue_message_id,
    v_event_type,
    v_previous_job_status,
    v_job.status,
    v_job.current_phase,
    v_job.attempt_count,
    p_worker_id,
    null,
    null,
    jsonb_build_object(
      'effectKind', p_effect_kind,
      'checkpoint', p_state,
      'previousCheckpoint', v_previous_state
    )
  );

  return v_effect;
end;
$$;

-- Local provider acceptance normally delegates to the generic effect
-- checkpoint. If a signed callback committed a different provider message in
-- the narrow pre-write race, catch that identity error and quarantine the job
-- in the same lease-fenced transaction. Returning the already-accepted effect
-- lets the worker distinguish this committed terminal classification without
-- attempting a second terminal write after shutdown.
create function public.background_job_record_provider_acceptance(
  p_job_id uuid,
  p_worker_id text,
  p_lease_token uuid,
  p_effect_key text,
  p_effect_kind text,
  p_payload_hash text,
  p_provider_name text,
  p_provider_idempotency_key text,
  p_provider_idempotency_expires_at timestamptz,
  p_provider_message_id text,
  p_safe_metadata jsonb default '{}'::jsonb
)
returns public.background_job_effects
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_job public.background_jobs%rowtype;
  v_effect public.background_job_effects%rowtype;
  v_previous_status public.background_job_status;
  v_conflict_reason text;
begin
  if p_provider_message_id is null
     or length(p_provider_message_id) not between 1 and 256
     or p_provider_message_id !~ '^[A-Za-z0-9._:-]+$' then
    raise exception 'invalid provider message ID' using errcode = '22023';
  end if;

  -- Hold the job lock outside the exception subtransaction. If the generic
  -- checkpoint raises 23505, PostgreSQL rolls that inner block back; this
  -- outer lock prevents lease recovery or a replacement claim from entering
  -- before the conflict is durably classified.
  v_job := private.background_job_lock_owned(p_job_id, p_worker_id, p_lease_token);

  begin
    select * into strict v_effect
    from public.background_job_record_effect_checkpoint(
      p_job_id,
      p_worker_id,
      p_lease_token,
      p_effect_key,
      p_effect_kind,
      'provider_accepted',
      p_payload_hash,
      p_provider_name,
      p_provider_idempotency_key,
      p_provider_idempotency_expires_at,
      p_provider_message_id,
      p_safe_metadata
    );
    return v_effect;
  exception when unique_violation then
    select effect.*
    into v_effect
    from public.background_job_effects effect
    where effect.job_id = p_job_id
      and effect.effect_kind = p_effect_kind
    for update;

    if not found
       or v_effect.effect_key <> p_effect_key
       or v_effect.payload_hash <> p_payload_hash
       or v_effect.provider_name is distinct from p_provider_name
       or v_effect.provider_idempotency_key is distinct from p_provider_idempotency_key
       or v_effect.provider_idempotency_expires_at is distinct from p_provider_idempotency_expires_at then
      raise;
    end if;

    if v_effect.state in ('provider_accepted', 'finalised')
       and v_effect.provider_message_id is not null
       and v_effect.provider_message_id <> p_provider_message_id then
      v_conflict_reason := 'provider_message_id_conflict';
    elsif v_effect.state in ('dispatch_started', 'uncertain', 'failed')
          and exists (
            select 1
            from public.background_job_effects other_effect
            where other_effect.provider_name = p_provider_name
              and other_effect.provider_message_id = p_provider_message_id
              and other_effect.id <> v_effect.id
          ) then
      v_conflict_reason := 'provider_message_id_collision';
      if v_effect.state = 'dispatch_started' then
        update public.background_job_effects
        set state = 'uncertain',
            safe_metadata = jsonb_build_object(
              'effectKind', effect_kind,
              'checkpoint', 'uncertain',
              'providerName', provider_name
            ),
            updated_at = now()
        where id = v_effect.id
        returning * into v_effect;
      end if;
    else
      raise;
    end if;

    v_previous_status := v_job.status;
    perform private.background_job_archive_canonical(v_job.id, v_job.queue_message_id);
    update public.background_jobs
    set status = 'needs_attention',
        current_phase = 'provider_reconciliation',
        error_code = 'EMAIL_PROVIDER_MESSAGE_ID_CONFLICT',
        error_message = private.background_job_safe_error_copy('EMAIL_PROVIDER_MESSAGE_ID_CONFLICT'),
        safe_progress = jsonb_build_object(
          'phase', 'provider_reconciliation',
          'progressCode', v_conflict_reason,
          'retryable', false
        ),
        lease_owner = null,
        lease_token = null,
        lease_started_at = null,
        lease_expires_at = null,
        last_heartbeat_at = null
    where id = p_job_id
      and lease_owner = p_worker_id
      and lease_token = p_lease_token
    returning * into v_job;

    perform private.background_job_insert_event(
      v_job.id,
      v_job.queue_message_id,
      'needs_attention',
      v_previous_status,
      'needs_attention',
      'provider_reconciliation',
      v_job.attempt_count,
      p_worker_id,
      null,
      'EMAIL_PROVIDER_MESSAGE_ID_CONFLICT',
      jsonb_build_object(
        'reason', v_conflict_reason,
        'effectKind', p_effect_kind,
        'providerName', p_provider_name
      )
    );
    return v_effect;
  end;
end;
$$;

-- A cooperative worker may lose the provider response and then also lose its
-- explicit uncertain-checkpoint write. When the durable job is still
-- dispatching, schedule_retry owns that narrow recovery: exactly one started
-- effect becomes uncertain in the same transaction as the retry. A missing or
-- ambiguous checkpoint, an expired frozen key, or exhausted attempts aborts
-- the write so reconciliation can move the job to an operator-visible state.
create or replace function public.background_job_schedule_retry(
  p_job_id uuid,
  p_worker_id text,
  p_lease_token uuid,
  p_delay_seconds integer,
  p_error_code text,
  p_error_message text
)
returns public.background_jobs
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_job public.background_jobs%rowtype;
  v_previous_status public.background_job_status;
  v_message_id bigint;
  v_dispatch_started_count integer := 0;
  v_dispatch_outcome_count integer := 0;
  v_updated_dispatch_count integer := 0;
begin
  if p_delay_seconds is null or p_delay_seconds not between 1 and 72000 then
    raise exception 'retry delay must be between 1 second and 20 hours' using errcode = '22023';
  end if;

  v_job := private.background_job_lock_owned(p_job_id, p_worker_id, p_lease_token);
  if v_job.cancellation_requested_at is not null then
    raise exception 'background-job cancellation must be acknowledged before lifecycle changes'
      using errcode = '22023';
  end if;
  v_previous_status := v_job.status;

  if v_job.status = 'dispatching' then
    select
      count(*) filter (where effect.state = 'dispatch_started'),
      count(*) filter (where effect.state in ('dispatch_started', 'failed', 'uncertain'))
    into v_dispatch_started_count, v_dispatch_outcome_count
    from public.background_job_effects effect
    where effect.job_id = p_job_id;

    if v_dispatch_outcome_count <> 1 then
      raise exception 'dispatch retry requires exactly one durable provider outcome checkpoint'
        using errcode = '22023';
    end if;

    if v_dispatch_started_count = 1 then
      update public.background_job_effects
      set state = 'uncertain',
          safe_metadata = jsonb_build_object(
            'effectKind', effect_kind,
            'checkpoint', 'uncertain',
            'providerName', provider_name
          ),
          updated_at = now()
      where job_id = p_job_id
        and state = 'dispatch_started';
      get diagnostics v_updated_dispatch_count = row_count;
      if v_updated_dispatch_count <> 1 then
        raise exception 'dispatch retry could not atomically freeze one uncertain provider outcome'
          using errcode = '22023';
      end if;
    end if;
  elsif exists (
    select 1
    from public.background_job_effects effect
    where effect.job_id = p_job_id
      and effect.state = 'dispatch_started'
  ) then
    raise exception 'started provider dispatch is incompatible with the current retry state'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.background_job_effects effect
    where effect.job_id = p_job_id
      and effect.state in ('provider_accepted', 'finalised')
  ) then
    raise exception 'provider-accepted work must resume finalisation, not retry dispatch'
      using errcode = '22023';
  end if;

  if v_job.attempt_count >= v_job.max_attempts
     and exists (
       select 1
       from public.background_job_effects effect
       where effect.job_id = p_job_id
         and effect.state = 'uncertain'
     ) then
    raise exception 'retry-exhausted provider uncertainty must move to needs attention'
      using errcode = '22023';
  end if;

  if v_job.attempt_count >= v_job.max_attempts then
    perform private.background_job_archive_canonical(v_job.id, v_job.queue_message_id);
    update public.background_jobs
    set status = 'permanent_failed',
        current_phase = 'retry_exhausted',
        error_code = p_error_code,
        error_message = private.background_job_safe_error_copy(p_error_code),
        lease_owner = null,
        lease_token = null,
        lease_started_at = null,
        lease_expires_at = null,
        last_heartbeat_at = null
    where id = p_job_id
      and lease_owner = p_worker_id
      and lease_token = p_lease_token
    returning * into v_job;
    perform private.background_job_insert_event(
      v_job.id,
      v_job.queue_message_id,
      'permanent_failed',
      v_previous_status,
      'permanent_failed',
      'retry_exhausted',
      v_job.attempt_count,
      p_worker_id,
      null,
      p_error_code
    );
    return v_job;
  end if;

  if v_job.execution_owner <> 'shadow' and exists (
    select 1
    from public.background_job_effects effect
    where effect.job_id = p_job_id
      and effect.state in ('prepared', 'failed', 'uncertain')
      and (
        effect.provider_idempotency_expires_at is null
        or effect.provider_idempotency_expires_at <= now() + make_interval(secs => p_delay_seconds)
      )
  ) then
    raise exception 'redispatchable provider work must stay inside its frozen idempotency window'
      using errcode = '22023';
  end if;

  v_message_id := private.background_job_set_visibility_or_repair(
    v_job.id,
    v_job.contract_version,
    v_job.queue_message_id,
    p_delay_seconds,
    p_worker_id,
    case when v_previous_status = 'dispatching'
      then 'provider_uncertainty_retry'
      else 'retry'
    end
  );

  update public.background_jobs
  set status = 'retrying',
      current_phase = case when v_previous_status = 'dispatching'
        then 'provider_retry'
        else 'retry_wait'
      end,
      next_attempt_at = now() + make_interval(secs => p_delay_seconds),
      queue_message_id = v_message_id,
      error_code = p_error_code,
      error_message = private.background_job_safe_error_copy(p_error_code),
      lease_owner = null,
      lease_token = null,
      lease_started_at = null,
      lease_expires_at = null,
      last_heartbeat_at = null
  where id = p_job_id
    and lease_owner = p_worker_id
    and lease_token = p_lease_token
  returning * into v_job;

  perform private.background_job_insert_event(
    v_job.id,
    v_job.queue_message_id,
    'retry_scheduled',
    v_previous_status,
    'retrying',
    v_job.current_phase,
    v_job.attempt_count,
    p_worker_id,
    null,
    p_error_code,
    jsonb_build_object('delaySeconds', p_delay_seconds)
  );
  return v_job;
end;
$$;

-- A worker terminal-classification write and the signed webhook both lock the
-- job before the effect. If acceptance committed first, it is authoritative
-- and must remain available for finalisation instead of being overwritten by
-- Needs attention. If this function commits first, the webhook may still
-- reconcile needs_attention -> provider_accepted afterwards.
create or replace function public.background_job_mark_needs_attention(
  p_job_id uuid,
  p_worker_id text,
  p_lease_token uuid,
  p_error_code text,
  p_error_message text,
  p_safe_detail jsonb default '{}'::jsonb
)
returns public.background_jobs
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_job public.background_jobs%rowtype;
  v_previous_status public.background_job_status;
begin
  select job.* into v_job from public.background_jobs job where job.id = p_job_id for update;
  if not found then
    raise exception 'background job not found' using errcode = 'P0002';
  end if;
  v_job := private.background_job_lock_owned(p_job_id, p_worker_id, p_lease_token);
  if v_job.cancellation_requested_at is not null then
    raise exception 'background-job cancellation must be acknowledged before lifecycle changes'
      using errcode = '22023';
  end if;
  if not public.background_job_safe_summary('progress', coalesce(p_safe_detail, '{}'::jsonb)) then
    raise exception 'unsafe background-job attention detail' using errcode = '22023';
  end if;
  if private.background_job_provider_acceptance_wins(p_error_code) and exists (
    select 1
    from public.background_job_effects effect
    where effect.job_id = p_job_id
      and effect.state in ('provider_accepted', 'finalised')
  ) then
    raise exception 'provider-accepted work must resume finalisation, not needs attention'
      using errcode = '40001';
  end if;
  v_previous_status := v_job.status;

  update public.background_job_effects
  set state = 'uncertain',
      safe_metadata = jsonb_build_object(
        'effectKind', effect_kind,
        'checkpoint', 'uncertain',
        'providerName', provider_name
      ),
      updated_at = now()
  where job_id = p_job_id
    and state = 'dispatch_started';

  perform private.background_job_archive_canonical(v_job.id, v_job.queue_message_id);

  update public.background_jobs
  set status = 'needs_attention',
      current_phase = 'needs_attention',
      error_code = p_error_code,
      error_message = private.background_job_safe_error_copy(p_error_code),
      safe_progress = coalesce(p_safe_detail, '{}'::jsonb),
      lease_owner = null,
      lease_token = null,
      lease_started_at = null,
      lease_expires_at = null,
      last_heartbeat_at = null
  where id = p_job_id
    and lease_owner = p_worker_id
    and lease_token = p_lease_token
  returning * into v_job;

  perform private.background_job_insert_event(
    v_job.id,
    v_job.queue_message_id,
    'needs_attention',
    v_previous_status,
    'needs_attention',
    'needs_attention',
    v_job.attempt_count,
    p_worker_id,
    null,
    p_error_code,
    coalesce(p_safe_detail, '{}'::jsonb)
  );
  return v_job;
end;
$$;

-- Permanent failure is also lease-fenced before any row can be returned. A
-- verified acceptance that commits first blocks only stale provider-outcome
-- classifications; genuine identity/finaliser failures remain explicit.
create or replace function public.background_job_mark_permanent_failure(
  p_job_id uuid,
  p_worker_id text,
  p_lease_token uuid,
  p_error_code text,
  p_error_message text
)
returns public.background_jobs
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_job public.background_jobs%rowtype;
  v_previous_status public.background_job_status;
begin
  v_job := private.background_job_lock_owned(p_job_id, p_worker_id, p_lease_token);
  if v_job.cancellation_requested_at is not null then
    raise exception 'background-job cancellation must be acknowledged before lifecycle changes'
      using errcode = '22023';
  end if;
  if exists (
    select 1
    from public.background_job_effects effect
    where effect.job_id = p_job_id
      and effect.state in ('dispatch_started', 'provider_accepted', 'finalised', 'uncertain')
  ) then
    if private.background_job_provider_acceptance_wins(p_error_code) and exists (
      select 1
      from public.background_job_effects effect
      where effect.job_id = p_job_id
        and effect.state in ('provider_accepted', 'finalised')
    ) then
      raise exception 'provider-accepted work must resume finalisation, not permanent failure'
        using errcode = '40001';
    end if;
    raise exception 'started, accepted, or uncertain effects require reconciliation or needs attention'
      using errcode = '22023';
  end if;

  v_previous_status := v_job.status;
  perform private.background_job_archive_canonical(v_job.id, v_job.queue_message_id);

  update public.background_jobs
  set status = 'permanent_failed',
      current_phase = 'permanent_failed',
      error_code = p_error_code,
      error_message = private.background_job_safe_error_copy(p_error_code),
      lease_owner = null,
      lease_token = null,
      lease_started_at = null,
      lease_expires_at = null,
      last_heartbeat_at = null
  where id = p_job_id
    and lease_owner = p_worker_id
    and lease_token = p_lease_token
  returning * into v_job;

  perform private.background_job_insert_event(
    v_job.id,
    v_job.queue_message_id,
    'permanent_failed',
    v_previous_status,
    'permanent_failed',
    'permanent_failed',
    v_job.attempt_count,
    p_worker_id,
    null,
    p_error_code
  );
  return v_job;
end;
$$;

-- A process loss after dispatch_started is not proof of delivery failure or
-- acceptance. While the exact frozen provider key remains live, recover the
-- uncertain effect as retryable so the gateway can repeat the identical
-- request under Resend's idempotency contract. Expiry, attempt exhaustion, or
-- a missing dispatch checkpoint remain attention-only.
create or replace function public.background_jobs_recover_expired_leases(
  p_worker_id text,
  p_limit integer default 100
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_job public.background_jobs%rowtype;
  v_previous_status public.background_job_status;
  v_message_id bigint;
  v_recovered integer := 0;
  v_dispatch_effect_count integer := 0;
  v_dispatch_outcome_count integer := 0;
begin
  if p_worker_id is null or p_worker_id !~ '^[A-Za-z0-9._:-]{1,128}$' then
    raise exception 'invalid worker ID' using errcode = '22023';
  end if;
  if p_limit is null or p_limit not between 1 and 1000 then
    raise exception 'recovery limit must be between 1 and 1000' using errcode = '22023';
  end if;

  for v_job in
    select job.*
    from public.background_jobs job
    where job.lease_expires_at <= now()
      and job.status in ('claimed', 'preparing', 'running', 'dispatching', 'provider_accepted', 'finalising')
    order by job.lease_expires_at, job.created_at
    for update skip locked
    limit p_limit
  loop
    v_previous_status := v_job.status;
    v_dispatch_effect_count := 0;
    v_dispatch_outcome_count := 0;

    perform private.background_job_insert_event(
      v_job.id,
      v_job.queue_message_id,
      'lease_expired',
      v_previous_status,
      v_previous_status,
      v_job.current_phase,
      v_job.attempt_count,
      p_worker_id
    );

    if v_previous_status = 'dispatching' then
      select
        count(*) filter (where effect.state in ('dispatch_started', 'uncertain')),
        count(*)
      into v_dispatch_effect_count, v_dispatch_outcome_count
      from public.background_job_effects effect
      where effect.job_id = v_job.id;

      if v_dispatch_effect_count <> 1 or v_dispatch_outcome_count <> 1 then
        perform private.background_job_archive_canonical(v_job.id, v_job.queue_message_id);
        update public.background_jobs
        set status = 'needs_attention',
            current_phase = 'provider_reconciliation',
            error_code = 'PROVIDER_EFFECT_INVARIANT',
            error_message = private.background_job_safe_error_copy('PROVIDER_EFFECT_INVARIANT'),
            lease_owner = null,
            lease_token = null,
            lease_started_at = null,
            lease_expires_at = null,
            last_heartbeat_at = null
        where id = v_job.id;
        perform private.background_job_insert_event(
          v_job.id,
          v_job.queue_message_id,
          'needs_attention',
          v_previous_status,
          'needs_attention',
          'provider_reconciliation',
          v_job.attempt_count,
          p_worker_id,
          null,
          'PROVIDER_EFFECT_INVARIANT',
          jsonb_build_object('reason', 'provider_effect_invariant')
        );
        v_recovered := v_recovered + 1;
        continue;
      end if;

      update public.background_job_effects as effect
      set state = 'uncertain',
          safe_metadata = jsonb_build_object(
            'effectKind', effect.effect_kind,
            'checkpoint', 'uncertain',
            'providerName', effect.provider_name
          ),
          updated_at = now()
      where effect.job_id = v_job.id
        and effect.state = 'dispatch_started';
    end if;

    if v_previous_status in ('provider_accepted', 'finalising') then
      v_message_id := private.background_job_set_visibility_or_repair(
        v_job.id,
        v_job.contract_version,
        v_job.queue_message_id,
        0,
        p_worker_id,
        'resume_finalisation'
      );

      update public.background_jobs
      set queue_message_id = v_message_id,
          next_attempt_at = now(),
          lease_owner = null,
          lease_token = null,
          lease_started_at = null,
          lease_expires_at = null,
          last_heartbeat_at = null
      where id = v_job.id;

      perform private.background_job_insert_event(
        v_job.id,
        v_message_id,
        'reconciled',
        v_previous_status,
        v_previous_status,
        v_job.current_phase,
        v_job.attempt_count,
        p_worker_id,
        null,
        null,
        jsonb_build_object('reason', 'resume_finalisation')
      );
    elsif v_job.cancellation_requested_at is not null then
      perform private.background_job_archive_canonical(v_job.id, v_job.queue_message_id);

      update public.background_jobs
      set status = 'cancelled',
          current_phase = 'cancelled',
          error_code = null,
          error_message = null,
          lease_owner = null,
          lease_token = null,
          lease_started_at = null,
          lease_expires_at = null,
          last_heartbeat_at = null
      where id = v_job.id;

      perform private.background_job_insert_event(
        v_job.id,
        v_job.queue_message_id,
        'cancelled',
        v_previous_status,
        'cancelled',
        'cancelled',
        v_job.attempt_count,
        p_worker_id,
        v_job.cancellation_requested_by,
        null,
        jsonb_build_object('reason', 'expired_lease_cancellation_acknowledged')
      );
    elsif v_job.execution_owner <> 'shadow' and exists (
      select 1
      from public.background_job_effects effect
      where effect.job_id = v_job.id
        and effect.state in ('prepared', 'failed', 'uncertain')
        and (
          effect.provider_idempotency_expires_at is null
          or effect.provider_idempotency_expires_at <= now()
        )
    ) then
      perform private.background_job_archive_canonical(v_job.id, v_job.queue_message_id);

      update public.background_jobs
      set status = 'needs_attention',
          current_phase = 'provider_reconciliation',
          error_code = 'PROVIDER_IDEMPOTENCY_WINDOW_EXPIRED',
          error_message = private.background_job_safe_error_copy('PROVIDER_IDEMPOTENCY_WINDOW_EXPIRED'),
          lease_owner = null,
          lease_token = null,
          lease_started_at = null,
          lease_expires_at = null,
          last_heartbeat_at = null
      where id = v_job.id;

      perform private.background_job_insert_event(
        v_job.id,
        v_job.queue_message_id,
        'needs_attention',
        v_previous_status,
        'needs_attention',
        'provider_reconciliation',
        v_job.attempt_count,
        p_worker_id,
        null,
        'PROVIDER_IDEMPOTENCY_WINDOW_EXPIRED',
        jsonb_build_object('reason', 'provider_idempotency_window_expired')
      );
    elsif v_job.attempt_count >= v_job.max_attempts and exists (
      select 1
      from public.background_job_effects effect
      where effect.job_id = v_job.id
        and effect.state = 'uncertain'
    ) then
      perform private.background_job_archive_canonical(v_job.id, v_job.queue_message_id);

      update public.background_jobs
      set status = 'needs_attention',
          current_phase = 'provider_reconciliation',
          error_code = 'PROVIDER_OUTCOME_UNCERTAIN',
          error_message = private.background_job_safe_error_copy('PROVIDER_OUTCOME_UNCERTAIN'),
          lease_owner = null,
          lease_token = null,
          lease_started_at = null,
          lease_expires_at = null,
          last_heartbeat_at = null
      where id = v_job.id;

      perform private.background_job_insert_event(
        v_job.id,
        v_job.queue_message_id,
        'needs_attention',
        v_previous_status,
        'needs_attention',
        'provider_reconciliation',
        v_job.attempt_count,
        p_worker_id,
        null,
        'PROVIDER_OUTCOME_UNCERTAIN',
        jsonb_build_object('reason', 'provider_outcome_uncertain')
      );
    elsif v_job.attempt_count >= v_job.max_attempts then
      perform private.background_job_archive_canonical(v_job.id, v_job.queue_message_id);

      update public.background_jobs
      set status = 'permanent_failed',
          current_phase = 'retry_exhausted',
          error_code = 'RETRY_EXHAUSTED',
          error_message = private.background_job_safe_error_copy('RETRY_EXHAUSTED'),
          lease_owner = null,
          lease_token = null,
          lease_started_at = null,
          lease_expires_at = null,
          last_heartbeat_at = null
      where id = v_job.id;

      perform private.background_job_insert_event(
        v_job.id,
        v_job.queue_message_id,
        'permanent_failed',
        v_previous_status,
        'permanent_failed',
        'retry_exhausted',
        v_job.attempt_count,
        p_worker_id,
        null,
        'RETRY_EXHAUSTED'
      );
    else
      v_message_id := private.background_job_set_visibility_or_repair(
        v_job.id,
        v_job.contract_version,
        v_job.queue_message_id,
        0,
        p_worker_id,
        case when v_previous_status = 'dispatching'
          then 'provider_uncertainty_recovery'
          else 'lease_recovery'
        end
      );

      update public.background_jobs
      set status = 'retrying',
          current_phase = case when v_previous_status = 'dispatching'
            then 'provider_retry'
            else 'lease_recovery'
          end,
          next_attempt_at = now(),
          queue_message_id = v_message_id,
          error_code = case when v_previous_status = 'dispatching'
            then 'PROVIDER_OUTCOME_UNCERTAIN'
            else error_code
          end,
          error_message = case when v_previous_status = 'dispatching'
            then private.background_job_safe_error_copy('PROVIDER_OUTCOME_UNCERTAIN')
            else error_message
          end,
          lease_owner = null,
          lease_token = null,
          lease_started_at = null,
          lease_expires_at = null,
          last_heartbeat_at = null
      where id = v_job.id;

      perform private.background_job_insert_event(
        v_job.id,
        v_message_id,
        'retry_scheduled',
        v_previous_status,
        'retrying',
        case when v_previous_status = 'dispatching'
          then 'provider_retry'
          else 'lease_recovery'
        end,
        v_job.attempt_count,
        p_worker_id,
        null,
        case when v_previous_status = 'dispatching'
          then 'PROVIDER_OUTCOME_UNCERTAIN'
          else null
        end,
        jsonb_build_object('delaySeconds', 0)
      );
    end if;

    v_recovered := v_recovered + 1;
  end loop;

  return v_recovered;
end;
$$;

-- Apply the same provider-uncertainty policy when the queue message itself
-- becomes visible before the periodic recovery pass. The message remains the
-- exact canonical pointer and this transaction immediately grants a new lease;
-- no second message or provider identity is created.
create or replace function public.background_jobs_claim(
  p_worker_id text,
  p_batch_size integer default 5,
  p_visibility_timeout_seconds integer default 120
)
returns table (
  job_id uuid,
  kind text,
  contract_version integer,
  status public.background_job_status,
  current_phase text,
  attempt_number integer,
  max_attempts integer,
  queue_message_id bigint,
  lease_token uuid,
  lease_expires_at timestamptz,
  cancellation_requested_at timestamptz,
  rollout_mode public.background_job_rollout_mode,
  execution_owner public.background_job_execution_owner
)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_message record;
  v_job public.background_jobs%rowtype;
  v_job_id uuid;
  v_contract_version integer;
  v_previous_status public.background_job_status;
  v_delay_seconds integer;
  v_dispatch_effect_count integer := 0;
  v_dispatch_outcome_count integer := 0;
begin
  if p_worker_id is null or p_worker_id !~ '^[A-Za-z0-9._:-]{1,128}$' then
    raise exception 'invalid worker ID' using errcode = '22023';
  end if;
  if p_batch_size is null or p_batch_size not between 1 and 100 then
    raise exception 'batch size must be between 1 and 100' using errcode = '22023';
  end if;
  if p_visibility_timeout_seconds is null or p_visibility_timeout_seconds not between 15 and 3600 then
    raise exception 'visibility timeout must be between 15 and 3600 seconds' using errcode = '22023';
  end if;

  for v_message in
    select *
    from pgmq.read('portal_background_jobs', p_visibility_timeout_seconds, p_batch_size)
  loop
    v_job_id := null;
    v_contract_version := null;
    v_dispatch_effect_count := 0;
    v_dispatch_outcome_count := 0;

    begin
      if jsonb_typeof(v_message.message) <> 'object'
         or (select count(*) from jsonb_object_keys(v_message.message)) <> 2
         or not (v_message.message ? 'jobId')
         or not (v_message.message ? 'contractVersion')
         or jsonb_typeof(v_message.message -> 'jobId') <> 'string'
         or jsonb_typeof(v_message.message -> 'contractVersion') <> 'number' then
        raise exception 'invalid minimal queue contract';
      end if;
      v_job_id := (v_message.message ->> 'jobId')::uuid;
      v_contract_version := (v_message.message ->> 'contractVersion')::integer;
      if v_contract_version <= 0 then
        raise exception 'invalid queue contract version';
      end if;
    exception when others then
      perform pgmq.archive('portal_background_jobs', v_message.msg_id);
      perform private.background_job_insert_event(
        null,
        v_message.msg_id,
        'orphaned_message',
        null,
        null,
        null,
        null,
        p_worker_id,
        null,
        'INVALID_QUEUE_MESSAGE',
        jsonb_build_object('reason', 'invalid_minimal_contract')
      );
      continue;
    end;

    select candidate.*
    into v_job
    from public.background_jobs candidate
    where candidate.id = v_job_id
    for update skip locked;

    if not found then
      if exists (select 1 from public.background_jobs existing where existing.id = v_job_id) then
        perform pgmq.set_vt('portal_background_jobs', v_message.msg_id, 5);
      else
        perform pgmq.archive('portal_background_jobs', v_message.msg_id);
        perform private.background_job_insert_event(
          null,
          v_message.msg_id,
          'orphaned_message',
          null,
          null,
          null,
          null,
          p_worker_id,
          null,
          'MISSING_LEDGER_ROW',
          jsonb_build_object('reason', 'job_not_found')
        );
      end if;
      continue;
    end if;

    v_previous_status := v_job.status;

    if v_job.queue_message_id is distinct from v_message.msg_id then
      perform pgmq.archive('portal_background_jobs', v_message.msg_id);
      perform private.background_job_insert_event(
        v_job.id,
        v_message.msg_id,
        'duplicate_message',
        v_job.status,
        v_job.status,
        v_job.current_phase,
        v_job.attempt_count,
        p_worker_id,
        null,
        null,
        jsonb_build_object('reason', 'non_canonical_message')
      );
      continue;
    end if;

    if v_job.contract_version <> v_contract_version then
      if v_job.status = 'dispatching' then
        update public.background_job_effects as effect
        set state = 'uncertain',
            safe_metadata = jsonb_build_object(
              'effectKind', effect.effect_kind,
              'checkpoint', 'uncertain',
              'providerName', effect.provider_name
            ),
            updated_at = now()
        where effect.job_id = v_job.id
          and effect.state = 'dispatch_started';
      end if;
      update public.background_jobs
      set status = 'needs_attention',
          current_phase = 'contract_mismatch',
          error_code = 'QUEUE_CONTRACT_MISMATCH',
          error_message = private.background_job_safe_error_copy('QUEUE_CONTRACT_MISMATCH'),
          lease_owner = null,
          lease_token = null,
          lease_started_at = null,
          lease_expires_at = null,
          last_heartbeat_at = null
      where id = v_job.id;
      perform pgmq.archive('portal_background_jobs', v_message.msg_id);
      perform private.background_job_insert_event(
        v_job.id,
        v_message.msg_id,
        'needs_attention',
        v_job.status,
        'needs_attention',
        'contract_mismatch',
        v_job.attempt_count,
        p_worker_id,
        null,
        'QUEUE_CONTRACT_MISMATCH'
      );
      continue;
    end if;

    if v_job.status in ('succeeded', 'cancelled', 'needs_attention', 'permanent_failed') then
      perform pgmq.archive('portal_background_jobs', v_message.msg_id);
      perform private.background_job_insert_event(
        v_job.id,
        v_message.msg_id,
        'reconciled',
        v_job.status,
        v_job.status,
        v_job.current_phase,
        v_job.attempt_count,
        p_worker_id,
        null,
        null,
        jsonb_build_object('reason', 'terminal_message_archived')
      );
      continue;
    end if;

    if v_job.next_attempt_at > now() then
      v_delay_seconds := greatest(1, ceil(extract(epoch from (v_job.next_attempt_at - now())))::integer);
      perform pgmq.set_vt('portal_background_jobs', v_message.msg_id, v_delay_seconds);
      continue;
    end if;

    if v_job.lease_expires_at is not null and v_job.lease_expires_at > now() then
      v_delay_seconds := greatest(1, ceil(extract(epoch from (v_job.lease_expires_at - now())))::integer);
      perform pgmq.set_vt('portal_background_jobs', v_message.msg_id, v_delay_seconds);
      continue;
    end if;

    if v_job.cancellation_requested_at is not null
       and v_job.status in ('queued', 'retrying', 'claimed', 'preparing', 'running') then
      v_previous_status := v_job.status;
      update public.background_jobs
      set status = 'cancelled',
          current_phase = 'cancelled',
          lease_owner = null,
          lease_token = null,
          lease_started_at = null,
          lease_expires_at = null,
          last_heartbeat_at = null
      where id = v_job.id;
      perform pgmq.archive('portal_background_jobs', v_message.msg_id);
      perform private.background_job_insert_event(
        v_job.id,
        v_message.msg_id,
        'cancelled',
        v_previous_status,
        'cancelled',
        'cancelled',
        v_job.attempt_count,
        p_worker_id
      );
      continue;
    end if;

    if v_job.lease_expires_at is not null then
      v_previous_status := v_job.status;
      perform private.background_job_insert_event(
        v_job.id,
        v_message.msg_id,
        'lease_expired',
        v_previous_status,
        v_previous_status,
        v_job.current_phase,
        v_job.attempt_count,
        p_worker_id
      );

      if v_previous_status = 'dispatching' then
        select
          count(*) filter (where effect.state in ('dispatch_started', 'uncertain')),
          count(*)
        into v_dispatch_effect_count, v_dispatch_outcome_count
        from public.background_job_effects effect
        where effect.job_id = v_job.id;

        if v_dispatch_effect_count <> 1 or v_dispatch_outcome_count <> 1 then
          update public.background_jobs
          set status = 'needs_attention',
              current_phase = 'provider_reconciliation',
              error_code = 'PROVIDER_EFFECT_INVARIANT',
              error_message = private.background_job_safe_error_copy('PROVIDER_EFFECT_INVARIANT'),
              lease_owner = null,
              lease_token = null,
              lease_started_at = null,
              lease_expires_at = null,
              last_heartbeat_at = null
          where id = v_job.id;
          perform pgmq.archive('portal_background_jobs', v_message.msg_id);
          perform private.background_job_insert_event(
            v_job.id,
            v_message.msg_id,
            'needs_attention',
            v_previous_status,
            'needs_attention',
            'provider_reconciliation',
            v_job.attempt_count,
            p_worker_id,
            null,
            'PROVIDER_EFFECT_INVARIANT',
            jsonb_build_object('reason', 'provider_effect_invariant')
          );
          continue;
        end if;

        update public.background_job_effects as effect
        set state = 'uncertain',
            safe_metadata = jsonb_build_object(
              'effectKind', effect.effect_kind,
              'checkpoint', 'uncertain',
              'providerName', effect.provider_name
            ),
            updated_at = now()
        where effect.job_id = v_job.id
          and effect.state = 'dispatch_started';

        -- A cancellation requested while the prior worker was in the provider
        -- call must win before this claimant can replay the frozen request.
        -- The checkpoint is already uncertain, so the ledger does not imply
        -- that an interrupted dispatch was proven absent.
        if v_job.cancellation_requested_at is not null then
          update public.background_jobs
          set status = 'cancelled',
              current_phase = 'cancelled',
              error_code = null,
              error_message = null,
              lease_owner = null,
              lease_token = null,
              lease_started_at = null,
              lease_expires_at = null,
              last_heartbeat_at = null
          where id = v_job.id;
          perform pgmq.archive('portal_background_jobs', v_message.msg_id);
          perform private.background_job_insert_event(
            v_job.id,
            v_message.msg_id,
            'cancelled',
            v_previous_status,
            'cancelled',
            'cancelled',
            v_job.attempt_count,
            p_worker_id,
            v_job.cancellation_requested_by,
            null,
            jsonb_build_object('reason', 'expired_lease_cancellation_acknowledged')
          );
          continue;
        end if;

        update public.background_jobs
        set status = 'retrying',
            current_phase = 'provider_retry',
            error_code = 'PROVIDER_OUTCOME_UNCERTAIN',
            error_message = private.background_job_safe_error_copy('PROVIDER_OUTCOME_UNCERTAIN'),
            lease_owner = null,
            lease_token = null,
            lease_started_at = null,
            lease_expires_at = null,
            last_heartbeat_at = null
        where id = v_job.id
        returning * into v_job;
        perform private.background_job_insert_event(
          v_job.id,
          v_message.msg_id,
          'retry_scheduled',
          v_previous_status,
          'retrying',
          'provider_retry',
          v_job.attempt_count,
          p_worker_id,
          null,
          'PROVIDER_OUTCOME_UNCERTAIN',
          jsonb_build_object('delaySeconds', 0)
        );
      elsif v_previous_status not in ('provider_accepted', 'finalising') then
        update public.background_jobs
        set status = 'retrying',
            current_phase = 'lease_recovery',
            lease_owner = null,
            lease_token = null,
            lease_started_at = null,
            lease_expires_at = null,
            last_heartbeat_at = null
        where id = v_job.id
        returning * into v_job;
      end if;
    end if;

    -- Provider-effect safety is decided before retry exhaustion so a live
    -- same-key uncertain request can run, but an expired or exhausted request
    -- can never be hidden as a generic permanent failure.
    if v_job.execution_owner <> 'shadow' and exists (
      select 1
      from public.background_job_effects effect
      where effect.job_id = v_job.id
        and effect.state in ('prepared', 'failed', 'uncertain')
        and (
          effect.provider_idempotency_expires_at is null
          or effect.provider_idempotency_expires_at <= now()
        )
    ) then
      perform private.background_job_archive_canonical(v_job.id, v_job.queue_message_id);
      update public.background_jobs
      set status = 'needs_attention',
          current_phase = 'provider_reconciliation',
          error_code = 'PROVIDER_IDEMPOTENCY_WINDOW_EXPIRED',
          error_message = private.background_job_safe_error_copy('PROVIDER_IDEMPOTENCY_WINDOW_EXPIRED'),
          lease_owner = null,
          lease_token = null,
          lease_started_at = null,
          lease_expires_at = null,
          last_heartbeat_at = null
      where id = v_job.id;
      perform private.background_job_insert_event(
        v_job.id,
        v_job.queue_message_id,
        'needs_attention',
        v_previous_status,
        'needs_attention',
        'provider_reconciliation',
        v_job.attempt_count,
        p_worker_id,
        null,
        'PROVIDER_IDEMPOTENCY_WINDOW_EXPIRED',
        jsonb_build_object('reason', 'provider_idempotency_window_expired')
      );
      continue;
    end if;

    if v_job.attempt_count >= v_job.max_attempts and exists (
      select 1
      from public.background_job_effects effect
      where effect.job_id = v_job.id
        and effect.state = 'uncertain'
    ) then
      perform private.background_job_archive_canonical(v_job.id, v_job.queue_message_id);
      update public.background_jobs
      set status = 'needs_attention',
          current_phase = 'provider_reconciliation',
          error_code = 'PROVIDER_OUTCOME_UNCERTAIN',
          error_message = private.background_job_safe_error_copy('PROVIDER_OUTCOME_UNCERTAIN'),
          lease_owner = null,
          lease_token = null,
          lease_started_at = null,
          lease_expires_at = null,
          last_heartbeat_at = null
      where id = v_job.id;
      perform private.background_job_insert_event(
        v_job.id,
        v_job.queue_message_id,
        'needs_attention',
        v_previous_status,
        'needs_attention',
        'provider_reconciliation',
        v_job.attempt_count,
        p_worker_id,
        null,
        'PROVIDER_OUTCOME_UNCERTAIN',
        jsonb_build_object('reason', 'provider_outcome_uncertain')
      );
      continue;
    end if;

    if v_job.status = 'retrying' and v_job.attempt_count >= v_job.max_attempts then
      update public.background_jobs
      set status = 'permanent_failed',
          current_phase = 'retry_exhausted',
          error_code = 'RETRY_EXHAUSTED',
          error_message = private.background_job_safe_error_copy('RETRY_EXHAUSTED'),
          lease_owner = null,
          lease_token = null,
          lease_started_at = null,
          lease_expires_at = null,
          last_heartbeat_at = null
      where id = v_job.id;
      perform pgmq.archive('portal_background_jobs', v_message.msg_id);
      perform private.background_job_insert_event(
        v_job.id,
        v_message.msg_id,
        'permanent_failed',
        'retrying',
        'permanent_failed',
        'retry_exhausted',
        v_job.attempt_count,
        p_worker_id,
        null,
        'RETRY_EXHAUSTED'
      );
      continue;
    end if;

    v_previous_status := v_job.status;
    update public.background_jobs as claimed_job
    set status = case
          when claimed_job.status in ('provider_accepted', 'finalising') then claimed_job.status
          else 'claimed'::public.background_job_status
        end,
        current_phase = case
          when claimed_job.status in ('provider_accepted', 'finalising') then claimed_job.current_phase
          else 'claimed'
        end,
        attempt_count = claimed_job.attempt_count + 1,
        lease_owner = p_worker_id,
        lease_token = gen_random_uuid(),
        lease_started_at = now(),
        lease_expires_at = now() + make_interval(secs => p_visibility_timeout_seconds),
        last_heartbeat_at = now(),
        error_code = null,
        error_message = null
    where id = v_job.id
    returning * into v_job;

    perform private.background_job_insert_event(
      v_job.id,
      v_message.msg_id,
      'claimed',
      v_previous_status,
      v_job.status,
      v_job.current_phase,
      v_job.attempt_count,
      p_worker_id
    );

    job_id := v_job.id;
    kind := v_job.kind;
    contract_version := v_job.contract_version;
    status := v_job.status;
    current_phase := v_job.current_phase;
    attempt_number := v_job.attempt_count;
    max_attempts := v_job.max_attempts;
    queue_message_id := v_job.queue_message_id;
    lease_token := v_job.lease_token;
    lease_expires_at := v_job.lease_expires_at;
    cancellation_requested_at := v_job.cancellation_requested_at;
    rollout_mode := v_job.rollout_mode;
    execution_owner := v_job.execution_owner;
    return next;
  end loop;
end;
$$;

revoke all on table private.background_job_provider_receipts
  from public, anon, authenticated, service_role;
revoke all on sequence private.background_job_provider_receipts_id_seq
  from public, anon, authenticated, service_role;
revoke all on function private.background_job_provider_receipts_append_only()
  from public, anon, authenticated, service_role;
revoke all on function private.background_job_provider_effect_ref(text, text)
  from public, anon, authenticated, service_role;
revoke all on function public.background_job_transition_allowed(
  public.background_job_status, public.background_job_status
) from public, anon, authenticated, service_role;
revoke all on function private.background_job_safe_error_copy(text)
  from public, anon, authenticated, service_role;
revoke all on function private.background_job_provider_acceptance_wins(text)
  from public, anon, authenticated, service_role;
revoke all on function public.background_job_reconcile_verified_provider_acceptance(
  text, text, text, text, timestamptz, uuid, text
) from public, anon, authenticated, service_role;
grant execute on function public.background_job_reconcile_verified_provider_acceptance(
  text, text, text, text, timestamptz, uuid, text
) to service_role;
revoke all on function public.background_job_record_provider_acceptance(
  uuid, text, uuid, text, text, text, text, text, timestamptz, text, jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.background_job_record_provider_acceptance(
  uuid, text, uuid, text, text, text, text, text, timestamptz, text, jsonb
) to service_role;
revoke all on function public.background_job_schedule_retry(uuid, text, uuid, integer, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.background_job_schedule_retry(uuid, text, uuid, integer, text, text)
  to service_role;
revoke all on function public.background_job_mark_permanent_failure(uuid, text, uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.background_job_mark_permanent_failure(uuid, text, uuid, text, text)
  to service_role;
revoke all on function public.background_jobs_recover_expired_leases(text, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.background_jobs_recover_expired_leases(text, integer)
  to service_role;
revoke all on function public.background_jobs_claim(text, integer, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.background_jobs_claim(text, integer, integer)
  to service_role;

notify pgrst, 'reload schema';
