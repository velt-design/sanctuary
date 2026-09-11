-- Invoice-owned drafts. All commands authenticate the administrator again in
-- the database; expected revisions make lost updates explicit.
begin;

create or replace function public.commercial_invoice_quote_items(p_quote_version_id uuid)
returns jsonb language sql stable security definer set search_path = pg_catalog, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', item.id, 'description', item.description, 'qty', item.qty,
    'unitPriceIncGstCents', item.unit_price_inc_gst_cents,
    'lineTotalIncGstCents', item.line_total_inc_gst_cents
  ) order by item.sort_order, item.id), '[]'::jsonb)
  from public.quote_line_items item where item.quote_version_id = p_quote_version_id
$$;

create or replace function public.commercial_invoice_validate_content(
  p_kind text, p_snapshot jsonb, p_source_items jsonb
) returns integer language plpgsql set search_path = pg_catalog, pg_temp as $$
declare
  v_item jsonb; v_source jsonb; v_total bigint := 0; v_line bigint;
  v_qty numeric; v_unit bigint; v_index integer := 0;
begin
  if jsonb_typeof(p_snapshot) is distinct from 'object'
    or p_snapshot->'version' is distinct from '1'::jsonb
    or jsonb_typeof(p_snapshot->'items') is distinct from 'array'
    or jsonb_array_length(p_snapshot->'items') not between 1 and 200 then
    raise exception 'Invoice requires between 1 and 200 items' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(array['billingName','billingEmail','billingAddress','notes']) field
    where jsonb_typeof(p_snapshot->field) is distinct from 'string') then
    raise exception 'Billing details and notes must be text' using errcode = '22023';
  end if;
  if p_kind = 'QUOTE_LINKED' and jsonb_array_length(p_snapshot->'items') <> jsonb_array_length(p_source_items) then
    raise exception 'Quoted items cannot be added or removed' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p_snapshot->'items') item
    group by item->>'id' having count(*) > 1 or coalesce(length(item->>'id'),0) not between 1 and 128) then
    raise exception 'Invoice item identifiers must be present and unique' using errcode = '22023';
  end if;
  for v_item in select value from jsonb_array_elements(p_snapshot->'items') loop
    if jsonb_typeof(v_item->'id') is distinct from 'string' or jsonb_typeof(v_item->'description') is distinct from 'string'
      or jsonb_typeof(v_item->'qty') is distinct from 'number' or jsonb_typeof(v_item->'unitPriceIncGstCents') is distinct from 'number'
      or jsonb_typeof(v_item->'lineTotalIncGstCents') is distinct from 'number' then
      raise exception 'Invoice items require text identifiers/descriptions and numeric quantities/prices' using errcode = '22023';
    end if;
    if coalesce(length(btrim(v_item->>'description')), 0) not between 1 and 2000 then
      raise exception 'Each item requires a description of at most 2000 characters' using errcode = '22023';
    end if;
    v_qty := (v_item->>'qty')::numeric;
    v_unit := (v_item->>'unitPriceIncGstCents')::bigint;
    v_line := (v_item->>'lineTotalIncGstCents')::bigint;
    if v_qty is null or v_qty <= 0 or v_qty > 1000000 or v_unit is null or v_unit < 0
      or v_unit > 2147483647 or v_line is null or v_line <> round(v_qty * v_unit)
      or (v_item->>'unitPriceIncGstCents')::numeric <> v_unit
      or (v_item->>'lineTotalIncGstCents')::numeric <> v_line then
      raise exception 'Invoice item quantity, price or rounded total is invalid' using errcode = '22023';
    end if;
    if p_kind = 'QUOTE_LINKED' then
      v_source := p_source_items->v_index;
      if (v_item - 'description') is distinct from (v_source - 'description') then
        raise exception 'Quoted quantities, prices, order and scope are fixed' using errcode = '22023';
      end if;
    end if;
    v_index := v_index + 1;
    v_total := v_total + v_line;
  end loop;
  if v_total <= 0 or v_total > 2147483647 then
    raise exception 'Invoice item total must be positive and within the supported range' using errcode = '22023';
  end if;
  if coalesce(length(btrim(p_snapshot->>'billingName')),0) not between 1 and 240
    or coalesce(length(p_snapshot->>'billingEmail'),0) > 320
    or coalesce(length(p_snapshot->>'billingAddress'),0) > 2000
    or coalesce(length(p_snapshot->>'notes'),0) > 5000 then
    raise exception 'Billing name is required and billing details must fit the supported lengths' using errcode = '22023';
  end if;
  return v_total::integer;
