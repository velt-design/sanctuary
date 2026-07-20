-- Wave 3 JOB-01: atomic enqueue, lease-fenced claim, payload read, and heartbeat.

create or replace function private.background_job_insert_event(
  p_job_id uuid,
  p_queue_message_id bigint,
  p_event_type public.background_job_event_type,
  p_from_status public.background_job_status default null,
  p_to_status public.background_job_status default null,
  p_phase text default null,
  p_attempt_number integer default null,
  p_worker_id text default null,
  p_actor_user_id uuid default null,
  p_error_code text default null,
  p_safe_detail jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  insert into public.background_job_events (
    job_id,
    queue_message_id,
    event_type,
    from_status,
    to_status,
    phase,
    attempt_number,
    worker_id,
    actor_user_id,
    error_code,
    safe_detail
  )
  values (
    p_job_id,
    p_queue_message_id,
    p_event_type,
    p_from_status,
    p_to_status,
    p_phase,
    p_attempt_number,
    p_worker_id,
    p_actor_user_id,
    p_error_code,
    coalesce(p_safe_detail, '{}'::jsonb)
  );
end;
$$;

create or replace function private.background_job_queue_contains(p_message_id bigint)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
  select p_message_id is not null and exists (
    select 1
    from pgmq.q_portal_background_jobs queue_message
    where queue_message.msg_id = p_message_id
  );
$$;

create or replace function private.background_job_send_message(
  p_job_id uuid,
  p_contract_version integer,
  p_delay_seconds integer default 0
)
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_message_id bigint;
begin
  select sent.msg_id
  into strict v_message_id
  from pgmq.send(
    queue_name => 'portal_background_jobs',
    msg => jsonb_build_object(
      'jobId', p_job_id,
      'contractVersion', p_contract_version
    ),
    delay => greatest(0, p_delay_seconds)
  ) as sent(msg_id);

  return v_message_id;
end;
$$;

create or replace function private.background_job_enqueue_core(
  p_kind text,
  p_contract_version integer,
  p_subject_type text,
  p_subject_id text,
  p_project_id uuid,
  p_requested_by_user_id uuid,
  p_requested_by_actor text,
  p_priority smallint,
  p_intent_key text,
  p_payload jsonb,
  p_not_before timestamptz,
  p_rollout_mode public.background_job_rollout_mode,
  p_execution_owner public.background_job_execution_owner,
  p_rollout_cohort text
)
returns public.background_jobs
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_kind public.background_job_kinds%rowtype;
  v_job public.background_jobs%rowtype;
  v_payload_hash text;
  v_message_id bigint;
  v_not_before timestamptz := greatest(now(), coalesce(p_not_before, now()));
  v_delay_seconds integer;
begin
  if jsonb_typeof(p_payload) is distinct from 'object' then
    raise exception 'background-job payload must be a JSON object' using errcode = '22023';
  end if;

  if octet_length(p_payload::text) > 262144 then
    raise exception 'background-job payload exceeds the protected payload limit' using errcode = '22023';
  end if;

  select job_kind.*
  into v_kind
  from public.background_job_kinds job_kind
  where job_kind.kind = p_kind
    and job_kind.active
  for share;

  if not found then
    raise exception 'unknown or inactive background-job kind: %', p_kind using errcode = '22023';
  end if;

  if p_contract_version <> v_kind.contract_version then
    raise exception 'background-job contract version mismatch for %', p_kind using errcode = '22023';
  end if;

  if p_rollout_mode in ('disabled', 'legacy') or p_execution_owner = 'legacy' then
    raise exception 'legacy or disabled ownership must not enqueue a worker job' using errcode = '22023';
  end if;

  if (p_rollout_mode = 'shadow') is distinct from (p_execution_owner = 'shadow') then
    raise exception 'shadow rollout and execution owner must agree' using errcode = '22023';
  end if;

  if p_rollout_mode in ('worker_cohort', 'worker_enabled') and p_execution_owner <> 'worker' then
    raise exception 'worker rollout requires the worker execution owner' using errcode = '22023';
  end if;

  v_payload_hash := encode(sha256(convert_to(p_payload::text, 'UTF8')), 'hex');

  -- The unique constraint is the final integrity backstop, but it cannot make
  -- two concurrent first-enqueues idempotently return the same row. Serialise
  -- only the logical intent before checking/inserting it so both callers take
  -- the duplicate path instead of one leaking a unique-violation retry.
  perform pg_advisory_xact_lock(
    hashtextextended(p_kind || ':' || p_intent_key, 0)
  );

  select job.*
  into v_job
  from public.background_jobs job
  where job.kind = p_kind
    and job.intent_key = p_intent_key
  for update;

  if found then
    if v_job.contract_version <> p_contract_version
       or v_job.input_hash <> v_payload_hash
       or v_job.subject_type <> p_subject_type
       or v_job.subject_id <> p_subject_id
       or v_job.project_id is distinct from p_project_id then
      raise exception 'background-job intent key already exists with different frozen input'
        using errcode = '23505';
    end if;

    if v_job.status not in ('succeeded', 'cancelled', 'needs_attention', 'permanent_failed')
       and not private.background_job_queue_contains(v_job.queue_message_id) then
      v_delay_seconds := greatest(0, ceil(extract(epoch from (v_job.next_attempt_at - now())))::integer);
      v_message_id := private.background_job_send_message(v_job.id, v_job.contract_version, v_delay_seconds);
      update public.background_jobs
      set queue_message_id = v_message_id
      where id = v_job.id
      returning * into v_job;
      perform private.background_job_insert_event(
        v_job.id,
        v_message_id,
        'queue_repaired',
        v_job.status,
        v_job.status,
        v_job.current_phase,
        v_job.attempt_count,
        null,
        p_requested_by_user_id,
        null,
        jsonb_build_object('reason', 'duplicate_enqueue_missing_message')
      );
    end if;

    perform private.background_job_insert_event(
      v_job.id,
      v_job.queue_message_id,
      'duplicate_enqueue',
      v_job.status,
      v_job.status,
      v_job.current_phase,
      v_job.attempt_count,
      null,
      p_requested_by_user_id
    );
    return v_job;
  end if;

  insert into public.background_jobs (
    kind,
    contract_version,
    subject_type,
    subject_id,
    project_id,
    requested_by_user_id,
    requested_by_actor,
    priority,
    intent_key,
    input_hash,
    max_attempts,
    next_attempt_at,
    rollout_mode,
    execution_owner,
    rollout_cohort
  )
  values (
    p_kind,
    p_contract_version,
    p_subject_type,
    p_subject_id,
    p_project_id,
    p_requested_by_user_id,
    p_requested_by_actor,
    p_priority,
    p_intent_key,
    v_payload_hash,
    v_kind.max_attempts,
    v_not_before,
    p_rollout_mode,
    p_execution_owner,
    p_rollout_cohort
  )
  returning * into v_job;

  insert into private.background_job_payloads (
    job_id,
    contract_version,
    payload_hash,
    payload
  )
  values (
    v_job.id,
    p_contract_version,
    v_payload_hash,
    p_payload
  );

  v_delay_seconds := greatest(0, ceil(extract(epoch from (v_not_before - now())))::integer);
  v_message_id := private.background_job_send_message(v_job.id, p_contract_version, v_delay_seconds);

  update public.background_jobs
  set queue_message_id = v_message_id
  where id = v_job.id
  returning * into v_job;

  perform private.background_job_insert_event(
    v_job.id,
    v_message_id,
    'enqueued',
    null,
    'queued',
    'queued',
    0,
    null,
    p_requested_by_user_id,
    null,
    jsonb_build_object('kind', p_kind, 'owner', p_execution_owner)
  );

  return v_job;
end;
$$;

create or replace function public.background_job_enqueue_staff(
  p_kind text,
  p_contract_version integer,
  p_subject_type text,
  p_subject_id text,
  p_project_id uuid,
  p_requested_by_user_id uuid,
  p_priority smallint,
  p_intent_key text,
  p_payload jsonb,
  p_not_before timestamptz,
  p_rollout_mode public.background_job_rollout_mode,
  p_execution_owner public.background_job_execution_owner,
  p_rollout_cohort text default null
)
returns public.background_jobs
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  if p_requested_by_user_id is null then
    raise exception 'staff-requested jobs require a user ID' using errcode = '22023';
  end if;

  return private.background_job_enqueue_core(
    p_kind,
    p_contract_version,
    p_subject_type,
    p_subject_id,
    p_project_id,
    p_requested_by_user_id,
    'staff',
    p_priority,
    p_intent_key,
    p_payload,
    p_not_before,
    p_rollout_mode,
    p_execution_owner,
    p_rollout_cohort
  );
end;
$$;

create or replace function public.background_job_enqueue_system(
  p_kind text,
  p_contract_version integer,
  p_subject_type text,
  p_subject_id text,
  p_project_id uuid,
  p_priority smallint,
  p_intent_key text,
  p_payload jsonb,
  p_not_before timestamptz,
  p_rollout_mode public.background_job_rollout_mode,
  p_execution_owner public.background_job_execution_owner,
  p_rollout_cohort text default null
)
returns public.background_jobs
language sql
security definer
set search_path = pg_catalog, pg_temp
as $$
  select private.background_job_enqueue_core(
    p_kind,
    p_contract_version,
    p_subject_type,
    p_subject_id,
    p_project_id,
    null,
    'system',
    p_priority,
    p_intent_key,
    p_payload,
    p_not_before,
    p_rollout_mode,
    p_execution_owner,
    p_rollout_cohort
  );
$$;

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
        update public.background_job_effects
        set state = 'uncertain'
        where job_id = v_job.id
          and state = 'dispatch_started';
      end if;
      update public.background_jobs
      set status = 'needs_attention',
          current_phase = 'contract_mismatch',
          error_code = 'QUEUE_CONTRACT_MISMATCH',
          error_message = 'Queue contract version does not match the durable job.',
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
        update public.background_job_effects
        set state = 'uncertain'
        where job_id = v_job.id
          and state = 'dispatch_started';
        update public.background_jobs
        set status = 'needs_attention',
            current_phase = 'provider_reconciliation',
            error_code = 'LEASE_EXPIRED_DURING_DISPATCH',
            error_message = 'Provider outcome must be reconciled before another delivery attempt.',
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
          'LEASE_EXPIRED_DURING_DISPATCH'
        );
        continue;
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

    if v_job.status = 'retrying' and v_job.attempt_count >= v_job.max_attempts then
      update public.background_jobs
      set status = 'permanent_failed',
          current_phase = 'retry_exhausted',
          error_code = 'RETRY_EXHAUSTED',
          error_message = 'The background job exhausted its automatic attempts.',
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

