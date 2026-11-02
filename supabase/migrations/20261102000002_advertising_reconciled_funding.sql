-- Preserve genuine frozen first-instalment allocations missing legacy plan metadata.
create or replace function private.marketing_verified_deposit_facts(p_project uuid, p_quote uuid)
returns table(quote_id uuid,quote_version_id uuid,invoice_id uuid,payment_entry_id uuid,occurred_at timestamptz,value_cents integer)
language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 with accepted as (
   select a.* from public.commercial_current_accepted_quote_versions(p_project) a
   where a.total_inc_gst_cents>0 and (p_quote is null or a.quote_id=p_quote)
 ), candidates as (
   -- Issued invoice identity is immutable, but economic ownership can change.
   -- Only its effective family's unallocated residual belongs to that family;
   -- explicit quoted allocations below follow their permitted target instead.
   select a.quote_id,a.quote_version_id,i.id invoice_id,e.id payment_entry_id,e.occurred_at,a.total_inc_gst_cents
   from accepted a join public.deposit_invoices i on public.commercial_invoice_effective_quote(i.id)=a.quote_id and i.project_id=p_project
   join public.project_payment_entries e on e.source_invoice_id=i.id and e.project_id=p_project
   where i.status='PAID' and i.payment_term_position=1 and i.currency='NZD' and i.total_inc_gst_cents>0
     and e.entry_type='PAYMENT' and e.amount_inc_gst_cents>0
     and e.amount_inc_gst_cents>coalesce((select sum(allocation.amount_inc_gst_cents)
       from public.project_payment_allocations allocation where allocation.payment_entry_id=e.id
         and allocation.reversed_at is null and allocation.quote_version_id is not null),0)
   union all
   select a.quote_id,a.quote_version_id,i.id,e.id,e.occurred_at,a.total_inc_gst_cents
   from accepted a join public.deposit_invoices i on public.commercial_invoice_effective_quote(i.id)=a.quote_id and i.project_id=p_project
   join public.xero_deposit_matches m on m.invoice_id=i.id and m.project_id=p_project and m.reversed_at is null
   join public.project_payment_entries e on e.id=m.payment_entry_id and e.project_id=p_project
   where i.status<>'VOID' and i.payment_term_position=1 and i.currency='NZD' and i.total_inc_gst_cents>0
     and e.entry_type='PAYMENT' and e.amount_inc_gst_cents=m.amount_inc_gst_cents and m.amount_inc_gst_cents>0
     and e.amount_inc_gst_cents>coalesce((select sum(allocation.amount_inc_gst_cents)
       from public.project_payment_allocations allocation where allocation.payment_entry_id=e.id
         and allocation.reversed_at is null and allocation.quote_version_id is not null),0)
   union all
   select a.quote_id,a.quote_version_id,owned_invoice.id,e.id,e.occurred_at,a.total_inc_gst_cents
   from accepted a join public.quote_versions v on v.quote_id=a.quote_id
   join public.project_payment_allocations allocation on allocation.quote_version_id=v.id and allocation.project_id=p_project
   join public.project_payment_entries e on e.id=allocation.payment_entry_id and e.project_id=p_project
   left join lateral(select m.invoice_id from public.xero_deposit_matches m where m.payment_entry_id=e.id
     and m.reversed_at is null order by m.approved_at desc limit 1) matched on true
   left join public.deposit_invoices owned_invoice on owned_invoice.id=coalesce(e.source_invoice_id,matched.invoice_id)
   left join public.commercial_invoice_scope_assignments ownership on ownership.invoice_id=owned_invoice.id
   where allocation.reversed_at is null and allocation.standalone_invoice_id is null and allocation.amount_inc_gst_cents>0
     and e.entry_type='PAYMENT' and e.amount_inc_gst_cents>0
     and coalesce(ownership.treatment,'NATIVE')<>'SEPARATE_CHARGE'
     and (owned_invoice.id is null or owned_invoice.currency='NZD')
     and (allocation.payment_term_id=v.payment_terms->0->>'id' or exists(
       select 1 from public.project_invoice_plan_items plan where plan.quote_version_id=v.id
         and plan.payment_term_id=allocation.payment_term_id and plan.position=1 and plan.cancelled_at is null)
       -- Issued administrative first terms can predate the stored schedule/plan.
       -- The same invoice/version/family must substantiate that frozen term;
       -- a matching free-form term on a different family's allocation cannot.
       or (owned_invoice.quote_version_id=v.id and owned_invoice.payment_term_id=allocation.payment_term_id
         and owned_invoice.payment_term_position=1 and owned_invoice.status<>'VOID'
         and owned_invoice.total_inc_gst_cents>0
         and public.commercial_invoice_effective_quote(owned_invoice.id)=a.quote_id))
     and not exists(select 1 from public.deposit_invoices i where i.quote_version_id=v.id
       and i.payment_term_id=allocation.payment_term_id and i.status<>'VOID' and i.currency<>'NZD')
 )
 select distinct on(c.quote_id) c.quote_id,c.quote_version_id,c.invoice_id,c.payment_entry_id,c.occurred_at,c.total_inc_gst_cents
 from candidates c
 where c.occurred_at<=clock_timestamp()+interval '5 minutes'
   and not exists(select 1 from public.project_payment_entries reversal where reversal.reverses_entry_id=c.payment_entry_id)
 order by c.quote_id,c.occurred_at,c.payment_entry_id,c.invoice_id nulls last
$$;

-- Current reconciled funding, shared by the existing Google and Meta projections.
-- Read-only replacement: no history rewrite, enqueue, policy or authority change.
create or replace function private.advertising_scope_facts() returns table(quote_id uuid,project_id uuid,facts jsonb)
language sql stable security definer set search_path=pg_catalog,pg_temp as $$
  with accepted as materialized (
    select p.id project_id,a.* from public.projects p
    cross join lateral public.commercial_current_accepted_quote_versions(p.id) a
  ), verified as materialized (
    -- Evaluate the existing receipt owner once per accepted project, not once
    -- per quote or provider. It follows effective invoice and allocation ownership.
    select p.project_id,f.quote_id,f.occurred_at
    from (select distinct project_id from accepted) p
    cross join lateral private.marketing_verified_deposit_facts(p.project_id,null) f
  ), facts as (
    select q.id quote_id,q.project_id,a.total_inc_gst_cents,
      e.id receipt_id,e.created_at received_at,e.raw_payload,v.occurred_at,
      exists(select 1 from public.project_operational_states s where s.project_id=q.project_id
        and s.state='CLOSED' and s.closed_outcome='CANCELLED') cancelled
    from public.quotes q left join accepted a on a.quote_id=q.id
    left join verified v on v.quote_id=q.id and v.project_id=q.project_id
    left join lateral (select r.* from public.enquiry_requests r where r.project_id=q.project_id
      and not private.marketing_test_enquiry(r.id,r.project_id) order by r.created_at,r.id limit 1) e on true
    where not private.marketing_test_project(q.project_id)
  ) select f.quote_id,f.project_id,to_jsonb(f) from facts f
$$;
