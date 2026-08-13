-- Test-only prerequisites for the commercial truth invariant migration.
-- This deliberately models only the durable commercial owners exercised by
-- the contract and must never be used as a production migration or reset.

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

create schema if not exists auth;

create or replace function auth.role()
returns text
language sql
stable
as $$ select 'service_role'::text $$;

create or replace function auth.uid()
returns uuid
language sql
stable
as $$ select '90000000-0000-4000-8000-000000000001'::uuid $$;

create or replace function public.has_portal_access()
returns boolean
language sql
stable
as $$ select true $$;

create sequence public.commercial_truth_invoice_ref_seq;

create or replace function public.next_deposit_invoice_ref()
returns text
language sql
as $$
  select 'INV-CT' || lpad(nextval('public.commercial_truth_invoice_ref_seq')::text, 4, '0');
$$;

create table public.projects (
  id uuid primary key,
  name text not null,
  site_address text,
  pipeline_stage text not null default 'SENT',
  deposit_paid_date date,
  final_payment_date date,
  deposit_received_at timestamptz
);

create or replace function public.commercial_truth_capture_deposit_received_at()
returns trigger
language plpgsql
as $$
begin
  if old.pipeline_stage = 'SENT' and new.pipeline_stage = 'DEPOSIT' then
    new.deposit_received_at := clock_timestamp();
  end if;
  return new;
end;
$$;

create trigger projects_capture_deposit_received_at
before update of pipeline_stage on public.projects
for each row execute function public.commercial_truth_capture_deposit_received_at();

create table public.quotes (
  id uuid primary key,
  project_id uuid not null references public.projects(id),
  quote_ref text not null unique,
  commercial_scope_id uuid
);

create table public.quote_versions (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id),
  version_number integer not null,
  status text not null check (status in ('DRAFT', 'SENT', 'ACCEPTED', 'DECLINED', 'SUPERSEDED')),
  customer_name text,
  deposit_percent numeric not null default 50,
  payment_terms jsonb not null default '[]'::jsonb,
  total_inc_gst_cents integer not null,
  total_ex_gst_cents integer not null,
  gst_cents integer not null,
  accepted_at timestamptz,
  superseded_at timestamptz,
  superseded_by text,
  is_current_draft boolean not null default false,
  accept_token_hash text,
  accept_token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (quote_id, version_number)
);

create table public.project_invoice_plan_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id),
  quote_version_id uuid not null references public.quote_versions(id),
  plan_group_id uuid not null,
  payment_term_id text not null,
  label text not null,
  position integer not null,
  item_count integer not null,
  amount_inc_gst_cents integer not null,
  invoice_id uuid,
  created_at timestamptz not null default now(),
  created_by text,
  cancelled_at timestamptz,
  cancelled_by text,
  cancellation_reason text,
  unique (quote_version_id, payment_term_id)
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
  issue_date date not null default current_date,
  due_date date not null default current_date + 7,
  reference text,
  customer_name text,
  project_name text,
  project_address text,
  currency text not null default 'NZD',
  deposit_percent numeric not null default 0,
  quote_total_inc_gst_cents integer not null,
  total_inc_gst_cents integer not null,
  total_ex_gst_cents integer not null,
  gst_cents integer not null,
  payment_instructions text,
  created_by text,
  created_at timestamptz not null default now(),
  payment_term_id text not null,
  payment_term_label text not null,
  payment_term_position integer not null default 1,
  payment_term_count integer not null default 1,
  payment_term_calculation text not null default 'fixed',
  payment_term_percentage numeric,
  paid_at timestamptz,
  paid_by text,
  payment_reference text,
  payment_method text,
  payment_note text,
  voided_at timestamptz,
  voided_by text,
  void_reason text,
  portal_token_hash text,
  portal_token_expires_at timestamptz,
  creation_mode text not null default 'scheduled',
  creation_override_reason text,
  invoice_plan_item_id uuid references public.project_invoice_plan_items(id),
  admin_client_intent_id text,
  admin_creation_planned_item_count integer,
  admin_creation_remaining_before_inc_gst_cents integer,
  admin_creation_remaining_after_inc_gst_cents integer
);

