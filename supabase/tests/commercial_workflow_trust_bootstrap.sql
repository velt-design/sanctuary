-- Test-only prerequisites for the commercial workflow migration.
-- This is deliberately smaller than the historical portal schema and must
-- never be used as a production migration or shared-environment reset.

set client_min_messages = warning;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
end;
$roles$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create sequence public.deposit_invoice_ref_seq;

create or replace function public.next_deposit_invoice_ref()
returns text
language sql
as $$
  select 'INV-T' || lpad(nextval('public.deposit_invoice_ref_seq')::text, 4, '0');
$$;

create table public.projects (
  id uuid primary key,
  name text not null,
  site_address text
);

create table public.estimates (
  id uuid primary key,
  project_id uuid not null references public.projects(id),
  created_at timestamptz not null default now()
);

create table public.quotes (
  id uuid primary key,
  project_id uuid not null references public.projects(id),
  quote_ref text not null unique
);

create table public.quote_versions (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id),
  version_number integer not null,
  status text not null check (status in ('DRAFT', 'SENT', 'ACCEPTED', 'DECLINED')),
  source_estimate_version_id uuid,
  revised_from_quote_version_id uuid,
  created_by text,
  customer_name text,
  reference text,
  intro_text text,
  terms_text text,
  deposit_percent numeric not null default 20,
  expires_at date,
  total_inc_gst_cents integer not null,
  total_ex_gst_cents integer not null,
  gst_cents integer not null,
  pricing_source text,
  pricing_source_metadata jsonb not null default '{}'::jsonb,
  pdf_file_id uuid,
  render_hash text,
  preview_base_payload jsonb,
  preview_rendered_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (quote_id, version_number)
);

create table public.quote_line_items (
  id uuid primary key default gen_random_uuid(),
  quote_version_id uuid not null references public.quote_versions(id) on delete cascade,
  sort_order integer not null,
  description text not null,
  qty numeric not null,
  unit_price_inc_gst_cents integer not null,
  line_total_inc_gst_cents integer not null
);

create table public.deposit_invoices (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id),
  quote_id uuid not null references public.quotes(id),
  quote_version_id uuid not null references public.quote_versions(id),
  quote_ref text not null,
  quote_version_number integer not null,
  invoice_ref text not null unique,
  status text not null check (status in ('OPEN', 'PAID', 'VOID')),
  issue_date date not null,
  due_date date not null,
  reference text,
  customer_name text,
  project_name text,
  project_address text,
  currency text not null,
  deposit_percent numeric not null,
  quote_total_inc_gst_cents integer not null,
  total_inc_gst_cents integer not null,
  total_ex_gst_cents integer not null,
  gst_cents integer not null,
  payment_instructions text,
  created_by text,
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by text,
  void_reason text,
  portal_token_hash text,
  portal_token_expires_at timestamptz
);

create unique index deposit_invoices_quote_open_unique
  on public.deposit_invoices (quote_id)
  where status = 'OPEN';

create table public.quote_send_logs (
  id uuid primary key default gen_random_uuid()
);

create table public.deposit_invoice_send_logs (
  id uuid primary key default gen_random_uuid(),
  next_retry_at timestamptz
);

create table public.job_pack_generations (
  id uuid primary key default gen_random_uuid(),
  quote_version_id uuid not null references public.quote_versions(id)
);

insert into public.projects (id, name, site_address)
values (
  '10000000-0000-4000-8000-000000000001',
  '[Migration Contract] Project',
  '1 Test-only Lane'
);

insert into public.estimates (id, project_id, created_at)
values
  (
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '2026-01-01T00:00:00Z'
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    '2026-01-02T00:00:00Z'
  );

insert into public.quotes (id, project_id, quote_ref)
values
  (
    '30000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'Q-T100'
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    'Q-T200'
  ),
  (
    '30000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000001',
    'Q-T300'
  );

