-- RPC-only orchestration. All provider effects are fenced by an active bounded run.
create function public.google_ads_command(p_actor uuid,p_binding text,p_action text,p_run uuid default null,p_input jsonb default '{}')
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare c private.google_ads_control; r private.google_ads_runs; s private.google_ads_sales;
  source jsonb; body jsonb; candidate record; result jsonb; key uuid; n integer;
begin
  c:=private.google_ads_authority(p_actor,p_binding,case when p_action='begin' then null else p_run end);
  if p_action='begin' then
    perform pg_advisory_xact_lock(hashtextextended('sanctuary-google-advertising-run',0));
    if p_input->>'lane' is null or p_input->>'lane' not in('report','sales','verify') or (p_input->>'lane'='report' and not c.reports_enabled)
      or (p_input->>'lane'='sales' and not c.uploads_enabled)
      or (p_input->>'lane'='verify' and (c.reports_enabled or c.uploads_enabled)) then raise exception 'Capability disabled' using errcode='42501'; end if;
    -- Credential rotation is not retried after an uncertain result. Operator reconciliation required.
    if exists(select 1 from private.google_ads_runs where credential_uncertain) then raise exception 'Credential requires reconciliation' using errcode='55000'; end if;
    update private.google_ads_runs set finished_at=clock_timestamp(),error_code='LEASE_EXPIRED' where finished_at is null and expires_at<=clock_timestamp();
    if exists(select 1 from private.google_ads_runs where finished_at is null) then raise exception 'Google run already active' using errcode='55000'; end if;
    insert into private.google_ads_runs(lane,generation,expires_at) values(p_input->>'lane',c.generation,
      clock_timestamp()+case when p_input->>'lane'='verify' then interval '10 minutes' else interval '4 minutes' end) returning * into r;
    return jsonb_build_object('runId',r.id,'customerId',c.customer_id,'managerId',c.manager_id,'conversionCustomerId',c.conversion_customer_id,'actionId',c.action_id,
      'enhancedMatchingApproved',c.enhanced_matching_approved,'consentPolicyApproved',c.consent_policy_approved,
      'allowedConsentBases',to_jsonb(c.allowed_consent_bases),'consentEffectiveFrom',c.consent_effective_from,'retractionsEnabled',c.retractions_enabled);
  end if;
  if p_run is null then raise exception 'Run required' using errcode='42501'; end if;
  select * into strict r from private.google_ads_runs where id=p_run;
  if p_action='check' then
    if p_input ? 'quoteId' then
      select * into strict s from private.google_ads_sales where quote_id=(p_input->>'quoteId')::uuid and lease_id=p_run;
      if s.generation<>c.generation then raise exception 'Sale binding changed'; end if;
      if s.state='SENDING' then
        select g.source into source from private.google_ads_sources() g where g.quote_id=s.quote_id;
        if source->>'fingerprint' is distinct from s.source_fingerprint then raise exception 'Sale changed before dispatch' using errcode='40001'; end if;
      end if;
    end if;
    return '{}';
  elsif p_action='credential_pending' then
    update private.google_ads_runs set credential_uncertain=true where id=p_run;
    return '{}';
  elsif p_action='sources' and r.lane='sales' then
    if (select count(*) from public.quotes)>5000 then raise exception 'Source bound exceeded' using errcode='54000'; end if;
    select coalesce(jsonb_agg(g.source),'[]') into result from private.google_ads_sources() g
      where g.source->>'active'='true' or exists(select 1 from private.google_ads_sales existing_sale where existing_sale.quote_id=g.quote_id);
    if octet_length(result::text)>4*1024*1024 then raise exception 'Source byte bound exceeded' using errcode='54000'; end if;
    return result;
  elsif p_action='freeze' and r.lane='sales' then
    key:=(p_input->>'quoteId')::uuid;
    select g.source into strict source from private.google_ads_sources() g where g.quote_id=key;
    if source->>'fingerprint' is distinct from p_input->>'fingerprint' then raise exception 'Source changed' using errcode='40001'; end if;
    if source->>'active'<>'true' and not exists(select 1 from private.google_ads_sales where quote_id=key) then return '{}'; end if;
    body:=p_input->'event';
    if body is not null and body<>'null'::jsonb then
      if not c.consent_policy_approved or source->>'active'<>'true' or source->>'marketingConsent'<>'true'
        or not coalesce(source->>'consentBasis'=any(c.allowed_consent_bases),false)
        or (source->>'receivedAt')::timestamptz<c.consent_effective_from
        or body->>'transactionId'<>'sanctuary-scope-'||key::text
        or (body->>'conversionValue')::numeric*100<>(source->>'valueCents')::numeric
        or (body->>'eventTimestamp')::timestamptz<>(source->>'occurredAt')::timestamptz
        or body->>'currency'<>'NZD' or (body ? 'userData' and not c.enhanced_matching_approved) then raise exception 'Invalid sale freeze'; end if;
    else body:=null; end if;
    select * into s from private.google_ads_sales where quote_id=key for update;
    if not found then
      insert into private.google_ads_sales(quote_id,project_id,generation,source_fingerprint,payload,destination,state,reason)
      values(key,(source->>'projectId')::uuid,c.generation,source->>'fingerprint',body,
        jsonb_build_object('customerId',c.conversion_customer_id,'managerId',c.manager_id,'actionId',c.action_id),case when body is null then 'SKIPPED' else 'READY' end,p_input->>'reason');
    elsif s.generation<>c.generation or s.state in('REVIEW_REQUIRED','RETRACTED','RETRACTING') then
      -- A terminal retraction cannot be restored with the old Google transaction ID.
      if s.state='RETRACTED' and body is not null then update private.google_ads_sales set reason='RESTORED_SALE_REQUIRES_NEW_CYCLE',updated_at=now() where quote_id=key; end if;
    elsif s.state in('SENDING','SUBMITTED') then
      -- Settle the same possibly sent identity first; never issue another event while uncertain.
      null;
    elsif body is null and (s.first_submitted_at is not null or s.attempts>0)
      and p_input->>'reason' not in('SALE_NO_LONGER_CURRENT','MARKETING_CONSENT_NOT_GRANTED') then
      -- Ageing beyond an import window is not a business cancellation.
      update private.google_ads_sales set state=case when s.source_fingerprint=source->>'fingerprint' then state else 'REVIEW_REQUIRED' end,
        reason=p_input->>'reason',updated_at=now() where quote_id=key;
    elsif body is null then
      update private.google_ads_sales set state=case when first_submitted_at is not null or attempts>0 then 'RETRACTION_READY' else 'SKIPPED' end,
        reason=p_input->>'reason',payload=case when first_submitted_at is null and attempts=0 then null else payload end,
        source_fingerprint=source->>'fingerprint',adjustment_at=coalesce(adjustment_at,now()),updated_at=now() where quote_id=key;
    elsif s.payload is not null and (s.payload-'conversionValue') is distinct from (body-'conversionValue') and s.first_submitted_at is not null then
      update private.google_ads_sales set state='REVIEW_REQUIRED',reason='SALE_IDENTITY_OR_DATE_CHANGED',updated_at=now() where quote_id=key;
    elsif s.payload=body and s.state='ACCEPTED' then
      update private.google_ads_sales set source_fingerprint=source->>'fingerprint',reason=null,updated_at=now() where quote_id=key;
    elsif s.source_fingerprint<>source->>'fingerprint' or s.state='SKIPPED' then
      update private.google_ads_sales set payload=body,source_fingerprint=source->>'fingerprint',state='READY',reason=null,attempts=0,next_attempt_at=now(),request_id=null,updated_at=now() where quote_id=key;
    end if;
    return '{}';
  elsif p_action='claim' and r.lane='sales' then
    -- Expired dispatch can have reached Google. Retry only the same frozen identity/value.
    update private.google_ads_sales set state='RETRY',reason='DISPATCH_OUTCOME_UNCERTAIN' where state='SENDING'
      and lease_id in(select id from private.google_ads_runs where finished_at is not null);
    update private.google_ads_sales set state='REVIEW_REQUIRED',reason='RETRACTION_OUTCOME_UNCERTAIN' where state='RETRACTING'
      and lease_id in(select id from private.google_ads_runs where finished_at is not null);
    select * into s from private.google_ads_sales where generation=c.generation and next_attempt_at<=now()
      and state in('READY','RETRY','SUBMITTED','RETRACTION_READY') and (state='SUBMITTED' or attempts<8)
      order by case when state='SUBMITTED' then 0 else 1 end,next_attempt_at,quote_id for update skip locked limit 1;
    if not found then return 'null'; end if;
    if s.state='RETRACTION_READY' and not c.retractions_enabled then
      update private.google_ads_sales set state='REVIEW_REQUIRED',reason='RETRACTION_REQUIRES_OPERATOR' where quote_id=s.quote_id; return 'null';
    end if;
    update private.google_ads_sales set state=case when s.state='SUBMITTED' then 'SUBMITTED' when s.state='RETRACTION_READY' then 'RETRACTING' else 'SENDING' end,
      lease_id=p_run,attempts=attempts+case when s.state='SUBMITTED' then 0 else 1 end,updated_at=now() where quote_id=s.quote_id returning * into s;
    return jsonb_build_object('quoteId',s.quote_id,'state',s.state,'event',s.payload,'requestId',s.request_id,'attempts',s.attempts,'submittedAt',s.submitted_at,'adjustmentAt',s.adjustment_at);
  elsif p_action='complete' and r.lane='sales' then
    select * into strict s from private.google_ads_sales where quote_id=(p_input->>'quoteId')::uuid and lease_id=p_run for update;
    if p_input->>'state' not in('SUBMITTED','ACCEPTED','RETRY','FAILED','REVIEW_REQUIRED','RETRACTED') then raise exception 'Invalid delivery outcome'; end if;
    if not ((s.state='SENDING' and p_input->>'state' in('SUBMITTED','RETRY','FAILED','REVIEW_REQUIRED'))
      or (s.state='SUBMITTED' and p_input->>'state' in('SUBMITTED','ACCEPTED','FAILED','REVIEW_REQUIRED'))
      or (s.state='RETRACTING' and p_input->>'state' in('RETRACTED','REVIEW_REQUIRED'))) then raise exception 'Invalid delivery transition'; end if;
    update private.google_ads_sales set state=p_input->>'state',reason=p_input->>'reason',
      request_id=coalesce(p_input->>'requestId',request_id),
      first_submitted_at=case when p_input->>'state'='SUBMITTED' then coalesce(first_submitted_at,now()) else first_submitted_at end,
      submitted_at=case when p_input ? 'requestId' then now() else submitted_at end,
      checked_at=case when s.state='SUBMITTED' then now() else checked_at end,
      next_attempt_at=now()+make_interval(secs=>least(3600,greatest(60,coalesce((p_input->>'delaySeconds')::int,1800)))),
      warnings=coalesce(p_input->'warnings','[]'),updated_at=now(),lease_id=null where quote_id=s.quote_id;
    return '{}';
  elsif p_action='report' and r.lane='report' then
    if p_input->'report'->>'customerId'<>c.customer_id or octet_length((p_input->'report')::text)>8*1024*1024 then raise exception 'Report binding invalid'; end if;
    insert into private.google_ads_report(singleton,generation,payload,fetched_at,expires_at)
      values(true,c.generation,p_input->'report',now(),now()+interval '7 days')
      on conflict(singleton) do update set generation=excluded.generation,payload=excluded.payload,fetched_at=excluded.fetched_at,expires_at=excluded.expires_at;
    return '{}';
  elsif p_action='finish' then
    update private.google_ads_runs set finished_at=now(),error_code=p_input->>'error' where id=p_run;
    return '{}';
  end if;
  raise exception 'Unknown Google command' using errcode='22023';
