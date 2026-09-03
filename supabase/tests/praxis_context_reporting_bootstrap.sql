-- Disposable PostgreSQL prerequisites for the Praxis reporting boundary.
-- This is deliberately not a production schema or migration.
set client_min_messages = warning;

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end
$roles$;

create schema auth;
create schema private;
create schema storage;
create schema extensions;

create function auth.role() returns text language sql stable
as $$ select coalesce(current_setting('request.jwt.claim.role', true), '') $$;
create function auth.uid() returns uuid language sql stable
as $$ select null::uuid $$;
create function public.has_portal_access() returns boolean language sql stable
as $$ select false $$;
create function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end
$$;
-- PGlite test double for Supabase's pgcrypto digest. The contract only needs a
-- deterministic 32-byte source hash; HTTP canonical SHA-256 is tested in TS.
create function extensions.digest(value bytea, algorithm text) returns bytea
language sql immutable strict
as $$ select decode(md5(encode(value, 'hex')) || md5(encode(value, 'hex')), 'hex') $$;

create table public.contacts (
  id uuid primary key, name text not null, email text, phone text, address text,
  created_at timestamptz not null, updated_at timestamptz not null
);
create table public.projects (
  id uuid primary key, contact_id uuid references public.contacts(id), name text not null,
  quote_ref text, region text, site_address text, pipeline_stage text not null,
  site_visit_priority_tier smallint, follow_up_date date, archived_at timestamptz,
  notes text, deposit_amount_cents integer, deposit_paid_date date,
  deposit_received_at timestamptz, final_payment_date date, next_action_at timestamptz,
  next_action_type text, next_action text, next_action_date date, version integer not null,
  created_at timestamptz not null, updated_at timestamptz not null
);
create table public.enquiry_requests (
  id uuid primary key, contact_id uuid references public.contacts(id), project_id uuid references public.projects(id),
  enquiry_type text not null, suburb text, message text, width_m numeric, depth_m numeric,
  height_m numeric, style text, roof_materials text[], add_ons jsonb not null,
  base_budget_low_inc_gst integer, base_budget_high_inc_gst integer,
  blinds_budget_low_inc_gst integer, blinds_budget_high_inc_gst integer, budget_basis text,
  company text, files jsonb not null, source text not null, page text, utm jsonb not null,
  raw_payload jsonb not null, created_at timestamptz not null, updated_at timestamptz not null
);
create table public.estimates (
  id uuid primary key, project_id uuid not null references public.projects(id), commercial_scope_id uuid,
  internal_name text, status text not null, version integer not null, created_by text,
  summary_json jsonb, internal_notes text, summary text, crew_hours numeric, duration_days numeric,
  materials_ex_gst numeric, install_payout_ex_gst numeric, overhead_ex_gst numeric,
  total_true_cost_ex_gst numeric, total_true_cost_inc_gst numeric, inputs jsonb not null,
  outputs jsonb not null, warnings jsonb not null, costing_manifest text, costing_rules text,
  costing_config_version_id uuid, pricing_source text, pricing_source_metadata jsonb,
  commercial_design_input jsonb, created_at timestamptz not null, updated_at timestamptz not null
);
create table public.quotes (
  id uuid primary key, project_id uuid not null references public.projects(id), commercial_scope_id uuid,
  quote_ref text not null, internal_name text, created_by text, created_at timestamptz not null
);
create table public.quote_versions (
  id uuid primary key, quote_id uuid not null references public.quotes(id), version_number integer not null,
  status text not null, source_estimate_version_id uuid, revised_from_quote_version_id uuid,
  created_by text, sent_at timestamptz, sent_by text, accepted_at timestamptz,
  accept_token_hash text, accept_token_expires_at timestamptz, superseded_at timestamptz,
  superseded_by text, expires_at date, reference text, customer_name text, intro_text text,
  terms_text text, total_inc_gst_cents integer not null, total_ex_gst_cents integer not null,
  gst_cents integer not null, pdf_file_id uuid, deposit_percent numeric, payment_terms jsonb,
  pricing_source text, pricing_source_metadata jsonb, commercial_revision bigint not null,
  is_current_draft boolean not null, delivery_prepared_at timestamptz,
  created_at timestamptz not null, updated_at timestamptz not null
);
create table public.quote_line_items (
  id uuid primary key, quote_version_id uuid not null references public.quote_versions(id),
  sort_order integer not null, description text not null, qty numeric not null,
  unit_price_inc_gst_cents integer not null, line_total_inc_gst_cents integer not null,
  created_at timestamptz not null, updated_at timestamptz not null
);
create table public.project_invoice_plan_items (
  id uuid primary key, project_id uuid not null references public.projects(id),
  quote_version_id uuid not null references public.quote_versions(id), plan_group_id uuid not null,
  payment_term_id text not null, label text not null, position integer not null, item_count integer not null,
  amount_inc_gst_cents integer not null, invoice_id uuid, created_at timestamptz not null,
  created_by text, cancelled_at timestamptz, cancelled_by text, cancellation_reason text
);
create table public.deposit_invoices (
  id uuid primary key, project_id uuid not null references public.projects(id), quote_id uuid not null,
  quote_version_id uuid not null, quote_ref text not null, quote_version_number integer not null,
  invoice_ref text not null, status text not null, issue_date date not null, due_date date not null,
  reference text, customer_name text, project_name text, project_address text, currency text not null,
  deposit_percent numeric not null, quote_total_inc_gst_cents integer not null,
  total_inc_gst_cents integer not null, total_ex_gst_cents integer not null, gst_cents integer not null,
  payment_instructions text, portal_token_hash text, portal_token_expires_at timestamptz,
  pdf_file_id uuid, sent_at timestamptz, sent_by text, created_by text, voided_at timestamptz,
  voided_by text, void_reason text, replaced_by_invoice_id uuid, payment_term_id text,
  payment_term_label text, payment_term_position integer, payment_term_count integer,
  payment_term_calculation text, payment_term_percentage numeric, creation_mode text,
  creation_override_reason text, invoice_plan_item_id uuid, paid_at timestamptz, paid_by text,
  payment_method text, payment_reference text, payment_note text,
  created_at timestamptz not null, updated_at timestamptz not null
);
create table public.project_payment_entries (
  id uuid primary key, project_id uuid not null references public.projects(id), source_invoice_id uuid,
  entry_type text not null, amount_inc_gst_cents integer not null, occurred_at timestamptz not null,
  payment_method text, reference text, note text, reason text, reverses_entry_id uuid,
  created_by text, created_at timestamptz not null
);
create table public.project_payment_allocations (
  id uuid primary key, project_id uuid not null references public.projects(id), payment_entry_id uuid not null,
  quote_version_id uuid not null, payment_term_id text not null, amount_inc_gst_cents integer not null,
  change_reason text not null, created_by text, reversed_at timestamptz, reversed_by text,
  reversal_reason text, created_at timestamptz not null
);

