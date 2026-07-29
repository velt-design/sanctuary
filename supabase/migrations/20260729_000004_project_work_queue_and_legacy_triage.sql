begin;

-- Project Work Queue V3 and controlled legacy Contacted triage.
--
-- This forward migration preserves the V2 queue contract while adding:
-- - a richer one-row-per-project queue read model;
-- - append-only admin confirmation correction;
-- - a read-only admin classifier for unmarked Contacted projects; and
-- - a one-project reviewed migration command.

alter table public.project_work_repair_signals
  add column if not exists confirmation_event_id uuid null
    references public.project_confirmation_events(id) on delete restrict;

alter table public.project_work_repair_signals
  alter column quote_version_id drop not null;

alter table public.project_work_repair_signals
  drop constraint if exists project_work_repair_signals_repair_kind_check;
alter table public.project_work_repair_signals
  add constraint project_work_repair_signals_repair_kind_check check (
    repair_kind in (
      'QUOTE_CADENCE_RECONCILIATION',
      'CONFIRMATION_RETRACTION_REVIEW'
    )
  );

alter table public.project_work_repair_signals
  drop constraint if exists project_work_repair_signals_source_event_check;
alter table public.project_work_repair_signals
  add constraint project_work_repair_signals_source_event_check check (
    source_event in (
      'QUOTE_SENT',
      'QUOTE_RESENT',
      'QUOTE_OUTCOME',
      'CONFIRMATION_RETRACTED'
    )
  );

alter table public.project_work_repair_signals
  drop constraint if exists project_work_repair_signals_subject_shape;
alter table public.project_work_repair_signals
  add constraint project_work_repair_signals_subject_shape check (
    (
      repair_kind = 'QUOTE_CADENCE_RECONCILIATION'
      and source_event in ('QUOTE_SENT','QUOTE_RESENT','QUOTE_OUTCOME')
      and quote_version_id is not null
      and confirmation_event_id is null
    )
    or (
      repair_kind = 'CONFIRMATION_RETRACTION_REVIEW'
      and source_event = 'CONFIRMATION_RETRACTED'
      and quote_version_id is null
      and confirmation_event_id is not null
    )
  );

create index if not exists project_work_repair_signals_confirmation_event
  on public.project_work_repair_signals(confirmation_event_id)
  where confirmation_event_id is not null;

