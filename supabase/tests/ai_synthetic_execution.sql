-- Executable PR-AI-007 contract. Runs only in the disposable PGMQ harness.

do $$
declare
  v_requester constant uuid := '71000000-0000-4000-8000-000000000001';
  v_other_staff constant uuid := '71000000-0000-4000-8000-000000000002';
begin
  insert into auth.users(id) values (v_requester), (v_other_staff)
  on conflict (id) do nothing;
  insert into public.portal_users(user_id, role, is_active)
  values (v_requester, 'staff', true), (v_other_staff, 'staff', true)
  on conflict (user_id) do update set role = excluded.role, is_active = excluded.is_active;
end;
$$;

set role authenticated;
set request.jwt.claim.sub = '71000000-0000-4000-8000-000000000001';

select * from public.ai_task_create_synthetic('execution_echo_v1', 'echo_v1');
select * from public.ai_task_create_synthetic('execution_classification_v1', 'classification_v1');

reset role;
reset request.jwt.claim.sub;

do $$
declare
  v_task_id uuid;
begin
  select task.id into strict v_task_id
  from public.ai_tasks task
  where task.idempotency_key = 'execution_echo_v1';

  if not exists (
    select 1
    from public.ai_task_enqueue_synthetic(v_task_id) queued
    where queued.queued_task_status = 'queued'
      and not queued.was_replayed
  ) then
    raise exception 'synthetic enqueue did not create the first durable job';
  end if;

  if not exists (
    select 1
    from public.ai_task_enqueue_synthetic(v_task_id) replayed
    where replayed.queued_task_status = 'queued'
      and replayed.was_replayed
  ) then
    raise exception 'synthetic enqueue did not replay the same task/job intent';
  end if;
end;
$$;

set role authenticated;
set request.jwt.claim.sub = '71000000-0000-4000-8000-000000000001';

do $$
declare
  v_task_id uuid;
begin
  select task.id into strict v_task_id
  from public.ai_tasks task
  where task.idempotency_key = 'execution_echo_v1';

  begin
    perform public.ai_task_cancel_synthetic(
      v_task_id,
      '71000000-0000-4000-8000-000000000010',
      'test_cleanup'
    );
    raise exception 'linked synthetic task accepted task-only cancellation';
  exception
    when sqlstate '55000' then null;
  end;
end;
$$;

reset role;
reset request.jwt.claim.sub;

do $$
declare
  v_task_id uuid;
  v_job_id uuid;
  v_claim record;
begin
  select task.id into strict v_task_id
  from public.ai_tasks task
  where task.idempotency_key = 'execution_echo_v1';
  select link.job_id into strict v_job_id
  from public.ai_task_jobs link
  where link.task_id = v_task_id;

  select claim.* into strict v_claim
  from public.background_jobs_claim('ai-synthetic-contract-worker', 100, 120) claim
  where claim.job_id = v_job_id;

  perform public.background_job_record_progress(
    v_job_id,
    'ai-synthetic-contract-worker',
    v_claim.lease_token,
    'preparing',
    'preparing',
    jsonb_build_object('phase', 'preparing')
  );
  perform public.background_job_record_progress(
    v_job_id,
    'ai-synthetic-contract-worker',
    v_claim.lease_token,
    'running',
    'synthetic_evaluation',
    jsonb_build_object(
      'phase', 'synthetic_evaluation',
      'progressCode', 'deterministic_fixture',
      'processedCount', 0,
      'totalCount', 1
    )
  );
  perform public.background_job_record_progress(
    v_job_id,
    'ai-synthetic-contract-worker',
    v_claim.lease_token,
    'finalising',
    'finalising',
    jsonb_build_object('phase', 'finalising')
  );
  perform public.background_job_complete(
    v_job_id,
    'ai-synthetic-contract-worker',
    v_claim.lease_token,
    jsonb_build_object('resultCode', 'SYNTHETIC_OK', 'processedCount', 1)
  );

  if (select task.status from public.ai_tasks task where task.id = v_task_id) <> 'evaluated' then
    raise exception 'successful synthetic job did not evaluate its owning task';
  end if;
  if (select count(*) from public.ai_usage_records usage where usage.task_id = v_task_id) <> 1 then
    raise exception 'synthetic job did not record exactly one usage row';
  end if;
  if not exists (
    select 1
    from public.ai_usage_records usage
    where usage.task_id = v_task_id
      and usage.provider_key = 'synthetic.mock'
      and usage.model_snapshot = 'deterministic.mock.v1'
      and usage.input_units = 0
      and usage.output_units = 0
      and usage.media_units = 0
      and usage.compute_milliseconds = 0
      and usage.latency_milliseconds = 0
      and usage.cost_cents = 0
      and usage.safe_provider_request_id is null
  ) then
    raise exception 'synthetic usage evidence was not fixed, provider-free, and zero-cost';
  end if;
  if not exists (
    select 1
    from public.ai_evaluations evaluation
    where evaluation.task_id = v_task_id
      and evaluation.result = 'passed'
      and evaluation.evaluator_type = 'deterministic'
      and evaluation.scores = jsonb_build_array(jsonb_build_object(
        'metricKey', 'exact_match',
        'value', 1,
        'threshold', 1,
        'direction', 'at_least',
        'passed', true
      ))
  ) then
    raise exception 'synthetic deterministic evaluation evidence is missing';
  end if;
  if exists (
    select 1
    from public.background_job_effects effect
    where effect.job_id = v_job_id
  ) then
    raise exception 'synthetic execution recorded an external effect';
  end if;
  if (select task.actual_cost_cents from public.ai_tasks task where task.id = v_task_id) <> 0 then
    raise exception 'synthetic execution changed the zero-cost task boundary';
  end if;
