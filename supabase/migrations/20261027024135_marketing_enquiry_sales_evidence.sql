-- Report-only policy. Existing audited classifications own the evidence;
-- customer records, payments and original source attribution stay intact.
create function private.marketing_test_project(p_project uuid) returns boolean
language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 select coalesce(p_project in ('10c5db1a-602c-4f0c-8193-855b186215bb'::uuid,'9d98b82b-679a-4ecb-8265-9fa05eaa78ef'::uuid),false)
   or exists(select 1 from private.project_sales_outcomes where project_id=p_project and outcome='test')
$$;
create function private.marketing_test_enquiry(p_enquiry uuid,p_project uuid) returns boolean
language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 select coalesce(p_enquiry in ('f3229ccf-6a1a-4e1a-bcf4-2edf5cc85e70'::uuid,'fdb7aa7a-bb3f-4fb3-89ed-ac3483d21118'::uuid),false)
   or private.marketing_test_project(p_project)
   or exists(select 1 from public.enquiry_requests e where e.id=p_enquiry
     and (e.raw_payload#>'{attribution,verification}'='true'::jsonb or (
     e.raw_payload#>'{attribution,consent,marketing}'='true'::jsonb
     and coalesce(e.raw_payload#>>'{attribution,utm,utm_source}',e.utm->>'utm_source')='codex_qa'
     and coalesce(e.raw_payload#>>'{attribution,utm,utm_medium}',e.utm->>'utm_medium')='qa')))
$$;
revoke all on function private.marketing_test_project(uuid),private.marketing_test_enquiry(uuid,uuid) from public,anon,authenticated,service_role;
-- The view caller needs function EXECUTE, but receives no private-schema USAGE
-- or raw table access. The functions return only a classification boolean.
grant execute on function private.marketing_test_project(uuid),private.marketing_test_enquiry(uuid,uuid) to sanctuary_praxis_reader;

-- Minimal projection for the existing restricted repeatable-read marketing summary.
-- No customer fields, reasons, actor identities or raw attribution are exposed.
create view praxis_reporting.marketing_test_projects_v1 with(security_barrier=true) as
 select p.id as project_id from public.projects p where private.marketing_test_project(p.id);
revoke all on praxis_reporting.marketing_test_projects_v1 from public,anon,authenticated,service_role;
grant select on praxis_reporting.marketing_test_projects_v1 to sanctuary_praxis_reader;
create view praxis_reporting.marketing_test_enquiries_v1 with(security_barrier=true) as
 select e.id as enquiry_id from public.enquiry_requests e where private.marketing_test_enquiry(e.id,e.project_id);
revoke all on praxis_reporting.marketing_test_enquiries_v1 from public,anon,authenticated,service_role;
grant select on praxis_reporting.marketing_test_enquiries_v1 to sanctuary_praxis_reader;

create or replace function private.marketing_observed_source(payload jsonb,legacy_utm jsonb)
returns text language sql immutable set search_path=pg_catalog,pg_temp as $$
 select case when payload #> '{attribution,consent,marketing}'='true'::jsonb then coalesce(
  nullif(btrim(payload#>>'{attribution,utm,utm_source}'),''),nullif(btrim(legacy_utm->>'utm_source'),''),
  case when exists(select 1 from (values('gclid'),('gbraid'),('wbraid')) keys(name)
    where jsonb_typeof(payload#>array['attribution','clickIds',name])='string'
      and length(payload#>>array['attribution','clickIds',name]) between 1 and 600
      and (payload#>>array['attribution','clickIds',name]) ~ '^[A-Za-z0-9_-]+$') then 'Google Ads' end,
  case substring(lower(payload#>>'{attribution,referrer}') from '^https?://([a-z0-9.-]+)(?:/[^[:space:]?#]*)?$')
    when 'google.com' then 'Google referral' when 'www.google.com' then 'Google referral'
    when 'facebook.com' then 'Facebook referral' when 'www.facebook.com' then 'Facebook referral'
    when 'l.facebook.com' then 'Facebook referral' when 'lm.facebook.com' then 'Facebook referral' when 'm.facebook.com' then 'Facebook referral'
    when 'instagram.com' then 'Instagram referral' when 'www.instagram.com' then 'Instagram referral'
    when 'bing.com' then 'Bing referral' when 'www.bing.com' then 'Bing referral'
    when 'chatgpt.com' then 'ChatGPT referral' when 'www.chatgpt.com' then 'ChatGPT referral' end
 ) end
$$;

-- Cash is the signed payment ledger, never quote value plus invoice status plus
-- Xero matches. Missing/malformed relationships make its value unavailable.
create function private.marketing_recorded_cash(p_project uuid) returns jsonb
language sql stable set search_path=pg_catalog,pg_temp as $$
 with entries as materialized (
  select e.*,p.id parent_id,p.project_id parent_project,p.entry_type parent_kind,p.amount_inc_gst_cents parent_amount,
    p.occurred_at parent_occurred_at,p.reverses_entry_id parent_reverses
  from public.project_payment_entries e left join public.project_payment_entries p on p.id=e.reverses_entry_id
  where e.project_id=p_project and e.entry_type in ('PAYMENT','REVERSAL')
 ), totals as (
  -- Valid adjustment reversals are non-cash, just like their parent adjustment.
  -- Still validate their relationship so malformed reversals cannot disappear.
  select count(*) filter(where parent_kind is distinct from 'ADJUSTMENT') n,
    sum(amount_inc_gst_cents::numeric) filter(where parent_kind is distinct from 'ADJUSTMENT') amount,
    bool_or(amount_inc_gst_cents is null or occurred_at is null or occurred_at>current_timestamp
      or (entry_type='PAYMENT' and (amount_inc_gst_cents<=0 or reverses_entry_id is not null))
      or (entry_type='REVERSAL' and (parent_id is null or parent_project is distinct from p_project
        or parent_kind not in ('PAYMENT','ADJUSTMENT') or parent_amount is null or parent_amount=0
        or parent_reverses is not null or parent_occurred_at is null or parent_occurred_at>current_timestamp
        or (parent_kind='PAYMENT' and parent_amount<=0)
        or amount_inc_gst_cents::numeric is distinct from -parent_amount::numeric))
      or (entry_type='REVERSAL' and (select count(*) from entries other where other.reverses_entry_id=entries.reverses_entry_id)>1)) invalid
  from entries
 ) select case when p_project is null then null else jsonb_build_object('amountCents',
   case when invalid or abs(coalesce(amount,0))>9007199254740991 then null else coalesce(amount,0) end,
   'entryCount',n,'complete',not coalesce(invalid,false) and abs(coalesce(amount,0))<=9007199254740991) end from totals
$$;
revoke all on function private.marketing_recorded_cash(uuid) from public,anon,authenticated,service_role;

-- Designer retains audited test rows for its existing review/clear workflow;
-- its consumer already excludes those rows from business totals.
-- Patch the current business owners in place, preserving identity, argument names, ACLs,
-- owner, security and all unrelated current-main corrections. Unknown baselines fail.
do $reporting$
declare target regprocedure; original text; changed text; alias text; item text; metadata jsonb;
 project_ids text := '(''10c5db1a-602c-4f0c-8193-855b186215bb''::uuid,''9d98b82b-679a-4ecb-8265-9fa05eaa78ef''::uuid)';
 enquiry_ids text := '(''f3229ccf-6a1a-4e1a-bcf4-2edf5cc85e70''::uuid,''fdb7aa7a-bb3f-4fb3-89ed-ac3483d21118''::uuid)';
begin
 perform set_config('lock_timeout','5s',true);
 foreach item in array array['public.marketing_performance_read(date,date)','public.marketing_sales_hub_read(date,date)',
   'public.marketing_commercial_performance_read(date,date)',
   'public.sanctuary_campaign_outcomes_without_intake(uuid,text,text,text,uuid,text,uuid)'] loop
  target:=to_regprocedure(item);
  if target is null then raise exception 'Missing reporting owner: %',item; end if;
  select to_jsonb(p)-'prosrc' into metadata from pg_proc p where oid=target;
  original:=pg_get_functiondef(target);changed:=original;
  foreach alias in array array['e.project_id','p.id','q.project_id','r.project_id'] loop
   changed:=replace(changed,alias||' not in '||project_ids,'not private.marketing_test_project('||alias||')');
   changed:=replace(changed,alias||' in '||project_ids,'private.marketing_test_project('||alias||')');
  end loop;
  foreach alias in array array['e','r'] loop
   changed:=replace(changed,alias||'.id not in '||enquiry_ids,'not private.marketing_test_enquiry('||alias||'.id,'||alias||'.project_id)');
   changed:=replace(changed,alias||'.id in '||enquiry_ids,'private.marketing_test_enquiry('||alias||'.id,'||alias||'.project_id)');
  end loop;
  if changed=original or position(project_ids in changed)>0 or position(enquiry_ids in changed)>0 then
   raise exception 'Unreviewed test exclusion owner: %',item; end if;
  if item='public.marketing_performance_read(date,date)' then
   if position('''closedOutcome'',p.closed_outcome' in changed)=0 then raise exception 'Unreviewed enquiry row'; end if;
   changed:=replace(changed,'''closedOutcome'',p.closed_outcome','''closedOutcome'',p.closed_outcome,''recordedCash'',private.marketing_recorded_cash(p.id)');
  end if;
  -- Ledger evidence supplements the existing legacy paid-invoice/match evidence.
  -- Monetary totals continue to come from the ledger alone.
  if item in ('public.marketing_performance_read(date,date)','public.marketing_sales_hub_read(date,date)') then
   if position('(exists(select 1 from public.xero_deposit_matches' in changed)=0 then raise exception 'Unreviewed payment owner'; end if;
   changed:=replace(changed,'(exists(select 1 from public.xero_deposit_matches','(coalesce((private.marketing_recorded_cash(p.id)->>''amountCents'')::numeric>0,false) or exists(select 1 from public.xero_deposit_matches');
  end if;
  execute changed;
  if metadata is distinct from (select to_jsonb(p)-'prosrc' from pg_proc p where oid=target) then raise exception 'Reporting authority changed'; end if;
 end loop;
end $reporting$;

-- The same confirmed tests must not become offline advertising sales. Keep
-- commercial facts and genuine-customer eligibility unchanged.
do $advertising$
declare target regprocedure:=to_regprocedure('private.advertising_scope_facts()'); before_catalog jsonb; definition text;
begin
 if target is null then raise exception 'Advertising source owner missing'; end if;
 select to_jsonb(p)-'prosrc' into before_catalog from pg_proc p where oid=target;
 definition:=pg_get_functiondef(target);
 if position('r.id<>''f3229ccf-6a1a-4e1a-bcf4-2edf5cc85e70''::uuid' in definition)=0
   or position('q.project_id<>''10c5db1a-602c-4f0c-8193-855b186215bb''::uuid' in definition)=0 then raise exception 'Unreviewed advertising source'; end if;
 definition:=replace(definition,'r.id<>''f3229ccf-6a1a-4e1a-bcf4-2edf5cc85e70''::uuid','not private.marketing_test_enquiry(r.id,r.project_id)');
 definition:=replace(definition,'q.project_id<>''10c5db1a-602c-4f0c-8193-855b186215bb''::uuid','not private.marketing_test_project(q.project_id)');
 execute definition;
 if before_catalog is distinct from (select to_jsonb(p)-'prosrc' from pg_proc p where oid=target) then raise exception 'Advertising authority changed'; end if;
end $advertising$;

-- Recheck current confirmed-project classification when a queued GA4 event is
-- claimed. Preserve its original audit payload and settle through the existing
-- SKIPPED delivery path; an old queued event must not bypass a later test mark.
do $delivery$
declare target regprocedure:=to_regprocedure('public.marketing_conversion_delivery_claim(integer,integer)'); metadata jsonb; definition text;
begin
 if target is null then raise exception 'Conversion delivery owner missing'; end if;
 select to_jsonb(p)-'prosrc' into metadata from pg_proc p where oid=target;
 definition:=pg_get_functiondef(target);
 if position('    event.payload,' in definition)=0 then raise exception 'Unreviewed conversion delivery owner'; end if;
 definition:=replace(definition,'    event.payload,',$replacement$    case when private.marketing_test_project(case when (event.payload->>'projectId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (event.payload->>'projectId')::uuid end)
      then event.payload || '{"verificationTraffic":true}'::jsonb else event.payload end,$replacement$);
 execute definition;
 if metadata is distinct from (select to_jsonb(p)-'prosrc' from pg_proc p where oid=target) then raise exception 'Conversion delivery authority changed'; end if;
end $delivery$;