drop function if exists public.project_work_queue_v3(timestamptz,integer);
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
  v_limit integer := greatest(1, least(coalesce(p_limit, 200), 500));
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
      order by signal.first_detected_at, signal.id
      limit 1
    ) repair_signal on true
    left join lateral (
      select item.*
      from public.project_work_items item
      where item.project_id = project.id
        and item.status = 'OPEN'
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
        or not exists (
          select 1
          from public.project_work_items item
          where item.project_id = project.id
            and item.status in ('OPEN','BLOCKED')
        )
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

create or replace function public.project_confirmation_retraction_command(
  p_project_id uuid,
  p_command_id uuid,
  p_confirmation_event_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_intent jsonb;
  v_replay jsonb;
  v_confirmation public.project_confirmation_events%rowtype;
  v_retraction_id uuid;
  v_signal_id uuid;
  v_result jsonb;
  v_previous_work_setting text;
  v_previous_signal_setting text;
begin
  if not public.is_portal_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  if p_project_id is null
    or p_command_id is null
    or p_confirmation_event_id is null
    or v_reason is null
    or char_length(v_reason) > 1000
  then
    raise exception
      'project, command, confirmation event, and correction reason are required'
      using errcode = '22023';
  end if;

  v_intent := jsonb_build_object(
    'confirmationEventId', p_confirmation_event_id,
    'reason', v_reason
  );
  perform pg_advisory_xact_lock(hashtextextended(p_command_id::text, 1));
  v_replay := public.project_work_items_receipt_replay(
    p_project_id,
    p_command_id,
    'CONFIRMATION_RETRACTION',
    v_intent
  );
  if v_replay is not null then
    return v_replay;
  end if;

  perform public.project_work_items_assert_v2(p_project_id, true);
  select confirmation.*
  into v_confirmation
  from public.project_confirmation_events confirmation
  where confirmation.id = p_confirmation_event_id
    and confirmation.project_id = p_project_id
  for update;
  if not found or v_confirmation.event_kind <> 'CONFIRMED' then
    raise exception 'CONFIRMATION_NOT_FOUND' using errcode = 'P0002';
  end if;
  if exists (
    select 1
    from public.project_confirmation_events correction
    where correction.retracts_event_id = p_confirmation_event_id
  ) then
    raise exception 'CONFIRMATION_ALREADY_RETRACTED'
      using errcode = 'P0001';
  end if;

  v_previous_work_setting :=
    current_setting('sanctuary.project_work_command', true);
  v_previous_signal_setting :=
    current_setting('sanctuary.project_work_repair_signal', true);
  perform set_config('sanctuary.project_work_command', 'allowed', true);
  perform set_config('sanctuary.project_work_repair_signal', 'allowed', true);

  insert into public.project_confirmation_events(
    project_id,
    command_id,
    event_sequence,
    event_kind,
    confirmation_type,
    subject_kind,
    subject_id,
    occurred_at,
    recorded_by,
    actor_kind,
    source_key,
    retracts_event_id,
    reason
  )
  values (
    p_project_id,
    p_command_id,
    0,
    'RETRACTED',
    v_confirmation.confirmation_type,
    v_confirmation.subject_kind,
    v_confirmation.subject_id,
    clock_timestamp(),
    v_actor,
    'STAFF',
    'confirmation:retraction:' || p_confirmation_event_id::text || ':v1',
    p_confirmation_event_id,
    v_reason
  )
  returning id into v_retraction_id;

  insert into public.project_work_repair_signals(
    project_id,
    repair_kind,
    source_event,
    quote_version_id,
    confirmation_event_id,
    command_id,
    status,
    error_code,
    error_message
  )
  values (
    p_project_id,
    'CONFIRMATION_RETRACTION_REVIEW',
    'CONFIRMATION_RETRACTED',
    null,
    p_confirmation_event_id,
    p_command_id,
    'OPEN',
    'CONFIRMATION_RETRACTED_REVIEW_REQUIRED',
    'A recorded project confirmation was corrected. Review current work and lifecycle state explicitly.'
  )
  returning id into v_signal_id;

  v_result := jsonb_build_object(
    'project_id', p_project_id,
    'confirmation_event_id', p_confirmation_event_id,
    'retraction_event_id', v_retraction_id,
    'repair_signal_id', v_signal_id,
    'review_required', true,
    'replayed', false,
    'refresh_required', false
  );
  perform public.project_work_items_store_receipt(
    p_project_id,
    p_command_id,
    'CONFIRMATION_RETRACTION',
    v_intent,
    v_actor,
    'STAFF',
    v_result
  );
  perform set_config(
    'sanctuary.project_work_command',
    coalesce(v_previous_work_setting, ''),
    true
  );
  perform set_config(
    'sanctuary.project_work_repair_signal',
    coalesce(v_previous_signal_setting, ''),
    true
  );
  return v_result;
exception
  when others then
    perform set_config(
      'sanctuary.project_work_command',
      coalesce(v_previous_work_setting, ''),
      true
    );
    perform set_config(
      'sanctuary.project_work_repair_signal',
      coalesce(v_previous_signal_setting, ''),
      true
    );
    raise;
end;
$$;

drop function if exists public.project_confirmation_retraction_review_command(
  uuid,uuid,text
);
create or replace function public.project_confirmation_retraction_review_command(
  p_project_id uuid,
  p_repair_signal_id uuid,
  p_expected_signal_row_version bigint,
  p_command_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_intent jsonb;
  v_replay jsonb;
  v_signal public.project_work_repair_signals%rowtype;
  v_before_signal jsonb;
  v_result jsonb;
  v_previous_signal_setting text;
begin
  if not public.is_portal_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  if p_project_id is null
    or p_repair_signal_id is null
    or p_expected_signal_row_version is null
    or p_expected_signal_row_version < 1
    or p_command_id is null
    or v_reason is null
    or char_length(v_reason) > 1000
  then
    raise exception
      'project, repair signal, expected version, command, and review reason are required'
      using errcode = '22023';
  end if;

  v_intent := jsonb_build_object(
    'repairSignalId', p_repair_signal_id,
    'expectedSignalRowVersion', p_expected_signal_row_version,
    'reason', v_reason
  );
  perform pg_advisory_xact_lock(hashtextextended(p_command_id::text, 1));
  v_replay := public.project_work_items_receipt_replay(
    p_project_id,
    p_command_id,
    'CONFIRMATION_RETRACTION_REVIEW',
    v_intent
  );
  if v_replay is not null then
    return v_replay;
  end if;

  perform public.project_work_items_assert_v2(p_project_id, true);
  perform pg_advisory_xact_lock(hashtextextended(p_project_id::text, 0));
  select signal.*
  into v_signal
  from public.project_work_repair_signals signal
  where signal.id = p_repair_signal_id
    and signal.project_id = p_project_id
    and signal.repair_kind = 'CONFIRMATION_RETRACTION_REVIEW'
  for update;
  if not found then
    raise exception 'CONFIRMATION_RETRACTION_REVIEW_NOT_FOUND'
      using errcode = 'P0002';
  end if;
  if v_signal.status <> 'OPEN'
    or v_signal.row_version <> p_expected_signal_row_version
  then
    raise exception
      'CONFIRMATION_RETRACTION_REVIEW_STALE: signal changed after review'
      using errcode = 'P0001';
  end if;
  v_before_signal := to_jsonb(v_signal);

  v_previous_signal_setting :=
    current_setting('sanctuary.project_work_repair_signal', true);
  perform set_config('sanctuary.project_work_repair_signal', 'allowed', true);
  update public.project_work_repair_signals signal
  set
    status = 'RESOLVED',
    row_version = signal.row_version + 1,
    resolved_at = clock_timestamp()
  where signal.id = p_repair_signal_id
    and signal.project_id = p_project_id
    and signal.repair_kind = 'CONFIRMATION_RETRACTION_REVIEW'
    and signal.status = 'OPEN'
    and signal.row_version = p_expected_signal_row_version
  returning signal.* into v_signal;
  if not found then
    raise exception
      'CONFIRMATION_RETRACTION_REVIEW_STALE: signal changed after review'
      using errcode = 'P0001';
  end if;

  insert into public.project_state_events(
    project_id,
    command_id,
    event_sequence,
    event_type,
    before_state,
    after_state,
    reason,
    actor_user_id,
    actor_kind
  )
  values (
    p_project_id,
    p_command_id,
    0,
    'CONFIRMATION_RETRACTION_REVIEWED',
    v_before_signal,
    to_jsonb(v_signal),
    v_reason,
    v_actor,
    'STAFF'
  );

  v_result := jsonb_build_object(
    'project_id', p_project_id,
    'repair_signal_id', v_signal.id,
    'signal_row_version', v_signal.row_version,
    'resolved_count', 1,
    'replayed', false,
    'refresh_required', false
  );
  perform public.project_work_items_store_receipt(
    p_project_id,
    p_command_id,
    'CONFIRMATION_RETRACTION_REVIEW',
    v_intent,
    v_actor,
    'STAFF',
    v_result
  );
  perform set_config(
    'sanctuary.project_work_repair_signal',
    coalesce(v_previous_signal_setting, ''),
    true
  );
  return v_result;
exception
  when others then
    perform set_config(
      'sanctuary.project_work_repair_signal',
      coalesce(v_previous_signal_setting, ''),
      true
    );
    raise;
end;
$$;

create or replace function public.project_work_legacy_contacted_evidence_v1(
  p_project_id uuid
)
returns table (
  project_updated_at timestamptz,
  pipeline_stage text,
  follow_up_date date,
  archived_at timestamptz,
  model_version integer,
  current_quote boolean,
  current_invoice boolean,
  current_design boolean,
  current_schedule boolean,
  running_job boolean,
  open_obligation boolean,
  sent_email boolean,
  evidence_fingerprint text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_models jsonb := '[]'::jsonb;
  v_quote_versions jsonb := '[]'::jsonb;
  v_invoices jsonb := '[]'::jsonb;
  v_designs jsonb := '[]'::jsonb;
  v_schedules jsonb := '[]'::jsonb;
  v_running_rows jsonb := '[]'::jsonb;
  v_tasks jsonb := '[]'::jsonb;
  v_followups jsonb := '[]'::jsonb;
  v_manual_actions jsonb := '[]'::jsonb;
  v_task_open boolean := false;
  v_followup_open boolean := false;
  v_manual_action_open boolean := false;
  v_snapshot jsonb;
begin
  select
    project.updated_at,
    upper(btrim(project.pipeline_stage)),
    project.follow_up_date,
    project.archived_at
  into
    project_updated_at,
    pipeline_stage,
    follow_up_date,
    archived_at
  from public.projects project
  where project.id = p_project_id;
  if not found then
    return;
  end if;

  select
    max(model.model_version),
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'modelVersion', model.model_version,
          'cutoverAt', model.cutover_at
        )
        order by model.model_version
      ),
      '[]'::jsonb
    )
  into model_version, v_models
  from public.project_work_model_versions model
  where model.project_id = p_project_id;

  select
    coalesce(bool_or(version.status in ('DRAFT','SENT','ACCEPTED')), false),
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'quoteId', quote.id,
          'versionId', version.id,
          'status', version.status
        )
        order by quote.id, version.id
      ),
      '[]'::jsonb
    )
  into current_quote, v_quote_versions
  from public.quotes quote
  join public.quote_versions version on version.quote_id = quote.id
  where quote.project_id = p_project_id;

  select
    coalesce(bool_or(invoice.status = 'OPEN'), false),
    coalesce(
      jsonb_agg(
        jsonb_build_object('id', invoice.id, 'status', invoice.status)
        order by invoice.id
      ),
      '[]'::jsonb
    )
  into current_invoice, v_invoices
  from public.deposit_invoices invoice
  where invoice.project_id = p_project_id;

  select
    coalesce(
      bool_or(design.status in ('OPEN','IN_PROGRESS','BLOCKED')),
      false
    ),
    coalesce(
      jsonb_agg(
        jsonb_build_object('id', design.id, 'status', design.status)
        order by design.id
      ),
      '[]'::jsonb
    )
  into current_design, v_designs
  from public.design_package_requests design
  where design.project_id = p_project_id;

  select
    count(*) > 0,
    coalesce(
      jsonb_agg(
        jsonb_build_object('id', schedule.id, 'jobId', schedule.job_id)
        order by schedule.id
      ),
      '[]'::jsonb
    )
  into current_schedule, v_schedules
  from public.scheduled_jobs schedule
  where schedule.job_id = p_project_id;

  select
    coalesce(bool_or(
      running.materials_ordered_at is not null
      or running.roofing_ordered_at is not null
      or nullif(btrim(running.lights_status), '') is not null
      or nullif(btrim(running.notes), '') is not null
    ), false),
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'projectId', running.project_id,
          'materialsOrderedAt', running.materials_ordered_at,
          'roofingOrderedAt', running.roofing_ordered_at,
          'lightsStatus', nullif(btrim(running.lights_status), ''),
          'notesHash', case
            when nullif(btrim(running.notes), '') is null then null
            else encode(
              sha256(convert_to(btrim(running.notes), 'UTF8')),
              'hex'
            )
          end
        )
        order by running.project_id
      ),
      '[]'::jsonb
    )
  into running_job, v_running_rows
  from public.project_running_job_meta running
  where running.project_id = p_project_id;

  select
    coalesce(bool_or(task.status = 'OPEN'), false),
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', task.id,
          'status', task.status,
          'completedAt', task.completed_at
        )
        order by task.id
      ),
      '[]'::jsonb
    )
  into v_task_open, v_tasks
  from public.tasks task
  where task.project_id = p_project_id;

  select
    coalesce(bool_or(followup.status = 'OPEN'), false),
    coalesce(bool_or(
      followup.type = 'FOLLOWUP_EMAIL'
      and followup.status = 'DONE'
      and followup.completed_at is not null
    ), false),
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', followup.id,
          'type', followup.type,
          'status', followup.status,
          'completedAt', followup.completed_at
        )
        order by followup.id
      ),
      '[]'::jsonb
    )
  into v_followup_open, sent_email, v_followups
  from public.followup_tasks followup
  where followup.project_id = p_project_id;

  select
    coalesce(bool_or(action.status = 'OPEN'), false),
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', action.id,
          'status', action.status,
          'completedAt', action.completed_at
        )
        order by action.id
      ),
      '[]'::jsonb
    )
  into v_manual_action_open, v_manual_actions
  from public.project_manual_actions action
  where action.project_id = p_project_id;

  open_obligation :=
    v_task_open or v_followup_open or v_manual_action_open;
  v_snapshot := jsonb_build_object(
    'schema', 'legacy-contacted-evidence-v1',
    'project', jsonb_build_object(
      'projectId', p_project_id,
      'pipelineStage', pipeline_stage,
      'followUpDate', follow_up_date,
      'archivedAt', archived_at,
      'updatedAt', project_updated_at
    ),
    'workModels', v_models,
    'quoteVersions', v_quote_versions,
    'depositInvoices', v_invoices,
    'designRequests', v_designs,
    'scheduledJobs', v_schedules,
    'runningJobMeta', v_running_rows,
    'tasks', v_tasks,
    'followupTasks', v_followups,
    'manualActions', v_manual_actions
  );
  evidence_fingerprint := encode(
    sha256(convert_to(v_snapshot::text, 'UTF8')),
    'hex'
  );
  return next;