alter table public.project_invoice_plan_items
  add constraint project_invoice_plan_items_invoice_fk
  foreign key (invoice_id) references public.deposit_invoices(id);

create unique index deposit_invoices_active_term_unique
  on public.deposit_invoices (quote_version_id, payment_term_id)
  where status <> 'VOID';

create unique index deposit_invoices_admin_client_intent_unique
  on public.deposit_invoices (project_id, admin_client_intent_id)
  where admin_client_intent_id is not null;

create table public.project_payment_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id),
  source_invoice_id uuid references public.deposit_invoices(id),
  entry_type text not null check (entry_type in ('PAYMENT', 'ADJUSTMENT', 'REVERSAL')),
  amount_inc_gst_cents integer not null check (amount_inc_gst_cents <> 0),
  occurred_at timestamptz not null,
  payment_method text,
  reference text,
  note text,
  reason text,
  reverses_entry_id uuid references public.project_payment_entries(id),
  created_at timestamptz not null default now(),
  created_by text,
  client_intent_id text
);

create unique index project_payment_entries_source_invoice_unique
  on public.project_payment_entries (source_invoice_id)
  where source_invoice_id is not null and entry_type = 'PAYMENT';

create unique index project_payment_entries_reversal_unique
  on public.project_payment_entries (reverses_entry_id)
  where reverses_entry_id is not null;

create table public.project_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id),
  payment_entry_id uuid not null references public.project_payment_entries(id),
  quote_version_id uuid not null references public.quote_versions(id),
  payment_term_id text not null,
  amount_inc_gst_cents integer not null check (amount_inc_gst_cents > 0),
  change_reason text not null,
  created_at timestamptz not null default now(),
  created_by text,
  reversed_at timestamptz,
  reversed_by text,
  reversal_reason text
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id),
  type text not null,
  idempotency_key text not null unique,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Minimal predecessor commands. The invariant migration wraps these owners;
-- their broader behavior remains covered by the established commercial DB test.
create or replace function public.commercial_accept_quote_and_ensure_invoice(
  p_quote_version_id uuid,
  p_actor text
)
returns table (
  quote_version_id uuid,
  invoice_id uuid,
  invoice_created boolean,
  already_accepted boolean
)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_version public.quote_versions%rowtype;
  v_quote public.quotes%rowtype;
  v_project public.projects%rowtype;
  v_invoice_id uuid;
  v_existing boolean;
begin
  select version.* into strict v_version from public.quote_versions version
  where version.id = p_quote_version_id for update;
  v_existing := v_version.status = 'ACCEPTED';
  if not v_existing and v_version.status <> 'SENT' then
    raise exception 'Only sent quotes can be accepted' using errcode = '55000';
  end if;
  update public.quote_versions set status = 'ACCEPTED', accepted_at = coalesce(accepted_at, now())
  where id = p_quote_version_id;
  select quote.* into strict v_quote from public.quotes quote where quote.id = v_version.quote_id;
  select project.* into strict v_project from public.projects project where project.id = v_quote.project_id;
  select invoice.id into v_invoice_id from public.deposit_invoices invoice
  where invoice.quote_version_id = v_version.id and invoice.status <> 'VOID' limit 1;
  if v_invoice_id is null then
    insert into public.deposit_invoices (
      project_id, quote_id, quote_version_id, quote_ref, quote_version_number,
      invoice_ref, status, customer_name, project_name, project_address,
      quote_total_inc_gst_cents, total_inc_gst_cents, total_ex_gst_cents,
      gst_cents, created_by, payment_term_id, payment_term_label
    ) values (
      v_project.id, v_quote.id, v_version.id, v_quote.quote_ref, v_version.version_number,
      public.next_deposit_invoice_ref(), 'OPEN', v_version.customer_name,
      v_project.name, v_project.site_address, v_version.total_inc_gst_cents,
      v_version.total_inc_gst_cents, v_version.total_ex_gst_cents,
      v_version.gst_cents, p_actor, 'payment-1', 'Initial payment'
    ) returning id into v_invoice_id;
    return query select v_version.id, v_invoice_id, true, v_existing;
  else
    return query select v_version.id, v_invoice_id, false, v_existing;
  end if;