end;
$$;

do $$
declare
  v_task_id uuid;
  v_job_id uuid;
  v_claim record;
begin
  select task.id into strict v_task_id
  from public.ai_tasks task
  where task.idempotency_key = 'execution_classification_v1';
  select queued.queued_job_id into strict v_job_id
  from public.ai_task_enqueue_synthetic(v_task_id) queued;

  select claim.* into strict v_claim
  from public.background_jobs_claim('ai-synthetic-contract-worker', 100, 120) claim
  where claim.job_id = v_job_id;

  perform public.background_job_record_progress(
    v_job_id,
    'ai-synthetic-contract-worker',
    v_claim.lease_token,
    'preparing',
    'preparing',
    jsonb_build_object('phase', 'preparing')
  );
  perform public.background_job_record_progress(
    v_job_id,
    'ai-synthetic-contract-worker',
    v_claim.lease_token,
    'running',
    'synthetic_evaluation',
    jsonb_build_object('phase', 'synthetic_evaluation')
  );
  perform public.background_job_record_progress(
    v_job_id,
    'ai-synthetic-contract-worker',
    v_claim.lease_token,
    'finalising',
    'finalising',
    jsonb_build_object('phase', 'finalising')
  );

  begin
    perform public.background_job_complete(
      v_job_id,
      'ai-synthetic-contract-worker',
      v_claim.lease_token,
      jsonb_build_object('resultCode', 'SYNTHETIC_OK', 'processedCount', 1)
    );
    raise exception 'classification job accepted the echo fixture result';
  exception
    when sqlstate '22023' then null;
  end;

  if (select job.status from public.background_jobs job where job.id = v_job_id) <> 'finalising' then
    raise exception 'rejected synthetic result did not roll job completion back atomically';
  end if;
  if (select task.status from public.ai_tasks task where task.id = v_task_id) <> 'running' then
    raise exception 'rejected synthetic result changed the task terminal state';
  end if;

  perform public.background_job_complete(
    v_job_id,
    'ai-synthetic-contract-worker',
    v_claim.lease_token,
    jsonb_build_object('resultCode', 'SYNTHETIC_ONLY', 'processedCount', 1)
  );
end;
$$;

do $$
begin
  if has_function_privilege('authenticated', 'public.ai_task_enqueue_synthetic(uuid)', 'EXECUTE') then
    raise exception 'authenticated role can execute the service-only synthetic producer';
  end if;
  if has_function_privilege('anon', 'public.ai_task_enqueue_synthetic(uuid)', 'EXECUTE') then
    raise exception 'anonymous role can execute the service-only synthetic producer';
  end if;
  if not has_function_privilege('service_role', 'public.ai_task_enqueue_synthetic(uuid)', 'EXECUTE') then
    raise exception 'service role cannot execute the synthetic producer';
  end if;
  if has_table_privilege('service_role', 'public.ai_usage_records', 'SELECT')
     or has_table_privilege('service_role', 'public.ai_evaluations', 'SELECT')
     or has_table_privilege('service_role', 'public.ai_task_jobs', 'SELECT') then
    raise exception 'service role received direct AI execution evidence table access';
  end if;
end;
$$;

set role authenticated;
set request.jwt.claim.sub = '71000000-0000-4000-8000-000000000002';

do $$
begin
  if exists (select 1 from public.ai_task_jobs)
     or exists (select 1 from public.ai_usage_records)
     or exists (select 1 from public.ai_evaluations) then
    raise exception 'unrelated staff could read synthetic execution evidence';
  end if;
end;
$$;

reset role;
reset request.jwt.claim.sub;

do $$
begin
  begin
    update public.ai_evaluations set result = 'failed';
    raise exception 'AI evaluation history accepted an update';
  exception
    when sqlstate '55000' then null;
  end;
end;
$$;
