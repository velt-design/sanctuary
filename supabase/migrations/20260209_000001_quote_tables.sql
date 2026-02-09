create extension if not exists "pgcrypto";

-- Quote reference sequence
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

-- File artifacts (PDF storage)
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

-- Quotes (one per project)
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

-- Quote versions (many per quote)
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

-- Quote line items
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

-- Quote send logs (email audit trail)
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

-- Task type update (invoice after acceptance)
do $$
begin
  if to_regclass('public.tasks') is not null then
    alter table public.tasks drop constraint if exists tasks_type_check;
    alter table public.tasks add constraint tasks_type_check check (type in (
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
      'RESEND_EMAIL',
      'CREATE_INVOICE_XERO'
    ));
  end if;
end $$;

select pg_notify('pgrst', 'reload schema');
