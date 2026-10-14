create function private.meta_sale_eligible(s jsonb,c private.meta_sale_control,enforce_window boolean default true) returns boolean
language sql stable security definer set search_path=pg_catalog,pg_temp as $$
  select coalesce(s->>'active'='true' and s->>'suppressed'='false' and s->>'marketingDenied'='false'
    and c.consent_policy_approved and (s->>'occurredAt')::timestamptz<=now()
    and (not enforce_window or (s->>'occurredAt')::timestamptz>now()-interval '7 days')
    and ((s->>'receivedAt') is null or (s->>'occurredAt')::timestamptz>=(s->>'receivedAt')::timestamptz)
    and ((c.historical_enabled and s->'historicalApproval'<>'null'::jsonb)
      or (s->>'receiptId' is not null and s->>'marketingConsent'='true'
        and c.disclosure_version='2026-10-sale-measurement-v2' and s->>'disclosureVersion'=c.disclosure_version and s->>'consentBasis'=any(c.allowed_consent_bases)
        and (s->>'receivedAt')::timestamptz>=c.consent_effective_from)),false)
$$;
revoke all on function private.meta_sale_eligible(jsonb,private.meta_sale_control,boolean) from public,anon,authenticated,service_role;

-- Reused at freeze, recovered claim and the final pre-effect check. Never rewrite
-- a previously attempted body when contact authority changes.
create function private.meta_sale_matching_data(s jsonb,c private.meta_sale_control,enforce_window boolean default true) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$
declare email text;phone text;expected jsonb:='{}';cookie text;cookie_time timestamptz;reason text;
begin
      if c.contact_matching_approved then
        if c.historical_enabled and s->'historicalApproval'->>'identitySource'='crm' then email:=s->>'crmEmail';phone:=s->>'crmPhone';
        else email:=s->>'email';phone:=s->>'phone';end if;
        email:=lower(btrim(email));phone:=regexp_replace(phone,'[[:space:]().-]','','g');
        if length(email)<=254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then expected:=expected||jsonb_build_object('em',jsonb_build_array(encode(sha256(convert_to(email,'UTF8')),'hex')));end if;
        if phone ~ '^\+[1-9][0-9]{7,14}$' then expected:=expected||jsonb_build_object('ph',jsonb_build_array(encode(sha256(convert_to(substr(phone,2),'UTF8')),'hex')));end if;
      end if;
      foreach reason in array array['fbc','fbp'] loop
        cookie:=s->>reason;
        if length(cookie)<=640 and cookie ~ '^fb\.[0-9]\.[0-9]{13}\.[A-Za-z0-9_-]+$'
          and (reason='fbc' or split_part(cookie,'.',4) ~ '^[0-9]+$') then
          cookie_time:=to_timestamp(split_part(cookie,'.',3)::numeric/1000);
          if cookie_time<=(s->>'receivedAt')::timestamptz and cookie_time<=now() and (not enforce_window or cookie_time>now()-interval '90 days') then
            expected:=expected||jsonb_build_object(reason,cookie); end if;
        end if;
      end loop;
  return expected;
end $$;
revoke all on function private.meta_sale_matching_data(jsonb,private.meta_sale_control,boolean) from public,anon,authenticated,service_role;

create function public.meta_sale_command(p_actor uuid,p_binding text,p_action text,p_run uuid default null,p_input jsonb default '{}')
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare c private.meta_sale_control; r private.meta_sale_runs; sale private.meta_sales; s jsonb; body jsonb; result jsonb;
  key uuid; email text; phone text; expected jsonb:='{}'; cookie text; cookie_time timestamptz; reason text;
