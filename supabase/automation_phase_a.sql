create extension if not exists "pgcrypto";

-- Updated-at helper (shared across portal schema files)
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Ensure projects supports automation columns + pipeline stage constraints.
do $$
begin
  if to_regclass('public.projects') is not null then
    -- Normalize legacy/variant pipeline_stage values to the canonical funnel.
    update public.projects
    set pipeline_stage = case lower(coalesce(pipeline_stage, ''))
      when 'new' then 'NEW'
      when 'contacted' then 'CONTACTED'
      when 'site_visit' then 'SITE_VISIT'
      when 'site visit' then 'SITE_VISIT'
      when 'quoting' then 'QUOTING'
      when 'sent' then 'SENT'
      when 'follow_up' then 'SENT'
      when 'follow up' then 'SENT'
      when 'won' then 'DEPOSIT'
      when 'deposit' then 'DEPOSIT'
      when 'scheduled' then 'SCHEDULED'
      when 'completed' then 'COMPLETED'
      when 'paid' then 'PAID'
      else upper(pipeline_stage)
    end
    where pipeline_stage is not null;

    update public.projects set pipeline_stage = 'NEW' where pipeline_stage is null;

    -- Default stage for new projects.
    alter table public.projects alter column pipeline_stage set default 'NEW';

    -- Optional automation fields (Phase A safe additions).
    if not exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='projects' and column_name='sales_owner_id'
    ) then
      alter table public.projects add column sales_owner_id uuid null;
    end if;

    if not exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='projects' and column_name='designer_owner_id'
    ) then
      alter table public.projects add column designer_owner_id uuid null;
    end if;

    if not exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='projects' and column_name='pm_owner_id'
    ) then
      alter table public.projects add column pm_owner_id uuid null;
    end if;

    if not exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='projects' and column_name='next_action_at'
    ) then
      alter table public.projects add column next_action_at timestamptz null;
    end if;

    if not exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='projects' and column_name='next_action_type'
    ) then
      alter table public.projects add column next_action_type text null;
    end if;

    -- Enforce canonical stage values (Phase A funnel).
    if not exists (
      select 1 from pg_constraint
      where conname = 'projects_pipeline_stage_check'
        and conrelid = 'public.projects'::regclass
    ) then
      alter table public.projects
      add constraint projects_pipeline_stage_check
      check (pipeline_stage in ('NEW','CONTACTED','SITE_VISIT','QUOTING','SENT','DEPOSIT','SCHEDULED','COMPLETED','PAID'));
    end if;
  end if;
end $$;

-- AUDIT EVENTS (required; idempotency backbone)
create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid null references public.projects(id) on delete cascade,
  type text not null,
  idempotency_key text not null unique,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_events_by_project on public.audit_events(project_id);
create index if not exists audit_events_by_type on public.audit_events(type);

-- TASKS
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  type text not null
    check (type in (
      'CREATE_DESIGN_PACKAGE',
      'REVIEW_NEW_LEAD',
      'BOOK_SITE_VISIT',
      'ATTEND_SITE_VISIT',
      'FINALIZE_SEND_QUOTE',
      'FOLLOWUP_CALL',
      'FOLLOWUP_EMAIL',
      'SCHEDULE_INSTALL_WINDOW',
      'CONFIRM_FINAL_SCHEDULE',
      'UPLOAD_COMPLETION_PHOTOS',
      'RESEND_EMAIL'
    )),
  status text not null default 'OPEN'
    check (status in ('OPEN','DONE','SKIPPED','RESCHEDULED')),
  assigned_to uuid null,
  due_at timestamptz null,
  title text not null,
  details text null,
  meta jsonb not null default '{}'::jsonb,
  -- Idempotency guard for automation-created tasks (unique per deterministic key).
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  completed_at timestamptz null
);
create index if not exists tasks_by_project_status on public.tasks(project_id, status);
create index if not exists tasks_by_assigned_status on public.tasks(assigned_to, status);
create index if not exists tasks_by_due_at on public.tasks(due_at);

-- DESIGN PACKAGE TICKETS
create table if not exists public.design_package_tickets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  tier text not null
    check (tier in ('TIER_1','TIER_2','TIER_3','TIER_4')),
  status text not null default 'OPEN'
    check (status in ('OPEN','IN_PROGRESS','DONE','BLOCKED')),
  assigned_designer uuid null,
  due_at timestamptz null,
  notes text null,
  created_at timestamptz not null default now(),
  completed_at timestamptz null
);
do $$
begin
  if to_regclass('public.design_package_tickets') is not null then
    if not exists (
      select 1 from pg_constraint
      where conname = 'design_package_tickets_project_id_key'
        and conrelid = 'public.design_package_tickets'::regclass
    ) then
      alter table public.design_package_tickets add constraint design_package_tickets_project_id_key unique(project_id);
    end if;
  end if;
end $$;

