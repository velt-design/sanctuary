begin;
-- Formal comparison uses an immutable, cutoff-bound cohort. Ordinary late CRM
-- joins remain untouched. Consent-only attribution is never advertised as all
-- saved enquiries or a complete full-spend denominator.
create table public.meta_creative_formal_cohorts (
 experiment uuid primary key references public.meta_creative_execution(experiment),
 plan_hash text not null check(plan_hash ~ '^[a-f0-9]{64}$'),
 recorded_at timestamptz not null default clock_timestamp(),
 payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=100000)
);
alter table public.meta_creative_formal_cohorts enable row level security;
revoke all on public.meta_creative_formal_cohorts from public,anon,authenticated,service_role;
create trigger creative_formal_cohort_immutable before update or delete on public.meta_creative_formal_cohorts
 for each row execute function public.meta_creative_immutable();
create function public.meta_creative_formal_cohort(p_binding text,p_experiment uuid,p_freeze boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.meta_creative_control;x public.meta_creative_execution;s timestamptz;f timestamptz;m timestamptz;result jsonb;n integer;stamp timestamptz:=clock_timestamp();
begin
 perform pg_advisory_xact_lock(819421,1);
 select * into c from public.meta_creative_control where singleton;
 select * into x from public.meta_creative_execution where experiment=p_experiment;
 if p_freeze is null or c.binding is distinct from p_binding or c.binding is null or c.global_stop or not c.authority_current
  or x.experiment is null or x.plan->>'purpose' is distinct from 'formal_experiment' then raise exception 'Formal cohort unavailable';end if;
 select payload into result from public.meta_creative_formal_cohorts where experiment=p_experiment and plan_hash=x.plan_hash;
 if result is not null then return result;end if;
 s:=to_timestamp((x.plan->>'start')::double precision);f:=to_timestamp((x.plan->>'end')::double precision);m:=f+interval '72 hours';
 if p_freeze and stamp<m then raise exception 'Formal cohort not mature';end if;
 if not exists(select 1 from public.meta_creative_execution_receipts where experiment=p_experiment and stage='activation')
  or (select count(*)=2 and count(distinct arm)=2 from public.meta_creative_registered_ads() where experiment=p_experiment) is distinct from true then raise exception 'Formal registry incomplete';end if;
 select count(*) into n from public.enquiry_requests where created_at>=s and created_at<=m;
 if n>2000 then raise exception 'Formal cohort exceeds bound';end if;
 with registered as materialized(select * from public.meta_creative_registered_ads() where experiment=p_experiment),
 matching as materialized(
  select e.*,r.arm,r.ad_id,
   exists(select 1 from public.meta_creative_enquiries j join public.meta_creative_visits v on v.id=j.visit
    where j.enquiry_id=e.id and v.experiment=p_experiment and v.ad_id=r.ad_id and v.arm=r.arm and v.page_path=r.page_path
     and v.template=x.plan->>'landingTemplate' and v.created_at>=s and v.created_at<f
     and v.exposed_at>=v.created_at and v.exposed_at<f and v.exposed_at<=e.created_at and v.revoked_at is null) enrolled,
   e.id=(select first.id from public.enquiry_requests first where first.project_id=e.project_id order by first.created_at,first.id limit 1) first_project
  from public.enquiry_requests e join registered r on r.ad_id=e.raw_payload#>>'{attribution,utm,utm_content}'
  where e.created_at>=s and e.created_at<=m and e.raw_payload#>>'{attribution,consent,marketing}'='true'
   and e.raw_payload#>>'{attribution,utm,utm_campaign}'=r.campaign_id and e.raw_payload#>>'{attribution,utm,utm_term}'=r.adset_id
   and (e.page=r.page_path or e.raw_payload#>>'{enquiryContext,sourcePath}'=r.page_path)
   and (e.utm->>'utm_content' is null or e.utm->>'utm_content'=r.ad_id)
   and (e.utm->>'utm_campaign' is null or e.utm->>'utm_campaign'=r.campaign_id)
   and (e.utm->>'utm_term' is null or e.utm->>'utm_term'=r.adset_id)
 ), included as materialized(
  select e.arm,e.ad_id,e.id,e.created_at,(select q.state from private.enquiry_qualification_events q
   where q.enquiry_id=e.id and q.project_id=e.project_id and q.recorded_at<=least(stamp,m) order by q.version desc limit 1) qualification
  from matching e where e.project_id is not null and e.first_project and (e.created_at<f or e.enrolled)
 ), quality as(select arm,ad_id ad,encode(sha256(convert_to('sp_enq_'||id::text,'UTF8')),'hex') key,
   created_at "savedAt",qualification from included order by id limit 400),
 arms as(select r.arm,r.ad_id ad,count(e.id)::integer enquiries from registered r left join included e on e.arm=r.arm group by r.arm,r.ad_id)
 select jsonb_build_object('version',1,'experiment',p_experiment,'planHash',x.plan_hash,'observedAt',stamp,
  'startsAt',s,'endsAt',f,'maturesAt',m,'frozen',p_freeze,'attributionCoverage','consented_attributable_only','allSavedCoverage','unknown',
  'deduplication','first_saved_enquiry_per_canonical_project','arms',coalesce((select jsonb_agg(arms order by arm) from arms),'[]'),
  'unresolvedLate', (select count(*) from matching where created_at>=f and not enrolled),
  'quality',coalesce((select jsonb_agg(quality order by key) from quality),'[]'),
  'qualityOmitted',greatest(0,(select count(*) from included)-400)) into result;
 if p_freeze then insert into public.meta_creative_formal_cohorts(experiment,plan_hash,payload)values(p_experiment,x.plan_hash,result);end if;
 return result;
end$$;
revoke all on function public.meta_creative_formal_cohort(text,uuid,boolean) from public,anon,authenticated;
grant execute on function public.meta_creative_formal_cohort(text,uuid,boolean) to service_role;
alter function public.meta_creative_executor_command(text,uuid,uuid,text,jsonb) rename to meta_creative_executor_without_formal_cohort;
revoke all on function public.meta_creative_executor_without_formal_cohort(text,uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
create function public.meta_creative_executor_command(p_binding text,p_command uuid,p_experiment uuid,p_stage text,p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if p_stage='cohort' then
  if p_command is null or jsonb_typeof(p_payload) is distinct from 'object' or p_payload-array['freeze']<>'{}'::jsonb
    or jsonb_typeof(p_payload->'freeze') is distinct from 'boolean' then raise exception 'Invalid cohort command';end if;
  return public.meta_creative_formal_cohort(p_binding,p_experiment,(p_payload->>'freeze')::boolean);
 end if;
 return public.meta_creative_executor_without_formal_cohort(p_binding,p_command,p_experiment,p_stage,p_payload);
end$$;
revoke all on function public.meta_creative_executor_command(text,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.meta_creative_executor_command(text,uuid,uuid,text,jsonb) to service_role;
commit;