begin
  c:=private.meta_sale_authority(p_actor,p_binding,case when p_action='begin' then null else p_run end);
  if p_action='begin' then
    perform pg_advisory_xact_lock(hashtextextended('sanctuary-meta-sales',0));
    if p_input->>'lane' is null or p_input->>'lane' not in('sales','assess')
      or (p_input->>'lane'='sales' and (not c.uploads_enabled or c.credential_expires_at is null or c.credential_expires_at<=now()+interval '1 minute')) then
      raise exception 'Meta sale capability disabled' using errcode='42501'; end if;
    update private.meta_sale_runs set finished_at=clock_timestamp(),error_code='LEASE_EXPIRED' where finished_at is null and expires_at<=clock_timestamp();
    if exists(select 1 from private.meta_sale_runs where finished_at is null) then raise exception 'Meta sale run already active' using errcode='55000'; end if;
    insert into private.meta_sale_runs(generation,lane,expires_at) values(c.generation,p_input->>'lane',clock_timestamp()+interval '4 minutes') returning * into r;
    return jsonb_build_object('runId',r.id,'datasetId',c.dataset_id,'contactMatchingApproved',c.contact_matching_approved,
      'consentPolicyApproved',c.consent_policy_approved,'disclosureVersion',c.disclosure_version,'allowedConsentBases',to_jsonb(c.allowed_consent_bases),
      'consentEffectiveFrom',c.consent_effective_from,'historicalEnabled',c.historical_enabled);
  end if;
  if p_run is null then raise exception 'Run required' using errcode='42501'; end if;
  select * into strict r from private.meta_sale_runs where id=p_run;
  if p_action='sources' then
    if (select count(*) from public.quotes)>5000 then raise exception 'Source bound exceeded'; end if;
    select coalesce(jsonb_agg(g.source),'[]') into result from private.meta_sale_sources() g
      where (g.source->>'active'='true' or exists(select 1 from private.meta_sales existing where existing.quote_id=g.quote_id))
      and (r.lane='assess' or c.upload_mode='routine' or (c.upload_mode='canary' and g.quote_id=c.canary_quote_id)
        or (c.upload_mode='historical' and (g.source->'historicalApproval'<>'null'::jsonb or exists(select 1 from private.meta_sales previous where previous.quote_id=g.quote_id))));
    if octet_length(result::text)>4*1024*1024 then raise exception 'Source byte bound exceeded'; end if;
    return result;
  elsif p_action in('assess','freeze') then
    key:=(p_input->>'quoteId')::uuid;
    select g.source into strict s from private.meta_sale_sources() g where g.quote_id=key;
    if s->>'fingerprint' is distinct from p_input->>'fingerprint' then raise exception 'Source changed' using errcode='40001'; end if;
    if jsonb_typeof(p_input->'assessment'->'reasons') is distinct from 'array'
      or jsonb_array_length(p_input->'assessment'->'reasons')>15
      or exists(select 1 from jsonb_array_elements_text(p_input->'assessment'->'reasons') v where v !~ '^[A-Z_]{1,80}$')
      or jsonb_typeof(p_input->'assessment'->'matching') is distinct from 'object'
      or exists(select 1 from jsonb_each(p_input->'assessment'->'matching') v where v.key not in('originalEmail','originalPhone','crmEmail','crmPhone','fbc','fbp') or jsonb_typeof(v.value)<>'boolean') then
      raise exception 'Invalid assessment'; end if;
    insert into private.meta_sale_assessments(quote_id,project_id,source_fingerprint,reasons,matching)
      values(key,(s->>'projectId')::uuid,s->>'fingerprint',p_input->'assessment'->'reasons',p_input->'assessment'->'matching')
      on conflict(quote_id) do update set source_fingerprint=excluded.source_fingerprint,reasons=excluded.reasons,matching=excluded.matching,assessed_at=now();
    if p_action='assess' then return '{}'; end if;
    if r.lane<>'sales' then raise exception 'Assessment cannot send' using errcode='42501'; end if;
    body:=nullif(p_input->'event','null'::jsonb);
    if (c.upload_mode='canary' and key is distinct from c.canary_quote_id)
      or (c.upload_mode='historical' and s->'historicalApproval'='null'::jsonb and body is not null) then raise exception 'Outside selected sale' using errcode='42501'; end if;
    if body is not null then
      if not private.meta_sale_eligible(s,c) or jsonb_typeof(body) is distinct from 'object'
        or body->>'event_name' is distinct from 'Purchase' or body->>'event_id' is distinct from 'sanctuary-scope-'||key::text
        or body->>'action_source' is distinct from 'other'
        or (body->>'event_time')::numeric is distinct from floor(extract(epoch from (s->>'occurredAt')::timestamptz))
        or body->'custom_data' is distinct from jsonb_build_object('currency','NZD','value',(s->>'valueCents')::numeric/100,'order_id','sanctuary-scope-'||key::text)
        or body-array['event_name','event_id','event_time','action_source','user_data','custom_data']<>'{}'::jsonb then raise exception 'Invalid Meta sale freeze'; end if;
      expected:=private.meta_sale_matching_data(s,c);
      if expected='{}'::jsonb or body->'user_data' is distinct from expected then raise exception 'Unpermitted Meta matching data'; end if;
    end if;
    select * into sale from private.meta_sales where quote_id=key for update;
    if not found then
      if body is not null then insert into private.meta_sales(quote_id,project_id,generation,source_fingerprint,payload,dataset_id,state)
        values(key,(s->>'projectId')::uuid,c.generation,s->>'fingerprint',body,c.dataset_id,'READY'); end if;
    elsif sale.state in('REVIEW_REQUIRED','SUPPRESSED') then null;
    elsif sale.state='ACCEPTED' then
      -- Import deadlines constrain dispatch, not the truth of an already received sale.
      if sale.source_fingerprint is distinct from s->>'fingerprint'
        or not private.meta_sale_eligible(s,c,false)
        or sale.payload->'user_data' is distinct from private.meta_sale_matching_data(s,c,false) then
        update private.meta_sales set state='REVIEW_REQUIRED',reason='SENT_SALE_SOURCE_CHANGED',updated_at=now() where quote_id=key;
      end if;
    elsif sale.state='SENDING' then null;
    elsif body is null or sale.payload is distinct from body or sale.source_fingerprint<>s->>'fingerprint' then
      if sale.attempts>0 then
        update private.meta_sales set state='REVIEW_REQUIRED',reason=case when body is null then 'SENT_SALE_NO_LONGER_ELIGIBLE' else 'SENT_SALE_SOURCE_CHANGED' end,updated_at=now() where quote_id=key;
      elsif body is null then update private.meta_sales set state='SUPPRESSED',reason='SALE_NO_LONGER_ELIGIBLE',updated_at=now() where quote_id=key;
      else update private.meta_sales set payload=body,source_fingerprint=s->>'fingerprint',updated_at=now() where quote_id=key;end if;
    end if;
    return '{}';
  elsif p_action='claim' and r.lane='sales' then
    update private.meta_sales set state='RETRY',reason='DISPATCH_OUTCOME_UNCERTAIN' where state='SENDING'
      and lease_id in(select id from private.meta_sale_runs where finished_at is not null);
    update private.meta_sales set state='REVIEW_REQUIRED',reason='RETRY_WINDOW_EXHAUSTED',updated_at=now()
      where state in('READY','RETRY') and (attempts>=5 or first_attempt_at<=now()-interval '24 hours' or (payload->>'event_time')::bigint<=extract(epoch from now()-interval '7 days'));
    select * into sale from private.meta_sales where generation=c.generation and dataset_id=c.dataset_id and state in('READY','RETRY') and next_attempt_at<=now()
      and (c.upload_mode='routine' or (c.upload_mode='canary' and quote_id=c.canary_quote_id)
        or (c.upload_mode='historical' and exists(select 1 from private.meta_sale_history_approvals h where h.quote_id=private.meta_sales.quote_id and h.revoked_at is null and h.source_fingerprint=private.meta_sales.source_fingerprint)))
      order by next_attempt_at,quote_id for update skip locked limit 1;
    if not found then return 'null'; end if;
    select g.source into s from private.meta_sale_sources() g where g.quote_id=sale.quote_id;
    if s->>'fingerprint' is distinct from sale.source_fingerprint or not private.meta_sale_eligible(s,c)
      or sale.payload->'user_data' is distinct from private.meta_sale_matching_data(s,c) then
      update private.meta_sales set state=case when attempts=0 then 'SUPPRESSED' else 'REVIEW_REQUIRED' end,reason='SOURCE_CHANGED_BEFORE_DISPATCH',updated_at=now() where quote_id=sale.quote_id;
      return 'null';end if;
    update private.meta_sales set state='SENDING',attempts=attempts+1,first_attempt_at=coalesce(first_attempt_at,now()),lease_id=p_run,updated_at=now()
      where quote_id=sale.quote_id returning * into sale;
    return jsonb_build_object('quoteId',sale.quote_id,'event',sale.payload,'attempts',sale.attempts,'firstAttemptAt',sale.first_attempt_at);
  elsif p_action='check' and r.lane='sales' then
    select * into strict sale from private.meta_sales where quote_id=(p_input->>'quoteId')::uuid and lease_id=p_run and state='SENDING';
    select g.source into s from private.meta_sale_sources() g where g.quote_id=sale.quote_id;
    if sale.generation<>c.generation or sale.dataset_id is distinct from c.dataset_id
      or s->>'fingerprint' is distinct from sale.source_fingerprint or not private.meta_sale_eligible(s,c)
      or sale.payload->'user_data' is distinct from private.meta_sale_matching_data(s,c)
      or (c.upload_mode='canary' and sale.quote_id is distinct from c.canary_quote_id)
      or (c.upload_mode='historical' and s->'historicalApproval'='null'::jsonb) then raise exception 'Sale changed before dispatch' using errcode='40001'; end if;
    return '{}';
  elsif p_action='complete' and r.lane='sales' then
    select * into strict sale from private.meta_sales where quote_id=(p_input->>'quoteId')::uuid and lease_id=p_run and state='SENDING' for update;
    if p_input->>'state' is null or p_input->>'state' not in('ACCEPTED','RETRY','REVIEW_REQUIRED')
      or (p_input->>'reason' is not null and p_input->>'reason' !~ '^[A-Z_]{1,80}$') then raise exception 'Invalid delivery result';end if;
    if p_input->>'state'='ACCEPTED' and (p_input->>'receiptId' is null or p_input->>'receiptId' !~ '^[A-Za-z0-9_-]{1,200}$') then raise exception 'Missing provider receipt'; end if;
    if p_input ? 'diagnostics' and (jsonb_typeof(p_input->'diagnostics')<>'object' or exists(select 1 from jsonb_each(p_input->'diagnostics') d
      where d.key not in('httpStatus','providerCode','subcode','warningCount') or jsonb_typeof(d.value)<>'number' or d.value::text !~ '^[0-9]{1,10}$')) then raise exception 'Unsafe diagnostics'; end if;
    update private.meta_sales set state=case when p_input->>'state'='RETRY' and (attempts>=5 or first_attempt_at<=now()-interval '24 hours') then 'REVIEW_REQUIRED' else p_input->>'state' end,
      reason=p_input->>'reason',receipt_id=coalesce(p_input->>'receiptId',receipt_id),diagnostics=p_input->'diagnostics',
      accepted_at=case when p_input->>'state'='ACCEPTED' then now() else accepted_at end,
      next_attempt_at=now()+make_interval(secs=>least(21600,greatest(60,coalesce((p_input->>'delaySeconds')::int,3600)))),lease_id=null,updated_at=now() where quote_id=sale.quote_id;
    return '{}';
  elsif p_action='finish' then
    if p_input->>'error' is not null and p_input->>'error' !~ '^[A-Z_]{1,80}$' then raise exception 'Invalid result';end if;
    update private.meta_sale_runs set finished_at=now(),error_code=p_input->>'error' where id=p_run;
    return '{}';
  end if;
  raise exception 'Unknown Meta sale command' using errcode='22023';