end;
$$;

create or replace function public.commercial_mark_invoice_paid_and_record_payment(
  p_invoice_id uuid,
  p_actor text,
  p_paid_at timestamptz,
  p_reference text,
  p_method text,
  p_note text
)
returns table (invoice_id uuid, payment_entry_id uuid)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_invoice public.deposit_invoices%rowtype;
  v_payment_id uuid;
begin
  select invoice.* into strict v_invoice from public.deposit_invoices invoice
  where invoice.id = p_invoice_id for update;
  if v_invoice.status = 'VOID' then
    raise exception 'Only open invoices can be marked paid' using errcode = '55000';
  end if;
  update public.deposit_invoices set status = 'PAID', paid_at = coalesce(p_paid_at, now()),
    paid_by = p_actor, payment_reference = p_reference, payment_method = p_method, payment_note = p_note
  where id = p_invoice_id;
  select entry.id into v_payment_id from public.project_payment_entries entry
  where entry.source_invoice_id = p_invoice_id and entry.entry_type = 'PAYMENT';
  if v_payment_id is null then
    insert into public.project_payment_entries (
      project_id, source_invoice_id, entry_type, amount_inc_gst_cents,
      occurred_at, reference, payment_method, note, created_by
    ) values (
      v_invoice.project_id, v_invoice.id, 'PAYMENT', v_invoice.total_inc_gst_cents,
      coalesce(p_paid_at, now()), p_reference, p_method, p_note, p_actor
    ) returning id into v_payment_id;
    insert into public.project_payment_allocations (
      project_id, payment_entry_id, quote_version_id, payment_term_id,
      amount_inc_gst_cents, change_reason, created_by
    ) values (
      v_invoice.project_id, v_payment_id, v_invoice.quote_version_id,
      v_invoice.payment_term_id, v_invoice.total_inc_gst_cents,
      'Applied when invoice was marked paid', p_actor
    );
  end if;
  return query select p_invoice_id, v_payment_id;
end;
$$;

create or replace function public.commercial_replace_payment_allocations(
  p_payment_entry_id uuid,
  p_allocations jsonb,
  p_reason text,
  p_actor text
)
returns integer
language sql
security definer
set search_path = pg_catalog, pg_temp
as $$ select 0 $$;

