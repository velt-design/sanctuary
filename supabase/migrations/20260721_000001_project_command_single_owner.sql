begin;

-- One business owner carries the project from lead through deposit. Owner
-- identities are deliberately stable business keys rather than auth users so
-- the operating roster does not depend on portal-account provisioning.
create table if not exists public.project_owner_assignments (
  project_id uuid primary key references public.projects(id) on delete cascade,
  owner_key text not null check (owner_key in ('jordan','jp','joe','bruce')),
  assigned_by uuid null references public.portal_users(user_id) on delete set null,
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Preserve a qualifying legacy role assignment. Sales is preferred because it
-- was the lead-stage owner, followed by Design and Estimating. Unknown staff
-- identities remain unassigned rather than being guessed.
with legacy_candidates as (
  select
    assignment.project_id,
    assignment.assigned_by,
    assignment.assigned_at,
    assignment.updated_at,
    case
      when lower(coalesce(
        nullif(trim(auth_user.raw_user_meta_data ->> 'full_name'), ''),
        nullif(trim(auth_user.raw_user_meta_data ->> 'name'), ''),
        nullif(trim(auth_user.raw_user_meta_data ->> 'display_name'), ''),
        split_part(coalesce(auth_user.email, ''), '@', 1)
      )) ~ '^jordan([._ -]|$)' then 'jordan'
      when lower(coalesce(
        nullif(trim(auth_user.raw_user_meta_data ->> 'full_name'), ''),
        nullif(trim(auth_user.raw_user_meta_data ->> 'name'), ''),
        nullif(trim(auth_user.raw_user_meta_data ->> 'display_name'), ''),
        split_part(coalesce(auth_user.email, ''), '@', 1)
      )) ~ '^jp([._ -]|$)' then 'jp'
      when lower(coalesce(
        nullif(trim(auth_user.raw_user_meta_data ->> 'full_name'), ''),
        nullif(trim(auth_user.raw_user_meta_data ->> 'name'), ''),
        nullif(trim(auth_user.raw_user_meta_data ->> 'display_name'), ''),
        split_part(coalesce(auth_user.email, ''), '@', 1)
      )) ~ '^joe([._ -]|$)' then 'joe'
      when lower(coalesce(
        nullif(trim(auth_user.raw_user_meta_data ->> 'full_name'), ''),
        nullif(trim(auth_user.raw_user_meta_data ->> 'name'), ''),
        nullif(trim(auth_user.raw_user_meta_data ->> 'display_name'), ''),
        split_part(coalesce(auth_user.email, ''), '@', 1)
      )) ~ '^bruce([._ -]|$)' then 'bruce'
      else null
    end as owner_key,
    row_number() over (
      partition by assignment.project_id
      order by case assignment.role when 'sales' then 0 when 'design' then 1 else 2 end,
        assignment.updated_at desc,
        assignment.owner_user_id
    ) as candidate_rank
  from public.project_role_assignments assignment
  join public.portal_users portal_user on portal_user.user_id = assignment.owner_user_id
  join auth.users auth_user on auth_user.id = portal_user.user_id
  where auth_user.deleted_at is null
    and (auth_user.banned_until is null or auth_user.banned_until <= now())
), selected as (
  select * from legacy_candidates where owner_key is not null
), ranked as (
  select selected.*,
    row_number() over (
      partition by selected.project_id
      order by selected.candidate_rank
    ) as owner_rank
  from selected
)
insert into public.project_owner_assignments(
  project_id, owner_key, assigned_by, assigned_at, updated_at
)
select project_id, owner_key, assigned_by, assigned_at, updated_at
from ranked
where owner_rank = 1
on conflict (project_id) do nothing;

alter table public.project_owner_assignments enable row level security;
drop policy if exists project_owner_assignments_staff_select on public.project_owner_assignments;
create policy project_owner_assignments_staff_select
  on public.project_owner_assignments for select
  using (public.has_portal_access());

revoke all on table public.project_owner_assignments from anon, authenticated;
grant select on table public.project_owner_assignments to authenticated;

-- Retire the three-role writer. The legacy table remains read-only as rollback
-- evidence, but all new reads and writes use project_owner_assignments.
drop function if exists public.project_command_set_owner(uuid,text,uuid,uuid,timestamptz);

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
  result_owner_key text;
  result_updated_at timestamptz;
begin
  if p_owner_key is not null and p_owner_key not in ('jordan','jp','joe','bruce') then
    raise exception 'invalid project owner' using errcode = '22023';
  end if;
  if not public.has_portal_access() then
    raise exception 'portal access required' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_command_id::text, 0));
  if exists(select 1 from public.project_command_audit where command_id = p_command_id) then
    if not exists(
      select 1 from public.project_command_audit audit
      where audit.command_id = p_command_id
        and audit.project_id = p_project_id
        and audit.event_type = 'project_owner_changed'
        and nullif(audit.after_state ->> 'ownerKey', '') is not distinct from p_owner_key
    ) then
      raise exception 'command id was already used for a different command' using errcode = '22023';
    end if;
    select assignment.owner_key, assignment.updated_at
      into result_owner_key, result_updated_at
    from public.project_owner_assignments assignment
    where assignment.project_id = p_project_id;
    return query select result_owner_key, result_updated_at, true;
    return;
  end if;

  if not exists(select 1 from public.projects where id = p_project_id) then
    raise exception 'project not found' using errcode = 'P0002';
  end if;
  select role into actor_role from public.portal_users where user_id = auth.uid();
  if actor_role <> 'admin' then
    raise exception 'project owner change requires admin' using errcode = '42501';
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
    delete from public.project_owner_assignments where project_id = p_project_id;
    result_owner_key := null;
    result_updated_at := now();
  else
    insert into public.project_owner_assignments(project_id, owner_key, assigned_by)
    values (p_project_id, p_owner_key, auth.uid())
    on conflict (project_id) do update set
      owner_key = excluded.owner_key,
      assigned_by = auth.uid(),
      assigned_at = now(),
      updated_at = now()
    returning project_owner_assignments.owner_key, project_owner_assignments.updated_at
      into result_owner_key, result_updated_at;
  end if;

  insert into public.project_command_audit(
    project_id, command_id, event_type, actor_user_id, reason, before_state, after_state
  ) values (
    p_project_id,
    p_command_id,
    'project_owner_changed',
    auth.uid(),
    null,
    case when current_row.project_id is null then null
      else jsonb_build_object('ownerKey', current_row.owner_key)
    end,
    jsonb_build_object('ownerKey', p_owner_key)
  );
  return query select result_owner_key, result_updated_at, false;
end;
$$;

revoke all on function public.project_command_set_owner(uuid,text,uuid,timestamptz) from public, anon;
grant execute on function public.project_command_set_owner(uuid,text,uuid,timestamptz) to authenticated;

commit;
