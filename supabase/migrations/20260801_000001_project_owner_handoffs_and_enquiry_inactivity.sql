begin;

-- Project Owner remains a stable business key. Ellen owns the Enquiry phase;
-- Proposal and delivery handoffs remain explicit staff actions.
alter table public.project_owner_assignments
  drop constraint if exists project_owner_assignments_owner_key_check;
alter table public.project_owner_assignments
  add constraint project_owner_assignments_owner_key_check
  check (owner_key in ('ellen','jordan','jp','joe','bruce','dave'));

create or replace function public.project_owner_apply_enquiry_policy()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_previous_owner text;
  v_actor uuid := auth.uid();
begin
  if new.archived_at is not null
    or upper(btrim(coalesce(new.pipeline_stage::text, ''))) not in (
      'NEW','CONTACTED'
    )
    or exists (
      select 1
      from public.project_operational_states state
      where state.project_id = new.id
        and state.state = 'CLOSED'
    )
  then
    return new;
  end if;

  select assignment.owner_key
  into v_previous_owner
  from public.project_owner_assignments assignment
  where assignment.project_id = new.id;

  if v_previous_owner is distinct from 'ellen' then
    insert into public.project_owner_assignments(
      project_id,
      owner_key,
      assigned_by,
      assigned_at,
      updated_at
    )
    values (new.id, 'ellen', v_actor, clock_timestamp(), clock_timestamp())
    on conflict (project_id) do update set
      owner_key = excluded.owner_key,
      assigned_by = excluded.assigned_by,
      assigned_at = excluded.assigned_at,
      updated_at = excluded.updated_at;

    insert into public.project_command_audit(
      project_id,
      command_id,
      event_type,
      actor_user_id,
      reason,
      before_state,
      after_state
    )
    values (
      new.id,
      gen_random_uuid(),
      'project_owner_enquiry_policy_applied',
      v_actor,
      'Ellen owns active projects in the Enquiry phase',
      case
        when v_previous_owner is null then null
        else jsonb_build_object('ownerKey', v_previous_owner)
      end,
      jsonb_build_object('ownerKey', 'ellen')
    );
  end if;

  return new;
end;
$$;

drop trigger if exists projects_apply_enquiry_owner_policy
  on public.projects;
create trigger projects_apply_enquiry_owner_policy
after insert or update of pipeline_stage on public.projects
for each row execute function public.project_owner_apply_enquiry_policy();

-- Bring current, non-archived Enquiry projects under the same policy without
-- treating the migration itself as customer/staff activity.
insert into public.project_command_audit(
  project_id,
  command_id,
  event_type,
  actor_user_id,
  reason,
  before_state,
  after_state
)
select
  project.id,
  md5('project-owner-enquiry-policy-v1:' || project.id::text)::uuid,
  'project_owner_enquiry_policy_backfilled',
  null,
  'Ellen owns active projects in the Enquiry phase',
  case
    when assignment.owner_key is null then null
    else jsonb_build_object('ownerKey', assignment.owner_key)
  end,
  jsonb_build_object('ownerKey', 'ellen')
from public.projects project
left join public.project_operational_states state
  on state.project_id = project.id
left join public.project_owner_assignments assignment
  on assignment.project_id = project.id
where project.archived_at is null
  and upper(btrim(coalesce(project.pipeline_stage::text, ''))) in (
    'NEW','CONTACTED'
  )
  and coalesce(state.state, 'ACTIVE') in ('ACTIVE','WAITING')
  and assignment.owner_key is distinct from 'ellen'
on conflict (command_id, event_sequence) do nothing;

insert into public.project_owner_assignments(
  project_id,
  owner_key,
  assigned_by,
  assigned_at,
  updated_at
)
select
  project.id,
  'ellen',
  null,
  clock_timestamp(),
  clock_timestamp()
from public.projects project
left join public.project_operational_states state
  on state.project_id = project.id
where project.archived_at is null
  and upper(btrim(coalesce(project.pipeline_stage::text, ''))) in (
    'NEW','CONTACTED'
  )
  and coalesce(state.state, 'ACTIVE') in ('ACTIVE','WAITING')
on conflict (project_id) do update set
  owner_key = excluded.owner_key,
  assigned_by = null,
  assigned_at = excluded.assigned_at,
  updated_at = excluded.updated_at
