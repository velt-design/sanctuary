-- Executed by the isolated Wave 3 PGMQ database harness. The repository's
-- historical migration chain is not independently bootstrappable, so this test
-- intentionally runs after minimal auth/projects prerequisites plus only the
-- Wave 3 migrations. Never point this at a shared database. The harness should
-- invoke psql with ON_ERROR_STOP=1 and this file; every mutation is rolled back.

begin;
set local plpgsql.variable_conflict = 'error';

do $$
declare
  v_job public.background_jobs%rowtype;
  v_duplicate public.background_jobs%rowtype;
  v_claim record;
  v_payload jsonb := '{"artifactIds":[],"frozenInput":{"version":1}}'::jsonb;
  v_expected_hash text;
  v_queue_message jsonb;
  v_before_heartbeat timestamptz;
  v_after_heartbeat timestamptz;
  v_function_definition text;
  v_count integer;
begin
  if not exists (
    select 1
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'pgmq'
      and relation.relname = 'q_portal_background_jobs'
      and relation.relpersistence = 'p'
  ) then
    raise exception 'portal_background_jobs must be a logged queue';
  end if;

  if has_schema_privilege('authenticated', 'pgmq', 'usage')
     or has_schema_privilege('service_role', 'pgmq', 'usage') then
    raise exception 'PGMQ must be reachable only through the service RPC boundary';
  end if;
  if has_schema_privilege('authenticated', 'private', 'usage')
     or has_schema_privilege('service_role', 'private', 'usage') then
    raise exception 'the protected schema must not be directly reachable by application roles';
  end if;
  if has_table_privilege('authenticated', 'private.background_job_payloads', 'select')
     or has_table_privilege('service_role', 'private.background_job_payloads', 'select') then
    raise exception 'protected payloads must be reachable only through lease-fenced RPCs';
  end if;
  if not exists (
    select 1
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'private'
      and relation.relname = 'background_job_payloads'
      and relation.relrowsecurity
  ) then
    raise exception 'protected payload row-level security is not enabled';
  end if;
  if has_function_privilege(
    'authenticated',
    'public.background_job_enqueue_system(text,integer,text,text,uuid,smallint,text,jsonb,timestamptz,public.background_job_rollout_mode,public.background_job_execution_owner,text)',
    'execute'
  ) then
    raise exception 'browser roles must not execute enqueue RPCs';
  end if;

  select pg_get_functiondef(routine.oid)
  into strict v_function_definition
  from pg_proc routine
  join pg_namespace namespace on namespace.oid = routine.pronamespace
  where namespace.nspname = 'private'
    and routine.proname = 'background_job_enqueue_core';
  if position('pg_advisory_xact_lock' in lower(v_function_definition)) = 0
     or position('hashtextextended' in lower(v_function_definition)) = 0 then
    raise exception 'concurrent first-enqueue calls are not serialised by logical intent';
  end if;

  select * into v_job
  from public.background_job_enqueue_system(
    'job_pack_generate',
    1,
    'job_pack',
    '00000000-0000-4000-8000-000000000001',
    null,
    100::smallint,
    'sql-test/job-pack/one',
    v_payload,
    now(),
    'worker_enabled',
    'worker',
    'sql-test'
  );

  if v_job.id is null or v_job.status <> 'queued' or v_job.queue_message_id is null then
    raise exception 'atomic enqueue did not return a durable queued job';
  end if;
  if not exists (select 1 from private.background_job_payloads payload where payload.job_id = v_job.id) then
    raise exception 'atomic enqueue did not persist protected payload';
  end if;
  v_expected_hash := encode(sha256(convert_to(v_payload::text, 'UTF8')), 'hex');
  if v_job.input_hash <> v_expected_hash
     or (select payload_hash from private.background_job_payloads where job_id = v_job.id) <> v_expected_hash then
    raise exception 'the database did not author one canonical frozen payload hash';
  end if;

  select queue_message.message into v_queue_message
  from pgmq.q_portal_background_jobs queue_message
  where queue_message.msg_id = v_job.queue_message_id;
  if (select count(*) from jsonb_object_keys(v_queue_message)) <> 2
     or not (v_queue_message ? 'jobId')
     or not (v_queue_message ? 'contractVersion') then
    raise exception 'queue message contains more than the minimal contract';
  end if;

  select * into v_duplicate
  from public.background_job_enqueue_system(
    'job_pack_generate', 1, 'job_pack', '00000000-0000-4000-8000-000000000001', null,
    100::smallint, 'sql-test/job-pack/one', v_payload, now(), 'worker_enabled', 'worker', 'sql-test'
  );
  if v_duplicate.id <> v_job.id then
    raise exception 'duplicate intent created another logical job';
  end if;

  begin
    perform public.background_job_enqueue_system(
      'job_pack_generate', 1, 'job_pack', '00000000-0000-4000-8000-000000000001', null,
      100::smallint, 'sql-test/job-pack/one', '{"changed":true}'::jsonb,
      now(), 'worker_enabled', 'worker', 'sql-test'
    );
    raise exception 'changed input reused an existing intent key';
  exception when unique_violation then
    null;
  end;

  begin
    perform public.background_job_enqueue_system(
      'job_pack_generate', 1, 'job_pack', '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000099'::uuid,
      100::smallint, 'sql-test/job-pack/one', v_payload,
      now(), 'worker_enabled', 'worker', 'sql-test'
    );
    raise exception 'project-mismatched input reused an existing intent key';
  exception when unique_violation then
    null;
  end;

  select * into v_claim
  from public.background_jobs_claim('sql-worker-one', 1, 60);
  if v_claim.job_id <> v_job.id or v_claim.lease_token is null then
    raise exception 'first worker did not receive a fenced claim';
  end if;
  select count(*) into v_count
  from public.background_jobs_claim('sql-worker-two', 1, 60);
  if v_count <> 0 then
    raise exception 'a second worker claimed an active lease';
  end if;

  select count(*) into v_count
  from public.background_job_read_payload(v_job.id, 'sql-worker-one', gen_random_uuid());
  if v_count <> 0 then
    raise exception 'wrong fencing token read a protected payload';
  end if;
  select count(*) into v_count
  from public.background_job_read_payload(v_job.id, 'sql-worker-one', v_claim.lease_token);
  if v_count <> 1 then
    raise exception 'lease owner could not read its protected payload';
  end if;

  v_before_heartbeat := v_claim.lease_expires_at;
  perform public.background_job_heartbeat(v_job.id, 'sql-worker-one', v_claim.lease_token, 120);
  select lease_expires_at into v_after_heartbeat from public.background_jobs where id = v_job.id;
  if v_after_heartbeat <= v_before_heartbeat then
    raise exception 'heartbeat did not extend the application lease';
  end if;

  begin
    update public.background_jobs set status = 'succeeded' where id = v_job.id;
    raise exception 'invalid state transition was accepted';
  exception when invalid_parameter_value then
    null;
  end;

  perform public.background_job_record_progress(
    v_job.id, 'sql-worker-one', v_claim.lease_token, 'running', 'generating', '{"percent":50}'::jsonb
  );
  perform public.background_job_record_progress(
    v_job.id, 'sql-worker-one', v_claim.lease_token, 'finalising', 'finalising', '{"percent":100}'::jsonb
  );
  perform public.background_job_complete(
    v_job.id, 'sql-worker-one', v_claim.lease_token, '{"artifactCount":1}'::jsonb
  );

  if exists (
    select 1 from pgmq.q_portal_background_jobs queue_message where queue_message.msg_id = v_job.queue_message_id
  ) then
    raise exception 'successful completion did not archive the canonical queue message';
  end if;
  if (select status from public.background_jobs where id = v_job.id) <> 'succeeded' then
    raise exception 'successful completion did not finalise the ledger';
  end if;
