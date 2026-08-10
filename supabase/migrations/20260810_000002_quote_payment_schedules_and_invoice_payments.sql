-- Frozen quote payment schedules and whole-invoice payment records.

alter table if exists public.quote_versions
  add column if not exists payment_terms jsonb;

update public.quote_versions
set payment_terms = case
  when deposit_percent <= 0 then jsonb_build_array(
    jsonb_build_object(
      'id', 'payment-1',
      'label', 'Final payment',
      'calculationType', 'percentage',
      'fixedAmountIncGstCents', null,
      'percentageOfRemainder', 100,
      'resolvedAmountIncGstCents', total_inc_gst_cents
    )
  )
  when deposit_percent >= 100 then jsonb_build_array(
    jsonb_build_object(
      'id', 'payment-1',
      'label', 'Initial payment',
      'calculationType', 'percentage',
      'fixedAmountIncGstCents', null,
      'percentageOfRemainder', 100,
      'resolvedAmountIncGstCents', total_inc_gst_cents
    )
  )
  else jsonb_build_array(
    jsonb_build_object(
      'id', 'payment-1',
      'label', 'Initial payment',
      'calculationType', 'percentage',
      'fixedAmountIncGstCents', null,
      'percentageOfRemainder', deposit_percent,
      'resolvedAmountIncGstCents', round(total_inc_gst_cents * deposit_percent / 100.0)::integer
    ),
    jsonb_build_object(
      'id', 'payment-2',
      'label', 'Final payment',
      'calculationType', 'percentage',
      'fixedAmountIncGstCents', null,
      'percentageOfRemainder', 100 - deposit_percent,
      'resolvedAmountIncGstCents', total_inc_gst_cents - round(total_inc_gst_cents * deposit_percent / 100.0)::integer
    )
  )
end
where payment_terms is null;

alter table if exists public.quote_versions
  alter column payment_terms set default '[]'::jsonb,
  alter column payment_terms set not null;

alter table if exists public.quote_versions
  drop constraint if exists quote_versions_payment_terms_array_check;
alter table if exists public.quote_versions
  add constraint quote_versions_payment_terms_array_check
  check (jsonb_typeof(payment_terms) = 'array' and jsonb_array_length(payment_terms) between 1 and 10);

alter table if exists public.deposit_invoices
  add column if not exists payment_term_id text,
  add column if not exists payment_term_label text,
  add column if not exists payment_term_position integer,
  add column if not exists payment_term_count integer,
  add column if not exists payment_term_calculation text,
  add column if not exists payment_term_percentage numeric(7,2),
  add column if not exists paid_at timestamptz,
  add column if not exists paid_by text,
  add column if not exists payment_reference text,
  add column if not exists payment_method text,
  add column if not exists payment_note text;

update public.deposit_invoices
set
  payment_term_id = coalesce(payment_term_id, 'payment-1'),
  payment_term_label = coalesce(payment_term_label, 'Initial payment'),
  payment_term_position = coalesce(payment_term_position, 1),
  payment_term_count = coalesce(payment_term_count, case when deposit_percent <= 0 or deposit_percent >= 100 then 1 else 2 end),
  payment_term_calculation = coalesce(payment_term_calculation, 'percentage'),
  payment_term_percentage = coalesce(payment_term_percentage, deposit_percent)
where payment_term_id is null
   or payment_term_label is null
   or payment_term_position is null
   or payment_term_count is null
   or payment_term_calculation is null;

alter table if exists public.deposit_invoices
  alter column payment_term_id set not null,
  alter column payment_term_label set not null,
  alter column payment_term_position set not null,
  alter column payment_term_count set not null,
  alter column payment_term_calculation set not null;

alter table if exists public.deposit_invoices
  drop constraint if exists deposit_invoices_status_check,
  drop constraint if exists deposit_invoices_payment_term_calculation_check,
  drop constraint if exists deposit_invoices_payment_term_position_check;
alter table if exists public.deposit_invoices
  add constraint deposit_invoices_status_check check (status in ('OPEN', 'PAID', 'VOID')),
  add constraint deposit_invoices_payment_term_calculation_check
    check (payment_term_calculation in ('fixed', 'percentage')),
  add constraint deposit_invoices_payment_term_position_check
    check (payment_term_position >= 1 and payment_term_position <= payment_term_count);

drop index if exists public.deposit_invoices_quote_version_open_unique;
create unique index if not exists deposit_invoices_quote_version_term_active_unique
  on public.deposit_invoices (quote_version_id, payment_term_id)
  where status <> 'VOID';

