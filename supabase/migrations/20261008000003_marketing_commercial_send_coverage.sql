-- Forward coverage correction; preserve applied 000002 and all source dates.
do $$ begin
  if (select md5(replace(prosrc,chr(13),'')) from pg_proc where oid='public.marketing_commercial_performance_read(date,date)'::regprocedure) <> 'c51f70722c0a1eea7fdfc44131771b04' then
    raise exception 'Commercial reader baseline changed';
  end if;
end $$;
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
        and e.id<>'f3229ccf-6a1a-4e1a-bcf4-2edf5cc85e70'::uuid) origin_at,
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
    from public.quotes q where q.project_id<>'10c5db1a-602c-4f0c-8193-855b186215bb'::uuid
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
revoke all on function public.marketing_commercial_performance_read(date,date) from public,anon;
grant execute on function public.marketing_commercial_performance_read(date,date) to authenticated;
comment on function public.marketing_commercial_performance_read(date,date) is
  'Confirmed developer-only bounded quote-family values and timing evidence. NZD including GST quote contract; current acceptance can restate historical reporting. No writes.';
