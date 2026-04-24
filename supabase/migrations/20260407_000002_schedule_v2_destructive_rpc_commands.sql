create or replace function public.schedule_v2_unassign_job(
  p_scheduled_job_id uuid,
  p_job_item_id uuid,
  p_positions jsonb,
  p_forecast_updates jsonb
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_position_payload jsonb := coalesce(p_positions, '[]'::jsonb);
  v_forecast_payload jsonb := coalesce(p_forecast_updates, '[]'::jsonb);
  v_job_exists boolean;
  v_item_exists boolean;
  v_position_count integer;
  v_invalid_position_count integer;
  v_updated_items integer;
  v_forecast_count integer;
  v_invalid_forecast_count integer;
  v_updated_forecasts integer;
begin
  if p_scheduled_job_id is null then
    raise exception 'p_scheduled_job_id is required';
  end if;

  if p_job_item_id is null then
    raise exception 'p_job_item_id is required';
  end if;

  if jsonb_typeof(v_position_payload) <> 'array' then
    raise exception 'p_positions must be an array';
  end if;

  if jsonb_typeof(v_forecast_payload) <> 'array' then
    raise exception 'p_forecast_updates must be an array';
  end if;

  select exists(select 1 from public.scheduled_jobs where id = p_scheduled_job_id)
  into v_job_exists;
  if not v_job_exists then
    raise exception 'scheduled job not found';
  end if;

  select exists(
    select 1
    from public.crew_schedule_items
    where id = p_job_item_id
      and item_type = 'job'
      and job_id = p_scheduled_job_id
  )
  into v_item_exists;
  if not v_item_exists then
    raise exception 'scheduled job item not found';
  end if;

  delete from public.crew_schedule_items
  where id = p_job_item_id;
  if not found then
    raise exception 'failed to delete scheduled job item';
  end if;

  delete from public.scheduled_jobs
  where id = p_scheduled_job_id;
  if not found then
    raise exception 'failed to delete scheduled job';
  end if;

  select count(*), count(*) filter (where id is null or position is null or position < 0)
  into v_position_count, v_invalid_position_count
  from jsonb_to_recordset(v_position_payload) as rows(id uuid, position integer);

  if v_invalid_position_count > 0 then
    raise exception 'p_positions contains invalid entries';
  end if;

  if v_position_count > 0 then
    update public.crew_schedule_items items
    set position = parsed.position
    from (
      select id, position
      from jsonb_to_recordset(v_position_payload) as rows(id uuid, position integer)
    ) parsed
    where items.id = parsed.id;

    get diagnostics v_updated_items = row_count;
    if v_updated_items <> v_position_count then
      raise exception 'failed to reindex every queue item';
    end if;
  else
    v_updated_items := 0;
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
    'deleted_job', p_scheduled_job_id,
    'deleted_item', p_job_item_id,
    'updated_items', v_updated_items,
    'updated_forecasts', v_updated_forecasts
  );
end;
$$;

create or replace function public.schedule_v2_delete_downtime(
  p_downtime_id uuid,
  p_downtime_item_id uuid,
  p_positions jsonb,
  p_forecast_updates jsonb
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_position_payload jsonb := coalesce(p_positions, '[]'::jsonb);
  v_forecast_payload jsonb := coalesce(p_forecast_updates, '[]'::jsonb);
  v_downtime_exists boolean;
  v_item_exists boolean;
  v_position_count integer;
  v_invalid_position_count integer;
  v_updated_items integer;
  v_forecast_count integer;
  v_invalid_forecast_count integer;
  v_updated_forecasts integer;
begin
  if p_downtime_id is null then
    raise exception 'p_downtime_id is required';
  end if;

  if p_downtime_item_id is null then
    raise exception 'p_downtime_item_id is required';
  end if;

  if jsonb_typeof(v_position_payload) <> 'array' then
    raise exception 'p_positions must be an array';
  end if;

  if jsonb_typeof(v_forecast_payload) <> 'array' then
    raise exception 'p_forecast_updates must be an array';
  end if;

  select exists(select 1 from public.crew_downtimes where id = p_downtime_id)
  into v_downtime_exists;
  if not v_downtime_exists then
    raise exception 'downtime not found';
  end if;

  select exists(
    select 1
    from public.crew_schedule_items
    where id = p_downtime_item_id
      and item_type = 'downtime'
      and downtime_id = p_downtime_id
  )
  into v_item_exists;
  if not v_item_exists then
    raise exception 'downtime item not found';
  end if;

  delete from public.crew_schedule_items
  where id = p_downtime_item_id;
  if not found then
    raise exception 'failed to delete downtime item';
  end if;

  delete from public.crew_downtimes
  where id = p_downtime_id;
  if not found then
    raise exception 'failed to delete downtime';
  end if;

  select count(*), count(*) filter (where id is null or position is null or position < 0)
  into v_position_count, v_invalid_position_count
  from jsonb_to_recordset(v_position_payload) as rows(id uuid, position integer);

  if v_invalid_position_count > 0 then
    raise exception 'p_positions contains invalid entries';
  end if;

  if v_position_count > 0 then
    update public.crew_schedule_items items
    set position = parsed.position
    from (
      select id, position
      from jsonb_to_recordset(v_position_payload) as rows(id uuid, position integer)
    ) parsed
    where items.id = parsed.id;

    get diagnostics v_updated_items = row_count;
    if v_updated_items <> v_position_count then
      raise exception 'failed to reindex every queue item';
    end if;
  else
    v_updated_items := 0;
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
    'deleted_downtime', p_downtime_id,
    'deleted_item', p_downtime_item_id,
    'updated_items', v_updated_items,
    'updated_forecasts', v_updated_forecasts
  );
