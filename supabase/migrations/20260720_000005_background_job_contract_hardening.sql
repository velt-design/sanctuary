-- Wave 3 JOB-01 hardening: explicit safe-summary contracts, frozen effect
-- policy, queue-pointer repair, and capability-safe inspection projections.

alter table public.background_job_kinds
  add column allowed_effect_kinds text[] not null default '{}'::text[];

update public.background_job_kinds
set allowed_effect_kinds = required_effect_kinds;

alter table public.background_job_kinds
  add constraint background_job_kinds_allowed_effect_kinds_valid
    check (public.background_job_effect_kind_array_valid(allowed_effect_kinds)),
  add constraint background_job_kinds_required_effects_allowed
    check (required_effect_kinds <@ allowed_effect_kinds),
  add constraint background_job_kinds_external_effect_policy_consistent
    check (
      (has_external_side_effect and cardinality(allowed_effect_kinds) > 0)
      or (
        not has_external_side_effect
        and cardinality(allowed_effect_kinds) = 0
        and cardinality(required_effect_kinds) = 0
      )
    );

-- Snapshot completion policy on acceptance. A later registry contract version
-- cannot silently change the obligations of an already durable logical job.
alter table public.background_jobs
  add column has_external_side_effect boolean,
  add column allowed_effect_kinds text[],
  add column required_effect_kinds text[],
  add column cancellation_allowed boolean;

update public.background_jobs job
set has_external_side_effect = job_kind.has_external_side_effect,
    allowed_effect_kinds = job_kind.allowed_effect_kinds,
    required_effect_kinds = job_kind.required_effect_kinds,
    cancellation_allowed = job_kind.cancellation_allowed
from public.background_job_kinds job_kind
where job_kind.kind = job.kind;

alter table public.background_jobs
  alter column has_external_side_effect set not null,
  alter column allowed_effect_kinds set not null,
  alter column required_effect_kinds set not null,
  alter column cancellation_allowed set not null,
  alter column allowed_effect_kinds set default '{}'::text[],
  alter column required_effect_kinds set default '{}'::text[],
  add constraint background_jobs_allowed_effect_kinds_valid
    check (public.background_job_effect_kind_array_valid(allowed_effect_kinds)),
  add constraint background_jobs_required_effect_kinds_valid
    check (public.background_job_effect_kind_array_valid(required_effect_kinds)),
  add constraint background_jobs_required_effects_allowed
    check (required_effect_kinds <@ allowed_effect_kinds),
  add constraint background_jobs_external_effect_policy_consistent
    check (
      (has_external_side_effect and cardinality(allowed_effect_kinds) > 0)
      or (
        not has_external_side_effect
        and cardinality(allowed_effect_kinds) = 0
        and cardinality(required_effect_kinds) = 0
      )
    );

-- A JOB-01 kind currently declares at most one logical operation for each
-- external effect kind. Different keys cannot be used to hide an unfinished
-- duplicate behind one finalised checkpoint.
alter table public.background_job_effects
  add constraint background_job_effects_job_effect_kind_unique unique (job_id, effect_kind);

create or replace function private.background_job_safe_string_value(p_value text)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select p_value is not null
    and length(p_value) <= 1024
    and btrim(p_value) !~* '[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}'
    and btrim(p_value) !~* '(^|[^A-Z0-9_])[A-Z][A-Z0-9+.-]{1,31}://'
    and btrim(p_value) !~* '(^|[^A-Z0-9_-])([A-Z0-9-]+\.)+(app|au|co|com|dev|io|net|org|test)(:[0-9]+)?([/?#]|$)'
    and btrim(p_value) !~* '(^|[?&;[:space:]])(access[_-]?token|api[_-]?key|authorization|code|credential|key|secret|signature|sig|token|x-amz-credential|x-amz-signature|x-goog-signature)='
    and btrim(p_value) !~* '(^|[^A-Z0-9_])(bearer|basic)[[:space:]][A-Z0-9+/_=-]{4,}'
    and btrim(p_value) !~ '(^|[^A-Za-z0-9_])eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{4,}[A-Za-z0-9_]($|[^A-Za-z0-9_])'
    and btrim(p_value) !~* '^(api[_-]?key|bearer|key|pk|secret|sig|sk|token)[._:-][A-Za-z0-9+/_=-]{16,}$'
    and btrim(p_value) !~* '-----BEGIN[[:space:]][A-Z0-9 ]*(PRIVATE KEY|CREDENTIAL|TOKEN)-----'
    and btrim(p_value) !~* '^[0-9A-F]{32,}$'
    and btrim(p_value) !~ '^[A-Za-z0-9+/_-]{48,}={0,2}$';
