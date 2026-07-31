begin;

-- Portfolio-wide Project Work V2 rollout.
--
-- The rollout is intentionally stage-aware but not stage-derived beyond the
-- narrow review obligation below. Existing specialist/customer/project data
-- remains authoritative and legacy work rows remain available as read-only
-- history.

create table if not exists public.project_work_portfolio_rollouts (
  rollout_key text primary key
    check (char_length(btrim(rollout_key)) between 1 and 120),
  applied_at timestamptz not null,
  initial_project_count bigint not null check (initial_project_count >= 0)
);

comment on table public.project_work_portfolio_rollouts is
  'Private project-independent ledger for one-time portfolio rollout cohorts.';

alter table public.project_work_portfolio_rollouts enable row level security;
revoke all on table public.project_work_portfolio_rollouts
  from public, anon, authenticated, service_role;

create or replace function public.project_work_portfolio_rollout_ledger_guard_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  raise exception 'project work portfolio rollout ledger is append-only'
    using errcode = '42501';
end;
$$;

revoke all on function
  public.project_work_portfolio_rollout_ledger_guard_v1()
  from public, anon, authenticated, service_role;

drop trigger if exists project_work_portfolio_rollouts_append_only
  on public.project_work_portfolio_rollouts;
create trigger project_work_portfolio_rollouts_append_only
before update or delete on public.project_work_portfolio_rollouts
for each row
execute function public.project_work_portfolio_rollout_ledger_guard_v1();

alter table public.project_work_model_versions
  drop constraint if exists project_work_model_versions_reason_check;
alter table public.project_work_model_versions
  add constraint project_work_model_versions_reason_check check (
    reason in (
      'NEW_PROJECT',
      'REVIEWED_MIGRATION',
      'ADMIN_REPAIR',
      'PORTFOLIO_ROLLOUT'
    )
  );

alter table public.project_work_items
  drop constraint if exists project_work_items_deadline_policy_check;
alter table public.project_work_items
  add constraint project_work_items_deadline_policy_check check (
    deadline_policy is null
    or deadline_policy in (
      'LEAD_FIRST_EMAIL_V1',
      'LEAD_FOLLOW_UP_V1',
      'LEAD_CLOSE_REVIEW_V1',
      'QUOTE_FOLLOW_UP_V1',
      'QUOTE_OUTCOME_REVIEW_V1',
      'STAGE_REVIEW_V1',
      'MANUAL'
    )
  );

alter table public.project_work_items
  drop constraint if exists project_work_items_source_type_check;
alter table public.project_work_items
  add constraint project_work_items_source_type_check check (
    source_type in (
      'LEAD_CADENCE',
      'QUOTE_CADENCE',
      'STAGE_REVIEW',
      'MANUAL',
      'LEGACY_REVIEW'
    )
  );

alter table public.project_work_items
  drop constraint if exists project_work_items_calendar_shape;
alter table public.project_work_items
  add constraint project_work_items_calendar_shape check (
    deadline_policy not in (
      'LEAD_FIRST_EMAIL_V1',
      'LEAD_FOLLOW_UP_V1',
      'LEAD_CLOSE_REVIEW_V1',
      'QUOTE_FOLLOW_UP_V1',
      'QUOTE_OUTCOME_REVIEW_V1',
      'STAGE_REVIEW_V1'
    )
    or calendar_revision is not null
  );

-- Governed V2 rows and repair signals remain protected from direct deletion,
-- while a real parent cascade must still let the existing admin hard-delete
-- workflow remove the complete project graph.
create or replace function public.project_work_items_governed_write_guard()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if current_setting('sanctuary.project_work_command', true) = 'allowed' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' and not exists (
    select 1
    from public.projects project
    where project.id = old.project_id
  ) then
    return old;
  end if;
  raise exception '% may only be changed by a project-work command', tg_table_name
    using errcode = '42501';
end;
$$;

revoke all on function public.project_work_items_governed_write_guard()
  from public, anon, authenticated, service_role;

alter table public.project_work_repair_signals
  drop constraint if exists
    project_work_repair_signals_quote_version_id_fkey;
alter table public.project_work_repair_signals
  add constraint project_work_repair_signals_quote_version_id_fkey
  foreign key (quote_version_id)
  references public.quote_versions(id)
  on delete cascade;

create or replace function public.project_work_repair_signal_write_guard()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if current_setting('sanctuary.project_work_repair_signal', true) = 'allowed'
  then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' and (
    not exists (
      select 1
      from public.projects project
      where project.id = old.project_id
    )
    or not exists (
      select 1
      from public.quote_versions quote_version
      where quote_version.id = old.quote_version_id
    )
  ) then
    return old;
  end if;
  raise exception
    'project work repair signals may only be changed by their service command'
    using errcode = '42501';
end;
$$;

revoke all on function public.project_work_repair_signal_write_guard()
  from public, anon, authenticated, service_role;

create or replace function public.project_work_items_legacy_write_guard()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_old_project_id uuid;
  v_new_project_id uuid;
