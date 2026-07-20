-- Executed by the isolated Wave 3 PGMQ database harness. The repository's
-- historical migration chain is not independently bootstrappable, so this test
-- intentionally runs after minimal auth/projects prerequisites plus only the
-- Wave 3 migrations. Never point this at a shared database. The harness should
-- invoke psql with ON_ERROR_STOP=1 and this file; every mutation is rolled back.

begin;

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
  if has_table_privilege('authenticated', 'private.background_job_provider_receipts', 'select')
     or has_table_privilege('service_role', 'private.background_job_provider_receipts', 'select') then
    raise exception 'provider receipts must be reachable only through verified reconciliation';
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
  if not exists (
    select 1
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'private'
      and relation.relname = 'background_job_provider_receipts'
      and relation.relrowsecurity
  ) then
    raise exception 'provider receipt row-level security is not enabled';
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
    v_job.id, 'sql-worker-one', v_claim.lease_token, 'running', 'generating', '{"percentComplete":50}'::jsonb
  );
  perform public.background_job_record_progress(
    v_job.id, 'sql-worker-one', v_claim.lease_token, 'finalising', 'finalising', '{"percentComplete":100}'::jsonb
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
    '{"progressCode":"missing_required_effect"}'::jsonb
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
    v_job.id, 'sql-shadow-worker', v_claim.lease_token, '{"resultCode":"shadow_validated"}'::jsonb
  );
end;
$$;

-- Shadow preparation has no provider identity or expiry window, so releasing
-- and reclaiming it must not enter provider reconciliation.
do $$
declare
  v_job public.background_jobs%rowtype;
  v_claim record;
