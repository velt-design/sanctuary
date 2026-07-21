-- Project Command Centre Stage 2: canonical ownership, primary actions and audit.

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  type text not null,
  status text not null default 'OPEN' check (status in ('OPEN','DONE','SKIPPED','RESCHEDULED')),
  assigned_to uuid null,
  due_at timestamptz null,
  title text not null,
  details text null,
  meta jsonb not null default '{}'::jsonb,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  completed_at timestamptz null,
  updated_at timestamptz not null default now()
);

create table if not exists public.followup_plans (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  quote_id uuid null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','PAUSED','CANCELLED','COMPLETE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.followup_tasks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.followup_plans(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  type text not null check (type in ('FOLLOWUP_CALL','FOLLOWUP_EMAIL')),
  status text not null default 'OPEN' check (status in ('OPEN','DONE','SKIPPED','RESCHEDULED')),
  assigned_to uuid null,
  due_at timestamptz not null,
  outcome_note text null,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  completed_at timestamptz null,
  updated_at timestamptz not null default now()
);

alter table public.tasks add column if not exists updated_at timestamptz not null default now();
alter table public.followup_tasks add column if not exists updated_at timestamptz not null default now();

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at before update on public.tasks
for each row execute function public.set_updated_at();

drop trigger if exists followup_tasks_set_updated_at on public.followup_tasks;
create trigger followup_tasks_set_updated_at before update on public.followup_tasks
for each row execute function public.set_updated_at();

drop trigger if exists followup_plans_set_updated_at on public.followup_plans;
create trigger followup_plans_set_updated_at before update on public.followup_plans
for each row execute function public.set_updated_at();

create index if not exists tasks_command_centre_open
  on public.tasks(project_id, due_at, created_at) where status = 'OPEN';
create index if not exists tasks_by_assigned_status
  on public.tasks(assigned_to, status);
create index if not exists followup_tasks_command_centre_open
  on public.followup_tasks(project_id, due_at, created_at) where status = 'OPEN';
create index if not exists followup_tasks_by_assigned_status
  on public.followup_tasks(assigned_to, status);
create index if not exists followup_plans_by_project_status
  on public.followup_plans(project_id, status);
create unique index if not exists followup_plans_one_active_per_project
  on public.followup_plans(project_id) where status = 'ACTIVE';

create table if not exists public.project_role_assignments (
  project_id uuid not null references public.projects(id) on delete cascade,
  role text not null check (role in ('sales','design','estimating')),
  owner_user_id uuid not null references public.portal_users(user_id) on delete cascade,
  assigned_by uuid null references public.portal_users(user_id) on delete set null,
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (project_id, role)
);

create table if not exists public.project_manual_actions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 160),
  category text not null check (category in ('Call','Site visit','Design','Estimate','Quote','Follow-up','Other')),
  owner_user_id uuid null references public.portal_users(user_id) on delete set null,
  due_at timestamptz not null,
  status text not null default 'OPEN' check (status in ('OPEN','DONE','CANCELLED')),
  origin text not null default 'manual' check (origin in ('manual','legacy_backfill')),
  origin_key text null unique,
  created_by uuid null references public.portal_users(user_id) on delete set null,
  completed_by uuid null references public.portal_users(user_id) on delete set null,
  completed_at timestamptz null,
  outcome text null check (outcome is null or char_length(outcome) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_manual_actions_origin_key check (origin = 'manual' or origin_key is not null)
);

