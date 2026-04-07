create table if not exists public.project_task_checks (
  project_id uuid not null references public.projects(id) on delete cascade,
  task_key text not null,
  completed_at timestamptz not null default now(),
  completed_by uuid null,
  primary key (project_id, task_key)
);

create index if not exists idx_project_task_checks_task_key on public.project_task_checks(task_key);

grant select, insert, update, delete on table public.project_task_checks to authenticated;

alter table public.project_task_checks enable row level security;

drop policy if exists portal_access_all on public.project_task_checks;
create policy portal_access_all on public.project_task_checks
  for all
  using (public.has_portal_access())
  with check (public.has_portal_access());

select pg_notify('pgrst', 'reload schema');