end;
$$;

-- Event history remains immutable while foreign-key deletion can redact only
-- nullable subject references without blocking the referenced record deletion.
do $$
declare
  v_event_id bigint;
begin
  select event.id
  into strict v_event_id
  from public.background_job_events event
  where event.event_type = 'succeeded'
  order by event.id
  limit 1;

  update public.background_job_events
  set job_id = null
  where id = v_event_id;

  if (select job_id from public.background_job_events where id = v_event_id) is not null then
    raise exception 'event nullable reference was not cleared';
  end if;

  begin
    update public.background_job_events
    set safe_detail = '{"changed":true}'::jsonb
    where id = v_event_id;
    raise exception 'event content update bypassed append-only history';
  exception when invalid_parameter_value then
    null;
  end;
end;
$$;

-- Side-effecting kinds cannot complete until every external checkpoint required
-- by the database registry is durably finalised.
do $$
declare
  v_job public.background_jobs%rowtype;
  v_claim record;
begin
  select * into v_job
  from public.background_job_enqueue_system(
    'quote_send', 1, 'quote', '00000000-0000-4000-8000-000000000010', null,
    100::smallint, 'sql-test/quote/missing-required-effect',
    '{"quoteVersionId":"00000000-0000-4000-8000-000000000010"}'::jsonb,
    now(), 'worker_enabled', 'worker', 'sql-test'
  );
  select * into strict v_claim from public.background_jobs_claim('sql-missing-effect-worker', 1, 60);
  perform public.background_job_record_progress(
    v_job.id, 'sql-missing-effect-worker', v_claim.lease_token, 'running', 'preparing_delivery', '{}'::jsonb
  );
  perform public.background_job_record_progress(
    v_job.id, 'sql-missing-effect-worker', v_claim.lease_token, 'finalising', 'finalising_delivery', '{}'::jsonb
  );

  begin
    perform public.background_job_complete(
      v_job.id, 'sql-missing-effect-worker', v_claim.lease_token, '{}'::jsonb
    );
    raise exception 'side-effecting job completed without its required external checkpoint';
  exception when invalid_parameter_value then
    null;
  end;

  perform public.background_job_mark_needs_attention(
    v_job.id,
    'sql-missing-effect-worker',
    v_claim.lease_token,
    'MISSING_REQUIRED_EFFECT',
    'Required external effect was not finalised.',
    '{"checkpoint":"email_dispatch"}'::jsonb
  );
