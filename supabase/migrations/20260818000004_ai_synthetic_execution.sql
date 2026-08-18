-- PR-AI-007: deterministic synthetic AI execution through the existing jobs spine.
-- This migration adds no provider, model, network, business mutation, communication,
-- or external-effect capability. The producer is service-role-only and the worker
-- remains dark unless its existing explicit runtime gates are enabled.

insert into public.background_job_kinds (
  kind,
  contract_version,
  handler_owner,
  max_attempts,
  timeout_seconds,
  concurrency_class,
  has_external_side_effect,
  required_effect_kinds,
  cancellation_allowed,
  default_rollout_mode,
  active,
  allowed_effect_kinds
)
values (
  'ai_synthetic_v1',
  1,
  'ai-synthetic-workflow',
  3,
  30,
  'orchestration',
  false,
  array[]::text[],
  false,
  'worker_enabled',
  true,
  array[]::text[]
);

create table public.ai_task_jobs (
  task_id uuid not null references public.ai_tasks(id) on delete restrict,
  job_id uuid primary key references public.background_jobs(id) on delete restrict,
  sequence integer not null check (sequence > 0),
  purpose text not null check (purpose = 'synthetic_execution'),
  input_snapshot_hash text not null check (input_snapshot_hash ~ '^sha256:[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (task_id, sequence),
  unique (task_id, purpose)
);

create table public.ai_usage_records (
  id uuid primary key default gen_random_uuid(),
  contract_version integer not null default 1 check (contract_version = 1),
  task_id uuid not null references public.ai_tasks(id) on delete restrict,
  job_id uuid not null unique references public.background_jobs(id) on delete restrict,
  step_key text not null check (step_key = 'synthetic.execute'),
  capability_key text not null check (capability_key ~ '^synthetic\.[a-z0-9._-]+$'),
  capability_version text not null check (capability_version = '1.0.0'),
  route_key text not null check (route_key = 'synthetic.mock'),
  provider_key text not null check (provider_key = 'synthetic.mock'),
  model_snapshot text not null check (model_snapshot = 'deterministic.mock.v1'),
  input_units integer not null check (input_units = 0),
  output_units integer not null check (output_units = 0),
  media_units integer not null check (media_units = 0),
  compute_milliseconds integer not null check (compute_milliseconds = 0),
  latency_milliseconds integer not null check (latency_milliseconds = 0),
  cost_cents numeric(12, 4) not null check (cost_cents = 0),
  cache_status text not null check (cache_status = 'not_used'),
  safe_provider_request_id text null check (safe_provider_request_id is null),
  recorded_at timestamptz not null
);

create table public.ai_evaluations (
  id uuid primary key default gen_random_uuid(),
  contract_version integer not null default 1 check (contract_version = 1),
  task_id uuid not null references public.ai_tasks(id) on delete restrict,
  job_id uuid not null unique references public.background_jobs(id) on delete restrict,
  evaluator_type text not null check (evaluator_type = 'deterministic'),
  evaluator_kind text not null check (evaluator_kind = 'service'),
  evaluator_key text not null check (evaluator_key = 'sanctuary.synthetic'),
  evaluation_set_key text not null check (evaluation_set_key = 'synthetic.fixture'),
  evaluation_set_version text not null check (evaluation_set_version = '1.0.0'),
  scores jsonb not null check (jsonb_typeof(scores) = 'array' and jsonb_array_length(scores) = 1),
  result text not null check (result = 'passed'),
  safe_feedback_summary text not null check (
    safe_feedback_summary = 'Deterministic fixture matched the expected result.'
  ),
  production_outcome_code text null check (production_outcome_code is null),
  promotion_recommendation text not null check (promotion_recommendation = 'not_applicable'),
  evidence_ids uuid[] not null default '{}'::uuid[] check (cardinality(evidence_ids) = 0),
  evaluated_at timestamptz not null
);

create index ai_task_jobs_task_created_idx
  on public.ai_task_jobs(task_id, created_at, job_id);
create index ai_usage_records_task_recorded_idx
  on public.ai_usage_records(task_id, recorded_at, id);
create index ai_evaluations_task_evaluated_idx
  on public.ai_evaluations(task_id, evaluated_at, id);

create or replace function private.ai_execution_evidence_append_only()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception 'AI execution linkage and evidence are append-only'
    using errcode = '55000';
end;
$$;

create trigger ai_task_jobs_append_only_trigger
before update or delete on public.ai_task_jobs
for each row execute function private.ai_execution_evidence_append_only();

create trigger ai_usage_records_append_only_trigger
before update or delete on public.ai_usage_records
for each row execute function private.ai_execution_evidence_append_only();

create trigger ai_evaluations_append_only_trigger
before update or delete on public.ai_evaluations
for each row execute function private.ai_execution_evidence_append_only();

alter table public.ai_task_jobs enable row level security;
alter table public.ai_usage_records enable row level security;
alter table public.ai_evaluations enable row level security;

create policy ai_task_jobs_staff_safe_select
on public.ai_task_jobs
for select
to authenticated
using (
  exists (
    select 1
    from public.ai_tasks visible_task
    where visible_task.id = ai_task_jobs.task_id
  )
);

create policy ai_usage_records_staff_safe_select
on public.ai_usage_records
for select
to authenticated
using (
  exists (
    select 1
    from public.ai_tasks visible_task
    where visible_task.id = ai_usage_records.task_id
  )
);

create policy ai_evaluations_staff_safe_select
on public.ai_evaluations
for select
to authenticated
using (
  exists (
    select 1
    from public.ai_tasks visible_task
    where visible_task.id = ai_evaluations.task_id
  )
);

create or replace function private.ai_task_append_execution_event(
  p_task_id uuid,
  p_event_type public.ai_task_event_type,
  p_from_status public.ai_task_status,
  p_to_status public.ai_task_status,
  p_actor_kind text,
  p_actor_key text,
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
    from_status,
    to_status,
    actor_kind,
    actor_key,
    safe_summary,
    created_at
  ) values (
    p_task_id,
    v_sequence,
    p_event_type,
    p_from_status,
    p_to_status,
    p_actor_kind,
    p_actor_key,
    p_safe_summary,
    p_created_at
  );
end;
$$;

create or replace function public.ai_task_enqueue_synthetic(p_task_id uuid)
returns table (
  queued_job_id uuid,
  queued_task_status public.ai_task_status,
  was_replayed boolean
)
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_task public.ai_tasks%rowtype;
  v_task_payload private.ai_task_payloads%rowtype;
  v_existing_link public.ai_task_jobs%rowtype;
  v_existing_job public.background_jobs%rowtype;
  v_job public.background_jobs%rowtype;
  v_job_payload jsonb;
  v_fixture_key text;
  v_now timestamptz := statement_timestamp();
begin
  if p_task_id is null then
    raise exception 'AI task ID is required' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('ai-synthetic-enqueue:' || p_task_id::text, 0));

  select task.*
  into v_task
  from public.ai_tasks task
  where task.id = p_task_id
  for update;

  if not found then
    raise exception 'AI task not found' using errcode = 'P0002';
  end if;
  if v_task.execution_mode <> 'synthetic'
     or v_task.effect_class <> 'none'
     or v_task.max_cost_cents <> 0
     or v_task.actual_cost_cents <> 0
     or v_task.task_type not in ('synthetic.echo', 'synthetic.classification') then
    raise exception 'AI synthetic producer accepts only fixed effect-free zero-cost tasks'
      using errcode = '22023';
  end if;

  select link.*
  into v_existing_link
  from public.ai_task_jobs link
  where link.task_id = v_task.id
    and link.purpose = 'synthetic_execution';

  if found then
    select job.*
    into v_existing_job
    from public.background_jobs job
    where job.id = v_existing_link.job_id;

    if not found
       or v_existing_link.input_snapshot_hash <> v_task.input_snapshot_hash
       or v_existing_job.kind <> 'ai_synthetic_v1'
       or v_existing_job.contract_version <> 1
       or v_existing_job.subject_type <> 'ai_task'
       or v_existing_job.subject_id <> v_task.id::text
       or v_existing_job.has_external_side_effect
       or cardinality(v_existing_job.allowed_effect_kinds) <> 0
       or cardinality(v_existing_job.required_effect_kinds) <> 0 then
      raise exception 'AI synthetic task/job linkage is inconsistent'
        using errcode = '55000';
    end if;

    return query select v_existing_job.id, v_task.status, true;
    return;
  end if;

  if v_task.status <> 'proposed' then
    raise exception 'AI synthetic task must be proposed before first enqueue'
      using errcode = '22023';
  end if;

  select payload.*
  into v_task_payload
  from private.ai_task_payloads payload
  where payload.task_id = v_task.id;

  if not found or v_task_payload.input_snapshot_hash <> v_task.input_snapshot_hash then
    raise exception 'AI synthetic private input is missing or inconsistent'
      using errcode = '55000';
  end if;

  v_fixture_key := v_task_payload.payload ->> 'fixtureKey';
  if v_fixture_key not in ('echo_v1', 'classification_v1')
     or (v_fixture_key = 'echo_v1' and v_task.task_type <> 'synthetic.echo')
     or (v_fixture_key = 'classification_v1' and v_task.task_type <> 'synthetic.classification') then
    raise exception 'AI synthetic fixture identity is inconsistent'
      using errcode = '55000';
  end if;

  v_job_payload := jsonb_build_object(
    'contractVersion', 1,
    'taskId', v_task.id,
    'inputSnapshotHash', v_task.input_snapshot_hash,
    'fixtureKey', v_fixture_key
  );

  v_job := private.background_job_enqueue_core(
    'ai_synthetic_v1',
    1,
    'ai_task',
    v_task.id::text,
    v_task.project_id,
    v_task.requested_by_user_id,
    'staff',
    100::smallint,
    'ai-task:' || v_task.id::text || ':synthetic-v1',
    v_job_payload,
    null,
    'worker_enabled',
    'worker',
    'synthetic-v1'
  );

  update public.ai_tasks
  set status = 'approved', updated_at = v_now
  where id = v_task.id;
  perform private.ai_task_append_execution_event(
    v_task.id,
    'status_changed',
    'proposed',
    'approved',
    'service',
    'sanctuary.synthetic',
    'Effect-free synthetic scope approved.',
    v_now
  );

  update public.ai_tasks
  set status = 'queued', updated_at = v_now
  where id = v_task.id;
  perform private.ai_task_append_execution_event(
    v_task.id,
    'status_changed',
    'approved',
    'queued',
    'service',
    'sanctuary.synthetic',
    'Synthetic execution queued.',
    v_now
  );

  insert into public.ai_task_jobs (
    task_id,
    job_id,
    sequence,
    purpose,
    input_snapshot_hash,
    created_at
  ) values (
    v_task.id,
    v_job.id,
    1,
    'synthetic_execution',
    v_task.input_snapshot_hash,
    v_now
  );

  return query select v_job.id, 'queued'::public.ai_task_status, false;
