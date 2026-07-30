-- Retire the unused legacy project-task write paths without deleting review
-- evidence. Running Jobs facts move to their specialist-owned metadata for
-- every live project; V2 Project Work and private dashboard reminders are
-- intentionally outside this retirement.

do $$
declare
  v_previous_setting text := current_setting(
    'sanctuary.running_job_fact_command',
    true
  );
begin
  -- The already-deployed V2 guard protects marked rows. Authorize this exact
  -- evidence-preserving backfill so a historical task-check fact cannot make
  -- the retirement migration fail before the all-project guard is installed.
  perform set_config('sanctuary.running_job_fact_command', 'allowed', true);
  with legacy_facts as (
    select
      task.project_id,
      max(task.completed_at) filter (
        where task.task_key in ('order_materials','materials_ordered')
      ) as materials_ordered_at,
      (array_agg(task.completed_by order by task.completed_at desc) filter (
        where task.task_key in ('order_materials','materials_ordered')
      ))[1] as materials_ordered_by,
      max(task.completed_at) filter (
        where task.task_key = 'roofing_ordered'
      ) as roofing_ordered_at,
      (array_agg(task.completed_by order by task.completed_at desc) filter (
        where task.task_key = 'roofing_ordered'
      ))[1] as roofing_ordered_by
    from public.project_task_checks task
    where task.task_key in (
      'order_materials','materials_ordered','roofing_ordered'
    )
    group by task.project_id
  )
  insert into public.project_running_job_meta(
    project_id,
    materials_ordered_at,
    materials_ordered_by,
    roofing_ordered_at,
    roofing_ordered_by,
    row_version
  )
  select
    fact.project_id,
    fact.materials_ordered_at,
    fact.materials_ordered_by,
    fact.roofing_ordered_at,
    fact.roofing_ordered_by,
    1
  from legacy_facts fact
  on conflict(project_id) do update set
    materials_ordered_at = coalesce(
      public.project_running_job_meta.materials_ordered_at,
      excluded.materials_ordered_at
    ),
    materials_ordered_by = coalesce(
      public.project_running_job_meta.materials_ordered_by,
      excluded.materials_ordered_by
    ),
    roofing_ordered_at = coalesce(
      public.project_running_job_meta.roofing_ordered_at,
      excluded.roofing_ordered_at
    ),
    roofing_ordered_by = coalesce(
      public.project_running_job_meta.roofing_ordered_by,
      excluded.roofing_ordered_by
    );
  perform set_config(
    'sanctuary.running_job_fact_command',
    coalesce(v_previous_setting, ''),
    true
  );
exception
  when others then
    perform set_config(
      'sanctuary.running_job_fact_command',
      coalesce(v_previous_setting, ''),
      true
    );
    raise;
end;
$$;

create or replace function public.project_running_job_fact_write_guard()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if current_setting('sanctuary.running_job_fact_command', true) = 'allowed' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'INSERT' then
    if new.materials_ordered_at is not null
      or new.materials_ordered_by is not null
      or new.roofing_ordered_at is not null
      or new.roofing_ordered_by is not null
      or new.row_version <> 1
    then
      raise exception 'running-job facts require their command'
        using errcode = '42501';
    end if;
    return new;
  elsif tg_op = 'UPDATE' then
    if old.project_id is distinct from new.project_id
      or old.materials_ordered_at is distinct from new.materials_ordered_at
      or old.materials_ordered_by is distinct from new.materials_ordered_by
      or old.roofing_ordered_at is distinct from new.roofing_ordered_at
      or old.roofing_ordered_by is distinct from new.roofing_ordered_by
      or old.row_version is distinct from new.row_version
    then
      raise exception 'running-job facts require their command'
        using errcode = '42501';
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    -- Keep the parent-owned ON DELETE CASCADE usable while rejecting a direct
    -- metadata delete. PostgreSQL removes the parent row before executing the
    -- cascading child delete in the same transaction.
    if not exists (
      select 1
      from public.projects project
      where project.id = old.project_id
    ) then
      return old;
    end if;
  end if;
  raise exception 'running-job fact rows cannot be deleted directly'
    using errcode = '42501';
end;
$$;

-- Append-only project-work evidence remains protected from direct mutation, but
-- its existing parent-owned ON DELETE CASCADE must remain usable by the
-- supported admin hard-delete command. This also prevents a newly created
-- all-project Running Jobs command receipt from making a legacy project
-- undeletable after its quotes were already removed by that command.
create or replace function public.project_work_items_append_only_guard()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if tg_op = 'DELETE' and not exists (
    select 1
    from public.projects project
    where project.id = old.project_id
  ) then
    return old;
  end if;
  raise exception '% is append-only', tg_table_name using errcode = '42501';
end;
$$;