end;
$$;

-- Shadow execution may prove preparation but can neither dispatch externally
-- nor be forced to fabricate a provider-accepted checkpoint before completion.
do $$
declare
  v_job public.background_jobs%rowtype;
  v_claim record;
begin
  select * into v_job
  from public.background_job_enqueue_system(
    'quote_send', 1, 'quote', '00000000-0000-4000-8000-000000000011', null,
    100::smallint, 'sql-test/quote/shadow-no-dispatch',
    '{"quoteVersionId":"00000000-0000-4000-8000-000000000011"}'::jsonb,
    now(), 'shadow', 'shadow', 'sql-test'
  );
  select * into strict v_claim from public.background_jobs_claim('sql-shadow-worker', 1, 60);
  perform public.background_job_record_progress(
    v_job.id, 'sql-shadow-worker', v_claim.lease_token, 'running', 'validating_delivery', '{}'::jsonb
  );
  perform public.background_job_record_effect_checkpoint(
    v_job.id, 'sql-shadow-worker', v_claim.lease_token,
    'email_dispatch', 'email_dispatch', 'prepared', repeat('c', 64),
    'sql-provider', 'sql-test/quote/shadow-no-dispatch', now() + interval '1 hour', null, '{}'::jsonb
  );

  begin
    perform public.background_job_record_effect_checkpoint(
      v_job.id, 'sql-shadow-worker', v_claim.lease_token,
      'email_dispatch', 'email_dispatch', 'dispatch_started', repeat('c', 64),
      'sql-provider', 'sql-test/quote/shadow-no-dispatch', now() + interval '1 hour', null, '{}'::jsonb
    );
    raise exception 'shadow execution started an external provider dispatch';
  exception when invalid_parameter_value then
    null;
  end;

  perform public.background_job_record_progress(
    v_job.id, 'sql-shadow-worker', v_claim.lease_token, 'finalising', 'shadow_validated', '{}'::jsonb
  );
  perform public.background_job_complete(
    v_job.id, 'sql-shadow-worker', v_claim.lease_token, '{"shadowValidated":true}'::jsonb
  );