where public.project_owner_assignments.owner_key is distinct from 'ellen';

-- The normal owner command stays admin-only. It also prevents an active
-- Enquiry project from being unassigned or moved away from Ellen. Proposal
-- and delivery ownership remain manual selections.
create or replace function public.project_command_set_owner(
  p_project_id uuid,
  p_owner_key text,
  p_command_id uuid,
  p_expected_updated_at timestamptz default null
)
returns table (owner_key text, updated_at timestamptz, replayed boolean)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  current_row public.project_owner_assignments%rowtype;
  actor_role text;
  project_stage text;
  project_archived_at timestamptz;
  project_state text;
  result_owner_key text;
  result_updated_at timestamptz;
begin
  if p_owner_key is not null and p_owner_key not in (
    'ellen','jordan','jp','joe','bruce','dave'
  ) then
    raise exception 'invalid project owner' using errcode = '22023';
  end if;
  if not public.has_portal_access() then
    raise exception 'portal access required' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_command_id::text, 0));
  if exists(
    select 1
    from public.project_command_audit
    where command_id = p_command_id
  ) then
    if not exists(
      select 1
      from public.project_command_audit audit
      where audit.command_id = p_command_id
        and audit.project_id = p_project_id
        and audit.event_type = 'project_owner_changed'
        and nullif(audit.after_state ->> 'ownerKey', '')
          is not distinct from p_owner_key
    ) then
      raise exception 'command id was already used for a different command'
        using errcode = '22023';
    end if;
    select assignment.owner_key, assignment.updated_at
    into result_owner_key, result_updated_at
    from public.project_owner_assignments assignment
    where assignment.project_id = p_project_id;
    return query select result_owner_key, result_updated_at, true;
    return;
  end if;

  select
    project.pipeline_stage::text,
    project.archived_at,
    state.state
  into project_stage, project_archived_at, project_state
  from public.projects project
  left join public.project_operational_states state
    on state.project_id = project.id
  where project.id = p_project_id;
  if not found then
    raise exception 'project not found' using errcode = 'P0002';
  end if;
  if project_archived_at is null
    and upper(btrim(coalesce(project_stage, ''))) in ('NEW','CONTACTED')
    and coalesce(project_state, 'ACTIVE') <> 'CLOSED'
    and p_owner_key is distinct from 'ellen'
  then
    raise exception 'active Enquiry projects must be owned by Ellen'
      using errcode = '22023';
  end if;

  select role into actor_role
  from public.portal_users
  where user_id = auth.uid();
  if actor_role <> 'admin' then
    raise exception 'project owner change requires admin'
      using errcode = '42501';
  end if;

  select * into current_row
  from public.project_owner_assignments
  where project_id = p_project_id
  for update;
  if found and p_expected_updated_at is distinct from current_row.updated_at then
    raise exception 'owner assignment changed' using errcode = '40001';
  end if;
  if not found and p_expected_updated_at is not null then
    raise exception 'owner assignment changed' using errcode = '40001';
  end if;

  if p_owner_key is null then
    delete from public.project_owner_assignments
    where project_id = p_project_id;
    result_owner_key := null;
    result_updated_at := now();
  else
    insert into public.project_owner_assignments(
      project_id,
      owner_key,
      assigned_by
    )
    values (p_project_id, p_owner_key, auth.uid())
    on conflict (project_id) do update set
      owner_key = excluded.owner_key,
      assigned_by = auth.uid(),
      assigned_at = now(),
      updated_at = now()
    returning
      project_owner_assignments.owner_key,
      project_owner_assignments.updated_at
    into result_owner_key, result_updated_at;
  end if;

  insert into public.project_command_audit(
    project_id,
    command_id,
    event_type,
    actor_user_id,
    reason,
    before_state,
    after_state
  )
  values (
    p_project_id,
    p_command_id,
    'project_owner_changed',
    auth.uid(),
    null,
    case
      when current_row.project_id is null then null
      else jsonb_build_object('ownerKey', current_row.owner_key)
    end,
    jsonb_build_object('ownerKey', p_owner_key)
  );
  return query select result_owner_key, result_updated_at, false;
end;
$$;

revoke all on function public.project_command_set_owner(
  uuid,text,uuid,timestamptz
) from public, anon;
grant execute on function public.project_command_set_owner(
  uuid,text,uuid,timestamptz
) to authenticated;

