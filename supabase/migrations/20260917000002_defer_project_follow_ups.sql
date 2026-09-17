-- Owner decision: defer unused email follow-up workflows; preserve all history.
BEGIN;

-- Acquire the project fence first, matching ordinary command lock order. NOWAIT
-- makes concurrent activity abort this migration, rather than deadlocking a
-- staff command. Plain reads remain available; install only during a quiet gap.
SET LOCAL lock_timeout = '5s';
LOCK TABLE public.projects, public.project_work_items, public.project_work_repair_signals
  IN EXCLUSIVE MODE NOWAIT;

create or replace function public.project_work_items_initialize_project_v2(
  p_project_id uuid,
  p_created_at timestamptz default null,
  p_actor_user_id uuid default null,
  p_reason text default 'NEW_PROJECT'
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_project public.projects%rowtype;
  v_anchor timestamptz;
  v_state_inserted boolean := false;
  v_command_id uuid := gen_random_uuid();
  v_previous_setting text;
begin
  if p_reason not in (
    'NEW_PROJECT',
    'REVIEWED_MIGRATION',
    'ADMIN_REPAIR',
    'PORTFOLIO_ROLLOUT'
  ) then
    raise exception 'invalid work-model initialization reason'
      using errcode = '22023';
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

  v_anchor := coalesce(p_created_at, v_project.created_at, clock_timestamp());

  v_previous_setting := current_setting(
    'sanctuary.project_work_command',
    true
  );
  perform set_config('sanctuary.project_work_command', 'allowed', true);

  insert into public.project_work_model_versions(
    project_id,
    model_version,
    cutover_at,
    cutover_by,
    reason
  )
  values (
    p_project_id,
    2,
    case
      when p_reason = 'PORTFOLIO_ROLLOUT' then v_anchor
      else clock_timestamp()
    end,
    p_actor_user_id,
    p_reason
  )
  on conflict(project_id) do nothing;

  insert into public.project_operational_states(
    project_id,
    state,
    row_version,
    created_by,
    updated_by
  )
  values (
    p_project_id,
    'ACTIVE',
    1,
    p_actor_user_id,
    p_actor_user_id
  )
  on conflict(project_id) do nothing
  returning true into v_state_inserted;

  if v_state_inserted then
    insert into public.project_state_events(
      project_id,
      command_id,
      event_sequence,
      event_type,
      before_state,
      after_state,
      actor_user_id,
      actor_kind,
      occurred_at
    )
    values (
      p_project_id,
      v_command_id,
      0,
      'WORK_MODEL_INITIALIZED',
      null,
      jsonb_build_object('state','ACTIVE','row_version',1),
      p_actor_user_id,
      case
        when p_reason = 'PORTFOLIO_ROLLOUT' then 'MIGRATION'
        when p_actor_user_id is null then 'SYSTEM'
        else 'STAFF'
      end,
      case
        when p_reason = 'PORTFOLIO_ROLLOUT' then v_anchor
        else clock_timestamp()
      end
    );
  end if;

  perform public.project_work_items_refresh_projection(p_project_id);
  perform set_config(
    'sanctuary.project_work_command',
    coalesce(v_previous_setting, ''),
    true
  );

  return jsonb_build_object(
    'project_id', p_project_id,
    'work_item_id', null,
    'row_version', 1,
    'replayed', not coalesce(v_state_inserted, false),
    'refresh_required', false
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

create or replace function public.project_work_item_reconcile(
  p_project_id uuid, p_command_id uuid, p_event text, p_payload jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_event text := upper(btrim(coalesce(p_event, '')));
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_replay jsonb;
  v_result jsonb;
  v_quote_version_id uuid;
begin
  if p_command_id is null or v_event not in ('QUOTE_SENT','QUOTE_RESENT','QUOTE_OUTCOME','RECONCILE_PROJECT')
    or jsonb_typeof(v_payload) is distinct from 'object' then
    raise exception 'invalid project-work reconciliation event' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_command_id::text, 1));
  v_replay := public.project_work_items_receipt_replay(p_project_id, p_command_id, 'SYSTEM_' || v_event, v_payload);
  if v_replay is not null then return v_replay; end if;
  perform public.project_work_items_assert_v2(p_project_id, true);
  -- Retiring reminders must not weaken the existing project/quote binding.
  if v_event <> 'RECONCILE_PROJECT' then
    v_quote_version_id := (v_payload->>'quote_version_id')::uuid;
    if v_quote_version_id is null then
      raise exception 'quote_version_id is required' using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.quote_versions version
      join public.quotes quote on quote.id = version.quote_id
      where version.id = v_quote_version_id and quote.project_id = p_project_id
    ) then
      raise exception 'QUOTE_VERSION_NOT_FOUND' using errcode = 'P0002';
    end if;
  end if;
  -- Commercial callers keep their receipt contract, but no reminder is created.
  v_result := jsonb_build_object('project_id', p_project_id, 'work_item_id', null,
    'row_version', null, 'replayed', false, 'refresh_required', false);
  perform public.project_work_items_store_receipt(p_project_id, p_command_id,
    'SYSTEM_' || v_event, v_payload, null, 'SYSTEM', v_result);
  return v_result;