end;
$$;

-- Provider effects can reopen only with the frozen identity, and an unresolved
-- dispatch cannot enter any path that could deliver the side effect again.
do $$
declare
  v_job public.background_jobs%rowtype;
  v_claim record;
  v_message_id bigint;
  v_provider_expiry timestamptz := now() + interval '1 hour';
  v_payload jsonb := '{"quoteVersionId":"00000000-0000-4000-8000-000000000002"}'::jsonb;
begin
  select * into v_job
  from public.background_job_enqueue_system(
    'quote_send', 1, 'quote', '00000000-0000-4000-8000-000000000002', null,
    100::smallint, 'sql-test/quote/effect-retry', v_payload, now(), 'worker_enabled', 'worker', 'sql-test'
  );
  select * into strict v_claim from public.background_jobs_claim('sql-effect-worker-one', 1, 60);
  perform public.background_job_record_progress(
    v_job.id, 'sql-effect-worker-one', v_claim.lease_token, 'running', 'preparing_delivery', '{}'::jsonb
  );
  perform public.background_job_record_effect_checkpoint(
    v_job.id, 'sql-effect-worker-one', v_claim.lease_token,
    'email_dispatch', 'email_dispatch', 'prepared', repeat('a', 64),
    'sql-provider', 'sql-test/quote/effect-retry', v_provider_expiry, null, '{}'::jsonb
  );
  perform public.background_job_record_effect_checkpoint(
    v_job.id, 'sql-effect-worker-one', v_claim.lease_token,
    'email_dispatch', 'email_dispatch', 'dispatch_started', repeat('a', 64),
    'sql-provider', 'sql-test/quote/effect-retry', v_provider_expiry, null, '{}'::jsonb
  );

  begin
    perform public.background_job_schedule_retry(
      v_job.id, 'sql-effect-worker-one', v_claim.lease_token, 1, 'PROVIDER_RETRY', 'Known test retry.'
    );
    raise exception 'unresolved provider dispatch entered automatic retry';
  exception when invalid_parameter_value then
    null;
  end;
  begin
    perform public.background_job_mark_permanent_failure(
      v_job.id, 'sql-effect-worker-one', v_claim.lease_token, 'PROVIDER_FAILED', 'Known test failure.'
    );
    raise exception 'unresolved provider dispatch entered permanent failure';
  exception when invalid_parameter_value then
    null;
  end;

  perform public.background_job_record_effect_checkpoint(
    v_job.id, 'sql-effect-worker-one', v_claim.lease_token,
    'email_dispatch', 'email_dispatch', 'uncertain', repeat('a', 64),
    'sql-provider', 'sql-test/quote/effect-retry', v_provider_expiry, null, '{}'::jsonb
  );
  perform public.background_job_schedule_retry(
    v_job.id, 'sql-effect-worker-one', v_claim.lease_token, 1, 'PROVIDER_UNCERTAIN', 'Retry inside idempotency window.'
  );

  begin
    perform public.background_job_heartbeat(v_job.id, 'sql-effect-worker-one', v_claim.lease_token, 60);
    raise exception 'released retry lease accepted a stale heartbeat';
  exception when object_not_in_prerequisite_state then
    null;
  end;

  update public.background_jobs set next_attempt_at = now() where id = v_job.id;
  select queue_message_id into strict v_message_id from public.background_jobs where id = v_job.id;
  perform pgmq.set_vt('portal_background_jobs', v_message_id, 0);
  select * into strict v_claim from public.background_jobs_claim('sql-effect-worker-two', 1, 60);
  perform public.background_job_record_progress(
    v_job.id, 'sql-effect-worker-two', v_claim.lease_token, 'running', 'retrying_delivery', '{}'::jsonb
  );
  perform public.background_job_record_effect_checkpoint(
    v_job.id, 'sql-effect-worker-two', v_claim.lease_token,
    'email_dispatch', 'email_dispatch', 'dispatch_started', repeat('a', 64),
    'sql-provider', 'sql-test/quote/effect-retry', v_provider_expiry, null, '{}'::jsonb
  );
  perform public.background_job_record_effect_checkpoint(
    v_job.id, 'sql-effect-worker-two', v_claim.lease_token,
    'email_dispatch', 'email_dispatch', 'failed', repeat('a', 64),
    'sql-provider', 'sql-test/quote/effect-retry', v_provider_expiry, null, '{}'::jsonb
  );
  perform public.background_job_schedule_retry(
    v_job.id, 'sql-effect-worker-two', v_claim.lease_token, 1, 'PROVIDER_REJECTED', 'Provider rejected before acceptance.'
  );

  update public.background_jobs set next_attempt_at = now() where id = v_job.id;
  select queue_message_id into strict v_message_id from public.background_jobs where id = v_job.id;
  perform pgmq.set_vt('portal_background_jobs', v_message_id, 0);
  select * into strict v_claim from public.background_jobs_claim('sql-effect-worker-three', 1, 60);
  perform public.background_job_record_progress(
    v_job.id, 'sql-effect-worker-three', v_claim.lease_token, 'running', 'retrying_known_failure', '{}'::jsonb
  );
  perform public.background_job_record_effect_checkpoint(
    v_job.id, 'sql-effect-worker-three', v_claim.lease_token,
    'email_dispatch', 'email_dispatch', 'dispatch_started', repeat('a', 64),
    'sql-provider', 'sql-test/quote/effect-retry', v_provider_expiry, null, '{}'::jsonb
  );
  perform public.background_job_record_effect_checkpoint(
    v_job.id, 'sql-effect-worker-three', v_claim.lease_token,
    'email_dispatch', 'email_dispatch', 'provider_accepted', repeat('a', 64),
    'sql-provider', 'sql-test/quote/effect-retry', v_provider_expiry, 'sql-provider-message-one', '{}'::jsonb
  );

  begin
    perform public.background_job_record_effect_checkpoint(
      v_job.id, 'sql-effect-worker-three', v_claim.lease_token,
      'email_dispatch', 'email_dispatch', 'provider_accepted', repeat('a', 64),
      'sql-provider', 'sql-test/quote/effect-retry', v_provider_expiry, 'sql-provider-message-two', '{}'::jsonb
    );
    raise exception 'a frozen provider message ID was silently replaced';
  exception when unique_violation then
    null;
  end;

  perform public.background_job_record_effect_checkpoint(
    v_job.id, 'sql-effect-worker-three', v_claim.lease_token,
    'email_dispatch', 'email_dispatch', 'finalised', repeat('a', 64),
    'sql-provider', 'sql-test/quote/effect-retry', v_provider_expiry, 'sql-provider-message-one', '{}'::jsonb
  );
  perform public.background_job_record_progress(
    v_job.id, 'sql-effect-worker-three', v_claim.lease_token, 'finalising', 'finalising_delivery', '{}'::jsonb
  );
  perform public.background_job_complete(
    v_job.id, 'sql-effect-worker-three', v_claim.lease_token, '{"providerAccepted":true}'::jsonb
  );

  if not exists (
    select 1
    from public.background_job_events event
    where event.job_id = v_job.id
      and event.event_type = 'provider_dispatch'
      and event.from_status = 'running'
      and event.to_status = 'dispatching'
  ) then
    raise exception 'provider dispatch audit lost its pre-transition status';
  end if;
  if not exists (
    select 1 from public.background_job_events event
    where event.job_id = v_job.id and event.event_type = 'finalised'
  ) then
    raise exception 'finalised provider checkpoint was not audited';
  end if;