begin
  select * into v_job
  from public.background_job_enqueue_system(
    'quote_send', 1, 'quote', '00000000-0000-4000-8000-000000000014', null,
    100::smallint, 'sql-test/quote/shadow-reclaim',
    '{"quoteVersionId":"00000000-0000-4000-8000-000000000014"}'::jsonb,
    now(), 'shadow', 'shadow', 'sql-test'
  );
  select * into strict v_claim
  from public.background_jobs_claim('sql-shadow-reclaim-worker-one', 1, 60);
  perform public.background_job_record_progress(
    v_job.id, 'sql-shadow-reclaim-worker-one', v_claim.lease_token,
    'running', 'validating_delivery', '{}'::jsonb
  );
  perform public.background_job_record_effect_checkpoint(
    v_job.id, 'sql-shadow-reclaim-worker-one', v_claim.lease_token,
    'email_dispatch', 'email_dispatch', 'prepared', repeat('d', 64),
    null, null, null, null, '{}'::jsonb
  );
  perform public.background_job_release_lease(
    v_job.id, 'sql-shadow-reclaim-worker-one', v_claim.lease_token
  );

  select * into strict v_claim
  from public.background_jobs_claim('sql-shadow-reclaim-worker-two', 1, 60);
  if v_claim.job_id <> v_job.id or v_claim.status <> 'claimed' then
    raise exception 'shadow prepared effect was not reclaimable without provider identity';
  end if;
  perform public.background_job_record_progress(
    v_job.id, 'sql-shadow-reclaim-worker-two', v_claim.lease_token,
    'running', 'validating_delivery', '{}'::jsonb
  );
  perform public.background_job_record_progress(
    v_job.id, 'sql-shadow-reclaim-worker-two', v_claim.lease_token,
    'finalising', 'shadow_validated', '{}'::jsonb
  );
  perform public.background_job_complete(
    v_job.id, 'sql-shadow-reclaim-worker-two', v_claim.lease_token,
    '{"resultCode":"shadow_validated"}'::jsonb
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

-- Provider acceptance survives process loss: a later worker obtains every
-- frozen effect field through the lease-fenced RPC before finalising.
do $$
declare
  v_job public.background_jobs%rowtype;
  v_claim record;
  v_recovered integer;
  v_provider_expiry timestamptz := now() + interval '1 hour';
begin
  select * into v_job
  from public.background_job_enqueue_system(
    'quote_send', 1, 'quote', '00000000-0000-4000-8000-000000000012', null,
    100::smallint, 'sql-test/quote/effect-restart',
    '{"quoteVersionId":"00000000-0000-4000-8000-000000000012"}'::jsonb,
    now(), 'worker_enabled', 'worker', 'sql-test'
  );
  select * into strict v_claim
  from public.background_jobs_claim('sql-effect-restart-worker-one', 1, 60);
  perform public.background_job_record_progress(
    v_job.id, 'sql-effect-restart-worker-one', v_claim.lease_token,
    'running', 'preparing_delivery', '{}'::jsonb
  );
  perform public.background_job_record_effect_checkpoint(
    v_job.id, 'sql-effect-restart-worker-one', v_claim.lease_token,
    'email_dispatch', 'email_dispatch', 'prepared', repeat('b', 64),
    'sql-provider', 'sql-test/quote/effect-restart', v_provider_expiry, null, '{}'::jsonb
  );
  perform public.background_job_record_effect_checkpoint(
    v_job.id, 'sql-effect-restart-worker-one', v_claim.lease_token,
    'email_dispatch', 'email_dispatch', 'dispatch_started', repeat('b', 64),
    'sql-provider', 'sql-test/quote/effect-restart', v_provider_expiry, null, '{}'::jsonb
  );
  perform public.background_job_record_effect_checkpoint(
    v_job.id, 'sql-effect-restart-worker-one', v_claim.lease_token,
    'email_dispatch', 'email_dispatch', 'provider_accepted', repeat('b', 64),
    'sql-provider', 'sql-test/quote/effect-restart', v_provider_expiry,
    'sql-provider-message-restart', '{}'::jsonb
  );

  update public.background_jobs
  set lease_expires_at = now() - interval '1 second'
  where id = v_job.id;
  v_recovered := public.background_jobs_recover_expired_leases(
    'sql-effect-restart-reconciler', 10
  );
  if v_recovered <> 1
     or (select status from public.background_jobs where id = v_job.id) <> 'provider_accepted'
     or (select lease_token from public.background_jobs where id = v_job.id) is not null then
    raise exception 'provider-accepted restart was not made resumable';
  end if;
end;
$$;

-- This block has no access to the first worker's local expiry or provider ID.
do $$
declare
  v_claim record;
  v_effect record;
  v_completed public.background_jobs%rowtype;
begin
  select * into strict v_claim
  from public.background_jobs_claim('sql-effect-restart-worker-two', 1, 60);
  if v_claim.status <> 'provider_accepted' then
    raise exception 'replacement worker did not resume provider-accepted work';
  end if;

  begin
    perform *
    from public.background_job_read_effects(
      v_claim.job_id,
      'sql-effect-restart-worker-two',
      gen_random_uuid()
    );
    raise exception 'effect snapshot accepted a stale lease token';
  exception when object_not_in_prerequisite_state then
    null;
  end;

  select * into strict v_effect
  from public.background_job_read_effects(
    v_claim.job_id,
    'sql-effect-restart-worker-two',
    v_claim.lease_token
  );
  if v_effect.state <> 'provider_accepted'
     or v_effect.provider_message_id <> 'sql-provider-message-restart'
     or v_effect.provider_idempotency_expires_at is null then
    raise exception 'replacement worker could not recover the frozen effect identity';
  end if;

  perform public.background_job_record_effect_checkpoint(
    v_claim.job_id, 'sql-effect-restart-worker-two', v_claim.lease_token,
    v_effect.effect_key, v_effect.effect_kind, 'finalised', v_effect.payload_hash,
    v_effect.provider_name, v_effect.provider_idempotency_key,
    v_effect.provider_idempotency_expires_at, v_effect.provider_message_id,
    v_effect.safe_metadata
  );
  perform public.background_job_record_progress(
    v_claim.job_id, 'sql-effect-restart-worker-two', v_claim.lease_token,
    'finalising', 'finalising_delivery', '{}'::jsonb
  );
  select * into strict v_completed
  from public.background_job_complete(
    v_claim.job_id,
    'sql-effect-restart-worker-two',
    v_claim.lease_token,
    '{"providerAccepted":true}'::jsonb
  );
  if v_completed.status <> 'succeeded' then
    raise exception 'replacement worker did not finalise the recovered effect';
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
  perform public.background_job_request_cancellation(v_queued.id, null, 'SQL_QUEUED_CANCELLATION');
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
  perform public.background_job_request_cancellation(v_claimed.id, null, 'SQL_CLAIMED_CANCELLATION');
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
    v_expired_cancelled.id, null, 'SQL_EXPIRED_CANCELLATION'
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

-- Expired leases remain autonomous while a frozen provider identity is live.
-- A dispatch crash becomes uncertain and reuses that same key; only expiry,
-- exhaustion, or an invariant failure may move it to provider attention.
do $$
declare
  v_retry_job public.background_jobs%rowtype;
  v_dispatch_job public.background_jobs%rowtype;
  v_claim_dispatch_job public.background_jobs%rowtype;
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
  perform public.background_job_request_cancellation(v_retry_job.id, null, 'SQL_RECOVERY_CLEANUP');

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
     or (select status from public.background_jobs where id = v_dispatch_job.id) <> 'retrying'
     or (select state from public.background_job_effects where job_id = v_dispatch_job.id and effect_key = 'email_dispatch') <> 'uncertain'
     or (select safe_metadata from public.background_job_effects where job_id = v_dispatch_job.id and effect_key = 'email_dispatch')
       <> jsonb_build_object(
         'effectKind', 'email_dispatch',
         'checkpoint', 'uncertain',
         'providerName', 'sql-provider'
       )
     or not private.background_job_queue_contains(v_dispatch_job.queue_message_id) then
    raise exception 'dispatching expired lease did not preserve same-key autonomous retry';
  end if;

  select * into strict v_claim from public.background_jobs_claim('sql-recover-worker-three', 1, 60);
  if v_claim.job_id <> v_dispatch_job.id or v_claim.status <> 'claimed' then
    raise exception 'recovered uncertain dispatch was not reclaimable';
  end if;
  if not exists (
    select 1
    from public.background_job_read_effects(
      v_dispatch_job.id,
      'sql-recover-worker-three',
      v_claim.lease_token
    ) effect
    where effect.state = 'uncertain'
      and effect.provider_idempotency_key = 'sql-test/recover/dispatch'
      and effect.provider_idempotency_expires_at = v_provider_expiry
  ) then
    raise exception 'recovered dispatch did not retain its exact frozen provider identity';
  end if;
  perform public.background_job_record_progress(
    v_dispatch_job.id,
    'sql-recover-worker-three',
    v_claim.lease_token,
    'running',
    'retrying_delivery',
    '{}'::jsonb
  );
  perform public.background_job_record_effect_checkpoint(
    v_dispatch_job.id,
    'sql-recover-worker-three',
    v_claim.lease_token,
    'email_dispatch',
    'email_dispatch',
    'dispatch_started',
    repeat('b', 64),
    'sql-provider',
    'sql-test/recover/dispatch',
    v_provider_expiry,
    null,
    '{}'::jsonb
  );
  if (select status from public.background_jobs where id = v_dispatch_job.id) <> 'dispatching'
     or (select state from public.background_job_effects where job_id = v_dispatch_job.id) <> 'dispatch_started' then
    raise exception 'same-key recovered dispatch did not re-enter dispatching';
  end if;
  perform public.background_job_mark_needs_attention(
    v_dispatch_job.id,
    'sql-recover-worker-three',
    v_claim.lease_token,
    'TEST_CLEANUP',
    'ignored raw test detail',
    '{"progressCode":"test_cleanup"}'::jsonb
  );

  select * into v_claim_dispatch_job
  from public.background_job_enqueue_system(
    'quote_send', 1, 'quote', '00000000-0000-4000-8000-000000000015', null,
    100::smallint, 'sql-test/recover/dispatch-during-claim', '{}'::jsonb,
    now(), 'worker_enabled', 'worker', 'sql-test'
  );
  select * into strict v_claim from public.background_jobs_claim('sql-claim-recover-worker-one', 1, 60);
  perform public.background_job_record_progress(
    v_claim_dispatch_job.id,
    'sql-claim-recover-worker-one',
    v_claim.lease_token,
    'running',
    'preparing_delivery',
    '{}'::jsonb
  );
  perform public.background_job_record_effect_checkpoint(
    v_claim_dispatch_job.id,
    'sql-claim-recover-worker-one',
    v_claim.lease_token,
    'email_dispatch',
    'email_dispatch',
    'prepared',
    repeat('e', 64),
    'sql-provider',
    'sql-test/recover/dispatch-during-claim',
    v_provider_expiry,
    null,
    '{}'::jsonb
  );
  perform public.background_job_record_effect_checkpoint(
    v_claim_dispatch_job.id,
    'sql-claim-recover-worker-one',
    v_claim.lease_token,
    'email_dispatch',
    'email_dispatch',
    'dispatch_started',
    repeat('e', 64),
    'sql-provider',
    'sql-test/recover/dispatch-during-claim',
    v_provider_expiry,
    null,
    '{}'::jsonb
  );
  update public.background_jobs
  set lease_expires_at = now() - interval '1 second'
  where id = v_claim_dispatch_job.id;
  perform pgmq.set_vt('portal_background_jobs', v_claim_dispatch_job.queue_message_id, 0);

  select * into strict v_claim from public.background_jobs_claim('sql-claim-recover-worker-two', 1, 60);
  if v_claim.job_id <> v_claim_dispatch_job.id
     or v_claim.status <> 'claimed'
     or (select state from public.background_job_effects where job_id = v_claim_dispatch_job.id) <> 'uncertain'
     or (select safe_metadata from public.background_job_effects where job_id = v_claim_dispatch_job.id)
       <> jsonb_build_object(
         'effectKind', 'email_dispatch',
         'checkpoint', 'uncertain',
         'providerName', 'sql-provider'
       ) then
    raise exception 'claim-time dispatch recovery did not autonomously reclaim the same effect';
  end if;
  perform public.background_job_mark_needs_attention(
    v_claim_dispatch_job.id,
    'sql-claim-recover-worker-two',
    v_claim.lease_token,
    'TEST_CLEANUP',
    'ignored raw test detail',
    '{"progressCode":"test_cleanup"}'::jsonb
  );
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

  perform public.background_job_request_cancellation(v_job.id, null, 'SQL_RECONCILIATION_CLEANUP');
end;
$$;

-- Expired provider-idempotency windows can never re-enter automatic work via
-- graceful release, delayed claim, or expired-lease recovery.
do $$
declare
  v_job public.background_jobs%rowtype;
  v_claim record;
  v_claim_count integer;
  v_message_id bigint;
  v_recovered integer;
  v_provider_expiry timestamptz := now() + interval '1 hour';
begin
  select * into v_job
  from public.background_job_enqueue_system(
    'quote_send', 1, 'quote', '00000000-0000-4000-8000-000000000031', null,
    0::smallint, 'sql-test/idempotency-expiry/release', '{}'::jsonb,
    now(), 'worker_enabled', 'worker', 'sql-test'
  );
  select * into strict v_claim from public.background_jobs_claim('sql-expiry-release-worker', 1, 60);
  perform public.background_job_record_progress(
    v_job.id, 'sql-expiry-release-worker', v_claim.lease_token,
    'running', 'preparing_delivery', '{}'::jsonb
  );
  perform public.background_job_record_effect_checkpoint(
    v_job.id, 'sql-expiry-release-worker', v_claim.lease_token,
    'email_dispatch', 'email_dispatch', 'prepared', repeat('f', 64),
    'sql-provider', 'sql-test/idempotency-expiry/release', v_provider_expiry, null, '{}'::jsonb
  );
  alter table public.background_job_effects disable trigger background_job_effects_before_update_trigger;
  update public.background_job_effects
  set provider_idempotency_expires_at = now() - interval '1 second'
  where job_id = v_job.id;
  alter table public.background_job_effects enable trigger background_job_effects_before_update_trigger;

  perform public.background_job_release_lease(v_job.id, 'sql-expiry-release-worker', v_claim.lease_token);
  if (select status from public.background_jobs where id = v_job.id) <> 'needs_attention'
     or (select error_code from public.background_jobs where id = v_job.id) <> 'PROVIDER_IDEMPOTENCY_WINDOW_EXPIRED'
     or (select lease_token from public.background_jobs where id = v_job.id) is not null
     or private.background_job_queue_contains(v_job.queue_message_id) then
    raise exception 'expired provider window escaped through lease release';
  end if;

  select * into v_job
  from public.background_job_enqueue_system(
    'quote_send', 1, 'quote', '00000000-0000-4000-8000-000000000032', null,
    0::smallint, 'sql-test/idempotency-expiry/delayed-claim', '{}'::jsonb,
    now(), 'worker_enabled', 'worker', 'sql-test'
  );
  select * into strict v_claim from public.background_jobs_claim('sql-expiry-claim-worker-one', 1, 60);
  perform public.background_job_record_progress(
    v_job.id, 'sql-expiry-claim-worker-one', v_claim.lease_token,
    'running', 'preparing_delivery', '{}'::jsonb
  );
  perform public.background_job_record_effect_checkpoint(
    v_job.id, 'sql-expiry-claim-worker-one', v_claim.lease_token,
    'email_dispatch', 'email_dispatch', 'prepared', repeat('1', 64),
    'sql-provider', 'sql-test/idempotency-expiry/delayed-claim', v_provider_expiry, null, '{}'::jsonb
  );
  perform public.background_job_record_effect_checkpoint(
    v_job.id, 'sql-expiry-claim-worker-one', v_claim.lease_token,
    'email_dispatch', 'email_dispatch', 'dispatch_started', repeat('1', 64),
    'sql-provider', 'sql-test/idempotency-expiry/delayed-claim', v_provider_expiry, null, '{}'::jsonb
  );
  perform public.background_job_record_effect_checkpoint(
    v_job.id, 'sql-expiry-claim-worker-one', v_claim.lease_token,
    'email_dispatch', 'email_dispatch', 'failed', repeat('1', 64),
    'sql-provider', 'sql-test/idempotency-expiry/delayed-claim', v_provider_expiry, null, '{}'::jsonb
  );
  perform public.background_job_schedule_retry(
    v_job.id, 'sql-expiry-claim-worker-one', v_claim.lease_token,
    1, 'PROVIDER_RETRY', 'raw provider detail must be ignored'
  );
  select queue_message_id into strict v_message_id from public.background_jobs where id = v_job.id;
  update public.background_jobs set next_attempt_at = now() where id = v_job.id;
  perform pgmq.set_vt('portal_background_jobs', v_message_id, 0);
  alter table public.background_job_effects disable trigger background_job_effects_before_update_trigger;
  update public.background_job_effects
  set provider_idempotency_expires_at = now() - interval '1 second'
  where job_id = v_job.id;
  alter table public.background_job_effects enable trigger background_job_effects_before_update_trigger;

  select count(*) into v_claim_count
  from public.background_jobs_claim('sql-expiry-claim-worker-two', 1, 60);
  if v_claim_count <> 0
     or (select status from public.background_jobs where id = v_job.id) <> 'needs_attention'
     or (select error_code from public.background_jobs where id = v_job.id) <> 'PROVIDER_IDEMPOTENCY_WINDOW_EXPIRED'
     or private.background_job_queue_contains(v_message_id) then
    raise exception 'delayed claim resurrected an expired provider effect';
  end if;

  select * into v_job
  from public.background_job_enqueue_system(
    'quote_send', 1, 'quote', '00000000-0000-4000-8000-000000000033', null,
    0::smallint, 'sql-test/idempotency-expiry/max-uncertain', '{}'::jsonb,
    now(), 'worker_enabled', 'worker', 'sql-test'
  );
  select * into strict v_claim from public.background_jobs_claim('sql-uncertain-worker-one', 1, 60);
  perform public.background_job_record_progress(
    v_job.id, 'sql-uncertain-worker-one', v_claim.lease_token,
    'running', 'preparing_delivery', '{}'::jsonb
  );
  perform public.background_job_record_effect_checkpoint(
    v_job.id, 'sql-uncertain-worker-one', v_claim.lease_token,
    'email_dispatch', 'email_dispatch', 'prepared', repeat('2', 64),
    'sql-provider', 'sql-test/idempotency-expiry/max-uncertain', v_provider_expiry, null, '{}'::jsonb
  );
  perform public.background_job_record_effect_checkpoint(
    v_job.id, 'sql-uncertain-worker-one', v_claim.lease_token,
    'email_dispatch', 'email_dispatch', 'dispatch_started', repeat('2', 64),
    'sql-provider', 'sql-test/idempotency-expiry/max-uncertain', v_provider_expiry, null, '{}'::jsonb
  );
  perform public.background_job_record_effect_checkpoint(
    v_job.id, 'sql-uncertain-worker-one', v_claim.lease_token,
    'email_dispatch', 'email_dispatch', 'uncertain', repeat('2', 64),
    'sql-provider', 'sql-test/idempotency-expiry/max-uncertain', v_provider_expiry, null, '{}'::jsonb
  );
  perform public.background_job_schedule_retry(
    v_job.id, 'sql-uncertain-worker-one', v_claim.lease_token,
    1, 'PROVIDER_TIMEOUT', 'raw provider detail must be ignored'
  );
  select queue_message_id into strict v_message_id from public.background_jobs where id = v_job.id;
  update public.background_jobs
  set attempt_count = max_attempts - 1,
      next_attempt_at = now()
  where id = v_job.id;
  perform pgmq.set_vt('portal_background_jobs', v_message_id, 0);
  select * into strict v_claim from public.background_jobs_claim('sql-uncertain-worker-two', 1, 60);
  perform public.background_job_record_progress(
    v_job.id, 'sql-uncertain-worker-two', v_claim.lease_token,
    'running', 'preparing_retry', '{}'::jsonb
  );
  select queue_message_id into strict v_message_id
  from public.background_jobs where id = v_job.id;
  update public.background_jobs
  set lease_expires_at = now() - interval '1 second'
  where id = v_job.id;
  perform pgmq.set_vt('portal_background_jobs', v_message_id, 0);
  select count(*) into v_claim_count
  from public.background_jobs_claim('sql-uncertain-worker-three', 1, 60);
  if v_claim_count <> 0
     or (select status from public.background_jobs where id = v_job.id) <> 'needs_attention'
     or (select error_code from public.background_jobs where id = v_job.id) <> 'PROVIDER_OUTCOME_UNCERTAIN'
     or (select state from public.background_job_effects where job_id = v_job.id) <> 'uncertain'
     or private.background_job_queue_contains(v_message_id)
     or not exists (
       select 1 from public.background_job_events event
       where event.job_id = v_job.id and event.event_type = 'lease_expired'
     )
     or exists (
       select 1 from public.background_job_events event
       where event.job_id = v_job.id and event.event_type = 'permanent_failed'
     ) then
    raise exception 'max-attempt uncertain effect was hidden as permanent failure';
  end if;
end;
$$;

-- A cooperative retry can absorb a lost outcome-checkpoint write only when
-- one live frozen provider identity is unambiguous. The effect transition and
-- queue visibility change must commit together; every unsafe boundary leaves
-- the live lease and dispatch_started checkpoint unchanged for reconciliation.
do $$
declare
  v_job public.background_jobs%rowtype;
  v_retry_job public.background_jobs%rowtype;
  v_claim record;
  v_provider_expiry timestamptz := now() + interval '1 hour';
  v_expired_provider_identity_at timestamptz := now() - interval '1 second';
  v_lease_token uuid;
  v_message_id bigint;
begin
  select * into v_job
  from public.background_job_enqueue_system(
    'quote_send', 1, 'quote', '00000000-0000-4000-8000-000000000035', null,
    0::smallint, 'sql-test/provider-retry/lost-checkpoint', '{}'::jsonb,
    now(), 'worker_enabled', 'worker', 'sql-test'
  );
  select * into strict v_claim
  from public.background_jobs_claim('sql-provider-retry-worker-one', 1, 60);
  perform public.background_job_record_progress(
    v_job.id, 'sql-provider-retry-worker-one', v_claim.lease_token,
    'running', 'preparing_delivery', '{}'::jsonb
  );
  perform public.background_job_record_effect_checkpoint(
    v_job.id, 'sql-provider-retry-worker-one', v_claim.lease_token,
    'email_dispatch', 'email_dispatch', 'prepared', repeat('3', 64),
    'resend', 'sql-test/provider-retry/lost-checkpoint', v_provider_expiry,
    null, '{}'::jsonb
  );
  perform public.background_job_record_effect_checkpoint(
    v_job.id, 'sql-provider-retry-worker-one', v_claim.lease_token,
    'email_dispatch', 'email_dispatch', 'dispatch_started', repeat('3', 64),
    'resend', 'sql-test/provider-retry/lost-checkpoint', v_provider_expiry,
    null, '{}'::jsonb
  );
  select * into strict v_retry_job
  from public.background_job_schedule_retry(
    v_job.id,
    'sql-provider-retry-worker-one',
    v_claim.lease_token,
    1,
    'PROVIDER_TIMEOUT',
    'ignored raw provider detail'
  );
  if v_retry_job.status <> 'retrying'
     or v_retry_job.current_phase <> 'provider_retry'
     or v_retry_job.lease_token is not null
     or (select state from public.background_job_effects where job_id = v_job.id) <> 'uncertain'
     or (select safe_metadata from public.background_job_effects where job_id = v_job.id)
       <> jsonb_build_object(
         'effectKind', 'email_dispatch',
         'checkpoint', 'uncertain',
         'providerName', 'resend'
       )
     or (select provider_idempotency_key from public.background_job_effects where job_id = v_job.id)
       <> 'sql-test/provider-retry/lost-checkpoint'
     or not private.background_job_queue_contains(v_retry_job.queue_message_id) then
    raise exception 'lost provider outcome checkpoint did not schedule an atomic same-key retry';
  end if;
  update public.background_jobs set next_attempt_at = now() where id = v_job.id;
  perform pgmq.set_vt('portal_background_jobs', v_retry_job.queue_message_id, 0);
  select * into strict v_claim
  from public.background_jobs_claim('sql-provider-retry-worker-two', 1, 60);
  if v_claim.job_id <> v_job.id or v_claim.status <> 'claimed'
     or not exists (
       select 1
       from public.background_job_read_effects(
         v_job.id,
         'sql-provider-retry-worker-two',
         v_claim.lease_token
       ) effect
       where effect.state = 'uncertain'
         and effect.provider_idempotency_key = 'sql-test/provider-retry/lost-checkpoint'
         and effect.provider_idempotency_expires_at = v_provider_expiry
     ) then
    raise exception 'same-key cooperative retry was not reclaimable with its frozen identity';
  end if;
  perform public.background_job_mark_needs_attention(
    v_job.id, 'sql-provider-retry-worker-two', v_claim.lease_token,
    'TEST_CLEANUP', 'ignored raw test detail', '{"progressCode":"test_cleanup"}'::jsonb
  );

  -- A hard crash can happen after the handler durably records the retryable
  -- outcome but before executeJob schedules its retry. The next claimant must
  -- treat that one existing uncertain checkpoint exactly like a started call
  -- whose local outcome write was lost, preserving the same provider key.
  select * into v_job
  from public.background_job_enqueue_system(
    'quote_send', 1, 'quote', '00000000-0000-4000-8000-000000000044', null,
    0::smallint, 'sql-test/provider-retry/checkpoint-before-schedule-crash', '{}'::jsonb,
    now(), 'worker_enabled', 'worker', 'sql-test'
  );
  select * into strict v_claim
  from public.background_jobs_claim('sql-provider-checkpoint-crash-one', 1, 60);
  perform public.background_job_record_progress(
    v_job.id, 'sql-provider-checkpoint-crash-one', v_claim.lease_token,
    'running', 'preparing_delivery', '{}'::jsonb
  );
  perform public.background_job_record_effect_checkpoint(
    v_job.id, 'sql-provider-checkpoint-crash-one', v_claim.lease_token,
    'email_dispatch', 'email_dispatch', 'prepared', repeat('c', 64),
    'resend', 'sql-test/provider-retry/checkpoint-before-schedule-crash', v_provider_expiry,
    null, '{}'::jsonb
  );
  perform public.background_job_record_effect_checkpoint(
    v_job.id, 'sql-provider-checkpoint-crash-one', v_claim.lease_token,
    'email_dispatch', 'email_dispatch', 'dispatch_started', repeat('c', 64),
    'resend', 'sql-test/provider-retry/checkpoint-before-schedule-crash', v_provider_expiry,
    null, '{}'::jsonb
  );
  perform public.background_job_record_effect_checkpoint(
    v_job.id, 'sql-provider-checkpoint-crash-one', v_claim.lease_token,
    'email_dispatch', 'email_dispatch', 'uncertain', repeat('c', 64),
    'resend', 'sql-test/provider-retry/checkpoint-before-schedule-crash', v_provider_expiry,
    null, jsonb_build_object(
      'effectKind', 'email_dispatch',
      'checkpoint', 'uncertain',
      'providerName', 'resend'
    )
  );
  select queue_message_id into strict v_message_id
  from public.background_jobs where id = v_job.id;
  update public.background_jobs
  set lease_expires_at = now() - interval '1 second'
  where id = v_job.id;
  perform pgmq.set_vt('portal_background_jobs', v_message_id, 0);

  select * into strict v_claim
  from public.background_jobs_claim('sql-provider-checkpoint-crash-two', 1, 60);
  if v_claim.job_id <> v_job.id
     or v_claim.status <> 'claimed'
     or (select state from public.background_job_effects where job_id = v_job.id) <> 'uncertain'
     or (select provider_idempotency_key from public.background_job_effects where job_id = v_job.id)
       <> 'sql-test/provider-retry/checkpoint-before-schedule-crash'
     or (select error_code from public.background_jobs where id = v_job.id) = 'PROVIDER_EFFECT_INVARIANT' then
    raise exception 'crash after retryable checkpoint did not preserve same-key automatic recovery';
  end if;
  perform public.background_job_mark_needs_attention(
    v_job.id, 'sql-provider-checkpoint-crash-two', v_claim.lease_token,
    'TEST_CLEANUP', 'ignored raw test detail', '{"progressCode":"test_cleanup"}'::jsonb
  );

  -- Missing durable provider checkpoint.
  select * into v_job
  from public.background_job_enqueue_system(
    'quote_send', 1, 'quote', '00000000-0000-4000-8000-000000000036', null,
    0::smallint, 'sql-test/provider-retry/missing-checkpoint', '{}'::jsonb,
    now(), 'worker_enabled', 'worker', 'sql-test'
  );
  select * into strict v_claim
  from public.background_jobs_claim('sql-provider-retry-missing', 1, 60);
  perform public.background_job_record_progress(
    v_job.id, 'sql-provider-retry-missing', v_claim.lease_token,
    'running', 'preparing_delivery', '{}'::jsonb
  );
  update public.background_jobs
  set status = 'dispatching', current_phase = 'provider_dispatch'
  where id = v_job.id;
  v_lease_token := v_claim.lease_token;
  begin
    perform public.background_job_schedule_retry(
      v_job.id, 'sql-provider-retry-missing', v_claim.lease_token,
      1, 'PROVIDER_TIMEOUT', 'ignored raw provider detail'
    );
    raise exception 'missing dispatch checkpoint was accepted for cooperative retry';
  exception when invalid_parameter_value then
    null;
  end;
  if (select status from public.background_jobs where id = v_job.id) <> 'dispatching'
     or (select lease_token from public.background_jobs where id = v_job.id) <> v_lease_token
     or exists (select 1 from public.background_job_effects where job_id = v_job.id) then
    raise exception 'missing dispatch checkpoint retry rejection was not atomic';
  end if;
  perform public.background_job_mark_needs_attention(
    v_job.id, 'sql-provider-retry-missing', v_claim.lease_token,
    'TEST_CLEANUP', 'ignored raw test detail', '{"progressCode":"test_cleanup"}'::jsonb
  );

  -- Ambiguous durable provider checkpoints.
  select * into v_job
  from public.background_job_enqueue_system(
    'quote_send', 1, 'quote', '00000000-0000-4000-8000-000000000037', null,
    0::smallint, 'sql-test/provider-retry/ambiguous-checkpoint', '{}'::jsonb,
    now(), 'worker_enabled', 'worker', 'sql-test'
  );
  select * into strict v_claim
  from public.background_jobs_claim('sql-provider-retry-ambiguous', 1, 60);
  perform public.background_job_record_progress(
    v_job.id, 'sql-provider-retry-ambiguous', v_claim.lease_token,
    'running', 'preparing_delivery', '{}'::jsonb
  );
  perform public.background_job_record_effect_checkpoint(
    v_job.id, 'sql-provider-retry-ambiguous', v_claim.lease_token,
    'email_dispatch', 'email_dispatch', 'prepared', repeat('8', 64),
    'resend', 'sql-test/provider-retry/ambiguous-one', v_provider_expiry,
    null, '{}'::jsonb
  );
  perform public.background_job_record_effect_checkpoint(
    v_job.id, 'sql-provider-retry-ambiguous', v_claim.lease_token,
    'email_dispatch', 'email_dispatch', 'dispatch_started', repeat('8', 64),
    'resend', 'sql-test/provider-retry/ambiguous-one', v_provider_expiry,
    null, '{}'::jsonb
  );
  insert into public.background_job_effects (
    job_id,
    effect_key,
    effect_kind,
    state,
    payload_hash,
    provider_name,
    provider_idempotency_key,
    provider_idempotency_expires_at,
    dispatch_started_at,
    safe_metadata
  )
  values (
    v_job.id,
    'ambiguous_dispatch',
    'ambiguous_dispatch',
    'dispatch_started',
    repeat('9', 64),
    'resend',
    'sql-test/provider-retry/ambiguous-two',
    v_provider_expiry,
    now(),
    '{}'::jsonb
  );
  begin
    perform public.background_job_schedule_retry(
      v_job.id, 'sql-provider-retry-ambiguous', v_claim.lease_token,
      1, 'PROVIDER_TIMEOUT', 'ignored raw provider detail'
    );
    raise exception 'multiple dispatch checkpoints were accepted for cooperative retry';
  exception when invalid_parameter_value then
    null;
  end;
  if (select count(*) from public.background_job_effects where job_id = v_job.id and state = 'dispatch_started') <> 2
     or (select lease_token from public.background_jobs where id = v_job.id) <> v_claim.lease_token then
    raise exception 'multiple dispatch checkpoint retry rejection was not atomic';
  end if;
  perform public.background_job_mark_needs_attention(
    v_job.id, 'sql-provider-retry-ambiguous', v_claim.lease_token,
    'TEST_CLEANUP', 'ignored raw test detail', '{"progressCode":"test_cleanup"}'::jsonb
  );

  -- Expired frozen provider identity.
  select * into v_job
  from public.background_job_enqueue_system(
    'quote_send', 1, 'quote', '00000000-0000-4000-8000-000000000038', null,
    0::smallint, 'sql-test/provider-retry/expired', '{}'::jsonb,
    now(), 'worker_enabled', 'worker', 'sql-test'
  );
  select * into strict v_claim
  from public.background_jobs_claim('sql-provider-retry-expired', 1, 60);
  perform public.background_job_record_progress(
    v_job.id, 'sql-provider-retry-expired', v_claim.lease_token,
    'running', 'preparing_delivery', '{}'::jsonb
  );
  perform public.background_job_record_effect_checkpoint(
    v_job.id, 'sql-provider-retry-expired', v_claim.lease_token,
    'email_dispatch', 'email_dispatch', 'prepared', repeat('a', 64),
    'resend', 'sql-test/provider-retry/expired', v_provider_expiry,
    null, '{}'::jsonb
  );
  perform public.background_job_record_effect_checkpoint(
    v_job.id, 'sql-provider-retry-expired', v_claim.lease_token,
    'email_dispatch', 'email_dispatch', 'dispatch_started', repeat('a', 64),
    'resend', 'sql-test/provider-retry/expired', v_provider_expiry,
    null, '{}'::jsonb
  );
  alter table public.background_job_effects disable trigger background_job_effects_before_update_trigger;
  update public.background_job_effects
  set provider_idempotency_expires_at = v_expired_provider_identity_at
  where job_id = v_job.id;
  alter table public.background_job_effects enable trigger background_job_effects_before_update_trigger;
  begin
    perform public.background_job_schedule_retry(
      v_job.id, 'sql-provider-retry-expired', v_claim.lease_token,
      1, 'PROVIDER_TIMEOUT', 'ignored raw provider detail'
    );
    raise exception 'expired dispatch identity was accepted for cooperative retry';
  exception when invalid_parameter_value then
    null;
  end;
  if (select state from public.background_job_effects where job_id = v_job.id) <> 'dispatch_started'
     or (select status from public.background_jobs where id = v_job.id) <> 'dispatching'
     or (select lease_token from public.background_jobs where id = v_job.id) <> v_claim.lease_token then
    raise exception 'expired dispatch identity retry rejection was not atomic';
  end if;
  perform public.background_job_mark_needs_attention(
    v_job.id, 'sql-provider-retry-expired', v_claim.lease_token,
    'TEST_CLEANUP', 'ignored raw test detail', '{"progressCode":"test_cleanup"}'::jsonb
  );

  -- Exhausted attempt budget.
  select * into v_job
  from public.background_job_enqueue_system(
    'quote_send', 1, 'quote', '00000000-0000-4000-8000-000000000039', null,
    0::smallint, 'sql-test/provider-retry/exhausted', '{}'::jsonb,
    now(), 'worker_enabled', 'worker', 'sql-test'
  );
  select * into strict v_claim
  from public.background_jobs_claim('sql-provider-retry-exhausted', 1, 60);
  perform public.background_job_record_progress(
    v_job.id, 'sql-provider-retry-exhausted', v_claim.lease_token,
    'running', 'preparing_delivery', '{}'::jsonb
  );
  perform public.background_job_record_effect_checkpoint(
    v_job.id, 'sql-provider-retry-exhausted', v_claim.lease_token,
    'email_dispatch', 'email_dispatch', 'prepared', repeat('b', 64),
    'resend', 'sql-test/provider-retry/exhausted', v_provider_expiry,
    null, '{}'::jsonb
  );
  perform public.background_job_record_effect_checkpoint(
    v_job.id, 'sql-provider-retry-exhausted', v_claim.lease_token,
    'email_dispatch', 'email_dispatch', 'dispatch_started', repeat('b', 64),
    'resend', 'sql-test/provider-retry/exhausted', v_provider_expiry,
    null, '{}'::jsonb
  );
  update public.background_jobs
  set attempt_count = max_attempts
  where id = v_job.id;
  begin
    perform public.background_job_schedule_retry(
      v_job.id, 'sql-provider-retry-exhausted', v_claim.lease_token,
      1, 'PROVIDER_TIMEOUT', 'ignored raw provider detail'
    );
    raise exception 'exhausted dispatch was accepted for cooperative retry';
  exception when invalid_parameter_value then
    null;
  end;
  if (select state from public.background_job_effects where job_id = v_job.id) <> 'dispatch_started'
     or (select status from public.background_jobs where id = v_job.id) <> 'dispatching'
     or (select lease_token from public.background_jobs where id = v_job.id) <> v_claim.lease_token then
    raise exception 'exhausted dispatch retry rejection was not atomic';
  end if;
  perform public.background_job_mark_needs_attention(
    v_job.id, 'sql-provider-retry-exhausted', v_claim.lease_token,
    'TEST_CLEANUP', 'ignored raw test detail', '{"progressCode":"test_cleanup"}'::jsonb
  );
end;
$$;

-- A verified Resend acceptance is durable independently of the worker lease.
-- It preserves a live claimant, repairs an archived canonical message when the
-- claimant is gone, survives the local idempotency-window expiry, rejects
-- provider-message collisions, and rolls back the effect when queue repair
-- cannot be committed in the same transaction.
do $$
declare
  v_live_job public.background_jobs%rowtype;
  v_attention_job public.background_jobs%rowtype;
  v_rollback_job public.background_jobs%rowtype;
  v_collision_job public.background_jobs%rowtype;
  v_claim record;
  v_live_effect_id uuid;
  v_live_lease_token uuid;
  v_live_lease_expires_at timestamptz;
  v_live_queue_message_id bigint;
  v_attention_original_message_id bigint;
  v_attention_replacement_message_id bigint;
  v_rollback_original_message_id bigint;
  v_provider_expiry timestamptz := now() + interval '1 hour';
  v_expired_provider_identity_at timestamptz := now() - interval '1 second';
  v_live_event_created_at timestamptz := clock_timestamp();
  v_attention_event_created_at timestamptz := clock_timestamp();
  v_rollback_event_created_at timestamptz := clock_timestamp();
  v_collision_event_created_at timestamptz := clock_timestamp();
  v_live_effect_ref text;
  v_attention_effect_ref text;
  v_rollback_effect_ref text;
  v_collision_effect_ref text;
  v_outcome text;
  v_queue_message jsonb;
  v_receipt_count integer;
  v_queue_failure_observed boolean := false;
begin
  -- The callback may race the worker immediately after the provider accepted
  -- the request. Acceptance must update the durable effect but must not fence
  -- the worker that still owns a live lease.
  select * into v_live_job
  from public.background_job_enqueue_system(
    'quote_send', 1, 'quote', '00000000-0000-4000-8000-000000000040', null,
    0::smallint, 'sql-test/provider-webhook/live-lease', '{}'::jsonb,
    now(), 'worker_enabled', 'worker', 'sql-test'
  );
  select * into strict v_claim
  from public.background_jobs_claim('sql-provider-live-worker', 1, 60);
  perform public.background_job_record_progress(
    v_live_job.id, 'sql-provider-live-worker', v_claim.lease_token,
    'running', 'preparing_delivery', '{}'::jsonb
  );
  perform public.background_job_record_effect_checkpoint(
    v_live_job.id, 'sql-provider-live-worker', v_claim.lease_token,
    'email_dispatch', 'email_dispatch', 'prepared', repeat('4', 64),
    'resend', 'sql-test/provider-webhook/live-lease', v_provider_expiry,
    null, '{}'::jsonb
  );
  perform public.background_job_record_effect_checkpoint(
    v_live_job.id, 'sql-provider-live-worker', v_claim.lease_token,
    'email_dispatch', 'email_dispatch', 'dispatch_started', repeat('4', 64),
    'resend', 'sql-test/provider-webhook/live-lease', v_provider_expiry,
    null, '{}'::jsonb
  );
  select effect.id,
         private.background_job_provider_effect_ref(
           effect.provider_name,
           effect.provider_idempotency_key
         )
  into strict v_live_effect_id, v_live_effect_ref
  from public.background_job_effects effect
  where effect.job_id = v_live_job.id
    and effect.effect_kind = 'email_dispatch';
  select job.lease_token, job.lease_expires_at, job.queue_message_id
  into strict v_live_lease_token, v_live_lease_expires_at, v_live_queue_message_id
  from public.background_jobs job
  where job.id = v_live_job.id;

  v_outcome := public.background_job_reconcile_verified_provider_acceptance(
    'resend',
    'evt_sql_provider_live_lease',
    'email.sent',
    'resend-message-live-one',
    v_live_event_created_at,
    v_live_job.id,
    v_live_effect_ref
  );
  if v_outcome <> 'accepted'
     or (select status from public.background_jobs where id = v_live_job.id) <> 'provider_accepted'
     or (select lease_token from public.background_jobs where id = v_live_job.id) <> v_live_lease_token
     or (select lease_expires_at from public.background_jobs where id = v_live_job.id) <> v_live_lease_expires_at
     or (select queue_message_id from public.background_jobs where id = v_live_job.id) <> v_live_queue_message_id
     or (select state from public.background_job_effects where id = v_live_effect_id) <> 'provider_accepted'
     or (select provider_message_id from public.background_job_effects where id = v_live_effect_id) <> 'resend-message-live-one'
     or (select safe_metadata from public.background_job_effects where id = v_live_effect_id)
       <> jsonb_build_object(
         'effectKind', 'email_dispatch',
         'checkpoint', 'provider_accepted',
         'providerName', 'resend',
         'providerAccepted', true
       ) then
    raise exception 'verified provider acceptance did not preserve the live lease with exact canonical metadata';
  end if;
  if not exists (
    select 1
    from private.background_job_provider_receipts receipt
    where receipt.provider_name = 'resend'
      and receipt.provider_event_id = 'evt_sql_provider_live_lease'
      and receipt.reconciliation_outcome = 'accepted'
      and receipt.matched_job_id = v_live_job.id
      and receipt.matched_effect_id = v_live_effect_id
  ) then
    raise exception 'verified provider acceptance did not append its minimal matched receipt';
  end if;

  begin
    perform public.background_job_mark_needs_attention(
      v_live_job.id,
      'sql-provider-live-worker',
      v_live_lease_token,
      'PROVIDER_OUTCOME_UNCERTAIN',
      'ignored raw provider detail',
      '{"progressCode":"provider_timeout"}'::jsonb
    );
    raise exception 'terminal classification overwrote verified provider acceptance';
  exception when serialization_failure then
    null;
  end;
  if (select status from public.background_jobs where id = v_live_job.id) <> 'provider_accepted'
     or (select lease_token from public.background_jobs where id = v_live_job.id) <> v_live_lease_token
     or (select state from public.background_job_effects where id = v_live_effect_id) <> 'provider_accepted'
     or not private.background_job_queue_contains(v_live_queue_message_id) then
    raise exception 'webhook acceptance did not win atomically over Needs attention';
  end if;

  v_outcome := public.background_job_reconcile_verified_provider_acceptance(
    'resend',
    'evt_sql_provider_live_lease',
    'email.sent',
    'resend-message-live-one',
    v_live_event_created_at,
    v_live_job.id,
    v_live_effect_ref
  );
  select count(*) into v_receipt_count
  from private.background_job_provider_receipts receipt
  where receipt.provider_name = 'resend'
    and receipt.provider_event_id = 'evt_sql_provider_live_lease';
  if v_outcome <> 'duplicate' or v_receipt_count <> 1 then
    raise exception 'exact duplicate provider event was not idempotent';
  end if;

  begin
    perform public.background_job_reconcile_verified_provider_acceptance(
      'resend',
      'evt_sql_provider_live_lease',
      'email.sent',
      'resend-message-live-changed',
      v_live_event_created_at,
      v_live_job.id,
      v_live_effect_ref
    );
    raise exception 'provider event ID reuse accepted changed event content';
  exception when unique_violation then
    null;
  end;
  if (select provider_message_id from public.background_job_effects where id = v_live_effect_id)
       <> 'resend-message-live-one' then
    raise exception 'changed duplicate provider event mutated the accepted effect';
  end if;

  -- The worker sees the same canonical acceptance and can safely finish its
  -- local finalisation without issuing another provider request.
  perform public.background_job_record_effect_checkpoint(
    v_live_job.id, 'sql-provider-live-worker', v_live_lease_token,
    'email_dispatch', 'email_dispatch', 'provider_accepted', repeat('4', 64),
    'resend', 'sql-test/provider-webhook/live-lease', v_provider_expiry,
    'resend-message-live-one',
    jsonb_build_object(
      'effectKind', 'email_dispatch',
      'checkpoint', 'provider_accepted',
      'providerName', 'resend',
      'providerAccepted', true
    )
  );
  perform public.background_job_record_effect_checkpoint(
    v_live_job.id, 'sql-provider-live-worker', v_live_lease_token,
    'email_dispatch', 'email_dispatch', 'finalised', repeat('4', 64),
    'resend', 'sql-test/provider-webhook/live-lease', v_provider_expiry,
    'resend-message-live-one',
    jsonb_build_object(
      'effectKind', 'email_dispatch',
      'checkpoint', 'finalised',
      'providerName', 'resend',
      'providerAccepted', true
    )
  );

  -- A second signed callback can arrive after the idempotent business
  -- finaliser committed but before the runtime advances the job itself to
  -- finalising. It is compatible evidence, not a provider conflict, and must
  -- preserve the live lease. If the worker then crashes, normal lease recovery
  -- wakes the same finalised effect without replaying provider delivery.
  v_outcome := public.background_job_reconcile_verified_provider_acceptance(
    'resend',
    'evt_sql_provider_after_effect_finalised',
    'email.sent',
    'resend-message-live-one',
    clock_timestamp(),
    v_live_job.id,
    v_live_effect_ref
  );
  if v_outcome <> 'already_accepted'
     or (select status from public.background_jobs where id = v_live_job.id) <> 'provider_accepted'
     or (select lease_token from public.background_jobs where id = v_live_job.id) <> v_live_lease_token
     or (select state from public.background_job_effects where id = v_live_effect_id) <> 'finalised'
     or not exists (
       select 1
       from private.background_job_provider_receipts receipt
       where receipt.provider_event_id = 'evt_sql_provider_after_effect_finalised'
         and receipt.reconciliation_outcome = 'already_accepted'
         and receipt.matched_job_id = v_live_job.id
         and receipt.matched_effect_id = v_live_effect_id
     ) then
    raise exception 'provider callback conflicted with the finalised-effect/live-job window';
  end if;

  update public.background_jobs
  set lease_expires_at = now() - interval '1 second'
  where id = v_live_job.id;
  if public.background_jobs_recover_expired_leases('sql-provider-finalised-recovery', 100) < 1
     or (select status from public.background_jobs where id = v_live_job.id) <> 'provider_accepted'
     or (select lease_token from public.background_jobs where id = v_live_job.id) is not null
     or (select state from public.background_job_effects where id = v_live_effect_id) <> 'finalised' then
    raise exception 'finalised provider effect was not recoverable after the worker crash window';
  end if;

  select * into strict v_claim
  from public.background_jobs_claim('sql-provider-finalised-resumer', 1, 60);
  if v_claim.job_id <> v_live_job.id or v_claim.status <> 'provider_accepted' then
    raise exception 'finalised provider effect did not resume without another delivery';
  end if;
  perform public.background_job_record_progress(
    v_live_job.id, 'sql-provider-finalised-resumer', v_claim.lease_token,
    'finalising', 'finalising_delivery', '{}'::jsonb
  );
  perform public.background_job_complete(
    v_live_job.id, 'sql-provider-finalised-resumer', v_claim.lease_token,
    '{"providerAccepted":true}'::jsonb
  );

  -- An archived Needs-attention job is reactivated even after the local retry
  -- window expires, because the signed callback is affirmative provider proof.
  select * into v_attention_job
  from public.background_job_enqueue_system(
    'quote_send', 1, 'quote', '00000000-0000-4000-8000-000000000041', null,
    0::smallint, 'sql-test/provider-webhook/attention-expired', '{}'::jsonb,
    now(), 'worker_enabled', 'worker', 'sql-test'
  );
  select * into strict v_claim
  from public.background_jobs_claim('sql-provider-attention-worker', 1, 60);
  perform public.background_job_record_progress(
    v_attention_job.id, 'sql-provider-attention-worker', v_claim.lease_token,
    'running', 'preparing_delivery', '{}'::jsonb
  );
  perform public.background_job_record_effect_checkpoint(
    v_attention_job.id, 'sql-provider-attention-worker', v_claim.lease_token,
    'email_dispatch', 'email_dispatch', 'prepared', repeat('5', 64),
    'resend', 'sql-test/provider-webhook/attention-expired', v_provider_expiry,
    null, '{}'::jsonb
  );
  perform public.background_job_record_effect_checkpoint(
    v_attention_job.id, 'sql-provider-attention-worker', v_claim.lease_token,
    'email_dispatch', 'email_dispatch', 'dispatch_started', repeat('5', 64),
    'resend', 'sql-test/provider-webhook/attention-expired', v_provider_expiry,
    null, '{}'::jsonb
  );
  perform public.background_job_record_effect_checkpoint(
    v_attention_job.id, 'sql-provider-attention-worker', v_claim.lease_token,
    'email_dispatch', 'email_dispatch', 'failed', repeat('5', 64),
    'resend', 'sql-test/provider-webhook/attention-expired', v_provider_expiry,
    null, jsonb_build_object(
      'effectKind', 'email_dispatch',
      'checkpoint', 'failed',
      'providerName', 'resend'
    )
  );
  select private.background_job_provider_effect_ref(
           effect.provider_name,
           effect.provider_idempotency_key
         )
  into strict v_attention_effect_ref
  from public.background_job_effects effect
  where effect.job_id = v_attention_job.id;
  select queue_message_id into strict v_attention_original_message_id
  from public.background_jobs
  where id = v_attention_job.id;
  perform public.background_job_mark_needs_attention(
    v_attention_job.id,
    'sql-provider-attention-worker',
    v_claim.lease_token,
    'PROVIDER_OUTCOME_UNCERTAIN',
    'ignored raw provider detail',
    '{"progressCode":"provider_outcome_uncertain"}'::jsonb
  );
  alter table public.background_job_effects disable trigger background_job_effects_before_update_trigger;
  update public.background_job_effects
  set provider_idempotency_expires_at = v_expired_provider_identity_at
  where job_id = v_attention_job.id;
  alter table public.background_job_effects enable trigger background_job_effects_before_update_trigger;

  v_outcome := public.background_job_reconcile_verified_provider_acceptance(
    'resend',
    'evt_sql_provider_attention_expired',
    'email.sent',
    'resend-message-attention-one',
    v_attention_event_created_at,
    v_attention_job.id,
    v_attention_effect_ref
  );
  select queue_message_id into strict v_attention_replacement_message_id
  from public.background_jobs
  where id = v_attention_job.id;
  select queue_message.message into strict v_queue_message
  from pgmq.q_portal_background_jobs queue_message
  where queue_message.msg_id = v_attention_replacement_message_id;
  if v_outcome <> 'accepted'
     or (select status from public.background_jobs where id = v_attention_job.id) <> 'provider_accepted'
     or v_attention_replacement_message_id = v_attention_original_message_id
     or v_queue_message <> jsonb_build_object(
       'jobId', v_attention_job.id,
       'contractVersion', v_attention_job.contract_version
     )
     or (select completed_at from public.background_jobs where id = v_attention_job.id) is not null
     or (select error_code from public.background_jobs where id = v_attention_job.id) is not null
     or (select lease_token from public.background_jobs where id = v_attention_job.id) is not null
     or (select state from public.background_job_effects where job_id = v_attention_job.id) <> 'provider_accepted'
     or (select provider_idempotency_expires_at from public.background_job_effects where job_id = v_attention_job.id)
       <> v_expired_provider_identity_at then
    raise exception 'verified acceptance after provider expiry did not atomically reactivate finalisation';
  end if;

  select * into strict v_claim
  from public.background_jobs_claim('sql-provider-attention-finaliser', 1, 60);
  if v_claim.job_id <> v_attention_job.id or v_claim.status <> 'provider_accepted' then
    raise exception 'provider-accepted repair message did not resume finalisation';
  end if;
  perform public.background_job_record_effect_checkpoint(
    v_attention_job.id, 'sql-provider-attention-finaliser', v_claim.lease_token,
    'email_dispatch', 'email_dispatch', 'finalised', repeat('5', 64),
    'resend', 'sql-test/provider-webhook/attention-expired', v_expired_provider_identity_at,
    'resend-message-attention-one',
    jsonb_build_object(
      'effectKind', 'email_dispatch',
      'checkpoint', 'finalised',
      'providerName', 'resend',
      'providerAccepted', true
    )
  );
  perform public.background_job_record_progress(
    v_attention_job.id, 'sql-provider-attention-finaliser', v_claim.lease_token,
    'finalising', 'finalising_delivery', '{}'::jsonb
  );
  perform public.background_job_complete(
    v_attention_job.id, 'sql-provider-attention-finaliser', v_claim.lease_token,
    '{"providerAccepted":true}'::jsonb
  );

  -- Queue repair and effect acceptance are one transaction. A synthetic queue
  -- insert failure must leave no receipt and no partial provider checkpoint.
  select * into v_rollback_job
  from public.background_job_enqueue_system(
    'quote_send', 1, 'quote', '00000000-0000-4000-8000-000000000042', null,
    0::smallint, 'sql-test/provider-webhook/rollback', '{}'::jsonb,
    now(), 'worker_enabled', 'worker', 'sql-test'
  );
  select * into strict v_claim
  from public.background_jobs_claim('sql-provider-rollback-worker', 1, 60);
  perform public.background_job_record_progress(
    v_rollback_job.id, 'sql-provider-rollback-worker', v_claim.lease_token,
    'running', 'preparing_delivery', '{}'::jsonb
  );
  perform public.background_job_record_effect_checkpoint(
    v_rollback_job.id, 'sql-provider-rollback-worker', v_claim.lease_token,
    'email_dispatch', 'email_dispatch', 'prepared', repeat('6', 64),
    'resend', 'sql-test/provider-webhook/rollback', v_provider_expiry,
    null, '{}'::jsonb
  );
  perform public.background_job_record_effect_checkpoint(
    v_rollback_job.id, 'sql-provider-rollback-worker', v_claim.lease_token,
    'email_dispatch', 'email_dispatch', 'dispatch_started', repeat('6', 64),
    'resend', 'sql-test/provider-webhook/rollback', v_provider_expiry,
    null, '{}'::jsonb
  );
  select private.background_job_provider_effect_ref(
           effect.provider_name,
           effect.provider_idempotency_key
         )
  into strict v_rollback_effect_ref
  from public.background_job_effects effect
  where effect.job_id = v_rollback_job.id;
  select queue_message_id into strict v_rollback_original_message_id
  from public.background_jobs
  where id = v_rollback_job.id;
  perform public.background_job_mark_needs_attention(
    v_rollback_job.id,
    'sql-provider-rollback-worker',
    v_claim.lease_token,
    'PROVIDER_OUTCOME_UNCERTAIN',
    'ignored raw provider detail',
    '{"progressCode":"provider_outcome_uncertain"}'::jsonb
  );

  create function pg_temp.background_job_fail_provider_queue_repair()
  returns trigger
  language plpgsql
  as $trigger$
  begin
    raise exception 'synthetic provider queue repair failure';
  end;
  $trigger$;
  create trigger background_job_fail_provider_queue_repair_trigger
  before insert on pgmq.q_portal_background_jobs
  for each row execute function pg_temp.background_job_fail_provider_queue_repair();

  begin
    perform public.background_job_reconcile_verified_provider_acceptance(
      'resend',
      'evt_sql_provider_rollback',
      'email.sent',
      'resend-message-rollback-one',
      v_rollback_event_created_at,
      v_rollback_job.id,
      v_rollback_effect_ref
    );
  exception when raise_exception then
    if sqlerrm <> 'synthetic provider queue repair failure' then
      raise;
    end if;
    v_queue_failure_observed := true;
  end;
  drop trigger background_job_fail_provider_queue_repair_trigger
    on pgmq.q_portal_background_jobs;

  if not v_queue_failure_observed
     or (select status from public.background_jobs where id = v_rollback_job.id) <> 'needs_attention'
     or (select queue_message_id from public.background_jobs where id = v_rollback_job.id)
       <> v_rollback_original_message_id
     or (select state from public.background_job_effects where job_id = v_rollback_job.id) <> 'uncertain'
     or (select provider_message_id from public.background_job_effects where job_id = v_rollback_job.id) is not null
     or private.background_job_queue_contains(v_rollback_original_message_id)
     or exists (
       select 1
       from private.background_job_provider_receipts receipt
       where receipt.provider_event_id = 'evt_sql_provider_rollback'
     ) then
    raise exception 'provider acceptance queue failure did not roll back the full reconciliation transaction';
  end if;

  v_outcome := public.background_job_reconcile_verified_provider_acceptance(
    'resend',
    'evt_sql_provider_rollback',
    'email.sent',
    'resend-message-rollback-one',
    v_rollback_event_created_at,
    v_rollback_job.id,
    v_rollback_effect_ref
  );
  if v_outcome <> 'accepted'
     or (select status from public.background_jobs where id = v_rollback_job.id) <> 'provider_accepted'
     or not exists (
       select 1
       from private.background_job_provider_receipts receipt
       where receipt.provider_event_id = 'evt_sql_provider_rollback'
         and receipt.reconciliation_outcome = 'accepted'
     ) then
    raise exception 'provider acceptance could not retry after transactional queue-repair rollback';
  end if;
  select * into strict v_claim
  from public.background_jobs_claim('sql-provider-rollback-finaliser', 1, 60);
  perform public.background_job_record_effect_checkpoint(
    v_rollback_job.id, 'sql-provider-rollback-finaliser', v_claim.lease_token,
    'email_dispatch', 'email_dispatch', 'finalised', repeat('6', 64),
    'resend', 'sql-test/provider-webhook/rollback', v_provider_expiry,
    'resend-message-rollback-one',
    jsonb_build_object(
      'effectKind', 'email_dispatch',
      'checkpoint', 'finalised',
      'providerName', 'resend',
      'providerAccepted', true
    )
  );
  perform public.background_job_record_progress(
    v_rollback_job.id, 'sql-provider-rollback-finaliser', v_claim.lease_token,
    'finalising', 'finalising_delivery', '{}'::jsonb
  );
  perform public.background_job_complete(
    v_rollback_job.id, 'sql-provider-rollback-finaliser', v_claim.lease_token,
    '{"providerAccepted":true}'::jsonb
  );

  -- A provider message can identify only one effect globally. The callback for
  -- another live dispatch is retained as a conflict without overwriting either
  -- frozen effect identity or the first job's accepted message.
  select * into v_collision_job
  from public.background_job_enqueue_system(
    'quote_send', 1, 'quote', '00000000-0000-4000-8000-000000000043', null,
    0::smallint, 'sql-test/provider-webhook/collision', '{}'::jsonb,
    now(), 'worker_enabled', 'worker', 'sql-test'
  );
  select * into strict v_claim
  from public.background_jobs_claim('sql-provider-collision-worker', 1, 60);
  perform public.background_job_record_progress(
    v_collision_job.id, 'sql-provider-collision-worker', v_claim.lease_token,
    'running', 'preparing_delivery', '{}'::jsonb
  );
  perform public.background_job_record_effect_checkpoint(
    v_collision_job.id, 'sql-provider-collision-worker', v_claim.lease_token,
    'email_dispatch', 'email_dispatch', 'prepared', repeat('7', 64),
    'resend', 'sql-test/provider-webhook/collision', v_provider_expiry,
    null, '{}'::jsonb
  );
  perform public.background_job_record_effect_checkpoint(
    v_collision_job.id, 'sql-provider-collision-worker', v_claim.lease_token,
    'email_dispatch', 'email_dispatch', 'dispatch_started', repeat('7', 64),
    'resend', 'sql-test/provider-webhook/collision', v_provider_expiry,
    null, '{}'::jsonb
  );
  select private.background_job_provider_effect_ref(
           effect.provider_name,
           effect.provider_idempotency_key
         )
  into strict v_collision_effect_ref
  from public.background_job_effects effect
  where effect.job_id = v_collision_job.id;

  v_outcome := public.background_job_reconcile_verified_provider_acceptance(
    'resend',
    'evt_sql_provider_message_collision',
    'email.sent',
    'resend-message-live-one',
    v_collision_event_created_at,
    v_collision_job.id,
    v_collision_effect_ref
  );
  if v_outcome <> 'conflict'
     or (select status from public.background_jobs where id = v_collision_job.id) <> 'needs_attention'
     or (select error_code from public.background_jobs where id = v_collision_job.id) <> 'PROVIDER_WEBHOOK_CONFLICT'
     or (select lease_token from public.background_jobs where id = v_collision_job.id) is not null
     or (select state from public.background_job_effects where job_id = v_collision_job.id) <> 'uncertain'
     or (select provider_message_id from public.background_job_effects where job_id = v_collision_job.id) is not null
     or (select provider_message_id from public.background_job_effects where id = v_live_effect_id)
       <> 'resend-message-live-one'
     or not exists (
       select 1
       from private.background_job_provider_receipts receipt
       where receipt.provider_event_id = 'evt_sql_provider_message_collision'
         and receipt.reconciliation_outcome = 'conflict'
         and receipt.matched_job_id = v_collision_job.id
     ) then
    raise exception 'provider message collision was not retained as a fenced reconciliation conflict';
  end if;

  -- Receipt rows are a minimal append-only audit boundary even for unmatched
  -- verified callbacks.
  v_outcome := public.background_job_reconcile_verified_provider_acceptance(
    'resend',
    'evt_sql_provider_unmatched',
    'email.sent',
    'resend-message-unmatched-one',
    clock_timestamp(),
    null,
    null
  );
  if v_outcome <> 'unmatched'
     or not exists (
       select 1
       from private.background_job_provider_receipts receipt
       where receipt.provider_event_id = 'evt_sql_provider_unmatched'
         and receipt.reconciliation_outcome = 'unmatched'
         and receipt.matched_job_id is null
         and receipt.matched_effect_id is null
     ) then
    raise exception 'unmatched verified provider event was not retained minimally';
  end if;

  begin
    update private.background_job_provider_receipts
    set reconciliation_outcome = 'conflict'
    where provider_event_id = 'evt_sql_provider_unmatched';
    raise exception 'provider receipt update bypassed append-only history';
  exception when invalid_parameter_value then
    null;
  end;
  begin
    delete from private.background_job_provider_receipts
    where provider_event_id = 'evt_sql_provider_unmatched';
    raise exception 'provider receipt delete bypassed append-only history';
  exception when invalid_parameter_value then
    null;
  end;
end;
$$;

-- Terminal worker classifications and signed provider acceptance take the same
-- job-then-effect locks. Exercise both commit orders independently of the live
-- finalisation fixture above, including the permanent-failure policy boundary.
do $$
declare
  v_case integer;
  v_job public.background_jobs%rowtype;
  v_other_job public.background_jobs%rowtype;
  v_claim record;
  v_other_claim record;
  v_worker_id text;
  v_effect_hash text;
  v_effect public.background_job_effects%rowtype;
  v_idempotency_key text;
  v_effect_ref text;
  v_outcome text;
  v_completed_at timestamptz;
  v_provider_expiry timestamptz := now() + interval '1 hour';
begin
  for v_case in 1..7 loop
    v_worker_id := format('sql-provider-terminal-race-%s', v_case);
    v_effect_hash := repeat(substr('89abcde', v_case, 1), 64);
    v_idempotency_key := format('sql-test/provider-webhook/terminal-race-%s', v_case);

    select * into v_job
    from public.background_job_enqueue_system(
      'quote_send',
      1,
      'quote',
      ('00000000-0000-4000-8000-' || lpad((44 + v_case)::text, 12, '0'))::uuid,
      null,
      0::smallint,
      v_idempotency_key,
      '{}'::jsonb,
      now(),
      'worker_enabled',
      'worker',
      'sql-test'
    );
    select * into strict v_claim
    from public.background_jobs_claim(v_worker_id, 1, 60);
    if v_claim.job_id <> v_job.id then
      raise exception 'terminal race fixture claimed an unexpected job';
    end if;

    perform public.background_job_record_progress(
      v_job.id,
      v_worker_id,
      v_claim.lease_token,
      'running',
      'preparing_delivery',
      '{}'::jsonb
    );
    perform public.background_job_record_effect_checkpoint(
      v_job.id,
      v_worker_id,
      v_claim.lease_token,
      'email_dispatch',
      'email_dispatch',
      'prepared',
      v_effect_hash,
      'resend',
      v_idempotency_key,
      v_provider_expiry,
      null,
      '{}'::jsonb
    );
    if v_case <> 6 then
      perform public.background_job_record_effect_checkpoint(
        v_job.id,
        v_worker_id,
        v_claim.lease_token,
        'email_dispatch',
        'email_dispatch',
        'dispatch_started',
        v_effect_hash,
        'resend',
        v_idempotency_key,
        v_provider_expiry,
        null,
        '{}'::jsonb
      );
    end if;
    select private.background_job_provider_effect_ref(
             effect.provider_name,
             effect.provider_idempotency_key
           )
    into strict v_effect_ref
    from public.background_job_effects effect
    where effect.job_id = v_job.id;

    if v_case = 1 then
      -- Webhook-first: a later non-stale identity conflict remains visible.
      v_outcome := public.background_job_reconcile_verified_provider_acceptance(
        'resend',
        'evt_sql_provider_webhook_first',
        'email.sent',
        'resend-message-webhook-first',
        clock_timestamp(),
        v_job.id,
        v_effect_ref
      );
      if v_outcome <> 'accepted' then
        raise exception 'webhook-first fixture did not record provider acceptance';
      end if;
      begin
        perform public.background_job_mark_permanent_failure(
          v_job.id,
          v_worker_id,
          v_claim.lease_token,
          'RETRY_EXHAUSTED',
          'ignored raw provider detail'
        );
        raise exception 'stale permanent classification overwrote webhook acceptance';
      exception when serialization_failure then
        null;
      end;
      select * into strict v_effect
      from public.background_job_record_provider_acceptance(
        v_job.id,
        v_worker_id,
        v_claim.lease_token,
        'email_dispatch',
        'email_dispatch',
        v_effect_hash,
        'resend',
        v_idempotency_key,
        v_provider_expiry,
        'resend-message-local-conflict',
        jsonb_build_object(
          'effectKind', 'email_dispatch',
          'checkpoint', 'provider_accepted',
          'providerName', 'resend',
          'providerAccepted', true
        )
      );
      if v_effect.provider_message_id <> 'resend-message-webhook-first'
         or (select status from public.background_jobs where id = v_job.id) <> 'needs_attention'
         or (select error_code from public.background_jobs where id = v_job.id)
           <> 'EMAIL_PROVIDER_MESSAGE_ID_CONFLICT'
         or (select lease_owner from public.background_jobs where id = v_job.id) is not null
         or (select lease_token from public.background_jobs where id = v_job.id) is not null
         or private.background_job_queue_contains(v_job.queue_message_id) then
        raise exception 'local acceptance conflict was not atomically quarantined';
      end if;
      v_outcome := public.background_job_reconcile_verified_provider_acceptance(
        'resend',
        'evt_sql_provider_webhook_first_repeat',
        'email.sent',
        'resend-message-webhook-first',
        clock_timestamp(),
        v_job.id,
        v_effect_ref
      );
      if v_outcome <> 'already_accepted'
         or (select status from public.background_jobs where id = v_job.id) <> 'needs_attention'
         or (select error_code from public.background_jobs where id = v_job.id)
           <> 'EMAIL_PROVIDER_MESSAGE_ID_CONFLICT'
         or (select state from public.background_job_effects where job_id = v_job.id)
           <> 'provider_accepted'
         or private.background_job_queue_contains(v_job.queue_message_id) then
        raise exception 'webhook-first identity conflict was not preserved for attention';
      end if;
    elsif v_case = 2 then
      -- Worker-first: acceptance is retained on the effect without clearing the
      -- non-stale operator-visible classification on the job.
      perform public.background_job_mark_needs_attention(
        v_job.id,
        v_worker_id,
        v_claim.lease_token,
        'RESEND_IDEMPOTENCY_PAYLOAD_CONFLICT',
        'ignored raw provider detail',
        '{"progressCode":"provider_idempotency_conflict"}'::jsonb
      );
      v_outcome := public.background_job_reconcile_verified_provider_acceptance(
        'resend',
        'evt_sql_provider_worker_first',
        'email.sent',
        'resend-message-worker-first',
        clock_timestamp(),
        v_job.id,
        v_effect_ref
      );
      if v_outcome <> 'accepted'
         or (select status from public.background_jobs where id = v_job.id) <> 'needs_attention'
         or (select error_code from public.background_jobs where id = v_job.id)
           <> 'RESEND_IDEMPOTENCY_PAYLOAD_CONFLICT'
         or (select state from public.background_job_effects where job_id = v_job.id)
           <> 'provider_accepted'
         or private.background_job_queue_contains(v_job.queue_message_id) then
        raise exception 'worker-first identity conflict did not retain accepted provider evidence';
      end if;
      v_outcome := public.background_job_reconcile_verified_provider_acceptance(
        'resend',
        'evt_sql_provider_worker_first_repeat',
        'email.sent',
        'resend-message-worker-first',
        clock_timestamp(),
        v_job.id,
        v_effect_ref
      );
      if v_outcome <> 'already_accepted'
         or (select status from public.background_jobs where id = v_job.id) <> 'needs_attention'
         or (select error_code from public.background_jobs where id = v_job.id)
           <> 'RESEND_IDEMPOTENCY_PAYLOAD_CONFLICT' then
        raise exception 'repeated worker-first callback cleared the identity conflict';
      end if;
    elsif v_case in (3, 4) then
      perform public.background_job_record_effect_checkpoint(
        v_job.id,
        v_worker_id,
        v_claim.lease_token,
        'email_dispatch',
        'email_dispatch',
        'failed',
        v_effect_hash,
        'resend',
        v_idempotency_key,
        v_provider_expiry,
        null,
        jsonb_build_object(
          'effectKind', 'email_dispatch',
          'checkpoint', 'failed',
          'providerName', 'resend'
        )
      );

      if v_case = 3 then
        perform public.background_job_mark_permanent_failure(
          v_job.id,
          v_worker_id,
          v_claim.lease_token,
          'RESEND_IDEMPOTENCY_PAYLOAD_CONFLICT',
          'ignored raw provider detail'
        );
      else
        perform public.background_job_mark_permanent_failure(
          v_job.id,
          v_worker_id,
          v_claim.lease_token,
          'RETRY_EXHAUSTED',
          'ignored raw provider detail'
        );
      end if;

      begin
        perform public.background_job_mark_permanent_failure(
          v_job.id,
          v_worker_id,
          gen_random_uuid(),
          'RETRY_EXHAUSTED',
          'ignored raw provider detail'
        );
        raise exception 'stale lease read an already permanent-failed job';
      exception when object_not_in_prerequisite_state then
        null;
      end;

      v_outcome := public.background_job_reconcile_verified_provider_acceptance(
        'resend',
        format('evt_sql_provider_permanent_%s', v_case),
        'email.sent',
        format('resend-message-permanent-%s', v_case),
        clock_timestamp(),
        v_job.id,
        v_effect_ref
      );

      if v_case = 3 then
        if v_outcome <> 'accepted'
           or (select status from public.background_jobs where id = v_job.id) <> 'permanent_failed'
           or (select error_code from public.background_jobs where id = v_job.id)
             <> 'RESEND_IDEMPOTENCY_PAYLOAD_CONFLICT'
           or (select state from public.background_job_effects where job_id = v_job.id)
             <> 'provider_accepted'
           or private.background_job_queue_contains(v_job.queue_message_id) then
          raise exception 'non-stale permanent failure was cleared by provider acceptance';
        end if;
        v_outcome := public.background_job_reconcile_verified_provider_acceptance(
          'resend',
          'evt_sql_provider_permanent_non_stale_repeat',
          'email.sent',
          'resend-message-permanent-3',
          clock_timestamp(),
          v_job.id,
          v_effect_ref
        );
        if v_outcome <> 'already_accepted'
           or (select status from public.background_jobs where id = v_job.id) <> 'permanent_failed'
           or (select error_code from public.background_jobs where id = v_job.id)
             <> 'RESEND_IDEMPOTENCY_PAYLOAD_CONFLICT' then
          raise exception 'repeated callback cleared a non-stale permanent failure';
        end if;
      else
        if v_outcome <> 'accepted'
           or (select status from public.background_jobs where id = v_job.id) <> 'provider_accepted'
           or (select error_code from public.background_jobs where id = v_job.id) is not null
           or (select state from public.background_job_effects where job_id = v_job.id)
             <> 'provider_accepted'
           or not private.background_job_queue_contains(
             (select queue_message_id from public.background_jobs where id = v_job.id)
           ) then
          raise exception 'verified acceptance did not supersede a stale permanent failure';
        end if;
        select * into strict v_claim
        from public.background_jobs_claim('sql-provider-terminal-race-cleanup', 1, 60);
        if v_claim.job_id <> v_job.id or v_claim.status <> 'provider_accepted' then
          raise exception 'stale permanent-failure repair did not resume finalisation';
        end if;
        perform public.background_job_mark_needs_attention(
          v_job.id,
          'sql-provider-terminal-race-cleanup',
          v_claim.lease_token,
          'TEST_CLEANUP',
          'ignored raw test detail',
          '{"progressCode":"test_cleanup"}'::jsonb
        );
      end if;
    elsif v_case = 5 then
      -- A different signed message after successful finalisation is still a
      -- durable provider-identity incident; success must not hide it.
      select * into strict v_effect
      from public.background_job_record_provider_acceptance(
        v_job.id,
        v_worker_id,
        v_claim.lease_token,
        'email_dispatch',
        'email_dispatch',
        v_effect_hash,
        'resend',
        v_idempotency_key,
        v_provider_expiry,
        'resend-message-completed-local',
        jsonb_build_object(
          'effectKind', 'email_dispatch',
          'checkpoint', 'provider_accepted',
          'providerName', 'resend',
          'providerAccepted', true
        )
      );
      perform public.background_job_record_progress(
        v_job.id,
        v_worker_id,
        v_claim.lease_token,
        'finalising',
        'finalising',
        '{"phase":"finalising"}'::jsonb
      );
      perform public.background_job_record_effect_checkpoint(
        v_job.id,
        v_worker_id,
        v_claim.lease_token,
        'email_dispatch',
        'email_dispatch',
        'finalised',
        v_effect_hash,
        'resend',
        v_idempotency_key,
        v_provider_expiry,
        'resend-message-completed-local',
        jsonb_build_object(
          'effectKind', 'email_dispatch',
          'checkpoint', 'finalised',
          'providerName', 'resend',
          'providerAccepted', true
        )
      );
      perform public.background_job_complete(
        v_job.id,
        v_worker_id,
        v_claim.lease_token,
        '{}'::jsonb
      );
      select completed_at into strict v_completed_at
      from public.background_jobs
      where id = v_job.id;
      if (select status from public.background_jobs where id = v_job.id) <> 'succeeded'
         or v_completed_at is null then
        raise exception 'late-conflict fixture did not reach succeeded first';
      end if;

      v_outcome := public.background_job_reconcile_verified_provider_acceptance(
        'resend',
        'evt_sql_provider_completed_conflict',
        'email.sent',
        'resend-message-completed-webhook',
        clock_timestamp(),
        v_job.id,
        v_effect_ref
      );
      if v_outcome <> 'conflict'
         or (select status from public.background_jobs where id = v_job.id) <> 'needs_attention'
         or (select error_code from public.background_jobs where id = v_job.id)
           <> 'PROVIDER_WEBHOOK_CONFLICT'
         or (select provider_message_id from public.background_job_effects where job_id = v_job.id)
           <> 'resend-message-completed-local'
         or (select completed_at from public.background_jobs where id = v_job.id)
           is distinct from v_completed_at
         or exists (
           select 1
           from public.background_job_events event
           where event.job_id = v_job.id
             and event.event_type = 'queue_archive_missing'
         )
         or private.background_job_queue_contains(v_job.queue_message_id) then
        raise exception 'late provider-message conflict remained hidden behind success or emitted a false queue-missing audit';
      end if;
    elsif v_case = 6 then
      -- Cancellation before dispatch is safe, but a later signed acceptance
      -- for that prepared identity is still an incident and must not remain
      -- hidden behind the terminal cancellation state.
      perform public.background_job_request_cancellation(
        v_job.id,
        null,
        'SQL_PROVIDER_LATE_ACCEPTANCE_FIXTURE'
      );
      perform public.background_job_acknowledge_cancellation(
        v_job.id,
        v_worker_id,
        v_claim.lease_token
      );
      select completed_at into strict v_completed_at
      from public.background_jobs
      where id = v_job.id;
      if (select status from public.background_jobs where id = v_job.id) <> 'cancelled'
         or v_completed_at is null
         or private.background_job_queue_contains(v_job.queue_message_id) then
        raise exception 'late-acceptance fixture did not reach cancelled first';
      end if;

      v_outcome := public.background_job_reconcile_verified_provider_acceptance(
        'resend',
        'evt_sql_provider_cancelled_conflict',
        'email.sent',
        'resend-message-cancelled-webhook',
        clock_timestamp(),
        v_job.id,
        v_effect_ref
      );
      if v_outcome <> 'conflict'
         or (select status from public.background_jobs where id = v_job.id) <> 'needs_attention'
         or (select error_code from public.background_jobs where id = v_job.id)
           <> 'PROVIDER_WEBHOOK_CONFLICT'
         or (select state from public.background_job_effects where job_id = v_job.id) <> 'prepared'
         or (select completed_at from public.background_jobs where id = v_job.id)
           is distinct from v_completed_at
         or exists (
           select 1
           from public.background_job_events event
           where event.job_id = v_job.id
             and event.event_type = 'queue_archive_missing'
         )
         or private.background_job_queue_contains(v_job.queue_message_id) then
        raise exception 'late signed acceptance remained hidden behind cancellation or emitted a false queue-missing audit';
      end if;
    else
      -- A provider message ID already owned by another effect is not a
      -- retryable transport failure. Preserve that owner and quarantine this
      -- accepted-but-unrecordable outcome as uncertain.
      select * into v_other_job
      from public.background_job_enqueue_system(
        'quote_send',
        1,
        'quote',
        '00000000-0000-4000-8000-000000000060'::uuid,
        null,
        0::smallint,
        'sql-test/provider-webhook/collision-owner',
        '{}'::jsonb,
        now(),
        'worker_enabled',
        'worker',
        'sql-test'
      );
      select * into strict v_other_claim
      from public.background_jobs_claim('sql-provider-collision-owner', 1, 60);
      if v_other_claim.job_id <> v_other_job.id then
        raise exception 'provider-message collision fixture claimed an unexpected owner job';
      end if;
      perform public.background_job_record_progress(
        v_other_job.id,
        'sql-provider-collision-owner',
        v_other_claim.lease_token,
        'running',
        'preparing_delivery',
        '{}'::jsonb
      );
      perform public.background_job_record_effect_checkpoint(
        v_other_job.id,
        'sql-provider-collision-owner',
        v_other_claim.lease_token,
        'email_dispatch',
        'email_dispatch',
        'prepared',
        repeat('f', 64),
        'resend',
        'sql-test/provider-webhook/collision-owner',
        v_provider_expiry,
        null,
        '{}'::jsonb
      );
      perform public.background_job_record_effect_checkpoint(
        v_other_job.id,
        'sql-provider-collision-owner',
        v_other_claim.lease_token,
        'email_dispatch',
        'email_dispatch',
        'dispatch_started',
        repeat('f', 64),
        'resend',
        'sql-test/provider-webhook/collision-owner',
        v_provider_expiry,
        null,
        '{}'::jsonb
      );
      perform public.background_job_record_provider_acceptance(
        v_other_job.id,
        'sql-provider-collision-owner',
        v_other_claim.lease_token,
        'email_dispatch',
        'email_dispatch',
        repeat('f', 64),
        'resend',
        'sql-test/provider-webhook/collision-owner',
        v_provider_expiry,
        'resend-message-cross-job',
        jsonb_build_object(
          'effectKind', 'email_dispatch',
          'checkpoint', 'provider_accepted',
          'providerName', 'resend',
          'providerAccepted', true
        )
      );

      select * into strict v_effect
      from public.background_job_record_provider_acceptance(
        v_job.id,
        v_worker_id,
        v_claim.lease_token,
        'email_dispatch',
        'email_dispatch',
        v_effect_hash,
        'resend',
        v_idempotency_key,
        v_provider_expiry,
        'resend-message-cross-job',
        jsonb_build_object(
          'effectKind', 'email_dispatch',
          'checkpoint', 'provider_accepted',
          'providerName', 'resend',
          'providerAccepted', true
        )
      );
      if v_effect.state <> 'uncertain'
         or v_effect.provider_message_id is not null
         or (select status from public.background_jobs where id = v_job.id) <> 'needs_attention'
         or (select error_code from public.background_jobs where id = v_job.id)
           <> 'EMAIL_PROVIDER_MESSAGE_ID_CONFLICT'
         or (select lease_token from public.background_jobs where id = v_job.id) is not null
         or private.background_job_queue_contains(v_job.queue_message_id)
         or (select state from public.background_job_effects where job_id = v_other_job.id)
           <> 'provider_accepted'
         or (select provider_message_id from public.background_job_effects where job_id = v_other_job.id)
           <> 'resend-message-cross-job' then
        raise exception 'cross-job provider-message collision was not durably quarantined';
      end if;
      perform public.background_job_mark_needs_attention(
        v_other_job.id,
        'sql-provider-collision-owner',
        v_other_claim.lease_token,
        'TEST_CLEANUP',
        'ignored raw test detail',
        '{"progressCode":"test_cleanup"}'::jsonb
      );
    end if;
  end loop;
end;
$$;

-- Typed safe summaries reject sensitive values even under innocent keys and
-- accept only the explicit flat fields shared with @sp/jobs.
do $$
declare
  v_expected_service_functions text[] := array[
    'background_job_acknowledge_cancellation',
    'background_job_complete',
    'background_job_enqueue_staff',
    'background_job_enqueue_system',
    'background_job_event_history_safe',
    'background_job_get_safe',
    'background_job_heartbeat',
    'background_job_manual_retry',
    'background_job_mark_needs_attention',
    'background_job_mark_permanent_failure',
    'background_job_read_effects',
    'background_job_read_payload',
    'background_job_read_runtime_context',
    'background_job_reconcile_verified_provider_acceptance',
    'background_job_record_effect_checkpoint',
    'background_job_record_provider_acceptance',
    'background_job_record_progress',
    'background_job_release_lease',
    'background_job_request_cancellation',
    'background_job_schedule_retry',
    'background_jobs_claim',
    'background_jobs_list_safe',
    'background_jobs_queue_health',
    'background_jobs_reconcile',
    'background_jobs_recover_expired_leases',
    'background_jobs_runtime_metrics',
    'background_worker_heartbeat',
    'background_workers_list_safe'
  ];
  v_actual_service_functions text[];
  v_actual_service_function_count bigint;
begin
  select
    array_agg(distinct routine.proname order by routine.proname),
    count(*)
  into v_actual_service_functions, v_actual_service_function_count
  from pg_proc routine
  join pg_namespace namespace on namespace.oid = routine.pronamespace
  where namespace.nspname = 'public'
    and routine.proname like 'background\_%' escape '\'
    and has_function_privilege('service_role', routine.oid, 'execute');

  if v_actual_service_functions is distinct from v_expected_service_functions
     or v_actual_service_function_count <> cardinality(v_expected_service_functions) then
    raise exception 'service-role background RPC allowlist mismatch: % (% signatures)',
      v_actual_service_functions,
      v_actual_service_function_count;
  end if;
  if exists (
    select 1
    from pg_proc routine
    join pg_namespace namespace on namespace.oid = routine.pronamespace
    where namespace.nspname in ('public', 'private', 'pgmq', 'pgmq_public')
      and routine.proname like 'background\_%' escape '\'
      and (
        has_function_privilege('anon', routine.oid, 'execute')
        or has_function_privilege('authenticated', routine.oid, 'execute')
      )
  ) then
    raise exception 'browser role can execute a background-job function';
  end if;
  if exists (
    select 1
    from pg_proc routine
    join pg_namespace namespace on namespace.oid = routine.pronamespace
    where namespace.nspname = 'private'
      and has_function_privilege('service_role', routine.oid, 'execute')
  ) then
    raise exception 'service role can execute a private background-job helper directly';
  end if;
end;
$$;

set local role service_role;
do $$
declare
  v_job record;
  v_safe_job jsonb;
  v_safe_event jsonb;
begin
  if public.background_job_reconcile_verified_provider_acceptance(
    'resend',
    'evt_sql_service_role_unmatched',
    'email.sent',
    'resend-message-service-role-unmatched',
    clock_timestamp(),
    null,
    null
  ) <> 'unmatched' then
    raise exception 'service role could not execute verified provider reconciliation';
  end if;

  select * into strict v_job
  from public.background_job_enqueue_system(
    'automation_event', 1, 'automation_event', 'sql-service-role-runtime-1', null,
    0::smallint, 'sql-test/service-role/runtime', '{}'::jsonb,
    now(), 'worker_enabled', 'worker', 'sql-test'
  );
  perform * from public.background_jobs_queue_health();

  select to_jsonb(safe_job) into strict v_safe_job
  from public.background_job_get_safe(v_job.id) safe_job;
  if v_safe_job ?| array[
    'intent_key', 'input_hash', 'queue_message_id', 'lease_owner', 'lease_token',
    'lease_started_at', 'lease_expires_at', 'last_heartbeat_at',
    'requested_by_user_id', 'requested_by_actor', 'cancellation_requested_by',
    'cancellation_reason', 'rollout_cohort', 'error_message', 'provider_name',
    'provider_message_id', 'provider_idempotency_expires_at',
    'has_external_side_effect', 'allowed_effect_kinds', 'required_effect_kinds',
    'cancellation_allowed'
  ] then
    raise exception 'safe job inspection exposed an internal or capability field: %', v_safe_job;
  end if;

  select to_jsonb(safe_event) into strict v_safe_event
  from public.background_job_event_history_safe(v_job.id, 10) safe_event
  order by safe_event.id
  limit 1;
  if v_safe_event ?| array['queue_message_id', 'worker_id', 'actor_user_id'] then
    raise exception 'safe event inspection exposed internal correlation fields: %', v_safe_event;
  end if;

  begin
    perform count(*) from public.background_jobs;
    raise exception 'service role read the background-job ledger directly';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform count(*) from private.background_job_payloads;
    raise exception 'service role read protected payloads directly';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform count(*) from private.background_job_provider_receipts;
    raise exception 'service role read provider receipts directly';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform * from pgmq.read('portal_background_jobs', 30, 1);
    raise exception 'service role read PGMQ directly';
  exception when insufficient_privilege then
    null;
  end;

  perform public.background_job_request_cancellation(v_job.id, null, 'SQL_SERVICE_ROLE_CLEANUP');
end;
$$;
reset role;

do $$
declare
  v_job public.background_jobs%rowtype;
  v_released public.background_jobs%rowtype;
  v_claim record;
  v_original_message_id bigint;
  v_stale_message_id bigint;
  v_replacement_message_id bigint;
  v_reconcile_report jsonb;
  v_visibility_failure_observed boolean := false;
  v_stale_vt_before timestamptz;
  v_stale_vt_after timestamptz;
begin
  -- Successful release preserves the canonical minimal message and fences a
  -- duplicate release with the spent lease token.
  select * into v_job
  from public.background_job_enqueue_system(
    'job_pack_generate', 1, 'job_pack', 'sql-release-success-1', null,
    0::smallint, 'sql-test/release/success', '{}'::jsonb,
    now(), 'worker_enabled', 'worker', 'sql-test'
  );
  select * into strict v_claim from public.background_jobs_claim('sql-release-worker-one', 1, 60);
  v_original_message_id := v_claim.queue_message_id;
  select * into strict v_released
  from public.background_job_release_lease(v_job.id, 'sql-release-worker-one', v_claim.lease_token);
  if v_released.status <> 'retrying'
     or v_released.queue_message_id <> v_original_message_id
     or v_released.lease_token is not null
     or not exists (
       select 1
       from pgmq.q_portal_background_jobs queue_message
       where queue_message.msg_id = v_original_message_id
         and queue_message.message = jsonb_build_object(
           'jobId', v_job.id,
           'contractVersion', v_job.contract_version
         )
     ) then
    raise exception 'successful lease release did not preserve a runnable canonical message';
  end if;
  begin
    perform public.background_job_release_lease(v_job.id, 'sql-release-worker-one', v_claim.lease_token);
    raise exception 'duplicate lease release reused a spent token';
  exception when object_not_in_prerequisite_state then
    null;
  end;
  perform public.background_job_request_cancellation(v_job.id, null, 'SQL_RELEASE_SUCCESS_CLEANUP');

  -- A physically missing message is recreated and the pointer is moved before
  -- the application lease is cleared.
  select * into v_job
  from public.background_job_enqueue_system(
    'job_pack_generate', 1, 'job_pack', 'sql-release-missing-1', null,
    0::smallint, 'sql-test/release/missing', '{}'::jsonb,
    now(), 'worker_enabled', 'worker', 'sql-test'
  );
  select * into strict v_claim from public.background_jobs_claim('sql-release-worker-two', 1, 60);
  v_original_message_id := v_claim.queue_message_id;
  delete from pgmq.q_portal_background_jobs where msg_id = v_original_message_id;
  select * into strict v_released
  from public.background_job_release_lease(v_job.id, 'sql-release-worker-two', v_claim.lease_token);
  if v_released.status <> 'retrying'
     or v_released.queue_message_id is null
     or v_released.queue_message_id = v_original_message_id
     or not private.background_job_queue_contains(v_released.queue_message_id)
     or not exists (
       select 1 from public.background_job_events event
       where event.job_id = v_job.id and event.event_type = 'queue_archive_missing'
     )
     or not exists (
       select 1 from public.background_job_events event
       where event.job_id = v_job.id and event.event_type = 'queue_repaired'
     ) then
    raise exception 'missing-message lease release did not repair atomically';
  end if;
  perform public.background_job_request_cancellation(v_job.id, null, 'SQL_RELEASE_MISSING_CLEANUP');

  -- An archived message has the same zero-row set_vt outcome and must follow
  -- the same durable repair path.
  select * into v_job
  from public.background_job_enqueue_system(
    'job_pack_generate', 1, 'job_pack', 'sql-release-archived-1', null,
    0::smallint, 'sql-test/release/archived', '{}'::jsonb,
    now(), 'worker_enabled', 'worker', 'sql-test'
  );
  select * into strict v_claim from public.background_jobs_claim('sql-release-worker-three', 1, 60);
  v_original_message_id := v_claim.queue_message_id;
  perform pgmq.archive('portal_background_jobs', v_original_message_id);
  select * into strict v_released
  from public.background_job_release_lease(v_job.id, 'sql-release-worker-three', v_claim.lease_token);
  if v_released.queue_message_id = v_original_message_id
     or not private.background_job_queue_contains(v_released.queue_message_id) then
    raise exception 'archived-message lease release did not create a canonical replacement';
  end if;
  perform public.background_job_request_cancellation(v_job.id, null, 'SQL_RELEASE_ARCHIVED_CLEANUP');

  -- A live pointer with the wrong minimal message body is stale, not
  -- canonical. Repair must not strand the job or archive another intent.
  select * into v_job
  from public.background_job_enqueue_system(
    'job_pack_generate', 1, 'job_pack', 'sql-release-stale-1', null,
    0::smallint, 'sql-test/release/stale', '{}'::jsonb,
    now(), 'worker_enabled', 'worker', 'sql-test'
  );
  select * into strict v_claim from public.background_jobs_claim('sql-release-worker-four', 1, 60);
  v_original_message_id := v_claim.queue_message_id;
  select sent.msg_id into strict v_stale_message_id
  from pgmq.send(
    queue_name => 'portal_background_jobs',
    msg => jsonb_build_object(
      'jobId', '00000000-0000-4000-8000-000000000099'::uuid,
      'contractVersion', 1
    ),
    delay => 0
  ) sent(msg_id);
  update public.background_jobs set queue_message_id = v_stale_message_id where id = v_job.id;
  select queue_message.vt into strict v_stale_vt_before
  from pgmq.q_portal_background_jobs queue_message
  where queue_message.msg_id = v_stale_message_id;
  select * into strict v_released
  from public.background_job_release_lease(v_job.id, 'sql-release-worker-four', v_claim.lease_token);
  select queue_message.vt into strict v_stale_vt_after
  from pgmq.q_portal_background_jobs queue_message
  where queue_message.msg_id = v_stale_message_id;
  v_replacement_message_id := v_released.queue_message_id;
  if v_replacement_message_id in (v_original_message_id, v_stale_message_id)
     or v_stale_vt_after is distinct from v_stale_vt_before
     or not exists (
       select 1 from pgmq.q_portal_background_jobs queue_message
       where queue_message.msg_id = v_replacement_message_id
         and queue_message.message = jsonb_build_object(
           'jobId', v_job.id,
           'contractVersion', v_job.contract_version
         )
     ) then
    raise exception 'stale-pointer lease release mutated the wrong message or failed exact repair';
  end if;

  v_reconcile_report := public.background_jobs_reconcile('sql-release-reconciler', 500);
  if private.background_job_queue_contains(v_original_message_id)
     or private.background_job_queue_contains(v_stale_message_id)
     or not private.background_job_queue_contains(v_replacement_message_id)
     or coalesce((v_reconcile_report ->> 'archivedMessages')::integer, 0) < 2 then
    raise exception 'later reconciliation did not retire stale release messages safely';
  end if;
  perform public.background_job_request_cancellation(v_job.id, null, 'SQL_RELEASE_STALE_CLEANUP');

  -- An actual queue UPDATE failure propagates and rolls back the whole RPC;
  -- no retrying ledger state or cleared lease may escape.
  select * into v_job
  from public.background_job_enqueue_system(
    'job_pack_generate', 1, 'job_pack', 'sql-release-failure-1', null,
    0::smallint, 'sql-test/release/failure', '{}'::jsonb,
    now(), 'worker_enabled', 'worker', 'sql-test'
  );
  select * into strict v_claim from public.background_jobs_claim('sql-release-worker-five', 1, 60);
  v_original_message_id := v_claim.queue_message_id;

  create function pg_temp.background_jobs_fail_visibility_update()
  returns trigger
  language plpgsql
  as $trigger$
  begin
    raise exception 'synthetic queue visibility failure';
  end;
  $trigger$;
  create trigger background_jobs_fail_visibility_update_trigger
  before update on pgmq.q_portal_background_jobs
  for each row execute function pg_temp.background_jobs_fail_visibility_update();

  begin
    perform public.background_job_release_lease(v_job.id, 'sql-release-worker-five', v_claim.lease_token);
  exception when raise_exception then
    if sqlerrm <> 'synthetic queue visibility failure' then
      raise;
    end if;
    v_visibility_failure_observed := true;
  end;
  drop trigger background_jobs_fail_visibility_update_trigger on pgmq.q_portal_background_jobs;

  if not v_visibility_failure_observed then
    raise exception 'queue visibility failure did not abort lease release';
  end if;
  if (select status from public.background_jobs where id = v_job.id) <> 'claimed'
     or (select lease_token from public.background_jobs where id = v_job.id) is distinct from v_claim.lease_token
     or (select queue_message_id from public.background_jobs where id = v_job.id) <> v_original_message_id then
    raise exception 'queue visibility failure left a partial lease release';
  end if;
  perform public.background_job_release_lease(v_job.id, 'sql-release-worker-five', v_claim.lease_token);
  perform public.background_job_request_cancellation(v_job.id, null, 'SQL_RELEASE_FAILURE_CLEANUP');
end;
$$;

do $$
declare
  v_job public.background_jobs%rowtype;
  v_claim record;
  v_effect public.background_job_effects%rowtype;
  v_repeat public.background_job_effects%rowtype;
  v_effect_event_count bigint;
  v_provider_expiry timestamptz := now() + interval '1 hour';
begin
  select * into v_job
  from public.background_job_enqueue_system(
    'job_pack_generate', 1, 'job_pack', 'sql-effect-policy-no-side-effect-1', null,
    0::smallint, 'sql-test/effect-policy/non-side-effect', '{}'::jsonb,
    now(), 'worker_enabled', 'worker', 'sql-test'
  );
  select * into strict v_claim from public.background_jobs_claim('sql-effect-policy-worker-one', 1, 60);
  perform public.background_job_record_progress(
    v_job.id, 'sql-effect-policy-worker-one', v_claim.lease_token,
    'running', 'generating', '{}'::jsonb
  );
  begin
    perform public.background_job_record_effect_checkpoint(
      v_job.id, 'sql-effect-policy-worker-one', v_claim.lease_token,
      'email_dispatch', 'email_dispatch', 'prepared', repeat('d', 64),
      'sql-provider', 'sql-test/effect-policy/non-side-effect', v_provider_expiry, null, '{}'::jsonb
    );
    raise exception 'non-side-effecting job accepted an external effect';
  exception when invalid_parameter_value then
    null;
  end;
  if exists (select 1 from public.background_job_effects effect where effect.job_id = v_job.id) then
    raise exception 'rejected non-side effect left a partial checkpoint';
  end if;
  perform public.background_job_mark_needs_attention(
    v_job.id, 'sql-effect-policy-worker-one', v_claim.lease_token,
    'TEST_CLEANUP', 'ignored raw test detail', '{"progressCode":"test_cleanup"}'::jsonb
  );

  select * into v_job
  from public.background_job_enqueue_system(
    'quote_send', 1, 'quote', '00000000-0000-4000-8000-000000000021', null,
    0::smallint, 'sql-test/effect-policy/allowed', '{}'::jsonb,
    now(), 'worker_enabled', 'worker', 'sql-test'
  );
  select * into strict v_claim from public.background_jobs_claim('sql-effect-policy-worker-two', 1, 60);
  perform public.background_job_record_progress(
    v_job.id, 'sql-effect-policy-worker-two', v_claim.lease_token,
    'running', 'preparing_delivery', '{}'::jsonb
  );

  begin
    perform public.background_job_record_effect_checkpoint(
      v_job.id, 'sql-effect-policy-worker-two', v_claim.lease_token,
      'sms_dispatch', 'sms_dispatch', 'prepared', repeat('e', 64),
      'sql-provider', 'sql-test/effect-policy/undeclared', v_provider_expiry, null, '{}'::jsonb
    );
    raise exception 'undeclared external effect was accepted';
  exception when invalid_parameter_value then
    null;
  end;

  begin
    perform public.background_job_record_effect_checkpoint(
      v_job.id, 'sql-effect-policy-worker-two', v_claim.lease_token,
      'email_dispatch', 'email_dispatch', 'dispatch_started', repeat('e', 64),
      'sql-provider', 'sql-test/effect-policy/allowed', v_provider_expiry, null, '{}'::jsonb
    );
    raise exception 'effect checkpoint skipped its prepared state';
  exception when invalid_parameter_value then
    null;
  end;

  select * into strict v_effect
  from public.background_job_record_effect_checkpoint(
    v_job.id, 'sql-effect-policy-worker-two', v_claim.lease_token,
    'email_dispatch', 'email_dispatch', 'prepared', repeat('e', 64),
    'sql-provider', 'sql-test/effect-policy/allowed', v_provider_expiry, null,
    '{"effectKind":"email_dispatch","checkpoint":"prepared"}'::jsonb
  );
  select count(*) into v_effect_event_count
  from public.background_job_events event
  where event.job_id = v_job.id and event.event_type = 'effect_checkpoint';

  select * into strict v_repeat
  from public.background_job_record_effect_checkpoint(
    v_job.id, 'sql-effect-policy-worker-two', v_claim.lease_token,
    'email_dispatch', 'email_dispatch', 'prepared', repeat('e', 64),
    'sql-provider', 'sql-test/effect-policy/allowed', v_provider_expiry, null,
    '{"effectKind":"email_dispatch","checkpoint":"prepared"}'::jsonb
  );
  if v_repeat.id <> v_effect.id or (
    select count(*) from public.background_job_events event
    where event.job_id = v_job.id and event.event_type = 'effect_checkpoint'
  ) <> v_effect_event_count then
    raise exception 'exact repeated effect checkpoint was not idempotent';
  end if;

  begin
    perform public.background_job_record_effect_checkpoint(
      v_job.id, 'sql-effect-policy-worker-two', v_claim.lease_token,
      'alternate-email-key', 'email_dispatch', 'prepared', repeat('e', 64),
      'sql-provider', 'sql-test/effect-policy/allowed', v_provider_expiry, null,
      '{"effectKind":"email_dispatch","checkpoint":"prepared"}'::jsonb
    );
    raise exception 'duplicate effect kind was hidden behind a second effect key';
  exception when unique_violation then
    null;
  end;

  begin
    perform public.background_job_record_effect_checkpoint(
      v_job.id, 'sql-effect-policy-worker-two', v_claim.lease_token,
      'email_dispatch', 'email_dispatch', 'provider_accepted', repeat('e', 64),
      'sql-provider', 'sql-test/effect-policy/allowed', v_provider_expiry,
      'provider-message-021', '{}'::jsonb
    );
    raise exception 'prepared effect skipped dispatch_started';
  exception when invalid_parameter_value then
    null;
  end;

  perform public.background_job_record_effect_checkpoint(
    v_job.id, 'sql-effect-policy-worker-two', v_claim.lease_token,
    'email_dispatch', 'email_dispatch', 'dispatch_started', repeat('e', 64),
    'sql-provider', 'sql-test/effect-policy/allowed', v_provider_expiry, null,
    '{"effectKind":"email_dispatch","checkpoint":"dispatch_started"}'::jsonb
  );
  perform public.background_job_record_effect_checkpoint(
    v_job.id, 'sql-effect-policy-worker-two', v_claim.lease_token,
    'email_dispatch', 'email_dispatch', 'failed', repeat('e', 64),
    'sql-provider', 'sql-test/effect-policy/allowed', v_provider_expiry, null,
    '{"effectKind":"email_dispatch","checkpoint":"failed"}'::jsonb
  );
  begin
    perform public.background_job_record_effect_checkpoint(
      v_job.id, 'sql-effect-policy-worker-two', v_claim.lease_token,
      'email_dispatch', 'email_dispatch', 'provider_accepted', repeat('e', 64),
      'sql-provider', 'sql-test/effect-policy/allowed', v_provider_expiry,
      'provider-message-021', '{}'::jsonb
    );
    raise exception 'failed effect skipped a fresh dispatch_started checkpoint';
  exception when invalid_parameter_value then
    null;
  end;

  perform public.background_job_mark_needs_attention(
    v_job.id, 'sql-effect-policy-worker-two', v_claim.lease_token,
    'TEST_CLEANUP', 'ignored raw test detail', '{"progressCode":"test_cleanup"}'::jsonb
  );

  select * into v_job
  from public.background_job_enqueue_system(
    'quote_send', 1, 'quote', '00000000-0000-4000-8000-000000000022', null,
    0::smallint, 'sql-test/effect-policy/incomplete', '{}'::jsonb,
    now(), 'worker_enabled', 'worker', 'sql-test'
  );
  select * into strict v_claim from public.background_jobs_claim('sql-effect-policy-worker-three', 1, 60);
  perform public.background_job_record_progress(
    v_job.id, 'sql-effect-policy-worker-three', v_claim.lease_token,
    'running', 'preparing_delivery', '{}'::jsonb
  );
  perform public.background_job_record_effect_checkpoint(
    v_job.id, 'sql-effect-policy-worker-three', v_claim.lease_token,
    'email_dispatch', 'email_dispatch', 'prepared', repeat('f', 64),
    'sql-provider', 'sql-test/effect-policy/incomplete', v_provider_expiry, null,
    '{"effectKind":"email_dispatch","checkpoint":"prepared"}'::jsonb
  );

  perform public.background_job_record_progress(
    v_job.id, 'sql-effect-policy-worker-three', v_claim.lease_token,
    'finalising', 'finalising_delivery', '{}'::jsonb
  );
  begin
    perform public.background_job_complete(
      v_job.id, 'sql-effect-policy-worker-three', v_claim.lease_token, '{}'::jsonb
    );
    raise exception 'job completed with a recorded non-finalised effect';
  exception when invalid_parameter_value then
    null;
  end;
  if (select status from public.background_jobs where id = v_job.id) <> 'finalising'
     or (select state from public.background_job_effects where job_id = v_job.id) <> 'prepared' then
    raise exception 'invalid completion did not fail atomically';
  end if;
  perform public.background_job_mark_needs_attention(
    v_job.id, 'sql-effect-policy-worker-three', v_claim.lease_token,
    'TEST_CLEANUP', 'ignored raw test detail', '{"progressCode":"test_cleanup"}'::jsonb
  );
end;
$$;

do $$
begin
  if not public.background_job_safe_summary(
    'progress',
    '{"phase":"generating","completedPhases":["inputs_frozen"],"currentCount":1,"totalCount":2,"percentComplete":50,"cached":false,"updatedAt":"2026-07-20T00:00:00Z"}'::jsonb
  ) then
    raise exception 'safe progress summary was rejected';
  end if;
  if not public.background_job_safe_summary('progress', '{"currentCount":1.0}'::jsonb) then
    raise exception 'integral JSON number was rejected as a safe count';
  end if;
  if not public.background_job_safe_summary(
    'result',
    '{"resultCode":"generated","artifactId":"artifact-123","artifactIds":["artifact-123","artifact-456"],"artifactCount":2,"reused":false,"completedAt":"2026-07-20T00:00:00+10:00"}'::jsonb
  ) then
    raise exception 'safe result summary was rejected';
  end if;
  if not public.background_job_safe_summary(
    'effect',
    '{"effectKind":"email_dispatch","checkpoint":"provider_accepted","previousCheckpoint":"dispatch_started","providerMessageId":"provider-message-123","providerAccepted":true,"providerAcceptedAt":"2026-07-20T00:00:00Z"}'::jsonb
  ) then
    raise exception 'safe effect summary was rejected';
  end if;
  if not public.background_job_safe_summary(
    'event',
    '{"reason":"lease_release_missing_message","jobId":"00000000-0000-4000-8000-000000000001","queueMessageId":1,"occurredAt":"2026-07-20T00:00:00Z"}'::jsonb
  ) then
    raise exception 'safe event summary was rejected';
  end if;
  if not public.background_job_safe_summary(
    'worker',
    '{"mode":"active","supportedKinds":["automation_event"],"globalConcurrency":4,"acceptingJobs":true,"lastHeartbeatAt":"2026-07-20T00:00:00Z"}'::jsonb
  ) then
    raise exception 'safe worker summary was rejected';
  end if;

  if public.background_job_safe_summary('result', '{"artifactId":"customer@example.test"}'::jsonb) then
    raise exception 'email value bypassed safe result validation';
  end if;
  if public.background_job_safe_summary(
    'result',
    '{"artifactId":"https://files.example.test/quote-123?token=synthetic"}'::jsonb
  ) then
    raise exception 'signed URL value bypassed safe result validation';
  end if;
  if public.background_job_safe_summary('result', '{"artifactId":"files.example.test/quote-123"}'::jsonb) then
    raise exception 'raw domain URL bypassed safe result validation';
  end if;
  if public.background_job_safe_summary('result', '{"artifactId":"Bearer dGVzdC10b2tlbg=="}'::jsonb) then
    raise exception 'bearer credential bypassed safe result validation';
  end if;
  if public.background_job_safe_summary(
    'result',
    jsonb_build_object('artifactId', repeat('a', 64))
  ) then
    raise exception 'token hash bypassed safe result validation';
  end if;
  if public.background_job_safe_summary(
    'result',
    '{"artifactIds":["artifact-123","customer@example.test"]}'::jsonb
  ) then
    raise exception 'recipient array bypassed safe result validation';
  end if;
  if public.background_job_safe_summary('result', '{"resultCode":"Jordan Smith"}'::jsonb) then
    raise exception 'customer name bypassed safe result validation';
  end if;
  if public.background_job_safe_summary(
    'effect',
    '{"resultCode":{"status":"accepted","response":"provider payload"}}'::jsonb
  ) then
    raise exception 'provider payload object bypassed safe effect validation';
  end if;
  if public.background_job_safe_summary('result', '{"unknownField":1}'::jsonb) then
    raise exception 'unknown safe-summary field bypassed the context allowlist';
  end if;
  if public.background_job_safe_summary(null, '{}'::jsonb) then
    raise exception 'NULL safe-summary context bypassed the context allowlist';
  end if;
  if public.background_job_safe_summary('progress', '{"updatedAt":"2026-02-31T25:00:00Z"}'::jsonb) then
    raise exception 'invalid timestamp bypassed safe progress validation';
  end if;
  if public.background_job_safe_summary('progress', '{"percentComplete":0.0000001}'::jsonb) then
    raise exception 'sub-micro precision percentage bypassed the deterministic safe contract';
  end if;
end;
$$;

-- JOB-02 runtime reads expose only lease-fenced execution timing plus aggregate
-- operational data. They never reveal a protected payload or provider key.
do $$
begin
  perform public.background_worker_heartbeat(
    'sql-worker-runtime-stale', 'dark', 'ready', 'sql-test', 1, 0,
    '{"mode":"dark","globalConcurrency":1,"activeJobCount":0,"acceptingJobs":false}'::jsonb
  );
  update public.background_workers
  set last_heartbeat_at = now() - interval '3 minutes'
  where worker_id = 'sql-worker-runtime-stale';
end;
$$;

set local role service_role;
do $$
declare
  v_job record;
  v_claim record;
  v_context record;
  v_metrics record;
  v_worker record;
begin
  select * into v_job
  from public.background_job_enqueue_system(
    'job_pack_generate', 1, 'job_pack', 'sql-worker-runtime-1', null,
    0::smallint, 'sql-test/worker-runtime/context', '{}'::jsonb,
    now(), 'worker_enabled', 'worker', 'sql-test'
  );
  select * into strict v_claim
  from public.background_jobs_claim('sql-worker-runtime-one', 1, 60);

  select * into strict v_context
  from public.background_job_read_runtime_context(
    v_job.id, 'sql-worker-runtime-one', v_claim.lease_token
  );
  if v_context.job_id <> v_job.id
     or v_context.started_at is null
     or v_context.attempt_count <> 1
     or v_context.execution_owner <> 'worker' then
    raise exception 'service-role lease-fenced worker runtime context was incomplete';
  end if;
  if exists (
    select 1 from public.background_job_read_runtime_context(
     v_job.id, 'sql-worker-runtime-one', gen_random_uuid()
    )
  ) then
    raise exception 'service-role stale lease read worker runtime context';
  end if;

  perform public.background_worker_heartbeat(
    'sql-worker-runtime-one', 'dark', 'ready', 'sql-test', 1, 0,
    '{"mode":"dark","globalConcurrency":1,"activeJobCount":0,"acceptingJobs":false}'::jsonb
  );
  select * into strict v_worker
  from public.background_workers_list_safe(10)
  where worker_id = 'sql-worker-runtime-one';
  if v_worker.mode <> 'dark'
     or v_worker.lifecycle_state <> 'ready'
     or v_worker.is_stale then
    raise exception 'service-role safe worker health projection was incomplete';
  end if;

  perform public.background_worker_heartbeat(
    'sql-worker-runtime-unhealthy', 'dark', 'unhealthy', 'sql-test', 1, 0,
    '{"mode":"dark","lifecycleState":"unhealthy","globalConcurrency":1,"activeJobCount":0,"acceptingJobs":false}'::jsonb
  );
  select * into strict v_worker
  from public.background_workers_list_safe(10)
  where worker_id = 'sql-worker-runtime-stale';
  if not v_worker.is_stale then
    raise exception 'service-role safe worker health projection did not classify a stale worker';
  end if;

  select * into strict v_metrics from public.background_jobs_runtime_metrics();
  if v_metrics.queue_depth < 1
     or v_metrics.oldest_job_age_seconds < 0
     or v_metrics.due_jobs < 0
     or v_metrics.stale_workers < 1
     or not (v_metrics.status_counts ?& array['queued', 'claimed', 'retrying', 'needs_attention'])
     or not (v_metrics.kind_counts ?& array['job_pack_generate', 'quote_send', 'email_outbox_deliver'])
     or v_metrics.worker_lifecycle_counts is distinct from jsonb_build_object(
       'starting', 0,
       'ready', 2,
       'draining', 0,
       'stopped', 0,
       'unhealthy', 1
     ) then
    raise exception 'service-role runtime aggregate metrics were incomplete: %', to_jsonb(v_metrics);
  end if;

  perform public.background_job_mark_needs_attention(
    v_job.id, 'sql-worker-runtime-one', v_claim.lease_token,
    'TEST_CLEANUP', 'ignored raw test detail', '{"progressCode":"test_cleanup"}'::jsonb
  );
end;
$$;
reset role;

-- The real-catalog role matrix above verifies that anon/authenticated cannot
-- execute any background-job RPC, including these three JOB-02 projections.
-- Do not invoke a revoked function under those roles on the pinned Supabase
-- Postgres 17 image: supabase/postgres#2112 documents a supautils SIGSEGV in
-- that exact denial path. Restore call-style denial probes only after an
-- upgraded supported image passes the focused reproduction on both legs.
-- https://github.com/supabase/postgres/issues/2112
-- https://github.com/supabase/supautils/releases/tag/v3.2.2

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
  begin
    perform * from public.background_workers_list_safe(null);
    raise exception 'NULL worker-list limit bypassed bounds';
  exception when invalid_parameter_value then
    null;
  end;

  perform public.background_jobs_reconcile('sql-upper-bound', 5000);
end;
$$;

rollback;
