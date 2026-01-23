-- Schedule tables for the staff portal.
-- If this script fails due to missing public.projects or public.estimates, run supabase/portal_schema.sql first.

create extension if not exists "pgcrypto";

create table if not exists public.schedule_crews (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.schedule_items (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.schedule_crews(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  estimate_id uuid references public.estimates(id) on delete set null,

  start_date date not null,
  end_date date not null,
  duration_days numeric,
  sort_order int not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists schedule_items_by_crew_start
  on public.schedule_items(crew_id, start_date);

create unique index if not exists schedule_unique_project
  on public.schedule_items(project_id);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.schedule_crews to anon, authenticated;
grant select, insert, update, delete on table public.schedule_items to anon, authenticated;

select pg_notify('pgrst', 'reload schema');