end;
$$;

-- Queued cancellation is terminal immediately. Claimed cancellation fences out
-- later phase/dispatch progress until the current lease acknowledges it.
do $$
declare
  v_queued public.background_jobs%rowtype;
  v_claimed public.background_jobs%rowtype;
  v_expired_cancelled public.background_jobs%rowtype;
  v_claim record;
  v_recovered integer;
begin
  select * into v_queued
  from public.background_job_enqueue_system(
    'job_pack_generate', 1, 'job_pack', '00000000-0000-4000-8000-000000000003', null,
    100::smallint, 'sql-test/cancel/queued', '{}'::jsonb, now(), 'worker_enabled', 'worker', 'sql-test'
  );
  perform public.background_job_request_cancellation(v_queued.id, null, 'SQL queued cancellation');
  if (select status from public.background_jobs where id = v_queued.id) <> 'cancelled'
     or private.background_job_queue_contains(v_queued.queue_message_id) then
    raise exception 'queued cancellation was not atomically archived and finalised';
  end if;

  select * into v_claimed
  from public.background_job_enqueue_system(
    'automation_event', 1, 'automation_event', 'sql-cancel-claimed', null,
    100::smallint, 'sql-test/cancel/claimed', '{}'::jsonb, now(), 'worker_enabled', 'worker', 'sql-test'
  );
  select * into strict v_claim from public.background_jobs_claim('sql-cancel-worker', 1, 60);
  perform public.background_job_request_cancellation(v_claimed.id, null, 'SQL claimed cancellation');
  begin
    perform public.background_job_record_progress(
      v_claimed.id, 'sql-cancel-worker', v_claim.lease_token, 'running', 'must_not_run', '{}'::jsonb
    );
    raise exception 'claimed cancellation allowed more phase progress';
  exception when invalid_parameter_value then
    null;
  end;
  begin
    perform public.background_job_schedule_retry(
      v_claimed.id, 'sql-cancel-worker', v_claim.lease_token, 1, 'CANCEL_PENDING', 'Cancellation is pending.'
    );
    raise exception 'claimed cancellation allowed retry scheduling';
  exception when invalid_parameter_value then
    null;
  end;
  begin
    perform public.background_job_mark_needs_attention(
      v_claimed.id, 'sql-cancel-worker', v_claim.lease_token,
      'CANCEL_PENDING', 'Cancellation is pending.', '{}'::jsonb
    );
    raise exception 'claimed cancellation allowed needs-attention finalisation';
  exception when invalid_parameter_value then
    null;
  end;
  begin
    perform public.background_job_mark_permanent_failure(
      v_claimed.id, 'sql-cancel-worker', v_claim.lease_token,
      'CANCEL_PENDING', 'Cancellation is pending.'
    );
    raise exception 'claimed cancellation allowed permanent failure';
  exception when invalid_parameter_value then
    null;
  end;
  begin
    perform public.background_job_release_lease(
      v_claimed.id, 'sql-cancel-worker', v_claim.lease_token
    );
    raise exception 'claimed cancellation allowed lease release instead of acknowledgement';
  exception when invalid_parameter_value then
    null;
  end;
  perform public.background_job_acknowledge_cancellation(
    v_claimed.id, 'sql-cancel-worker', v_claim.lease_token
  );
  if (select status from public.background_jobs where id = v_claimed.id) <> 'cancelled' then
    raise exception 'claimed cancellation acknowledgement did not finalise the ledger';
  end if;

  select * into v_expired_cancelled
  from public.background_job_enqueue_system(
    'automation_event', 1, 'automation_event', 'sql-cancel-expired', null,
    100::smallint, 'sql-test/cancel/expired', '{}'::jsonb, now(), 'worker_enabled', 'worker', 'sql-test'
  );
  select * into strict v_claim from public.background_jobs_claim('sql-cancel-expired-worker', 1, 60);
  perform public.background_job_request_cancellation(
    v_expired_cancelled.id, null, 'SQL expired cancellation'
  );
  update public.background_jobs
  set attempt_count = max_attempts,
      lease_expires_at = now() - interval '1 second'
  where id = v_expired_cancelled.id;
  v_recovered := public.background_jobs_recover_expired_leases('sql-cancel-reconciler', 10);
  if v_recovered <> 1
     or (select status from public.background_jobs where id = v_expired_cancelled.id) <> 'cancelled'
     or private.background_job_queue_contains(v_expired_cancelled.queue_message_id) then
    raise exception 'expired pending cancellation was not finalised before retry exhaustion';
  end if;