end;
$$;

create or replace function public.project_follow_up_confirmation_guard_v1()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if new.event_kind = 'CONFIRMED' and new.confirmation_type in (
    'FIRST_ENQUIRY_EMAIL_SENT','ENQUIRY_FOLLOW_UP_EMAIL_SENT','ENQUIRY_CUSTOMER_REPLY_RECEIVED',
    'QUOTE_FOLLOW_UP_EMAIL_SENT','QUOTE_CUSTOMER_REPLY_RECEIVED'
  ) then
    raise exception 'FOLLOW_UP_WORKFLOW_DEFERRED: email recording is retired' using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke all on function public.project_follow_up_confirmation_guard_v1() from public, anon, authenticated, service_role;
drop trigger if exists project_follow_up_confirmation_guard_v1 on public.project_confirmation_events;
create trigger project_follow_up_confirmation_guard_v1 before insert on public.project_confirmation_events
for each row execute function public.project_follow_up_confirmation_guard_v1();

create or replace function public.project_work_retired_item_write_guard_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if tg_op = 'INSERT' and new.source_type in ('LEGACY_REVIEW','STAGE_REVIEW','LEAD_CADENCE','QUOTE_CADENCE') then
    raise exception
      'RETIRED_PROJECT_WORK: retired review work is immutable history'
      using errcode = '22023';
  end if;
  if tg_op = 'UPDATE'
    and (
      (
        old.source_type in ('LEGACY_REVIEW','STAGE_REVIEW','LEAD_CADENCE','QUOTE_CADENCE')
        and new.source_type is distinct from old.source_type
      )
      or (
        new.source_type in ('LEGACY_REVIEW','STAGE_REVIEW','LEAD_CADENCE','QUOTE_CADENCE')
        and old.source_type is distinct from new.source_type
      )
      or (
        new.source_type in ('LEGACY_REVIEW','STAGE_REVIEW','LEAD_CADENCE','QUOTE_CADENCE')
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
-- Reapplying does not create events because only active follow-ups are retired.
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
    where source_type in ('LEAD_CADENCE','QUOTE_CADENCE') and status in ('OPEN','BLOCKED')
    order by project_id
  loop
    if not pg_try_advisory_xact_lock(hashtextextended(v_project::text, 0)) then
      raise exception 'FOLLOW_UP_RETIREMENT_BUSY: retry after active project commands finish'
        using errcode = '55P03';
    end if;
    perform 1 from public.projects where id = v_project for update;
    v_command := gen_random_uuid();
    v_sequence := 0;
    for v_item in
      select * from public.project_work_items
      where project_id = v_project and source_type in ('LEAD_CADENCE','QUOTE_CADENCE')
        and status in ('OPEN','BLOCKED')
      order by id for update
    loop
      v_before := to_jsonb(v_item);
      update public.project_work_items
      set status = 'CANCELLED', blocked_reason = null, cancelled_at = v_at,
          cancelled_by = null, updated_by = null, row_version = row_version + 1,
          cancellation_reason = 'Unused email follow-up workflow deferred by owner; history preserved'
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


-- Preserve retired repair state in an append-only command receipt.
do $repairs$
declare
  v_signal public.project_work_repair_signals%rowtype;
  v_before jsonb;
  v_previous text := current_setting('sanctuary.project_work_repair_signal', true);
begin
  perform set_config('sanctuary.project_work_repair_signal','allowed',true);
  for v_signal in select * from public.project_work_repair_signals
    where repair_kind='QUOTE_CADENCE_RECONCILIATION' and status='OPEN'
    order by project_id,id for update
  loop
    v_before := to_jsonb(v_signal);
    update public.project_work_repair_signals set status='RESOLVED', resolved_at=clock_timestamp(),
      row_version=row_version+1 where id=v_signal.id returning * into v_signal;
    perform public.project_work_items_store_receipt(v_signal.project_id, gen_random_uuid(),
      'MIGRATION_DEFER_QUOTE_FOLLOW_UP', jsonb_build_object('signal_id',v_signal.id), null, 'MIGRATION',
      jsonb_build_object('before_state',v_before,'after_state',to_jsonb(v_signal),
        'reason','Unused email follow-up workflow deferred by owner'));
    perform public.project_work_items_refresh_projection(v_signal.project_id);
  end loop;
  perform set_config('sanctuary.project_work_repair_signal',coalesce(v_previous,''),true);
end;
$repairs$;

create or replace function public.project_follow_up_repair_guard_v1()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,pg_temp
as $$
begin
  if new.repair_kind='QUOTE_CADENCE_RECONCILIATION' and new.status='OPEN' then
    raise exception 'FOLLOW_UP_WORKFLOW_DEFERRED: cadence repair signals are retired' using errcode='22023';
  end if;
  return new;
end;
$$;
revoke all on function public.project_follow_up_repair_guard_v1() from public,anon,authenticated,service_role;
drop trigger if exists project_follow_up_repair_guard_v1 on public.project_work_repair_signals;
create trigger project_follow_up_repair_guard_v1 before insert or update on public.project_work_repair_signals
for each row execute function public.project_follow_up_repair_guard_v1();

-- Queue only actual obligations; an empty project is not a triage task.
create or replace function public.project_work_queue_v3(
  p_now timestamptz default clock_timestamp(),
  p_limit integer default 200
)
returns table (
  project_id uuid,
  project_name text,
  pipeline_stage text,
  queue_group text,
  action_kind text,
  title text,
  reason text,
  due_at timestamptz,
  priority text,
  blocked_reason text,
  assignee_user_id uuid,
  project_owner_key text,
  work_item_id uuid,
  work_item_row_version bigint,
  source_type text,
  source_key text,
  subject_kind text,
  subject_id uuid,
  repair_signal_id uuid,
  repair_signal_row_version bigint,
  state_row_version bigint
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_now timestamptz := coalesce(p_now, clock_timestamp());
  v_limit integer := greatest(1, least(coalesce(p_limit, 200), 5000));
  v_today date;
  v_seven_day_boundary timestamptz;
begin
  if not public.has_portal_access() then
    raise exception 'staff access required' using errcode = '42501';
  end if;

  v_today := (v_now at time zone 'Pacific/Auckland')::date;
  v_seven_day_boundary := public.project_work_items_add_business_days_due(
    v_now,
    7,
    'Auckland'
  );

  return query
  with eligible_projects as (
    select
      project.id,
      project.name,
      project.pipeline_stage,
      state.state,
      state.waiting_until,
      state.waiting_reason,
      state.row_version as state_row_version,
      owner_assignment.owner_key as project_owner_key
    from public.projects project
    join public.project_work_model_versions model
      on model.project_id = project.id
      and model.model_version = 2
    join public.project_operational_states state
      on state.project_id = project.id
    left join public.project_owner_assignments owner_assignment
      on owner_assignment.project_id = project.id
    where project.archived_at is null
  ),
  active_rows as (
    select
      project.id as project_id,
      project.name as project_name,
      project.pipeline_stage,
      case
        when repair_signal.id is not null then 'blocked'
        when open_item.id is not null
          and (open_item.due_at at time zone 'Pacific/Auckland')::date < v_today
          then 'overdue'
        when open_item.id is not null
          and (open_item.due_at at time zone 'Pacific/Auckland')::date = v_today
          then 'today'
        when open_item.id is not null then 'nextSevenBusinessDays'
        when blocked_item.id is not null then 'blocked'
        else 'needsTriage'
      end as queue_group,
      case
        when repair_signal.id is not null then 'REPAIR'
        when open_item.id is not null or blocked_item.id is not null
          then 'WORK_ITEM'
        else 'NEEDS_TRIAGE'
      end as action_kind,
      case
        when repair_signal.repair_kind = 'CONFIRMATION_RETRACTION_REVIEW'
          then 'Review corrected confirmation'
        when repair_signal.id is not null then 'Repair quote follow-up sync'
        when open_item.id is not null then open_item.title
        when blocked_item.id is not null then 'Review blocked project work'
        else 'Needs triage'
      end as title,
      case
        when repair_signal.id is not null then repair_signal.error_message
        when open_item.priority = 'CRITICAL'
          then coalesce(
            open_item.priority_reason,
            'Critical project work requires attention.'
          )
        when open_item.id is not null
          and open_item.due_at < v_now then 'This project work is overdue.'
        when open_item.id is not null
          and (open_item.due_at at time zone 'Pacific/Auckland')::date = v_today
          then 'This project work is due today.'
        when open_item.id is not null
          then 'This is the earliest current project obligation.'
        when blocked_item.id is not null
          then coalesce(
            blocked_item.blocked_reason,
            'Blocked project work requires review.'
          )
        else 'No current staff work or specialist action is recorded.'
      end as reason,
      coalesce(
        open_item.due_at,
        blocked_item.due_at,
        repair_signal.first_detected_at
      ) as due_at,
      case
        when repair_signal.id is not null then 'CRITICAL'
        else coalesce(open_item.priority, blocked_item.priority)
      end as priority,
      coalesce(repair_signal.error_message, blocked_item.blocked_reason)
        as blocked_reason,
      coalesce(open_item.assignee_user_id, blocked_item.assignee_user_id)
        as assignee_user_id,
      project.project_owner_key,
      coalesce(open_item.id, blocked_item.id) as work_item_id,
      coalesce(open_item.row_version, blocked_item.row_version)
        as work_item_row_version,
      coalesce(open_item.source_type, blocked_item.source_type) as source_type,
      coalesce(open_item.source_key, blocked_item.source_key) as source_key,
      case
        when repair_signal.repair_kind = 'CONFIRMATION_RETRACTION_REVIEW'
          then 'CONFIRMATION_EVENT'
        when repair_signal.repair_kind = 'QUOTE_CADENCE_RECONCILIATION'
          then 'QUOTE_VERSION'
        else coalesce(open_item.subject_kind, blocked_item.subject_kind)
      end as subject_kind,
      coalesce(
        repair_signal.confirmation_event_id,
        repair_signal.quote_version_id,
        open_item.subject_id,
        blocked_item.subject_id
      ) as subject_id,
      repair_signal.id as repair_signal_id,
      repair_signal.row_version as repair_signal_row_version,
      project.state_row_version,
      case
        when repair_signal.id is not null then 0
        when open_item.id is not null
          and open_item.priority = 'CRITICAL' then 1
        when open_item.id is not null
          and (open_item.due_at at time zone 'Pacific/Auckland')::date < v_today
          then 2
        when open_item.id is not null
          and (open_item.due_at at time zone 'Pacific/Auckland')::date = v_today
          then 3
        when open_item.id is not null then 4
        when blocked_item.id is not null then 5
        else 6
      end as group_rank
    from eligible_projects project
    left join lateral (
      select signal.*
      from public.project_work_repair_signals signal
      where signal.project_id = project.id
        and signal.status = 'OPEN'
        and signal.repair_kind <> 'QUOTE_CADENCE_RECONCILIATION'
      order by signal.first_detected_at, signal.id
      limit 1
    ) repair_signal on true
    left join lateral (
      select item.*
      from public.project_work_items item
      where item.project_id = project.id
        and item.status = 'OPEN'
        and item.source_type not in ('LEAD_CADENCE','QUOTE_CADENCE','LEGACY_REVIEW','STAGE_REVIEW')
        and item.due_at <= v_seven_day_boundary
      order by
        case item.priority when 'CRITICAL' then 0 else 1 end,
        case
          when (item.due_at at time zone 'Pacific/Auckland')::date < v_today
            then 0
          when (item.due_at at time zone 'Pacific/Auckland')::date = v_today
            then 1
          else 2
        end,
        item.due_at,
        item.created_at,
        item.id
      limit 1
    ) open_item on repair_signal.id is null
    left join lateral (
      select item.*
      from public.project_work_items item
      where item.project_id = project.id
        and item.status = 'BLOCKED'
        and item.source_type not in ('LEAD_CADENCE','QUOTE_CADENCE','LEGACY_REVIEW','STAGE_REVIEW')
      order by item.due_at, item.created_at, item.id
      limit 1
    ) blocked_item
      on repair_signal.id is null
      and open_item.id is null
    where project.state = 'ACTIVE'
      and (
        repair_signal.id is not null
        or open_item.id is not null
        or blocked_item.id is not null

      )
  ),
  waiting_rows as (
    select
      project.id as project_id,
      project.name as project_name,
      project.pipeline_stage,
      'needsTriage'::text as queue_group,
      'STATE_REVIEW'::text as action_kind,
      'Review waiting project'::text as title,
      coalesce(
        project.waiting_reason,
        'The project wake-up time has arrived.'
      ) as reason,
      project.waiting_until as due_at,
      null::text as priority,
      null::text as blocked_reason,
      null::uuid as assignee_user_id,
      project.project_owner_key,
      null::uuid as work_item_id,
      null::bigint as work_item_row_version,
      null::text as source_type,
      null::text as source_key,
      null::text as subject_kind,
      null::uuid as subject_id,
      null::uuid as repair_signal_id,
      null::bigint as repair_signal_row_version,
      project.state_row_version,
      6 as group_rank
    from eligible_projects project
    where project.state = 'WAITING'
      and project.waiting_until <= v_now
  ),
  combined as (
    select * from active_rows
    union all
    select * from waiting_rows
  )
  select
    combined.project_id,
    combined.project_name,
    combined.pipeline_stage,
    combined.queue_group,
    combined.action_kind,
    combined.title,
    combined.reason,
    combined.due_at,
    combined.priority,
    combined.blocked_reason,
    combined.assignee_user_id,
    combined.project_owner_key,
    combined.work_item_id,
    combined.work_item_row_version,
    combined.source_type,
    combined.source_key,
    combined.subject_kind,
    combined.subject_id,
    combined.repair_signal_id,
    combined.repair_signal_row_version,
    combined.state_row_version
  from combined
  order by
    combined.group_rank,
    combined.due_at nulls last,
    lower(combined.project_name),
    combined.project_id
  limit v_limit;
end;
$$;

COMMIT;
NOTIFY pgrst, 'reload schema';