end;
$$;

create or replace function private.ai_synthetic_reject_linked_cancel()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if old.status is distinct from new.status
     and new.status = 'cancelled'
     and exists (
       select 1
       from public.ai_task_jobs link
       where link.task_id = old.id
     ) then
    raise exception 'linked AI synthetic execution cannot be cancelled through the task-only command'
      using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger ai_synthetic_reject_linked_cancel_trigger
before update of status on public.ai_tasks
for each row execute function private.ai_synthetic_reject_linked_cancel();

create or replace function private.ai_synthetic_job_after_update()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_link public.ai_task_jobs%rowtype;
  v_task public.ai_tasks%rowtype;
  v_task_payload private.ai_task_payloads%rowtype;
  v_job_payload private.background_job_payloads%rowtype;
  v_fixture_key text;
  v_expected_result_code text;
  v_now timestamptz := coalesce(new.completed_at, statement_timestamp());
begin
  if new.kind <> 'ai_synthetic_v1' or old.status is not distinct from new.status then
    return new;
  end if;

  select link.*
  into v_link
  from public.ai_task_jobs link
  where link.job_id = new.id;

  if not found then
    raise exception 'AI synthetic job is missing its owning task linkage'
      using errcode = '55000';
  end if;

  select task.*
  into v_task
  from public.ai_tasks task
  where task.id = v_link.task_id
  for update;

  if not found
     or new.subject_type <> 'ai_task'
     or new.subject_id <> v_link.task_id::text
     or new.contract_version <> 1
     or new.execution_owner <> 'worker'
     or new.rollout_mode <> 'worker_enabled'
     or new.has_external_side_effect
     or cardinality(new.allowed_effect_kinds) <> 0
     or cardinality(new.required_effect_kinds) <> 0
     or v_link.input_snapshot_hash <> v_task.input_snapshot_hash then
    raise exception 'AI synthetic execution boundary is inconsistent'
      using errcode = '55000';
  end if;

  if new.status in ('claimed', 'preparing', 'running', 'finalising') then
    if v_task.status = 'queued' then
      update public.ai_tasks
      set status = 'running',
          started_at = coalesce(started_at, new.started_at, statement_timestamp()),
          updated_at = statement_timestamp()
      where id = v_task.id;
      perform private.ai_task_append_execution_event(
        v_task.id,
        'status_changed',
        'queued',
        'running',
        'node',
        'sanctuary.worker',
        'Synthetic execution started.',
        statement_timestamp()
      );
    end if;
    return new;
  end if;

  if new.status = 'retrying' then
    perform private.ai_task_append_execution_event(
      v_task.id,
      'retry_scheduled',
      null,
      null,
      'service',
      'sanctuary.worker',
      'Synthetic execution retry scheduled.',
      statement_timestamp()
    );
    return new;
  end if;

  if new.status = 'queued' and old.status in ('needs_attention', 'permanent_failed') then
    if v_task.status in ('needs_attention', 'failed') then
      update public.ai_tasks
      set status = 'queued',
          failure_code = null,
          safe_failure_summary = null,
          completed_at = null,
          updated_at = statement_timestamp()
      where id = v_task.id;
      perform private.ai_task_append_execution_event(
        v_task.id,
        'status_changed',
        v_task.status,
        'queued',
        'service',
        'sanctuary.worker',
        'Synthetic execution returned to the queue.',
        statement_timestamp()
      );
    end if;
    return new;
  end if;

  if new.status in ('needs_attention', 'permanent_failed', 'cancelled') then
    if v_task.status = 'queued' then
      update public.ai_tasks
      set status = 'running',
          started_at = coalesce(started_at, new.started_at, statement_timestamp()),
          updated_at = statement_timestamp()
      where id = v_task.id;
      perform private.ai_task_append_execution_event(
        v_task.id,
        'status_changed',
        'queued',
        'running',
        'node',
        'sanctuary.worker',
        'Synthetic execution started.',
        statement_timestamp()
      );
      v_task.status := 'running';
    end if;

    update public.ai_tasks
    set status = case when new.status = 'permanent_failed' then 'failed'::public.ai_task_status
                      else 'needs_attention'::public.ai_task_status end,
        failure_code = case when new.status = 'cancelled' then 'synthetic.unexpected_cancellation'
                            else 'synthetic.worker_failure' end,
        safe_failure_summary = case when new.status = 'cancelled'
                                    then 'Synthetic execution stopped unexpectedly.'
                                    else 'Synthetic execution needs operator attention.' end,
        completed_at = v_now,
        updated_at = v_now
    where id = v_task.id;
    perform private.ai_task_append_execution_event(
      v_task.id,
      'status_changed',
      v_task.status,
      case when new.status = 'permanent_failed' then 'failed'::public.ai_task_status
           else 'needs_attention'::public.ai_task_status end,
      'service',
      'sanctuary.worker',
      'Synthetic execution did not complete.',
      v_now
    );
    return new;
  end if;

  if new.status <> 'succeeded' then
    return new;
  end if;

  if v_task.status <> 'running' then
    raise exception 'AI synthetic task must be running before job completion'
      using errcode = '55000';
  end if;

  select payload.*
  into v_task_payload
  from private.ai_task_payloads payload
  where payload.task_id = v_task.id;
  select payload.*
  into v_job_payload
  from private.background_job_payloads payload
  where payload.job_id = new.id;

  if v_task_payload.task_id is null
     or v_job_payload.job_id is null
     or v_job_payload.contract_version <> 1
     or (select count(*) from jsonb_object_keys(v_job_payload.payload)) <> 4
     or (v_job_payload.payload ->> 'contractVersion')::integer <> 1
     or v_job_payload.payload ->> 'taskId' <> v_task.id::text
     or v_job_payload.payload ->> 'inputSnapshotHash' <> v_task.input_snapshot_hash
     or v_job_payload.payload ->> 'fixtureKey' <> v_task_payload.payload ->> 'fixtureKey' then
    raise exception 'AI synthetic frozen job input is inconsistent'
      using errcode = '55000';
  end if;

  v_fixture_key := v_task_payload.payload ->> 'fixtureKey';
  v_expected_result_code := case v_fixture_key
    when 'echo_v1' then 'SYNTHETIC_OK'
    when 'classification_v1' then 'SYNTHETIC_ONLY'
    else null
  end;

  if v_expected_result_code is null
     or new.safe_result <> jsonb_build_object(
       'resultCode', v_expected_result_code,
       'processedCount', 1
     ) then
    raise exception 'AI synthetic result does not match the frozen fixture'
      using errcode = '22023';
  end if;

  insert into public.ai_usage_records (
    task_id,
    job_id,
    step_key,
    capability_key,
    capability_version,
    route_key,
    provider_key,
    model_snapshot,
    input_units,
    output_units,
    media_units,
    compute_milliseconds,
    latency_milliseconds,
    cost_cents,
    cache_status,
    safe_provider_request_id,
    recorded_at
  ) values (
    v_task.id,
    new.id,
    'synthetic.execute',
    v_task.capability_key,
    v_task.capability_version,
    'synthetic.mock',
    'synthetic.mock',
    'deterministic.mock.v1',
    0,
    0,
    0,
    0,
    0,
    0,
    'not_used',
    null,
    v_now
  );

  update public.ai_tasks
  set status = 'succeeded',
      actual_cost_cents = 0,
      completed_at = v_now,
      updated_at = v_now
  where id = v_task.id;
  perform private.ai_task_append_execution_event(
    v_task.id,
    'result_recorded',
    null,
    null,
    'node',
    'sanctuary.worker',
    'Deterministic synthetic result recorded.',
    v_now
  );
  perform private.ai_task_append_execution_event(
    v_task.id,
    'status_changed',
    'running',
    'succeeded',
    'service',
    'sanctuary.worker',
    'Synthetic execution succeeded.',
    v_now
  );

  insert into public.ai_evaluations (
    task_id,
    job_id,
    evaluator_type,
    evaluator_kind,
    evaluator_key,
    evaluation_set_key,
    evaluation_set_version,
    scores,
    result,
    safe_feedback_summary,
    production_outcome_code,
    promotion_recommendation,
    evidence_ids,
    evaluated_at
  ) values (
    v_task.id,
    new.id,
    'deterministic',
    'service',
    'sanctuary.synthetic',
    'synthetic.fixture',
    '1.0.0',
    jsonb_build_array(jsonb_build_object(
      'metricKey', 'exact_match',
      'value', 1,
      'threshold', 1,
      'direction', 'at_least',
      'passed', true
    )),
    'passed',
    'Deterministic fixture matched the expected result.',
    null,
    'not_applicable',
    array[]::uuid[],
    v_now
  );

  update public.ai_tasks
  set status = 'evaluated', updated_at = v_now
  where id = v_task.id;
  perform private.ai_task_append_execution_event(
    v_task.id,
    'evaluation_recorded',
    null,
    null,
    'service',
    'sanctuary.synthetic',
    'Deterministic evaluation passed.',
    v_now
  );
  perform private.ai_task_append_execution_event(
    v_task.id,
    'status_changed',
    'succeeded',
    'evaluated',
    'service',
    'sanctuary.synthetic',
    'Synthetic task evaluated.',
    v_now
  );
  return new;
