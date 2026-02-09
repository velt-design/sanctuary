create table if not exists public.project_task_checks (
  project_id uuid not null references public.projects(id) on delete cascade,
  task_key text not null,
  completed_at timestamptz not null default now(),
  completed_by uuid null,
  primary key (project_id, task_key)
);

create index if not exists idx_project_task_checks_task_key on public.project_task_checks(task_key);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.project_task_checks to anon, authenticated;

-- Recommended for production: enable RLS and use `SUPABASE_SERVICE_ROLE_KEY` in server-side API routes.
-- alter table public.project_task_checks enable row level security;

select pg_notify('pgrst', 'reload schema');
