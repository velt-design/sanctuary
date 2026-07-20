-- Wave 3 JOB-01: lease-fenced lifecycle, effect checkpoints, retry, failure,
-- cancellation, and idempotent terminal finalisation.

create or replace function private.background_job_lock_owned(
  p_job_id uuid,
  p_worker_id text,
  p_lease_token uuid
)
returns public.background_jobs
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_job public.background_jobs%rowtype;
begin
  select job.*
  into v_job
  from public.background_jobs job
  where job.id = p_job_id
  for update;

  if not found
     or p_worker_id is null
     or p_lease_token is null
     or v_job.lease_owner is null
     or v_job.lease_token is null
     or v_job.lease_expires_at is null
     or v_job.lease_owner is distinct from p_worker_id
     or v_job.lease_token is distinct from p_lease_token
     or v_job.lease_expires_at <= now()
     or v_job.status not in ('claimed', 'preparing', 'running', 'dispatching', 'provider_accepted', 'finalising') then
    raise exception 'background-job lease is no longer owned by this worker' using errcode = '55000';
  end if;

  return v_job;
end;
$$;

create or replace function private.background_job_archive_canonical(
  p_job_id uuid,
  p_message_id bigint
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_archived boolean;
begin
  select pgmq.archive('portal_background_jobs', p_message_id)
  into v_archived;

  if v_archived is distinct from true then
    perform private.background_job_insert_event(
      p_job_id,
      p_message_id,
      'queue_archive_missing',
      null,
      null,
      null,
      null,
      null,
      null,
      'QUEUE_MESSAGE_MISSING'
    );
    raise exception 'canonical queue message is missing; reconcile before finalisation'
      using errcode = '55000';
  end if;
end;
$$;

create or replace function public.background_job_record_progress(
  p_job_id uuid,
  p_worker_id text,
  p_lease_token uuid,
  p_status public.background_job_status,
  p_phase text,
  p_safe_progress jsonb default '{}'::jsonb
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
  v_previous_status := v_job.status;

  if p_status not in ('claimed', 'preparing', 'running', 'finalising') then
    raise exception 'phase progress cannot record this job status' using errcode = '22023';
  end if;
  if v_job.cancellation_requested_at is not null then
    raise exception 'background-job cancellation must be acknowledged before more phase progress'
      using errcode = '22023';
  end if;
  if not public.background_job_safe_json(coalesce(p_safe_progress, '{}'::jsonb))
     or jsonb_typeof(coalesce(p_safe_progress, '{}'::jsonb)) <> 'object' then
    raise exception 'unsafe background-job progress summary' using errcode = '22023';
  end if;

  update public.background_jobs
  set status = p_status,
      current_phase = p_phase,
      safe_progress = coalesce(p_safe_progress, '{}'::jsonb)
  where id = p_job_id
    and lease_owner = p_worker_id
    and lease_token = p_lease_token
  returning * into v_job;

  perform private.background_job_insert_event(
    v_job.id,
    v_job.queue_message_id,
    'phase_progress',
    v_previous_status,
    v_job.status,
    v_job.current_phase,
    v_job.attempt_count,
    p_worker_id,
    null,
    null,
    v_job.safe_progress
  );
  return v_job;
end;
$$;

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

  if not public.background_job_safe_json(coalesce(p_safe_metadata, '{}'::jsonb))
     or jsonb_typeof(coalesce(p_safe_metadata, '{}'::jsonb)) <> 'object' then
    raise exception 'unsafe background-job effect metadata' using errcode = '22023';
  end if;

  select effect.*
  into v_effect
  from public.background_job_effects effect
  where effect.job_id = p_job_id
    and effect.effect_key = p_effect_key
  for update;

  if not found then
    if p_state <> 'prepared' then
      raise exception 'the first effect checkpoint must be prepared' using errcode = '22023';
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
    if v_effect.effect_kind <> p_effect_kind
       or v_effect.payload_hash <> p_payload_hash
       or v_effect.provider_name is distinct from p_provider_name
       or v_effect.provider_idempotency_key is distinct from p_provider_idempotency_key
       or (
         v_effect.provider_idempotency_expires_at is not null
         and p_provider_idempotency_expires_at is not null
         and v_effect.provider_idempotency_expires_at is distinct from p_provider_idempotency_expires_at
       )
       or (
         v_effect.provider_message_id is not null
         and p_provider_message_id is not null
         and v_effect.provider_message_id is distinct from p_provider_message_id
       ) then
      raise exception 'effect checkpoint identity does not match its frozen preparation'
        using errcode = '23505';
    end if;

    v_previous_state := v_effect.state;
    update public.background_job_effects
    set state = p_state,
        provider_idempotency_expires_at = coalesce(
          background_job_effects.provider_idempotency_expires_at,
          p_provider_idempotency_expires_at
        ),
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
    if v_previous_state = 'uncertain'
       and (
         v_effect.provider_idempotency_key is null
         or v_effect.provider_idempotency_expires_at is null
         or v_effect.provider_idempotency_expires_at <= now()
       ) then
      raise exception 'uncertain provider work can be redispatched only inside its idempotency window'
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

create or replace function public.background_job_complete(
  p_job_id uuid,
  p_worker_id text,
  p_lease_token uuid,
  p_safe_result jsonb default '{}'::jsonb
)
returns public.background_jobs
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_job public.background_jobs%rowtype;
  v_missing_effect_kind text;
begin
  select job.*
  into v_job
  from public.background_jobs job
  where job.id = p_job_id
  for update;

  if not found then
    raise exception 'background job not found' using errcode = 'P0002';
  end if;
  if v_job.status = 'succeeded' then
    return v_job;
  end if;

  v_job := private.background_job_lock_owned(p_job_id, p_worker_id, p_lease_token);
  if v_job.status <> 'finalising' then
    raise exception 'background job must be finalising before completion' using errcode = '22023';
  end if;
  if not public.background_job_safe_json(coalesce(p_safe_result, '{}'::jsonb))
     or jsonb_typeof(coalesce(p_safe_result, '{}'::jsonb)) <> 'object' then
    raise exception 'unsafe background-job result summary' using errcode = '22023';
  end if;
  if exists (
    select 1
    from public.background_job_effects effect
    where effect.job_id = p_job_id
      and effect.state in ('dispatch_started', 'provider_accepted', 'uncertain')
  ) then
    raise exception 'all started effects must be finalised before job completion' using errcode = '22023';
  end if;

  select required_effect.effect_kind
  into v_missing_effect_kind
  from public.background_job_kinds job_kind
  cross join lateral unnest(job_kind.required_effect_kinds) as required_effect(effect_kind)
  where job_kind.kind = v_job.kind
    and v_job.execution_owner <> 'shadow'
    and not exists (
      select 1
      from public.background_job_effects effect
      where effect.job_id = p_job_id
        and effect.effect_kind = required_effect.effect_kind
        and effect.state = 'finalised'
    )
  limit 1;

  if v_missing_effect_kind is not null then
    raise exception 'required external effect % must be finalised before job completion', v_missing_effect_kind
      using errcode = '22023';
  end if;

  perform private.background_job_archive_canonical(v_job.id, v_job.queue_message_id);

  update public.background_jobs
  set status = 'succeeded',
      current_phase = 'succeeded',
      safe_result = coalesce(p_safe_result, '{}'::jsonb),
      lease_owner = null,
      lease_token = null,
      lease_started_at = null,
      lease_expires_at = null,
      last_heartbeat_at = null,
      error_code = null,
      error_message = null
  where id = p_job_id
    and lease_owner = p_worker_id
    and lease_token = p_lease_token
  returning * into v_job;

  perform private.background_job_insert_event(
    v_job.id,
    v_job.queue_message_id,
    'succeeded',
    'finalising',
    'succeeded',
    'succeeded',
    v_job.attempt_count,
    p_worker_id,
    null,
    null,
    v_job.safe_result
  );
  return v_job;
end;
$$;

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
  v_message record;
  v_message_id bigint;
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

  if exists (
    select 1
    from public.background_job_effects effect
    where effect.job_id = p_job_id
      and effect.state = 'dispatch_started'
  ) then
    raise exception 'started provider dispatch must be checkpointed failed or uncertain before retry'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.background_job_effects effect
    where effect.job_id = p_job_id
      and effect.state = 'uncertain'
      and (
        effect.provider_idempotency_expires_at is null
        or effect.provider_idempotency_expires_at <= now() + make_interval(secs => p_delay_seconds)
      )
  ) then
    raise exception 'provider uncertainty must stay inside its idempotency window for automatic retry'
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
        error_message = p_error_message,
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

  select *
  into v_message
  from pgmq.set_vt('portal_background_jobs', v_job.queue_message_id, p_delay_seconds);
  if not found then
    v_message_id := private.background_job_send_message(v_job.id, v_job.contract_version, p_delay_seconds);
    perform private.background_job_insert_event(
      v_job.id,
      v_message_id,
      'queue_repaired',
      v_previous_status,
      v_previous_status,
      v_job.current_phase,
      v_job.attempt_count,
      p_worker_id,
      null,
      null,
      jsonb_build_object('reason', 'retry_missing_message')
    );
  else
    v_message_id := v_job.queue_message_id;
  end if;

  update public.background_jobs
  set status = 'retrying',
      current_phase = 'retry_wait',
      next_attempt_at = now() + make_interval(secs => p_delay_seconds),
      queue_message_id = v_message_id,
      error_code = p_error_code,
      error_message = p_error_message,
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
    'retry_wait',
    v_job.attempt_count,
    p_worker_id,
    null,
    p_error_code,
    jsonb_build_object('delaySeconds', p_delay_seconds)
  );
  return v_job;
