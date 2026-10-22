begin;
select pg_advisory_xact_lock(819421,1);
-- Versioned finite ambiguity policy. Existing frozen cohorts/analyses are never rewritten.
alter function public.meta_creative_formal_cohort(text,uuid,boolean) rename to meta_creative_formal_cohort_v1;
revoke all on function public.meta_creative_formal_cohort_v1(text,uuid,boolean) from public,anon,authenticated,service_role;
create or replace function public.meta_creative_formal_cohort(p_binding text,p_experiment uuid,p_freeze boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.meta_creative_control;x public.meta_creative_execution;s timestamptz;f timestamptz;m timestamptz;result jsonb;n integer;stamp timestamptz:=clock_timestamp();
begin
 perform pg_advisory_xact_lock(819421,1);
 select * into c from public.meta_creative_control where singleton;
 select * into x from public.meta_creative_execution where experiment=p_experiment;
 if p_freeze is null or c.binding is distinct from p_binding or c.binding is null or c.global_stop or not c.authority_current
  or x.experiment is null or x.plan->>'purpose' is distinct from 'formal_experiment' then raise exception 'Formal cohort unavailable';end if;
 if x.plan#>>'{evaluation,ambiguity}' is distinct from 'finite_allocation_envelope_v1' then return public.meta_creative_formal_cohort_v1(p_binding,p_experiment,p_freeze);end if;
 select payload into result from public.meta_creative_formal_cohorts where experiment=p_experiment and plan_hash=x.plan_hash;
 if result is not null then return result;end if;
 s:=to_timestamp((x.plan->>'start')::double precision);f:=to_timestamp((x.plan->>'end')::double precision);m:=f+interval '72 hours';
 if p_freeze and stamp<m then raise exception 'Formal cohort not mature';end if;
 if not exists(select 1 from public.meta_creative_execution_receipts where experiment=p_experiment and stage='activation')
  or (select count(*)=2 and count(distinct arm)=2 from public.meta_creative_registered_ads() where experiment=p_experiment) is distinct from true then raise exception 'Formal registry incomplete';end if;
 select count(*) into n from public.enquiry_requests where created_at>=s and created_at<=m;
 if n>2000 then raise exception 'Formal cohort exceeds bound';end if;
 with registered as materialized(select * from public.meta_creative_registered_ads() where experiment=p_experiment),
 website as materialized(
  select e.*,e.raw_payload#>>'{attribution,utm,utm_content}' ad,
   e.raw_payload#>>'{attribution,utm,utm_campaign}' campaign,e.raw_payload#>>'{attribution,utm,utm_term}' adset,
   case when e.page in('/auckland-outdoor-living','/acrylic-roof-pergolas-auckland') and (e.raw_payload#>>'{enquiryContext,sourcePath}' is null or e.raw_payload#>>'{enquiryContext,sourcePath}'=e.page) then e.page when e.page='/contact' and e.raw_payload#>>'{enquiryContext,sourcePath}' in('/auckland-outdoor-living','/acrylic-roof-pergolas-auckland') then e.raw_payload#>>'{enquiryContext,sourcePath}' else null end route
  from public.enquiry_requests e where e.created_at>=s and e.created_at<=m and e.source='website'
   and e.id not in ('f3229ccf-6a1a-4e1a-bcf4-2edf5cc85e70'::uuid,'fdb7aa7a-bb3f-4fb3-89ed-ac3483d21118'::uuid)
   and (e.project_id is null or e.project_id not in ('10c5db1a-602c-4f0c-8193-855b186215bb'::uuid,'9d98b82b-679a-4ecb-8265-9fa05eaa78ef'::uuid))
   and (e.project_id is null or e.id=(select first.id from public.enquiry_requests first where first.project_id=e.project_id
    and first.id not in ('f3229ccf-6a1a-4e1a-bcf4-2edf5cc85e70'::uuid,'fdb7aa7a-bb3f-4fb3-89ed-ac3483d21118'::uuid) order by first.created_at,first.id limit 1))
 ), classified as materialized(
  select e.*,case when e.raw_payload#>>'{attribution,consent,marketing}'='true'
   and (e.utm->>'utm_content' is null or e.utm->>'utm_content'=e.ad)
   and (e.utm->>'utm_campaign' is null or e.utm->>'utm_campaign'=e.campaign)
   and (e.utm->>'utm_term' is null or e.utm->>'utm_term'=e.adset)
   then case
    when exists(select 1 from registered r where r.ad_id=e.ad and r.campaign_id=e.campaign and r.adset_id=e.adset and r.page_path=e.route) then 'native'
    when e.campaign=x.plan#>>'{scope,campaign}' and e.adset=x.plan#>>'{scope,adset}' and x.plan->'originalAds' ? e.ad
     and e.route in('/auckland-outdoor-living','/acrylic-roof-pergolas-auckland') then 'known_other'
    when exists(select 1 from public.meta_creative_registered_ads() r join public.meta_creative_execution other on other.experiment=r.experiment where other.plan->>'purpose'='formal_experiment' and exists(select 1 from public.meta_creative_execution_receipts proof where proof.experiment=r.experiment and proof.stage='activation') and r.experiment<>p_experiment and r.ad_id=e.ad and r.campaign_id=e.campaign and r.adset_id=e.adset and r.page_path=e.route) then 'known_other'
    else 'unknown' end else 'unknown' end coverage_kind
  from website e
 ), matching as materialized(
  select e.*,r.arm,r.ad_id,
   exists(select 1 from public.meta_creative_enquiries j join public.meta_creative_visits v on v.id=j.visit
    where j.enquiry_id=e.id and v.experiment=p_experiment and v.ad_id=r.ad_id and v.arm=r.arm and v.page_path=r.page_path
     and v.template=x.plan->>'landingTemplate' and v.created_at>=s and v.created_at<f
     and v.exposed_at>=v.created_at and v.exposed_at<f and v.exposed_at<=e.created_at and v.revoked_at is null) enrolled
  from classified e join registered r on r.ad_id=e.ad where e.coverage_kind='native'
 ), included as materialized(
  select e.arm,e.ad_id,e.id,e.created_at,(select q.state from private.enquiry_qualification_events q
   where q.enquiry_id=e.id and q.project_id=e.project_id and q.recorded_at<=least(stamp,m) order by q.version desc limit 1) qualification
  from matching e where e.created_at<f or e.enrolled
 ), unassigned as materialized(
  select id,project_id,created_at from classified where coverage_kind='unknown'
  union all select id,project_id,created_at from matching where created_at>=f and not enrolled
 ), ambiguous as materialized(
  select e.id,e.created_at,(select q.state from private.enquiry_qualification_events q where q.enquiry_id=e.id and q.project_id=e.project_id and q.recorded_at<=least(stamp,m) order by q.version desc limit 1) qualification from unassigned e
 ), conflicting_join as materialized(
  select distinct e.id from classified e join public.meta_creative_enquiries j on j.enquiry_id=e.id join public.meta_creative_visits v on v.id=j.visit
  where v.experiment=p_experiment and not(coalesce(e.coverage_kind='native' and e.ad=v.ad_id and e.route=v.page_path and v.template=x.plan->>'landingTemplate'
   and exists(select 1 from registered r where r.ad_id=v.ad_id and r.arm=v.arm and r.page_path=v.page_path)
   and v.created_at>=s and v.created_at<f and v.exposed_at>=v.created_at and v.exposed_at<f and v.exposed_at<=e.created_at and v.revoked_at is null,false))
 ), quality as(select arm,ad_id ad,encode(sha256(convert_to('sp_enq_'||id::text,'UTF8')),'hex') key,
   created_at "savedAt",qualification from included order by id limit 400),
 ambiguous_quality as(select encode(sha256(convert_to('sp_enq_'||id::text,'UTF8')),'hex') key,created_at "savedAt",qualification from ambiguous order by id limit greatest(0,400-(select count(*)from quality))),
 arms as(select r.arm,r.ad_id ad,count(e.id)::integer enquiries from registered r left join included e on e.arm=r.arm group by r.arm,r.ad_id)
 select jsonb_build_object('version',2,'experiment',p_experiment,'planHash',x.plan_hash,'observedAt',stamp,
  'startsAt',s,'endsAt',f,'maturesAt',m,'frozen',p_freeze,'attributionCoverage','consented_attributable_only','allSavedCoverage',case when not exists(select 1 from classified where coverage_kind='unknown') and not exists(select 1 from matching where created_at>=f and not enrolled) then 'complete' else 'unknown' end,
  'coverage',jsonb_build_object('websiteGenuine',(select count(*)from classified),'nativeMatched',(select count(*)from included),
   'knownOtherRegistered',(select count(*)from classified where coverage_kind='known_other'),'unknownAttribution',(select count(*)from classified where coverage_kind='unknown'),
   'unlinkedNative',(select count(*)from matching where project_id is null and (created_at<f or enrolled))),
  'deduplication','first_saved_per_project_else_enquiry','arms',coalesce((select jsonb_agg(arms order by arm) from arms),'[]'),
  'unresolvedLate', (select count(*) from matching where created_at>=f and not enrolled),
  'ambiguity',jsonb_build_object('pool',(select count(*)from ambiguous),'joinConflicts',(select count(*)from conflicting_join),'canonicalAdverse',(select count(*)from ambiguous where qualification='not_qualified'),
   'quality',coalesce((select jsonb_agg(ambiguous_quality order by key)from ambiguous_quality),'[]'),'qualityOmitted',(select count(*)from ambiguous)-(select count(*)from ambiguous_quality)),
  'quality',coalesce((select jsonb_agg(quality order by key) from quality),'[]'),
  'qualityOmitted',greatest(0,(select count(*) from included)-400)) into result;
 if p_freeze then insert into public.meta_creative_formal_cohorts(experiment,plan_hash,payload)values(p_experiment,x.plan_hash,result);end if;
 return result;
end$$;
revoke all on function public.meta_creative_formal_cohort(text,uuid,boolean) from public,anon,authenticated;
grant execute on function public.meta_creative_formal_cohort(text,uuid,boolean) to service_role;
create function public.meta_creative_analysis_v1_valid(a jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare v jsonb;k text;c jsonb;t jsonb;n numeric;cov jsonb;
begin
 if jsonb_typeof(a) is distinct from 'object' or a-array['version','experiment','planHash','policy','observedAt','cohortHash','spendHash','deliveryHash','sourceDates','allSavedCoverage','coverageCounts','unresolvedLate','arms','decision','reason','interval','quality']<>'{}'::jsonb or (select count(*)from jsonb_object_keys(a))<>17 then return false;end if;
 if a->'version' is distinct from '1'::jsonb or a->>'policy' is distinct from 'native-saved-enquiry-per-dollar-v1' or coalesce(a->>'experiment','')!~'^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' then return false;end if;
 foreach k in array array['planHash','cohortHash','spendHash','deliveryHash']loop if jsonb_typeof(a->k) is distinct from 'string' or a->>k!~'^[a-f0-9]{64}$'then return false;end if;end loop;
 if jsonb_typeof(a->'sourceDates') is distinct from 'object' or (a->'sourceDates')-array['cohort','spend','delivery']<>'{}'::jsonb or (select count(*)from jsonb_object_keys(a->'sourceDates'))<>3 then return false;end if;
 for v in select value from jsonb_each(a->'sourceDates') union all select a->'observedAt' loop
  if jsonb_typeof(v) is distinct from 'string' or v#>>'{}'!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$' then return false;end if;
 end loop;
 if jsonb_typeof(a->'allSavedCoverage') is distinct from 'string' or a->>'allSavedCoverage' not in('complete','unknown') or jsonb_typeof(a->'decision') is distinct from 'string' or a->>'decision' not in('retain','revert','inconclusive') or jsonb_typeof(a->'reason') is distinct from 'string' or a->>'reason' not in('formal_interval','no_enquiries','no_delivery','evidence_incomplete') or jsonb_typeof(a->'quality') is distinct from 'string' or a->>'quality' not in('passes','unknown_or_fails') then return false;end if;
 cov:=a->'coverageCounts';
 if jsonb_typeof(cov) is distinct from 'object' or cov-array['websiteGenuine','nativeMatched','knownOtherRegistered','unknownAttribution','unlinkedNative']<>'{}'::jsonb or (select count(*)from jsonb_object_keys(cov))<>5 then return false;end if;
 for v in select value from jsonb_each(cov) union all select a->'unresolvedLate' loop if jsonb_typeof(v) is distinct from 'number' or v::text!~'^[0-9]+$' or (v::text)::numeric>2000 then return false;end if;end loop;
 if jsonb_typeof(a->'arms') is distinct from 'array' or jsonb_array_length(a->'arms')<>2 then return false;end if;
 for v in select value from jsonb_array_elements(a->'arms')loop
  if jsonb_typeof(v) is distinct from 'object' or v-array['arm','ad','enquiries','spend','canonical','correspondence','intake','assessed','concerns','conflicting','unknown']<>'{}'::jsonb or (select count(*)from jsonb_object_keys(v))<>11 or coalesce(v->>'arm','') not in('control','challenger') or jsonb_typeof(v->'ad') is distinct from 'string' or v->>'ad'!~'^[1-9][0-9]{0,19}$' then return false;end if;
  foreach k in array array['enquiries','canonical','correspondence','intake','assessed','concerns','conflicting','unknown']loop if jsonb_typeof(v->k) is distinct from 'number' or (v->k)::text!~'^[0-9]+$' or (v->>k)::numeric>2000 then return false;end if;end loop;
  if v->'spend'<>'null'::jsonb and(jsonb_typeof(v->'spend') is distinct from 'number')then return false;end if;
  if v->'spend'<>'null'::jsonb and((v->>'spend')::numeric<0 or(v->>'spend')::numeric>1000000)then return false;end if;
  if (v->>'assessed')::int<>(v->>'canonical')::int+(v->>'correspondence')::int+(v->>'intake')::int or(v->>'unknown')::int<>(v->>'enquiries')::int-(v->>'assessed')::int or(v->>'concerns')::int>(v->>'assessed')::int or(v->>'conflicting')::int>(v->>'unknown')::int then return false;end if;
  if v->>'arm'='control' then if c is not null then return false;end if;c:=v;else if t is not null then return false;end if;t:=v;end if;
 end loop;
 if c is null or t is null or c->>'ad'=t->>'ad' or(cov->>'nativeMatched')::int<>(c->>'enquiries')::int+(t->>'enquiries')::int or(cov->>'websiteGenuine')::int<>(cov->>'nativeMatched')::int+(cov->>'knownOtherRegistered')::int+(cov->>'unknownAttribution')::int+(a->>'unresolvedLate')::int or a->>'allSavedCoverage' is distinct from (case when(cov->>'unknownAttribution')::int=0 and(a->>'unresolvedLate')::int=0 then 'complete' else 'unknown' end) then return false;end if;
 v:=a->'interval';
 if v<>'null'::jsonb then
  if jsonb_typeof(v) is distinct from 'object' or v-array['lower','upper','upperUnbounded']<>'{}'::jsonb or(select count(*)from jsonb_object_keys(v))<>3 or jsonb_typeof(v->'lower') is distinct from 'number' or jsonb_typeof(v->'upperUnbounded') is distinct from 'boolean' or(v->'upper'<>'null'::jsonb and jsonb_typeof(v->'upper') is distinct from 'number')then return false;end if;
  if(v->>'lower')::numeric<0 or(v->>'upperUnbounded')::boolean is distinct from(v->'upper'='null'::jsonb) or(v->'upper'<>'null'::jsonb and(v->>'upper')::numeric<(v->>'lower')::numeric)then return false;end if;
 end if;
 if a->>'decision'<>'inconclusive' and(a->>'reason'<>'formal_interval' or a->>'allSavedCoverage'<>'complete' or coalesce((c->>'spend')::numeric,0)<=0 or coalesce((t->>'spend')::numeric,0)<=0 or v='null'::jsonb)then return false;end if;
 if a->>'decision'='retain' then
  if a->>'quality'<>'passes' or(v->>'lower')::numeric<=1 or(c->>'assessed')::int<5 or(t->>'assessed')::int<5 then return false;end if;
  if(c->>'assessed')::numeric/(c->>'enquiries')::numeric<.5 or(t->>'assessed')::numeric/(t->>'enquiries')::numeric<.5 or abs((c->>'assessed')::numeric/(c->>'enquiries')::numeric-(t->>'assessed')::numeric/(t->>'enquiries')::numeric)>.200000000000001 or(t->>'concerns')::numeric/(t->>'assessed')::numeric>(c->>'concerns')::numeric/(c->>'assessed')::numeric or(t->>'conflicting')::int>0 then return false;end if;
 end if;
 if a->>'decision'='revert' and(v->'upper'='null'::jsonb or(v->>'upper')::numeric>=1)then return false;end if;
 return true;
end$$;
revoke all on function public.meta_creative_analysis_v1_valid(jsonb) from public,anon,authenticated,service_role;

-- Exact conditional Poisson endpoints, same finite binomial inversion as Velt.
create function public.meta_creative_binomial_cdf(k integer,n integer,p double precision) returns double precision language plpgsql immutable set search_path='' as $$
declare term double precision;total double precision;largest double precision;i integer;
begin
 if n<0 or n>2000 or k<0 or k>n or p<0 or p>1 then raise exception 'Interval bound';end if;
 if p=0 then return 1;end if;if p=1 then return case when k=n then 1 else 0 end;end if;
 term:=n*ln(1-p);total:=term;
 for i in 1..k loop term:=term+ln((n-i+1)::double precision)-ln(i::double precision)+ln(p)-ln(1-p);largest:=greatest(total,term);total:=largest+ln((case when total-largest < -740 then 0 else exp(total-largest)end)+(case when term-largest < -740 then 0 else exp(term-largest)end));end loop;
 return case when total < -740 then 0 else least(1,exp(total))end;
end$$;
create function public.meta_creative_rate_interval(ec integer,et integer,sc double precision,st double precision) returns jsonb language plpgsql immutable set search_path='' as $$
declare n integer:=ec+et;lo double precision;hi double precision;p double precision;lower_p double precision;upper_p double precision;i integer;
begin
 if ec<0 or et<0 or n>2000 or sc<=0 or st<=0 or sc>1000000 or st>1000000 then raise exception 'Rate bound';end if;
 if n=0 then return null;end if;
 if et=0 then lower_p:=0;else
  lo:=0;hi:=1;for i in 1..64 loop p:=(lo+hi)/2;if public.meta_creative_binomial_cdf(et-1,n,p)>.975 then lo:=p;else hi:=p;end if;end loop;lower_p:=(lo+hi)/2;
 end if;
 if et=n then upper_p:=1;else
  lo:=0;hi:=1;for i in 1..64 loop p:=(lo+hi)/2;if public.meta_creative_binomial_cdf(et,n,p)>.025 then lo:=p;else hi:=p;end if;end loop;upper_p:=(lo+hi)/2;
 end if;
 return jsonb_build_object('lower',lower_p/(1-lower_p)*sc/st,'upper',case when upper_p=1 then null else upper_p/(1-upper_p)*sc/st end,'upperUnbounded',upper_p=1);
end$$;
revoke all on function public.meta_creative_binomial_cdf(integer,integer,double precision),public.meta_creative_rate_interval(integer,integer,double precision,double precision) from public,anon,authenticated,service_role;

create or replace function public.meta_creative_analysis_valid(a jsonb) returns boolean language plpgsql immutable set search_path='' as $$
declare s jsonb;c jsonb;t jsonb;v jsonb;low jsonb;high jsonb;k text;u integer;i integer;ec integer;et integer;ac integer;atc integer;bc integer;bt integer;sc double precision;st double precision;
 lc double precision;lt double precision;hc double precision;ht double precision;quality boolean;decision text;reason text;expected jsonb;
begin
 if a->'version'='1'::jsonb then return public.meta_creative_analysis_v1_valid(a);end if;
 if a->'version' is distinct from '2'::jsonb or a->>'policy' is distinct from 'native-saved-enquiry-per-dollar-v2' then return false;end if;
 if coalesce(a->>'qualityHash','')!~'^[a-f0-9]{64}$'then return false;end if;
 if not public.meta_creative_analysis_v1_valid((a-array['sensitivity','qualityHash'])||'{"version":1,"policy":"native-saved-enquiry-per-dollar-v1","decision":"inconclusive"}'::jsonb) then return false;end if;
 s:=a->'sensitivity';
 if jsonb_typeof(s) is distinct from 'object' or s-array['pool','joinConflicts','qualityEvidenceComplete','unassignedAdverse']<>'{}'::jsonb or(select count(*)from jsonb_object_keys(s))<>4 or jsonb_typeof(s->'qualityEvidenceComplete') is distinct from 'boolean' then return false;end if;
 foreach k in array array['pool','joinConflicts','unassignedAdverse']loop if jsonb_typeof(s->k) is distinct from 'number' or(s->k)::text!~'^[0-9]+$'or(s->>k)::numeric>2000 then return false;end if;end loop;
 u:=(s->>'pool')::integer;
 if u<>(a#>>'{coverageCounts,unknownAttribution}')::integer+(a->>'unresolvedLate')::integer or(s->>'unassignedAdverse')::integer>u then return false;end if;
 select value into c from jsonb_array_elements(a->'arms')where value->>'arm'='control';select value into t from jsonb_array_elements(a->'arms')where value->>'arm'='challenger';
 ec:=(c->>'enquiries')::integer;et:=(t->>'enquiries')::integer;ac:=(c->>'assessed')::integer;atc:=(t->>'assessed')::integer;bc:=(c->>'concerns')::integer;bt:=(t->>'concerns')::integer;sc:=(c->>'spend')::double precision;st:=(t->>'spend')::double precision;
 if ec+et+u>2000 then return false;end if;
 quality:=(s->>'qualityEvidenceComplete')::boolean and(s->>'unassignedAdverse')::int=0 and(c->>'conflicting')::int=0 and(t->>'conflicting')::int=0 and ac>=5 and atc>=5;
 if quality then for i in 0..u loop
  lc:=ac::double precision/(ec+i);lt:=atc::double precision/(et+u-i);hc:=(ac+i)::double precision/(ec+i);ht:=(atc+u-i)::double precision/(et+u-i);
  if 2*ac<ec+i or 2*atc<et+u-i or 5*((ac+i)*(et+u-i)-atc*(ec+i))>(ec+i)*(et+u-i) or 5*((atc+u-i)*(ec+i)-ac*(et+u-i))>(ec+i)*(et+u-i) or(bt+u-i)*(ac+i)>bc*(atc+u-i) then quality:=false;exit;end if;
 end loop;end if;
 if a->>'quality' is distinct from(case when quality then 'passes'else'unknown_or_fails'end)then return false;end if;
 if sc=0 or st=0 then reason:='no_delivery';decision:='inconclusive';
 elsif a->>'reason'='evidence_incomplete' or sc is null or st is null or(s->>'joinConflicts')::int>0 then reason:='evidence_incomplete';decision:='inconclusive';
 else
  low:=public.meta_creative_rate_interval(ec+u,et,sc,st);high:=public.meta_creative_rate_interval(ec,et+u,sc,st);
  if low is null or high is null then reason:='no_enquiries';decision:='inconclusive';else
   expected:=jsonb_build_object('lower',low->'lower','upper',high->'upper','upperUnbounded',high->'upperUnbounded');reason:='formal_interval';
   decision:=case when high->'upper'<>'null'::jsonb and(high->>'upper')::double precision<1 then 'revert'when(low->>'lower')::double precision>1 and quality then 'retain'else'inconclusive'end;
  end if;
 end if;
 if a->>'decision' is distinct from decision or a->>'reason' is distinct from reason then return false;end if;
 v:=a->'interval';if expected is null then return v='null'::jsonb;end if;
 if v='null'::jsonb or v->'upperUnbounded' is distinct from expected->'upperUnbounded' then return false;end if;
 if abs((v->>'lower')::double precision-(expected->>'lower')::double precision)>1e-9*greatest(1,(expected->>'lower')::double precision)then return false;end if;
 if expected->'upper'<>'null'::jsonb and abs((v->>'upper')::double precision-(expected->>'upper')::double precision)>1e-9*greatest(1,(expected->>'upper')::double precision)then return false;end if;
 -- Direction is computed from our endpoints, not a caller's rounded interval.
 return true;
end$$;
revoke all on function public.meta_creative_analysis_valid(jsonb) from public,anon,authenticated,service_role;

alter function public.meta_creative_executor_command(text,uuid,uuid,text,jsonb) rename to meta_creative_executor_without_ambiguity;
revoke all on function public.meta_creative_executor_without_ambiguity(text,uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
create function public.meta_creative_executor_command(p_binding text,p_command uuid,p_experiment uuid,p_stage text,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare x public.meta_creative_execution;cohort jsonb;a jsonb;result jsonb;
begin
 perform pg_advisory_xact_lock(819421,1);
 if p_stage='prepare' and p_payload#>>'{plan,purpose}'='formal_experiment' and not exists(select 1 from public.meta_creative_execution where experiment=p_experiment) and(p_payload#>>'{plan,evaluation,ambiguity}' is distinct from 'finite_allocation_envelope_v1' or p_payload#>>'{plan,evaluation,unknownMeans}' is distinct from 'finite_pool_sensitivity_else_inconclusive')then raise exception 'Declared ambiguity policy required';end if;
 if p_stage='analysis' then
  select * into x from public.meta_creative_execution where experiment=p_experiment;a:=p_payload->'analysis';
  if coalesce(x.plan#>>'{evaluation,ambiguity}'='finite_allocation_envelope_v1',false) is distinct from(a->'version'='2'::jsonb)then raise exception 'Formal policy differs';end if;
  if a->'version'='2'::jsonb then
   select payload into cohort from public.meta_creative_formal_cohorts where experiment=p_experiment and plan_hash=x.plan_hash;
   if cohort->'version' is distinct from '2'::jsonb or a#>'{sensitivity,pool}' is distinct from cohort#>'{ambiguity,pool}' or a#>'{sensitivity,joinConflicts}' is distinct from cohort#>'{ambiguity,joinConflicts}'
    or coalesce((a#>>'{sensitivity,unassignedAdverse}')::integer,-1)<(cohort#>>'{ambiguity,canonicalAdverse}')::integer
    or a#>'{sensitivity,qualityEvidenceComplete}' is distinct from to_jsonb((cohort->>'qualityOmitted')::integer=0 and(cohort#>>'{ambiguity,qualityOmitted}')::integer=0)then raise exception 'Sensitivity source differs';end if;
  end if;
 end if;
 result:=public.meta_creative_executor_without_ambiguity(p_binding,p_command,p_experiment,p_stage,p_payload);
 if p_stage='history' then return result||jsonb_build_object('version',3);end if;
 return result;
end$$;
revoke all on function public.meta_creative_executor_command(text,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.meta_creative_executor_command(text,uuid,uuid,text,jsonb) to service_role;
create or replace function public.meta_creative_learning(p_scope jsonb,p_originals jsonb,p_native text,p_donor text,p_template text,p_control jsonb)
returns jsonb language sql stable set search_path='' as $$
 with terminal as (
  select x.experiment,x.plan->>'challengerPrimary' as primary_text,a.payload,
   encode(sha256(convert_to(to_jsonb(x.plan->>'challengerPrimary')::text,'UTF8')),'hex') as copy_hash
  from public.meta_creative_execution x join public.meta_creative_formal_analysis a on a.experiment=x.experiment
  where x.plan->>'purpose'='formal_experiment' and x.plan->'scope'=p_scope and x.plan->'originalAds'=p_originals
   and x.plan->>'nativeContractHash'=p_native and x.plan->>'controlAd'=p_donor and x.plan->>'landingTemplate'=p_template
   and x.plan->'control'=p_control and a.payload->>'planHash'=x.plan_hash and x.plan->>'challengerPrimary' is not null
 ), distinct_copies as(select distinct copy_hash from terminal), tail as(
  select jsonb_build_object('copyHash',copy_hash,'hookPrefix',left(rtrim(split_part(primary_text,E'\n',1),E'\r'),160),'result',case payload->>'decision'when 'revert'then 'reverted'when 'retain'then 'retained'else payload->>'decision'end,
   'policy',payload->'policy','sensitivityInterval',case when payload->'version'='2'::jsonb then payload->'interval'else'null'::jsonb end,
   'observedAt',payload->'observedAt','reason',payload->'reason','quality',payload->'quality',
   'coverage',jsonb_build_object('allSaved',payload->'allSavedCoverage','unassigned',(payload#>>'{coverageCounts,unknownAttribution}')::integer+(payload->>'unresolvedLate')::integer),
   'enquiries',jsonb_build_array((select v->'enquiries'from jsonb_array_elements(payload->'arms')v where v->>'arm'='control'),(select v->'enquiries'from jsonb_array_elements(payload->'arms')v where v->>'arm'='challenger')),
   'spend',jsonb_build_array((select v->'spend'from jsonb_array_elements(payload->'arms')v where v->>'arm'='control'),(select v->'spend'from jsonb_array_elements(payload->'arms')v where v->>'arm'='challenger'))) as summary,
   (payload->>'observedAt')::timestamptz as observed_at,experiment
  from terminal order by observed_at desc,experiment desc limit 4
 ) select jsonb_build_object('previous',(select coalesce(jsonb_agg(summary order by observed_at desc,experiment desc),'[]')from tail),
  'complete',(select count(*)<=64 from distinct_copies),
  'excluded',case when(select count(*)from distinct_copies)<=64 then(select coalesce(jsonb_agg(copy_hash order by copy_hash),'[]')from distinct_copies)else'[]'::jsonb end)
$$;
revoke all on function public.meta_creative_learning(jsonb,jsonb,text,text,text,jsonb) from public,anon,authenticated,service_role;
commit;
