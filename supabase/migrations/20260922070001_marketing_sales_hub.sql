-- Read-only exploration; no backfill, tracking changes or new outcome definitions.
create or replace function public.marketing_sales_hub_read(p_start date, p_end date)
returns jsonb language plpgsql stable security definer
set search_path = pg_catalog, pg_temp as $$
declare v_enquiries jsonb; v_result jsonb;
begin
  -- Reuse the verified-identity guard, receipt exclusions, dates and qualification owner.
  v_enquiries := public.marketing_performance_read(p_start,p_end);
  if (select count(*) from public.projects) > 5000 then
    raise exception 'Project portfolio exceeds reporting bound' using errcode='54000';
  end if;
  with projects as materialized (
    select p.*, e.id origin_id, e.created_at origin_at,
      case when e.raw_payload #>> '{attribution,consent,marketing}'='true'
        then nullif(btrim(coalesce(e.raw_payload #>> '{attribution,utm,utm_source}',e.utm->>'utm_source')),'') end source,
      case when e.raw_payload #>> '{attribution,consent,marketing}'='true'
        then nullif(btrim(coalesce(e.raw_payload #>> '{attribution,utm,utm_campaign}',e.utm->>'utm_campaign')),'') end campaign,
      o.owner_key, s.state, s.closed_outcome,
      (select count(*) from public.enquiry_requests r where r.project_id=p.id) receipt_count,
      (exists(select 1 from public.xero_deposit_matches m where m.project_id=p.id and m.reversed_at is null and m.amount_inc_gst_cents>0)
        or exists(select 1 from public.deposit_invoices i
          join public.commercial_current_accepted_quote_versions(p.id) a on a.quote_version_id=i.quote_version_id
          where i.project_id=p.id and i.status='PAID' and i.payment_term_position=1 and i.total_inc_gst_cents>0)) payment_verified
    from public.projects p
    left join lateral (select r.* from public.enquiry_requests r where r.project_id=p.id
      and r.id<>'f3229ccf-6a1a-4e1a-bcf4-2edf5cc85e70'::uuid order by r.created_at,r.id limit 1) e on true
    left join public.project_owner_assignments o on o.project_id=p.id
    left join public.project_operational_states s on s.project_id=p.id
  ), events as materialized (
    select 'sent:'||v.id id,q.project_id,'quote_sent' kind,
      (v.sent_at at time zone 'Pacific/Auckland')::date as event_day,v.status::text status,null::bigint amount
      from public.quote_versions v join public.quotes q on q.id=v.quote_id where v.sent_at is not null
    union all
    select 'accepted:'||v.id,q.project_id,'quote_accepted',
      (v.accepted_at at time zone 'Pacific/Auckland')::date,v.status::text,null::bigint
      from public.quote_versions v join public.quotes q on q.id=v.quote_id where v.accepted_at is not null
    union all
    select 'payment:'||e.id,e.project_id,lower(e.entry_type),
      (e.occurred_at at time zone 'Pacific/Auckland')::date,
      case when exists(select 1 from public.project_payment_entries r where r.reverses_entry_id=e.id) then 'REVERSED' else e.entry_type end,
      e.amount_inc_gst_cents::bigint from public.project_payment_entries e
    union all
    select 'invoice:'||i.id,i.project_id,'invoice_paid',(i.paid_at at time zone 'Pacific/Auckland')::date,i.status::text,null::bigint
      from public.deposit_invoices i where i.status='PAID' and i.paid_at is not null
  ), selected_events as materialized (
    select e.* from events e where e.event_day between p_start and p_end
      and e.project_id<>'10c5db1a-602c-4f0c-8193-855b186215bb'::uuid
    order by e.event_day desc,e.id limit 10001
  )
  select jsonb_build_object('schemaVersion',1,'asOf',current_timestamp,'start',p_start,'end',p_end,
    'enquiries',v_enquiries,
    'earliestReceipt',(select min(created_at) from public.enquiry_requests),
    'candidateEnquiryIds',coalesce((select jsonb_agg(e.id) from public.enquiry_requests e
      where e.id in (select (r->>'enquiryId')::uuid from jsonb_array_elements(v_enquiries->'rows') r)
      and (coalesce(e.raw_payload->>'name','') ~* '(^|[^a-z])(test|testing|qa)([^a-z]|$)'
        or coalesce(to_jsonb(e)->>'message','') ~* '(synthetic.*(test|verification)|PRODUCTION LIFECYCLE TRACKING QA)')),'[]'::jsonb),
    'projects',coalesce((select jsonb_agg(jsonb_build_object(
      'id',p.id,'name',p.name,'createdAt',p.created_at,'stage',p.pipeline_stage,
      'state',case when p.archived_at is not null then 'ARCHIVED' else coalesce(p.state,'UNKNOWN') end,
      'owner',p.owner_key,'closedOutcome',p.closed_outcome,'originId',p.origin_id,'originAt',p.origin_at,
      'source',p.source,'campaign',p.campaign,'receiptCount',p.receipt_count,'paymentVerified',p.payment_verified,
      'knownTest',p.id='10c5db1a-602c-4f0c-8193-855b186215bb'::uuid,
      'testCandidate',coalesce(p.name ~* '(^|[^a-z])(test|testing|qa)([^a-z]|$)',false)
    ) order by p.created_at desc,p.id) from projects p),'[]'::jsonb),
    'events',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'projectId',e.project_id,'kind',e.kind,
      'day',e.event_day,'status',e.status,'amountCents',e.amount) order by e.event_day desc,e.id) from selected_events e),'[]'::jsonb),
    'limited',(select count(*)>10000 from selected_events)) into v_result;
  if (v_result->>'limited')::boolean then
    raise exception 'Too many sales events; choose a shorter period' using errcode='54000';
  end if;
  return v_result-'limited';
end;
$$;
revoke all on function public.marketing_sales_hub_read(date,date) from public,anon;
grant execute on function public.marketing_sales_hub_read(date,date) to authenticated;
comment on function public.marketing_sales_hub_read(date,date) is
  'Verified Jordan-only bounded receipt cohort, whole project portfolio and dated commercial/payment evidence. No writes or inferred historical attribution.';