drop function if exists public.commercial_quote_create_draft(
  uuid, uuid, uuid, text, text, text, text, text, text, numeric, date,
  integer, integer, integer, text, jsonb, jsonb
);

create function public.commercial_quote_create_draft(
  p_quote_id uuid,
  p_source_estimate_version_id uuid,
  p_revised_from_quote_version_id uuid,
  p_client_intent_id text,
  p_actor text,
  p_customer_name text,
  p_reference text,
  p_intro_text text,
  p_terms_text text,
  p_deposit_percent numeric,
  p_payment_terms jsonb,
  p_expires_at date,
  p_total_inc_gst_cents integer,
  p_total_ex_gst_cents integer,
  p_gst_cents integer,
  p_pricing_source text,
  p_pricing_source_metadata jsonb,
  p_line_items jsonb
)
returns public.quote_versions
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_existing public.quote_versions%rowtype;
  v_created public.quote_versions%rowtype;
  v_version_number integer;
  v_allocated integer;
begin
  if p_client_intent_id is null or length(trim(p_client_intent_id)) < 8 or length(trim(p_client_intent_id)) > 128 then
    raise exception 'client intent ID is invalid' using errcode = '22023';
  end if;
  if jsonb_typeof(p_line_items) is distinct from 'array' or jsonb_array_length(p_line_items) = 0 then
    raise exception 'quote line items are required' using errcode = '22023';
  end if;
  if jsonb_typeof(p_payment_terms) is distinct from 'array' or jsonb_array_length(p_payment_terms) not between 1 and 10 then
    raise exception 'quote payment terms are required' using errcode = '22023';
  end if;
  select coalesce(sum((term->>'resolvedAmountIncGstCents')::integer), 0)
  into v_allocated from jsonb_array_elements(p_payment_terms) term;
  if v_allocated <> p_total_inc_gst_cents then
    raise exception 'quote payment terms do not reconcile to total' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('commercial-quote:' || p_quote_id::text, 0));
  select version.* into v_existing
  from public.quote_versions version
  where version.quote_id = p_quote_id and version.client_intent_id = trim(p_client_intent_id)
  for update;
  if found then
    if v_existing.source_estimate_version_id <> p_source_estimate_version_id then
      raise exception 'client intent already belongs to a different estimate' using errcode = '23505';
    end if;
    return v_existing;
  end if;

  update public.quote_versions set is_current_draft = false
  where quote_id = p_quote_id and status = 'DRAFT' and is_current_draft;
  select coalesce(max(version_number), 0) + 1 into v_version_number
  from public.quote_versions where quote_id = p_quote_id;

  insert into public.quote_versions (
    quote_id, version_number, status, source_estimate_version_id,
    revised_from_quote_version_id, created_by, customer_name, reference,
    intro_text, terms_text, deposit_percent, payment_terms, expires_at,
    total_inc_gst_cents, total_ex_gst_cents, gst_cents, pricing_source,
    pricing_source_metadata, client_intent_id, is_current_draft
  ) values (
    p_quote_id, v_version_number, 'DRAFT', p_source_estimate_version_id,
    p_revised_from_quote_version_id, p_actor, p_customer_name, p_reference,
    p_intro_text, p_terms_text, p_deposit_percent, p_payment_terms, p_expires_at,
    p_total_inc_gst_cents, p_total_ex_gst_cents, p_gst_cents, p_pricing_source,
    coalesce(p_pricing_source_metadata, '{}'::jsonb), trim(p_client_intent_id), true
  ) returning * into v_created;

  insert into public.quote_line_items (
    quote_version_id, sort_order, description, qty,
    unit_price_inc_gst_cents, line_total_inc_gst_cents
  )
  select v_created.id, item.sort_order, item.description, item.qty,
    item.unit_price_inc_gst_cents, item.line_total_inc_gst_cents
  from jsonb_to_recordset(p_line_items) as item(
    sort_order integer, description text, qty numeric,
    unit_price_inc_gst_cents integer, line_total_inc_gst_cents integer
  );
  return v_created;
end;
$$;

drop function if exists public.commercial_quote_update_draft(
  uuid, bigint, text, text, text, numeric, date, uuid,
  integer, integer, integer, text, jsonb, jsonb
);