create table private.commercial_email_intents (id uuid primary key, protected_payload jsonb not null);
create table auth.users (id uuid primary key, encrypted_password text);
create table storage.objects (id uuid primary key, path_tokens text[]);
create sequence public.praxis_probe_sequence;

create function public.commercial_current_accepted_quote_versions(p_project_id uuid)
returns table (quote_version_id uuid, quote_id uuid, total_inc_gst_cents integer)
language sql stable security definer set search_path = pg_catalog, pg_temp as $$
  select version.id, quote.id, version.total_inc_gst_cents
  from public.quotes quote join public.quote_versions version on version.quote_id = quote.id
  where quote.project_id = p_project_id and version.status = 'ACCEPTED'
$$;
revoke all on function public.commercial_current_accepted_quote_versions(uuid) from public, anon, authenticated;
grant execute on function public.commercial_current_accepted_quote_versions(uuid) to service_role;

create function public.commercial_project_financial_truth(p_project_id uuid)
returns table (
  accepted_total_inc_gst_cents integer, paid_inc_gst_cents integer,
  open_invoice_inc_gst_cents integer, remaining_to_invoice_inc_gst_cents integer,
  over_committed_inc_gst_cents integer, latest_payment_at timestamptz
)
language sql stable security definer set search_path = pg_catalog, pg_temp as $$
  select 0, 0, 0, 0, 0, null::timestamptz
$$;
revoke all on function public.commercial_project_financial_truth(uuid) from public, anon, authenticated;
grant execute on function public.commercial_project_financial_truth(uuid) to authenticated, service_role;

create function public.commercial_record_project_payment_entry()
returns void language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
begin insert into public.project_payment_entries (
  id, project_id, entry_type, amount_inc_gst_cents, occurred_at, created_at
) values (
  'f0000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001', 'PAYMENT', 1, now(), now()
); end
$$;
revoke all on function public.commercial_record_project_payment_entry() from public, anon, authenticated;
grant execute on function public.commercial_record_project_payment_entry() to service_role;

create function public.commercial_quote_update_draft()
returns void language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
begin update public.quote_versions set status = 'DRAFT'; end
$$;
create function public.commercial_create_admin_invoice()
returns void language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
begin update public.deposit_invoices set status = 'OPEN'; end
$$;
create function public.commercial_change_payment_allocation()
returns void language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
begin update public.project_payment_allocations set change_reason = 'changed'; end
$$;
revoke all on function public.commercial_quote_update_draft() from public, anon, authenticated;
revoke all on function public.commercial_create_admin_invoice() from public, anon, authenticated;
revoke all on function public.commercial_change_payment_allocation() from public, anon, authenticated;
grant execute on function public.commercial_quote_update_draft() to service_role;
grant execute on function public.commercial_create_admin_invoice() to service_role;
grant execute on function public.commercial_change_payment_allocation() to service_role;