begin
  if tg_op = 'DELETE' and not exists (
    select 1
    from public.projects project
    where project.id = old.project_id
  ) then
    return old;
  end if;
  if current_setting('sanctuary.legacy_v2_override', true) = 'allowed' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op in ('UPDATE','DELETE') then
    v_old_project_id := old.project_id;
  end if;
  if tg_op in ('INSERT','UPDATE') then
    v_new_project_id := new.project_id;
  end if;
  if exists (
    select 1
    from public.project_work_model_versions model
    where model.project_id in (v_old_project_id, v_new_project_id)
      and model.model_version = 2
  )
  then
    raise exception
      'LEGACY_PROJECT_WORK_WRITE_BLOCKED: V2 projects use project work commands'
      using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.project_work_items_legacy_write_guard()
  from public, anon, authenticated, service_role;

create or replace function public.project_work_title_is_prohibited_v1(
  p_value text
)
returns boolean
language sql
immutable
parallel safe
as $$
  select coalesce(p_value, '') ~*
    '(^|[^[:alnum:]])(call|site[[:space:]_-]*visits?)([^[:alnum:]]|$)'
$$;

revoke all on function public.project_work_title_is_prohibited_v1(text)
  from public, anon, authenticated;
grant execute on function public.project_work_title_is_prohibited_v1(text)
  to service_role;

create or replace function public.project_work_prohibited_item_write_guard_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if public.project_work_title_is_prohibited_v1(new.title)
    and (
      tg_op = 'INSERT'
      or new.status is distinct from 'CANCELLED'
    )
  then
    raise exception
      'PROHIBITED_PROJECT_WORK: Call and Site Visit work is retired'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke all on function public.project_work_prohibited_item_write_guard_v1()
  from public, anon, authenticated, service_role;

drop trigger if exists project_work_items_prohibited_write_guard_v1
  on public.project_work_items;
create trigger project_work_items_prohibited_write_guard_v1
before insert or update of title, status on public.project_work_items
for each row
execute function public.project_work_prohibited_item_write_guard_v1();

create or replace function public.project_work_retired_item_write_guard_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if tg_op = 'INSERT' and new.source_type = 'LEGACY_REVIEW' then
    raise exception
      'RETIRED_PROJECT_WORK: legacy review work is immutable history'
      using errcode = '22023';
  end if;
  if tg_op = 'UPDATE'
    and (
      (
        old.source_type = 'LEGACY_REVIEW'
        and new.source_type is distinct from old.source_type
      )
      or (
        new.source_type = 'LEGACY_REVIEW'
        and old.source_type is distinct from new.source_type
      )
      or (
        new.source_type = 'LEGACY_REVIEW'
        and new.status in ('OPEN','BLOCKED')
      )
    )
  then
    raise exception
      'RETIRED_PROJECT_WORK: legacy review work is immutable history'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke all on function public.project_work_retired_item_write_guard_v1()
  from public, anon, authenticated, service_role;

drop trigger if exists project_work_items_retired_write_guard_v1
  on public.project_work_items;
create trigger project_work_items_retired_write_guard_v1
before insert or update of source_type, status on public.project_work_items
for each row
execute function public.project_work_retired_item_write_guard_v1();

