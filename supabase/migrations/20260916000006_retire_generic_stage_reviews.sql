-- Retire generic stage reminders; preserve lead/quote cadence and all history.
-- Supersedes only stage-review creation in the 20260731 portfolio policy.
BEGIN;

create or replace function public.project_work_apply_stage_entry_v1(
  p_project_id uuid,
  p_old_stage text,
  p_new_stage text,
  p_anchor timestamptz,
  p_command_id uuid,
  p_source_key text default null,
  p_actor_kind text default 'SYSTEM'
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_project public.projects%rowtype;
  v_state public.project_operational_states%rowtype;
  v_before_state public.project_operational_states%rowtype;
  v_item public.project_work_items%rowtype;
  v_before_item jsonb;
  v_old_stage text := upper(btrim(coalesce(p_old_stage, '')));
  v_new_stage text := upper(btrim(coalesce(p_new_stage, '')));
  v_item_id uuid;
  v_sequence integer := 0;
  v_cancelled integer := 0;
  v_created boolean := false;
  v_state_changed boolean := false;
  v_actor uuid;
  v_previous_setting text;
begin
  if p_project_id is null
    or p_anchor is null
    or p_command_id is null
    or p_actor_kind not in ('SYSTEM','MIGRATION')
  then
    raise exception 'invalid stage-entry policy input' using errcode = '22023';
  end if;
  if v_old_stage = v_new_stage then
    return jsonb_build_object(
      'project_id', p_project_id,
      'cancelled_count', 0,
      'work_item_id', null,
      'state_changed', false
    );
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_project_id::text, 0));
  select project.*
  into v_project
  from public.projects project
  where project.id = p_project_id
  for update;
  if not found then
    raise exception 'PROJECT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not exists (
    select 1
    from public.project_work_model_versions model
    where model.project_id = p_project_id
      and model.model_version = 2
  ) then
    return jsonb_build_object(
      'project_id', p_project_id,
      'cancelled_count', 0,
      'work_item_id', null,
      'state_changed', false
    );
  end if;

  select state.*
  into v_state
  from public.project_operational_states state
  where state.project_id = p_project_id
  for update;
  if not found then
    raise exception
      'PROJECT_WORK_ROLLOUT_INCOMPLETE: project % has no operational state',
      p_project_id
      using errcode = 'P0001';
  end if;

  select portal_user.user_id
  into v_actor
  from public.portal_users portal_user
  where portal_user.user_id = auth.uid();

  v_previous_setting := current_setting(
    'sanctuary.project_work_command',
    true
  );
  perform set_config('sanctuary.project_work_command', 'allowed', true);

  -- A stage change retires only the prior automatic stage review. Cadence,
  -- specialist, reviewed legacy, and manual work are never cancelled here.
  for v_item in
    select item.*
    from public.project_work_items item
    where item.project_id = p_project_id
      and item.source_type = 'STAGE_REVIEW'
      and item.status in ('OPEN','BLOCKED')
    order by item.created_at, item.id
    for update
  loop
    v_before_item := to_jsonb(v_item);
    update public.project_work_items
    set
      status = 'CANCELLED',
      blocked_reason = null,
      cancelled_at = p_anchor,
      cancelled_by = v_actor,
      cancellation_reason = 'Pipeline stage changed',
      updated_by = v_actor,
      row_version = row_version + 1
    where id = v_item.id
    returning * into v_item;

    insert into public.project_work_item_events(
      work_item_id,
      project_id,
      command_id,
      event_sequence,
      event_type,
      before_state,
      after_state,
      reason,
      actor_user_id,
      actor_kind,
      occurred_at
    )
    values (
      v_item.id,
      p_project_id,
      p_command_id,
      v_sequence,
      'CANCELLED',
      v_before_item,
      to_jsonb(v_item),
      'Pipeline stage changed from '
        || coalesce(nullif(v_old_stage, ''), 'UNSET')
        || ' to ' || coalesce(nullif(v_new_stage, ''), 'UNSET'),
      v_actor,
      p_actor_kind,
      p_anchor
    );
    v_sequence := v_sequence + 1;
    v_cancelled := v_cancelled + 1;
  end loop;

  -- Archived overrides the raw state and never receives rollout/stage work.
  if v_project.archived_at is not null then
    perform public.project_work_items_refresh_projection(p_project_id);
    perform set_config(
      'sanctuary.project_work_command',
      coalesce(v_previous_setting, ''),
      true
    );
    return jsonb_build_object(
      'project_id', p_project_id,
      'cancelled_count', v_cancelled,
      'work_item_id', null,
      'state_changed', false
    );
  end if;

  if v_new_stage = 'PAID' then
    if v_state.state is distinct from 'CLOSED'
      or v_state.closed_outcome is distinct from 'COMPLETE'
      or v_state.waiting_until is not null
      or v_state.waiting_reason is not null
    then
      v_before_state := v_state;
      update public.project_operational_states
      set
        state = 'CLOSED',
        waiting_until = null,
        waiting_reason = null,
        closed_outcome = 'COMPLETE',
        closed_note = null,
        row_version = row_version + 1,
        updated_by = v_actor
      where project_id = p_project_id
      returning * into v_state;
      insert into public.project_state_events(
        project_id,
        command_id,
        event_sequence,
        event_type,
        before_state,
        after_state,
        reason,
        actor_user_id,
        actor_kind,
        occurred_at
      )
      values (
        p_project_id,
        p_command_id,
        0,
        'STAGE_POLICY_PAID_CLOSED',
        to_jsonb(v_before_state),
        to_jsonb(v_state),
        'Pipeline stage entered PAID',
        v_actor,
        p_actor_kind,
        p_anchor
      );
      v_state_changed := true;
    end if;
    perform public.project_work_items_refresh_projection(p_project_id);
    perform set_config(
      'sanctuary.project_work_command',
      coalesce(v_previous_setting, ''),
      true
    );
    return jsonb_build_object(
      'project_id', p_project_id,
      'cancelled_count', v_cancelled,
      'work_item_id', null,
      'state_changed', v_state_changed
    );
  end if;

  -- Leaving PAID reopens only the exact automatic COMPLETE closure produced by
  -- this policy. Waiting and staff-selected Closed outcomes remain untouched.
  if v_old_stage = 'PAID'
    and v_state.state = 'CLOSED'
    and v_state.closed_outcome = 'COMPLETE'
    and exists (
      select 1
      from public.project_state_events event
      where event.project_id = p_project_id
        and event.event_type = 'STAGE_POLICY_PAID_CLOSED'
        and (event.after_state->>'row_version')::bigint = v_state.row_version
      order by event.occurred_at desc, event.id desc
      limit 1
    )
  then
    v_before_state := v_state;
    update public.project_operational_states
    set
      state = 'ACTIVE',
      waiting_until = null,
      waiting_reason = null,
      closed_outcome = null,
      closed_note = null,
      row_version = row_version + 1,
      updated_by = v_actor
    where project_id = p_project_id
    returning * into v_state;
    insert into public.project_state_events(
      project_id,
      command_id,
      event_sequence,
      event_type,
      before_state,
      after_state,
      reason,
      actor_user_id,
      actor_kind,
      occurred_at
    )
    values (
      p_project_id,
      p_command_id,
      0,
      'STAGE_POLICY_PAID_REOPENED',
      to_jsonb(v_before_state),
      to_jsonb(v_state),
      'Pipeline stage moved away from PAID',
      v_actor,
      p_actor_kind,
      p_anchor
    );
    v_state_changed := true;
  end if;

  -- Stage alone does not create a staff obligation.

  perform public.project_work_items_refresh_projection(p_project_id);
  perform set_config(
    'sanctuary.project_work_command',
    coalesce(v_previous_setting, ''),
    true
  );
  return jsonb_build_object(
    'project_id', p_project_id,
    'cancelled_count', v_cancelled,
    'work_item_id', v_item_id,
    'created', v_created,
    'state_changed', v_state_changed
  );
