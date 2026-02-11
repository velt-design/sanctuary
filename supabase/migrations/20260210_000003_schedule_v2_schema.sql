create extension if not exists "pgcrypto";

-- Add calendar fields to schedule crews.
alter table public.schedule_crews
  add column if not exists calendar_region text not null default 'Auckland',
  add column if not exists base_available_date date null;

-- NZ public holidays (observed dates).
create table if not exists public.nz_holidays (
  date date primary key,
  name text not null,
  scope text not null check (scope in ('national','regional')),
  region text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists nz_holidays_set_updated_at on public.nz_holidays;
create trigger nz_holidays_set_updated_at before update on public.nz_holidays
for each row execute function public.set_updated_at();

-- Company closures (observed dates).
create table if not exists public.company_closures (
  date date primary key,
  name text not null,
  region text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists company_closures_set_updated_at on public.company_closures;
create trigger company_closures_set_updated_at before update on public.company_closures
for each row execute function public.set_updated_at();

-- Scheduled jobs (planned/forecast/actual).
create table if not exists public.scheduled_jobs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.projects(id) on delete cascade,
  crew_id uuid not null references public.schedule_crews(id) on delete cascade,
  mode text not null default 'floating' check (mode in ('floating','pinned')),

  planned_start date null,
  planned_duration_days int null,

  forecast_start date null,
  forecast_duration_days int not null check (forecast_duration_days > 0),
  forecast_end_exclusive date null,

  actual_start date null,
  actual_finish date null,
  status text null check (status in ('not_started','in_progress','paused','done')),

  days_remaining int null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists scheduled_jobs_set_updated_at on public.scheduled_jobs;
create trigger scheduled_jobs_set_updated_at before update on public.scheduled_jobs
for each row execute function public.set_updated_at();

create index if not exists scheduled_jobs_by_crew on public.scheduled_jobs(crew_id);
create index if not exists scheduled_jobs_by_status on public.scheduled_jobs(status);

-- Downtime blocks per crew.
create table if not exists public.crew_downtimes (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.schedule_crews(id) on delete cascade,
  duration_days int not null check (duration_days > 0),
  reason text not null check (reason in ('weather','materials','site','staff','travel','other')),
  note text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists crew_downtimes_set_updated_at on public.crew_downtimes;
create trigger crew_downtimes_set_updated_at before update on public.crew_downtimes
for each row execute function public.set_updated_at();

create index if not exists crew_downtimes_by_crew on public.crew_downtimes(crew_id);

-- Ordered schedule queue items per crew.
create table if not exists public.crew_schedule_items (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.schedule_crews(id) on delete cascade,
  item_type text not null check (item_type in ('job','downtime')),
  job_id uuid null references public.scheduled_jobs(id) on delete cascade,
  downtime_id uuid null references public.crew_downtimes(id) on delete cascade,
  position int not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crew_schedule_items_exactly_one_check
    check (
      (job_id is not null and downtime_id is null and item_type = 'job')
      or (job_id is null and downtime_id is not null and item_type = 'downtime')
    )
);

drop trigger if exists crew_schedule_items_set_updated_at on public.crew_schedule_items;
create trigger crew_schedule_items_set_updated_at before update on public.crew_schedule_items
for each row execute function public.set_updated_at();

create index if not exists crew_schedule_items_by_crew_position
  on public.crew_schedule_items(crew_id, position);

-- RLS policies for portal access.
do $$
declare
  tbl text;
begin
  foreach tbl in array ARRAY[
    'nz_holidays',
    'company_closures',
    'scheduled_jobs',
    'crew_downtimes',
    'crew_schedule_items'
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