end;
$$;

create or replace function public.commercial_invoice_save_draft(
  p_invoice_id uuid, p_project_id uuid, p_expected_revision bigint,
  p_quote_version_id uuid, p_snapshot jsonb, p_options jsonb
) returns public.deposit_invoices language plpgsql security definer
set search_path = pg_catalog, pg_temp as $$
declare
  v_existing public.deposit_invoices%rowtype; v_version public.quote_versions%rowtype;
  v_quote public.quotes%rowtype; v_project public.projects%rowtype;
  v_items jsonb; v_snapshot jsonb; v_kind text; v_total integer; v_amount integer; v_due date;
begin
  if auth.uid() is null or not public.has_portal_access() or not public.is_portal_admin() then
    raise exception 'Admin authentication is required' using errcode = '42501';
  end if;
  if p_invoice_id is null or p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'Draft identifier and expected revision are required' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('invoice-draft:' || p_invoice_id::text, 0));
  select * into strict v_project from public.projects where id = p_project_id;
  if v_project.archived_at is not null then raise exception 'Restore the project before creating invoices' using errcode = '55000'; end if;
  select * into v_existing from public.deposit_invoices where id = p_invoice_id for update;
  if found and (v_existing.project_id <> p_project_id or v_existing.status <> 'DRAFT'
    or v_existing.draft_revision <> p_expected_revision
    or v_existing.quote_version_id is distinct from p_quote_version_id) then
    raise exception 'Draft changed; reload before saving' using errcode = '40001';
  elsif not found and p_expected_revision <> 0 then
    raise exception 'Draft no longer exists' using errcode = '40001';
  end if;
  v_kind := case when p_quote_version_id is null then 'STANDALONE' else 'QUOTE_LINKED' end;
  if v_kind = 'QUOTE_LINKED' then
    select * into strict v_version from public.quote_versions where id = p_quote_version_id;
    select * into strict v_quote from public.quotes where id = v_version.quote_id and project_id = p_project_id;
    if not exists (select 1 from public.commercial_current_accepted_quote_versions(p_project_id) c
      where c.quote_version_id = p_quote_version_id) then
      raise exception 'Only the current accepted quote version can be invoiced' using errcode = '55000';
    end if;
    v_items := public.commercial_invoice_quote_items(p_quote_version_id);
  end if;
  v_snapshot := p_snapshot;
  if v_snapshot is null and v_kind = 'QUOTE_LINKED' then
    v_snapshot := jsonb_build_object('version',1,'items',v_items,'billingName',v_version.customer_name,
      'billingEmail',coalesce((select email from public.contacts where id = v_project.contact_id),''),
      'billingAddress','','notes','');
  end if;
  v_total := public.commercial_invoice_validate_content(v_kind, v_snapshot, v_items);
  if v_kind = 'QUOTE_LINKED' and v_total <> v_version.total_inc_gst_cents then
    raise exception 'Quoted items do not reconcile with accepted scope' using errcode = '55000';
  end if;
  if jsonb_typeof(p_options) is distinct from 'object'
    or jsonb_typeof(p_options->'label') is distinct from 'string'
    or coalesce(p_options->>'mode','') not in ('next_stage','full_remaining','custom','split')
    or coalesce(length(btrim(p_options->>'label')),0) not between 2 and 240
    or coalesce(length(p_options->>'reference'),0) > 240 then
    raise exception 'Invoice mode, label and reference are invalid' using errcode = '22023';
  end if;
  if p_options->>'amountIncGstCents' is not null and
    (p_options->>'amountIncGstCents')::numeric <> (p_options->>'amountIncGstCents')::integer then
    raise exception 'Invoice payment amount must use whole cents' using errcode = '22023';
  end if;
  if coalesce(p_options->>'dueDate','') !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'Due date must be YYYY-MM-DD' using errcode = '22023';
  end if;
  v_due := (p_options->>'dueDate')::date;
  if v_due is null then raise exception 'Due date is required' using errcode = '22023'; end if;
  v_amount := case when v_kind = 'STANDALONE' then v_total else coalesce((p_options->>'amountIncGstCents')::integer,0) end;
  if v_amount < 0 then raise exception 'Invoice amount cannot be negative' using errcode = '22023'; end if;
  -- Amounts here are draft previews only. Issuance recomputes stage/split amounts
  -- and rechecks scope availability under the existing project billing lock.
  insert into public.deposit_invoices (
    id, project_id, quote_id, quote_version_id, quote_ref, quote_version_number,
    invoice_ref, status, issue_date, due_date, customer_name, project_name, project_address,
    currency, deposit_percent, quote_total_inc_gst_cents, total_inc_gst_cents,
    total_ex_gst_cents, gst_cents, payment_term_id, payment_term_label,
    payment_term_position, payment_term_count, payment_term_calculation,
    invoice_kind, content_snapshot, draft_revision, draft_options, reference, created_by
  ) values (
    p_invoice_id,p_project_id,v_quote.id,p_quote_version_id,v_quote.quote_ref,v_version.version_number,
    null,'DRAFT',null,v_due,v_snapshot->>'billingName',v_project.name,v_project.site_address,
    'NZD',0,case when v_kind = 'QUOTE_LINKED' then v_total else 0 end,v_amount,
    round(v_amount / 1.15)::integer,v_amount - round(v_amount / 1.15)::integer,
    coalesce(p_options->>'paymentTermId','draft-' || p_invoice_id::text),p_options->>'label',1,1,'fixed',
    v_kind,v_snapshot,1,p_options,p_options->>'reference',auth.uid()::text
  ) on conflict (id) do update set
    content_snapshot = excluded.content_snapshot, draft_options = excluded.draft_options,
    draft_revision = public.deposit_invoices.draft_revision + 1,
    customer_name = excluded.customer_name, due_date = excluded.due_date, reference = excluded.reference,
    total_inc_gst_cents = excluded.total_inc_gst_cents, total_ex_gst_cents = excluded.total_ex_gst_cents,
    gst_cents = excluded.gst_cents, payment_term_label = excluded.payment_term_label,
    payment_term_id = excluded.payment_term_id
  returning * into v_existing;
  insert into public.audit_events(project_id,type,idempotency_key,payload) values (
    p_project_id,'invoice.draft_saved','invoice.draft_saved:' || p_invoice_id::text || ':' || v_existing.draft_revision::text,
    jsonb_build_object('invoiceId',p_invoice_id,'revision',v_existing.draft_revision,'actor',auth.uid()));
  return v_existing;
