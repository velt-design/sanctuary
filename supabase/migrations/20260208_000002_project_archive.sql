alter table public.projects
  add column if not exists archived_at timestamptz;

create index if not exists projects_archived_at_idx on public.projects(archived_at);