-- Keep the existing authoritative lead initializer. The only contract change
-- is accepting the rollout marker reason and using the fixed rollout anchor as
-- cutover_at when that reason is selected.
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
  v_contact_email text;
  v_anchor timestamptz;
  v_due_at timestamptz;
  v_sla_at timestamptz;
  v_calendar_revision text;
  v_status text;
  v_blocked_reason text;
  v_item_id uuid;
  v_state_inserted boolean := false;
  v_item_inserted boolean := false;
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

  select nullif(btrim(contact.email), '')
  into v_contact_email
  from public.contacts contact
  where contact.id = v_project.contact_id;

  v_anchor := coalesce(p_created_at, v_project.created_at, clock_timestamp());
  v_due_at := public.project_work_items_add_open_hours(
    v_anchor,
    2,
    'Auckland'
  );
  v_sla_at := public.project_work_items_add_open_hours(
    v_anchor,
    4,
    'Auckland'
  );
  v_calendar_revision := public.project_work_items_calendar_revision(
    v_anchor,
    v_sla_at,
    'Auckland'
  );
  v_status := case when v_contact_email is null then 'BLOCKED' else 'OPEN' end;
  v_blocked_reason := case
    when v_contact_email is null then 'Customer email address is missing'
    else null
  end;

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

  insert into public.project_work_items(
    project_id,
    title,
    responsibility_area,
    status,
    due_at,
    sla_breach_at,
    deadline_policy,
    calendar_revision,
    priority,
    blocked_reason,
    origin,
    source_type,
    source_key,
    series_key,
    subject_kind,
    subject_id,
    created_by,
    updated_by,
    created_at,
    updated_at
  )
  values (
    p_project_id,
    'Send first enquiry email',
    'CUSTOMER',
    v_status,
    v_due_at,
    v_sla_at,
    'LEAD_FIRST_EMAIL_V1',
    v_calendar_revision,
    'NORMAL',
    v_blocked_reason,
    'AUTOMATION',
    'LEAD_CADENCE',
    'lead:first-email:' || p_project_id::text || ':v1',
    'lead:' || p_project_id::text || ':v1',
    'PROJECT',
    p_project_id,
    p_actor_user_id,
    p_actor_user_id,
    case
      when p_reason = 'PORTFOLIO_ROLLOUT' then v_anchor
      else clock_timestamp()
    end,
    case
      when p_reason = 'PORTFOLIO_ROLLOUT' then v_anchor
      else clock_timestamp()
    end
  )
  on conflict(source_key) where source_key is not null do nothing
  returning id, true into v_item_id, v_item_inserted;

  if v_item_inserted then
    insert into public.project_work_item_events(
      work_item_id,
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
    select
      item.id,
      item.project_id,
      v_command_id,
      1,
      'CREATED',
      null,
      to_jsonb(item),
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
    from public.project_work_items item
    where item.id = v_item_id;
  else
    select item.id
    into v_item_id
    from public.project_work_items item
    where item.source_key =
      'lead:first-email:' || p_project_id::text || ':v1';
  end if;

  perform public.project_work_items_refresh_projection(p_project_id);
  perform set_config(
    'sanctuary.project_work_command',
    coalesce(v_previous_setting, ''),
    true
  );

  return jsonb_build_object(
    'project_id', p_project_id,
    'work_item_id', v_item_id,
    'row_version', 1,
    'replayed', not (v_state_inserted or v_item_inserted),
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
  v_title text;
  v_responsibility text;
  v_due_at timestamptz;
  v_calendar_revision text;
  v_source_key text;
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

  if v_state.state = 'ACTIVE'
    and not exists (
      select 1
      from public.project_work_items item
      where item.project_id = p_project_id
        and item.status in ('OPEN','BLOCKED')
    )
  then
    select mapping.title, mapping.responsibility_area
    into v_title, v_responsibility
    from (
      values
        ('CONTACTED','Review enquiry progress','CUSTOMER'),
        ('SITE_VISIT','Review proposal progress','CUSTOMER'),
        ('QUOTING','Review proposal progress','COMMERCIAL'),
        ('SENT','Review proposal outcome','COMMERCIAL'),
        ('DEPOSIT','Review confirmed project','ADMIN'),
        ('SCHEDULED','Review delivery progress','OPERATIONS'),
        ('COMPLETED','Review completion and payment','ADMIN')
    ) as mapping(stage, title, responsibility_area)
    where mapping.stage = v_new_stage;

    if v_title is not null then
      v_due_at := public.project_work_items_add_business_days_due(
        p_anchor,
        5,
        'Auckland'
      );
      v_calendar_revision := public.project_work_items_calendar_revision(
        p_anchor,
        v_due_at,
        'Auckland'
      );
      v_source_key := coalesce(
        nullif(btrim(p_source_key), ''),
        'stage-review:' || p_project_id::text || ':event:'
          || p_command_id::text || ':v1'
      );

      insert into public.project_work_items(
        project_id,
        title,
        responsibility_area,
        status,
        due_at,
        deadline_policy,
        calendar_revision,
        priority,
        origin,
        source_type,
        source_key,
        subject_kind,
        subject_id,
        created_by,
        updated_by,
        created_at,
        updated_at
      )
      values (
        p_project_id,
        v_title,
        v_responsibility,
        'OPEN',
        v_due_at,
        'STAGE_REVIEW_V1',
        v_calendar_revision,
        'NORMAL',
        'AUTOMATION',
        'STAGE_REVIEW',
        v_source_key,
        'PROJECT',
        p_project_id,
        v_actor,
        v_actor,
        p_anchor,
        p_anchor
      )
      on conflict(source_key) where source_key is not null do nothing
      returning id into v_item_id;

      if v_item_id is not null then
        insert into public.project_work_item_events(
          work_item_id,
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
        select
          item.id,
          item.project_id,
          p_command_id,
          v_sequence,
          'CREATED',
          null,
          to_jsonb(item),
          v_actor,
          p_actor_kind,
          p_anchor
        from public.project_work_items item
        where item.id = v_item_id;
        v_created := true;
      else
        select item.id
        into v_item_id
        from public.project_work_items item
        where item.source_key = v_source_key;
      end if;
    end if;
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

create or replace function public.project_work_apply_stage_entry_trigger_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if upper(btrim(coalesce(old.pipeline_stage::text, '')))
    is not distinct from
    upper(btrim(coalesce(new.pipeline_stage::text, '')))
  then
    return new;
  end if;
  if exists (
    select 1
    from public.project_work_model_versions model
    where model.project_id = new.id
      and model.model_version = 2
  ) then
    perform public.project_work_apply_stage_entry_v1(
      new.id,
      old.pipeline_stage::text,
      new.pipeline_stage::text,
      statement_timestamp(),
      gen_random_uuid(),
      null,
      'SYSTEM'
    );
  end if;
  return new;
end;
$$;

revoke all on function public.project_work_apply_stage_entry_trigger_v1()
  from public, anon, authenticated, service_role;

drop trigger if exists projects_apply_stage_entry_v1 on public.projects;
create trigger projects_apply_stage_entry_v1
after update of pipeline_stage on public.projects
for each row
when (old.pipeline_stage is distinct from new.pipeline_stage)
execute function public.project_work_apply_stage_entry_trigger_v1();

-- Older import/bootstrap paths can still insert a project without calling the
-- staff project-create command. A deferred trigger lets the canonical command
-- initialize first, then closes the invariant for every remaining insert
-- without changing that command's actor/idempotency contract.
create or replace function public.project_work_ensure_inserted_project_v2()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_project public.projects%rowtype;
  v_state public.project_operational_states%rowtype;
  v_stage text;
  v_anchor timestamptz := clock_timestamp();
  v_actor uuid;
  v_command_id uuid := gen_random_uuid();
  v_state_inserted boolean := false;
  v_previous_setting text := current_setting(
    'sanctuary.project_work_command',
    true
  );
begin
  perform pg_advisory_xact_lock(hashtextextended(new.id::text, 0));
  select project.*
  into v_project
  from public.projects project
  where project.id = new.id
  for update;
  if not found then
    return new;
  end if;

  if exists (
    select 1
    from public.project_work_model_versions model
    where model.project_id = v_project.id
      and model.model_version = 2
  ) and exists (
    select 1
    from public.project_operational_states state
    where state.project_id = v_project.id
  ) then
    return new;
  end if;

  select portal_user.user_id
  into v_actor
  from public.portal_users portal_user
  where portal_user.user_id = auth.uid();

  v_stage := upper(btrim(coalesce(v_project.pipeline_stage::text, '')));
  if v_project.archived_at is null and v_stage = 'NEW' then
    perform public.project_work_items_initialize_project_v2(
      v_project.id,
      v_anchor,
      v_actor,
      'NEW_PROJECT'
    );
    return new;
  end if;

  perform set_config('sanctuary.project_work_command', 'allowed', true);
  insert into public.project_work_model_versions(
    project_id,
    model_version,
    cutover_at,
    cutover_by,
    reason
  )
  values (
    v_project.id,
    2,
    v_anchor,
    v_actor,
    'NEW_PROJECT'
  )
  on conflict(project_id) do nothing;

  insert into public.project_operational_states(
    project_id,
    state,
    waiting_until,
    waiting_reason,
    closed_outcome,
    closed_note,
    row_version,
    created_by,
    updated_by,
    created_at,
    updated_at
  )
  values (
    v_project.id,
    case
      when v_project.archived_at is not null and v_stage = 'PAID'
        then 'CLOSED'
      else 'ACTIVE'
    end,
    null,
    null,
    case
      when v_project.archived_at is not null and v_stage = 'PAID'
        then 'COMPLETE'
      else null
    end,
    null,
    1,
    v_actor,
    v_actor,
    v_anchor,
    v_anchor
  )
  on conflict(project_id) do nothing
  returning * into v_state;
  v_state_inserted := found;

  if v_state_inserted then
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
      v_project.id,
      v_command_id,
      0,
      'WORK_MODEL_INITIALIZED',
      null,
      to_jsonb(v_state),
      'Project insert invariant',
      v_actor,
      case when v_actor is null then 'SYSTEM' else 'STAFF' end,
      v_anchor
    );
  end if;

  if v_project.archived_at is null then
    perform public.project_work_apply_stage_entry_v1(
      v_project.id,
      null,
      v_project.pipeline_stage::text,
      v_anchor,
      gen_random_uuid(),
      'stage-review:' || v_project.id::text || ':insert:v1',
      'SYSTEM'
    );
  else
    perform public.project_work_items_refresh_projection(v_project.id);
  end if;

  perform set_config(
    'sanctuary.project_work_command',
    coalesce(v_previous_setting, ''),
    true
  );
  return new;
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

revoke all on function public.project_work_ensure_inserted_project_v2()
  from public, anon, authenticated, service_role;

drop trigger if exists projects_ensure_work_model_v2 on public.projects;
create constraint trigger projects_ensure_work_model_v2
after insert on public.projects
deferrable initially deferred
for each row
execute function public.project_work_ensure_inserted_project_v2();

-- Preserve historical Running Jobs completion evidence before every project is
-- marked V2 and the legacy task tables become read-only.
do $$
declare
  v_previous_setting text := current_setting(
    'sanctuary.running_job_fact_command',
    true
  );
begin
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

-- Use one statement timestamp for every rollout deadline and cutover marker.
-- The private project-independent ledger closes the cohort even when it was
-- empty or its projects are later hard-deleted. Per-project append-only events
-- retain the item-level audit. Re-running the migration skips that population,
-- while the final invariant still fails closed if convergence did not commit.
do $$
declare
  v_rollout_at timestamptz := statement_timestamp();
  v_rollout_already_applied boolean;
  v_rollout_inserted integer;
  v_project record;
  v_state public.project_operational_states%rowtype;
  v_item public.project_work_items%rowtype;
  v_before_item jsonb;
  v_retirement_reason text;
  v_state_inserted boolean;
  v_command_id uuid;
  v_previous_setting text := current_setting(
    'sanctuary.project_work_command',
    true
  );
begin
  insert into public.project_work_portfolio_rollouts(
    rollout_key,
    applied_at,
    initial_project_count
  )
  values (
    'project-work-v2-portfolio-20260731',
    v_rollout_at,
    (select count(*) from public.projects)
  )
  on conflict (rollout_key) do nothing;
  get diagnostics v_rollout_inserted = row_count;
  v_rollout_already_applied := v_rollout_inserted = 0;

  if v_rollout_already_applied then
    select rollout.applied_at
    into strict v_rollout_at
    from public.project_work_portfolio_rollouts rollout
    where rollout.rollout_key = 'project-work-v2-portfolio-20260731';
  end if;

  for v_project in
    select
      project.id,
      project.pipeline_stage::text as pipeline_stage,
      project.archived_at,
      state.state as existing_state
    from public.projects project
    left join public.project_work_model_versions model
      on model.project_id = project.id
      and model.model_version = 2
    left join public.project_operational_states state
      on state.project_id = project.id
    where not v_rollout_already_applied
    order by project.id
  loop
    perform pg_advisory_xact_lock(
      hashtextextended(v_project.id::text, 0)
    );
    perform 1
    from public.projects project
    where project.id = v_project.id
    for update;
    perform set_config('sanctuary.project_work_command', 'allowed', true);

    -- Reviewed legacy rows remain terminal audit evidence, but they must not
    -- remain actionable or suppress the fresh obligation for the current
    -- stage.
    for v_item in
      select item.*
      from public.project_work_items item
      where item.project_id = v_project.id
        and item.status in ('OPEN','BLOCKED')
        and (
          item.source_type = 'LEGACY_REVIEW'
          or public.project_work_title_is_prohibited_v1(item.title)
          or public.project_work_title_is_prohibited_v1(item.source_type)
          or public.project_work_title_is_prohibited_v1(item.source_key)
          or public.project_work_title_is_prohibited_v1(item.series_key)
        )
      order by item.created_at, item.id
      for update
    loop
      v_before_item := to_jsonb(v_item);
      v_retirement_reason := case
        when v_item.source_type = 'LEGACY_REVIEW'
          then 'Legacy review retired by portfolio rollout'
        else 'Call or Site Visit work retired by portfolio rollout'
      end;
      v_command_id := gen_random_uuid();
      update public.project_work_items
      set
        status = 'CANCELLED',
        blocked_reason = null,
        cancelled_at = v_rollout_at,
        cancelled_by = null,
        cancellation_reason = v_retirement_reason,
        updated_by = null,
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
        v_project.id,
        v_command_id,
        0,
        'CANCELLED',
        v_before_item,
        to_jsonb(v_item),
        v_retirement_reason,
        null,
        'MIGRATION',
        v_rollout_at
      );
    end loop;

    if v_project.archived_at is null
      and upper(btrim(coalesce(v_project.pipeline_stage, ''))) = 'NEW'
    then
      perform public.project_work_items_initialize_project_v2(
        v_project.id,
        v_rollout_at,
        null,
        'PORTFOLIO_ROLLOUT'
      );
      if v_project.existing_state in ('WAITING','CLOSED') then
        perform set_config('sanctuary.project_work_command', 'allowed', true);
        select item.*
        into v_item
        from public.project_work_items item
        where item.project_id = v_project.id
          and item.source_key =
            'lead:first-email:' || v_project.id::text || ':v1'
          and item.status in ('OPEN','BLOCKED')
        for update;
        if found then
          v_before_item := to_jsonb(v_item);
          v_command_id := gen_random_uuid();
          update public.project_work_items
          set
            status = 'CANCELLED',
            blocked_reason = null,
            cancelled_at = v_rollout_at,
            cancelled_by = null,
            cancellation_reason =
              'Preexisting operational state is not Active',
            updated_by = null,
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
            v_project.id,
            v_command_id,
            0,
            'CANCELLED',
            v_before_item,
            to_jsonb(v_item),
            'Portfolio rollout preserved a preexisting non-Active state',
            null,
            'MIGRATION',
            v_rollout_at
          );
          perform public.project_work_items_refresh_projection(v_project.id);
        end if;
      end if;
      v_command_id := gen_random_uuid();
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
        v_project.id,
        v_command_id,
        0,
        'PORTFOLIO_ROLLOUT_APPLIED',
        null,
        jsonb_build_object(
          'pipeline_stage', v_project.pipeline_stage,
          'rollout_at', v_rollout_at
        ),
        'Current stored stage treated as freshly entered',
        null,
        'MIGRATION',
        v_rollout_at
      );
      continue;
    end if;

    insert into public.project_work_model_versions(
      project_id,
      model_version,
      cutover_at,
      cutover_by,
      reason
    )
    values (
      v_project.id,
      2,
      v_rollout_at,
      null,
      'PORTFOLIO_ROLLOUT'
    )
    on conflict(project_id) do nothing;

    v_state_inserted := false;
    insert into public.project_operational_states(
      project_id,
      state,
      waiting_until,
      waiting_reason,
      closed_outcome,
      closed_note,
      row_version,
      created_by,
      updated_by,
      created_at,
      updated_at
    )
    values (
      v_project.id,
      case
        when v_project.archived_at is not null
          and upper(btrim(coalesce(v_project.pipeline_stage, ''))) = 'PAID'
          then 'CLOSED'
        else 'ACTIVE'
      end,
      null,
      null,
      case
        when v_project.archived_at is not null
          and upper(btrim(coalesce(v_project.pipeline_stage, ''))) = 'PAID'
          then 'COMPLETE'
        else null
      end,
      null,
      1,
      null,
      null,
      v_rollout_at,
      v_rollout_at
    )
    on conflict(project_id) do nothing
    returning * into v_state;
    v_state_inserted := found;

    if v_state_inserted then
      v_command_id := gen_random_uuid();
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
        v_project.id,
        v_command_id,
        0,
        'WORK_MODEL_INITIALIZED',
        null,
        to_jsonb(v_state),
        'Portfolio rollout',
        null,
        'MIGRATION',
        v_rollout_at
      );
    end if;

    if v_project.archived_at is null then
      perform public.project_work_apply_stage_entry_v1(
        v_project.id,
        null,
        v_project.pipeline_stage,
        v_rollout_at,
        gen_random_uuid(),
        'stage-review:' || v_project.id::text || ':rollout:v1',
        'MIGRATION'
      );
    else
      perform public.project_work_items_refresh_projection(v_project.id);
    end if;

    v_command_id := gen_random_uuid();
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
      v_project.id,
      v_command_id,
      0,
      'PORTFOLIO_ROLLOUT_APPLIED',
      null,
      jsonb_build_object(
        'pipeline_stage', v_project.pipeline_stage,
        'rollout_at', v_rollout_at
      ),
      'Current stored stage treated as freshly entered',
      null,
      'MIGRATION',
      v_rollout_at
    );
  end loop;

  perform set_config(
    'sanctuary.project_work_command',
    coalesce(v_previous_setting, ''),
    true
  );

  if exists (
    select 1
    from public.projects project
    left join public.project_work_model_versions model
      on model.project_id = project.id
      and model.model_version = 2
    left join public.project_operational_states state
      on state.project_id = project.id
    where model.project_id is null
      or state.project_id is null
  ) then
    raise exception
      'PROJECT_WORK_ROLLOUT_INCOMPLETE: marker/state backfill did not converge'
      using errcode = 'P0001';
  end if;
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