end;
$$;

create or replace function public.project_work_classify_legacy_contacted_v1(
  p_as_of date default
    (current_timestamp at time zone 'Pacific/Auckland')::date,
  p_limit integer default 50,
  p_cursor jsonb default null,
  p_scope text default 'due'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_as_of date := coalesce(
    p_as_of,
    (current_timestamp at time zone 'Pacific/Auckland')::date
  );
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 100));
  v_scope text := lower(btrim(coalesce(p_scope, 'due')));
  v_cursor_rank integer;
  v_cursor_follow_up date;
  v_cursor_updated_at timestamptz;
  v_cursor_project_id uuid;
  v_result jsonb;
begin
  if not public.is_portal_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  if v_scope not in ('due','all') then
    raise exception 'scope must be due or all' using errcode = '22023';
  end if;
  if p_cursor is not null and jsonb_typeof(p_cursor) <> 'object' then
    raise exception 'cursor must be an object' using errcode = '22023';
  end if;

  if p_cursor is not null then
    v_cursor_rank := (p_cursor->>'dueRank')::integer;
    v_cursor_follow_up := nullif(p_cursor->>'followUpDate', '')::date;
    v_cursor_updated_at := (p_cursor->>'updatedAt')::timestamptz;
    v_cursor_project_id := (p_cursor->>'projectId')::uuid;
    if v_cursor_rank not in (0, 1, 2)
      or v_cursor_updated_at is null
      or v_cursor_project_id is null
      or coalesce(p_cursor->>'scope', v_scope) <> v_scope
    then
      raise exception 'cursor is incomplete' using errcode = '22023';
    end if;
  end if;

  with legacy_projects as (
    select
      project.id,
      project.name,
      project.pipeline_stage,
      project.updated_at,
      project.follow_up_date,
      project.archived_at
    from public.projects project
    left join public.project_work_model_versions model
      on model.project_id = project.id
    where upper(btrim(project.pipeline_stage)) = 'CONTACTED'
      and model.project_id is null
  ),
  evidence_rows as (
    select
      project.*,
      evidence.current_quote,
      evidence.current_invoice,
      evidence.current_design,
      evidence.current_schedule,
      evidence.running_job,
      evidence.open_obligation,
      evidence.sent_email,
      evidence.evidence_fingerprint
    from legacy_projects project
    cross join lateral
      public.project_work_legacy_contacted_evidence_v1(project.id) evidence
  ),
  classified as (
    select
      evidence.*,
      (
        evidence.current_quote
        or evidence.current_invoice
        or evidence.current_design
        or evidence.current_schedule
        or evidence.running_job
        or evidence.open_obligation
      ) as has_active_evidence,
      case
        when evidence.current_quote
          or evidence.current_invoice
          or evidence.current_design
          or evidence.current_schedule
          or evidence.running_job
          or evidence.open_obligation
          then 'ACTIVE_EVIDENCE'
        when evidence.follow_up_date > v_as_of
          then 'WAITING_CANDIDATE'
        when evidence.follow_up_date <= v_as_of and evidence.sent_email
          then 'LOST_NO_RESPONSE_CANDIDATE'
        else 'MANUAL_CLASSIFICATION'
      end as recommendation,
      case
        when evidence.follow_up_date is null then 2
        when evidence.follow_up_date <= v_as_of then 0
        else 1
      end as due_rank
    from evidence_rows evidence
  ),
  active_classified as (
    select *
    from classified
    where archived_at is null
  ),
  scoped_classified as (
    select *
    from active_classified
    where v_scope = 'all'
      or (
        follow_up_date is not null
        and follow_up_date <= v_as_of
      )
  ),
  paged_candidates as (
    select classified.*
    from scoped_classified classified
    where p_cursor is null
      or (
        classified.due_rank,
        coalesce(classified.follow_up_date, date '9999-12-31'),
        classified.updated_at,
        classified.id
      ) > (
        v_cursor_rank,
        coalesce(v_cursor_follow_up, date '9999-12-31'),
        v_cursor_updated_at,
        v_cursor_project_id
      )
    order by
      classified.due_rank,
      classified.follow_up_date nulls last,
      classified.updated_at,
      classified.id
    limit v_limit + 1
  ),
  numbered_page as (
    select
      candidate.*,
      row_number() over (
        order by
          candidate.due_rank,
          candidate.follow_up_date nulls last,
          candidate.updated_at,
          candidate.id
      ) as row_number
    from paged_candidates candidate
  ),
  page_rows as (
    select *
    from numbered_page
    where row_number <= v_limit
  ),
  next_row as (
    select *
    from numbered_page
    where row_number = v_limit + 1
  ),
  projects_json as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'projectId', page.id,
          'projectName', page.name,
          'pipelineStage', lower(btrim(page.pipeline_stage)),
          'updatedAt', page.updated_at,
          'evidenceFingerprint', page.evidence_fingerprint,
          'followUpDate', page.follow_up_date,
          'recommendation', page.recommendation,
          'reasonCodes',
            array_remove(array[
              case when page.current_quote then 'CURRENT_QUOTE' end,
              case when page.current_invoice then 'CURRENT_INVOICE' end,
              case when page.current_design then 'CURRENT_DESIGN' end,
              case when page.current_schedule then 'CURRENT_SCHEDULE' end,
              case when page.running_job then 'RUNNING_JOB' end,
              case when page.open_obligation then 'OPEN_OBLIGATION' end,
              case when page.sent_email then 'SENT_EMAIL_EVIDENCE' end,
              case
                when page.follow_up_date <= v_as_of then 'FOLLOW_UP_DUE'
              end,
              case
                when page.follow_up_date > v_as_of then 'FUTURE_FOLLOW_UP_DATE'
              end,
              case
                when page.follow_up_date is null then 'FOLLOW_UP_DATE_MISSING'
              end,
              case
                when page.recommendation = 'MANUAL_CLASSIFICATION'
                  then 'INSUFFICIENT_EVIDENCE'
              end
            ], null),
          'evidence', jsonb_build_object(
            'currentQuote', page.current_quote,
            'currentInvoice', page.current_invoice,
            'currentDesign', page.current_design,
            'currentSchedule', page.current_schedule,
            'runningJob', page.running_job,
            'openObligation', page.open_obligation,
            'sentEmail', page.sent_email
          )
        )
        order by
          page.due_rank,
          page.follow_up_date nulls last,
          page.updated_at,
          page.id
      ),
      '[]'::jsonb
    ) as projects
    from page_rows page
  ),
  summary_json as (
    select jsonb_build_object(
      'total', count(*)::integer,
      'due', count(*) filter (
        where follow_up_date is not null and follow_up_date <= v_as_of
      )::integer,
      'archived', (
        select count(*)::integer
        from classified archived
        where archived.archived_at is not null
      ),
      'byRecommendation', jsonb_build_object(
        'ACTIVE_EVIDENCE', count(*) filter (
          where recommendation = 'ACTIVE_EVIDENCE'
        )::integer,
        'WAITING_CANDIDATE', count(*) filter (
          where recommendation = 'WAITING_CANDIDATE'
        )::integer,
        'LOST_NO_RESPONSE_CANDIDATE', count(*) filter (
          where recommendation = 'LOST_NO_RESPONSE_CANDIDATE'
        )::integer,
        'MANUAL_CLASSIFICATION', count(*) filter (
          where recommendation = 'MANUAL_CLASSIFICATION'
        )::integer
      )
    ) as summary
    from active_classified
  ),
  cursor_json as (
    select case
      when exists(select 1 from next_row) then (
        select jsonb_build_object(
          'dueRank', page.due_rank,
          'followUpDate', page.follow_up_date,
          'updatedAt', page.updated_at,
          'projectId', page.id,
          'scope', v_scope
        )
        from page_rows page
        order by
          page.due_rank desc,
          page.follow_up_date desc nulls first,
          page.updated_at desc,
          page.id desc
        limit 1
      )
      else null
    end as next_cursor
  )
  select jsonb_build_object(
    'projects', projects_json.projects,
    'summary', summary_json.summary,
    'generatedAt', statement_timestamp(),
    'nextCursor', cursor_json.next_cursor
  )
  into v_result
  from projects_json
  cross join summary_json
  cross join cursor_json;

  return v_result;
