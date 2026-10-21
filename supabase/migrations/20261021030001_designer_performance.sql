-- Read-only owner reporting. Original visit corrections and accounting remain authoritative.
create function private.designer_visit_fact(v jsonb) returns jsonb
language plpgsql stable set search_path=pg_catalog,pg_temp as $$
declare d jsonb:=coalesce(v#>'{correction,details}','{}'); people jsonb;
  kind text:=v->>'kind'; day date; at_time timestamptz; reasons jsonb;
begin
  people:=coalesce(d->'staff',v->'staff','[]');
  if v->'correction' is not null and v->'correction'<>'null' then
    kind:=case when coalesce((v->>'withdrawn')::boolean,false) or kind='excluded' then 'excluded'
      when v->>'kindOverride'='review' then 'review' when d->>'status'='provisional' then 'provisional'
      when d->>'status' in ('booked','attended') then 'visit' else kind end;
    reasons:=coalesce(v#>'{correction,questions}','[]');
    if coalesce(v->>'origin','outlook')<>'history' and kind<>'excluded'
      and coalesce(d->>'status','') not in ('cancelled','not_attended') then
      if jsonb_array_length(people)=0 or nullif(btrim(coalesce(d->>'address',v->>'address')),'') is null
        or (d#>>'{timing,mode}'='unknown' and coalesce(d->>'status','')<>'attended')
        or (d#>>'{timing,mode}'='date' and coalesce(d->>'status','') not in ('attended','not_attended'))
      then reasons:=reasons||'["review-required"]'::jsonb; end if;
    end if;
  else reasons:=coalesce(v->'reviewReasons','[]'); end if;
  if d ? 'timing' then
    day:=nullif(d#>>'{timing,date}','')::date;
    if d#>>'{timing,mode}'='agreed' and day is not null then
      at_time:=(day::text||' '||(d#>>'{timing,time}'))::timestamp at time zone 'Pacific/Auckland';
    end if;
  elsif (v->>'isAllDay')::boolean is true then day:=(v->>'allDayStartDate')::date;
  else at_time:=(v->>'startsAt')::timestamptz; day:=(at_time at time zone 'Pacific/Auckland')::date; end if;
  return jsonb_build_object('id',v->>'id','projectId',v->'projectId','origin',coalesce(v->>'origin','outlook'),
    'day',day,'at',at_time,'purpose',d->>'purpose','status',d->>'status','kind',kind,
    'staff',coalesce((select jsonb_agg(distinct p->>'staffId' order by p->>'staffId') from jsonb_array_elements(people) p where p->>'staffId' is not null),'[]'),
    'unmappedStaff',(select count(*) from jsonb_array_elements(people) p where p->>'staffId' is null),
    'removed',coalesce((v->>'removed')::boolean,false),'withdrawn',coalesce((v->>'withdrawn')::boolean,false),
    'cancelled',case when d ? 'status' then d->>'status' in ('cancelled','not_attended') else coalesce((v->>'cancelled')::boolean,false) end,
    'duplicate',coalesce((v->>'duplicate')::boolean,false),'changed',coalesce((v#>>'{correction,sourceChanged}')::boolean,false),
    'questions',jsonb_array_length(reasons));
end $$;
revoke all on function private.designer_visit_fact(jsonb) from public,anon,authenticated,service_role;

create function public.marketing_designer_performance_read(p_start date,p_end date) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$
declare result jsonb;
begin
  if auth.uid() is null or public.has_portal_access() is not true then raise exception 'Staff access required' using errcode='42501'; end if;
  if not exists(select 1 from auth.users u where u.id=auth.uid() and lower(u.email)='jordan@sanctuarypergolas.co.nz'
    and u.email_confirmed_at is not null and u.deleted_at is null and (u.banned_until is null or u.banned_until<now())) then
    raise exception 'Developer access required' using errcode='42501'; end if;
  if p_start is null or p_end is null or p_end<p_start or p_end-p_start>365 or p_end>(now() at time zone 'Pacific/Auckland')::date then
    raise exception 'Choose up to 366 days ending today or earlier' using errcode='22023'; end if;
  -- Full retained history is needed to anchor the first original visit. Never truncate it.
  if (select count(*) from private.outlook_calendar_visits where not hidden and (select enabled from private.outlook_calendar_control where singleton))+(select count(*) from private.site_visit_details where source_visit_id is null)>5000
    or (select count(*) from public.quotes)>5000 then raise exception 'Designer reporting limit reached' using errcode='54000'; end if;
  with visits as materialized (
    select private.designer_visit_fact(private.outlook_calendar_visit_json(v)) body from private.outlook_calendar_visits v where not v.hidden
      and (select enabled from private.outlook_calendar_control where singleton)
    union all select private.designer_visit_fact(private.site_visit_history_json(d)) from private.site_visit_details d where d.source_visit_id is null
  ), accepted as materialized (
    select a.* from public.projects p cross join lateral public.commercial_current_accepted_quote_versions(p.id) a
  ), scopes as (
    select q.id,q.project_id,jsonb_build_object('id',q.id,'projectId',q.project_id,'reference',q.quote_ref,
      'addOn',q.commercial_scope_id is not null,
      'firstSentAt',(select min(v.sent_at) from public.quote_versions v where v.quote_id=q.id),
      'undatedSend',exists(select 1 from public.quote_versions v where v.quote_id=q.id and v.sent_at is null and (v.accepted_at is not null or v.status in ('SENT','ACCEPTED'))),
      'acceptedAt',av.accepted_at,'accepted',a.quote_id is not null,'valueCents',a.total_inc_gst_cents,
      'paymentEvidence',a.quote_id is not null and (f.facts->>'cancelled')::boolean is false and exists(select 1 from public.deposit_invoices i where i.quote_id=a.quote_id and i.payment_term_position=1 and i.currency='NZD' and i.status<>'VOID'
        and ((i.status='PAID' and i.total_inc_gst_cents>0) or exists(select 1 from public.xero_deposit_matches m
          join public.project_payment_entries e on e.id=m.payment_entry_id and e.entry_type='PAYMENT'
          where m.invoice_id=i.id and m.reversed_at is null and m.amount_inc_gst_cents>0
            and not exists(select 1 from public.project_payment_entries r where r.reverses_entry_id=e.id)))),
      'paidAt',case when (f.facts->>'cancelled')::boolean is false and a.total_inc_gst_cents>0 then f.facts->>'occurred_at' end) body
    from public.quotes q left join accepted a on a.quote_id=q.id left join public.quote_versions av on av.id=a.quote_version_id
    left join private.advertising_scope_facts() f on f.quote_id=q.id
    where q.project_id not in ('10c5db1a-602c-4f0c-8193-855b186215bb'::uuid,'9d98b82b-679a-4ecb-8265-9fa05eaa78ef'::uuid)
  ) select jsonb_build_object('schemaVersion',1,'asOf',now(),'start',p_start,'end',p_end,
    'source',(select jsonb_build_object('enabled',enabled,'lastSuccess',last_success,'failed',last_error is not null,
      'rangeStart',range_start,'rangeEnd',range_end,'firstImportedAt',(select min(first_seen) from private.outlook_calendar_visits)) from private.outlook_calendar_control where singleton),
    'visits',coalesce((select jsonb_agg(v.body||jsonb_build_object('contactId',p.contact_id) order by v.body->>'id') from visits v
      left join public.projects p on p.id=(v.body->>'projectId')::uuid
      where p.id is null or p.id not in ('10c5db1a-602c-4f0c-8193-855b186215bb'::uuid,'9d98b82b-679a-4ecb-8265-9fa05eaa78ef'::uuid)),'[]'),
    'scopes',coalesce((select jsonb_agg(body order by id) from scopes),'[]')) into result;
  return result;
end $$;
revoke all on function public.marketing_designer_performance_read(date,date) from public,anon,service_role;
grant execute on function public.marketing_designer_performance_read(date,date) to authenticated;

-- Exact correction entry, including a retained visit outside the rolling agenda window.
create function public.outlook_site_visit_detail_read(p_visit uuid,p_project uuid default null) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$
declare event jsonb;
begin
  perform private.outlook_calendar_actor();
  select private.outlook_calendar_visit_json(v) into event from private.outlook_calendar_visits v
    where v.id=p_visit and not v.hidden and (p_project is null or v.project_id=p_project)
      and (select enabled from private.outlook_calendar_control where singleton);
  if event is null then select private.site_visit_history_json(d) into event from private.site_visit_details d
    where d.id=p_visit and d.source_visit_id is null and (p_project is null or d.project_id=p_project); end if;
  return (select jsonb_build_object('enabled',enabled,'lastSuccess',last_success,'lastAttempt',last_attempt,'error',last_error,
    'rangeStart',range_start,'rangeEnd',range_end,'syncing',lease_until>now(),'events',case when event is null then '[]'::jsonb else jsonb_build_array(event) end)
    from private.outlook_calendar_control where singleton);
end $$;
revoke all on function public.outlook_site_visit_detail_read(uuid,uuid) from public,anon,service_role;
grant execute on function public.outlook_site_visit_detail_read(uuid,uuid) to authenticated;
