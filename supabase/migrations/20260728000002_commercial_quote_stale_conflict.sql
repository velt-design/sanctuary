-- Keep application-level quote revision conflicts out of PostgreSQL's
-- serialization-failure class. Infrastructure may retry SQLSTATE 40001,
-- turning an immediate stale-write response into a long-running 500.

create or replace function public.commercial_quote_update_draft(
  p_quote_version_id uuid,
  p_expected_commercial_revision bigint,
  p_reference text,
  p_intro_text text,
  p_terms_text text,
  p_deposit_percent numeric,
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
begin
  if p_expected_commercial_revision is null
     or p_expected_commercial_revision < 1 then
    raise exception 'quote commercial revision is required'
      using errcode = '22023';
  end if;
  if jsonb_typeof(p_line_items) is distinct from 'array'
     or jsonb_array_length(p_line_items) = 0 then
    raise exception 'quote line items are required' using errcode = '22023';
  end if;

  select version.*
  into strict v_current
  from public.quote_versions version
  where version.id = p_quote_version_id
  for update;

  if v_current.status <> 'DRAFT' or not v_current.is_current_draft then
    raise exception 'Quote is locked' using errcode = '55000';
  end if;
  if v_current.commercial_revision is distinct from p_expected_commercial_revision then
    raise exception 'QUOTE_STALE' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.deposit_invoices invoice
    where invoice.quote_version_id = p_quote_version_id
  ) or exists (
    select 1 from public.job_pack_generations generation
    where generation.quote_version_id = p_quote_version_id
  ) then
    raise exception 'Quote is locked' using errcode = '55000';
  end if;

  update public.quote_versions
  set
    reference = p_reference,
    intro_text = p_intro_text,
    terms_text = p_terms_text,
    deposit_percent = p_deposit_percent,
    expires_at = p_expires_at,
    source_estimate_version_id = p_source_estimate_version_id,
    total_inc_gst_cents = p_total_inc_gst_cents,
    total_ex_gst_cents = p_total_ex_gst_cents,
    gst_cents = p_gst_cents,
    pricing_source = p_pricing_source,
    pricing_source_metadata = coalesce(p_pricing_source_metadata, '{}'::jsonb),
    commercial_revision = commercial_revision + 1,
    pdf_file_id = null,
    render_hash = null,
    preview_base_payload = null,
    preview_rendered_at = null
  where id = p_quote_version_id
  returning * into v_updated;

  delete from public.quote_line_items
  where quote_version_id = p_quote_version_id;

  insert into public.quote_line_items (
    quote_version_id,
    sort_order,
    description,
    qty,
    unit_price_inc_gst_cents,
    line_total_inc_gst_cents
  )
  select
    p_quote_version_id,
    item.sort_order,
    item.description,
    item.qty,
    item.unit_price_inc_gst_cents,
    item.line_total_inc_gst_cents
  from jsonb_to_recordset(p_line_items) as item(
    sort_order integer,
    description text,
    qty numeric,
    unit_price_inc_gst_cents integer,
    line_total_inc_gst_cents integer
  );

  return v_updated;
end;
$$;