end;
$$;

-- Expired leases either become retryable before dispatch, or uncertain and
-- attention-only once an external provider dispatch has begun.
do $$
declare
  v_retry_job public.background_jobs%rowtype;
  v_dispatch_job public.background_jobs%rowtype;
  v_claim record;
  v_provider_expiry timestamptz := now() + interval '1 hour';
  v_recovered integer;
begin
  select * into v_retry_job
  from public.background_job_enqueue_system(
    'job_pack_generate', 1, 'job_pack', '00000000-0000-4000-8000-000000000004', null,
    100::smallint, 'sql-test/recover/pre-dispatch', '{}'::jsonb, now(), 'worker_enabled', 'worker', 'sql-test'
  );
  select * into strict v_claim from public.background_jobs_claim('sql-recover-worker-one', 1, 60);
  update public.background_jobs set lease_expires_at = now() - interval '1 second' where id = v_retry_job.id;
  v_recovered := public.background_jobs_recover_expired_leases('sql-reconciler', 10);
  if v_recovered <> 1
     or (select status from public.background_jobs where id = v_retry_job.id) <> 'retrying'
     or (select lease_token from public.background_jobs where id = v_retry_job.id) is not null then
    raise exception 'pre-dispatch expired lease was not recovered for retry';
  end if;
  perform public.background_job_request_cancellation(v_retry_job.id, null, 'SQL recovery cleanup');

  select * into v_dispatch_job
  from public.background_job_enqueue_system(
    'quote_send', 1, 'quote', '00000000-0000-4000-8000-000000000005', null,
    100::smallint, 'sql-test/recover/dispatch', '{}'::jsonb, now(), 'worker_enabled', 'worker', 'sql-test'
  );
  select * into strict v_claim from public.background_jobs_claim('sql-recover-worker-two', 1, 60);
  perform public.background_job_record_progress(
    v_dispatch_job.id, 'sql-recover-worker-two', v_claim.lease_token, 'running', 'preparing_delivery', '{}'::jsonb
  );
  perform public.background_job_record_effect_checkpoint(
    v_dispatch_job.id, 'sql-recover-worker-two', v_claim.lease_token,
    'email_dispatch', 'email_dispatch', 'prepared', repeat('b', 64),
    'sql-provider', 'sql-test/recover/dispatch', v_provider_expiry, null, '{}'::jsonb
  );
  perform public.background_job_record_effect_checkpoint(
    v_dispatch_job.id, 'sql-recover-worker-two', v_claim.lease_token,
    'email_dispatch', 'email_dispatch', 'dispatch_started', repeat('b', 64),
    'sql-provider', 'sql-test/recover/dispatch', v_provider_expiry, null, '{}'::jsonb
  );
  update public.background_jobs set lease_expires_at = now() - interval '1 second' where id = v_dispatch_job.id;
  v_recovered := public.background_jobs_recover_expired_leases('sql-reconciler', 10);
  if v_recovered <> 1
     or (select status from public.background_jobs where id = v_dispatch_job.id) <> 'needs_attention'
     or (select state from public.background_job_effects where job_id = v_dispatch_job.id and effect_key = 'email_dispatch') <> 'uncertain'
     or private.background_job_queue_contains(v_dispatch_job.queue_message_id) then
    raise exception 'dispatching expired lease was not fenced for provider reconciliation';
  end if;
