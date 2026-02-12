create extension if not exists "pgcrypto";

-- Schedule V2 commitment + client update state.
do $$
begin
  if to_regclass('public.scheduled_jobs') is null then
    raise exception 'public.scheduled_jobs does not exist. Run 20260210_000003_schedule_v2_schema.sql first.';
  end if;
end $$;

alter table public.scheduled_jobs
  add column if not exists planned_commitment_type text null,
  add column if not exists planned_week_start date null,
  add column if not exists planned_flex_days int null,
  add column if not exists planned_locked_at timestamptz null,
  add column if not exists planned_locked_by text null,
  add column if not exists client_update_status text not null default 'none',
  add column if not exists client_update_needed_at timestamptz null,
  add column if not exists client_update_ack_at timestamptz null,
  add column if not exists client_update_ack_by text null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'scheduled_jobs_planned_commitment_type_check'
      and conrelid = 'public.scheduled_jobs'::regclass
  ) then
    alter table public.scheduled_jobs
      add constraint scheduled_jobs_planned_commitment_type_check
      check (planned_commitment_type is null or planned_commitment_type in ('week_of', 'fixed_date'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'scheduled_jobs_planned_flex_days_check'
      and conrelid = 'public.scheduled_jobs'::regclass
  ) then
    alter table public.scheduled_jobs
      add constraint scheduled_jobs_planned_flex_days_check
      check (planned_flex_days is null or planned_flex_days >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'scheduled_jobs_client_update_status_check'
      and conrelid = 'public.scheduled_jobs'::regclass
  ) then
    alter table public.scheduled_jobs
      add constraint scheduled_jobs_client_update_status_check
      check (client_update_status in ('none', 'needed', 'acknowledged'));
  end if;
end $$;

create index if not exists scheduled_jobs_by_commitment_type
  on public.scheduled_jobs(planned_commitment_type);

create index if not exists scheduled_jobs_by_client_update_status
  on public.scheduled_jobs(client_update_status);

create table if not exists public.planned_commitment_history (
  id uuid primary key default gen_random_uuid(),
  scheduled_job_id uuid not null references public.scheduled_jobs(id) on delete cascade,
  event_type text not null check (event_type in ('lock', 'reschedule')),
  commitment_type text not null check (commitment_type in ('week_of', 'fixed_date')),
  planned_week_start date null,
  planned_start date null,
  planned_duration_days int null,
  planned_flex_days int not null,
  hard_lock boolean not null default false,
  changed_at timestamptz not null default now(),
  changed_by text null
);

create index if not exists planned_commitment_history_by_job
  on public.planned_commitment_history(scheduled_job_id, changed_at desc);

do $$
begin
  if to_regclass('public.planned_commitment_history') is not null then
    alter table public.planned_commitment_history enable row level security;
    drop policy if exists portal_access_all on public.planned_commitment_history;
    create policy portal_access_all on public.planned_commitment_history
      for all using (public.has_portal_access())
      with check (public.has_portal_access());
  end if;
end $$;

-- Backfill: legacy planned rows become fixed-date commitments.
update public.scheduled_jobs
set
  planned_commitment_type = coalesce(planned_commitment_type, 'fixed_date'),
  planned_flex_days = coalesce(planned_flex_days, 1),
  planned_locked_at = coalesce(planned_locked_at, created_at)
where planned_start is not null
  and (
    planned_commitment_type is null
    or planned_flex_days is null
    or planned_locked_at is null
  );

update public.scheduled_jobs
set client_update_status = 'none'
where client_update_status is null;

notify pgrst, 'reload schema';
