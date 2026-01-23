create extension if not exists "pgcrypto";

-- Ensure site_visit_events has the columns needed by the calendar UI.
do $$
begin
  if to_regclass('public.site_visit_events') is null then
    create table public.site_visit_events (
      id uuid primary key default gen_random_uuid(),
      project_id uuid not null references public.projects(id) on delete cascade,
      status text not null default 'UNSCHEDULED'
        check (status in ('UNSCHEDULED','TENTATIVE','CONFIRMED','COMPLETED','NO_SHOW','RESCHEDULED','CANCELLED')),
      scheduled_start timestamptz null,
      scheduled_end timestamptz null,
      assigned_sales_owner_id text null,
      notes text null,
      customer_notified boolean not null default false,
      last_notified_at timestamptz null,
      cancel_reason text null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  else
    if not exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='site_visit_events' and column_name='scheduled_start'
    ) then
      alter table public.site_visit_events add column scheduled_start timestamptz null;
    end if;

    if not exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='site_visit_events' and column_name='scheduled_end'
    ) then
      alter table public.site_visit_events add column scheduled_end timestamptz null;
    end if;

    if not exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='site_visit_events' and column_name='assigned_sales_owner_id'
    ) then
      alter table public.site_visit_events add column assigned_sales_owner_id text null;
    end if;

    if not exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='site_visit_events' and column_name='notes'
    ) then
      alter table public.site_visit_events add column notes text null;
    end if;

    if not exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='site_visit_events' and column_name='customer_notified'
    ) then
      alter table public.site_visit_events add column customer_notified boolean not null default false;
    end if;

    if not exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='site_visit_events' and column_name='last_notified_at'
    ) then
      alter table public.site_visit_events add column last_notified_at timestamptz null;
    end if;

    if not exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='site_visit_events' and column_name='cancel_reason'
    ) then
      alter table public.site_visit_events add column cancel_reason text null;
    end if;

    if not exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='site_visit_events' and column_name='created_at'
    ) then
      alter table public.site_visit_events add column created_at timestamptz not null default now();
    end if;

    if not exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='site_visit_events' and column_name='updated_at'
    ) then
      alter table public.site_visit_events add column updated_at timestamptz not null default now();
    end if;
  end if;
end $$;

-- Schema drift guardrails:
-- Older environments used UUID salesperson columns; the portal uses string IDs (e.g. "bruce").
-- Cast UUID salesperson columns to text so booking/assignment works consistently.
do $$
declare
  r record;
begin
  if to_regclass('public.site_visit_events') is null then
    return;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='site_visit_events'
      and column_name='assigned_sales_owner_id'
      and udt_name='uuid'
  ) then
    for r in
      select c.conname
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
      where c.conrelid = 'public.site_visit_events'::regclass
        and c.contype = 'f'
        and a.attname = 'assigned_sales_owner_id'
    loop
      execute format('alter table public.site_visit_events drop constraint %I', r.conname);
    end loop;

    alter table public.site_visit_events
      alter column assigned_sales_owner_id type text
      using assigned_sales_owner_id::text;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='site_visit_events'
      and column_name='assigned_sales_owner'
      and udt_name='uuid'
  ) then
    for r in
      select c.conname
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
      where c.conrelid = 'public.site_visit_events'::regclass
        and c.contype = 'f'
        and a.attname = 'assigned_sales_owner'
    loop
      execute format('alter table public.site_visit_events drop constraint %I', r.conname);
    end loop;

    alter table public.site_visit_events
      alter column assigned_sales_owner type text
      using assigned_sales_owner::text;
  end if;
end $$;

-- Ensure we can safely "upsert by project_id" (required by the booking API).
-- If duplicates exist from older experiments, keep the most recently updated row.
do $$
begin
  if to_regclass('public.site_visit_events') is not null then
    delete from public.site_visit_events s
    using (
      select id,
             row_number() over (
               partition by project_id
               order by updated_at desc nulls last, created_at desc nulls last, id desc
             ) as rn
      from public.site_visit_events
    ) d
    where s.id = d.id and d.rn > 1;
  end if;
end $$;

create unique index if not exists site_visit_events_unique_project on public.site_visit_events(project_id);

-- Indexes for calendar queries.
create index if not exists site_visit_events_by_status on public.site_visit_events(status);
create index if not exists site_visit_events_by_scheduled_start on public.site_visit_events(scheduled_start);
create index if not exists site_visit_events_by_project on public.site_visit_events(project_id);

-- Ensure updated_at is maintained if the helper exists.
do $$
begin
  if to_regclass('public.set_updated_at') is not null then
    drop trigger if exists site_visit_events_set_updated_at on public.site_visit_events;
    create trigger site_visit_events_set_updated_at before update on public.site_visit_events
    for each row execute function public.set_updated_at();
  end if;
end $$;

-- Seed optional templates for reschedule/cancel notifications (Phase A = outbox only).
create table if not exists public.email_templates (
  id text primary key,
  subject text not null,
  body_html text not null,
  body_text text null,
  variables jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.email_templates (id, subject, body_html, body_text, variables)
values
  ('EMAIL_SITE_VISIT_RESCHEDULED', 'Site visit rescheduled', '<p>Hi {{contactName}},</p><p>Your site visit for {{projectName}} has been rescheduled to {{scheduledStart}}.</p>', 'Hi {{contactName}}, Your site visit for {{projectName}} has been rescheduled to {{scheduledStart}}.', '["contactName","projectName","scheduledStart"]'::jsonb),
  ('EMAIL_SITE_VISIT_CANCELLED', 'Site visit cancelled', '<p>Hi {{contactName}},</p><p>Your site visit for {{projectName}} has been cancelled.</p>', 'Hi {{contactName}}, Your site visit for {{projectName}} has been cancelled.', '["contactName","projectName"]'::jsonb)
on conflict (id) do nothing;

-- Dev grants (match other portal schema files).
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.site_visit_events to anon, authenticated;

select pg_notify('pgrst', 'reload schema');