end $$;
revoke all on function public.google_ads_command(uuid,text,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.google_ads_command(uuid,text,text,uuid,jsonb) to service_role;

-- Credential checkpoint deliberately has independent authority: pending forbids every other effect.
create function public.google_ads_credential_settled(p_actor uuid,p_binding text,p_run uuid)
returns void language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare c private.google_ads_control;
begin
  c:=private.google_ads_authority(p_actor,p_binding,null);
  update private.google_ads_runs set credential_uncertain=false where id=p_run and generation=c.generation
    and expires_at>clock_timestamp() and finished_at is null and credential_uncertain;
  if not found then raise exception 'Credential checkpoint lost'; end if;
end $$;
revoke all on function public.google_ads_credential_settled(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.google_ads_credential_settled(uuid,text,uuid) to service_role;

create function public.google_ads_staff_read() returns jsonb language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$
declare c private.google_ads_control; saved private.google_ads_report;
begin
  if auth.uid() is null or public.has_portal_access() is not true or not exists(select 1 from auth.users u
    where u.id=auth.uid() and lower(u.email)='jordan@sanctuarypergolas.co.nz' and u.email_confirmed_at is not null) then raise exception 'Developer access required' using errcode='42501'; end if;
  select * into strict c from private.google_ads_control;
  select * into saved from private.google_ads_report where generation=c.generation and c.reports_enabled and expires_at>now();
  return jsonb_build_object('enabled',c.reports_enabled,'uploadsEnabled',c.uploads_enabled,'checkedAt',now(),
    'saleActionId',c.action_id,'enquiryActionIds',to_jsonb(c.enquiry_action_ids),
    'collectedAt',saved.fetched_at,'expiresAt',saved.expires_at,'report',saved.payload,
    'lastError',(select error_code from private.google_ads_runs order by expires_at desc limit 1),
    'counts',coalesce((select jsonb_object_agg(state,n) from(select state,count(*) n from private.google_ads_sales group by state) t),'{}'),
    'reasons',coalesce((select jsonb_object_agg(reason,n) from(select reason,count(*) n from private.google_ads_sales where reason is not null group by reason) t),'{}'));
end $$;
revoke all on function public.google_ads_staff_read() from public,anon;
grant execute on function public.google_ads_staff_read() to authenticated;