end;
$$;

create or replace function public.commercial_invoice_delete_draft(p_invoice_id uuid, p_expected_revision bigint)
returns void language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
declare v_project_id uuid;
begin
  if auth.uid() is null or not public.has_portal_access() or not public.is_portal_admin() then
    raise exception 'Admin authentication is required' using errcode = '42501';
  end if;
  delete from public.deposit_invoices where id = p_invoice_id and status = 'DRAFT'
    and draft_revision = p_expected_revision returning project_id into v_project_id;
  if not found then raise exception 'Draft changed; reload before deleting' using errcode = '40001'; end if;
  insert into public.audit_events(project_id,type,idempotency_key,payload) values (
    v_project_id,'invoice.draft_deleted','invoice.draft_deleted:' || p_invoice_id::text,
    jsonb_build_object('invoiceId',p_invoice_id,'revision',p_expected_revision,'actor',auth.uid()));
end;
$$;

revoke all on function public.commercial_invoice_quote_items(uuid) from public, anon, authenticated;
revoke all on function public.commercial_invoice_validate_content(text,jsonb,jsonb) from public, anon, authenticated;
revoke all on function public.commercial_invoice_save_draft(uuid,uuid,bigint,uuid,jsonb,jsonb) from public, anon;
revoke all on function public.commercial_invoice_delete_draft(uuid,bigint) from public, anon;
grant execute on function public.commercial_invoice_save_draft(uuid,uuid,bigint,uuid,jsonb,jsonb) to authenticated;
grant execute on function public.commercial_invoice_delete_draft(uuid,bigint) to authenticated;

notify pgrst, 'reload schema';
commit;
