create or replace function public.schedule_v2_assign_job(
  p_target_crew_id uuid,
  p_target_insert_position integer,
  p_target_positions jsonb,
  p_target_forecast_updates jsonb,
  p_assignment jsonb,
  p_move jsonb default null
)
returns jsonb
language plpgsql
security invoker
as $$
declare
  v_target_positions_payload jsonb := coalesce(p_target_positions, '[]'::jsonb);
  v_target_forecast_payload jsonb := coalesce(p_target_forecast_updates, '[]'::jsonb);
  v_assignment record;
  v_move record;
  v_source_positions_payload jsonb := '[]'::jsonb;
  v_source_forecast_payload jsonb := '[]'::jsonb;
  v_combined_forecast_payload jsonb;
  v_target_crew_exists boolean;
  v_job_exists boolean;
  v_source_item_exists boolean;
  v_target_position_count integer;
  v_invalid_target_position_count integer;
  v_updated_target_items integer;
  v_source_position_count integer;
  v_invalid_source_position_count integer;
  v_updated_source_items integer;
  v_forecast_count integer;
  v_invalid_forecast_count integer;
  v_updated_forecasts integer;
  v_scheduled_job_id uuid;
  v_schedule_item_id uuid;
  v_uuid_pattern text := '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$';
  v_non_uuid_target_forecast_count integer;
  v_non_uuid_source_forecast_count integer := 0;
  v_initial_forecast_start date;
  v_initial_forecast_end_exclusive date;
  v_initial_forecast_duration_days integer;
  v_insert_forecast_duration_days integer;