create function public.commercial_quote_update_draft(
  p_quote_version_id uuid,
  p_expected_commercial_revision bigint,
  p_reference text,
  p_intro_text text,
  p_terms_text text,
  p_deposit_percent numeric,
  p_payment_terms jsonb,
  p_expires_at date,
  p_source_estimate_version_id uuid,
  p_total_inc_gst_cents integer,
  p_total_ex_gst_cents integer,
  p_gst_cents integer,
  p_pricing_source text,
  p_pricing_source_metadata jsonb,
  p_line_items jsonb
)
returns public.quote_versions
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_current public.quote_versions%rowtype;
  v_updated public.quote_versions%rowtype;
  v_allocated integer;
begin
  if p_expected_commercial_revision is null or p_expected_commercial_revision < 1 then
    raise exception 'quote commercial revision is required' using errcode = '22023';
  end if;
  if jsonb_typeof(p_line_items) is distinct from 'array' or jsonb_array_length(p_line_items) = 0 then
    raise exception 'quote line items are required' using errcode = '22023';
  end if;
  if jsonb_typeof(p_payment_terms) is distinct from 'array' or jsonb_array_length(p_payment_terms) not between 1 and 10 then
    raise exception 'quote payment terms are required' using errcode = '22023';
  end if;
  select coalesce(sum((term->>'resolvedAmountIncGstCents')::integer), 0)
  into v_allocated from jsonb_array_elements(p_payment_terms) term;
  if v_allocated <> p_total_inc_gst_cents then
    raise exception 'quote payment terms do not reconcile to total' using errcode = '22023';
  end if;

  select version.* into strict v_current
  from public.quote_versions version where version.id = p_quote_version_id for update;
  if v_current.status <> 'DRAFT' or not v_current.is_current_draft then
    raise exception 'Quote is locked' using errcode = '55000';
  end if;
  if v_current.commercial_revision is distinct from p_expected_commercial_revision then
    raise exception 'QUOTE_STALE' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.deposit_invoices where quote_version_id = p_quote_version_id)
     or exists (select 1 from public.job_pack_generations where quote_version_id = p_quote_version_id) then
    raise exception 'Quote is locked' using errcode = '55000';
  end if;

  update public.quote_versions set
    reference = p_reference, intro_text = p_intro_text, terms_text = p_terms_text,
    deposit_percent = p_deposit_percent, payment_terms = p_payment_terms,
    expires_at = p_expires_at, source_estimate_version_id = p_source_estimate_version_id,
    total_inc_gst_cents = p_total_inc_gst_cents,
    total_ex_gst_cents = p_total_ex_gst_cents, gst_cents = p_gst_cents,
    pricing_source = p_pricing_source,
    pricing_source_metadata = coalesce(p_pricing_source_metadata, '{}'::jsonb),
    commercial_revision = commercial_revision + 1, pdf_file_id = null,
    render_hash = null, preview_base_payload = null, preview_rendered_at = null
  where id = p_quote_version_id returning * into v_updated;

  delete from public.quote_line_items where quote_version_id = p_quote_version_id;
  insert into public.quote_line_items (
    quote_version_id, sort_order, description, qty,
    unit_price_inc_gst_cents, line_total_inc_gst_cents
  )
  select p_quote_version_id, item.sort_order, item.description, item.qty,
    item.unit_price_inc_gst_cents, item.line_total_inc_gst_cents
  from jsonb_to_recordset(p_line_items) as item(
    sort_order integer, description text, qty numeric,
    unit_price_inc_gst_cents integer, line_total_inc_gst_cents integer
  );
  return v_updated;
end;
$$;

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
  v_invoice public.deposit_invoices%rowtype;
  v_first_term jsonb;
  v_term_id text;
  v_term_label text;
  v_term_calculation text;
  v_term_percentage numeric;
  v_term_count integer;
  v_invoice_created boolean := false;
  v_already_accepted boolean := false;
  v_issue_date date := current_date;
  v_invoice_inc integer;
  v_invoice_ex integer;
  v_gst integer;
  v_compat_percent numeric;
