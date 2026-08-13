-- Make admin-created invoices and append-only payment entries safe to retry
-- after a lost browser response. The client intent is scoped to one project.

alter table public.project_payment_entries
  add column if not exists client_intent_id text;

create unique index if not exists project_payment_entries_client_intent_unique
  on public.project_payment_entries (project_id, client_intent_id)
  where client_intent_id is not null;

alter table public.deposit_invoices
  add column if not exists admin_client_intent_id text,
  add column if not exists admin_creation_planned_item_count integer,
  add column if not exists admin_creation_remaining_before_inc_gst_cents integer,
  add column if not exists admin_creation_remaining_after_inc_gst_cents integer;

create unique index if not exists deposit_invoices_admin_client_intent_unique
  on public.deposit_invoices (project_id, admin_client_intent_id)
  where admin_client_intent_id is not null;

create function public.commercial_record_project_payment_entry(
  p_project_id uuid,
  p_entry_type text,
  p_amount_inc_gst_cents integer,
  p_occurred_at timestamptz,
  p_payment_method text,
  p_reference text,
  p_note text,
  p_reason text,
  p_actor text,
  p_client_intent_id text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_id uuid;
  v_net_paid integer;
  v_allocated integer;
begin
  if p_client_intent_id is null or length(trim(p_client_intent_id)) < 8
    or length(trim(p_client_intent_id)) > 128 then
    raise exception 'Payment client intent is invalid' using errcode = '22023';
  end if;
  if p_entry_type not in ('PAYMENT', 'ADJUSTMENT') then
    raise exception 'Payment type is invalid' using errcode = '22023';
  end if;
  if p_amount_inc_gst_cents is null or p_amount_inc_gst_cents = 0
    or (p_entry_type = 'PAYMENT' and p_amount_inc_gst_cents < 0) then
    raise exception 'Payment amount is invalid' using errcode = '22023';
  end if;
  if p_entry_type = 'ADJUSTMENT' and length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'An adjustment reason is required' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('commercial-project-invoice:' || p_project_id::text, 0));
  select entry.id into v_id
  from public.project_payment_entries entry
  where entry.project_id = p_project_id
    and entry.client_intent_id = trim(p_client_intent_id);
  if v_id is not null then return v_id; end if;

  select coalesce(sum(entry.amount_inc_gst_cents), 0)::integer into v_net_paid
  from public.project_payment_entries entry where entry.project_id = p_project_id;
  select coalesce(sum(allocation.amount_inc_gst_cents), 0)::integer into v_allocated
  from public.project_payment_allocations allocation
  where allocation.project_id = p_project_id and allocation.reversed_at is null;
  if v_net_paid + p_amount_inc_gst_cents < 0 then
    raise exception 'An adjustment cannot make the job paid balance negative' using errcode = '22023';
  end if;
  if v_net_paid + p_amount_inc_gst_cents < v_allocated then
    raise exception 'Reduce payment allocations before lowering the job paid balance' using errcode = '55000';
  end if;
  insert into public.project_payment_entries (
    project_id, entry_type, amount_inc_gst_cents, occurred_at,
    payment_method, reference, note, reason, created_by, client_intent_id
  ) values (
    p_project_id, p_entry_type, p_amount_inc_gst_cents, coalesce(p_occurred_at, now()),
    nullif(trim(p_payment_method), ''), nullif(trim(p_reference), ''),
    nullif(trim(p_note), ''), nullif(trim(p_reason), ''), p_actor,
    trim(p_client_intent_id)
  ) returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.commercial_record_project_payment_entry(
  uuid, text, integer, timestamptz, text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.commercial_record_project_payment_entry(
  uuid, text, integer, timestamptz, text, text, text, text, text, text
) to service_role;
revoke execute on function public.commercial_record_project_payment_entry(
  uuid, text, integer, timestamptz, text, text, text, text, text
) from service_role;

-- Add the client intent to the current add-on-aware invoice command without
-- duplicating the command body in application code.
create or replace function public.commercial_create_admin_invoice_idempotent(
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
  p_actor text,
  p_client_intent_id text
)
returns table (
  invoice_id uuid,
  planned_item_count integer,
  remaining_before_inc_gst_cents integer,
  remaining_after_inc_gst_cents integer,
  replayed boolean
)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_existing public.deposit_invoices%rowtype;
  v_created record;
begin
  if p_client_intent_id is null or length(trim(p_client_intent_id)) < 8
    or length(trim(p_client_intent_id)) > 128 then
    raise exception 'Invoice client intent is invalid' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('commercial-project-invoice:' || p_project_id::text, 0));
  select invoice.* into v_existing
  from public.deposit_invoices invoice
  where invoice.project_id = p_project_id
    and invoice.admin_client_intent_id = trim(p_client_intent_id);
  if found then
    return query select v_existing.id,
      coalesce(v_existing.admin_creation_planned_item_count, 0),
      coalesce(v_existing.admin_creation_remaining_before_inc_gst_cents, 0),
      coalesce(v_existing.admin_creation_remaining_after_inc_gst_cents, 0),
      true;
    return;
  end if;

  select * into v_created from public.commercial_create_admin_invoice(
    p_project_id, p_quote_version_id, p_mode, p_payment_term_id,
    p_amount_inc_gst_cents, p_split_count, p_label, p_due_date, p_reference,
    p_payment_instructions, p_allow_over_invoice, p_override_reason, p_actor
  );
  update public.deposit_invoices
  set admin_client_intent_id = trim(p_client_intent_id),
      admin_creation_planned_item_count = v_created.planned_item_count,
      admin_creation_remaining_before_inc_gst_cents = v_created.remaining_before_inc_gst_cents,
      admin_creation_remaining_after_inc_gst_cents = v_created.remaining_after_inc_gst_cents
  where id = v_created.invoice_id;
  return query select v_created.invoice_id, v_created.planned_item_count,
    v_created.remaining_before_inc_gst_cents, v_created.remaining_after_inc_gst_cents, false;
end;
$$;

revoke all on function public.commercial_create_admin_invoice_idempotent(
  uuid, uuid, text, text, integer, integer, text, date, text, text, boolean, text, text, text
) from public, anon, authenticated;
grant execute on function public.commercial_create_admin_invoice_idempotent(
  uuid, uuid, text, text, integer, integer, text, date, text, text, boolean, text, text, text
) to service_role;

notify pgrst, 'reload schema';