-- Safe retirement boundary: facts move to their specialist owner, legacy rows
-- remain queryable, and every legacy mutation path is disabled.
create or replace function public.project_running_job_fact_write_guard()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if current_setting('sanctuary.running_job_fact_command', true) = 'allowed'
  then
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
    select 1
    from public.projects project
    where project.id = p_project_id
  ) then
    raise exception 'project not found' using errcode = 'P0002';
  end if;
  if p_command_id is null
    or v_fact not in ('materials_ordered','roofing_ordered')
    or p_value is null
    or p_expected_row_version is null
    or p_expected_row_version < 0
  then
    raise exception 'invalid running-job fact command'
      using errcode = '22023';
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
    raise exception
      'STALE_RUNNING_JOB_FACT: expected row version %, found %',
      p_expected_row_version,
      v_meta.row_version
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
      case
        when v_fact = 'materials_ordered' and p_value
          then clock_timestamp()
        else null
      end,
      case
        when v_fact = 'materials_ordered' and p_value then v_actor
        else null
      end,
      case
        when v_fact = 'roofing_ordered' and p_value
          then clock_timestamp()
        else null
      end,
      case
        when v_fact = 'roofing_ordered' and p_value then v_actor
        else null
      end,
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

revoke insert, update, delete
  on table public.tasks,
    public.followup_plans,
    public.followup_tasks,
    public.project_manual_actions,
    public.project_action_controls,
    public.project_primary_action_selections,
    public.project_action_versions,
    public.project_task_checks
  from public, anon, authenticated, service_role;

