-- Optional canonical claim scope. Existing three-argument callers are unchanged.
-- Filter before queue visibility/read counters or job leases are changed.
create function private.background_job_read_claim_queue(p_visibility_timeout_seconds integer,p_batch_size integer)
returns table(msg_id bigint,message jsonb)
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare kinds jsonb; projects jsonb;
begin
 kinds:=nullif(current_setting('sanctuary.background_job_claim_kinds',true),'')::jsonb;
 projects:=nullif(current_setting('sanctuary.background_job_claim_projects',true),'')::jsonb;
 if (kinds is not null or projects is not null) and (jsonb_typeof(kinds) is distinct from 'array' or jsonb_array_length(kinds) not between 1 and 16
  or jsonb_typeof(projects) is distinct from 'array' or jsonb_array_length(projects) not between 1 and 32
 ) then raise exception 'invalid_background_job_claim_scope' using errcode='22023'; end if;
 return query
 with candidates as (
  select q.msg_id from pgmq.q_portal_background_jobs q
  left join public.background_jobs j on j.id::text=q.message->>'jobId'
  where q.vt<=clock_timestamp() and (
   (kinds is null and projects is null and j.kind is distinct from 'studio_design_booklet_v1')
   or (kinds ? j.kind and projects ? j.project_id::text and j.queue_message_id=q.msg_id))
  order by q.msg_id limit p_batch_size for update of q skip locked
 ), touched as (
  update pgmq.q_portal_background_jobs q set vt=clock_timestamp()+make_interval(secs=>p_visibility_timeout_seconds),read_ct=q.read_ct+1
  from candidates c where q.msg_id=c.msg_id returning q.msg_id,q.message
 ) select t.msg_id,t.message from touched t order by t.msg_id;
end $$;
revoke all on function private.background_job_read_claim_queue(integer,integer) from public,anon,authenticated,service_role;

create function public.background_jobs_claim_scoped(p_worker_id text,p_batch_size integer,p_visibility_timeout_seconds integer,p_kinds text[],p_project_ids uuid[])
returns table(job_id uuid,kind text,contract_version integer,status public.background_job_status,current_phase text,attempt_number integer,max_attempts integer,queue_message_id bigint,lease_token uuid,lease_expires_at timestamptz,cancellation_requested_at timestamptz,rollout_mode public.background_job_rollout_mode,execution_owner public.background_job_execution_owner)
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare previous_kinds text:=current_setting('sanctuary.background_job_claim_kinds',true); previous_projects text:=current_setting('sanctuary.background_job_claim_projects',true);
begin
 if p_kinds is null or cardinality(p_kinds) not between 1 and 16 or p_project_ids is null or cardinality(p_project_ids) not between 1 and 32
  or array_position(p_kinds,null) is not null or array_position(p_project_ids,null) is not null
  or exists(select 1 from unnest(p_kinds) k where not exists(select 1 from public.background_job_kinds registered where registered.kind=k))
 then raise exception 'invalid_background_job_claim_scope' using errcode='22023'; end if;
 perform set_config('sanctuary.background_job_claim_kinds',to_jsonb(p_kinds)::text,true);
 perform set_config('sanctuary.background_job_claim_projects',to_jsonb(p_project_ids)::text,true);
 return query select * from public.background_jobs_claim(p_worker_id,p_batch_size,p_visibility_timeout_seconds);
 perform set_config('sanctuary.background_job_claim_kinds',coalesce(previous_kinds,''),true);
 perform set_config('sanctuary.background_job_claim_projects',coalesce(previous_projects,''),true);
exception when others then
 perform set_config('sanctuary.background_job_claim_kinds',coalesce(previous_kinds,''),true);
 perform set_config('sanctuary.background_job_claim_projects',coalesce(previous_projects,''),true);
 raise;
end $$;
revoke all on function public.background_jobs_claim_scoped(text,integer,integer,text[],uuid[]) from public,anon,authenticated;
grant execute on function public.background_jobs_claim_scoped(text,integer,integer,text[],uuid[]) to service_role;

-- The canonical state machine below is unchanged apart from its queue reader.
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
    from private.background_job_read_claim_queue(p_visibility_timeout_seconds, p_batch_size)
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

-- v1 metrics keep their known-kind projection for rolling older workers. The new
-- document kind has its own scoped status; omission is not a measured zero.

create or replace function public.background_jobs_runtime_metrics()
returns table (
  queue_depth bigint,
  oldest_message_age_seconds integer,
  oldest_job_age_seconds integer,
  due_jobs bigint,
  next_due_at timestamptz,
  status_counts jsonb,
  kind_counts jsonb,
  worker_lifecycle_counts jsonb,
  stale_workers bigint,
  measured_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
  with queue_metrics as (
    select * from pgmq.metrics('portal_background_jobs')
  ),
  unfinished_jobs as (
    select job.*
    from public.background_jobs job
    where job.status not in ('succeeded', 'cancelled', 'permanent_failed')
  ),
  job_metrics as (
    select
      coalesce(
        greatest(0, floor(extract(epoch from (now() - min(job.created_at))))),
        0
      )::integer as oldest_job_age_seconds,
      count(*) filter (
        where job.status in ('queued', 'retrying')
          and job.next_attempt_at <= now()
      )::bigint as due_jobs,
      min(job.next_attempt_at) filter (
        where job.status in ('queued', 'retrying')
      ) as next_due_at
    from unfinished_jobs job
  ),
  status_totals as (
    select status.value::text as key, count(job.id)::bigint as value
    from unnest(enum_range(null::public.background_job_status)) status(value)
    left join public.background_jobs job on job.status = status.value
    group by status.value
  ),
  kind_totals as (
    select kind.kind as key, count(job.id)::bigint as value
    from public.background_job_kinds kind
    left join public.background_jobs job on job.kind = kind.kind
    where kind.kind <> 'studio_design_booklet_v1'
    group by kind.kind
  ),
  worker_lifecycle_totals as (
    select lifecycle.value as key, count(worker.worker_id)::bigint as value
    from unnest(array[
      'starting',
      'ready',
      'draining',
      'stopped',
      'unhealthy'
    ]::text[]) lifecycle(value)
    left join public.background_workers worker on worker.lifecycle_state = lifecycle.value
    group by lifecycle.value
  ),
  worker_totals as (
    select count(*) filter (
      where worker.lifecycle_state <> 'stopped'
        and worker.last_heartbeat_at < now() - interval '2 minutes'
    )::bigint as stale_workers
    from public.background_workers worker
  )
  select
    queue_metrics.queue_length,
    queue_metrics.oldest_msg_age_sec,
    job_metrics.oldest_job_age_seconds,
    job_metrics.due_jobs,
    job_metrics.next_due_at,
    (select jsonb_object_agg(total.key, total.value order by total.key) from status_totals total),
    (select jsonb_object_agg(total.key, total.value order by total.key) from kind_totals total),
    (select jsonb_object_agg(total.key, total.value order by total.key) from worker_lifecycle_totals total),
    worker_totals.stale_workers,
    queue_metrics.scrape_time
  from queue_metrics, job_metrics, worker_totals;
$$;