end;
$$;

drop function if exists public.project_work_migrate_legacy_contacted_v1(
  uuid,uuid,timestamptz,text,text,text,text,timestamptz,timestamptz,text
);
create or replace function public.project_work_migrate_legacy_contacted_v1(
  p_project_id uuid,
  p_command_id uuid,
  p_expected_updated_at timestamptz,
  p_expected_evidence_fingerprint text,
  p_disposition text,
  p_reason text,
  p_title text default null,
  p_responsibility_area text default null,
  p_due_at timestamptz default null,
  p_waiting_until timestamptz default null,
  p_closed_outcome text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_disposition text := upper(btrim(coalesce(p_disposition, '')));
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_expected_evidence_fingerprint text :=
    lower(btrim(coalesce(p_expected_evidence_fingerprint, '')));
  v_current_evidence_fingerprint text;
  v_title text := nullif(btrim(coalesce(p_title, '')), '');
  v_responsibility text :=
    upper(btrim(coalesce(p_responsibility_area, '')));
  v_closed_outcome text := upper(btrim(coalesce(p_closed_outcome, '')));
  v_intent jsonb;
  v_replay jsonb;
  v_project public.projects%rowtype;
  v_state public.project_operational_states%rowtype;
  v_work_item_id uuid;
  v_result jsonb;
  v_previous_setting text;
begin
  if not public.is_portal_admin() then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  if p_project_id is null
    or p_command_id is null
    or p_expected_updated_at is null
    or v_expected_evidence_fingerprint !~ '^[0-9a-f]{64}$'
    or v_disposition not in (
      'ACTIVE_WORK',
      'ACTIVE_TRIAGE',
      'WAITING',
      'CLOSED'
    )
    or v_reason is null
    or char_length(v_reason) > 1000
  then
    raise exception
      'project, command, expected update and evidence, disposition, and reason are required'
      using errcode = '22023';
  end if;
  if v_disposition = 'ACTIVE_WORK' and (
    v_title is null
    or char_length(v_title) > 160
    or v_responsibility not in (
      'CUSTOMER','DESIGN','COMMERCIAL','OPERATIONS','ADMIN'
    )
    or p_due_at is null
  ) then
    raise exception
      'ACTIVE_WORK requires title, due time, and responsibility'
      using errcode = '22023';
  end if;
  if v_disposition = 'WAITING' and (
    p_waiting_until is null
    or p_waiting_until <= clock_timestamp()
  ) then
    raise exception 'WAITING requires a future wake time'
      using errcode = '22023';
  end if;
  if v_disposition = 'CLOSED' and v_closed_outcome not in (
    'LOST_NO_RESPONSE',
    'LOST_BUDGET_PRICE',
    'LOST_OTHER_SUPPLIER',
    'LOST_TIMING_DEFERRED',
    'LOST_NOT_SUITABLE',
    'CANCELLED'
  ) then
    raise exception 'CLOSED requires a valid Contacted outcome'
      using errcode = '22023';
  end if;

  v_intent := jsonb_strip_nulls(jsonb_build_object(
    'expectedUpdatedAt', p_expected_updated_at,
    'expectedEvidenceFingerprint', v_expected_evidence_fingerprint,
    'disposition', v_disposition,
    'reason', v_reason,
    'title', v_title,
    'responsibilityArea', nullif(v_responsibility, ''),
    'dueAt', p_due_at,
    'waitingUntil', p_waiting_until,
    'closedOutcome', nullif(v_closed_outcome, '')
  ));
  perform pg_advisory_xact_lock(hashtextextended(p_command_id::text, 1));
  v_replay := public.project_work_items_receipt_replay(
    p_project_id,
    p_command_id,
    'LEGACY_CONTACTED_MIGRATION',
    v_intent
  );
  if v_replay is not null then
    return v_replay;
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
  if v_project.updated_at is distinct from p_expected_updated_at then
    raise exception 'STALE_PROJECT: project changed after review'
      using errcode = 'P0001';
  end if;
  if v_project.archived_at is not null then
    raise exception 'archived projects cannot be reviewed into V2'
      using errcode = '22023';
  end if;
  if upper(btrim(v_project.pipeline_stage)) <> 'CONTACTED' then
    raise exception 'only Contacted projects can use this migration command'
      using errcode = '22023';
  end if;
  if exists (
    select 1
    from public.project_work_model_versions model
    where model.project_id = p_project_id
  ) then
    raise exception 'project already uses a governed work model'
      using errcode = 'P0001';
  end if;

  select evidence.evidence_fingerprint
  into v_current_evidence_fingerprint
  from public.project_work_legacy_contacted_evidence_v1(p_project_id) evidence;
  if v_current_evidence_fingerprint is null
    or v_current_evidence_fingerprint <> v_expected_evidence_fingerprint
  then
    raise exception
      'LEGACY_CONTACTED_EVIDENCE_STALE: related evidence changed after review'
      using errcode = 'P0001';
  end if;

  v_previous_setting :=
    current_setting('sanctuary.project_work_command', true);
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
    clock_timestamp(),
    v_actor,
    'REVIEWED_MIGRATION'
  );

  insert into public.project_operational_states(
    project_id,
    state,
    waiting_until,
    waiting_reason,
    closed_outcome,
    closed_note,
    row_version,
    created_by,
    updated_by
  )
  values (
    p_project_id,
    case
      when v_disposition = 'WAITING' then 'WAITING'
      when v_disposition = 'CLOSED' then 'CLOSED'
      else 'ACTIVE'
    end,
    case when v_disposition = 'WAITING' then p_waiting_until else null end,
    case when v_disposition = 'WAITING' then v_reason else null end,
    case when v_disposition = 'CLOSED' then v_closed_outcome else null end,
    case when v_disposition = 'CLOSED' then v_reason else null end,
    1,
    v_actor,
    v_actor
  )
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
    actor_kind
  )
  values (
    p_project_id,
    p_command_id,
    0,
    'WORK_MODEL_MIGRATED',
    null,
    to_jsonb(v_state),
    v_reason,
    v_actor,
    'MIGRATION'
  );

  if v_disposition = 'ACTIVE_WORK' then
    insert into public.project_work_items(
      project_id,
      title,
      responsibility_area,
      status,
      due_at,
      deadline_policy,
      priority,
      origin,
      source_type,
      source_key,
      created_by,
      updated_by
    )
    values (
      p_project_id,
      v_title,
      v_responsibility,
      'OPEN',
      p_due_at,
      'MANUAL',
      'NORMAL',
      'REVIEWED_MIGRATION',
      'LEGACY_REVIEW',
      'legacy-review:' || p_project_id::text || ':' || p_command_id::text,
      v_actor,
      v_actor
    )
    returning id into v_work_item_id;

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
      actor_kind
    )
    select
      item.id,
      item.project_id,
      p_command_id,
      1,
      'CREATED',
      null,
      to_jsonb(item),
      v_reason,
      v_actor,
      'MIGRATION'
    from public.project_work_items item
    where item.id = v_work_item_id;
  end if;

  perform public.project_work_items_refresh_projection(p_project_id);
  select project.*
  into v_project
  from public.projects project
  where project.id = p_project_id;

  v_result := jsonb_build_object(
    'project_id', p_project_id,
    'disposition', v_disposition,
    'operational_state', v_state.state,
    'state_row_version', v_state.row_version,
    'work_item_id', v_work_item_id,
    'project_updated_at', v_project.updated_at,
    'replayed', false,
    'refresh_required', false
  );
  perform public.project_work_items_store_receipt(
    p_project_id,
    p_command_id,
    'LEGACY_CONTACTED_MIGRATION',
    v_intent,
    v_actor,
    'MIGRATION',
    v_result
  );
  perform set_config(
    'sanctuary.project_work_command',
    coalesce(v_previous_setting, ''),
    true
  );
  return v_result;
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