end;
$$;

create trigger ai_synthetic_job_after_update_trigger
after update of status on public.background_jobs
for each row execute function private.ai_synthetic_job_after_update();

revoke all on table public.ai_task_jobs from public, anon, authenticated, service_role;
revoke all on table public.ai_usage_records from public, anon, authenticated, service_role;
revoke all on table public.ai_evaluations from public, anon, authenticated, service_role;
grant select on table public.ai_task_jobs to authenticated;
grant select on table public.ai_usage_records to authenticated;
grant select on table public.ai_evaluations to authenticated;

revoke all on function public.ai_task_enqueue_synthetic(uuid)
  from public, anon, authenticated;
grant execute on function public.ai_task_enqueue_synthetic(uuid)
  to service_role;

revoke all on function private.ai_execution_evidence_append_only()
  from public, anon, authenticated, service_role;
revoke all on function private.ai_task_append_execution_event(
  uuid,
  public.ai_task_event_type,
  public.ai_task_status,
  public.ai_task_status,
  text,
  text,
  text,
  timestamptz
) from public, anon, authenticated, service_role;
revoke all on function private.ai_synthetic_reject_linked_cancel()
  from public, anon, authenticated, service_role;
revoke all on function private.ai_synthetic_job_after_update()
  from public, anon, authenticated, service_role;
