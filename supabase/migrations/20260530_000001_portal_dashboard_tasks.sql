create table if not exists public.portal_dashboard_tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) > 0 and char_length(title) <= 240),
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null,
  sort_order bigint not null default 0
);

create index if not exists portal_dashboard_tasks_owner_visible_idx
  on public.portal_dashboard_tasks(owner_id, deleted_at, completed_at, sort_order, created_at);

grant select, insert, update, delete on table public.portal_dashboard_tasks to authenticated;

alter table public.portal_dashboard_tasks enable row level security;

drop policy if exists portal_dashboard_tasks_owner_select on public.portal_dashboard_tasks;
create policy portal_dashboard_tasks_owner_select
  on public.portal_dashboard_tasks
  for select
  using (owner_id = auth.uid() and public.has_portal_access());

drop policy if exists portal_dashboard_tasks_owner_insert on public.portal_dashboard_tasks;
create policy portal_dashboard_tasks_owner_insert
  on public.portal_dashboard_tasks
  for insert
  with check (owner_id = auth.uid() and public.has_portal_access());

drop policy if exists portal_dashboard_tasks_owner_update on public.portal_dashboard_tasks;
create policy portal_dashboard_tasks_owner_update
  on public.portal_dashboard_tasks
  for update
  using (owner_id = auth.uid() and public.has_portal_access())
  with check (owner_id = auth.uid() and public.has_portal_access());

drop policy if exists portal_dashboard_tasks_owner_delete on public.portal_dashboard_tasks;
create policy portal_dashboard_tasks_owner_delete
  on public.portal_dashboard_tasks
  for delete
  using (owner_id = auth.uid() and public.has_portal_access());