end;
$$;

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
  if v_job.status = 'needs_attention' then
    return v_job;
  end if;
  v_job := private.background_job_lock_owned(p_job_id, p_worker_id, p_lease_token);
  if v_job.cancellation_requested_at is not null then
    raise exception 'background-job cancellation must be acknowledged before lifecycle changes'
      using errcode = '22023';
  end if;
  if not public.background_job_safe_json(coalesce(p_safe_detail, '{}'::jsonb))
     or jsonb_typeof(coalesce(p_safe_detail, '{}'::jsonb)) <> 'object' then
    raise exception 'unsafe background-job attention detail' using errcode = '22023';
  end if;
  v_previous_status := v_job.status;
  perform private.background_job_archive_canonical(v_job.id, v_job.queue_message_id);

  update public.background_jobs
  set status = 'needs_attention',
      current_phase = 'needs_attention',
      error_code = p_error_code,
      error_message = p_error_message,
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
  select job.* into v_job from public.background_jobs job where job.id = p_job_id for update;
  if not found then
    raise exception 'background job not found' using errcode = 'P0002';
  end if;
  if v_job.status = 'permanent_failed' then
    return v_job;
  end if;
  v_job := private.background_job_lock_owned(p_job_id, p_worker_id, p_lease_token);
  if v_job.cancellation_requested_at is not null then
    raise exception 'background-job cancellation must be acknowledged before lifecycle changes'
      using errcode = '22023';
  end if;
  if exists (
    select 1 from public.background_job_effects effect
    where effect.job_id = p_job_id
      and effect.state in ('dispatch_started', 'provider_accepted', 'finalised', 'uncertain')
  ) then
    raise exception 'started, accepted, or uncertain effects require reconciliation or needs attention'
      using errcode = '22023';
  end if;
  v_previous_status := v_job.status;
  perform private.background_job_archive_canonical(v_job.id, v_job.queue_message_id);

  update public.background_jobs
  set status = 'permanent_failed',
      current_phase = 'permanent_failed',
      error_code = p_error_code,
      error_message = p_error_message,
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