drop policy if exists portal_access_all on public.project_task_checks;
drop policy if exists project_task_checks_staff_select
  on public.project_task_checks;
create policy project_task_checks_staff_select
  on public.project_task_checks
  for select
  to authenticated
  using ((select public.has_portal_access()));

drop trigger if exists tasks_set_updated_at on public.tasks;
drop trigger if exists followup_tasks_set_updated_at on public.followup_tasks;
drop trigger if exists followup_plans_set_updated_at on public.followup_plans;
drop trigger if exists tasks_bump_project_action_version on public.tasks;
drop trigger if exists followup_tasks_bump_project_action_version
  on public.followup_tasks;
drop trigger if exists project_manual_actions_bump_project_action_version
  on public.project_manual_actions;
drop trigger if exists project_manual_actions_set_updated_at
  on public.project_manual_actions;
drop trigger if exists project_action_controls_set_updated_at
  on public.project_action_controls;
drop trigger if exists project_primary_action_selections_set_updated_at
  on public.project_primary_action_selections;
drop trigger if exists tasks_refresh_project_action_projection on public.tasks;
drop trigger if exists followup_tasks_refresh_project_action_projection
  on public.followup_tasks;
drop trigger if exists manual_actions_refresh_project_action_projection
  on public.project_manual_actions;

