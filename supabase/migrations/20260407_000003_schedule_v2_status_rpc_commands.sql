create or replace function public.schedule_v2_apply_job_patch(
  p_scheduled_job_id uuid,
  p_job_patch jsonb,
  p_forecast_updates jsonb
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_forecast_payload jsonb := coalesce(p_forecast_updates, '[]'::jsonb);
  v_patch record;
  v_updated_job integer;
  v_forecast_count integer;
  v_invalid_forecast_count integer;
  v_updated_forecasts integer;
begin
  if p_scheduled_job_id is null then
    raise exception 'p_scheduled_job_id is required';
  end if;

  if p_job_patch is null or jsonb_typeof(p_job_patch) <> 'object' then
    raise exception 'p_job_patch must be an object';
  end if;

  if jsonb_typeof(v_forecast_payload) <> 'array' then
    raise exception 'p_forecast_updates must be an array';
  end if;

  select *
  into v_patch
  from jsonb_to_record(p_job_patch) as patch(
    mode text,
    forecast_start date,
    forecast_duration_days integer,
    status text,
    actual_start date
  );

  update public.scheduled_jobs jobs
  set
    mode = case when p_job_patch ? 'mode' then v_patch.mode else jobs.mode end,
    forecast_start = case when p_job_patch ? 'forecast_start' then v_patch.forecast_start else jobs.forecast_start end,
    forecast_duration_days = case when p_job_patch ? 'forecast_duration_days' then v_patch.forecast_duration_days else jobs.forecast_duration_days end,
    status = case when p_job_patch ? 'status' then v_patch.status else jobs.status end,
    actual_start = case when p_job_patch ? 'actual_start' then v_patch.actual_start else jobs.actual_start end
  where jobs.id = p_scheduled_job_id;

  get diagnostics v_updated_job = row_count;
  if v_updated_job <> 1 then
    raise exception 'scheduled job not found';
  end if;

  select count(*), count(*) filter (where id is null or forecast_duration_days is null or forecast_duration_days <= 0)
  into v_forecast_count, v_invalid_forecast_count
  from jsonb_to_recordset(v_forecast_payload) as rows(
    id uuid,
    forecast_start date,
    forecast_end_exclusive date,
    forecast_duration_days integer
  );

  if v_invalid_forecast_count > 0 then
    raise exception 'p_forecast_updates contains invalid entries';
  end if;

  if v_forecast_count > 0 then
    update public.scheduled_jobs jobs
    set
      forecast_start = parsed.forecast_start,
      forecast_end_exclusive = parsed.forecast_end_exclusive,
      forecast_duration_days = parsed.forecast_duration_days
    from (
      select id, forecast_start, forecast_end_exclusive, forecast_duration_days
      from jsonb_to_recordset(v_forecast_payload) as rows(
        id uuid,
        forecast_start date,
        forecast_end_exclusive date,
        forecast_duration_days integer
      )
    ) parsed
    where jobs.id = parsed.id;

    get diagnostics v_updated_forecasts = row_count;
    if v_updated_forecasts <> v_forecast_count then
      raise exception 'failed to update every scheduled job forecast';
    end if;
  else
    v_updated_forecasts := 0;
  end if;

  return jsonb_build_object(
    'updated_job', p_scheduled_job_id,
    'updated_forecasts', v_updated_forecasts
  );
end;
$$;

create or replace function public.schedule_v2_apply_commitment(
  p_scheduled_job_id uuid,
  p_job_patch jsonb,
  p_history jsonb,
  p_forecast_updates jsonb
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_forecast_payload jsonb := coalesce(p_forecast_updates, '[]'::jsonb);
  v_job_patch record;
  v_history record;
  v_updated_job integer;
  v_history_inserted integer;
  v_forecast_count integer;
  v_invalid_forecast_count integer;
  v_updated_forecasts integer;
begin
  if p_scheduled_job_id is null then
    raise exception 'p_scheduled_job_id is required';
  end if;

  if p_job_patch is null or jsonb_typeof(p_job_patch) <> 'object' then
    raise exception 'p_job_patch must be an object';
  end if;

  if p_history is null or jsonb_typeof(p_history) <> 'object' then
    raise exception 'p_history must be an object';
  end if;

  if jsonb_typeof(v_forecast_payload) <> 'array' then
    raise exception 'p_forecast_updates must be an array';
  end if;

  select *
  into v_job_patch
  from jsonb_to_record(p_job_patch) as patch(
    mode text,
    planned_commitment_type text,
    planned_week_start date,
    planned_start date,
    planned_duration_days integer,
    planned_flex_days integer,
    planned_locked_at timestamptz,
    planned_locked_by text,
    client_update_status text,
    client_update_needed_at timestamptz,
    client_update_ack_at timestamptz,
    client_update_ack_by text,
    forecast_start date
  );

  update public.scheduled_jobs jobs
  set
    mode = case when p_job_patch ? 'mode' then v_job_patch.mode else jobs.mode end,
    planned_commitment_type = case when p_job_patch ? 'planned_commitment_type' then v_job_patch.planned_commitment_type else jobs.planned_commitment_type end,
    planned_week_start = case when p_job_patch ? 'planned_week_start' then v_job_patch.planned_week_start else jobs.planned_week_start end,
    planned_start = case when p_job_patch ? 'planned_start' then v_job_patch.planned_start else jobs.planned_start end,
    planned_duration_days = case when p_job_patch ? 'planned_duration_days' then v_job_patch.planned_duration_days else jobs.planned_duration_days end,
    planned_flex_days = case when p_job_patch ? 'planned_flex_days' then v_job_patch.planned_flex_days else jobs.planned_flex_days end,
    planned_locked_at = case when p_job_patch ? 'planned_locked_at' then v_job_patch.planned_locked_at else jobs.planned_locked_at end,
    planned_locked_by = case when p_job_patch ? 'planned_locked_by' then v_job_patch.planned_locked_by else jobs.planned_locked_by end,
    client_update_status = case when p_job_patch ? 'client_update_status' then v_job_patch.client_update_status else jobs.client_update_status end,
    client_update_needed_at = case when p_job_patch ? 'client_update_needed_at' then v_job_patch.client_update_needed_at else jobs.client_update_needed_at end,
    client_update_ack_at = case when p_job_patch ? 'client_update_ack_at' then v_job_patch.client_update_ack_at else jobs.client_update_ack_at end,
    client_update_ack_by = case when p_job_patch ? 'client_update_ack_by' then v_job_patch.client_update_ack_by else jobs.client_update_ack_by end,
    forecast_start = case when p_job_patch ? 'forecast_start' then v_job_patch.forecast_start else jobs.forecast_start end
  where jobs.id = p_scheduled_job_id;

  get diagnostics v_updated_job = row_count;
  if v_updated_job <> 1 then
    raise exception 'scheduled job not found';
  end if;

  select *
  into v_history
  from jsonb_to_record(p_history) as entry(
    event_type text,
    commitment_type text,
    planned_week_start date,
    planned_start date,
    planned_duration_days integer,
    planned_flex_days integer,
    hard_lock boolean,
    changed_by text
  );

  insert into public.planned_commitment_history (
    scheduled_job_id,
    event_type,
    commitment_type,
    planned_week_start,
    planned_start,
    planned_duration_days,
    planned_flex_days,
    hard_lock,
    changed_by
  )
  values (
    p_scheduled_job_id,
    v_history.event_type,
    v_history.commitment_type,
    v_history.planned_week_start,
    v_history.planned_start,
    v_history.planned_duration_days,
    v_history.planned_flex_days,
    coalesce(v_history.hard_lock, false),
    v_history.changed_by
  );

  get diagnostics v_history_inserted = row_count;
  if v_history_inserted <> 1 then
    raise exception 'failed to record commitment history';
  end if;

  select count(*), count(*) filter (where id is null or forecast_duration_days is null or forecast_duration_days <= 0)
  into v_forecast_count, v_invalid_forecast_count
  from jsonb_to_recordset(v_forecast_payload) as rows(
    id uuid,
    forecast_start date,
    forecast_end_exclusive date,
    forecast_duration_days integer
  );

  if v_invalid_forecast_count > 0 then
    raise exception 'p_forecast_updates contains invalid entries';
  end if;

  if v_forecast_count > 0 then
    update public.scheduled_jobs jobs
    set
      forecast_start = parsed.forecast_start,
      forecast_end_exclusive = parsed.forecast_end_exclusive,
      forecast_duration_days = parsed.forecast_duration_days
    from (
      select id, forecast_start, forecast_end_exclusive, forecast_duration_days
      from jsonb_to_recordset(v_forecast_payload) as rows(
        id uuid,
        forecast_start date,
        forecast_end_exclusive date,
        forecast_duration_days integer
      )
    ) parsed
    where jobs.id = parsed.id;

    get diagnostics v_updated_forecasts = row_count;
    if v_updated_forecasts <> v_forecast_count then
      raise exception 'failed to update every scheduled job forecast';
    end if;
  else
    v_updated_forecasts := 0;
  end if;

  return jsonb_build_object(
    'updated_job', p_scheduled_job_id,
    'history_inserted', true,
    'updated_forecasts', v_updated_forecasts
  );
end;
$$;

create or replace function public.schedule_v2_ack_client_update(
  p_scheduled_job_id uuid,
  p_ack_at timestamptz,
  p_ack_by text
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_updated_job integer;
begin
  if p_scheduled_job_id is null then
    raise exception 'p_scheduled_job_id is required';
  end if;

  if p_ack_at is null then
    raise exception 'p_ack_at is required';
  end if;

  update public.scheduled_jobs
  set
    client_update_status = 'acknowledged',
    client_update_ack_at = p_ack_at,
    client_update_ack_by = p_ack_by
  where id = p_scheduled_job_id;

  get diagnostics v_updated_job = row_count;
  if v_updated_job <> 1 then
    raise exception 'scheduled job not found';
  end if;

  return jsonb_build_object(
    'updated_job', p_scheduled_job_id,
    'acknowledged', true
  );
end;
$$;

grant execute on function public.schedule_v2_apply_job_patch(uuid, jsonb, jsonb) to anon, authenticated;
grant execute on function public.schedule_v2_apply_commitment(uuid, jsonb, jsonb, jsonb) to anon, authenticated;
grant execute on function public.schedule_v2_ack_client_update(uuid, timestamptz, text) to anon, authenticated;

notify pgrst, 'reload schema';