create or replace function public.project_running_job_fact_command(
  p_project_id uuid,
  p_command_id uuid,
  p_fact text,
  p_value boolean,
  p_expected_row_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_fact text := lower(btrim(coalesce(p_fact, '')));
  v_intent jsonb;
  v_replay jsonb;
  v_meta public.project_running_job_meta%rowtype;
  v_before jsonb;
  v_result jsonb;
  v_previous_setting text;
begin
  if not public.has_portal_access() then
    raise exception 'staff access required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.projects project where project.id = p_project_id
  ) then
    raise exception 'project not found' using errcode = 'P0002';
  end if;
  if p_command_id is null
    or v_fact not in ('materials_ordered','roofing_ordered')
    or p_value is null
    or p_expected_row_version is null
    or p_expected_row_version < 0
  then
    raise exception 'invalid running-job fact command' using errcode = '22023';
  end if;
  v_intent := jsonb_build_object(
    'fact', v_fact,
    'value', p_value,
    'expectedRowVersion', p_expected_row_version
  );
  perform pg_advisory_xact_lock(hashtextextended(p_command_id::text, 1));
  v_replay := public.project_work_items_receipt_replay(
    p_project_id,
    p_command_id,
    'RUNNING_JOB_FACT',
    v_intent
  );
  if v_replay is not null then
    return v_replay;
  end if;

  select meta.*
  into v_meta
  from public.project_running_job_meta meta
  where meta.project_id = p_project_id
  for update;
  if not found and p_expected_row_version <> 0 then
    raise exception
      'STALE_RUNNING_JOB_FACT: expected row version %, but the fact row is absent',
      p_expected_row_version
      using errcode = '40001';
  elsif found and v_meta.row_version <> p_expected_row_version then
    raise exception 'STALE_RUNNING_JOB_FACT: expected row version %, found %',
      p_expected_row_version, v_meta.row_version
      using errcode = '40001';
  end if;

  v_before := case when found then to_jsonb(v_meta) else null end;
  v_previous_setting := current_setting(
    'sanctuary.running_job_fact_command',
    true
  );
  perform set_config('sanctuary.running_job_fact_command', 'allowed', true);
  if v_meta.project_id is null then
    insert into public.project_running_job_meta(
      project_id,
      materials_ordered_at,
      materials_ordered_by,
      roofing_ordered_at,
      roofing_ordered_by,
      row_version
    )
    values (
      p_project_id,
      case when v_fact = 'materials_ordered' and p_value
        then clock_timestamp() else null end,
      case when v_fact = 'materials_ordered' and p_value
        then v_actor else null end,
      case when v_fact = 'roofing_ordered' and p_value
        then clock_timestamp() else null end,
      case when v_fact = 'roofing_ordered' and p_value
        then v_actor else null end,
      1
    )
    returning * into v_meta;
  else
    update public.project_running_job_meta
    set
      materials_ordered_at = case
        when v_fact <> 'materials_ordered' then materials_ordered_at
        when p_value then coalesce(materials_ordered_at, clock_timestamp())
        else null
      end,
      materials_ordered_by = case
        when v_fact <> 'materials_ordered' then materials_ordered_by
        when p_value then coalesce(materials_ordered_by, v_actor)
        else null
      end,
      roofing_ordered_at = case
        when v_fact <> 'roofing_ordered' then roofing_ordered_at
        when p_value then coalesce(roofing_ordered_at, clock_timestamp())
        else null
      end,
      roofing_ordered_by = case
        when v_fact <> 'roofing_ordered' then roofing_ordered_by
        when p_value then coalesce(roofing_ordered_by, v_actor)
        else null
      end,
      row_version = row_version + 1
    where project_id = p_project_id
    returning * into v_meta;
  end if;

  insert into public.project_command_audit(
    project_id,
    command_id,
    event_sequence,
    event_type,
    source_kind,
    source_id,
    actor_user_id,
    reason,
    before_state,
    after_state
  )
  values (
    p_project_id,
    p_command_id,
    0,
    'RUNNING_JOB_FACT_SET',
    null,
    null,
    v_actor,
    v_fact,
    v_before,
    to_jsonb(v_meta)
  );

  v_result := jsonb_build_object(
    'project_id', p_project_id,
    'work_item_id', null,
    'row_version', v_meta.row_version,
    'fact', v_fact,
    'value', p_value,
    'replayed', false,
    'refresh_required', false
  );
  perform public.project_work_items_store_receipt(
    p_project_id,
    p_command_id,
    'RUNNING_JOB_FACT',
    v_intent,
    v_actor,
    'STAFF',
    v_result
  );
  perform set_config(
    'sanctuary.running_job_fact_command',
    coalesce(v_previous_setting, ''),
    true
  );
  return v_result;
exception
  when others then
    perform set_config(
      'sanctuary.running_job_fact_command',
      coalesce(v_previous_setting, ''),
      true
    );
    raise;
end;
$$;

revoke insert, update, delete on table public.project_task_checks
  from authenticated;
drop policy if exists portal_access_all on public.project_task_checks;
drop policy if exists project_task_checks_staff_select
  on public.project_task_checks;
create policy project_task_checks_staff_select
  on public.project_task_checks
  for select
  to authenticated
  using ((select public.has_portal_access()));

do $$
begin
  if to_regprocedure(
    'public.project_command_action(uuid,uuid,text,jsonb)'
  ) is not null then
    execute 'revoke execute on function public.project_command_action('
      || 'uuid,uuid,text,jsonb) from public, anon, authenticated';
  end if;
  if to_regprocedure(
    'public.project_command_sync_design_task('
      || 'uuid,text,text,text,text,timestamptz,text,jsonb)'
  ) is not null then
    execute 'revoke execute on function public.project_command_sync_design_task('
      || 'uuid,text,text,text,text,timestamptz,text,jsonb) '
      || 'from public, anon, authenticated';
  end if;
end;
$$;

select pg_notify('pgrst', 'reload schema');