create table if not exists public.project_action_controls (
  project_id uuid not null references public.projects(id) on delete cascade,
  source_kind text not null check (source_kind in ('automation_task','quote_followup','manual')),
  source_id uuid not null,
  is_critical boolean not null default false,
  critical_reason text null check (critical_reason is null or char_length(trim(critical_reason)) between 1 and 500),
  reschedule_count integer not null default 0 check (reschedule_count >= 0),
  updated_by uuid null references public.portal_users(user_id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (source_kind, source_id),
  constraint project_action_controls_critical_reason check (
    (is_critical and critical_reason is not null) or (not is_critical and critical_reason is null)
  )
);

create table if not exists public.project_primary_action_selections (
  project_id uuid primary key references public.projects(id) on delete cascade,
  source_kind text not null check (source_kind in ('automation_task','quote_followup','manual')),
  source_id uuid not null,
  selected_by uuid null references public.portal_users(user_id) on delete set null,
  selected_at timestamptz not null default now(),
  confirmed_outranking_hash text not null default 'cc_741638a5',
  candidate_revision text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.project_command_audit (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  command_id uuid not null,
  event_sequence smallint not null default 0 check (event_sequence >= 0),
  event_type text not null,
  source_kind text null check (source_kind is null or source_kind in ('automation_task','quote_followup','manual')),
  source_id uuid null,
  actor_user_id uuid null references public.portal_users(user_id) on delete set null,
  reason text null check (reason is null or char_length(reason) <= 500),
  before_state jsonb null,
  after_state jsonb null,
  created_at timestamptz not null default now(),
  unique (command_id, event_sequence)
);

-- Transactional optimistic version for the complete candidate set. Source
-- table triggers own increments so route validation cannot miss a concurrent
-- automation/follow-up/manual candidate change.
create table if not exists public.project_action_versions (
  project_id uuid primary key references public.projects(id) on delete cascade,
  version bigint not null default 0 check (version >= 0),
  updated_at timestamptz not null default now()
);

insert into public.project_action_versions(project_id)
select id from public.projects
on conflict(project_id) do nothing;

create or replace function public.bump_project_action_version()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_project_id uuid;
begin
  target_project_id := case when tg_op='DELETE' then old.project_id else new.project_id end;
  insert into public.project_action_versions(project_id,version,updated_at)
  values(target_project_id,1,now())
  on conflict(project_id) do update set
    version=project_action_versions.version+1,
    updated_at=now();
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists tasks_bump_project_action_version on public.tasks;
create trigger tasks_bump_project_action_version after insert or update or delete on public.tasks
for each row execute function public.bump_project_action_version();
drop trigger if exists followup_tasks_bump_project_action_version on public.followup_tasks;
create trigger followup_tasks_bump_project_action_version after insert or update or delete on public.followup_tasks
for each row execute function public.bump_project_action_version();
drop trigger if exists project_manual_actions_bump_project_action_version on public.project_manual_actions;
create trigger project_manual_actions_bump_project_action_version after insert or update or delete on public.project_manual_actions
for each row execute function public.bump_project_action_version();

create index if not exists project_role_assignments_owner on public.project_role_assignments(owner_user_id);
create index if not exists project_manual_actions_open on public.project_manual_actions(project_id, due_at, created_at) where status = 'OPEN';
create index if not exists project_action_controls_project on public.project_action_controls(project_id);
create index if not exists project_command_audit_project_recent on public.project_command_audit(project_id, created_at desc);

drop trigger if exists project_role_assignments_set_updated_at on public.project_role_assignments;
create trigger project_role_assignments_set_updated_at before update on public.project_role_assignments
for each row execute function public.set_updated_at();
drop trigger if exists project_manual_actions_set_updated_at on public.project_manual_actions;
create trigger project_manual_actions_set_updated_at before update on public.project_manual_actions
for each row execute function public.set_updated_at();
drop trigger if exists project_action_controls_set_updated_at on public.project_action_controls;
create trigger project_action_controls_set_updated_at before update on public.project_action_controls
for each row execute function public.set_updated_at();
drop trigger if exists project_primary_action_selections_set_updated_at on public.project_primary_action_selections;
create trigger project_primary_action_selections_set_updated_at before update on public.project_primary_action_selections
for each row execute function public.set_updated_at();

-- Compatibility-only projection columns. Canonical reads must use the records above.
alter table public.projects add column if not exists next_action_at timestamptz null;
alter table public.projects add column if not exists next_action_type text null;
alter table public.projects add column if not exists next_action text null;
alter table public.projects add column if not exists next_action_date date null;
alter table public.projects add column if not exists follow_up_date date null;

alter table public.tasks enable row level security;
alter table public.followup_plans enable row level security;
alter table public.followup_tasks enable row level security;
alter table public.project_role_assignments enable row level security;
alter table public.project_manual_actions enable row level security;
alter table public.project_action_controls enable row level security;
alter table public.project_primary_action_selections enable row level security;
alter table public.project_command_audit enable row level security;
alter table public.project_action_versions enable row level security;

revoke all on public.tasks from anon, authenticated;
revoke all on public.followup_plans from anon, authenticated;
revoke all on public.followup_tasks from anon, authenticated;
revoke all on public.project_role_assignments from anon, authenticated;
revoke all on public.project_manual_actions from anon, authenticated;
revoke all on public.project_action_controls from anon, authenticated;
revoke all on public.project_primary_action_selections from anon, authenticated;
revoke all on public.project_command_audit from anon, authenticated;
revoke all on public.project_action_versions from anon, authenticated;
grant select on public.tasks to authenticated;
grant select on public.followup_plans to authenticated;
grant select on public.followup_tasks to authenticated;
grant select on public.project_role_assignments to authenticated;
grant select on public.project_manual_actions to authenticated;
grant select on public.project_action_controls to authenticated;
grant select on public.project_primary_action_selections to authenticated;
grant select on public.project_command_audit to authenticated;
grant select on public.project_action_versions to authenticated;

drop policy if exists tasks_staff_select on public.tasks;
create policy tasks_staff_select on public.tasks for select using (public.has_portal_access());
drop policy if exists followup_plans_staff_select on public.followup_plans;
create policy followup_plans_staff_select on public.followup_plans for select using (public.has_portal_access());
drop policy if exists followup_tasks_staff_select on public.followup_tasks;
create policy followup_tasks_staff_select on public.followup_tasks for select using (public.has_portal_access());
drop policy if exists project_role_assignments_staff_select on public.project_role_assignments;
create policy project_role_assignments_staff_select on public.project_role_assignments for select using (public.has_portal_access());
drop policy if exists project_manual_actions_staff_select on public.project_manual_actions;
create policy project_manual_actions_staff_select on public.project_manual_actions for select using (public.has_portal_access());
drop policy if exists project_action_controls_staff_select on public.project_action_controls;
create policy project_action_controls_staff_select on public.project_action_controls for select using (public.has_portal_access());
drop policy if exists project_primary_action_selections_staff_select on public.project_primary_action_selections;
create policy project_primary_action_selections_staff_select on public.project_primary_action_selections for select using (public.has_portal_access());
drop policy if exists project_command_audit_staff_select on public.project_command_audit;
create policy project_command_audit_staff_select on public.project_command_audit for select using (public.has_portal_access());
drop policy if exists project_action_versions_staff_select on public.project_action_versions;
create policy project_action_versions_staff_select on public.project_action_versions for select using (public.has_portal_access());

create or replace function public.portal_staff_directory()
returns table (user_id uuid, display_name text, email text, access_role text)
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if not public.has_portal_access() then
    raise exception 'portal access required' using errcode = '42501';
  end if;
  return query
  select
    pu.user_id,
    coalesce(
      nullif(trim(au.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(au.raw_user_meta_data ->> 'name'), ''),
      nullif(trim(au.raw_user_meta_data ->> 'display_name'), ''),
      split_part(coalesce(au.email, 'Staff'), '@', 1)
    ),
    au.email::text,
    pu.role
  from public.portal_users pu
  join auth.users au on au.id = pu.user_id
  where au.deleted_at is null
    and (au.banned_until is null or au.banned_until <= now())
  order by 2, 3;
end;
$$;

create or replace function public.project_command_set_owner(
  p_project_id uuid,
  p_role text,
  p_owner_user_id uuid,
  p_command_id uuid,
  p_expected_updated_at timestamptz default null
)
returns table (owner_user_id uuid, updated_at timestamptz, replayed boolean)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  current_row public.project_role_assignments%rowtype;
  actor_role text;
  result_owner uuid;
  result_updated_at timestamptz;
begin
  if p_role not in ('sales','design','estimating') then
    raise exception 'invalid project role' using errcode = '22023';
  end if;
  if not public.has_portal_access() then
    raise exception 'portal access required' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_command_id::text, 0));
  if exists(select 1 from public.project_command_audit where command_id = p_command_id) then
    if not exists(
      select 1 from public.project_command_audit audit
      where audit.command_id=p_command_id
        and audit.project_id=p_project_id
        and audit.event_type='project_owner_changed'
        and audit.after_state ->> 'role'=p_role
        and nullif(audit.after_state ->> 'ownerUserId','')::uuid is not distinct from p_owner_user_id
    ) then
      raise exception 'command id was already used for a different command' using errcode = '22023';
    end if;
    select pra.owner_user_id, pra.updated_at into result_owner, result_updated_at
    from public.project_role_assignments pra where pra.project_id = p_project_id and pra.role = p_role;
    return query select result_owner, result_updated_at, true;
    return;
  end if;
  if not exists(select 1 from public.projects where id = p_project_id) then
    raise exception 'project not found' using errcode = 'P0002';
  end if;
  select role into actor_role from public.portal_users where user_id = auth.uid();
  select * into current_row from public.project_role_assignments
    where project_id = p_project_id and role = p_role for update;
  if found and p_expected_updated_at is distinct from current_row.updated_at then
    raise exception 'owner assignment changed' using errcode = '40001';
  end if;
  if not found and p_expected_updated_at is not null then
    raise exception 'owner assignment changed' using errcode = '40001';
  end if;
  if actor_role <> 'admin' then
    if (
      current_row.project_id is not null
      and exists(
        select 1 from public.portal_users current_pu
        join auth.users current_au on current_au.id=current_pu.user_id
        where current_pu.user_id=current_row.owner_user_id
          and current_au.deleted_at is null
          and (current_au.banned_until is null or current_au.banned_until <= now())
      )
    ) or p_owner_user_id is distinct from auth.uid() then
      raise exception 'owner change requires admin or empty-role self-assignment' using errcode = '42501';
    end if;
  end if;
  if p_owner_user_id is not null and not exists(
    select 1 from public.portal_users pu join auth.users au on au.id=pu.user_id
    where pu.user_id=p_owner_user_id and au.deleted_at is null
      and (au.banned_until is null or au.banned_until <= now())
  ) then
    raise exception 'owner is not an active portal user' using errcode = '22023';
  end if;

  if p_owner_user_id is null then
    delete from public.project_role_assignments where project_id = p_project_id and role = p_role;
    result_owner := null;
    result_updated_at := now();
  else
    insert into public.project_role_assignments(project_id, role, owner_user_id, assigned_by)
    values (p_project_id, p_role, p_owner_user_id, auth.uid())
    on conflict (project_id, role) do update set
      owner_user_id = excluded.owner_user_id,
      assigned_by = auth.uid(),
      assigned_at = now(),
      updated_at = now()
    returning project_role_assignments.owner_user_id, project_role_assignments.updated_at
      into result_owner, result_updated_at;
  end if;
  insert into public.project_command_audit(
    project_id, command_id, event_type, actor_user_id, reason, before_state, after_state
  ) values (
    p_project_id, p_command_id, 'project_owner_changed', auth.uid(), null,
    case when current_row.project_id is null then null else jsonb_build_object('role', p_role, 'ownerUserId', current_row.owner_user_id) end,
    jsonb_build_object('role', p_role, 'ownerUserId', p_owner_user_id)
  );
  return query select result_owner, result_updated_at, false;
end;
$$;

-- Match the small synchronous FNV-1a hash used by the TypeScript selector.
-- Ranking signatures contain only ASCII source keys, UUIDs, ISO timestamps,
-- and integer buckets, so PostgreSQL byte iteration and JavaScript UTF-16
-- iteration are equivalent for this bounded input.
create or replace function public.project_command_stable_hash(p_input text)
returns text
language plpgsql
immutable
strict
set search_path = public, pg_temp
as $$
declare
  hash_value bigint := 2166136261;
  input_index integer;
begin
  for input_index in 1..char_length(p_input) loop
    hash_value := hash_value # ascii(substr(p_input, input_index, 1));
    hash_value := mod(hash_value * 16777619, 4294967296);
  end loop;
  return 'cc_' || lpad(to_hex(hash_value), 8, '0');
end;
$$;

create or replace function public.project_command_outranking_hash(
  p_project_id uuid,
  p_source_kind text,
  p_source_id uuid,
  p_evaluated_at timestamptz default now()
)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with candidates as (
    select
      'automation_task'::text as source_kind,
      task.id as source_id,
      task.due_at,
      task.created_at,
      0 as source_rank,
      case
        when task.due_at < p_evaluated_at then case when task.type in (
          'REVIEW_NEW_LEAD','BOOK_SITE_VISIT','ATTEND_SITE_VISIT','FINALIZE_SEND_QUOTE',
          'FOLLOWUP_CALL','FOLLOWUP_EMAIL','SCHEDULE_INSTALL_WINDOW','CONFIRM_FINAL_SCHEDULE','RESEND_EMAIL'
        ) then 0 else 1 end
        when (task.due_at at time zone 'Pacific/Auckland')::date = (p_evaluated_at at time zone 'Pacific/Auckland')::date then 2
        else 3
      end as due_bucket
    from public.tasks task
    where task.project_id=p_project_id and task.status='OPEN' and task.due_at is not null
    union all
    select
      'quote_followup',followup.id,followup.due_at,followup.created_at,0,
      case
        when followup.due_at < p_evaluated_at then 0
        when (followup.due_at at time zone 'Pacific/Auckland')::date = (p_evaluated_at at time zone 'Pacific/Auckland')::date then 2
        else 3
      end
    from public.followup_tasks followup
    where followup.project_id=p_project_id and followup.status='OPEN' and followup.due_at is not null
    union all
    select
      'manual',manual.id,manual.due_at,manual.created_at,1,
      case
        when manual.due_at < p_evaluated_at then case when manual.category in ('Call','Site visit','Quote','Follow-up') then 0 else 1 end
        when (manual.due_at at time zone 'Pacific/Auckland')::date = (p_evaluated_at at time zone 'Pacific/Auckland')::date then 2
        else 3
      end
    from public.project_manual_actions manual
    where manual.project_id=p_project_id and manual.status='OPEN' and manual.due_at is not null
  ), selected as (
    select * from candidates
    where source_kind=p_source_kind and source_id=p_source_id
  ), outranking as (
    select candidate.*
    from candidates candidate
    cross join selected
    where (
      candidate.source_rank,
      candidate.due_bucket,
      candidate.due_at,
      candidate.created_at,
      candidate.source_kind,
      candidate.source_id
    ) < (
      selected.source_rank,
      selected.due_bucket,
      selected.due_at,
      selected.created_at,
      selected.source_kind,
      selected.source_id
    )
    order by candidate.source_rank,candidate.due_bucket,candidate.due_at,candidate.created_at,candidate.source_kind,candidate.source_id
  ), signature as (
    select coalesce(jsonb_agg(jsonb_build_array(
      source_kind,
      source_id::text,
      to_char(due_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      to_char(created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      due_bucket
    ) order by source_rank,due_bucket,due_at,created_at,source_kind,source_id), '[]'::jsonb)::text as value
    from outranking
  )
  select public.project_command_stable_hash(replace(signature.value, ' ', '')) from signature;
$$;

-- Design-package commands remain the owner of CREATE_DESIGN_PACKAGE source
-- tasks. This narrow RPC replaces their former authenticated table writes so
-- source records stay canonical without reopening direct browser mutation.
create or replace function public.project_command_sync_design_task(
  p_project_id uuid,
  p_operation text,
  p_idempotency_key text,
  p_title text,
  p_details text,
  p_due_at timestamptz,
  p_status text,
  p_meta jsonb
)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if not public.has_portal_access() then
    raise exception 'portal access required' using errcode = '42501';
  end if;
  if not exists(select 1 from public.projects where id=p_project_id) then
    raise exception 'project not found' using errcode = 'P0002';
  end if;
  if p_idempotency_key not like 'design\_request:' || p_project_id::text || ':v%' escape '\' then
    raise exception 'invalid design task key' using errcode = '22023';
  end if;
  if p_operation='upsert' then
    if nullif(trim(p_title),'') is null then
      raise exception 'design task title is required' using errcode = '22023';
    end if;
    insert into public.tasks(project_id,type,status,title,details,due_at,meta,idempotency_key)
    values(p_project_id,'CREATE_DESIGN_PACKAGE','OPEN',trim(p_title),p_details,p_due_at,coalesce(p_meta,'{}'::jsonb),p_idempotency_key)
    on conflict(idempotency_key) do update set
      status='OPEN',title=excluded.title,details=excluded.details,due_at=excluded.due_at,
      meta=excluded.meta,completed_at=null,updated_at=now();
  elsif p_operation='set_status' then
    if p_status not in ('OPEN','DONE','SKIPPED') then
      raise exception 'invalid design task status' using errcode = '22023';
    end if;
    update public.tasks set
      status=p_status,
      completed_at=case when p_status in ('DONE','SKIPPED') then now() else null end,
      updated_at=now()
    where project_id=p_project_id and type='CREATE_DESIGN_PACKAGE' and idempotency_key=p_idempotency_key;
  elsif p_operation='set_due' then
    update public.tasks set due_at=p_due_at,updated_at=now()
    where project_id=p_project_id and type='CREATE_DESIGN_PACKAGE' and idempotency_key=p_idempotency_key;
  else
    raise exception 'invalid design task operation' using errcode = '22023';
  end if;
end;
$$;

create or replace function public.project_command_sync_projection(
  p_project_id uuid,
  p_title text,
  p_category text,
  p_due_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  update public.projects set
    next_action=p_title,
    next_action_type=p_category,
    next_action_at=p_due_at,
    next_action_date=(p_due_at at time zone 'Pacific/Auckland')::date,
    follow_up_date=(p_due_at at time zone 'Pacific/Auckland')::date
  where id=p_project_id;
end;
$$;

create or replace function public.project_command_refresh_projection(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  projection_title text;
  projection_category text;
  projection_due_at timestamptz;
begin
  with candidates as (
    select
      'automation_task'::text as source_kind,
      task.id as source_id,
      task.title,
      case
        when task.type like '%CALL%' then 'Call'
        when task.type like '%SITE_VISIT%' then 'Site visit'
        when task.type like '%DESIGN%' then 'Design'
        when task.type like '%QUOTE%' then 'Quote'
        when task.type like '%EMAIL%' or task.type like '%FOLLOWUP%' then 'Follow-up'
        else 'Other'
      end as category,
      task.due_at,
      task.created_at,
      0 as source_rank,
      case
        when task.due_at < now() then case when task.type in (
          'REVIEW_NEW_LEAD','BOOK_SITE_VISIT','ATTEND_SITE_VISIT','FINALIZE_SEND_QUOTE',
          'FOLLOWUP_CALL','FOLLOWUP_EMAIL','SCHEDULE_INSTALL_WINDOW','CONFIRM_FINAL_SCHEDULE','RESEND_EMAIL'
        ) then 0 else 1 end
        when (task.due_at at time zone 'Pacific/Auckland')::date = (now() at time zone 'Pacific/Auckland')::date then 2
        else 3
      end as due_bucket
    from public.tasks task
    where task.project_id=p_project_id and task.status='OPEN' and task.due_at is not null
    union all
    select
      'quote_followup',followup.id,
      case when followup.type='FOLLOWUP_EMAIL' then 'Email quote follow-up' else 'Call for quote follow-up' end,
      case when followup.type='FOLLOWUP_EMAIL' then 'Follow-up' else 'Call' end,
      followup.due_at,followup.created_at,0,
      case
        when followup.due_at < now() then 0
        when (followup.due_at at time zone 'Pacific/Auckland')::date = (now() at time zone 'Pacific/Auckland')::date then 2
        else 3
      end
    from public.followup_tasks followup
    where followup.project_id=p_project_id and followup.status='OPEN' and followup.due_at is not null
    union all
    select
      'manual',manual.id,manual.title,manual.category,manual.due_at,manual.created_at,1,
      case
        when manual.due_at < now() then case when manual.category in ('Call','Site visit','Quote','Follow-up') then 0 else 1 end
        when (manual.due_at at time zone 'Pacific/Auckland')::date = (now() at time zone 'Pacific/Auckland')::date then 2
        else 3
      end
    from public.project_manual_actions manual
    where manual.project_id=p_project_id and manual.status='OPEN' and manual.due_at is not null
  ), selected as (
    select selection.source_kind,selection.source_id
    from public.project_primary_action_selections selection
    join candidates candidate on candidate.source_kind=selection.source_kind and candidate.source_id=selection.source_id
    where selection.project_id=p_project_id
  )
  select candidate.title,candidate.category,candidate.due_at
  into projection_title,projection_category,projection_due_at
  from candidates candidate
  order by
    case when exists(select 1 from selected) then
      case when exists(select 1 from selected where source_kind=candidate.source_kind and source_id=candidate.source_id) then 0 else 1 end
    else 0 end,
    candidate.source_rank,candidate.due_bucket,candidate.due_at,candidate.created_at,candidate.source_kind,candidate.source_id
  limit 1;
  perform public.project_command_sync_projection(p_project_id,projection_title,projection_category,projection_due_at);
end;
$$;

create or replace function public.refresh_project_action_projection()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_project_id uuid;
begin
  target_project_id := case when tg_op='DELETE' then old.project_id else new.project_id end;
  perform public.project_command_refresh_projection(target_project_id);
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists tasks_refresh_project_action_projection on public.tasks;
create trigger tasks_refresh_project_action_projection after insert or update or delete on public.tasks
for each row execute function public.refresh_project_action_projection();
drop trigger if exists followup_tasks_refresh_project_action_projection on public.followup_tasks;
create trigger followup_tasks_refresh_project_action_projection after insert or update or delete on public.followup_tasks
for each row execute function public.refresh_project_action_projection();
drop trigger if exists manual_actions_refresh_project_action_projection on public.project_manual_actions;
create trigger manual_actions_refresh_project_action_projection after insert or update or delete on public.project_manual_actions
for each row execute function public.refresh_project_action_projection();

create or replace function public.project_command_action(
  p_project_id uuid,
  p_command_id uuid,
  p_command text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_source_kind text := nullif(trim(p_payload ->> 'sourceKind'), '');
  v_source_id uuid;
  actor_role text;
  due_at_value timestamptz;
  owner_id_value uuid;
  reason_value text := nullif(trim(p_payload ->> 'reason'), '');
  title_value text := nullif(trim(p_payload ->> 'title'), '');
  category_value text := nullif(trim(p_payload ->> 'category'), '');
  confirmed_hash text := coalesce(nullif(trim(p_payload ->> 'confirmedOutrankingHash'), ''), 'cc_741638a5');
  candidate_revision text := coalesce(nullif(trim(p_payload ->> 'candidateRevision'), ''), 'unknown');
  current_candidate_revision text;
  next_count integer;
  current_updated_at timestamptz;
  result_id uuid;
  primary_source_kind text;
  primary_source_id uuid;
  selection_confirmed_hash text;
  current_outranking_hash text;
  has_selection_conflict boolean := false;
begin
  if not public.has_portal_access() then
    raise exception 'portal access required' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_command_id::text, 0));
  if exists(select 1 from public.project_command_audit where command_id = p_command_id) then
    if not exists(
      select 1 from public.project_command_audit audit
      where audit.command_id=p_command_id
        and audit.project_id=p_project_id
        and audit.event_type='primary_action_' || p_command
        and audit.after_state -> 'intent'=(p_payload - ARRAY['expectedUpdatedAt','candidateRevision','confirmedOutrankingHash'])
    ) then
      raise exception 'command id was already used for a different command' using errcode = '22023';
    end if;
    return jsonb_build_object('committed', true, 'replayed', true);
  end if;
  if not exists(select 1 from public.projects where id = p_project_id) then
    raise exception 'project not found' using errcode = 'P0002';
  end if;
  insert into public.project_action_versions(project_id) values(p_project_id)
  on conflict(project_id) do nothing;
  select 'v' || versions.version::text into current_candidate_revision
  from public.project_action_versions versions
  where versions.project_id=p_project_id
  for share;
  if candidate_revision is distinct from current_candidate_revision then
    raise exception 'available project actions changed' using errcode = '40001';
  end if;
  select role into actor_role from public.portal_users where user_id = auth.uid();
  select selection.source_kind,selection.source_id,selection.confirmed_outranking_hash
  into primary_source_kind,primary_source_id,selection_confirmed_hash
  from public.project_primary_action_selections selection
  where selection.project_id=p_project_id;
  if primary_source_id is not null then
    current_outranking_hash := public.project_command_outranking_hash(
      p_project_id,primary_source_kind,primary_source_id,now()
    );
    has_selection_conflict := current_outranking_hash <> 'cc_741638a5'
      and current_outranking_hash is distinct from selection_confirmed_hash;
  end if;
  if has_selection_conflict
     and p_command <> 'complete'
     and not (actor_role='admin' and p_command='resolve_conflict') then
    raise exception 'the primary-action conflict must be resolved first' using errcode = '40001';
  end if;

  if p_command = 'create_manual' then
    if title_value is null or char_length(title_value) > 160 then
      raise exception 'manual action title is required and must be 160 characters or fewer' using errcode = '22023';
    end if;
    if category_value not in ('Call','Site visit','Design','Estimate','Quote','Follow-up','Other') then
      raise exception 'invalid manual action category' using errcode = '22023';
    end if;
    due_at_value := (p_payload ->> 'dueAt')::timestamptz;
    if due_at_value is null then
      raise exception 'manual action due date is required' using errcode = '22023';
    end if;
    owner_id_value := nullif(p_payload ->> 'ownerUserId', '')::uuid;
    if owner_id_value is not null and not exists(
      select 1 from public.portal_users pu join auth.users au on au.id=pu.user_id
      where pu.user_id=owner_id_value and au.deleted_at is null
        and (au.banned_until is null or au.banned_until <= now())
    ) then
      raise exception 'action owner is not an active portal user' using errcode = '22023';
    end if;
    insert into public.project_manual_actions(project_id,title,category,owner_user_id,due_at,created_by)
    values(p_project_id,title_value,category_value,owner_id_value,due_at_value,auth.uid()) returning id into result_id;
    confirmed_hash := public.project_command_outranking_hash(p_project_id,'manual',result_id,now());
    insert into public.project_primary_action_selections(
      project_id,source_kind,source_id,selected_by,confirmed_outranking_hash,candidate_revision
    ) values(p_project_id,'manual',result_id,auth.uid(),confirmed_hash,candidate_revision)
    on conflict(project_id) do update set
      source_kind='manual', source_id=result_id, selected_by=auth.uid(), selected_at=now(),
      confirmed_outranking_hash=excluded.confirmed_outranking_hash,
      candidate_revision=excluded.candidate_revision, updated_at=now();
    v_source_kind := 'manual';
  else
    v_source_id := nullif(p_payload ->> 'sourceId', '')::uuid;
    if v_source_kind not in ('automation_task','quote_followup','manual') or v_source_id is null then
      raise exception 'valid action source is required' using errcode = '22023';
    end if;
    if v_source_kind = 'automation_task' then
      select t.updated_at into current_updated_at from public.tasks t where t.id=v_source_id and t.project_id=p_project_id and t.status='OPEN' for update;
    elsif v_source_kind = 'quote_followup' then
      select ft.updated_at into current_updated_at from public.followup_tasks ft where ft.id=v_source_id and ft.project_id=p_project_id and ft.status='OPEN' for update;
    else
      select pma.updated_at into current_updated_at from public.project_manual_actions pma where pma.id=v_source_id and pma.project_id=p_project_id and pma.status='OPEN' for update;
    end if;
    if current_updated_at is null then raise exception 'open action not found' using errcode = 'P0002'; end if;
    if nullif(p_payload ->> 'expectedUpdatedAt','') is not null
       and (p_payload ->> 'expectedUpdatedAt')::timestamptz is distinct from current_updated_at then
      raise exception 'action changed' using errcode = '40001';
    end if;

    if p_command in ('complete','reschedule','reassign','set_critical') then
      select selection.source_kind,selection.source_id
      into primary_source_kind,primary_source_id
      from public.project_primary_action_selections selection
      where selection.project_id=p_project_id
        and (
          (selection.source_kind='automation_task' and exists(
            select 1 from public.tasks selected_task
            where selected_task.id=selection.source_id and selected_task.project_id=p_project_id and selected_task.status='OPEN'
          ))
          or (selection.source_kind='quote_followup' and exists(
            select 1 from public.followup_tasks selected_followup
            where selected_followup.id=selection.source_id and selected_followup.project_id=p_project_id and selected_followup.status='OPEN'
          ))
          or (selection.source_kind='manual' and exists(
            select 1 from public.project_manual_actions selected_manual
            where selected_manual.id=selection.source_id and selected_manual.project_id=p_project_id and selected_manual.status='OPEN'
          ))
        );

      if primary_source_id is null then
        with candidates as (
          select
            'automation_task'::text as source_kind,
            task.id as source_id,
            task.due_at,
            task.created_at,
            0 as source_rank,
            task.type in (
              'REVIEW_NEW_LEAD','BOOK_SITE_VISIT','ATTEND_SITE_VISIT','FINALIZE_SEND_QUOTE',
              'FOLLOWUP_CALL','FOLLOWUP_EMAIL','SCHEDULE_INSTALL_WINDOW','CONFIRM_FINAL_SCHEDULE','RESEND_EMAIL'
            ) as customer_facing
          from public.tasks task
          where task.project_id=p_project_id and task.status='OPEN' and task.due_at is not null
          union all
          select
            'quote_followup',followup.id,followup.due_at,followup.created_at,0,true
          from public.followup_tasks followup
          where followup.project_id=p_project_id and followup.status='OPEN' and followup.due_at is not null
          union all
          select
            'manual',manual.id,manual.due_at,manual.created_at,1,
            manual.category in ('Call','Site visit','Quote','Follow-up')
          from public.project_manual_actions manual
          where manual.project_id=p_project_id and manual.status='OPEN' and manual.due_at is not null
        )
        select candidate.source_kind,candidate.source_id
        into primary_source_kind,primary_source_id
        from candidates candidate
        order by
          candidate.source_rank,
          case
            when candidate.due_at < now()
              and (candidate.due_at at time zone 'Pacific/Auckland')::date <= (now() at time zone 'Pacific/Auckland')::date
              then case when candidate.customer_facing then 0 else 1 end
            when (candidate.due_at at time zone 'Pacific/Auckland')::date = (now() at time zone 'Pacific/Auckland')::date then 2
            else 3
          end,
          candidate.due_at,
          candidate.created_at,
          candidate.source_kind,
          candidate.source_id
        limit 1;
      end if;

      if primary_source_kind is distinct from v_source_kind or primary_source_id is distinct from v_source_id then
        raise exception 'command must target the current primary action' using errcode = '40001';
      end if;
    end if;

    if p_command = 'select' then
      if nullif(p_payload ->> 'dueAt','') is not null then
        due_at_value := (p_payload ->> 'dueAt')::timestamptz;
        if v_source_kind='automation_task' then update public.tasks set due_at=due_at_value,updated_at=now() where id=v_source_id;
        elsif v_source_kind='quote_followup' then update public.followup_tasks set due_at=due_at_value,updated_at=now() where id=v_source_id;
        else update public.project_manual_actions set due_at=due_at_value,updated_at=now() where id=v_source_id; end if;
      end if;
      confirmed_hash := public.project_command_outranking_hash(p_project_id,v_source_kind,v_source_id,now());
      insert into public.project_primary_action_selections(
        project_id,source_kind,source_id,selected_by,confirmed_outranking_hash,candidate_revision
      ) values(p_project_id,v_source_kind,v_source_id,auth.uid(),confirmed_hash,candidate_revision)
      on conflict(project_id) do update set
        source_kind=excluded.source_kind, source_id=excluded.source_id, selected_by=auth.uid(), selected_at=now(),
        confirmed_outranking_hash=excluded.confirmed_outranking_hash,
        candidate_revision=excluded.candidate_revision, updated_at=now();
    elsif p_command = 'complete' then
      if v_source_kind='automation_task' then
        update public.tasks set status='DONE', completed_at=now(), updated_at=now() where id=v_source_id;
      elsif v_source_kind='quote_followup' then
        update public.followup_tasks set status='DONE', outcome_note=nullif(p_payload ->> 'outcome',''), completed_at=now(), updated_at=now() where id=v_source_id;
      else
        update public.project_manual_actions set status='DONE', outcome=nullif(p_payload ->> 'outcome',''), completed_by=auth.uid(), completed_at=now(), updated_at=now() where id=v_source_id;
      end if;
      delete from public.project_primary_action_selections pas
        where pas.project_id=p_project_id and pas.source_kind=v_source_kind and pas.source_id=v_source_id;
    elsif p_command = 'reschedule' then
      due_at_value := (p_payload ->> 'dueAt')::timestamptz;
      if due_at_value is null then raise exception 'action due date is required' using errcode = '22023'; end if;
      select coalesce(reschedule_count,0)+1 into next_count from public.project_action_controls
        where project_action_controls.source_kind=v_source_kind and project_action_controls.source_id=v_source_id for update;
      next_count := coalesce(next_count,1);
      if next_count >= 3 and reason_value is null then
        raise exception 'a reason is required for the third and later reschedules' using errcode = '22023';
      end if;
      if v_source_kind='automation_task' then update public.tasks set due_at=due_at_value,updated_at=now() where id=v_source_id;
      elsif v_source_kind='quote_followup' then update public.followup_tasks set due_at=due_at_value,updated_at=now() where id=v_source_id;
      else update public.project_manual_actions set due_at=due_at_value,updated_at=now() where id=v_source_id; end if;
      insert into public.project_action_controls(project_id,source_kind,source_id,updated_by,reschedule_count)
      values(p_project_id,v_source_kind,v_source_id,auth.uid(),next_count)
      on conflict(source_kind,source_id) do update set reschedule_count=next_count,updated_by=auth.uid(),updated_at=now();
    elsif p_command = 'reassign' then
      owner_id_value := nullif(p_payload ->> 'ownerUserId','')::uuid;
      if owner_id_value is not null and not exists(
        select 1 from public.portal_users pu join auth.users au on au.id=pu.user_id
        where pu.user_id=owner_id_value and au.deleted_at is null
          and (au.banned_until is null or au.banned_until <= now())
      ) then
        raise exception 'action owner is not an active portal user' using errcode = '22023';
      end if;
      if v_source_kind='automation_task' then update public.tasks set assigned_to=owner_id_value,updated_at=now() where id=v_source_id;
      elsif v_source_kind='quote_followup' then update public.followup_tasks set assigned_to=owner_id_value,updated_at=now() where id=v_source_id;
      else update public.project_manual_actions set owner_user_id=owner_id_value,updated_at=now() where id=v_source_id; end if;
    elsif p_command = 'set_critical' then
      if reason_value is null then raise exception 'a criticality reason is required' using errcode = '22023'; end if;
      insert into public.project_action_controls(project_id,source_kind,source_id,is_critical,critical_reason,updated_by)
      values(
        p_project_id,v_source_kind,v_source_id,coalesce((p_payload ->> 'critical')::boolean,false),
        case when coalesce((p_payload ->> 'critical')::boolean,false) then reason_value else null end,
        auth.uid()
      )
      on conflict(source_kind,source_id) do update set
        is_critical=excluded.is_critical, critical_reason=excluded.critical_reason, updated_by=auth.uid(), updated_at=now();
    elsif p_command = 'resolve_conflict' then
      if actor_role <> 'admin' then raise exception 'admin access required' using errcode = '42501'; end if;
      if not has_selection_conflict then raise exception 'no resolvable action conflict exists' using errcode = '40001'; end if;
      if coalesce(p_payload ->> 'resolution','') = 'keep_current' then
        confirmed_hash := public.project_command_outranking_hash(p_project_id,v_source_kind,v_source_id,now());
        update public.project_primary_action_selections set
          confirmed_outranking_hash=confirmed_hash,candidate_revision=candidate_revision,updated_at=now()
        where project_id=p_project_id;
      elsif coalesce(p_payload ->> 'resolution','') = 'select_candidate' then
        confirmed_hash := public.project_command_outranking_hash(p_project_id,v_source_kind,v_source_id,now());
        update public.project_primary_action_selections set
          source_kind=v_source_kind,source_id=v_source_id,selected_by=auth.uid(),selected_at=now(),
          confirmed_outranking_hash=confirmed_hash,candidate_revision=candidate_revision,updated_at=now()
        where project_id=p_project_id;
      else raise exception 'invalid conflict resolution' using errcode='22023'; end if;
    else
      raise exception 'invalid action command' using errcode = '22023';
    end if;
    result_id := v_source_id;
  end if;

  insert into public.project_command_audit(
    project_id,command_id,event_type,source_kind,source_id,actor_user_id,reason,after_state
  ) values(
    p_project_id,p_command_id,'primary_action_' || p_command,v_source_kind,result_id,auth.uid(),reason_value,
    jsonb_build_object('intent', p_payload - ARRAY['expectedUpdatedAt','candidateRevision','confirmedOutrankingHash'])
  );

  -- Keep Schedule compatibility fields transactionally aligned with the
  -- canonical selection. Source-table triggers call the same owner when
  -- automation or design-package commands change candidates directly.
  perform public.project_command_refresh_projection(p_project_id);
  return jsonb_build_object('committed',true,'replayed',false,'sourceKind',v_source_kind,'sourceId',result_id);
end;
$$;

revoke all on function public.portal_staff_directory() from public, anon;
revoke all on function public.project_command_set_owner(uuid,text,uuid,uuid,timestamptz) from public, anon;
revoke all on function public.project_command_action(uuid,uuid,text,jsonb) from public, anon;
revoke all on function public.bump_project_action_version() from public, anon, authenticated;
revoke all on function public.project_command_stable_hash(text) from public, anon, authenticated;
revoke all on function public.project_command_outranking_hash(uuid,text,uuid,timestamptz) from public, anon, authenticated;
revoke all on function public.project_command_sync_design_task(uuid,text,text,text,text,timestamptz,text,jsonb) from public, anon;
revoke all on function public.project_command_sync_projection(uuid,text,text,timestamptz) from public, anon, authenticated, service_role;
revoke all on function public.project_command_refresh_projection(uuid) from public, anon, authenticated, service_role;
revoke all on function public.refresh_project_action_projection() from public, anon, authenticated, service_role;
grant execute on function public.portal_staff_directory() to authenticated;
grant execute on function public.project_command_set_owner(uuid,text,uuid,uuid,timestamptz) to authenticated;
grant execute on function public.project_command_action(uuid,uuid,text,jsonb) to authenticated;
grant execute on function public.project_command_sync_design_task(uuid,text,text,text,text,timestamptz,text,jsonb) to authenticated;

-- Validated owner backfill. Creator/author/sender fields are intentionally excluded.
do $$
begin
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='projects' and column_name='sales_owner_id') then
    execute $sql$
      insert into public.project_role_assignments(project_id,role,owner_user_id,assigned_by)
      select p.id,'sales',pu.user_id,pu.user_id
      from public.projects p
      join public.portal_users pu on pu.user_id::text=p.sales_owner_id::text
      join auth.users au on au.id=pu.user_id
      where p.sales_owner_id is not null and au.deleted_at is null
        and (au.banned_until is null or au.banned_until <= now())
      on conflict(project_id,role) do nothing
    $sql$;
  end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='projects' and column_name='designer_owner_id') then
    execute $sql$
      insert into public.project_role_assignments(project_id,role,owner_user_id,assigned_by)
      select p.id,'design',pu.user_id,pu.user_id
      from public.projects p
      join public.portal_users pu on pu.user_id::text=p.designer_owner_id::text
      join auth.users au on au.id=pu.user_id
      where p.designer_owner_id is not null and au.deleted_at is null
        and (au.banned_until is null or au.banned_until <= now())
      on conflict(project_id,role) do nothing
    $sql$;
  end if;
end;
$$;

with eligible_design_projects as (
  select dpr.project_id, min(dpr.assigned_designer::text)::uuid as assigned_designer
  from public.design_package_requests dpr
  join public.portal_users pu on pu.user_id=dpr.assigned_designer
  join auth.users au on au.id=pu.user_id
  where dpr.status in ('OPEN','IN_PROGRESS','BLOCKED')
    and au.deleted_at is null
    and (au.banned_until is null or au.banned_until <= now())
  group by dpr.project_id
  having count(distinct dpr.assigned_designer)=1
), latest_design as (
  select distinct on (dpr.project_id) dpr.project_id,dpr.assigned_designer
  from public.design_package_requests dpr
  join eligible_design_projects eligible
    on eligible.project_id=dpr.project_id and eligible.assigned_designer=dpr.assigned_designer
  where dpr.status in ('OPEN','IN_PROGRESS','BLOCKED')
  order by dpr.project_id,dpr.requested_at desc,dpr.id desc
)
insert into public.project_role_assignments(project_id,role,owner_user_id,assigned_by)
select latest.project_id,'design',latest.assigned_designer,latest.assigned_designer
from latest_design latest
where not exists(select 1 from public.project_role_assignments pra where pra.project_id=latest.project_id and pra.role='design')
on conflict(project_id,role) do nothing;

-- Import only legacy rows with a due date. A missing label receives the approved default.
insert into public.project_manual_actions(
  project_id,title,category,due_at,status,origin,origin_key,created_by
)
select
  p.id,
  coalesce(nullif(trim(coalesce(p.next_action,'')),''),nullif(trim(coalesce(p.next_action_type,'')),''),'Follow up with customer'),
  case upper(coalesce(p.next_action_type,''))
    when 'CALL' then 'Call' when 'SITE_VISIT' then 'Site visit' when 'DESIGN' then 'Design'
    when 'ESTIMATE' then 'Estimate' when 'QUOTE' then 'Quote' when 'FOLLOW_UP' then 'Follow-up'
    else 'Other' end,
  coalesce(p.next_action_at, (coalesce(p.next_action_date,p.follow_up_date)::date + time '17:00') at time zone 'Pacific/Auckland'),
  'OPEN','legacy_backfill','project-next-action:' || p.id::text,
  sales.owner_user_id
from public.projects p
left join public.project_role_assignments sales on sales.project_id=p.id and sales.role='sales'
where coalesce(p.next_action_at, (coalesce(p.next_action_date,p.follow_up_date)::date + time '17:00') at time zone 'Pacific/Auckland') is not null
on conflict(origin_key) do nothing;

select pg_notify('pgrst', 'reload schema');