end;
$$;

-- Reconciliation archives malformed/orphan/duplicate messages and recreates
-- exactly one canonical message when a live ledger row has lost its queue row.
do $$
declare
  v_job public.background_jobs%rowtype;
  v_duplicate_message_id bigint;
  v_orphan_message_id bigint;
  v_invalid_message_id bigint;
  v_repaired_message_id bigint;
  v_report jsonb;
begin
  select * into v_job
  from public.background_job_enqueue_system(
    'job_pack_generate', 1, 'job_pack', '00000000-0000-4000-8000-000000000006', null,
    100::smallint, 'sql-test/reconcile/one', '{}'::jsonb, now(), 'worker_enabled', 'worker', 'sql-test'
  );
  if not pgmq.archive('portal_background_jobs', v_job.queue_message_id) then
    raise exception 'test setup could not remove the canonical queue message';
  end if;

  select * into strict v_duplicate_message_id
  from pgmq.send(
    'portal_background_jobs',
    jsonb_build_object('jobId', v_job.id, 'contractVersion', v_job.contract_version)
  );
  select * into strict v_orphan_message_id
  from pgmq.send(
    'portal_background_jobs',
    jsonb_build_object('jobId', gen_random_uuid(), 'contractVersion', 1)
  );
  select * into strict v_invalid_message_id
  from pgmq.send(
    'portal_background_jobs',
    jsonb_build_object('jobId', gen_random_uuid(), 'contractVersion', 1, 'payload', jsonb_build_object())
  );

  v_report := public.background_jobs_reconcile('sql-reconciler', 100);
  if (v_report ->> 'archivedMessages')::integer <> 3
     or (v_report ->> 'repairedMessages')::integer <> 1 then
    raise exception 'reconciliation counts did not match duplicate/orphan repair: %', v_report;
  end if;
  if private.background_job_queue_contains(v_duplicate_message_id)
     or private.background_job_queue_contains(v_orphan_message_id)
     or private.background_job_queue_contains(v_invalid_message_id) then
    raise exception 'reconciliation left duplicate or orphan messages active';
  end if;

  select queue_message_id into strict v_repaired_message_id
  from public.background_jobs where id = v_job.id;
  if v_repaired_message_id = v_job.queue_message_id
     or not private.background_job_queue_contains(v_repaired_message_id) then
    raise exception 'reconciliation did not create a new canonical message';
  end if;
  if not exists (
    select 1 from public.background_job_events event
    where event.job_id = v_job.id and event.event_type = 'duplicate_message'
  ) or not exists (
    select 1 from public.background_job_events event
    where event.job_id = v_job.id and event.event_type = 'queue_repaired'
  ) or not exists (
    select 1 from public.background_job_events event
    where event.job_id = v_job.id and event.event_type = 'queue_archive_missing'
  ) or (
    select count(*) from public.background_job_events event
    where event.job_id is null and event.event_type = 'orphaned_message'
  ) < 2 then
    raise exception 'reconciliation did not append missing/duplicate/orphan/repair audit events';
  end if;

  perform public.background_job_request_cancellation(v_job.id, null, 'SQL reconciliation cleanup');
