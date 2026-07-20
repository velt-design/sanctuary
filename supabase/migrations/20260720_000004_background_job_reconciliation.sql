-- Wave 3 JOB-01: expired-lease recovery, orphan repair, safe inspection, and
-- queue/worker health. These RPCs remain service-role-only.

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
      update public.background_job_effects
      set state = 'uncertain'
      where job_id = v_job.id
        and state = 'dispatch_started';

      if private.background_job_queue_contains(v_job.queue_message_id) then
        perform private.background_job_archive_canonical(v_job.id, v_job.queue_message_id);
      end if;

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
        'LEASE_EXPIRED_DURING_DISPATCH'
      );
    elsif v_previous_status in ('provider_accepted', 'finalising') then
      if private.background_job_queue_contains(v_job.queue_message_id) then
        perform pgmq.set_vt('portal_background_jobs', v_job.queue_message_id, 0);
        v_message_id := v_job.queue_message_id;
      else
        v_message_id := private.background_job_send_message(v_job.id, v_job.contract_version, 0);
      end if;

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
      if private.background_job_queue_contains(v_job.queue_message_id) then
        perform private.background_job_archive_canonical(v_job.id, v_job.queue_message_id);
      else
        perform private.background_job_insert_event(
          v_job.id,
          v_job.queue_message_id,
          'queue_archive_missing',
          v_previous_status,
          v_previous_status,
          v_job.current_phase,
          v_job.attempt_count,
          p_worker_id,
          null,
          'QUEUE_MESSAGE_MISSING',
          jsonb_build_object('reason', 'expired_cancelled_lease_missing_message')
        );
      end if;

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
    elsif v_job.attempt_count >= v_job.max_attempts then
      if private.background_job_queue_contains(v_job.queue_message_id) then
        perform private.background_job_archive_canonical(v_job.id, v_job.queue_message_id);
      end if;

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
      if private.background_job_queue_contains(v_job.queue_message_id) then
        perform pgmq.set_vt('portal_background_jobs', v_job.queue_message_id, 0);
        v_message_id := v_job.queue_message_id;
      else
        v_message_id := private.background_job_send_message(v_job.id, v_job.contract_version, 0);
      end if;

      update public.background_jobs
      set status = 'retrying',
          current_phase = 'lease_recovery',
          next_attempt_at = now(),
          queue_message_id = v_message_id,
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
        'lease_recovery',
        v_job.attempt_count,
        p_worker_id,
        null,
        null,
        jsonb_build_object('delaySeconds', 0)
      );
    end if;

    v_recovered := v_recovered + 1;
  end loop;

  return v_recovered;
end;
$$;

create or replace function public.background_jobs_reconcile(
  p_worker_id text,
  p_limit integer default 500
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_message record;
  v_job public.background_jobs%rowtype;
  v_job_id uuid;
  v_contract_version integer;
  v_message_id bigint;
  v_delay_seconds integer;
  v_archived_count integer := 0;
  v_repaired_count integer := 0;
  v_recovered_count integer := 0;
begin
  if p_worker_id is null or p_worker_id !~ '^[A-Za-z0-9._:-]{1,128}$' then
    raise exception 'invalid worker ID' using errcode = '22023';
  end if;
  if p_limit is null or p_limit not between 1 and 5000 then
    raise exception 'reconciliation limit must be between 1 and 5000' using errcode = '22023';
  end if;

  for v_message in
    select queue_message.msg_id, queue_message.message
    from pgmq.q_portal_background_jobs queue_message
    order by queue_message.enqueued_at, queue_message.msg_id
    limit p_limit
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
      if pgmq.archive('portal_background_jobs', v_message.msg_id) then
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
        v_archived_count := v_archived_count + 1;
      end if;
      continue;
    end;

    select job.* into v_job
    from public.background_jobs job
    where job.id = v_job_id;

    if not found then
      if pgmq.archive('portal_background_jobs', v_message.msg_id) then
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
        v_archived_count := v_archived_count + 1;
      end if;
    elsif v_job.queue_message_id is distinct from v_message.msg_id then
      if pgmq.archive('portal_background_jobs', v_message.msg_id) then
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
        v_archived_count := v_archived_count + 1;
      end if;
    elsif v_job.status in ('succeeded', 'cancelled', 'needs_attention', 'permanent_failed') then
      if pgmq.archive('portal_background_jobs', v_message.msg_id) then
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
        v_archived_count := v_archived_count + 1;
      end if;
    end if;
  end loop;

  for v_job in
    select job.*
    from public.background_jobs job
    where job.status not in ('succeeded', 'cancelled', 'needs_attention', 'permanent_failed')
      and not private.background_job_queue_contains(job.queue_message_id)
    order by job.created_at
    for update skip locked
    limit p_limit
  loop
    v_delay_seconds := case
      when v_job.lease_expires_at > now()
        then greatest(1, ceil(extract(epoch from (v_job.lease_expires_at - now())))::integer)
      when v_job.next_attempt_at > now()
        then greatest(1, ceil(extract(epoch from (v_job.next_attempt_at - now())))::integer)
      else 0
    end;
    perform private.background_job_insert_event(
      v_job.id,
      v_job.queue_message_id,
      'queue_archive_missing',
      v_job.status,
      v_job.status,
      v_job.current_phase,
      v_job.attempt_count,
      p_worker_id,
      null,
      'QUEUE_MESSAGE_MISSING',
      jsonb_build_object('reason', 'missing_canonical_message')
    );
    v_message_id := private.background_job_send_message(v_job.id, v_job.contract_version, v_delay_seconds);
    update public.background_jobs
    set queue_message_id = v_message_id
    where id = v_job.id;
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
      jsonb_build_object('reason', 'missing_canonical_message')
    );
    v_repaired_count := v_repaired_count + 1;
  end loop;

  v_recovered_count := public.background_jobs_recover_expired_leases(p_worker_id, least(p_limit, 1000));

  return jsonb_build_object(
    'archivedMessages', v_archived_count,
    'repairedMessages', v_repaired_count,
    'recoveredLeases', v_recovered_count
  );