do $$
begin
  if to_regprocedure(
    'public.project_command_action(uuid,uuid,text,jsonb)'
  ) is not null then
    execute 'revoke execute on function public.project_command_action('
      || 'uuid,uuid,text,jsonb) from public, anon, authenticated, service_role';
  end if;
  if to_regprocedure(
    'public.project_command_sync_design_task('
      || 'uuid,text,text,text,text,timestamptz,text,jsonb)'
  ) is not null then
    execute 'revoke execute on function public.project_command_sync_design_task('
      || 'uuid,text,text,text,text,timestamptz,text,jsonb) '
      || 'from public, anon, authenticated, service_role';
  end if;
end;
$$;

revoke all on function public.project_work_classify_legacy_contacted_v1(
  date,integer,jsonb,text
) from public, anon, authenticated, service_role;

revoke all on function public.project_work_migrate_legacy_contacted_v1(
  uuid,uuid,timestamptz,text,text,text,text,text,timestamptz,timestamptz,text
) from public, anon, authenticated, service_role;

create or replace function public.staff_projects_index_v2(
  p_archive text default 'active',
  p_search text default '',
  p_status text default 'all',
  p_due text default 'all',
  p_today date default current_date,
  p_page integer default 1,
  p_page_size integer default 50,
  p_sort text default 'newest',
  p_state text default 'all',
  p_stages text[] default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, extensions, pg_temp
as $function$
declare
  v_result jsonb;
begin
  if exists (
    select 1
    from public.projects project
    left join public.project_work_model_versions model
      on model.project_id = project.id
      and model.model_version = 2
    left join public.project_operational_states state
      on state.project_id = project.id
    where model.project_id is null
      or state.project_id is null
  ) then
    raise exception
      'PROJECT_WORK_ROLLOUT_INCOMPLETE: project marker/state is missing'
      using errcode = 'P0001';
  end if;

  with input as (
    select
      case
        when p_archive in ('active','archived','all') then p_archive
        else 'active'
      end as archive_filter,
      lower(btrim(coalesce(p_search, ''))) as normalized_query,
      '%' || replace(
        replace(
          replace(lower(btrim(coalesce(p_search, ''))), E'\\', E'\\\\'),
          '%',
          E'\\%'
        ),
        '_',
        E'\\_'
      ) || '%' as contains_pattern,
      regexp_replace(coalesce(p_search, ''), '[^0-9]+', '', 'g')
        as phone_query,
      upper(btrim(coalesce(p_status, 'all'))) as status_filter,
      coalesce(
        array(
          select distinct upper(btrim(stage))
          from unnest(coalesce(p_stages, array[]::text[])) stage
          where nullif(btrim(stage), '') is not null
        ),
        array[]::text[]
      ) as stage_filters,
      case
        when upper(btrim(coalesce(p_state, 'all'))) in (
          'ALL','ACTIVE','WAITING','CLOSED','ARCHIVED'
        ) then upper(btrim(coalesce(p_state, 'all')))
        else 'ALL'
      end as state_filter,
      case
        when p_due in ('all','due','overdue','today') then p_due
        else 'all'
      end as due_filter,
      coalesce(p_today, current_date) as today,
      greatest(1, coalesce(p_page, 1)) as page_number,
      greatest(10, least(coalesce(p_page_size, 50), 100)) as page_size,
      case
        when p_sort in (
          'newest',
          'oldest',
          'name_asc',
          'name_desc',
          'next_action_asc',
          'next_action_desc'
        ) then p_sort
        else 'newest'
      end as sort_key
  ),
  filtered as materialized (
    select
      project.*,
      state.state as operational_state,
      case
        when project.archived_at is not null then 'ARCHIVED'
        else state.state
      end as effective_state,
      contact.name as contact_name,
      contact.email as contact_email,
      contact.phone as contact_phone,
      contact.created_at as contact_created_at,
      contact.updated_at as contact_updated_at
    from public.projects project
    join public.project_work_model_versions model
      on model.project_id = project.id
      and model.model_version = 2
    join public.project_operational_states state
      on state.project_id = project.id
    left join public.contacts contact on contact.id = project.contact_id
    cross join input
    where (select public.has_portal_access())
      and (
        input.archive_filter = 'all'
        or (
          input.archive_filter = 'active'
          and project.archived_at is null
        )
        or (
          input.archive_filter = 'archived'
          and project.archived_at is not null
        )
      )
      and (
        (
          cardinality(input.stage_filters) > 0
          and upper(project.pipeline_stage::text) = any(input.stage_filters)
        )
        or (
          cardinality(input.stage_filters) = 0
          and (
            input.status_filter = 'ALL'
            or upper(project.pipeline_stage::text) = input.status_filter
          )
        )
      )
      and (
        input.state_filter = 'ALL'
        or case
          when project.archived_at is not null then 'ARCHIVED'
          else state.state
        end = input.state_filter
      )
      and (
        input.due_filter = 'all'
        or (
          input.due_filter = 'due'
          and project.follow_up_date <= input.today
        )
        or (
          input.due_filter = 'overdue'
          and project.follow_up_date < input.today
        )
        or (
          input.due_filter = 'today'
          and project.follow_up_date = input.today
        )
      )
      and (
        input.normalized_query = ''
        or project.portal_search_document
          ilike input.contains_pattern escape E'\\'
        or contact.portal_search_document
          ilike input.contains_pattern escape E'\\'
        or lower(coalesce(project.region, ''))
          ilike input.contains_pattern escape E'\\'
        or (
          length(input.phone_query) >= 3
          and regexp_replace(
            coalesce(contact.phone, ''),
            '[^0-9]+',
            '',
            'g'
          ) like '%' || input.phone_query || '%'
        )
      )
  ),
  ordered as (
    select filtered.*
    from filtered
    cross join input
    order by
      case
        when input.sort_key = 'newest' then filtered.created_at
      end desc nulls last,
      case
        when input.sort_key = 'oldest' then filtered.created_at
      end asc nulls last,
      case
        when input.sort_key = 'name_asc' then lower(filtered.name)
      end asc nulls last,
      case
        when input.sort_key = 'name_desc' then lower(filtered.name)
      end desc nulls last,
      case
        when input.sort_key = 'next_action_asc'
          then filtered.follow_up_date
      end asc nulls last,
      case
        when input.sort_key = 'next_action_desc'
          then filtered.follow_up_date
      end desc nulls last,
      filtered.created_at desc,
      filtered.id asc
    offset (
      select (page_number - 1) * page_size
      from input
    )
    limit (select page_size from input)
  ),
  rows_json as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', ordered.id,
          'contact_id', ordered.contact_id,
          'name', ordered.name,
          'quote_ref', ordered.quote_ref,
          'region', ordered.region,
          'site_address', ordered.site_address,
          'pipeline_stage', ordered.pipeline_stage,
          'operational_state', ordered.operational_state,
          'effective_state', ordered.effective_state,
          'follow_up_date', ordered.follow_up_date,
          'archived_at', ordered.archived_at,
          'notes', ordered.notes,
          'created_at', ordered.created_at,
          'updated_at', ordered.updated_at,
          'deposit_amount_cents', ordered.deposit_amount_cents,
          'deposit_paid_date', ordered.deposit_paid_date,
          'final_payment_date', ordered.final_payment_date,
          'contact_name', ordered.contact_name,
          'contact_email', ordered.contact_email,
          'contact_phone', ordered.contact_phone,
          'contact_created_at', ordered.contact_created_at,
          'contact_updated_at', ordered.contact_updated_at
        )
        order by
          case
            when input.sort_key = 'newest' then ordered.created_at
          end desc nulls last,
          case
            when input.sort_key = 'oldest' then ordered.created_at
          end asc nulls last,
          case
            when input.sort_key = 'name_asc' then lower(ordered.name)
          end asc nulls last,
          case
            when input.sort_key = 'name_desc' then lower(ordered.name)
          end desc nulls last,
          case
            when input.sort_key = 'next_action_asc'
              then ordered.follow_up_date
          end asc nulls last,
          case
            when input.sort_key = 'next_action_desc'
              then ordered.follow_up_date
          end desc nulls last,
          ordered.created_at desc,
          ordered.id asc
      ),
      '[]'::jsonb
    ) as rows
    from ordered
    cross join input
  )
  select jsonb_build_object(
    'rows', rows_json.rows,
    'totalCount', (select count(*) from filtered),
    'page', (select page_number from input),
    'pageSize', (select page_size from input)
  )
  into v_result
  from rows_json;

  return v_result;