-- Read-only, evidence-backed candidate report. It deliberately ignores
-- migration/system-only V2 events so portfolio rollout cannot make an old
-- enquiry appear recently handled. This function never closes a project.
create or replace function public.project_enquiry_inactivity_report_v1(
  p_as_of timestamptz default clock_timestamp(),
  p_inactive_days integer default 30
)
returns table (
  project_id uuid,
  project_name text,
  pipeline_stage text,
  operational_state text,
  waiting_until timestamptz,
  owner_key text,
  last_activity_at timestamptz,
  last_activity_source text,
  inactive_for_days integer,
  protected_by_future_wait boolean,
  evidence_fingerprint text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
begin
  if not public.is_portal_admin()
    and coalesce(auth.role(), '') <> 'service_role'
  then
    raise exception 'admin access required' using errcode = '42501';
  end if;
  if p_as_of is null
    or p_inactive_days is null
    or p_inactive_days < 1
    or p_inactive_days > 3650
  then
    raise exception 'invalid inactivity report window' using errcode = '22023';
  end if;

  return query
  with enquiry_projects as (
    select
      project.id,
      project.name,
      lower(btrim(project.pipeline_stage::text)) as stage,
      project.created_at,
      project.updated_at,
      state.state,
      state.waiting_until,
      assignment.owner_key
    from public.projects project
    join public.project_operational_states state
      on state.project_id = project.id
    left join public.project_owner_assignments assignment
      on assignment.project_id = project.id
    where project.archived_at is null
      and upper(btrim(project.pipeline_stage::text)) in ('NEW','CONTACTED')
      and state.state in ('ACTIVE','WAITING')
  ),
  recorded_activity(project_id, occurred_at, source) as (
    select project.id, greatest(project.created_at, project.updated_at),
      'project_record'
    from enquiry_projects project
    union all
    select note.project_id,
      greatest(note.created_at, note.updated_at, note.deleted_at),
      'project_note'
    from public.project_notes note
    join enquiry_projects project on project.id = note.project_id
    union all
    select event.project_id, event.created_at, 'audit_event'
    from public.audit_events event
    join enquiry_projects project on project.id = event.project_id
    union all
    select email.project_id,
      greatest(email.created_at, email.sent_at),
      'email'
    from public.email_outbox email
    join enquiry_projects project on project.id = email.project_id
    union all
    select task.project_id,
      greatest(task.created_at, task.updated_at, task.completed_at),
      'legacy_task'
    from public.tasks task
    join enquiry_projects project on project.id = task.project_id
    union all
    select task.project_id,
      greatest(task.created_at, task.updated_at, task.completed_at),
      'legacy_follow_up'
    from public.followup_tasks task
    join enquiry_projects project on project.id = task.project_id
    union all
    select action.project_id,
      greatest(action.created_at, action.updated_at, action.completed_at),
      'manual_project_work'
    from public.project_manual_actions action
    join enquiry_projects project on project.id = action.project_id
    union all
    select event.project_id, event.occurred_at, 'operational_state'
    from public.project_state_events event
    join enquiry_projects project on project.id = event.project_id
    where event.actor_kind = 'STAFF'
    union all
    select event.project_id, event.occurred_at, 'project_work'
    from public.project_work_item_events event
    join enquiry_projects project on project.id = event.project_id
    where event.actor_kind = 'STAFF'
    union all
    select confirmation.project_id,
      greatest(confirmation.occurred_at, confirmation.recorded_at),
      'confirmation'
    from public.project_confirmation_events confirmation
    join enquiry_projects project on project.id = confirmation.project_id
    where confirmation.actor_kind = 'STAFF'
    union all
    select item.project_id,
      greatest(
        item.created_at,
        item.updated_at,
        item.completed_at,
        item.cancelled_at
      ),
      'manual_project_work'
    from public.project_work_items item
    join enquiry_projects project on project.id = item.project_id
    where item.origin = 'MANUAL'
      or item.created_by is not null
      or item.updated_by is not null
      or item.completed_by is not null
      or item.cancelled_by is not null
    union all
    select audit.project_id, audit.created_at, 'project_command'
    from public.project_command_audit audit
    join enquiry_projects project on project.id = audit.project_id
    where audit.actor_user_id is not null
    union all
    select estimate.project_id,
      greatest(estimate.created_at, estimate.updated_at),
      'estimate'
    from public.estimates estimate
    join enquiry_projects project on project.id = estimate.project_id
    union all
    select quote.project_id, quote.created_at, 'quote'
    from public.quotes quote
    join enquiry_projects project on project.id = quote.project_id
    union all
    select quote.project_id,
      greatest(version.created_at, version.updated_at, version.sent_at),
      'quote_version'
    from public.quotes quote
    join enquiry_projects project on project.id = quote.project_id
    join public.quote_versions version on version.quote_id = quote.id
    union all
    select log.project_id,
      greatest(log.created_at, log.sent_at),
      'quote_delivery'
    from public.quote_send_logs log
    join enquiry_projects project on project.id = log.project_id
    union all
    select invoice.project_id,
      greatest(invoice.created_at, invoice.updated_at, invoice.sent_at),
      'invoice'
    from public.deposit_invoices invoice
    join enquiry_projects project on project.id = invoice.project_id
    union all
    select visit.project_id,
      greatest(
        visit.created_at,
        visit.updated_at,
        visit.confirmed_at,
        visit.last_notified_at
      ),
      'site_visit'
    from public.site_visit_events visit
    join enquiry_projects project on project.id = visit.project_id
    union all
    select job.job_id,
      greatest(
        job.created_at,
        job.updated_at,
        job.actual_start,
        job.actual_finish,
        job.client_update_ack_at
      ),
      'schedule'
    from public.scheduled_jobs job
    join enquiry_projects project on project.id = job.job_id
    union all
    select request.project_id,
      greatest(
        request.created_at,
        request.updated_at,
        request.requested_at,
        request.started_at,
        request.completed_at,
        request.cancelled_at
      ),
      'design_package'
    from public.design_package_requests request
    join enquiry_projects project on project.id = request.project_id
    union all
    select running.project_id,
      greatest(
        running.created_at,
        running.updated_at,
        running.materials_ordered_at,
        running.roofing_ordered_at
      ),
      'running_job'
    from public.project_running_job_meta running
    join enquiry_projects project on project.id = running.project_id
    union all
    select artifact.project_id, artifact.created_at, 'file'
    from public.file_artifacts artifact
    join enquiry_projects project on project.id = artifact.project_id
    union all
    select enquiry.project_id,
      greatest(enquiry.created_at, enquiry.updated_at),
      'enquiry_request'
    from public.enquiry_requests enquiry
    join enquiry_projects project on project.id = enquiry.project_id
    union all
    select check_row.project_id, check_row.completed_at, 'project_check'
    from public.project_task_checks check_row
    join enquiry_projects project on project.id = check_row.project_id
    where check_row.completed_at is not null
  ),
  latest_activity as (
    select distinct on (activity.project_id)
      activity.project_id,
      activity.occurred_at,
      activity.source
    from recorded_activity activity
    where activity.occurred_at is not null
      and activity.occurred_at <= p_as_of
    order by activity.project_id, activity.occurred_at desc, activity.source
  )
  select
    project.id,
    project.name,
    project.stage,
    project.state,
    project.waiting_until,
    project.owner_key,
    activity.occurred_at,
    activity.source,
    floor(extract(epoch from (p_as_of - activity.occurred_at)) / 86400)::integer,
    project.state = 'WAITING' and project.waiting_until > p_as_of,
    encode(
      digest(
        project.id::text || ':' ||
        activity.occurred_at::text || ':' ||
        p_as_of::text || ':' ||
        p_inactive_days::text,
        'sha256'
      ),
      'hex'
    )
  from enquiry_projects project
  join latest_activity activity on activity.project_id = project.id
  where activity.occurred_at <
    p_as_of - make_interval(days => p_inactive_days)
  order by activity.occurred_at, project.id;
end;
$$;

revoke all on function public.project_enquiry_inactivity_report_v1(
  timestamptz,integer
) from public, anon;
grant execute on function public.project_enquiry_inactivity_report_v1(
  timestamptz,integer
) to authenticated, service_role;

revoke all on function public.project_owner_apply_enquiry_policy()
  from public, anon, authenticated, service_role;

commit;

notify pgrst, 'reload schema';