create or replace function public.background_job_read_payload(
  p_job_id uuid,
  p_worker_id text,
  p_lease_token uuid
)
returns table (
  contract_version integer,
  payload_hash text,
  payload jsonb
)
language sql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
  select protected.contract_version, protected.payload_hash, protected.payload
  from public.background_jobs job
  join private.background_job_payloads protected on protected.job_id = job.id
  where job.id = p_job_id
    and job.lease_owner = p_worker_id
    and job.lease_token = p_lease_token
    and job.lease_expires_at > now()
    and job.status in ('claimed', 'preparing', 'running', 'dispatching', 'provider_accepted', 'finalising');
$$;

create or replace function public.background_job_heartbeat(
  p_job_id uuid,
  p_worker_id text,
  p_lease_token uuid,
  p_visibility_timeout_seconds integer default 120
)
returns public.background_jobs
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_job public.background_jobs%rowtype;
  v_message record;
  v_message_id bigint;
begin
  if p_visibility_timeout_seconds is null or p_visibility_timeout_seconds not between 15 and 3600 then
    raise exception 'visibility timeout must be between 15 and 3600 seconds' using errcode = '22023';
  end if;

  select job.*
  into v_job
  from public.background_jobs job
  where job.id = p_job_id
  for update;

  if not found
     or v_job.lease_owner is distinct from p_worker_id
     or v_job.lease_token is distinct from p_lease_token
     or v_job.lease_expires_at <= now()
     or v_job.status not in ('claimed', 'preparing', 'running', 'dispatching', 'provider_accepted', 'finalising') then
    raise exception 'background-job lease is no longer owned by this worker' using errcode = '55000';
  end if;

  select *
  into v_message
  from pgmq.set_vt('portal_background_jobs', v_job.queue_message_id, p_visibility_timeout_seconds);

  if not found then
    v_message_id := private.background_job_send_message(
      v_job.id,
      v_job.contract_version,
      p_visibility_timeout_seconds
    );
    update public.background_jobs
    set queue_message_id = v_message_id
    where id = v_job.id
    returning * into v_job;
    perform private.background_job_insert_event(
      v_job.id,
      v_message_id,
      'queue_repaired',
      v_job.status,
      v_job.status,
      v_job.current_phase,
      v_job.attempt_count,
      p_worker_id,
      null,
      null,
      jsonb_build_object('reason', 'heartbeat_missing_message')
    );
  end if;

  update public.background_jobs
  set lease_expires_at = now() + make_interval(secs => p_visibility_timeout_seconds),
      last_heartbeat_at = now()
  where id = v_job.id
    and lease_owner = p_worker_id
    and lease_token = p_lease_token
  returning * into v_job;

  perform private.background_job_insert_event(
    v_job.id,
    v_job.queue_message_id,
    'heartbeat',
    v_job.status,
    v_job.status,
    v_job.current_phase,
    v_job.attempt_count,
    p_worker_id
  );

  return v_job;
