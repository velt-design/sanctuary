-- Admin-created manual quotes have truthful provenance and do not require a synthetic estimate.

alter table public.quote_versions
  alter column source_estimate_version_id drop not null;

alter table public.quote_versions
  drop constraint if exists quote_versions_pricing_source_check;

alter table public.quote_versions
  add constraint quote_versions_pricing_source_check
  check (
    pricing_source is null
    or pricing_source in ('calculator_live', 'workbench_solved', 'manual')
  );

alter table public.quote_versions
  drop constraint if exists quote_versions_source_consistency_check;

alter table public.quote_versions
  add constraint quote_versions_source_consistency_check
  check (
    (pricing_source = 'manual' and source_estimate_version_id is null)
    or (pricing_source is distinct from 'manual' and source_estimate_version_id is not null)
  );

comment on column public.quote_versions.source_estimate_version_id is
  'Source estimate for estimate-backed quotes; null only when pricing_source is manual.';

create or replace function public.commercial_quote_create_draft(
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
  if (p_pricing_source = 'manual' and p_source_estimate_version_id is not null)
     or (p_pricing_source is distinct from 'manual' and p_source_estimate_version_id is null) then
    raise exception 'quote pricing source and estimate provenance do not match' using errcode = '22023';
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
    if v_existing.source_estimate_version_id is distinct from p_source_estimate_version_id then
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

notify pgrst, 'reload schema';