insert into public.quote_versions (
  id,
  quote_id,
  version_number,
  status,
  source_estimate_version_id,
  created_by,
  customer_name,
  reference,
  deposit_percent,
  expires_at,
  total_inc_gst_cents,
  total_ex_gst_cents,
  gst_cents,
  pricing_source,
  created_at
)
values
  (
    '40000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    1,
    'DRAFT',
    '20000000-0000-4000-8000-000000000001',
    'migration-contract',
    'Test Customer',
    'Older draft',
    20,
    '2099-12-31',
    115000,
    100000,
    15000,
    'saved_estimate',
    '2026-01-01T00:00:00Z'
  ),
  (
    '40000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000001',
    2,
    'DRAFT',
    '20000000-0000-4000-8000-000000000002',
    'migration-contract',
    'Test Customer',
    'Latest draft',
    20,
    '2099-12-31',
    115000,
    100000,
    15000,
    'saved_estimate',
    '2026-02-01T00:00:00Z'
  ),
  (
    '40000000-0000-4000-8000-000000000003',
    '30000000-0000-4000-8000-000000000001',
    3,
    'SENT',
    '20000000-0000-4000-8000-000000000002',
    'migration-contract',
    'Test Customer',
    'Historical sent quote',
    20,
    '2099-12-31',
    115000,
    100000,
    15000,
    'saved_estimate',
    '2026-03-01T00:00:00Z'
  ),
  (
    '40000000-0000-4000-8000-000000000004',
    '30000000-0000-4000-8000-000000000002',
    1,
    'SENT',
    '20000000-0000-4000-8000-000000000002',
    'migration-contract',
    'Acceptance Customer',
    'Acceptance target',
    20,
    '2099-12-31',
    115000,
    100000,
    15000,
    'saved_estimate',
    '2026-04-01T00:00:00Z'
  ),
  (
    '40000000-0000-4000-8000-000000000005',
    '30000000-0000-4000-8000-000000000003',
    1,
    'SENT',
    '20000000-0000-4000-8000-000000000002',
    'migration-contract',
    'Expired Customer',
    'Expired target',
    20,
    '2020-01-01',
    115000,
    100000,
    15000,
    'saved_estimate',
    '2026-05-01T00:00:00Z'
  ),
  (
    '40000000-0000-4000-8000-000000000006',
    '30000000-0000-4000-8000-000000000002',
    0,
    'ACCEPTED',
    '20000000-0000-4000-8000-000000000001',
    'migration-contract',
    'Acceptance Customer',
    'Superseded accepted version',
    20,
    '2099-12-31',
    92000,
    80000,
    12000,
    'saved_estimate',
    '2025-12-01T00:00:00Z'
  );

insert into public.quote_line_items (
  quote_version_id,
  sort_order,
  description,
  qty,
  unit_price_inc_gst_cents,
  line_total_inc_gst_cents
)
select
  id,
  0,
  'Existing quote line',
  1,
  total_inc_gst_cents,
  total_inc_gst_cents
from public.quote_versions;

insert into public.deposit_invoices (
  id,
  project_id,
  quote_id,
  quote_version_id,
  quote_ref,
  quote_version_number,
  invoice_ref,
  status,
  issue_date,
  due_date,
  reference,
  customer_name,
  project_name,
  project_address,
  currency,
  deposit_percent,
  quote_total_inc_gst_cents,
  total_inc_gst_cents,
  total_ex_gst_cents,
  gst_cents,
  payment_instructions,
  created_by
)
values (
  '50000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000002',
  '40000000-0000-4000-8000-000000000006',
  'Q-T200',
  0,
  'INV-T0000',
  'OPEN',
  '2026-01-01',
  '2026-01-08',
  'Superseded deposit',
  'Acceptance Customer',
  '[Migration Contract] Project',
  '1 Test-only Lane',
  'NZD',
  20,
  92000,
  18400,
  16000,
  2400,
  'Test-only instructions',
  'migration-contract'
);

insert into public.deposit_invoice_send_logs (next_retry_at)
values ('2099-01-01T00:00:00Z');