end;
$function$;

create or replace function public.staff_project_state_counts_v1()
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $function$
declare
  v_result jsonb;
begin
  if not public.has_portal_access() then
    raise exception 'staff access required' using errcode = '42501';
  end if;
  if exists (
    select 1
    from public.projects project
    left join public.project_work_model_versions model
      on model.project_id = project.id
      and model.model_version = 2
    left join public.project_operational_states state
      on state.project_id = project.id
    where model.project_id is null
      or state.project_id is null
  ) then
    raise exception
      'PROJECT_WORK_ROLLOUT_INCOMPLETE: project marker/state is missing'
      using errcode = 'P0001';
  end if;

  select jsonb_build_object(
    'ACTIVE', count(*) filter (
      where project.archived_at is null and state.state = 'ACTIVE'
    ),
    'WAITING', count(*) filter (
      where project.archived_at is null and state.state = 'WAITING'
    ),
    'CLOSED', count(*) filter (
      where project.archived_at is null and state.state = 'CLOSED'
    ),
    'ARCHIVED', count(*) filter (
      where project.archived_at is not null
    ),
    'totalCount', count(*)
  )
  into v_result
  from public.projects project
  join public.project_work_model_versions model
    on model.project_id = project.id
    and model.model_version = 2
  join public.project_operational_states state
    on state.project_id = project.id;

  return v_result;
