create or replace function public.schedule_v2_update_downtime(
  p_downtime_id uuid,
  p_patch jsonb,
  p_forecast_updates jsonb
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_forecast_payload jsonb := coalesce(p_forecast_updates, '[]'::jsonb);
  v_patch record;
  v_updated_downtime integer;
  v_forecast_count integer;
  v_invalid_forecast_count integer;
  v_updated_forecasts integer;
begin
  if p_downtime_id is null then
    raise exception 'p_downtime_id is required';
  end if;

  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'p_patch must be an object';
  end if;

  if jsonb_typeof(v_forecast_payload) <> 'array' then
    raise exception 'p_forecast_updates must be an array';
  end if;

  select *
  into v_patch
  from jsonb_to_record(p_patch) as patch(
    duration_days integer,
    reason text,
    note text
  );

  if v_patch.duration_days is null or v_patch.duration_days <= 0 then
    raise exception 'p_patch.duration_days must be a positive integer';
  end if;

  update public.crew_downtimes downtimes
  set
    duration_days = v_patch.duration_days,
    reason = case when p_patch ? 'reason' then v_patch.reason else downtimes.reason end,
    note = case when p_patch ? 'note' then v_patch.note else downtimes.note end
  where downtimes.id = p_downtime_id;

  get diagnostics v_updated_downtime = row_count;
  if v_updated_downtime <> 1 then
    raise exception 'downtime not found';
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
    'updated_downtime', p_downtime_id,
    'updated_forecasts', v_updated_forecasts
  );
end;
$$;

grant execute on function public.schedule_v2_update_downtime(uuid, jsonb, jsonb) to authenticated, service_role;

notify pgrst, 'reload schema';