end;
$$;

create or replace function public.background_worker_heartbeat(
  p_worker_id text,
  p_mode text,
  p_lifecycle_state text,
  p_build_version text,
  p_global_concurrency integer,
  p_active_job_count integer,
  p_safe_metadata jsonb default '{}'::jsonb
)
returns public.background_workers
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_worker public.background_workers%rowtype;
begin
  insert into public.background_workers (
    worker_id,
    mode,
    lifecycle_state,
    build_version,
    global_concurrency,
    active_job_count,
    safe_metadata,
    last_heartbeat_at,
    shutdown_requested_at,
    stopped_at,
    updated_at
  )
  values (
    p_worker_id,
    p_mode,
    p_lifecycle_state,
    p_build_version,
    p_global_concurrency,
    p_active_job_count,
    coalesce(p_safe_metadata, '{}'::jsonb),
    now(),
    case when p_lifecycle_state = 'draining' then now() else null end,
    case when p_lifecycle_state = 'stopped' then now() else null end,
    now()
  )
  on conflict (worker_id) do update
  set mode = excluded.mode,
      lifecycle_state = excluded.lifecycle_state,
      build_version = excluded.build_version,
      global_concurrency = excluded.global_concurrency,
      active_job_count = excluded.active_job_count,
      safe_metadata = excluded.safe_metadata,
      last_heartbeat_at = now(),
      shutdown_requested_at = case
        when excluded.lifecycle_state = 'draining'
          then coalesce(public.background_workers.shutdown_requested_at, now())
        when excluded.lifecycle_state in ('ready', 'starting') then null
        else public.background_workers.shutdown_requested_at
      end,
      stopped_at = case
        when excluded.lifecycle_state = 'stopped' then now()
        when excluded.lifecycle_state in ('ready', 'starting') then null
        else public.background_workers.stopped_at
      end,
      updated_at = now()
  returning * into v_worker;

  return v_worker;
