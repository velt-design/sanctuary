-- Exact confirmed launch-verification IDs only; retain historical tests and all audit records.
-- No name/email classifier, source attribution, conversion dispatch or business-record mutation.
begin;
do $migration$
begin
  if (select md5(replace(prosrc,chr(13),'')) from pg_proc where oid=to_regprocedure('public.marketing_performance_read(date,date)')) is distinct from '1c7e8670976b855e692ab0c12e8a2daf' then
    raise exception 'Known-test reporting baseline changed: marketing_performance_read';
  end if;
  if (select md5(replace(prosrc,chr(13),'')) from pg_proc where oid=to_regprocedure('public.marketing_sales_hub_read(date,date)')) is distinct from 'c9cc893701a0e30c47c64ba74197bb45' then
    raise exception 'Known-test reporting baseline changed: marketing_sales_hub_read';
  end if;
  if (select md5(replace(prosrc,chr(13),'')) from pg_proc where oid=to_regprocedure('public.marketing_commercial_performance_read(date,date)')) is distinct from '08b70a22905034de816362c6c5a8436a' then
    raise exception 'Known-test reporting baseline changed: marketing_commercial_performance_read';
  end if;
  if (select md5(replace(prosrc,chr(13),'')) from pg_proc where oid=to_regprocedure('public.sanctuary_campaign_outcomes(uuid,text,text,text,uuid,text,uuid)')) is distinct from '815e0a85d7f012a132d0a0ccb0a5ce66' then
    raise exception 'Known-test reporting baseline changed: sanctuary_campaign_outcomes';
  end if;
