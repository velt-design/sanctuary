-- Portal users + RLS for Supabase Auth

create table if not exists public.portal_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'staff' check (role in ('admin','staff')),
  created_at timestamptz not null default now()
);

grant select on public.portal_users to authenticated;

alter table public.portal_users enable row level security;

drop policy if exists portal_users_select_own on public.portal_users;
create policy portal_users_select_own on public.portal_users
  for select
  using (user_id = auth.uid());

create or replace function public.has_portal_access()
returns boolean
language sql
stable
as $$
  select exists(
    select 1
    from public.portal_users
    where user_id = auth.uid()
  );
$$;

create or replace function public.is_portal_admin()
returns boolean
language sql
stable
as $$
  select exists(
    select 1
    from public.portal_users
    where user_id = auth.uid()
      and role = 'admin'
  );
$$;

-- Core portal tables: allow any authenticated portal user
do $$
declare
  tbl text;
begin
  foreach tbl in array ARRAY[
    'audit_events',
    'contacts',
    'design_package_tickets',
    'email_outbox',
    'email_templates',
    'estimates',
    'file_artifacts',
    'followup_plans',
    'followup_tasks',
    'install_action_minutes_overrides',
    'material_cost_overrides',
    'project_task_checks',
    'projects',
    'quote_line_items',
    'quote_send_logs',
    'quote_versions',
    'quotes',
    'schedule_crews',
    'schedule_events',
    'schedule_items',
    'site_visit_events',
    'tasks'
  ] loop
    if to_regclass('public.' || tbl) is not null then
      execute format('alter table public.%I enable row level security', tbl);
      execute format('drop policy if exists portal_access_all on public.%I', tbl);
      execute format(
        'create policy portal_access_all on public.%I for all using (public.has_portal_access()) with check (public.has_portal_access())',
        tbl
      );
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