end;
$$;

create or replace function public.schedule_v2_mark_done(
  p_scheduled_job_id uuid,
  p_actual_start date,
  p_actual_finish date,
  p_forecast_updates jsonb,
  p_finish_early jsonb default null
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_forecast_payload jsonb := coalesce(p_forecast_updates, '[]'::jsonb);
  v_existing_positions jsonb;
  v_crew_id uuid;
  v_freed_days integer;
  v_buffer_note text;
  v_insert_position integer;
  v_forecast_count integer;
  v_invalid_forecast_count integer;
  v_updated_forecasts integer;
  v_position_count integer;
  v_invalid_position_count integer;
  v_updated_items integer;
  v_created_downtime_id uuid;
  v_created_item_id uuid;
begin
  if p_scheduled_job_id is null then
    raise exception 'p_scheduled_job_id is required';
  end if;

  if p_actual_start is null or p_actual_finish is null then
    raise exception 'actual dates are required';
  end if;

  if jsonb_typeof(v_forecast_payload) <> 'array' then
    raise exception 'p_forecast_updates must be an array';
  end if;

  update public.scheduled_jobs
  set
    status = 'done',
    actual_start = p_actual_start,
    actual_finish = p_actual_finish
  where id = p_scheduled_job_id;

  if not found then
    raise exception 'scheduled job not found';
  end if;

  if p_finish_early is not null then
    if jsonb_typeof(p_finish_early) <> 'object' then
      raise exception 'p_finish_early must be an object';
    end if;

    select crew_id, freed_days, buffer_note, insert_position, existing_positions
    into v_crew_id, v_freed_days, v_buffer_note, v_insert_position, v_existing_positions
    from jsonb_to_record(p_finish_early) as row(
      crew_id uuid,
      freed_days integer,
      buffer_note text,
      insert_position integer,
      existing_positions jsonb
    );

    if v_crew_id is null then
      raise exception 'finish-early crew_id is required';
    end if;
    if v_freed_days is null or v_freed_days <= 0 then
      raise exception 'finish-early freed_days must be greater than zero';
    end if;
    if v_buffer_note is null or btrim(v_buffer_note) = '' then
      raise exception 'finish-early buffer_note is required';
    end if;
    if v_insert_position is null or v_insert_position < 0 then
      raise exception 'finish-early insert_position is invalid';
    end if;
    if v_existing_positions is null or jsonb_typeof(v_existing_positions) <> 'array' or jsonb_array_length(v_existing_positions) = 0 then
      raise exception 'finish-early existing_positions must be a non-empty array';
    end if;

    select count(*), count(*) filter (where id is null or position is null or position < 0)
    into v_position_count, v_invalid_position_count
    from jsonb_to_recordset(v_existing_positions) as rows(id uuid, position integer);

    if v_invalid_position_count > 0 then
      raise exception 'finish-early existing_positions contains invalid entries';
    end if;

    insert into public.crew_downtimes (
      crew_id,
      duration_days,
      reason,
      note
    )
    values (
      v_crew_id,
      v_freed_days,
      'other',
      v_buffer_note
    )
    returning id into v_created_downtime_id;

    insert into public.crew_schedule_items (
      crew_id,
      item_type,
      downtime_id,
      position
    )
    values (
      v_crew_id,
      'downtime',
      v_created_downtime_id,
      v_insert_position
    )
    returning id into v_created_item_id;

    update public.crew_schedule_items items
    set position = parsed.position
    from (
      select id, position
      from jsonb_to_recordset(v_existing_positions) as rows(id uuid, position integer)
    ) parsed
    where items.id = parsed.id;

    get diagnostics v_updated_items = row_count;
    if v_updated_items <> v_position_count then
      raise exception 'failed to reindex every queue item';
    end if;
  else
    v_updated_items := 0;
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
    'created_downtime_id', v_created_downtime_id,
    'created_item_id', v_created_item_id,
    'updated_items', v_updated_items,
    'updated_forecasts', v_updated_forecasts
  );
end;
$$;

grant execute on function public.schedule_v2_unassign_job(uuid, uuid, jsonb, jsonb) to authenticated, service_role;
grant execute on function public.schedule_v2_delete_downtime(uuid, uuid, jsonb, jsonb) to authenticated, service_role;
grant execute on function public.schedule_v2_mark_done(uuid, date, date, jsonb, jsonb) to authenticated, service_role;

notify pgrst, 'reload schema';