end;
$$;

revoke all on function private.background_job_insert_event(
  uuid, bigint, public.background_job_event_type, public.background_job_status,
  public.background_job_status, text, integer, text, uuid, text, jsonb
) from public, anon, authenticated, service_role;
revoke all on function private.background_job_queue_contains(bigint) from public, anon, authenticated, service_role;
revoke all on function private.background_job_send_message(uuid, integer, integer) from public, anon, authenticated, service_role;
revoke all on function private.background_job_enqueue_core(
  text, integer, text, text, uuid, uuid, text, smallint, text, jsonb,
  timestamptz, public.background_job_rollout_mode, public.background_job_execution_owner, text
) from public, anon, authenticated, service_role;

revoke all on function public.background_job_enqueue_staff(
  text, integer, text, text, uuid, uuid, smallint, text, jsonb,
  timestamptz, public.background_job_rollout_mode, public.background_job_execution_owner, text
) from public, anon, authenticated;
grant execute on function public.background_job_enqueue_staff(
  text, integer, text, text, uuid, uuid, smallint, text, jsonb,
  timestamptz, public.background_job_rollout_mode, public.background_job_execution_owner, text
) to service_role;

revoke all on function public.background_job_enqueue_system(
  text, integer, text, text, uuid, smallint, text, jsonb,
  timestamptz, public.background_job_rollout_mode, public.background_job_execution_owner, text
) from public, anon, authenticated;
grant execute on function public.background_job_enqueue_system(
  text, integer, text, text, uuid, smallint, text, jsonb,
  timestamptz, public.background_job_rollout_mode, public.background_job_execution_owner, text
) to service_role;

revoke all on function public.background_jobs_claim(text, integer, integer) from public, anon, authenticated;
grant execute on function public.background_jobs_claim(text, integer, integer) to service_role;
revoke all on function public.background_job_read_payload(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.background_job_read_payload(uuid, text, uuid) to service_role;
revoke all on function public.background_job_heartbeat(uuid, text, uuid, integer) from public, anon, authenticated;
grant execute on function public.background_job_heartbeat(uuid, text, uuid, integer) to service_role;
revoke all on function public.background_worker_heartbeat(text, text, text, text, integer, integer, jsonb)
  from public, anon, authenticated;
grant execute on function public.background_worker_heartbeat(text, text, text, text, integer, integer, jsonb)
  to service_role;

notify pgrst, 'reload schema';
