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
  site_visit_priority_tier smallint,
  follow_up_date date,
  archived_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.projects
  add column if not exists updated_at timestamptz not null default now();
alter table public.projects
  add column if not exists archived_at timestamptz;
alter table public.projects
  add column if not exists site_visit_priority_tier smallint;
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'projects_site_visit_priority_tier_check'
  ) then
    alter table public.projects
      add constraint projects_site_visit_priority_tier_check
      check (site_visit_priority_tier is null or site_visit_priority_tier in (1,2));
  end if;
end $$;
drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at before update on public.projects
for each row execute function public.set_updated_at();

-- ESTIMATES / COST PLANS (calculator persistence)
create table if not exists public.estimates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,

  -- statuses used by UI
  status text not null default 'draft'
    check (status in ('draft','in_review','approved','rejected','superseded','archived')),

  created_by text,
  summary_json jsonb,
  internal_notes text,

  approval_requested_at timestamptz,
  approval_requested_by text,
  approved_at timestamptz,
  approved_by text,
  rejected_at timestamptz,
  rejected_by text,
  approval_comment text,

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
alter table public.estimates
  add column if not exists created_by text,
  add column if not exists summary_json jsonb,
  add column if not exists internal_notes text,
  add column if not exists approval_requested_at timestamptz,
  add column if not exists approval_requested_by text,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by text,
  add column if not exists rejected_at timestamptz,
  add column if not exists rejected_by text,
  add column if not exists approval_comment text;
alter table public.estimates
  drop constraint if exists estimates_status_check;
alter table public.estimates
  add constraint estimates_status_check check (status in ('draft','in_review','approved','rejected','superseded','archived'));
drop trigger if exists estimates_set_updated_at on public.estimates;
create trigger estimates_set_updated_at before update on public.estimates
for each row execute function public.set_updated_at();

create index if not exists estimates_by_project on public.estimates(project_id);
create index if not exists estimates_by_status on public.estimates(status);

-- QUOTES (project-scoped, versioned)
create sequence if not exists public.quote_ref_seq;

create or replace function public.next_quote_ref()
returns text as $$
declare
  seq bigint;
begin
  seq := nextval('public.quote_ref_seq');
  return 'Q-' || lpad(seq::text, 4, '0');
end;
$$ language plpgsql;

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  quote_ref text not null unique,
  created_at timestamptz not null default now(),
  created_by text
);
do $$
begin
  if to_regclass('public.quotes') is not null then
    if not exists (
      select 1 from pg_constraint
      where conname = 'quotes_project_id_key'
        and conrelid = 'public.quotes'::regclass
    ) then
      alter table public.quotes add constraint quotes_project_id_key unique(project_id);
    end if;
  end if;
end $$;

create index if not exists quotes_by_project on public.quotes(project_id);

create table if not exists public.quote_versions (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  version_number int not null,
  status text not null
    check (status in ('DRAFT','SENT','ACCEPTED','DECLINED')),
  source_estimate_version_id uuid not null references public.estimates(id) on delete restrict,
  revised_from_quote_version_id uuid references public.quote_versions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  sent_at timestamptz,
  sent_by text,
  expires_at date,
  reference text,
  intro_text text,
  terms_text text,
  total_inc_gst_cents int not null default 0,
  total_ex_gst_cents int not null default 0,
  gst_cents int not null default 0,
  pdf_file_id uuid references public.file_artifacts(id) on delete set null
);
do $$
begin
  if to_regclass('public.quote_versions') is not null then
    if not exists (
      select 1 from pg_constraint
      where conname = 'quote_versions_quote_id_version_key'
        and conrelid = 'public.quote_versions'::regclass
    ) then
      alter table public.quote_versions add constraint quote_versions_quote_id_version_key unique(quote_id, version_number);
    end if;
  end if;
end $$;

alter table public.quote_versions
  add column if not exists updated_at timestamptz not null default now();
drop trigger if exists quote_versions_set_updated_at on public.quote_versions;
create trigger quote_versions_set_updated_at before update on public.quote_versions
for each row execute function public.set_updated_at();

create index if not exists quote_versions_by_quote on public.quote_versions(quote_id, version_number);
create index if not exists quote_versions_by_status on public.quote_versions(status);

create table if not exists public.quote_line_items (
  id uuid primary key default gen_random_uuid(),
  quote_version_id uuid not null references public.quote_versions(id) on delete cascade,
  sort_order int not null default 0,
  description text not null,
  qty numeric not null default 1,
  unit_price_inc_gst_cents int not null default 0,
  line_total_inc_gst_cents int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.quote_line_items
  add column if not exists updated_at timestamptz not null default now();
drop trigger if exists quote_line_items_set_updated_at on public.quote_line_items;
create trigger quote_line_items_set_updated_at before update on public.quote_line_items
for each row execute function public.set_updated_at();

create index if not exists quote_line_items_by_version on public.quote_line_items(quote_version_id, sort_order);

create table if not exists public.file_artifacts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  filename text not null,
  content_type text,
  size_bytes int,
  content_base64 text not null,
  created_at timestamptz not null default now(),
  created_by text
);

create index if not exists file_artifacts_by_project on public.file_artifacts(project_id);

create table if not exists public.quote_send_logs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  quote_version_id uuid not null references public.quote_versions(id) on delete cascade,
  from_name text,
  from_email text,
  reply_to_email text,
  to_emails text[] not null default '{}'::text[],
  cc_emails text[] not null default '{}'::text[],
  bcc_emails text[] not null default '{}'::text[],
  subject text not null,
  body_html text,
  body_text text,
  attachment_file_ids uuid[] not null default '{}'::uuid[],
  provider text,
  provider_message_id text,
  status text not null
    check (status in ('SENT','FAILED')),
  error_message text,
  created_at timestamptz not null default now(),
  created_by text,
  sent_at timestamptz
);

create index if not exists quote_send_logs_by_quote_version on public.quote_send_logs(quote_version_id, created_at desc);
create index if not exists quote_send_logs_by_project on public.quote_send_logs(project_id, created_at desc);

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
