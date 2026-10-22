begin;
select pg_advisory_xact_lock(819421,1);
-- Shared strict aggregate domain. No free-form strings, customer rows or provider bodies.
create function public.meta_creative_analysis_valid(a jsonb) returns boolean language plpgsql immutable set search_path='' as $$
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
revoke all on function public.meta_creative_analysis_valid(jsonb) from public,anon,authenticated,service_role;

create table public.meta_creative_formal_analysis (
 experiment uuid primary key references public.meta_creative_execution(experiment),command uuid not null unique,
 recorded_at timestamptz not null default clock_timestamp(),payload jsonb not null check(octet_length(payload::text)<=12000 and public.meta_creative_analysis_valid(payload))
);
alter table public.meta_creative_formal_analysis enable row level security;
revoke all on public.meta_creative_formal_analysis from public,anon,authenticated,service_role;
create trigger creative_formal_analysis_immutable before update or delete on public.meta_creative_formal_analysis for each row execute function public.meta_creative_immutable();
alter table public.meta_creative_execution_receipts drop constraint meta_creative_execution_receipts_stage_check;
alter table public.meta_creative_execution_receipts add constraint meta_creative_execution_receipts_stage_check check(stage in('canary','measurement','activation','evaluation','cleanup','delivery_health','delivery_interrupted','analysis_started','analysis_ack'));
create function public.meta_creative_delivery_proof(p_experiment uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare x public.meta_creative_execution;a public.meta_creative_activation_proofs;n public.meta_creative_native_acceptance;started timestamptz;s timestamptz;f timestamptz;complete boolean;
begin
 select * into x from public.meta_creative_execution where experiment=p_experiment;
 select recorded_at into started from public.meta_creative_execution_receipts where experiment=p_experiment and stage='activation' order by recorded_at limit 1;
 if started is null then return null;end if;
 select p.* into a from public.meta_creative_activation_proofs p join public.meta_creative_effects e on e.command=p.command where p.experiment=p_experiment and e.state='confirmed' order by e.confirmed_at desc limit 1;
 select * into n from public.meta_creative_native_acceptance where id=(a.payload->>'acceptance')::uuid;
 if a.command is null or n.id is null then return null;end if;
 s:=to_timestamp((x.plan->>'start')::double precision);f:=to_timestamp((x.plan->>'end')::double precision);
 -- These are sampled normal checks, not continuous observation. Any gap above
 -- five hours or evidenced early stop withholds a commercial conclusion.
 with checks as(select recorded_at,lag(recorded_at)over(order by recorded_at)prior from public.meta_creative_execution_receipts where experiment=p_experiment and stage='delivery_health' and recorded_at>=s and recorded_at<f)
 select coalesce(min(recorded_at)<=s+interval '5 hours' and max(recorded_at)>=f-interval '5 hours' and bool_and(prior is null or recorded_at-prior<=interval '5 hours'),false) into complete from checks;
 complete:=complete and started<s and exists(select 1 from public.meta_creative_execution_receipts where experiment=p_experiment and stage='cleanup') and not exists(select 1 from public.meta_creative_execution_receipts where experiment=p_experiment and stage='delivery_interrupted')
  and not exists(select 1 from public.meta_creative_effects where experiment=p_experiment and kind='pause_ad' and confirmed_at<f);
 return jsonb_build_object('experiment',x.experiment,'planHash',x.plan_hash,'study',a.payload->>'study','objectiveProof',a.payload->>'objectiveProofHash','allocationProof',n.allocation_proof_hash,'verifiedAt',started,'startsAt',s,'endsAt',f,'windowComplete',complete,
  'arms',(select jsonb_agg(jsonb_build_object('arm',r.arm,'ad',r.ad_id,'scheduledStart',s,'scheduledEnd',f)order by r.arm)from public.meta_creative_registered_ads()r where r.experiment=p_experiment));
end$$;
revoke all on function public.meta_creative_delivery_proof(uuid) from public,anon,authenticated,service_role;
-- Keep the original reservation identity in the SAME locked transaction while
-- validating exact owned cleanup. No other lane can observe or acquire a gap.
alter function public.meta_creative_command(text,uuid,uuid,text,jsonb) rename to meta_creative_without_formal_settlement;
revoke all on function public.meta_creative_without_formal_settlement(text,uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
create function public.meta_creative_command(p_binding text,p_command uuid,p_experiment uuid,p_stage text,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.acquisition_experiment_reservation;hold boolean;result jsonb;
begin
 perform pg_advisory_xact_lock(819421,1);
 hold:=p_stage='cleanup' and exists(select 1 from public.meta_creative_execution_receipts where experiment=p_experiment and stage='activation') and not exists(select 1 from public.meta_creative_formal_analysis where experiment=p_experiment and payload->>'decision' in('revert','inconclusive')and exists(select 1 from public.meta_creative_execution_receipts where experiment=p_experiment and stage='analysis_ack'));
 if hold then select * into r from public.acquisition_experiment_reservation where singleton for update;if r.lane is distinct from 'creative' or r.experiment is distinct from p_experiment then raise exception 'Formal reservation differs';end if;end if;
 result:=public.meta_creative_without_formal_settlement(p_binding,p_command,p_experiment,p_stage,p_payload);
 if hold then insert into public.acquisition_experiment_reservation(singleton,lane,experiment,held_at)values(r.singleton,r.lane,r.experiment,r.held_at)on conflict(singleton)do nothing;return jsonb_build_object('released',false,'maturing',true);end if;
 return result;
end$$;
revoke all on function public.meta_creative_command(text,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.meta_creative_command(text,uuid,uuid,text,jsonb) to service_role;
alter function public.meta_creative_executor_command(text,uuid,uuid,text,jsonb) rename to meta_creative_executor_without_formal_analysis;
revoke all on function public.meta_creative_executor_without_formal_analysis(text,uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
create function public.meta_creative_executor_command(p_binding text,p_command uuid,p_experiment uuid,p_stage text,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.meta_creative_control;x public.meta_creative_execution;r public.acquisition_experiment_reservation;result jsonb;a jsonb;prior jsonb;cohort jsonb;delivery jsonb;arm jsonb;m timestamptz;
begin
 perform pg_advisory_xact_lock(819421,1);
 select * into c from public.meta_creative_control where singleton;
 if c.binding is null or c.binding is distinct from p_binding or p_command is null or p_payload is null or jsonb_typeof(p_payload) is distinct from 'object' then raise exception 'Creative authority unavailable';end if;
 if p_stage in('analysis_ack','analysis','begin_analysis','delivery_health')then
  select * into x from public.meta_creative_execution where experiment=p_experiment;
  select * into r from public.acquisition_experiment_reservation where singleton for update;
  if x.experiment is null or x.plan->>'purpose' is distinct from 'formal_experiment' or not exists(select 1 from public.meta_creative_execution_receipts where experiment=p_experiment and stage='activation')then raise exception 'Formal delivery unavailable';end if;
  if p_stage='analysis_ack' then
   select payload into a from public.meta_creative_formal_analysis where experiment=p_experiment and command::text=p_payload->>'analysisCommand';
   if p_payload-array['analysisCommand']<>'{}'::jsonb or a is null then raise exception 'Formal analysis acknowledgement differs';end if;
   insert into public.meta_creative_execution_receipts(command,experiment,stage,evidence_hash)values(p_command,p_experiment,'analysis_ack',x.plan_hash)on conflict(command)do nothing;
   if not exists(select 1 from public.meta_creative_execution_receipts where command=p_command and experiment=p_experiment and stage='analysis_ack')then raise exception 'Formal acknowledgement conflict';end if;
   if a->>'decision' in('inconclusive','revert')then delete from public.acquisition_experiment_reservation where singleton and lane='creative' and experiment=p_experiment;end if;
   return jsonb_build_object('acknowledged',true);
  end if;
  if p_stage='begin_analysis' then
   if not c.authority_current or c.global_stop or r.lane is distinct from 'creative' or r.experiment is distinct from p_experiment or p_payload-array['planHash']<>'{}'::jsonb or p_payload->>'planHash' is distinct from x.plan_hash or clock_timestamp()<to_timestamp((x.plan->>'end')::double precision)+interval '72 hours' or not exists(select 1 from public.meta_creative_execution_receipts where experiment=p_experiment and stage='cleanup')then raise exception 'Formal analysis not ready';end if;
   if exists(select 1 from public.meta_creative_execution_receipts where experiment=p_experiment and stage='analysis_started')then return jsonb_build_object('admitted',false);end if;
   insert into public.meta_creative_execution_receipts(command,experiment,stage,evidence_hash)values(p_command,p_experiment,'analysis_started',x.plan_hash);
   return jsonb_build_object('admitted',true);
  end if;
  if p_stage='delivery_health' then
   if not c.authority_current or c.global_stop or not c.enabled or not c.delivery_enabled or r.lane is distinct from 'creative' or r.experiment is distinct from p_experiment or p_payload-array['planHash','evidenceHash','observedAt']<>'{}'::jsonb or(select count(*)from jsonb_object_keys(p_payload))<>3 or p_payload->>'planHash' is distinct from x.plan_hash or coalesce(p_payload->>'evidenceHash','')!~'^[a-f0-9]{64}$' or coalesce(p_payload->>'observedAt','')!~'^[0-9T:+.Z-]{20,32}$'then raise exception 'Delivery health unavailable';end if;
   if(p_payload->>'observedAt')::timestamptz not between clock_timestamp()-interval '60 seconds' and clock_timestamp()+interval '1 second' or clock_timestamp()<to_timestamp((x.plan->>'start')::double precision) or clock_timestamp()>=to_timestamp((x.plan->>'end')::double precision)then raise exception 'Delivery health outside window';end if;
   if exists(select 1 from public.meta_creative_execution_receipts where experiment=p_experiment and stage='delivery_health' and floor(extract(epoch from recorded_at)/14400)=floor(extract(epoch from clock_timestamp())/14400))then return jsonb_build_object('recorded',false);end if;
   if(select count(*)from public.meta_creative_execution_receipts where experiment=p_experiment and stage='delivery_health')>=90 then raise exception 'Delivery health bound';end if;
   insert into public.meta_creative_execution_receipts(command,experiment,stage,evidence_hash)values(p_command,p_experiment,p_stage,p_payload->>'evidenceHash')on conflict(command)do nothing;
   if not exists(select 1 from public.meta_creative_execution_receipts where command=p_command and experiment=p_experiment and stage=p_stage and evidence_hash=p_payload->>'evidenceHash')then raise exception 'Delivery health conflict';end if;
   return jsonb_build_object('recorded',true);
  end if;
  if p_payload-array['analysis']<>'{}'::jsonb or not public.meta_creative_analysis_valid(p_payload->'analysis')then raise exception 'Invalid formal analysis';end if;a:=p_payload->'analysis';
  select payload into prior from public.meta_creative_formal_analysis where experiment=p_experiment;
  if prior is not null then if prior is distinct from a then raise exception 'Formal analysis conflict';end if;return prior;end if;
  m:=to_timestamp((x.plan->>'end')::double precision)+interval '72 hours';
  select payload into cohort from public.meta_creative_formal_cohorts where experiment=p_experiment;
  delivery:=public.meta_creative_delivery_proof(p_experiment);
  if r.lane is distinct from 'creative' or r.experiment is distinct from p_experiment or clock_timestamp()<m or cohort is null or delivery is null or not exists(select 1 from public.meta_creative_execution_receipts where experiment=p_experiment and stage='analysis_started')or not exists(select 1 from public.meta_creative_execution_receipts where experiment=p_experiment and stage='cleanup')or exists(select 1 from public.meta_creative_effects where experiment=p_experiment and state in('prepared','uncertain'))then raise exception 'Formal analysis not ready';end if;
  if a->>'experiment' is distinct from p_experiment::text or a->>'planHash' is distinct from x.plan_hash or(a->>'observedAt')::timestamptz not between clock_timestamp()-interval '60 seconds' and clock_timestamp()+interval '1 second' or a#>>'{sourceDates,cohort}' is distinct from cohort->>'observedAt' or(a#>>'{sourceDates,spend}')::timestamptz not between m and clock_timestamp()+interval '1 second' or(a#>>'{sourceDates,delivery}')::timestamptz is distinct from(delivery->>'verifiedAt')::timestamptz or a->'coverageCounts' is distinct from cohort->'coverage' or a->'unresolvedLate' is distinct from cohort->'unresolvedLate' or a->'allSavedCoverage' is distinct from cohort->'allSavedCoverage' then raise exception 'Formal analysis source differs';end if;
  for arm in select value from jsonb_array_elements(a->'arms')loop if not exists(select 1 from jsonb_array_elements(cohort->'arms')v where v->>'ad'=arm->>'ad' and v->>'arm'=arm->>'arm' and v->'enquiries'=arm->'enquiries')then raise exception 'Formal analysis arm differs';end if;end loop;
  if a->>'decision'<>'inconclusive' and delivery->'windowComplete' is distinct from 'true'::jsonb then raise exception 'Formal delivery incomplete';end if;
  insert into public.meta_creative_formal_analysis(experiment,command,payload)values(p_experiment,p_command,a);
  -- The durable Velt receipt must acknowledge this result before another lane
  -- can acquire ownership. A committed-but-lost response cannot lose learning.
  return a;
 end if;
 result:=public.meta_creative_executor_without_formal_analysis(p_binding,p_command,p_experiment,p_stage,p_payload);
 if p_stage='cleanup' and exists(select 1 from public.meta_creative_execution_receipts where experiment=p_experiment and stage='activation')then
  select * into x from public.meta_creative_execution where experiment=p_experiment;
  if(p_payload#>>'{terminalStudy,end}')::numeric<(x.plan->>'end')::numeric then insert into public.meta_creative_execution_receipts(command,experiment,stage,evidence_hash)values(md5(p_command::text||'delivery_interrupted')::uuid,p_experiment,'delivery_interrupted',p_payload->>'evidenceHash')on conflict(command)do nothing;end if;
 end if;
 if p_stage='read' and result->'plan'<>'null'::jsonb then
  select * into x from public.meta_creative_execution where experiment=(result#>>'{plan,experiment}')::uuid;
  select payload into a from public.meta_creative_formal_analysis where experiment=x.experiment;
  delivery:=public.meta_creative_delivery_proof(x.experiment);
  result:=result||jsonb_build_object('analysis',a,'deliveryProof',delivery,'cleanupComplete',exists(select 1 from public.meta_creative_execution_receipts where experiment=x.experiment and stage='cleanup'));
  if delivery is not null and result->'cleanupComplete'='true'::jsonb and exists(select 1 from public.acquisition_experiment_reservation where singleton and lane='creative' and experiment=x.experiment)then result:=result||jsonb_build_object('state',case when a is null then 'maturing'else 'analysed'end);end if;
 end if;
 return result;
end$$;
revoke all on function public.meta_creative_executor_command(text,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.meta_creative_executor_command(text,uuid,uuid,text,jsonb) to service_role;
commit;
