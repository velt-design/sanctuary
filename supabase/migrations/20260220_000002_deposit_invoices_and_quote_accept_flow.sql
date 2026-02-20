alter table if exists public.quote_versions
  add column if not exists deposit_percent numeric(5,2) not null default 50;

do $$
begin
  if to_regclass('public.quote_versions') is not null then
    if not exists (
      select 1
      from pg_constraint
      where conname = 'quote_versions_deposit_percent_range_check'
        and conrelid = 'public.quote_versions'::regclass
    ) then
      alter table public.quote_versions
        add constraint quote_versions_deposit_percent_range_check
        check (deposit_percent >= 0 and deposit_percent <= 100);
    end if;
  end if;
end $$;

create sequence if not exists public.deposit_invoice_ref_seq;

create or replace function public.next_deposit_invoice_ref()
returns text as $$
declare
  seq bigint;
begin
  seq := nextval('public.deposit_invoice_ref_seq');
  return 'INV-' || lpad(seq::text, 4, '0');
end;
$$ language plpgsql;

create table if not exists public.deposit_invoices (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  quote_version_id uuid not null references public.quote_versions(id) on delete restrict,
  quote_ref text not null,
  quote_version_number int not null,
  invoice_ref text not null unique,
  status text not null default 'OPEN' check (status in ('OPEN', 'VOID')),
  issue_date date not null,
  due_date date not null,
  reference text,
  customer_name text,
  project_name text,
  project_address text,
  currency text not null default 'NZD',
  deposit_percent numeric(5,2) not null,
  quote_total_inc_gst_cents int not null,
  total_inc_gst_cents int not null,
  total_ex_gst_cents int not null,
  gst_cents int not null,
  payment_instructions text,
  portal_token_hash text,
  portal_token_expires_at timestamptz,
  pdf_file_id uuid references public.file_artifacts(id) on delete set null,
  sent_at timestamptz,
  sent_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  voided_at timestamptz,
  voided_by text,
  void_reason text,
  replaced_by_invoice_id uuid references public.deposit_invoices(id) on delete set null
);

alter table if exists public.deposit_invoices
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists quote_ref text not null default '',
  add column if not exists quote_version_number int not null default 0,
  add column if not exists payment_instructions text,
  add column if not exists portal_token_hash text,
  add column if not exists portal_token_expires_at timestamptz,
  add column if not exists sent_at timestamptz,
  add column if not exists sent_by text,
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by text,
  add column if not exists void_reason text,
  add column if not exists replaced_by_invoice_id uuid references public.deposit_invoices(id) on delete set null;

do $$
begin
  if to_regclass('public.deposit_invoices') is not null then
    if not exists (
      select 1
      from pg_constraint
      where conname = 'deposit_invoices_deposit_percent_range_check'
        and conrelid = 'public.deposit_invoices'::regclass
    ) then
      alter table public.deposit_invoices
        add constraint deposit_invoices_deposit_percent_range_check
        check (deposit_percent >= 0 and deposit_percent <= 100);
    end if;

    if not exists (
      select 1
      from pg_constraint
      where conname = 'deposit_invoices_quote_total_nonnegative_check'
        and conrelid = 'public.deposit_invoices'::regclass
    ) then
      alter table public.deposit_invoices
        add constraint deposit_invoices_quote_total_nonnegative_check
        check (
          quote_total_inc_gst_cents >= 0
          and total_inc_gst_cents >= 0
          and total_ex_gst_cents >= 0
          and gst_cents >= 0
        );
    end if;
  end if;
end $$;

create index if not exists deposit_invoices_by_project on public.deposit_invoices(project_id, created_at desc);
create index if not exists deposit_invoices_by_quote on public.deposit_invoices(quote_id, created_at desc);
create index if not exists deposit_invoices_by_quote_version on public.deposit_invoices(quote_version_id);
create index if not exists deposit_invoices_by_status on public.deposit_invoices(status, created_at desc);
create index if not exists deposit_invoices_portal_token_hash_idx on public.deposit_invoices(portal_token_hash);
create unique index if not exists deposit_invoices_quote_open_unique on public.deposit_invoices(quote_id) where status = 'OPEN';

drop trigger if exists deposit_invoices_set_updated_at on public.deposit_invoices;
create trigger deposit_invoices_set_updated_at before update on public.deposit_invoices
for each row execute function public.set_updated_at();

create table if not exists public.deposit_invoice_send_logs (
  id uuid primary key default gen_random_uuid(),
  deposit_invoice_id uuid not null references public.deposit_invoices(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
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
  status text not null check (status in ('SENT', 'FAILED')),
  error_message text,
  attempt_number int not null default 1,
  first_attempt_at timestamptz not null default now(),
  next_retry_at timestamptz,
  final_failure boolean not null default false,
  created_at timestamptz not null default now(),
  created_by text,
  sent_at timestamptz
);

alter table if exists public.deposit_invoice_send_logs
  add column if not exists attempt_number int not null default 1,
  add column if not exists first_attempt_at timestamptz not null default now(),
  add column if not exists next_retry_at timestamptz,
  add column if not exists final_failure boolean not null default false,
  add column if not exists sent_at timestamptz;

create index if not exists deposit_invoice_send_logs_by_invoice on public.deposit_invoice_send_logs(deposit_invoice_id, created_at desc);
create index if not exists deposit_invoice_send_logs_by_project on public.deposit_invoice_send_logs(project_id, created_at desc);
create index if not exists deposit_invoice_send_logs_retry_queue on public.deposit_invoice_send_logs(next_retry_at)
  where status = 'FAILED' and final_failure = false and next_retry_at is not null;

insert into public.email_templates (id, subject, body_html, body_text, variables)
values
  ('EMAIL_DEPOSIT_INVOICE_READY_V1', 'Deposit invoice', '<p>(Rendered in app code)</p>', null, '[]'::jsonb)
on conflict (id) do update
set
  subject = excluded.subject,
  body_html = excluded.body_html,
  body_text = excluded.body_text,
  variables = excluded.variables,
  updated_at = now();

select pg_notify('pgrst', 'reload schema');