end;
$function$;

-- Keep the V3 result contract unchanged while lifting only its server-side
-- safety cap. The function body remains the already-reviewed V3 definition.
do $$
declare
  v_definition text;
  v_replaced text;
begin
  select pg_get_functiondef(
    'public.project_work_queue_v3(timestamptz,integer)'::regprocedure
  )
  into v_definition;
  if position(
    'least(coalesce(p_limit, 200), 5000)' in v_definition
  ) > 0 then
    return;
  end if;
  v_replaced := replace(
    v_definition,
    'least(coalesce(p_limit, 200), 500)',
    'least(coalesce(p_limit, 200), 5000)'
  );
  if v_replaced = v_definition then
    raise exception
      'PROJECT_WORK_QUEUE_V3_CAP_UPDATE_FAILED: expected 500-row cap not found'
      using errcode = 'P0001';
  end if;
  execute v_replaced;
end;
$$;

revoke all on function public.staff_projects_index_v2(
  text,text,text,text,date,integer,integer,text,text,text[]
) from public, anon, authenticated, service_role;
grant execute on function public.staff_projects_index_v2(
  text,text,text,text,date,integer,integer,text,text,text[]
) to authenticated, service_role;

revoke all on function public.staff_project_state_counts_v1()
  from public, anon, authenticated, service_role;
grant execute on function public.staff_project_state_counts_v1()
  to authenticated;

-- CREATE OR REPLACE preserves the established V3 grants, but state them here
-- so replay and schema-diff review cannot accidentally broaden access.
revoke all on function public.project_work_queue_v3(timestamptz,integer)
  from public, anon, authenticated, service_role;
grant execute on function public.project_work_queue_v3(timestamptz,integer)
  to authenticated;

select pg_notify('pgrst', 'reload schema');

commit;
