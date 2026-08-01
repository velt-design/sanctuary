begin;

-- Top-level receipts make an approved stale-enquiry batch safely retryable.
-- Direct table access remains unavailable; the security-definer command is
-- the only write boundary.
create table if not exists public.project_enquiry_close_batches (
  command_id uuid primary key,
  intent_hash text not null,
  actor_user_id uuid not null,
  committed_result jsonb not null,
  created_at timestamptz not null default clock_timestamp()
);

alter table public.project_enquiry_close_batches enable row level security;
revoke all on table public.project_enquiry_close_batches
  from public, anon, authenticated, service_role;

create or replace function public.project_enquiry_bulk_close_v1(
  p_command_id uuid,
  p_report_as_of timestamptz,
  p_inactive_days integer,
  p_candidates jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_now timestamptz := clock_timestamp();
  v_normalized jsonb;
  v_intent_hash text;
  v_receipt public.project_enquiry_close_batches%rowtype;
  v_candidate record;
  v_original record;
  v_current record;
  v_state_version bigint;
  v_child_command_id uuid;
  v_close_result jsonb;
  v_projects jsonb := '[]'::jsonb;
  v_result jsonb;
  v_candidate_count integer;
  v_distinct_count integer;
begin
  if not public.is_portal_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  if p_command_id is null
    or p_report_as_of is null
    or p_inactive_days is null
    or p_inactive_days < 1
    or p_inactive_days > 3650
    or jsonb_typeof(p_candidates) is distinct from 'array'
    or jsonb_array_length(p_candidates) < 1
    or jsonb_array_length(p_candidates) > 100
  then
    raise exception 'invalid stale-enquiry close command'
      using errcode = '22023';
  end if;

  select
    count(*),
    count(distinct candidate.project_id),
    jsonb_agg(
      jsonb_build_object(
        'project_id', candidate.project_id,
        'evidence_fingerprint', candidate.evidence_fingerprint,
        'last_activity_at', candidate.last_activity_at,
        'last_activity_source', candidate.last_activity_source
      )
      order by candidate.project_id
    )
  into v_candidate_count, v_distinct_count, v_normalized
  from (
    select
      (item.value->>'project_id')::uuid as project_id,
      nullif(btrim(item.value->>'evidence_fingerprint'), '') as evidence_fingerprint,
      (item.value->>'last_activity_at')::timestamptz as last_activity_at,
      nullif(btrim(item.value->>'last_activity_source'), '') as last_activity_source
    from jsonb_array_elements(p_candidates) item(value)
  ) candidate;

  if v_candidate_count <> v_distinct_count
    or exists (
      select 1
      from jsonb_array_elements(v_normalized) candidate(value)
      where candidate.value->>'evidence_fingerprint' is null
        or candidate.value->>'last_activity_at' is null
        or candidate.value->>'last_activity_source' is null
    )
  then
    raise exception 'invalid or duplicate stale-enquiry candidates'
      using errcode = '22023';
  end if;

  v_intent_hash := md5(
    jsonb_build_object(
      'report_as_of', p_report_as_of,
      'inactive_days', p_inactive_days,
      'candidates', v_normalized
    )::text
  );
  perform pg_advisory_xact_lock(hashtextextended(p_command_id::text, 41));

  select * into v_receipt
  from public.project_enquiry_close_batches batch
  where batch.command_id = p_command_id;
  if found then
    if v_receipt.intent_hash is distinct from v_intent_hash then
      raise exception 'command id was already used for a different stale-enquiry batch'
        using errcode = '40001';
    end if;
    return v_receipt.committed_result || jsonb_build_object('replayed', true);
  end if;

  -- Lock and validate every selected project before any project is closed.
  -- The original fingerprint proves the submitted row came from the approved
  -- report; the current report proves no newer recorded activity or future
  -- Waiting protection has appeared since that report.
  for v_candidate in
    select
      (candidate.value->>'project_id')::uuid as project_id,
      candidate.value->>'evidence_fingerprint' as evidence_fingerprint,
      (candidate.value->>'last_activity_at')::timestamptz as last_activity_at,
      candidate.value->>'last_activity_source' as last_activity_source
    from jsonb_array_elements(v_normalized) candidate(value)
    order by (candidate.value->>'project_id')::uuid
  loop
    select state.row_version
    into v_state_version
    from public.project_operational_states state
    where state.project_id = v_candidate.project_id
    for update;
    if not found then
      raise exception 'STALE_REVIEW: project state is no longer available for %',
        v_candidate.project_id using errcode = '40001';
    end if;

    select * into v_original
    from public.project_enquiry_inactivity_report_v1(
      p_report_as_of,
      p_inactive_days
    ) report
    where report.project_id = v_candidate.project_id;
    if not found
      or v_original.evidence_fingerprint is distinct from v_candidate.evidence_fingerprint
      or v_original.last_activity_at is distinct from v_candidate.last_activity_at
      or v_original.last_activity_source is distinct from v_candidate.last_activity_source
      or v_original.protected_by_future_wait
    then
      raise exception 'STALE_REVIEW: approved evidence no longer matches project %',
        v_candidate.project_id using errcode = '40001';
    end if;

    select * into v_current
    from public.project_enquiry_inactivity_report_v1(
      clock_timestamp(),
      p_inactive_days
    ) report
    where report.project_id = v_candidate.project_id;
    if not found
      or v_current.last_activity_at is distinct from v_candidate.last_activity_at
      or v_current.last_activity_source is distinct from v_candidate.last_activity_source
      or v_current.protected_by_future_wait
    then
      raise exception 'STALE_REVIEW: project % changed after review; refresh the list',
        v_candidate.project_id using errcode = '40001';
    end if;
  end loop;

  for v_candidate in
    select
      (candidate.value->>'project_id')::uuid as project_id,
      (candidate.value->>'last_activity_at')::timestamptz as last_activity_at,
      candidate.value->>'last_activity_source' as last_activity_source
    from jsonb_array_elements(v_normalized) candidate(value)
    order by (candidate.value->>'project_id')::uuid
  loop
    -- Re-read immediately before the per-project state command as a final
    -- guard against activity arriving during validation. Any later failure
    -- still rolls the complete function transaction back.
    select * into v_current
    from public.project_enquiry_inactivity_report_v1(
      clock_timestamp(),
      p_inactive_days
    ) report
    where report.project_id = v_candidate.project_id;
    if not found
      or v_current.last_activity_at is distinct from v_candidate.last_activity_at
      or v_current.last_activity_source is distinct from v_candidate.last_activity_source
      or v_current.protected_by_future_wait
    then
      raise exception 'STALE_REVIEW: project % changed before close; refresh the list',
        v_candidate.project_id using errcode = '40001';
    end if;
    select state.row_version
    into v_state_version
    from public.project_operational_states state
    where state.project_id = v_candidate.project_id;
    v_child_command_id := md5(
      'inactive-enquiry-close-v1:' || p_command_id::text || ':' ||
      v_candidate.project_id::text
    )::uuid;
    v_close_result := public.project_operational_state_command(
      v_candidate.project_id,
      v_child_command_id,
      'CLOSE',
      jsonb_build_object(
        'expectedRowVersion', v_state_version,
        'outcome', 'LOST_NO_RESPONSE',
        'cancellationReason', 'Project closed as Lost - No response.'
      )
    );
    v_projects := v_projects || jsonb_build_array(
      jsonb_build_object(
        'project_id', v_candidate.project_id,
        'command_id', v_child_command_id,
        'row_version', v_close_result->'row_version',
        'cancelled_count', v_close_result->'cancelled_count'
      )
    );
  end loop;

  v_now := clock_timestamp();
  v_result := jsonb_build_object(
    'command_id', p_command_id,
    'report_as_of', p_report_as_of,
    'revalidated_at', v_now,
    'inactive_days', p_inactive_days,
    'closed_count', v_candidate_count,
    'projects', v_projects,
    'replayed', false
  );
  insert into public.project_enquiry_close_batches(
    command_id,
    intent_hash,
    actor_user_id,
    committed_result
  ) values (p_command_id, v_intent_hash, v_actor, v_result);
  return v_result;
end;
$$;

revoke all on function public.project_enquiry_bulk_close_v1(
  uuid,timestamptz,integer,jsonb
) from public, anon;
grant execute on function public.project_enquiry_bulk_close_v1(
  uuid,timestamptz,integer,jsonb
) to authenticated;

commit;

notify pgrst, 'reload schema';