end $$;
revoke all on function public.meta_sale_command(uuid,text,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.meta_sale_command(uuid,text,text,uuid,jsonb) to service_role;

create function public.meta_sale_staff_read() returns jsonb language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$
declare c private.meta_sale_control; completed private.meta_sale_runs; authority text;
begin
  if auth.uid() is null or public.has_portal_access() is not true or not exists(select 1 from auth.users u where u.id=auth.uid()
    and lower(u.email)='jordan@sanctuarypergolas.co.nz' and u.email_confirmed_at is not null) then raise exception 'Developer access required' using errcode='42501';end if;
  select * into strict c from private.meta_sale_control where singleton=true;
  select * into completed from private.meta_sale_runs where generation=c.generation and lane='sales' and finished_at is not null order by finished_at desc,id desc limit 1;
  authority:=case when not c.uploads_enabled then 'DISABLED'
    when not exists(select 1 from auth.users u join public.portal_users p on p.user_id=u.id where u.id=c.actor_id and p.role in('admin','staff')
      and u.email_confirmed_at is not null and u.deleted_at is null and (u.banned_until is null or u.banned_until<now())) then 'ACTOR_UNAVAILABLE'
    when c.credential_expires_at is null or c.credential_expires_at<=now()+interval '1 minute' then 'CREDENTIAL_EXPIRED'
    when c.assignment_verified_at is null or c.binding_sha256 is null or c.dataset_id is null or not c.consent_policy_approved then 'SETUP_REQUIRED'
    else 'READY' end;
  return jsonb_build_object('enabled',c.uploads_enabled,'deliveryAuthority',authority,'mode',c.upload_mode,'datasetId',c.dataset_id,'checkedAt',now(),
    'lastCompletedAt',completed.finished_at,'error',completed.error_code,
    'pending',case when exists(select 1 from private.meta_sale_runs where finished_at is null and expires_at<=now()) then 'EXPIRED'
      when exists(select 1 from private.meta_sale_runs where finished_at is null) then 'RUNNING' else 'NONE' end,
    'counts',coalesce((select jsonb_object_agg(state,n) from (select state,count(*) n from private.meta_sales group by state) rows),'{}'),
    'reasons',coalesce((select jsonb_object_agg(reason,n) from (select reason,count(*) n from private.meta_sales where reason is not null group by reason) rows),'{}'),
    'assessedAt',(select max(assessed_at) from private.meta_sale_assessments),'assessedCount',(select count(*) from private.meta_sale_assessments),
    'assessmentReasons',coalesce((select jsonb_object_agg(reason,n) from (select value reason,count(*) n from private.meta_sale_assessments a cross join lateral jsonb_array_elements_text(a.reasons) group by value) rows),'{}'),
    'warningCount',coalesce((select sum((diagnostics->>'warningCount')::int) from private.meta_sales),0));
end $$;
revoke all on function public.meta_sale_staff_read() from public,anon,service_role;
grant execute on function public.meta_sale_staff_read() to authenticated;
