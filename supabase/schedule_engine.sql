create extension if not exists "pgcrypto";

-- Schedule engine enhancements:
-- - "Assume started" support (actual_start_date + status)
-- - Confirm/lock schedule windows (status + confirmed_at/by + locked)
-- - Auditable events for future automations (schedule_events)
--
-- NOTE: The portal currently uses `schedule_items.start_date`/`end_date` as the planned window.
-- These columns remain the source of truth for planned dates.

-- Add new columns safely (schema drift tolerant).
do $$
begin
  if to_regclass('public.schedule_items') is null then
    raise exception 'public.schedule_items does not exist. Run supabase/schedule.sql first.';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='schedule_items' and column_name='status'
  ) then
    alter table public.schedule_items add column status text not null default 'TENTATIVE';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='schedule_items' and column_name='confirmed_at'
  ) then
    alter table public.schedule_items add column confirmed_at timestamptz null;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='schedule_items' and column_name='confirmed_by'
  ) then
    alter table public.schedule_items add column confirmed_by text null;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='schedule_items' and column_name='actual_start_date'
  ) then
    alter table public.schedule_items add column actual_start_date date null;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='schedule_items' and column_name='actual_end_date'
  ) then
    alter table public.schedule_items add column actual_end_date date null;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='schedule_items' and column_name='locked'
  ) then
    alter table public.schedule_items add column locked boolean not null default false;
  end if;

  -- Constrain allowed status values (idempotent).
  if not exists (
    select 1 from pg_constraint
    where conname = 'schedule_items_status_check'
      and conrelid = 'public.schedule_items'::regclass
  ) then
    alter table public.schedule_items
      add constraint schedule_items_status_check
      check (status in ('TENTATIVE','CONFIRMED','IN_PROGRESS','COMPLETED'));
  end if;
end $$;

-- Events table for schedule actions (auditable, idempotent via idempotency_key).
create table if not exists public.schedule_events (
  id uuid primary key default gen_random_uuid(),
  schedule_item_id uuid not null references public.schedule_items(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by text null,
  idempotency_key text not null unique
);

create index if not exists schedule_events_by_item on public.schedule_events(schedule_item_id);
create index if not exists schedule_events_by_project on public.schedule_events(project_id);
create index if not exists schedule_events_by_type on public.schedule_events(type);
create index if not exists schedule_events_by_created_at on public.schedule_events(created_at desc);

-- Access control is managed by the forward migrations under `supabase/migrations/`.
-- Do not grant blanket anon/authenticated table access from this legacy snapshot.

select pg_notify('pgrst', 'reload schema');