create or replace function public.background_job_request_cancellation(
  p_job_id uuid,
  p_actor_user_id uuid,
  p_reason text default null
)
returns public.background_jobs
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_job public.background_jobs%rowtype;
  v_kind public.background_job_kinds%rowtype;
  v_previous_status public.background_job_status;
begin
  select job.* into v_job from public.background_jobs job where job.id = p_job_id for update;
  if not found then
    raise exception 'background job not found' using errcode = 'P0002';
  end if;
  if v_job.status in ('succeeded', 'cancelled', 'needs_attention', 'permanent_failed') then
    return v_job;
  end if;

  select job_kind.* into strict v_kind
  from public.background_job_kinds job_kind
  where job_kind.kind = v_job.kind;
  if not v_kind.cancellation_allowed then
    raise exception 'this background-job kind cannot be cancelled' using errcode = '22023';
  end if;
  if v_job.status in ('dispatching', 'provider_accepted', 'finalising') then
    raise exception 'a dispatching or accepted effect cannot be cancelled safely' using errcode = '22023';
  end if;

  v_previous_status := v_job.status;
  update public.background_jobs
  set cancellation_requested_at = coalesce(cancellation_requested_at, now()),
      cancellation_requested_by = coalesce(cancellation_requested_by, p_actor_user_id),
      cancellation_reason = coalesce(cancellation_reason, p_reason)
  where id = p_job_id
  returning * into v_job;

  perform private.background_job_insert_event(
    v_job.id,
    v_job.queue_message_id,
    'cancellation_requested',
    v_previous_status,
    v_job.status,
    v_job.current_phase,
    v_job.attempt_count,
    null,
    p_actor_user_id
  );

  if v_job.status in ('queued', 'retrying') then
    perform private.background_job_archive_canonical(v_job.id, v_job.queue_message_id);
    update public.background_jobs
    set status = 'cancelled',
        current_phase = 'cancelled'
    where id = p_job_id
    returning * into v_job;
    perform private.background_job_insert_event(
      v_job.id,
      v_job.queue_message_id,
      'cancelled',
      v_previous_status,
      'cancelled',
      'cancelled',
      v_job.attempt_count,
      null,
      p_actor_user_id
    );
  end if;

  return v_job;
