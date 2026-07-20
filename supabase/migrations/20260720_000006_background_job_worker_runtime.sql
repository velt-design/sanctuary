-- JOB-02 worker runtime projections and aggregate operational metrics.
-- This migration does not enable a producer, handler, or rollout mode.

create function public.background_job_read_runtime_context(
  p_job_id uuid,
  p_worker_id text,
  p_lease_token uuid
)
returns table (
  job_id uuid,
  kind text,
  contract_version integer,
  status public.background_job_status,
  current_phase text,
  attempt_count integer,
  max_attempts integer,
  started_at timestamptz,
  cancellation_requested_at timestamptz,
  rollout_mode public.background_job_rollout_mode,
  execution_owner public.background_job_execution_owner
)
language sql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
  select
    job.id,
    job.kind,
    job.contract_version,
    job.status,
    job.current_phase,
    job.attempt_count,
    job.max_attempts,
    job.started_at,
    job.cancellation_requested_at,
    job.rollout_mode,
    job.execution_owner
  from public.background_jobs job
  where job.id = p_job_id
    and job.lease_owner = p_worker_id
    and job.lease_token = p_lease_token
    and job.lease_expires_at > now();
$$;

create function public.background_jobs_runtime_metrics()
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

create function public.background_workers_list_safe(
  p_limit integer default 100
)
returns table (
  worker_id text,
  mode text,
  lifecycle_state text,
  build_version text,
  global_concurrency integer,
  active_job_count integer,
  safe_metadata jsonb,
  started_at timestamptz,
  last_heartbeat_at timestamptz,
  shutdown_requested_at timestamptz,
  stopped_at timestamptz,
  updated_at timestamptz,
  is_stale boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  if p_limit is null or p_limit not between 1 and 500 then
    raise exception 'worker list limit must be between 1 and 500' using errcode = '22023';
  end if;

  return query
  select
    worker.worker_id,
    worker.mode,
    worker.lifecycle_state,
    worker.build_version,
    worker.global_concurrency,
    worker.active_job_count,
    worker.safe_metadata,
    worker.started_at,
    worker.last_heartbeat_at,
    worker.shutdown_requested_at,
    worker.stopped_at,
    worker.updated_at,
    worker.lifecycle_state <> 'stopped'
      and worker.last_heartbeat_at < now() - interval '2 minutes'
  from public.background_workers worker
  order by worker.last_heartbeat_at desc, worker.worker_id
  limit p_limit;
end;
$$;

revoke all on function public.background_job_read_runtime_context(uuid, text, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.background_job_read_runtime_context(uuid, text, uuid)
  to service_role;

revoke all on function public.background_jobs_runtime_metrics()
  from public, anon, authenticated, service_role;
grant execute on function public.background_jobs_runtime_metrics()
  to service_role;

revoke all on function public.background_workers_list_safe(integer)
  from public, anon, authenticated, service_role;
grant execute on function public.background_workers_list_safe(integer)
  to service_role;

notify pgrst, 'reload schema';