revoke all on function public.project_work_queue_v3(timestamptz,integer)
  from public, anon, authenticated, service_role;
grant execute on function public.project_work_queue_v3(timestamptz,integer)
  to authenticated;

revoke all on function public.project_confirmation_retraction_command(
  uuid,uuid,uuid,text
) from public, anon, authenticated, service_role;
grant execute on function public.project_confirmation_retraction_command(
  uuid,uuid,uuid,text
) to authenticated;

revoke all on function public.project_confirmation_retraction_review_command(
  uuid,uuid,bigint,uuid,text
) from public, anon, authenticated, service_role;
grant execute on function public.project_confirmation_retraction_review_command(
  uuid,uuid,bigint,uuid,text
) to authenticated;

revoke all on function public.project_work_legacy_contacted_evidence_v1(uuid)
  from public, anon, authenticated, service_role;

revoke all on function public.project_work_classify_legacy_contacted_v1(
  date,integer,jsonb,text
) from public, anon, authenticated, service_role;
grant execute on function public.project_work_classify_legacy_contacted_v1(
  date,integer,jsonb,text
) to authenticated;

revoke all on function public.project_work_migrate_legacy_contacted_v1(
  uuid,uuid,timestamptz,text,text,text,text,text,timestamptz,timestamptz,text
) from public, anon, authenticated, service_role;
grant execute on function public.project_work_migrate_legacy_contacted_v1(
  uuid,uuid,timestamptz,text,text,text,text,text,timestamptz,timestamptz,text
) to authenticated;

select pg_notify('pgrst', 'reload schema');

commit;
