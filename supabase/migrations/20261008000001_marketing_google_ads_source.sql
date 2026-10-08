-- Classify saved evidence only. No receipt writes, tracking or provider claims.
create or replace function private.marketing_observed_source(payload jsonb, legacy_utm jsonb)
returns text language sql immutable
set search_path = pg_catalog, pg_temp as $$
  select case when payload #>> '{attribution,consent,marketing}' = 'true' then
    coalesce(
      nullif(btrim(payload #>> '{attribution,utm,utm_source}'), ''),
      nullif(btrim(legacy_utm ->> 'utm_source'), ''),
      case when payload #> '{attribution,consent,marketing}' = 'true'::jsonb
        and exists (
          select 1 from (values ('gclid'), ('gbraid'), ('wbraid')) as keys(name)
          where jsonb_typeof(payload #> array['attribution','clickIds',name]) = 'string'
            and length(payload #>> array['attribution','clickIds',name]) between 1 and 600
            and (payload #>> array['attribution','clickIds',name]) ~ '^[A-Za-z0-9_-]+$'
        ) then 'Google Ads' end
    ) end
$$;
-- Private pure policy: only the existing security-definer reporting owners call it.
revoke all on function private.marketing_observed_source(jsonb,jsonb) from public, anon, authenticated;

-- Read-only, single-statement cohort snapshot. Never infer outcomes from analytics.
create or replace function public.marketing_performance_read(p_start date, p_end date)
returns jsonb language plpgsql stable security definer
set search_path = pg_catalog, pg_temp as $$
declare v_result jsonb;
begin
  if auth.uid() is null or public.has_portal_access() is not true then
    raise exception 'Staff access required' using errcode = '42501';
  end if;
  if not exists (select 1 from auth.users u where u.id = auth.uid()
    and lower(u.email) = 'jordan@sanctuarypergolas.co.nz' and u.email_confirmed_at is not null) then
    raise exception 'Developer access required' using errcode = '42501';
  end if;
  if p_start is null or p_end is null or p_end < p_start or p_end - p_start > 365
    or p_end > (current_timestamp at time zone 'Pacific/Auckland')::date then
    raise exception 'Choose up to 366 days ending today or earlier' using errcode = '22023';
  end if;
  with cohort as materialized (
    select e.*, (e.id = 'f3229ccf-6a1a-4e1a-bcf4-2edf5cc85e70'::uuid
      or e.project_id = '10c5db1a-602c-4f0c-8193-855b186215bb'::uuid) is true as excluded
    from public.enquiry_requests e
    where e.created_at >= p_start::timestamp at time zone 'Pacific/Auckland'
      and e.created_at < (p_end + 1)::timestamp at time zone 'Pacific/Auckland'
    order by e.created_at, e.id limit 2001
  ), included as materialized (
    select * from cohort where not excluded
  ), project_facts as materialized (
    select p.id, p.name,
      (select e.id from public.enquiry_requests e where e.project_id = p.id
        and e.id <> 'f3229ccf-6a1a-4e1a-bcf4-2edf5cc85e70'::uuid
        order by e.created_at, e.id limit 1) as origin_id,
      exists(select 1 from public.site_visit_events v where v.project_id = p.id
        and (to_jsonb(v)->>'confirmed_at' is not null or v.status = 'CONFIRMED')) as visited,
      exists(select 1 from public.quotes q join public.quote_versions v on v.quote_id=q.id
        where q.project_id=p.id and (v.sent_at is not null or v.accepted_at is not null
          or v.status in ('SENT','ACCEPTED'))) as quoted,
      exists(select 1 from public.commercial_current_accepted_quote_versions(p.id)) as accepted,
      (exists(select 1 from public.xero_deposit_matches m where m.project_id=p.id
          and m.reversed_at is null and m.amount_inc_gst_cents > 0)
        or exists(select 1 from public.deposit_invoices i
          join public.commercial_current_accepted_quote_versions(p.id) a on a.quote_version_id=i.quote_version_id
          where i.project_id=p.id and i.status='PAID' and i.payment_term_position=1
            and i.total_inc_gst_cents > 0)) as won,
      (select s.closed_outcome from public.project_operational_states s
        where s.project_id=p.id and s.state='CLOSED') as closed_outcome
    from public.projects p where p.id in (select project_id from included)
  ), rows as (
    select e.id, e.created_at, jsonb_build_object(
      'enquiryId',e.id,'receivedAt',e.created_at,'projectId',p.id,
      'projectName',p.name,'origin',coalesce(e.id=p.origin_id,false),
      'source',private.marketing_observed_source(e.raw_payload,e.utm),
      'campaign',case when e.raw_payload #>> '{attribution,consent,marketing}' = 'true'
        then nullif(btrim(coalesce(e.raw_payload #>> '{attribution,utm,utm_campaign}',e.utm->>'utm_campaign')),'') end,
      'qualification',case when p.id is null then 'unavailable'
        when (qualification.value->>'eligible')::boolean is not true then 'ineligible'
        else qualification.value #>> '{current,state}' end,
      'visit',coalesce(p.visited,false),'quote',coalesce(p.quoted,false),
      'accepted',coalesce(p.accepted,false),'won',coalesce(p.won,false),
      'closedOutcome',p.closed_outcome
    ) as value
    from included e left join project_facts p on p.id=e.project_id
    left join lateral (select public.enquiry_qualification_read(p.id,e.id) as value
      where p.id is not null) qualification on true
  )
  select jsonb_build_object('schemaVersion',1,'asOf',current_timestamp,
    'start',p_start,'end',p_end,'timezone','Pacific/Auckland',
    'visitHistoryAvailable',exists(select 1 from pg_attribute where attrelid='public.site_visit_events'::regclass and attname='confirmed_at' and not attisdropped),
    'excludedTests',(select count(*) from cohort where excluded),
    'limited',(select count(*) > 2000 from cohort),
    'rows',coalesce((select jsonb_agg(value order by created_at,id) from rows),'[]'::jsonb)) into v_result;
  if (v_result->>'limited')::boolean then
    raise exception 'Too many enquiries; choose a shorter period' using errcode = '54000';
  end if;
  return v_result - 'limited';
end;
$$;
revoke all on function public.marketing_performance_read(date,date) from public,anon;
grant execute on function public.marketing_performance_read(date,date) to authenticated;
comment on function public.marketing_performance_read(date,date) is
  'Verified developer-only minimal enquiry cohort and current business evidence; Auckland dates, no tracking writes or provider results.';

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
      private.marketing_observed_source(e.raw_payload,e.utm) source,
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