end $migration$;

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
    select e.*, (e.id in ('f3229ccf-6a1a-4e1a-bcf4-2edf5cc85e70'::uuid,'fdb7aa7a-bb3f-4fb3-89ed-ac3483d21118'::uuid)
      or e.project_id in ('10c5db1a-602c-4f0c-8193-855b186215bb'::uuid,'9d98b82b-679a-4ecb-8265-9fa05eaa78ef'::uuid)) is true as excluded
    from public.enquiry_requests e
    where e.created_at >= p_start::timestamp at time zone 'Pacific/Auckland'
      and e.created_at < (p_end + 1)::timestamp at time zone 'Pacific/Auckland'
    order by e.created_at, e.id limit 2001
  ), included as materialized (
    select * from cohort where not excluded
  ), project_facts as materialized (
    select p.id, p.name,
      (select e.id from public.enquiry_requests e where e.project_id = p.id
        and e.id not in ('f3229ccf-6a1a-4e1a-bcf4-2edf5cc85e70'::uuid,'fdb7aa7a-bb3f-4fb3-89ed-ac3483d21118'::uuid)
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
      and r.id not in ('f3229ccf-6a1a-4e1a-bcf4-2edf5cc85e70'::uuid,'fdb7aa7a-bb3f-4fb3-89ed-ac3483d21118'::uuid) order by r.created_at,r.id limit 1) e on true
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
      and e.project_id not in ('10c5db1a-602c-4f0c-8193-855b186215bb'::uuid,'9d98b82b-679a-4ecb-8265-9fa05eaa78ef'::uuid)
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
      'knownTest',p.id in ('10c5db1a-602c-4f0c-8193-855b186215bb'::uuid,'9d98b82b-679a-4ecb-8265-9fa05eaa78ef'::uuid),
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

create or replace function public.marketing_commercial_performance_read(p_start date, p_end date)
returns jsonb language plpgsql stable security definer
set search_path = pg_catalog, pg_temp as $$
declare v_result jsonb; v_prior_start date; v_prior_end date;
begin
  if auth.uid() is null or public.has_portal_access() is not true then
    raise exception 'Staff access required' using errcode='42501';
  end if;
  if not exists(select 1 from auth.users u where u.id=auth.uid()
    and lower(u.email)='jordan@sanctuarypergolas.co.nz' and u.email_confirmed_at is not null) then
    raise exception 'Developer access required' using errcode='42501';
  end if;
  if p_start is null or p_end is null or p_end<p_start or p_end-p_start>365
    or p_end>(current_timestamp at time zone 'Pacific/Auckland')::date then
    raise exception 'Choose up to 366 days ending today or earlier' using errcode='22023';
  end if;
  v_prior_end:=p_start-1; v_prior_start:=p_start-(p_end-p_start+1);
  if (select count(*) from public.quotes)>5000 then
    raise exception 'Commercial reporting bound exceeded' using errcode='54000';
  end if;
  with accepted as materialized (
    select a.quote_id,a.quote_version_id,a.total_inc_gst_cents
    from public.projects p cross join lateral public.commercial_current_accepted_quote_versions(p.id) a
  ), families as (
    select q.id,q.project_id,q.quote_ref,q.commercial_scope_id,
      (select min(e.created_at) from public.enquiry_requests e where e.project_id=q.project_id
        and e.id not in ('f3229ccf-6a1a-4e1a-bcf4-2edf5cc85e70'::uuid,'fdb7aa7a-bb3f-4fb3-89ed-ac3483d21118'::uuid)) origin_at,
      (select count(*) from public.quote_versions v where v.quote_id=q.id and v.sent_at is null
        and (v.accepted_at is not null or v.status in ('SENT','ACCEPTED'))) undated_send_count,
      (select min(v.sent_at) from public.quote_versions v where v.quote_id=q.id) first_sent_at,
      (select jsonb_build_object('versionId',v.id,'versionNumber',v.version_number,'sentAt',v.sent_at,'amountCents',v.total_inc_gst_cents)
        from public.quote_versions v where v.quote_id=q.id
          and v.sent_at>=p_start::timestamp at time zone 'Pacific/Auckland'
          and v.sent_at<(p_end+1)::timestamp at time zone 'Pacific/Auckland'
        order by v.sent_at desc,v.version_number desc,v.created_at desc,v.id desc limit 1) current_sent,
      (select jsonb_build_object('versionId',v.id,'versionNumber',v.version_number,'sentAt',v.sent_at,'amountCents',v.total_inc_gst_cents)
        from public.quote_versions v where v.quote_id=q.id
          and v.sent_at>=v_prior_start::timestamp at time zone 'Pacific/Auckland'
          and v.sent_at<(v_prior_end+1)::timestamp at time zone 'Pacific/Auckland'
        order by v.sent_at desc,v.version_number desc,v.created_at desc,v.id desc limit 1) prior_sent,
      (select jsonb_build_object('versionId',v.id,'versionNumber',v.version_number,'acceptedAt',v.accepted_at,'amountCents',a.total_inc_gst_cents)
        from accepted a join public.quote_versions v on v.id=a.quote_version_id where a.quote_id=q.id) accepted
    from public.quotes q where q.project_id not in ('10c5db1a-602c-4f0c-8193-855b186215bb'::uuid,'9d98b82b-679a-4ecb-8265-9fa05eaa78ef'::uuid)
  )
  select jsonb_build_object('schemaVersion',2,'asOf',current_timestamp,'start',p_start,'end',p_end,
    'priorStart',v_prior_start,'priorEnd',v_prior_end,'currency','NZD','taxBasis','including_gst',
    'earliestSentAt',(select min(first_sent_at) from families),
    'rows',coalesce((select jsonb_agg(jsonb_build_object('quoteId',f.id,'projectId',f.project_id,
      'quoteRef',f.quote_ref,'scopeKind',case when f.commercial_scope_id is null then 'base' else 'add_on' end,
      'originAt',f.origin_at,'firstSentAt',f.first_sent_at,'undatedSendCount',f.undated_send_count,'currentSent',f.current_sent,
      'priorSent',f.prior_sent,'accepted',f.accepted) order by f.id) from families f),'[]'::jsonb)) into v_result;
  return v_result;
end;
$$;

create or replace function public.sanctuary_campaign_outcomes(p_actor uuid,p_account text,p_binding text,p_source text,p_connection uuid,p_environment text,p_operation uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; n integer; scope jsonb; launch timestamptz;
begin
 -- Reuse exact source/actor/current-generation/kill/expiry/delivery checks.
 perform public.sanctuary_meta_command(p_actor,p_account,p_binding,p_source,p_connection,p_environment,'deliver',p_operation);
 if not exists(select 1 from private.sanctuary_meta_operations where id=p_operation and query::jsonb->>'health'='true') then raise exception 'Wrong evidence purpose';end if;
 select query::jsonb->'scope' into scope from private.sanctuary_meta_operations where id=p_operation;
 launch:=(scope->>'launchDay')::date::timestamp at time zone 'Pacific/Auckland';
 select count(*) into n from public.enquiry_requests where created_at>=launch;
 if n>2000 then raise exception 'Campaign cohort exceeds bound';end if;
 with receipts as materialized (
   select e.*, coalesce(e.raw_payload#>>'{attribution,utm,utm_content}',e.utm->>'utm_content') ad,
     coalesce(e.raw_payload#>>'{attribution,utm,utm_term}',e.utm->>'utm_term') adset
   from public.enquiry_requests e where e.created_at>=launch
   and e.raw_payload#>>'{attribution,consent,marketing}'='true'
   and coalesce(e.raw_payload#>>'{attribution,utm,utm_campaign}',e.utm->>'utm_campaign')=scope->>'campaign'
   and e.id not in ('f3229ccf-6a1a-4e1a-bcf4-2edf5cc85e70'::uuid,'fdb7aa7a-bb3f-4fb3-89ed-ac3483d21118'::uuid)
   and (e.project_id is null or e.project_id not in ('10c5db1a-602c-4f0c-8193-855b186215bb'::uuid,'9d98b82b-679a-4ecb-8265-9fa05eaa78ef'::uuid))
 ), ads(id) as (select value->>'id' from jsonb_array_elements(scope->'ads')),
 included as materialized (select e.* from receipts e join ads a on a.id=e.ad where e.adset=scope->>'adset'),
 facts as materialized (
   select e.*, (select state from private.enquiry_qualification_events where enquiry_id=e.id order by version desc limit 1) qualification,
     e.id=(select r.id from public.enquiry_requests r where r.project_id=e.project_id and r.id not in ('f3229ccf-6a1a-4e1a-bcf4-2edf5cc85e70'::uuid,'fdb7aa7a-bb3f-4fb3-89ed-ac3483d21118'::uuid) order by r.created_at,r.id limit 1) origin,
     exists(select 1 from public.site_visit_events v where v.project_id=e.project_id and (to_jsonb(v)->>'confirmed_at' is not null or v.status='CONFIRMED')) visited,
     exists(select 1 from public.quotes q join public.quote_versions v on v.quote_id=q.id where q.project_id=e.project_id and (v.sent_at is not null or v.accepted_at is not null or v.status in ('SENT','ACCEPTED'))) quoted,
     exists(select 1 from public.commercial_current_accepted_quote_versions(e.project_id)) accepted,
     (exists(select 1 from public.xero_deposit_matches m where m.project_id=e.project_id and m.reversed_at is null and m.amount_inc_gst_cents>0)
       or exists(select 1 from public.deposit_invoices i join public.commercial_current_accepted_quote_versions(e.project_id) a on a.quote_version_id=i.quote_version_id
         where i.project_id=e.project_id and i.status='PAID' and i.payment_term_position=1 and i.total_inc_gst_cents>0)) paid
   from included e
 ), identities as materialized (
   select e.id,e.ad,e.created_at,p.id project_id,c.id contact_id,lower(trim(c.email)) email,
     greatest(e.created_at,coalesce((to_jsonb(p)->>'updated_at')::timestamptz,e.created_at),coalesce((to_jsonb(c)->>'updated_at')::timestamptz,e.created_at)) changed_at,
     (select count(*)>1 from public.projects other join public.contacts mailbox_contact on mailbox_contact.id=other.contact_id
       where lower(trim(mailbox_contact.email))=lower(trim(c.email))) multiple_projects
   from included e join public.projects p on p.id=e.project_id join public.contacts c on c.id=p.contact_id
   where c.email~'^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+$' and length(c.email)<=254
     and coalesce(to_jsonb(e)->>'contact_id',p.contact_id::text)=p.contact_id::text
 ), selected_identities as (
   select * from identities order by (created_at>=clock_timestamp()-interval '2 days') desc,
     md5(id::text||(clock_timestamp() at time zone 'Pacific/Auckland')::date::text) limit 200
 ), counts as (
   select a.id,count(f.id) enquiries,count(f.id) filter(where qualification='qualified') qualified,
     count(f.id) filter(where qualification is null or qualification='unreviewed') unreviewed,
     count(distinct project_id) filter(where origin and visited) visits,count(distinct project_id) filter(where origin and quoted) quoted,
     count(distinct project_id) filter(where origin and accepted) accepted,count(distinct project_id) filter(where origin and paid) paid
   from ads a left join facts f on f.ad=a.id group by a.id
 ) select jsonb_build_object('observedAt',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'cohortStart',scope->>'launchDay',
   'ads',(select jsonb_agg(jsonb_build_object('id',id,'enquiries',enquiries,'qualified',qualified,'unreviewed',unreviewed,'confirmedVisits',visits,
     'quotedProjects',quoted,'acceptedProjects',accepted,'paidProjects',paid) order by id) from counts),
   'correspondence',jsonb_build_object('total',(select count(*) from included),'eligible',(select count(*) from identities),
     'unlinked',(select count(*) from included)-(select count(*) from identities),'omitted',(select count(*) from identities)-(select count(*) from selected_identities),
     'contacts',coalesce((select jsonb_agg(jsonb_build_object('key',encode(sha256(convert_to('sp_enq_'||id::text,'UTF8')),'hex'),'ad',ad,
       'enquiryId',id,'projectId',project_id,'contactId',contact_id,'email',email,'multipleProjects',multiple_projects,'createdAt',created_at,'changedAt',changed_at)) from selected_identities),'[]'::jsonb)),
   'enquiryReferenceHashes',coalesce((select jsonb_agg(encode(sha256(convert_to('sp_enq_'||id::text,'UTF8')),'hex')) from included),'[]'::jsonb),
   'unmatchedCampaignEnquiries',(select count(*) from receipts where id not in (select id from included))) into result;
 return result;
end $$;
commit;
