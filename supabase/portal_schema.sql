create extension if not exists "pgcrypto";

-- Updated-at helper
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- CONTACTS (already working, keep compatible)
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.contacts
  add column if not exists updated_at timestamptz not null default now();
drop trigger if exists contacts_set_updated_at on public.contacts;
create trigger contacts_set_updated_at before update on public.contacts
for each row execute function public.set_updated_at();

-- PROJECTS (already working, keep compatible)
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts(id) on delete set null,
  name text not null,
  quote_ref text,
  region text,
  site_address text,
  pipeline_stage text not null default 'New',
  follow_up_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.projects
  add column if not exists updated_at timestamptz not null default now();
drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at before update on public.projects
for each row execute function public.set_updated_at();

-- ESTIMATES / COST PLANS (calculator persistence)
create table if not exists public.estimates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,

  -- statuses used by UI: draft/approved/archived
  status text not null default 'draft'
    check (status in ('draft','approved','archived')),

  -- summary fields for lists + schedule
  summary text,
  crew_hours numeric,
  duration_days numeric, -- optional cached; can be derived from crew_hours/9

  materials_ex_gst numeric,
  install_payout_ex_gst numeric,
  overhead_ex_gst numeric,
  total_true_cost_ex_gst numeric,
  total_true_cost_inc_gst numeric,

  -- full snapshots (do not model every field yet)
  inputs jsonb not null default '{}'::jsonb,
  outputs jsonb not null default '{}'::jsonb,
  warnings jsonb not null default '[]'::jsonb,

  -- config traceability (optional but recommended)
  costing_manifest text,
  costing_rules text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.estimates
  add column if not exists updated_at timestamptz not null default now();
drop trigger if exists estimates_set_updated_at on public.estimates;
create trigger estimates_set_updated_at before update on public.estimates
for each row execute function public.set_updated_at();

create index if not exists estimates_by_project on public.estimates(project_id);
create index if not exists estimates_by_status on public.estimates(status);

-- SCHEDULE CREWS
create table if not exists public.schedule_crews (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.schedule_crews
  add column if not exists updated_at timestamptz not null default now();
drop trigger if exists schedule_crews_set_updated_at on public.schedule_crews;
create trigger schedule_crews_set_updated_at before update on public.schedule_crews
for each row execute function public.set_updated_at();

-- SCHEDULE ITEMS (one scheduled item per project is simplest for now)
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
alter table public.schedule_items
  add column if not exists updated_at timestamptz not null default now();
drop trigger if exists schedule_items_set_updated_at on public.schedule_items;
create trigger schedule_items_set_updated_at before update on public.schedule_items
for each row execute function public.set_updated_at();

create unique index if not exists schedule_unique_project on public.schedule_items(project_id);
create index if not exists schedule_items_by_crew_start on public.schedule_items(crew_id, start_date);

-- DEV GRANTS (keep dev simple; tighten later)
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;

-- Force schema reload
select pg_notify('pgrst', 'reload schema');
