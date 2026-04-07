create or replace function public.schedule_v2_reorder_queue(
  p_crew_id uuid,
  p_positions jsonb,
  p_forecast_updates jsonb
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_position_count integer;
  v_owned_count integer;
  v_invalid_position_count integer;
  v_updated_items integer;
  v_forecast_count integer;
  v_invalid_forecast_count integer;
  v_updated_forecasts integer;
  v_forecast_payload jsonb := coalesce(p_forecast_updates, '[]'::jsonb);
begin
  if p_crew_id is null then
    raise exception 'p_crew_id is required';
  end if;

  if p_positions is null or jsonb_typeof(p_positions) <> 'array' or jsonb_array_length(p_positions) = 0 then
    raise exception 'p_positions must be a non-empty array';
  end if;

  if jsonb_typeof(v_forecast_payload) <> 'array' then
    raise exception 'p_forecast_updates must be an array';
  end if;

  with parsed_positions as (
    select id, position
    from jsonb_to_recordset(p_positions) as rows(id uuid, position integer)
  )
  select count(*), count(*) filter (where id is null or position is null or position < 0)
  into v_position_count, v_invalid_position_count
  from parsed_positions;

  if v_position_count = 0 or v_invalid_position_count > 0 then
    raise exception 'p_positions contains invalid entries';
  end if;

  select count(*)
  into v_owned_count
  from public.crew_schedule_items
  where crew_id = p_crew_id
    and id in (
      select rows.id
      from jsonb_to_recordset(p_positions) as rows(id uuid, position integer)
    );

  if v_owned_count <> v_position_count then
    raise exception 'p_positions contains items outside the target crew';
  end if;

  with parsed_positions as (
    select id, position
    from jsonb_to_recordset(p_positions) as rows(id uuid, position integer)
  )
  update public.crew_schedule_items items
  set position = parsed_positions.position
  from parsed_positions
  where items.id = parsed_positions.id
    and items.crew_id = p_crew_id;

  get diagnostics v_updated_items = row_count;

  if v_updated_items <> v_position_count then
    raise exception 'Failed to update every crew schedule item';
  end if;

  if jsonb_array_length(v_forecast_payload) > 0 then
    with parsed_forecasts as (
      select id, forecast_start, forecast_end_exclusive, forecast_duration_days
      from jsonb_to_recordset(v_forecast_payload) as rows(
        id uuid,
        forecast_start date,
        forecast_end_exclusive date,
        forecast_duration_days integer
      )
    )
    select count(*), count(*) filter (where id is null or forecast_duration_days is null or forecast_duration_days <= 0)
    into v_forecast_count, v_invalid_forecast_count
    from parsed_forecasts;

    if v_invalid_forecast_count > 0 then
      raise exception 'p_forecast_updates contains invalid entries';
    end if;

    with parsed_forecasts as (
      select id, forecast_start, forecast_end_exclusive, forecast_duration_days
      from jsonb_to_recordset(v_forecast_payload) as rows(
        id uuid,
        forecast_start date,
        forecast_end_exclusive date,
        forecast_duration_days integer
      )
    )
    update public.scheduled_jobs jobs
    set
      forecast_start = parsed_forecasts.forecast_start,
      forecast_end_exclusive = parsed_forecasts.forecast_end_exclusive,
      forecast_duration_days = parsed_forecasts.forecast_duration_days
    from parsed_forecasts
    where jobs.id = parsed_forecasts.id;

    get diagnostics v_updated_forecasts = row_count;

    if v_updated_forecasts <> v_forecast_count then
      raise exception 'Failed to update every scheduled job forecast';
    end if;
  else
    v_forecast_count := 0;
    v_updated_forecasts := 0;
  end if;

  return jsonb_build_object(
    'updated_items', v_updated_items,
    'updated_forecasts', v_updated_forecasts
  );
end;
$$;

create or replace function public.schedule_v2_set_days_remaining(
  p_scheduled_job_id uuid,
  p_days_remaining integer,
  p_forecast_updates jsonb
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_updated_job integer;
  v_forecast_count integer;
  v_invalid_forecast_count integer;
  v_updated_forecasts integer;
  v_forecast_payload jsonb := coalesce(p_forecast_updates, '[]'::jsonb);
begin
  if p_scheduled_job_id is null then
    raise exception 'p_scheduled_job_id is required';
  end if;

  if p_days_remaining is null or p_days_remaining < 0 then
    raise exception 'p_days_remaining must be zero or greater';
  end if;

  if jsonb_typeof(v_forecast_payload) <> 'array' then
    raise exception 'p_forecast_updates must be an array';
  end if;

  update public.scheduled_jobs
  set days_remaining = p_days_remaining
  where id = p_scheduled_job_id;

  get diagnostics v_updated_job = row_count;

  if v_updated_job <> 1 then
    raise exception 'Failed to update scheduled job';
  end if;

  if jsonb_array_length(v_forecast_payload) > 0 then
    with parsed_forecasts as (
      select id, forecast_start, forecast_end_exclusive, forecast_duration_days
      from jsonb_to_recordset(v_forecast_payload) as rows(
        id uuid,
        forecast_start date,
        forecast_end_exclusive date,
        forecast_duration_days integer
      )
    )
    select count(*), count(*) filter (where id is null or forecast_duration_days is null or forecast_duration_days <= 0)
    into v_forecast_count, v_invalid_forecast_count
    from parsed_forecasts;

    if v_invalid_forecast_count > 0 then
      raise exception 'p_forecast_updates contains invalid entries';
    end if;

    with parsed_forecasts as (
      select id, forecast_start, forecast_end_exclusive, forecast_duration_days
      from jsonb_to_recordset(v_forecast_payload) as rows(
        id uuid,
        forecast_start date,
        forecast_end_exclusive date,
        forecast_duration_days integer
      )
    )
    update public.scheduled_jobs jobs
    set
      forecast_start = parsed_forecasts.forecast_start,
      forecast_end_exclusive = parsed_forecasts.forecast_end_exclusive,
      forecast_duration_days = parsed_forecasts.forecast_duration_days
    from parsed_forecasts
    where jobs.id = parsed_forecasts.id;

    get diagnostics v_updated_forecasts = row_count;

    if v_updated_forecasts <> v_forecast_count then
      raise exception 'Failed to update every scheduled job forecast';
    end if;
  else
    v_forecast_count := 0;
    v_updated_forecasts := 0;
  end if;

  return jsonb_build_object(
    'updated_job', p_scheduled_job_id,
    'updated_forecasts', v_updated_forecasts
  );
end;
$$;

grant execute on function public.schedule_v2_reorder_queue(uuid, jsonb, jsonb) to anon, authenticated;
grant execute on function public.schedule_v2_set_days_remaining(uuid, integer, jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