end;
$$;

create or replace function public.background_jobs_queue_health()
returns table (
  queue_depth bigint,
  oldest_message_age_seconds integer,
  total_messages bigint,
  queued_jobs bigint,
  active_jobs bigint,
  retrying_jobs bigint,
  attention_jobs bigint,
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
  job_counts as (
    select
      count(*) filter (where status = 'queued')::bigint as queued_jobs,
      count(*) filter (where status in ('claimed', 'preparing', 'running', 'dispatching', 'provider_accepted', 'finalising'))::bigint as active_jobs,
      count(*) filter (where status = 'retrying')::bigint as retrying_jobs,
      count(*) filter (where status in ('needs_attention', 'permanent_failed'))::bigint as attention_jobs
    from public.background_jobs
  ),
  worker_counts as (
    select count(*) filter (where last_heartbeat_at < now() - interval '2 minutes')::bigint as stale_workers
    from public.background_workers
    where lifecycle_state not in ('stopped')
  )
  select
    queue_metrics.queue_length,
    queue_metrics.oldest_msg_age_sec,
    queue_metrics.total_messages,
    job_counts.queued_jobs,
    job_counts.active_jobs,
    job_counts.retrying_jobs,
    job_counts.attention_jobs,
    worker_counts.stale_workers,
    queue_metrics.scrape_time
  from queue_metrics, job_counts, worker_counts;
$$;

create or replace function public.background_job_get_safe(p_job_id uuid)
returns setof public.background_jobs
language sql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
  select job.*
  from public.background_jobs job
  where job.id = p_job_id;
$$;

create or replace function public.background_jobs_list_safe(
  p_project_id uuid default null,
  p_subject_type text default null,
  p_subject_id text default null,
  p_statuses public.background_job_status[] default null,
  p_limit integer default 100
)
returns setof public.background_jobs
language plpgsql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  if p_limit is null or p_limit not between 1 and 500 then
    raise exception 'job list limit must be between 1 and 500' using errcode = '22023';
  end if;

  return query
  select job.*
  from public.background_jobs job
  where (p_project_id is null or job.project_id = p_project_id)
    and (p_subject_type is null or job.subject_type = p_subject_type)
    and (p_subject_id is null or job.subject_id = p_subject_id)
    and (p_statuses is null or job.status = any(p_statuses))
  order by job.created_at desc
  limit p_limit;
end;
$$;

create or replace function public.background_job_event_history_safe(
  p_job_id uuid,
  p_limit integer default 200
)
returns setof public.background_job_events
language plpgsql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  if p_limit is null or p_limit not between 1 and 1000 then
    raise exception 'event list limit must be between 1 and 1000' using errcode = '22023';
  end if;

  return query
  select event.*
  from public.background_job_events event
  where event.job_id = p_job_id
  order by event.created_at, event.id
  limit p_limit;
end;
$$;

revoke all on function public.background_jobs_recover_expired_leases(text, integer)
  from public, anon, authenticated;
grant execute on function public.background_jobs_recover_expired_leases(text, integer) to service_role;
revoke all on function public.background_jobs_reconcile(text, integer)
  from public, anon, authenticated;
grant execute on function public.background_jobs_reconcile(text, integer) to service_role;
revoke all on function public.background_jobs_queue_health()
  from public, anon, authenticated;
grant execute on function public.background_jobs_queue_health() to service_role;
revoke all on function public.background_job_get_safe(uuid)
  from public, anon, authenticated;
grant execute on function public.background_job_get_safe(uuid) to service_role;
revoke all on function public.background_jobs_list_safe(
  uuid, text, text, public.background_job_status[], integer
) from public, anon, authenticated;
grant execute on function public.background_jobs_list_safe(
  uuid, text, text, public.background_job_status[], integer
) to service_role;
revoke all on function public.background_job_event_history_safe(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.background_job_event_history_safe(uuid, integer) to service_role;

notify pgrst, 'reload schema';