$$;

create or replace function private.background_job_compact_json_bytes(p_value jsonb)
returns bigint
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  v_key text;
  v_child jsonb;
  v_count integer := 0;
  v_bytes bigint := 0;
begin
  if p_value is null then
    return 4;
  end if;

  if jsonb_typeof(p_value) = 'object' then
    v_bytes := 2;
    for v_key, v_child in select key, value from jsonb_each(p_value)
    loop
      if v_count > 0 then
        v_bytes := v_bytes + 1;
      end if;
      v_bytes := v_bytes
        + octet_length(to_jsonb(v_key)::text)
        + 1
        + private.background_job_compact_json_bytes(v_child);
      v_count := v_count + 1;
    end loop;
    return v_bytes;
  elsif jsonb_typeof(p_value) = 'array' then
    v_bytes := 2;
    for v_child in select value from jsonb_array_elements(p_value)
    loop
      if v_count > 0 then
        v_bytes := v_bytes + 1;
      end if;
      v_bytes := v_bytes + private.background_job_compact_json_bytes(v_child);
      v_count := v_count + 1;
    end loop;
    return v_bytes;
  elsif jsonb_typeof(p_value) = 'number' then
    return octet_length(trim_scale((p_value #>> '{}')::numeric)::text);
  end if;

  return octet_length(p_value::text);
end;
$$;

create or replace function public.background_job_safe_json(p_value jsonb)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  v_key text;
  v_child jsonb;
begin
  if p_value is null then
    return true;
  end if;
  if private.background_job_compact_json_bytes(p_value) > 8192 then
    return false;
  end if;

  if jsonb_typeof(p_value) = 'object' then
    for v_key, v_child in select key, value from jsonb_each(p_value)
    loop
      if v_key ~* '(email|recipient|token|secret|password|body|html|attachment|content|api.?key)'
         or not public.background_job_safe_json(v_child) then
        return false;
      end if;
    end loop;
  elsif jsonb_typeof(p_value) = 'array' then
    for v_child in select value from jsonb_array_elements(p_value)
    loop
      if not public.background_job_safe_json(v_child) then
        return false;
      end if;
    end loop;
  elsif jsonb_typeof(p_value) = 'string'
        and not private.background_job_safe_string_value(p_value #>> '{}') then
    return false;
  elsif jsonb_typeof(p_value) not in ('string', 'number', 'boolean', 'null') then
    return false;
  end if;

  return true;
end;
$$;

create or replace function private.background_job_safe_code(p_value text)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select length(p_value) between 1 and 96
    and (
      p_value ~ '^[a-z][a-z0-9]*([._:-][a-z0-9]+)*$'
      or p_value ~ '^[A-Z][A-Z0-9]*([._:-][A-Z0-9]+)*$'
    )
    and private.background_job_safe_string_value(p_value);
$$;

create or replace function private.background_job_safe_identifier(p_value text)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select length(p_value) between 1 and 128
    and p_value ~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$'
    and p_value ~ '[0-9]'
    and private.background_job_safe_string_value(p_value);
$$;

create or replace function private.background_job_safe_timestamp(p_value text)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  v_year integer;
  v_month integer;
  v_day integer;
  v_hour integer;
  v_minute integer;
  v_second integer;
  v_offset_hour integer := 0;
  v_offset_minute integer := 0;
  v_offset text;
begin
  if length(p_value) not between 20 and 35
     or p_value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$' then
    return false;
  end if;

  v_year := substring(p_value from 1 for 4)::integer;
  v_month := substring(p_value from 6 for 2)::integer;
  v_day := substring(p_value from 9 for 2)::integer;
  v_hour := substring(p_value from 12 for 2)::integer;
  v_minute := substring(p_value from 15 for 2)::integer;
  v_second := substring(p_value from 18 for 2)::integer;
  v_offset := substring(p_value from '(Z|[+-][0-9]{2}:[0-9]{2})$');
  if v_offset <> 'Z' then
    v_offset_hour := substring(v_offset from 2 for 2)::integer;
    v_offset_minute := substring(v_offset from 5 for 2)::integer;
  end if;

  perform make_date(v_year, v_month, v_day);
  return v_year >= 2000
    and v_hour between 0 and 23
    and v_minute between 0 and 59
    and v_second between 0 and 59
    and v_offset_hour between 0 and 14
    and v_offset_minute between 0 and 59
    and (v_offset_hour < 14 or v_offset_minute = 0);
exception when datetime_field_overflow or invalid_datetime_format or invalid_text_representation then
  return false;
end;
$$;

create or replace function public.background_job_safe_summary(
  p_context text,
  p_value jsonb
)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  v_key text;
  v_child jsonb;
  v_item jsonb;
  v_text text;
  v_numeric numeric;
  v_code_keys constant text[] := array['phase', 'progressCode'];
  v_result_code_keys constant text[] := array['phase', 'resultCode'];
  v_effect_code_keys constant text[] := array['effectKind', 'checkpoint', 'resultCode', 'providerName'];
  v_event_code_keys constant text[] := array[
    'phase', 'progressCode', 'resultCode', 'effectKind', 'checkpoint', 'providerName',
    'reason', 'kind', 'owner'
  ];
  v_progress_count_keys constant text[] := array[
    'currentCount', 'totalCount', 'processedCount', 'completedCount', 'succeededCount',
    'failedCount', 'skippedCount', 'artifactCount', 'fileCount', 'pageCount'
  ];
  v_result_count_keys constant text[] := array[
    'artifactCount', 'fileCount', 'pageCount', 'processedCount', 'succeededCount',
    'failedCount', 'skippedCount'
  ];
  v_effect_count_keys constant text[] := array['attemptNumber', 'providerStatusCode', 'durationMs'];
  v_event_count_keys constant text[] := array[
    'currentCount', 'totalCount', 'processedCount', 'completedCount', 'succeededCount',
    'failedCount', 'skippedCount', 'artifactCount', 'fileCount', 'pageCount',
    'attemptNumber', 'providerStatusCode', 'durationMs', 'delaySeconds', 'queueMessageId'
  ];
  v_worker_count_keys constant text[] := array[
    'globalConcurrency', 'activeJobCount', 'availableConcurrency', 'queueDepth',
    'processedCount', 'succeededCount', 'failedCount', 'retryingCount', 'staleLeaseCount',
    'uptimeSeconds', 'heartbeatIntervalSeconds'
  ];
  v_result_id_keys constant text[] := array[
    'artifactId', 'documentId', 'invoiceId', 'quoteId', 'jobPackId', 'outboxId', 'automationEventId'
  ];
  v_effect_id_keys constant text[] := array['effectId', 'providerMessageId'];
  v_event_id_keys constant text[] := array[
    'artifactId', 'documentId', 'invoiceId', 'quoteId', 'jobPackId', 'outboxId',
    'automationEventId', 'effectId', 'providerMessageId', 'jobId'
  ];
  v_progress_boolean_keys constant text[] := array['cached', 'reused', 'retryable'];
  v_result_boolean_keys constant text[] := array['cached', 'reused', 'providerAccepted'];
  v_effect_boolean_keys constant text[] := array['providerAccepted', 'retryable'];
  v_event_boolean_keys constant text[] := array['cached', 'reused', 'retryable', 'providerAccepted'];
  v_worker_boolean_keys constant text[] := array['acceptingJobs', 'drainRequested'];
  v_progress_timestamp_keys constant text[] := array['startedAt', 'updatedAt', 'completedAt'];
  v_result_timestamp_keys constant text[] := array['generatedAt', 'providerAcceptedAt', 'completedAt'];
  v_effect_timestamp_keys constant text[] := array['dispatchStartedAt', 'providerAcceptedAt', 'finalisedAt'];
  v_event_timestamp_keys constant text[] := array[
    'startedAt', 'updatedAt', 'completedAt', 'generatedAt', 'providerAcceptedAt',
    'dispatchStartedAt', 'finalisedAt', 'occurredAt'
  ];
  v_worker_timestamp_keys constant text[] := array[
    'startedAt', 'lastHeartbeatAt', 'shutdownRequestedAt'
  ];
begin
  if p_context is null
     or p_context not in ('progress', 'result', 'effect', 'event', 'worker')
     or p_value is null
     or jsonb_typeof(p_value) <> 'object'
     or private.background_job_compact_json_bytes(p_value) > 8192 then
    return false;
  end if;

  for v_key, v_child in select key, value from jsonb_each(p_value)
  loop
    if jsonb_typeof(v_child) in ('object', 'null') then
      if not (p_context in ('effect', 'event') and v_key = 'previousCheckpoint' and jsonb_typeof(v_child) = 'null') then
        return false;
      end if;
      continue;
    end if;

    if (p_context = 'progress' and v_key = any(v_code_keys))
       or (p_context = 'result' and v_key = any(v_result_code_keys))
       or (p_context = 'effect' and v_key = any(v_effect_code_keys || array['previousCheckpoint']))
       or (p_context = 'event' and v_key = any(v_event_code_keys || array['previousCheckpoint']))
       or (p_context = 'worker' and v_key = any(array['mode', 'lifecycleState', 'buildVersion'])) then
      if jsonb_typeof(v_child) <> 'string'
         or not private.background_job_safe_code(v_child #>> '{}') then
        return false;
      end if;
      continue;
    end if;

    if (p_context = 'result' and v_key = any(v_result_id_keys))
       or (p_context = 'effect' and v_key = any(v_effect_id_keys))
       or (p_context = 'event' and v_key = any(v_event_id_keys)) then
      if jsonb_typeof(v_child) <> 'string'
         or not private.background_job_safe_identifier(v_child #>> '{}') then
        return false;
      end if;
      continue;
    end if;

    if (p_context = 'progress' and v_key = any(v_progress_count_keys))
       or (p_context = 'result' and v_key = any(v_result_count_keys))
       or (p_context = 'effect' and v_key = any(v_effect_count_keys))
       or (p_context = 'event' and v_key = any(v_event_count_keys))
       or (p_context = 'worker' and v_key = any(v_worker_count_keys)) then
      if jsonb_typeof(v_child) <> 'number' then
        return false;
      end if;
      v_numeric := (v_child #>> '{}')::numeric;
      if v_numeric < 0
         or v_numeric <> trunc(v_numeric)
         or v_numeric > 9007199254740991 then
        return false;
      end if;
      continue;
    end if;

    if p_context in ('progress', 'event') and v_key = 'percentComplete' then
      if jsonb_typeof(v_child) <> 'number'
         or (v_child #>> '{}')::numeric not between 0 and 100
         or scale(trim_scale((v_child #>> '{}')::numeric)) > 6 then
        return false;
      end if;
      continue;
    end if;

    if (p_context = 'progress' and v_key = any(v_progress_boolean_keys))
       or (p_context = 'result' and v_key = any(v_result_boolean_keys))
       or (p_context = 'effect' and v_key = any(v_effect_boolean_keys))
       or (p_context = 'event' and v_key = any(v_event_boolean_keys))
       or (p_context = 'worker' and v_key = any(v_worker_boolean_keys)) then
      if jsonb_typeof(v_child) <> 'boolean' then
        return false;
      end if;
      continue;
    end if;

    if (p_context = 'progress' and v_key = any(v_progress_timestamp_keys))
       or (p_context = 'result' and v_key = any(v_result_timestamp_keys))
       or (p_context = 'effect' and v_key = any(v_effect_timestamp_keys))
       or (p_context = 'event' and v_key = any(v_event_timestamp_keys))
       or (p_context = 'worker' and v_key = any(v_worker_timestamp_keys)) then
      if jsonb_typeof(v_child) <> 'string'
         or not private.background_job_safe_timestamp(v_child #>> '{}') then
        return false;
      end if;
      continue;
    end if;

    if (p_context in ('progress', 'event') and v_key = any(array['completedPhases', 'pendingPhases']))
       or (p_context = 'worker' and v_key = any(array['supportedKinds', 'concurrencyClasses'])) then
      if jsonb_typeof(v_child) <> 'array' or jsonb_array_length(v_child) > 50 then
        return false;
      end if;
      for v_item in select value from jsonb_array_elements(v_child)
      loop
        if jsonb_typeof(v_item) <> 'string'
           or not private.background_job_safe_code(v_item #>> '{}') then
          return false;
        end if;
      end loop;
      continue;
    end if;

    if p_context in ('result', 'event') and v_key = any(array['artifactIds', 'documentIds']) then
      if jsonb_typeof(v_child) <> 'array' or jsonb_array_length(v_child) > 50 then
        return false;
      end if;
      for v_item in select value from jsonb_array_elements(v_child)
      loop
        if jsonb_typeof(v_item) <> 'string'
           or not private.background_job_safe_identifier(v_item #>> '{}') then
          return false;
        end if;
      end loop;
      continue;
    end if;

    return false;
  end loop;

  return public.background_job_safe_json(p_value);
exception when numeric_value_out_of_range then
  return false;
end;
$$;

alter table public.background_jobs
  add constraint background_jobs_safe_progress_contract
    check (public.background_job_safe_summary('progress', safe_progress)),
  add constraint background_jobs_safe_result_contract
    check (public.background_job_safe_summary('result', safe_result)),
  add constraint background_jobs_error_message_defence
    check (error_message is null or private.background_job_safe_string_value(error_message)),
  add constraint background_jobs_cancellation_reason_contract
    check (cancellation_reason is null or private.background_job_safe_code(cancellation_reason));

alter table public.background_job_effects
  add constraint background_job_effects_safe_metadata_contract
    check (public.background_job_safe_summary('effect', safe_metadata));

alter table public.background_job_events
  add constraint background_job_events_safe_detail_contract
    check (public.background_job_safe_summary('event', safe_detail));

alter table public.background_workers
  add constraint background_workers_safe_metadata_contract
    check (public.background_job_safe_summary('worker', safe_metadata));

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
    when p_error_code = 'QUEUE_CONTRACT_MISMATCH' then 'Queue contract version does not match the durable job.'
    when p_error_code ~ 'TIMEOUT$' then 'The background job timed out.'
    when p_error_code ~ 'CANCEL' then 'The background job was cancelled.'
    else 'The background job could not be completed.'
  end;
$$;

create or replace function private.background_jobs_freeze_effect_policy()
returns trigger
language plpgsql
set search_path = pg_catalog, pg_temp
as $$
declare
  v_kind public.background_job_kinds%rowtype;
begin
  select job_kind.*
  into v_kind
  from public.background_job_kinds job_kind
  where job_kind.kind = new.kind
    and job_kind.contract_version = new.contract_version
    and job_kind.active;

  if not found then
    raise exception 'unknown, inactive, or version-mismatched background-job kind: % v%', new.kind, new.contract_version
      using errcode = '22023';
  end if;

  new.has_external_side_effect := v_kind.has_external_side_effect;
  new.allowed_effect_kinds := v_kind.allowed_effect_kinds;
  new.required_effect_kinds := v_kind.required_effect_kinds;
  new.cancellation_allowed := v_kind.cancellation_allowed;
  return new;
end;
$$;

create trigger background_jobs_freeze_effect_policy_trigger
before insert on public.background_jobs
for each row execute function private.background_jobs_freeze_effect_policy();

create or replace function private.background_jobs_effect_policy_immutable()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if old.kind is distinct from new.kind
     or old.contract_version is distinct from new.contract_version
     or old.has_external_side_effect is distinct from new.has_external_side_effect
     or old.allowed_effect_kinds is distinct from new.allowed_effect_kinds
     or old.required_effect_kinds is distinct from new.required_effect_kinds
     or old.cancellation_allowed is distinct from new.cancellation_allowed then
    raise exception 'accepted background-job effect policy is immutable; create a new logical intent'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger background_jobs_effect_policy_immutable_trigger
before update on public.background_jobs
for each row execute function private.background_jobs_effect_policy_immutable();

create or replace function private.background_job_queue_message_matches(
  p_message jsonb,
  p_job_id uuid,
  p_contract_version integer
)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select p_message = jsonb_build_object(
    'jobId', p_job_id,
    'contractVersion', p_contract_version
  );
$$;

-- Extend visibility only when the ledger pointer and the minimal queue body
-- agree. A missing, archived, or stale pointer is repaired in the same
-- transaction before the caller may release its application lease.
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

  if v_message_found
     and private.background_job_queue_message_matches(
       v_message.message,
       p_job_id,
       p_contract_version
     ) then
    return p_message_id;
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
  v_job public.background_jobs%rowtype;
  v_message jsonb;
  v_archived boolean := false;
begin
  select job.*
  into strict v_job
  from public.background_jobs job
  where job.id = p_job_id
  for update;

  select queue_message.message
  into v_message
  from pgmq.q_portal_background_jobs queue_message
  where queue_message.msg_id = p_message_id;

  if found
     and private.background_job_queue_message_matches(v_message, v_job.id, v_job.contract_version) then
    select pgmq.archive('portal_background_jobs', p_message_id)
    into v_archived;
  end if;

  if v_archived is distinct from true then
    perform private.background_job_insert_event(
      v_job.id,
      p_message_id,
      'queue_archive_missing',
      v_job.status,
      v_job.status,
      v_job.current_phase,
      v_job.attempt_count,
      v_job.lease_owner,
      null,
      'QUEUE_MESSAGE_MISSING',
      jsonb_build_object('reason', 'missing_or_stale_canonical_message')
    );
  end if;
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

-- A replacement worker must recover the exact frozen provider identity rather
-- than reconstructing expiry timestamps or provider acknowledgements from
-- process memory. The same lease fence used by mutations protects this view.
create function public.background_job_read_effects(
  p_job_id uuid,
  p_worker_id text,
  p_lease_token uuid
)
returns table (
  effect_key text,
  effect_kind text,
  state public.background_job_effect_state,
  payload_hash text,
  provider_name text,
  provider_idempotency_key text,
  provider_idempotency_expires_at timestamptz,
  provider_message_id text,
  safe_metadata jsonb
)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_job public.background_jobs%rowtype;
begin
  v_job := private.background_job_lock_owned(p_job_id, p_worker_id, p_lease_token);

  return query
  select
    effect.effect_key,
    effect.effect_kind,
    effect.state,
    effect.payload_hash,
    effect.provider_name,
    effect.provider_idempotency_key,
    effect.provider_idempotency_expires_at,
    effect.provider_message_id,
    effect.safe_metadata
  from public.background_job_effects effect
  where effect.job_id = v_job.id
  order by effect.effect_kind, effect.effect_key;
end;
$$;

revoke all on function public.background_job_read_effects(uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.background_job_read_effects(uuid, text, uuid) to service_role;

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
  if not public.background_job_safe_summary('result', coalesce(p_safe_result, '{}'::jsonb)) then
    raise exception 'unsafe background-job result summary' using errcode = '22023';
  end if;
  if exists (
    select 1
    from public.background_job_effects effect
    where effect.job_id = p_job_id
      and not (effect.effect_kind = any(v_job.allowed_effect_kinds))
  ) then
    raise exception 'job has an undeclared external effect checkpoint' using errcode = '22023';
  end if;
  if v_job.execution_owner = 'shadow' and exists (
    select 1
    from public.background_job_effects effect
    where effect.job_id = p_job_id
      and effect.state <> 'prepared'
  ) then
    raise exception 'shadow jobs can complete only with non-dispatched prepared effects'
      using errcode = '22023';
  end if;
  if v_job.execution_owner <> 'shadow' and exists (
    select 1
    from public.background_job_effects effect
    where effect.job_id = p_job_id
      and effect.state <> 'finalised'
  ) then
    raise exception 'every recorded external effect must be finalised before job completion'
      using errcode = '22023';
  end if;

  select required_effect.effect_kind
  into v_missing_effect_kind
  from unnest(v_job.required_effect_kinds) as required_effect(effect_kind)
  where v_job.execution_owner <> 'shadow'
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
    'retry'
  );

  update public.background_jobs
  set status = 'retrying',
      current_phase = 'retry_wait',
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
  v_message_id bigint;
begin
  if p_visibility_timeout_seconds is null or p_visibility_timeout_seconds not between 15 and 3600 then
    raise exception 'visibility timeout must be between 15 and 3600 seconds' using errcode = '22023';
  end if;

  v_job := private.background_job_lock_owned(p_job_id, p_worker_id, p_lease_token);
  v_message_id := private.background_job_set_visibility_or_repair(
    v_job.id,
    v_job.contract_version,
    v_job.queue_message_id,
    p_visibility_timeout_seconds,
    p_worker_id,
    'heartbeat'
  );

  update public.background_jobs
  set queue_message_id = v_message_id,
      lease_expires_at = now() + make_interval(secs => p_visibility_timeout_seconds),
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
  v_message_id bigint;
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

  if v_job.execution_owner <> 'shadow' and exists (
    select 1
    from public.background_job_effects effect
    where effect.job_id = p_job_id
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
      'PROVIDER_IDEMPOTENCY_WINDOW_EXPIRED',
      jsonb_build_object('reason', 'provider_idempotency_window_expired')
    );
    return v_job;
  end if;

  v_message_id := private.background_job_set_visibility_or_repair(
    v_job.id,
    v_job.contract_version,
    v_job.queue_message_id,
    0,
    p_worker_id,
    'lease_release'
  );

  update public.background_jobs
  set status = 'retrying',
      current_phase = 'lease_released',
      next_attempt_at = now(),
      queue_message_id = v_message_id,
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
  if not public.background_job_safe_summary('progress', coalesce(p_safe_detail, '{}'::jsonb)) then
    raise exception 'unsafe background-job attention detail' using errcode = '22023';
  end if;
  v_previous_status := v_job.status;

  update public.background_job_effects
  set state = 'uncertain'
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
  if not public.background_job_safe_summary('event', coalesce(p_safe_detail, '{}'::jsonb)) then
    raise exception 'unsafe background-job event detail' using errcode = '22023';
  end if;

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
  if not public.background_job_safe_summary('progress', coalesce(p_safe_progress, '{}'::jsonb)) then
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
  if not public.background_job_safe_summary('worker', coalesce(p_safe_metadata, '{}'::jsonb)) then
    raise exception 'unsafe background-worker metadata' using errcode = '22023';
  end if;

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
  v_previous_status public.background_job_status;
begin
  if p_reason is not null and not private.background_job_safe_code(p_reason) then
    raise exception 'cancellation reason must be a safe reason code' using errcode = '22023';
  end if;

  select job.* into v_job from public.background_jobs job where job.id = p_job_id for update;
  if not found then
    raise exception 'background job not found' using errcode = 'P0002';
  end if;
  if v_job.status in ('succeeded', 'cancelled', 'needs_attention', 'permanent_failed') then
    return v_job;
  end if;

  if not v_job.cancellation_allowed then
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

      perform private.background_job_archive_canonical(v_job.id, v_job.queue_message_id);

      update public.background_jobs
      set status = 'needs_attention',
          current_phase = 'provider_reconciliation',
          error_code = 'LEASE_EXPIRED_DURING_DISPATCH',
          error_message = private.background_job_safe_error_copy('LEASE_EXPIRED_DURING_DISPATCH'),
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
        'lease_recovery'
      );

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
  if v_job.execution_owner <> 'shadow' and exists (
    select 1 from public.background_job_effects effect
    where effect.job_id = p_job_id
      and effect.state in ('prepared', 'failed', 'uncertain')
      and (
        effect.provider_idempotency_expires_at is null
        or effect.provider_idempotency_expires_at <= now()
      )
  ) then
    raise exception 'expired provider idempotency requires reconciliation or a new explicit intent'
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

-- Keep provider-safety routing inside the proven, bounded PGMQ read loop so
-- no message reaches retry exhaustion before the checks run.
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

    -- Provider-effect safety must be decided inside this bounded queue-read
    -- loop, before retry exhaustion can consume the message and CONTINUE.
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
revoke all on function public.background_jobs_claim(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.background_jobs_claim(text, integer, integer) to service_role;

drop function public.background_job_get_safe(uuid);
drop function public.background_jobs_list_safe(
  uuid,
  text,
  text,
  public.background_job_status[],
  integer
);
drop function public.background_job_event_history_safe(uuid, integer);

create function public.background_job_get_safe(p_job_id uuid)
returns table (
  id uuid,
  kind text,
  contract_version integer,
  subject_type text,
  subject_id text,
  project_id uuid,
  status public.background_job_status,
  current_phase text,
  priority smallint,
  attempt_count integer,
  max_attempts integer,
  next_attempt_at timestamptz,
  cancellation_requested_at timestamptz,
  rollout_mode public.background_job_rollout_mode,
  execution_owner public.background_job_execution_owner,
  safe_progress jsonb,
  safe_result jsonb,
  error_code text,
  created_at timestamptz,
  updated_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz
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
    job.subject_type,
    job.subject_id,
    job.project_id,
    job.status,
    job.current_phase,
    job.priority,
    job.attempt_count,
    job.max_attempts,
    job.next_attempt_at,
    job.cancellation_requested_at,
    job.rollout_mode,
    job.execution_owner,
    job.safe_progress,
    job.safe_result,
    job.error_code,
    job.created_at,
    job.updated_at,
    job.started_at,
    job.completed_at
  from public.background_jobs job
  where job.id = p_job_id;
$$;

create function public.background_jobs_list_safe(
  p_project_id uuid default null,
  p_subject_type text default null,
  p_subject_id text default null,
  p_statuses public.background_job_status[] default null,
  p_limit integer default 100
)
returns table (
  id uuid,
  kind text,
  contract_version integer,
  subject_type text,
  subject_id text,
  project_id uuid,
  status public.background_job_status,
  current_phase text,
  priority smallint,
  attempt_count integer,
  max_attempts integer,
  next_attempt_at timestamptz,
  cancellation_requested_at timestamptz,
  rollout_mode public.background_job_rollout_mode,
  execution_owner public.background_job_execution_owner,
  safe_progress jsonb,
  safe_result jsonb,
  error_code text,
  created_at timestamptz,
  updated_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz
)
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
  select
    job.id,
    job.kind,
    job.contract_version,
    job.subject_type,
    job.subject_id,
    job.project_id,
    job.status,
    job.current_phase,
    job.priority,
    job.attempt_count,
    job.max_attempts,
    job.next_attempt_at,
    job.cancellation_requested_at,
    job.rollout_mode,
    job.execution_owner,
    job.safe_progress,
    job.safe_result,
    job.error_code,
    job.created_at,
    job.updated_at,
    job.started_at,
    job.completed_at
  from public.background_jobs job
  where (p_project_id is null or job.project_id = p_project_id)
    and (p_subject_type is null or job.subject_type = p_subject_type)
    and (p_subject_id is null or job.subject_id = p_subject_id)
    and (p_statuses is null or job.status = any(p_statuses))
  order by job.created_at desc
  limit p_limit;
end;
$$;

create function public.background_job_event_history_safe(
  p_job_id uuid,
  p_limit integer default 200
)
returns table (
  id bigint,
  job_id uuid,
  event_type public.background_job_event_type,
  from_status public.background_job_status,
  to_status public.background_job_status,
  phase text,
  attempt_number integer,
  error_code text,
  safe_detail jsonb,
  created_at timestamptz
)
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
  select
    event.id,
    event.job_id,
    event.event_type,
    event.from_status,
    event.to_status,
    event.phase,
    event.attempt_number,
    event.error_code,
    event.safe_detail,
    event.created_at
  from public.background_job_events event
  where event.job_id = p_job_id
  order by event.created_at, event.id
  limit p_limit;
end;
$$;

revoke all on function private.background_job_safe_string_value(text)
  from public, anon, authenticated, service_role;
revoke all on function private.background_job_compact_json_bytes(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.background_job_safe_code(text)
  from public, anon, authenticated, service_role;
revoke all on function private.background_job_safe_identifier(text)
  from public, anon, authenticated, service_role;
revoke all on function private.background_job_safe_timestamp(text)
  from public, anon, authenticated, service_role;
revoke all on function private.background_job_safe_error_copy(text)
  from public, anon, authenticated, service_role;
revoke all on function private.background_jobs_freeze_effect_policy()
  from public, anon, authenticated, service_role;
revoke all on function private.background_jobs_effect_policy_immutable()
  from public, anon, authenticated, service_role;
revoke all on function private.background_job_queue_message_matches(jsonb, uuid, integer)
  from public, anon, authenticated, service_role;
revoke all on function private.background_job_set_visibility_or_repair(
  uuid, integer, bigint, integer, text, text
) from public, anon, authenticated, service_role;

revoke all on function public.background_job_safe_json(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.background_job_safe_summary(text, jsonb)
  from public, anon, authenticated, service_role;

-- Supabase grants service_role EXECUTE on new public functions through its
-- project-wide default privileges. Remove that inherited capability from
-- constraint/trigger helpers; worker access remains the explicit RPC allowlist
-- granted below and in the preceding migrations.
revoke all on function public.background_job_transition_allowed(
  public.background_job_status, public.background_job_status
) from service_role;
revoke all on function public.background_job_effect_transition_allowed(
  public.background_job_effect_state, public.background_job_effect_state
) from service_role;
revoke all on function public.background_job_effect_kind_array_valid(text[])
  from service_role;
revoke all on function public.background_jobs_before_update()
  from service_role;
revoke all on function public.background_job_effects_before_update()
  from service_role;
revoke all on function public.background_job_events_append_only()
  from service_role;

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