insert into public.contacts values (
  '00000000-0000-4000-8000-000000000001', 'Ada Customer', 'ada@example.test', '+6400000000', 'Test address', now(), now()
);
insert into public.projects values (
  '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001',
  'Test Project', 'Q-TEST', 'Auckland', 'Test site', 'SENT', null, null, null, null,
  null, null, null, null, null, null, null, null, 1, now(), now()
);
insert into public.quotes values (
  '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
  null, 'Q-TEST', 'Test family', 'fixture', now()
);
insert into public.quote_versions values (
  '30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
  1, 'ACCEPTED', null, null, 'fixture', null, null, now(), 'secret-token-hash', now(),
  null, null, null, 'Test reference', 'Ada Customer', 'Hello', 'Terms', 11500, 10000,
  1500, null, 50, '[]', 'manual', '{}', 1, false, null, now(), now()
);

insert into public.enquiry_requests (
  id, contact_id, project_id, enquiry_type, suburb, message, add_ons,
  files, source, page, utm, raw_payload, created_at, updated_at
) values (
  '40000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'residential', 'Test suburb', 'Test enquiry',
  '{"blindCount":2,"nested":{"accessToken":"nested-enquiry-secret"}}',
  '[{"path":"private/enquiry.pdf"}]', 'website', '/contact',
  '{"campaign":"spring","password":"nested-utm-secret"}',
  '{"providerMessageId":"private-provider-id"}', now(), now()
);

insert into public.estimates (
  id, project_id, internal_name, status, version, created_by, summary_json,
  internal_notes, summary, inputs, outputs, warnings, pricing_source,
  pricing_source_metadata, commercial_design_input, created_at, updated_at
) values (
  '50000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'Real-shape estimate', 'DRAFT', 1, 'fixture',
  '{"label":"Current estimate","acceptTokenHash":"nested-summary-secret"}',
  'Internal estimating note', 'Pergola estimate',
  '{"schemaVersion":"v2","modules":[{"attachmentSide":"rear","lengthM":6,"apiToken":"nested-input-secret","attachment":{"filePath":"private/design.pdf"}}]}',
  '{"totalTrueCostIncGst":11500,"details":{"crewHours":24,"password":"nested-output-secret"}}',
  '[{"code":"CHECK_ACCESS","message":"Confirm access","providerError":"nested-warning-secret"}]',
  'calculator',
  '{"version":"v2.6","credentials":{"secret":"nested-metadata-secret"}}',
  '{"raw":"private-commercial-design"}', now(), now()
);

insert into public.quote_line_items (
  id, quote_version_id, sort_order, description, qty,
  unit_price_inc_gst_cents, line_total_inc_gst_cents, created_at, updated_at
) values (
  '60000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001', 1, 'Pergola structure', 1,
  11500, 11500, now(), now()
);

insert into public.deposit_invoices (
  id, project_id, quote_id, quote_version_id, quote_ref, quote_version_number,
  invoice_ref, status, issue_date, due_date, customer_name, project_name,
  currency, deposit_percent, quote_total_inc_gst_cents, total_inc_gst_cents,
  total_ex_gst_cents, gst_cents, portal_token_hash, invoice_plan_item_id,
  created_at, updated_at
) values (
  '70000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  'Q-TEST', 1, 'INV-TEST', 'OPEN', current_date, current_date + 7,
  'Ada Customer', 'Test Project', 'NZD', 50, 11500, 5750, 5000, 750,
  'private-invoice-token-hash', '80000000-0000-4000-8000-000000000001',
  now(), now()
);

insert into public.project_invoice_plan_items (
  id, project_id, quote_version_id, plan_group_id, payment_term_id, label,
  position, item_count, amount_inc_gst_cents, invoice_id, created_at, created_by
) values (
  '80000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  '81000000-0000-4000-8000-000000000001', 'deposit', 'Deposit',
  1, 2, 5750, null, now(), 'fixture'
);

insert into public.project_payment_entries (
  id, project_id, source_invoice_id, entry_type, amount_inc_gst_cents,
  occurred_at, payment_method, reference, note, created_by, created_at
) values (
  '90000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '70000000-0000-4000-8000-000000000001', 'PAYMENT', 5750,
  now(), 'bank_transfer', 'PAY-TEST', 'Deposit received', 'fixture', now()
);

insert into public.project_payment_allocations (
  id, project_id, payment_entry_id, quote_version_id, payment_term_id,
  amount_inc_gst_cents, change_reason, created_by, created_at
) values (
  'a1000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '90000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001', 'deposit', 5750,
  'Initial allocation', 'fixture', now()
);
