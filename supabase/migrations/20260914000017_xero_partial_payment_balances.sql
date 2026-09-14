begin;
create or replace function public.commercial_project_financial_truth(
  p_project_id uuid
)
returns table (
  accepted_total_inc_gst_cents integer,
  paid_inc_gst_cents integer,
  open_invoice_inc_gst_cents integer,
  remaining_to_invoice_inc_gst_cents integer,
  over_committed_inc_gst_cents integer,
  latest_payment_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_accepted integer;
  v_paid integer;
  v_open integer;
  v_latest_payment_at timestamptz;
begin
  if auth.role() <> 'service_role' and not public.has_portal_access() then
    raise exception 'staff access required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.projects project where project.id = p_project_id) then
    raise exception 'Project not found' using errcode = 'P0002';
  end if;

  select coalesce(sum(current_version.total_inc_gst_cents), 0)::integer
  into v_accepted
  from public.commercial_current_accepted_quote_versions(p_project_id) current_version;

  select coalesce(sum(entry.amount_inc_gst_cents), 0)::integer,
    max(entry.occurred_at)
  into v_paid, v_latest_payment_at
  from public.project_payment_entries entry
  where entry.project_id = p_project_id;

  select coalesce(sum(greatest(0,invoice.total_inc_gst_cents-coalesce(
    (select sum(m.amount_inc_gst_cents) from public.xero_deposit_matches m
      where m.invoice_id=invoice.id and m.reversed_at is null),0))),0)::integer
  into v_open
  from public.deposit_invoices invoice
  where invoice.project_id = p_project_id and invoice.status = 'OPEN';

  -- The existing total is the settlement denominator for legacy readers.
  -- New presentation uses commercial_project_value_breakdown for its components.
  select v_accepted + coalesce(sum(i.total_inc_gst_cents),0)::integer into v_accepted
  from public.deposit_invoices i where i.project_id = p_project_id
    and i.invoice_kind = 'STANDALONE' and i.status in ('OPEN','PAID');

  return query select
    v_accepted,
    v_paid,
    v_open,
    greatest(0, v_accepted - v_paid - v_open),
    greatest(0, v_paid + v_open - v_accepted),
    v_latest_payment_at;
end;
$$;

-- Matched money is reserved for its reviewed invoice, even while partial.
-- Full quote settlement may allocate it to that exact invoice; corrections use
-- the existing reversal owner instead of moving the money elsewhere.
do $patch$
declare v_definition text; v_anchor text := '  if jsonb_typeof(coalesce(p_allocations, ''[]''::jsonb)) <> ''array'' then';
begin
  v_definition:=replace(pg_get_functiondef('public.commercial_replace_payment_allocations(uuid,jsonb,text,text)'::regprocedure),chr(13),'');
  if strpos(v_definition,v_anchor)=0 then raise exception 'Payment allocation owner changed; review migration'; end if;
  v_definition:=replace(v_definition,v_anchor,
    '  if exists(select 1 from public.xero_deposit_matches where payment_entry_id=p_payment_entry_id and reversed_at is null)
      and not exists(select 1 from public.xero_deposit_matches m join public.deposit_invoices i on i.id=m.invoice_id
        where m.payment_entry_id=p_payment_entry_id and m.reversed_at is null and i.status=''PAID'' and i.invoice_kind=''QUOTE_LINKED''
          and p_allocations=jsonb_build_array(jsonb_build_object(''quote_version_id'',i.quote_version_id,
            ''payment_term_id'',i.payment_term_id,''amount_inc_gst_cents'',m.amount_inc_gst_cents))
          and i.total_inc_gst_cents=(select sum(x.amount_inc_gst_cents) from public.xero_deposit_matches x where x.invoice_id=i.id and x.reversed_at is null)) then
      raise exception ''Matched payment is reserved for its invoice; reverse the match to correct it'' using errcode=''55000'';
    end if;
' || v_anchor);
  execute v_definition;
end;
$patch$;

notify pgrst,'reload schema';
commit;