exception
  when others then
    perform set_config(
      'sanctuary.project_work_command',
      coalesce(v_previous_setting, ''),
      true
    );
    raise;
end;
$$;

revoke all on function public.project_work_apply_stage_entry_v1(
  uuid,text,text,timestamptz,uuid,text,text
) from public, anon, authenticated, service_role;

create or replace function public.project_work_retired_item_write_guard_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if tg_op = 'INSERT' and new.source_type in ('LEGACY_REVIEW','STAGE_REVIEW') then
    raise exception
      'RETIRED_PROJECT_WORK: retired review work is immutable history'
      using errcode = '22023';
  end if;
  if tg_op = 'UPDATE'
    and (
      (
        old.source_type in ('LEGACY_REVIEW','STAGE_REVIEW')
        and new.source_type is distinct from old.source_type
      )
      or (
        new.source_type in ('LEGACY_REVIEW','STAGE_REVIEW')
        and old.source_type is distinct from new.source_type
      )
      or (
        new.source_type in ('LEGACY_REVIEW','STAGE_REVIEW')
        and new.status in ('OPEN','BLOCKED')
      )
    )
  then
    raise exception
      'RETIRED_PROJECT_WORK: retired review work is immutable history'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke all on function public.project_work_retired_item_write_guard_v1()
  from public, anon, authenticated, service_role;

-- Lock projects in the same order as commands, retain each previous row in its
-- cancellation event, and refresh compatibility fields in the same transaction.
-- Reapplying does not create events because only active reviews are retired.
do $retire$
declare
  v_project uuid;
  v_item public.project_work_items%rowtype;
  v_before jsonb;
  v_command uuid;
  v_sequence integer;
  v_at timestamptz := statement_timestamp();
  v_previous text := current_setting('sanctuary.project_work_command', true);
begin
  perform set_config('sanctuary.project_work_command', 'allowed', true);
  for v_project in
    select distinct project_id from public.project_work_items
    where source_type = 'STAGE_REVIEW' and status in ('OPEN','BLOCKED')
    order by project_id
  loop
    perform pg_advisory_xact_lock(hashtextextended(v_project::text, 0));
    perform 1 from public.projects where id = v_project for update;
    v_command := gen_random_uuid();
    v_sequence := 0;
    for v_item in
      select * from public.project_work_items
      where project_id = v_project and source_type = 'STAGE_REVIEW'
        and status in ('OPEN','BLOCKED')
      order by id for update
    loop
      v_before := to_jsonb(v_item);
      update public.project_work_items
      set status = 'CANCELLED', blocked_reason = null, cancelled_at = v_at,
          cancelled_by = null, updated_by = null, row_version = row_version + 1,
          cancellation_reason = 'Generic stage reminder retired; no business obligation inferred'
      where id = v_item.id returning * into v_item;
      insert into public.project_work_item_events (
        work_item_id, project_id, command_id, event_sequence, event_type,
        before_state, after_state, reason, actor_user_id, actor_kind, occurred_at
      ) values (
        v_item.id, v_project, v_command, v_sequence, 'CANCELLED',
        v_before, to_jsonb(v_item), v_item.cancellation_reason, null, 'MIGRATION', v_at
      );
      v_sequence := v_sequence + 1;
    end loop;
    perform public.project_work_items_refresh_projection(v_project);
  end loop;
  perform set_config('sanctuary.project_work_command', coalesce(v_previous, ''), true);
end;
$retire$;

COMMIT;
NOTIFY pgrst, 'reload schema';