-- FOLLOW-UP PLANS
create table if not exists public.followup_plans (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  quote_id uuid null,
  status text not null default 'ACTIVE'
    check (status in ('ACTIVE','PAUSED','CANCELLED','COMPLETE')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists followup_plans_set_updated_at on public.followup_plans;
create trigger followup_plans_set_updated_at before update on public.followup_plans
for each row execute function public.set_updated_at();
create index if not exists followup_plans_by_project_status on public.followup_plans(project_id, status);
create unique index if not exists followup_plans_one_active_per_project
  on public.followup_plans(project_id)
  where status = 'ACTIVE';

-- FOLLOW-UP TASKS
create table if not exists public.followup_tasks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.followup_plans(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  type text not null
    check (type in ('FOLLOWUP_CALL','FOLLOWUP_EMAIL')),
  status text not null default 'OPEN'
    check (status in ('OPEN','DONE','SKIPPED','RESCHEDULED')),
  assigned_to uuid null,
  due_at timestamptz not null,
  outcome_note text null,
  -- Idempotency guard for automation-created follow-ups.
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  completed_at timestamptz null
);
create index if not exists followup_tasks_by_project_status on public.followup_tasks(project_id, status);
create index if not exists followup_tasks_by_due_status on public.followup_tasks(due_at, status);

-- SITE VISIT EVENTS
create table if not exists public.site_visit_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  status text not null default 'UNSCHEDULED'
    check (status in ('UNSCHEDULED','TENTATIVE','CONFIRMED','COMPLETED','NO_SHOW','RESCHEDULED','CANCELLED')),
  scheduled_start timestamptz null,
  scheduled_end timestamptz null,
  assigned_sales_owner_id text null,
  notes text null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists site_visit_events_set_updated_at on public.site_visit_events;
create trigger site_visit_events_set_updated_at before update on public.site_visit_events
for each row execute function public.set_updated_at();

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

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='site_visit_events' and column_name='assigned_sales_owner_id'
  ) then
    alter table public.site_visit_events add column assigned_sales_owner_id text null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='site_visit_events' and column_name='assigned_sales_owner_id' and udt_name='uuid'
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
    select 1 from information_schema.columns
    where table_schema='public' and table_name='site_visit_events' and column_name='assigned_sales_owner' and udt_name='uuid'
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
do $$
begin
  if to_regclass('public.site_visit_events') is not null then
    if not exists (
      select 1 from pg_constraint
      where conname = 'site_visit_events_project_id_key'
        and conrelid = 'public.site_visit_events'::regclass
    ) then
      alter table public.site_visit_events add constraint site_visit_events_project_id_key unique(project_id);
    end if;
  end if;
end $$;

-- EMAIL TEMPLATES
create table if not exists public.email_templates (
  id text primary key,
  subject text not null,
  body_html text not null,
  body_text text null,
  variables jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists email_templates_set_updated_at on public.email_templates;
create trigger email_templates_set_updated_at before update on public.email_templates
for each row execute function public.set_updated_at();

-- Seed placeholder templates (Phase A: outbox only; no sending).
insert into public.email_templates (id, subject, body_html, body_text, variables)
values
  ('EMAIL_NEW_RANGE_AND_BROCHURES', 'Thanks for your enquiry', '<p>Hi {{contactName}},</p><p>Thanks for getting in touch about {{projectName}}. Here are our brochures.</p>', 'Hi {{contactName}}, Thanks for getting in touch about {{projectName}}. Here are our brochures.', '["contactName","projectName"]'::jsonb),
  ('EMAIL_CONTACTED_CONFIRM_RANGE', 'Next steps for your pergola', '<p>Hi {{contactName}},</p><p>Just confirming the range for {{projectName}}.</p>', 'Hi {{contactName}}, Just confirming the range for {{projectName}}.', '["contactName","projectName"]'::jsonb),
  ('EMAIL_SITE_VISIT_CONFIRMED', 'Site visit confirmed', '<p>Hi {{contactName}},</p><p>Your site visit for {{projectName}} is confirmed for {{scheduledStart}}.</p>', 'Hi {{contactName}}, Your site visit for {{projectName}} is confirmed for {{scheduledStart}}.', '["contactName","projectName","scheduledStart"]'::jsonb),
  ('EMAIL_QUOTE_SENT', 'Your quote is ready', '<p>Hi {{contactName}},</p><p>Your quote for {{projectName}} is ready.</p>', 'Hi {{contactName}}, Your quote for {{projectName}} is ready.', '["contactName","projectName"]'::jsonb),
  ('EMAIL_DEPOSIT_RECEIVED', 'Deposit received', '<p>Hi {{contactName}},</p><p>We have received your deposit for {{projectName}}.</p>', 'Hi {{contactName}}, We have received your deposit for {{projectName}}.', '["contactName","projectName"]'::jsonb),
  ('EMAIL_INSTALL_SCHEDULED', 'Install scheduled', '<p>Hi {{contactName}},</p><p>Your install for {{projectName}} has been scheduled.</p>', 'Hi {{contactName}}, Your install for {{projectName}} has been scheduled.', '["contactName","projectName"]'::jsonb),
  ('EMAIL_FINAL_INVOICE_SENT', 'Final invoice', '<p>Hi {{contactName}},</p><p>Your final invoice for {{projectName}} is ready.</p>', 'Hi {{contactName}}, Your final invoice for {{projectName}} is ready.', '["contactName","projectName"]'::jsonb),
  ('EMAIL_PAID_THANK_YOU', 'Thanks for your payment', '<p>Hi {{contactName}},</p><p>Thanks for your payment for {{projectName}}.</p>', 'Hi {{contactName}}, Thanks for your payment for {{projectName}}.', '["contactName","projectName"]'::jsonb)
on conflict (id) do nothing;

-- EMAIL OUTBOX (Phase A = log-only)
create table if not exists public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  contact_id uuid null references public.contacts(id) on delete set null,
  email_type text not null,
  to_email text not null,
  subject text not null,
  template_id text not null references public.email_templates(id),
  variables jsonb not null default '{}'::jsonb,
  status text not null default 'QUEUED'
    check (status in ('QUEUED','CANCELLED','SENT','FAILED')),
  error text null,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  sent_at timestamptz null
);
create index if not exists email_outbox_by_project_status on public.email_outbox(project_id, status);
create index if not exists email_outbox_by_created_at on public.email_outbox(created_at desc);

-- DEV GRANTS (keep dev simple; tighten later)
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;

-- Force schema reload
select pg_notify('pgrst', 'reload schema');