create or replace function public.commercial_reverse_payment_entry(
  p_payment_entry_id uuid,
  p_reason text,
  p_actor text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_payment public.project_payment_entries%rowtype;
  v_reversal_id uuid;
begin
  select entry.* into strict v_payment from public.project_payment_entries entry
  where entry.id = p_payment_entry_id for update;
  select entry.id into v_reversal_id from public.project_payment_entries entry
  where entry.reverses_entry_id = p_payment_entry_id;
  if v_reversal_id is not null then return v_reversal_id; end if;
  insert into public.project_payment_entries (
    project_id, entry_type, amount_inc_gst_cents, occurred_at,
    reason, reverses_entry_id, created_by
  ) values (
    v_payment.project_id, 'REVERSAL', -v_payment.amount_inc_gst_cents,
    now(), p_reason, v_payment.id, p_actor
  ) returning id into v_reversal_id;
  update public.project_payment_allocations set reversed_at = now(),
    reversed_by = p_actor, reversal_reason = p_reason
  where payment_entry_id = p_payment_entry_id and reversed_at is null;
  return v_reversal_id;
end;
$$;

create or replace function public.project_operational_state_command(
  p_project_id uuid,
  p_command_id uuid,
  p_command text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language sql
security definer
set search_path = pg_catalog, pg_temp
as $$ select jsonb_build_object('projectId', p_project_id, 'commandId', p_command_id, 'state', 'CLOSED') $$;

create or replace function public.commercial_create_admin_invoice(
  p_project_id uuid,
  p_quote_version_id uuid,
  p_mode text,
  p_payment_term_id text,
  p_amount_inc_gst_cents integer,
  p_split_count integer,
  p_label text,
  p_due_date date,
  p_reference text,
  p_payment_instructions text,
  p_allow_over_invoice boolean,
  p_override_reason text,
  p_actor text
)
returns table (
  invoice_id uuid,
  planned_item_count integer,
  remaining_before_inc_gst_cents integer,
  remaining_after_inc_gst_cents integer
)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_version public.quote_versions%rowtype;
  v_quote public.quotes%rowtype;
  v_project public.projects%rowtype;
  v_open integer;
  v_paid integer;
  v_remaining integer;
  v_amount integer;
  v_invoice_id uuid;
  v_term_id text;
begin
  select version.* into strict v_version from public.quote_versions version
  where version.id = p_quote_version_id for update;
  select quote.* into strict v_quote from public.quotes quote where quote.id = v_version.quote_id;
  select project.* into strict v_project from public.projects project where project.id = p_project_id;
  select coalesce(sum(invoice.total_inc_gst_cents), 0)::integer into v_open
  from public.deposit_invoices invoice where invoice.quote_version_id = v_version.id and invoice.status = 'OPEN';
  select coalesce(sum(allocation.amount_inc_gst_cents), 0)::integer into v_paid
  from public.project_payment_allocations allocation
  where allocation.quote_version_id = v_version.id and allocation.reversed_at is null;
  v_remaining := greatest(0, v_version.total_inc_gst_cents - v_open - v_paid);
  v_amount := case when p_mode = 'full_remaining' then v_remaining else p_amount_inc_gst_cents end;
  if v_amount is null or v_amount <= 0 then
    raise exception 'Invoice amount must be greater than zero' using errcode = '22023';
  end if;
  if v_amount > v_remaining and not coalesce(p_allow_over_invoice, false) then
    raise exception 'Invoice amount exceeds the remaining job balance' using errcode = '55000';
  end if;
  v_term_id := coalesce(nullif(trim(p_payment_term_id), ''), 'admin-' || gen_random_uuid()::text);
  insert into public.deposit_invoices (
    project_id, quote_id, quote_version_id, quote_ref, quote_version_number,
    invoice_ref, status, due_date, reference, customer_name, project_name,
    project_address, quote_total_inc_gst_cents, total_inc_gst_cents,
    total_ex_gst_cents, gst_cents, payment_instructions, created_by,
    payment_term_id, payment_term_label, creation_mode, creation_override_reason
  ) values (
    p_project_id, v_quote.id, v_version.id, v_quote.quote_ref, v_version.version_number,
    public.next_deposit_invoice_ref(), 'OPEN', coalesce(p_due_date, current_date + 7),
    p_reference, v_version.customer_name, v_project.name, v_project.site_address,
    v_version.total_inc_gst_cents, v_amount, round(v_amount / 1.15)::integer,
    v_amount - round(v_amount / 1.15)::integer, p_payment_instructions, p_actor,
    v_term_id, p_label, p_mode,
    case when v_amount > v_remaining then p_override_reason else null end
  ) returning id into v_invoice_id;
  insert into public.audit_events (project_id, type, idempotency_key, payload)
  values (
    p_project_id, 'invoice.created', 'invoice.created:' || v_invoice_id::text,
    jsonb_build_object('invoiceId', v_invoice_id, 'quoteVersionId', v_version.id)
  );
  return query select v_invoice_id, 0, v_remaining, greatest(0, v_remaining - v_amount);
end;
$$;

grant execute on function public.commercial_accept_quote_and_ensure_invoice(uuid, text) to service_role;
grant execute on function public.commercial_mark_invoice_paid_and_record_payment(uuid, text, timestamptz, text, text, text) to service_role;
grant execute on function public.commercial_replace_payment_allocations(uuid, jsonb, text, text) to service_role;
grant execute on function public.commercial_reverse_payment_entry(uuid, text, text) to service_role;