begin
  if p_target_crew_id is null then
    raise exception 'p_target_crew_id is required';
  end if;

  if p_target_insert_position is null or p_target_insert_position < 0 then
    raise exception 'p_target_insert_position must be a non-negative integer';
  end if;

  if p_assignment is null or jsonb_typeof(p_assignment) <> 'object' then
    raise exception 'p_assignment must be an object';
  end if;

  if jsonb_typeof(v_target_positions_payload) <> 'array' then
    raise exception 'p_target_positions must be an array';
  end if;

  if jsonb_typeof(v_target_forecast_payload) <> 'array' then
    raise exception 'p_target_forecast_updates must be an array';
  end if;

  if p_move is not null and jsonb_typeof(p_move) <> 'object' then
    raise exception 'p_move must be an object';
  end if;

  select exists(select 1 from public.schedule_crews where id = p_target_crew_id)
  into v_target_crew_exists;
  if not v_target_crew_exists then
    raise exception 'target crew not found';
  end if;

  select *
  into v_assignment
  from jsonb_to_record(p_assignment) as payload(
    scheduled_job_id uuid,
    job_id uuid,
    forecast_duration_days integer,
    forecast_start date,
    forecast_end_exclusive date
  );

  select count(*)
  into v_non_uuid_target_forecast_count
  from jsonb_array_elements(v_target_forecast_payload) as forecast_rows(row_data)
  where coalesce(forecast_rows.row_data->>'id', '') !~* v_uuid_pattern;

  if p_move is null then
    if v_assignment.scheduled_job_id is not null then
      if v_non_uuid_target_forecast_count > 0 then
        raise exception 'p_target_forecast_updates contains non-UUID ids for existing scheduled job updates';
      end if;
      if v_assignment.forecast_duration_days is not null and v_assignment.forecast_duration_days <= 0 then
        raise exception 'p_assignment.forecast_duration_days must be a positive integer';
      end if;

      update public.scheduled_jobs jobs
      set
        crew_id = p_target_crew_id,
        forecast_start = coalesce(v_assignment.forecast_start, jobs.forecast_start),
        forecast_end_exclusive = coalesce(v_assignment.forecast_end_exclusive, jobs.forecast_end_exclusive),
        forecast_duration_days = coalesce(v_assignment.forecast_duration_days, jobs.forecast_duration_days)
      where jobs.id = v_assignment.scheduled_job_id;
      if not found then
        raise exception 'scheduled job not found';
      end if;

      v_scheduled_job_id := v_assignment.scheduled_job_id;
    else
      if v_assignment.job_id is null then
        raise exception 'p_assignment.job_id or p_assignment.scheduled_job_id is required';
      end if;

      if v_non_uuid_target_forecast_count > 0 then
        select forecast_start, forecast_end_exclusive, forecast_duration_days
        into v_initial_forecast_start, v_initial_forecast_end_exclusive, v_initial_forecast_duration_days
        from jsonb_array_elements(v_target_forecast_payload) with ordinality as forecast_elements(row_data, ordinality)
        cross join lateral jsonb_to_record(forecast_elements.row_data) as forecast_rows(
          id text,
          forecast_start date,
          forecast_end_exclusive date,
          forecast_duration_days integer
        )
        where coalesce(forecast_rows.id, '') !~* v_uuid_pattern
        order by forecast_elements.ordinality
        limit 1;
      end if;

      v_insert_forecast_duration_days := coalesce(v_assignment.forecast_duration_days, v_initial_forecast_duration_days);
      if v_insert_forecast_duration_days is null or v_insert_forecast_duration_days <= 0 then
        raise exception 'p_assignment.forecast_duration_days must be a positive integer';
      end if;

      insert into public.scheduled_jobs (
        job_id,
        crew_id,
        mode,
        forecast_start,
        forecast_end_exclusive,
        forecast_duration_days,
        status
      )
      values (
        v_assignment.job_id,
        p_target_crew_id,
        'floating',
        coalesce(v_assignment.forecast_start, v_initial_forecast_start),
        coalesce(v_assignment.forecast_end_exclusive, v_initial_forecast_end_exclusive),
        v_insert_forecast_duration_days,
        'not_started'
      )
      returning id into v_scheduled_job_id;
    end if;
  else
    select *
    into v_move
    from jsonb_to_record(p_move) as payload(
      source_crew_id uuid,
      source_job_item_id uuid,
      source_positions jsonb,
      source_forecast_updates jsonb
    );

    if v_assignment.scheduled_job_id is null then
      raise exception 'p_assignment.scheduled_job_id is required for moves';
    end if;
    if v_move.source_crew_id is null then
      raise exception 'p_move.source_crew_id is required';
    end if;
    if v_move.source_job_item_id is null then
      raise exception 'p_move.source_job_item_id is required';
    end if;

    v_source_positions_payload := coalesce(v_move.source_positions, '[]'::jsonb);
    v_source_forecast_payload := coalesce(v_move.source_forecast_updates, '[]'::jsonb);

    if jsonb_typeof(v_source_positions_payload) <> 'array' then
      raise exception 'p_move.source_positions must be an array';
    end if;

    if jsonb_typeof(v_source_forecast_payload) <> 'array' then
      raise exception 'p_move.source_forecast_updates must be an array';
    end if;

    select count(*)
    into v_non_uuid_source_forecast_count
    from jsonb_array_elements(v_source_forecast_payload) as forecast_rows(row_data)
    where coalesce(forecast_rows.row_data->>'id', '') !~* v_uuid_pattern;

    if v_non_uuid_target_forecast_count > 0 or v_non_uuid_source_forecast_count > 0 then
      raise exception 'forecast updates contain non-UUID ids for existing scheduled job updates';
    end if;

    select exists(
      select 1
      from public.scheduled_jobs
      where id = v_assignment.scheduled_job_id
        and crew_id = v_move.source_crew_id
    )
    into v_job_exists;
    if not v_job_exists then
      raise exception 'scheduled job not found for source crew';
    end if;

    select exists(
      select 1
      from public.crew_schedule_items
      where id = v_move.source_job_item_id
        and crew_id = v_move.source_crew_id
        and item_type = 'job'
        and job_id = v_assignment.scheduled_job_id
    )
    into v_source_item_exists;
    if not v_source_item_exists then
      raise exception 'source scheduled job item not found';
    end if;

    update public.scheduled_jobs
    set crew_id = p_target_crew_id
    where id = v_assignment.scheduled_job_id;
    if not found then
      raise exception 'failed to update scheduled job crew';
    end if;

    delete from public.crew_schedule_items
    where id = v_move.source_job_item_id;
    if not found then
      raise exception 'failed to delete source scheduled job item';
    end if;

    v_scheduled_job_id := v_assignment.scheduled_job_id;
  end if;

  insert into public.crew_schedule_items (
    crew_id,
    item_type,
    job_id,
    position
  )
  values (
    p_target_crew_id,
    'job',
    v_scheduled_job_id,
    p_target_insert_position
  )
  returning id into v_schedule_item_id;

  select count(*), count(*) filter (where id is null or position is null or position < 0)
  into v_target_position_count, v_invalid_target_position_count
  from jsonb_to_recordset(v_target_positions_payload) as rows(id uuid, position integer);

  if v_invalid_target_position_count > 0 then
    raise exception 'p_target_positions contains invalid entries';
  end if;

  if v_target_position_count > 0 then
    update public.crew_schedule_items items
    set position = parsed.position
    from (
      select id, position
      from jsonb_to_recordset(v_target_positions_payload) as rows(id uuid, position integer)
    ) parsed
    where items.id = parsed.id;

    get diagnostics v_updated_target_items = row_count;
    if v_updated_target_items <> v_target_position_count then
      raise exception 'failed to reindex every target queue item';
    end if;
  else
    v_updated_target_items := 0;
  end if;

  if p_move is not null then
    select count(*), count(*) filter (where id is null or position is null or position < 0)
    into v_source_position_count, v_invalid_source_position_count
    from jsonb_to_recordset(v_source_positions_payload) as rows(id uuid, position integer);

    if v_invalid_source_position_count > 0 then
      raise exception 'p_move.source_positions contains invalid entries';
    end if;

    if v_source_position_count > 0 then
      update public.crew_schedule_items items
      set position = parsed.position
      from (
        select id, position
        from jsonb_to_recordset(v_source_positions_payload) as rows(id uuid, position integer)
      ) parsed
      where items.id = parsed.id;

      get diagnostics v_updated_source_items = row_count;
      if v_updated_source_items <> v_source_position_count then
        raise exception 'failed to reindex every source queue item';
      end if;
    else
      v_updated_source_items := 0;
    end if;
  else
    v_updated_source_items := 0;
  end if;

  select coalesce(jsonb_agg(filtered.row_data), '[]'::jsonb)
  into v_combined_forecast_payload
  from (
    select target_rows.row_data
    from jsonb_array_elements(v_target_forecast_payload) as target_rows(row_data)
    where coalesce(target_rows.row_data->>'id', '') ~* v_uuid_pattern
    union all
    select source_rows.row_data
    from jsonb_array_elements(v_source_forecast_payload) as source_rows(row_data)
    where coalesce(source_rows.row_data->>'id', '') ~* v_uuid_pattern
  ) filtered;

  select count(*), count(*) filter (where id is null or forecast_duration_days is null or forecast_duration_days <= 0)
  into v_forecast_count, v_invalid_forecast_count
  from jsonb_to_recordset(v_combined_forecast_payload) as rows(
    id uuid,
    forecast_start date,
    forecast_end_exclusive date,
    forecast_duration_days integer
  );

  if v_invalid_forecast_count > 0 then
    raise exception 'forecast updates contain invalid entries';
  end if;

  if v_forecast_count > 0 then
    update public.scheduled_jobs jobs
    set
      forecast_start = parsed.forecast_start,
      forecast_end_exclusive = parsed.forecast_end_exclusive,
      forecast_duration_days = parsed.forecast_duration_days
    from (
      select id, forecast_start, forecast_end_exclusive, forecast_duration_days
      from jsonb_to_recordset(v_combined_forecast_payload) as rows(
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
    'scheduled_job_id', v_scheduled_job_id,
    'schedule_item_id', v_schedule_item_id,
    'source_crew_id', case when p_move is null then null else v_move.source_crew_id end,
    'updated_target_items', v_updated_target_items,
    'updated_source_items', v_updated_source_items,
    'updated_forecasts', v_updated_forecasts
  );
end;
$$;

revoke execute on function public.schedule_v2_assign_job(uuid, integer, jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.schedule_v2_assign_job(uuid, integer, jsonb, jsonb, jsonb, jsonb) to authenticated, service_role;

notify pgrst, 'reload schema';