end;
$$;

create or replace function public.background_job_acknowledge_cancellation(
  p_job_id uuid,
  p_worker_id text,
  p_lease_token uuid
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
  v_previous_status := v_job.status;
  if v_job.cancellation_requested_at is null or v_job.status not in ('claimed', 'preparing', 'running') then
    raise exception 'job does not have a safely cancellable request' using errcode = '22023';
  end if;
  perform private.background_job_archive_canonical(v_job.id, v_job.queue_message_id);
  update public.background_jobs
  set status = 'cancelled',
      current_phase = 'cancelled',
      lease_owner = null,
      lease_token = null,
      lease_started_at = null,
      lease_expires_at = null,
      last_heartbeat_at = null
  where id = p_job_id and lease_owner = p_worker_id and lease_token = p_lease_token
  returning * into v_job;
  perform private.background_job_insert_event(
    v_job.id,
    v_job.queue_message_id,
    'cancelled',
    v_previous_status,
    'cancelled',
    'cancelled',
    v_job.attempt_count,
    p_worker_id,
    v_job.cancellation_requested_by
  );
  return v_job;
end;
$$;

create or replace function public.background_job_release_lease(
  p_job_id uuid,
  p_worker_id text,
  p_lease_token uuid
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
  v_previous_status := v_job.status;
  if v_job.status not in ('claimed', 'preparing', 'running') then
    raise exception 'only pre-dispatch work can release its lease safely' using errcode = '22023';
  end if;

  perform pgmq.set_vt('portal_background_jobs', v_job.queue_message_id, 0);
  update public.background_jobs
  set status = 'retrying',
      current_phase = 'lease_released',
      next_attempt_at = now(),
      lease_owner = null,
      lease_token = null,
      lease_started_at = null,
      lease_expires_at = null,
      last_heartbeat_at = null
  where id = p_job_id and lease_owner = p_worker_id and lease_token = p_lease_token
  returning * into v_job;
  perform private.background_job_insert_event(
    v_job.id,
    v_job.queue_message_id,
    'retry_scheduled',
    v_previous_status,
    'retrying',
    'lease_released',
    v_job.attempt_count,
    p_worker_id,
    null,
    null,
    jsonb_build_object('delaySeconds', 0)
  );
  return v_job;
end;
$$;

create or replace function public.background_job_manual_retry(
  p_job_id uuid,
  p_actor_user_id uuid
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
begin
  select job.* into v_job from public.background_jobs job where job.id = p_job_id for update;
  if not found then
    raise exception 'background job not found' using errcode = 'P0002';
  end if;
  if v_job.status not in ('needs_attention', 'permanent_failed') then
    raise exception 'only attention or permanently failed jobs are eligible for manual retry'
      using errcode = '22023';
  end if;
  if exists (
    select 1 from public.background_job_effects effect
    where effect.job_id = p_job_id
      and effect.state in ('dispatch_started', 'provider_accepted', 'finalised')
  ) then
    raise exception 'started or provider-accepted work must be finalised or reconciled, not resent'
      using errcode = '22023';
  end if;
  if exists (
    select 1 from public.background_job_effects effect
    where effect.job_id = p_job_id
      and effect.state = 'uncertain'
      and (effect.provider_idempotency_expires_at is null or effect.provider_idempotency_expires_at <= now())
  ) then
    raise exception 'expired provider uncertainty requires reconciliation or a new explicit intent'
      using errcode = '22023';
  end if;

  v_previous_status := v_job.status;
  v_message_id := private.background_job_send_message(v_job.id, v_job.contract_version, 0);
  update public.background_jobs
  set status = 'queued',
      current_phase = 'queued',
      max_attempts = greatest(max_attempts, attempt_count + 1),
      next_attempt_at = now(),
      queue_message_id = v_message_id,
      cancellation_requested_at = null,
      cancellation_requested_by = null,
      cancellation_reason = null,
      error_code = null,
      error_message = null
  where id = p_job_id
  returning * into v_job;
  perform private.background_job_insert_event(
    v_job.id,
    v_message_id,
    'manual_retry',
    v_previous_status,
    'queued',
    'queued',
    v_job.attempt_count,
    null,
    p_actor_user_id
  );
  return v_job;
end;
$$;

revoke all on function private.background_job_lock_owned(uuid, text, uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.background_job_archive_canonical(uuid, bigint)
  from public, anon, authenticated, service_role;

revoke all on function public.background_job_record_progress(
  uuid, text, uuid, public.background_job_status, text, jsonb
) from public, anon, authenticated;
grant execute on function public.background_job_record_progress(
  uuid, text, uuid, public.background_job_status, text, jsonb
) to service_role;

revoke all on function public.background_job_record_effect_checkpoint(
  uuid, text, uuid, text, text, public.background_job_effect_state, text,
  text, text, timestamptz, text, jsonb
) from public, anon, authenticated;
grant execute on function public.background_job_record_effect_checkpoint(
  uuid, text, uuid, text, text, public.background_job_effect_state, text,
  text, text, timestamptz, text, jsonb
) to service_role;

revoke all on function public.background_job_complete(uuid, text, uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.background_job_complete(uuid, text, uuid, jsonb) to service_role;
revoke all on function public.background_job_schedule_retry(uuid, text, uuid, integer, text, text)
  from public, anon, authenticated;
grant execute on function public.background_job_schedule_retry(uuid, text, uuid, integer, text, text) to service_role;
revoke all on function public.background_job_mark_needs_attention(uuid, text, uuid, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.background_job_mark_needs_attention(uuid, text, uuid, text, text, jsonb)
  to service_role;
revoke all on function public.background_job_mark_permanent_failure(uuid, text, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.background_job_mark_permanent_failure(uuid, text, uuid, text, text)
  to service_role;
revoke all on function public.background_job_request_cancellation(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.background_job_request_cancellation(uuid, uuid, text) to service_role;
revoke all on function public.background_job_acknowledge_cancellation(uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.background_job_acknowledge_cancellation(uuid, text, uuid) to service_role;
revoke all on function public.background_job_release_lease(uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.background_job_release_lease(uuid, text, uuid) to service_role;
revoke all on function public.background_job_manual_retry(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.background_job_manual_retry(uuid, uuid) to service_role;

notify pgrst, 'reload schema';