end;
$$;

-- Explicit NULLs fail closed on every bounded worker/list argument, while the
-- documented reconciliation upper bound remains executable.
do $$
begin
  begin
    perform * from public.background_jobs_claim('sql-null-guard', null, 60);
    raise exception 'NULL claim batch size bypassed bounds';
  exception when invalid_parameter_value then
    null;
  end;
  begin
    perform * from public.background_jobs_claim('sql-null-guard', 1, null);
    raise exception 'NULL claim visibility timeout bypassed bounds';
  exception when invalid_parameter_value then
    null;
  end;
  begin
    perform public.background_job_heartbeat(gen_random_uuid(), 'sql-null-guard', gen_random_uuid(), null);
    raise exception 'NULL heartbeat visibility timeout bypassed bounds';
  exception when invalid_parameter_value then
    null;
  end;
  begin
    perform public.background_job_schedule_retry(
      gen_random_uuid(), 'sql-null-guard', gen_random_uuid(), null, 'NULL_BOUND', 'Null bound test.'
    );
    raise exception 'NULL retry delay bypassed bounds';
  exception when invalid_parameter_value then
    null;
  end;
  begin
    perform public.background_jobs_recover_expired_leases('sql-null-guard', null);
    raise exception 'NULL recovery limit bypassed bounds';
  exception when invalid_parameter_value then
    null;
  end;
  begin
    perform public.background_jobs_reconcile('sql-null-guard', null);
    raise exception 'NULL reconciliation limit bypassed bounds';
  exception when invalid_parameter_value then
    null;
  end;
  begin
    perform * from public.background_jobs_list_safe(null, null, null, null, null);
    raise exception 'NULL job-list limit bypassed bounds';
  exception when invalid_parameter_value then
    null;
  end;
  begin
    perform * from public.background_job_event_history_safe(gen_random_uuid(), null);
    raise exception 'NULL event-history limit bypassed bounds';
  exception when invalid_parameter_value then
    null;
  end;

  perform public.background_jobs_reconcile('sql-upper-bound', 5000);
end;
$$;

rollback;