begin
  perform pg_advisory_xact_lock(hashtextextended('commercial-accept:' || p_quote_version_id::text, 0));
  select version.* into strict v_version
  from public.quote_versions version where version.id = p_quote_version_id for update;

  if v_version.status = 'ACCEPTED' then
    v_already_accepted := true;
  elsif v_version.status <> 'SENT' then
    raise exception 'Only sent quotes can be accepted' using errcode = '55000';
  elsif v_version.expires_at is not null and v_version.expires_at < current_date then
    raise exception 'QUOTE_EXPIRED' using errcode = '55000';
  else
    update public.quote_versions set status = 'ACCEPTED',
      accepted_at = coalesce(accepted_at, now()), is_current_draft = false
    where id = p_quote_version_id returning * into v_version;
  end if;

  select * into strict v_quote from public.quotes where id = v_version.quote_id;
  select * into strict v_project from public.projects where id = v_quote.project_id;

  update public.deposit_invoices invoice set
    status = 'VOID', voided_at = coalesce(invoice.voided_at, now()),
    voided_by = p_actor,
    void_reason = coalesce(invoice.void_reason, 'Replaced after acceptance of quote version ' || v_version.version_number::text),
    portal_token_hash = null, portal_token_expires_at = null
  where invoice.quote_id = v_quote.id and invoice.quote_version_id <> v_version.id
    and invoice.status = 'OPEN';

  v_first_term := v_version.payment_terms->0;
  v_term_id := coalesce(nullif(trim(v_first_term->>'id'), ''), 'payment-1');
  v_term_label := coalesce(nullif(trim(v_first_term->>'label'), ''), 'Initial payment');
  v_term_calculation := coalesce(nullif(trim(v_first_term->>'calculationType'), ''), 'percentage');
  v_term_percentage := nullif(v_first_term->>'percentageOfRemainder', '')::numeric;
  v_term_count := jsonb_array_length(v_version.payment_terms);

  select invoice.* into v_invoice from public.deposit_invoices invoice
  where invoice.quote_version_id = v_version.id
    and invoice.payment_term_id = v_term_id and invoice.status <> 'VOID'
  order by invoice.created_at desc limit 1 for update;

  if not found then
    v_invoice_inc := (v_first_term->>'resolvedAmountIncGstCents')::integer;
    v_invoice_ex := round(v_invoice_inc / 1.15)::integer;
    v_gst := v_invoice_inc - v_invoice_ex;
    v_compat_percent := case when v_version.total_inc_gst_cents > 0
      then round(v_invoice_inc * 100.0 / v_version.total_inc_gst_cents, 2)
      else 0 end;

    insert into public.deposit_invoices (
      project_id, quote_id, quote_version_id, quote_ref, quote_version_number,
      invoice_ref, status, issue_date, due_date, reference, customer_name,
      project_name, project_address, currency, deposit_percent,
      quote_total_inc_gst_cents, total_inc_gst_cents, total_ex_gst_cents,
      gst_cents, payment_instructions, created_by, payment_term_id,
      payment_term_label, payment_term_position, payment_term_count,
      payment_term_calculation, payment_term_percentage
    ) values (
      v_project.id, v_quote.id, v_version.id, v_quote.quote_ref,
      v_version.version_number, public.next_deposit_invoice_ref(), 'OPEN',
      v_issue_date, v_issue_date + 7,
      v_term_label || ' for Quote ' || v_quote.quote_ref ||
        case when nullif(trim(v_project.name), '') is not null then ' - ' || trim(v_project.name) else '' end,
      v_version.customer_name, v_project.name, v_project.site_address, 'NZD',
      v_compat_percent, v_version.total_inc_gst_cents, v_invoice_inc,
      v_invoice_ex, v_gst,
      E'Please make payment directly to our bank account:\nSanctuary Pergolas Ltd.\nBank details: 06-0185-0845164-00\nPlease include invoice number',
      p_actor, v_term_id, v_term_label, 1, v_term_count,
      v_term_calculation, v_term_percentage
    ) returning * into v_invoice;
    v_invoice_created := true;
  end if;

  return query select v_version.id, v_invoice.id, v_invoice_created, v_already_accepted;
end;
$$;

revoke all on function public.commercial_quote_create_draft(
  uuid, uuid, uuid, text, text, text, text, text, text, numeric, jsonb,
  date, integer, integer, integer, text, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.commercial_quote_create_draft(
  uuid, uuid, uuid, text, text, text, text, text, text, numeric, jsonb,
  date, integer, integer, integer, text, jsonb, jsonb
) to service_role;

revoke all on function public.commercial_quote_update_draft(
  uuid, bigint, text, text, text, numeric, jsonb, date, uuid,
  integer, integer, integer, text, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.commercial_quote_update_draft(
  uuid, bigint, text, text, text, numeric, jsonb, date, uuid,
  integer, integer, integer, text, jsonb, jsonb
) to service_role;

revoke all on function public.commercial_accept_quote_and_ensure_invoice(uuid, text)
  from public, anon, authenticated;
grant execute on function public.commercial_accept_quote_and_ensure_invoice(uuid, text)
  to service_role;

notify pgrst, 'reload schema';
