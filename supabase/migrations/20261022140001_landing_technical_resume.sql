-- Finite operator-issued technical resumes. Original attempts, partially used
-- probes, terminal experiments and funding dates remain immutable history.
begin;
create unique index landing_technical_predecessor on public.landing_experiment_receipts((result->>'admission'),(result->>'predecessor')) where stage='technical_resume';
create unique index landing_technical_correction on public.landing_experiment_receipts((result->>'admission'),(result->>'correction')) where stage='technical_resume';
create function public.landing_technical_resume_expiry(p_experiment uuid,p_probe uuid)
returns timestamptz language plpgsql set search_path='' set timezone='UTC' as $$
declare h public.landing_experiment_receipts;prior public.landing_experiment_receipts;rolled public.landing_experiment_receipts;
 e public.landing_experiments;target public.landing_experiments;p public.landing_experiment_probes;c public.landing_experiment_control;
 v jsonb;original jsonb;previous jsonb;candidate text;expiry timestamptz;n integer;
begin
 select * into h from public.landing_experiment_receipts where stage='technical_resume' and result->>'newExperiment'=p_experiment::text and result->>'newProbe'=p_probe::text;v:=h.result;original:=v->'originalExperiment';previous:=v->'previousControl';
 select * into prior from public.landing_experiment_receipts where command=(v->>'priorReceipt')::uuid;
 select * into e from public.landing_experiments where id=h.experiment;
 select * into target from public.landing_experiments where id=p_experiment;
 select * into p from public.landing_experiment_probes where id=(v->>'originalProbe')::uuid;
 select * into c from public.landing_experiment_control where singleton;
 select * into rolled from public.landing_experiment_receipts where experiment=e.id and stage='rollback'order by recorded_at desc limit 1;
 select count(*)into n from public.landing_experiment_receipts where stage='technical_resume' and result->>'admission'=v->>'admission';
 if h.command is null or prior.command is null or e.id is null or n not between 1 and 3
  or jsonb_typeof(v) is distinct from 'object' or(select count(*)from jsonb_object_keys(v))<>24
  or not(v?&array['kind','admission','predecessor','predecessorHash','originalStep','originalStepHash','originalProbe','originalProbeHash','priorReceipt','priorReceiptHash','originalExperiment','experimentHash','newExperiment','newProbe','template','candidateHash','generation','controlHash','expiresAt','correction','nextAttempt','funding','rollbackReceiptHash','previousControl'])
  or v->>'kind' is distinct from 'technical_resume' or v->'nextAttempt' is distinct from to_jsonb(5+n)
  or prior.stage not in('prepare_completion','technical_resume') or prior.result->>'newExperiment' is distinct from e.id::text
  or prior.result->>'newProbe' is distinct from p.id::text or prior.result->>'admission' is distinct from v->>'admission'
  or(prior.result->>'nextAttempt')::integer+1<>(v->>'nextAttempt')::integer
  or v->>'priorReceiptHash' is distinct from encode(sha256(convert_to(to_jsonb(prior)::text,'UTF8')),'hex')
  or prior.request_hash is distinct from encode(sha256(convert_to(prior.result::text,'UTF8')),'hex')
  or h.request_hash is distinct from encode(sha256(convert_to(v::text,'UTF8')),'hex')
  or v->>'experimentHash' is distinct from encode(sha256(convert_to(original::text,'UTF8')),'hex')
  or original->>'id' is distinct from e.id::text or original->>'state' is distinct from 'candidate'
  or e.path<>'/acrylic-roof-pergolas-auckland' or e.copy<>'action-first' or e.state not in('candidate','reverted')
  or e.started_at is not null or e.ends_at is not null or e.reviewer is not null or e.visual_hash is not null or e.verified_at is not null
  or exists(select 1 from public.landing_experiment_assignments where experiment=e.id)
  or exists(select 1 from public.landing_experiments where created_at>e.created_at and id<>p_experiment)
  or not c.enabled or c.publishing or c.admitted_until<=clock_timestamp() or c.generation<>(v->>'generation')::bigint
  or v->>'controlHash' is distinct from encode(sha256(convert_to(to_jsonb(c)::text,'UTF8')),'hex')
  or v->>'template' is distinct from c.template
  or encode(sha256(convert_to(previous::text,'UTF8')),'hex') is distinct from prior.result->>'controlHash'
  or c.generation<>(previous->>'generation')::bigint+(case when c.template=previous->>'template' then 0 else 1 end)
  or(to_jsonb(c)-array['template','generation']) is distinct from(previous-array['template','generation'])
  or e.control_copy is distinct from c.control_acrylic
  or p.id is null or p.id=p_probe or p.experiment<>e.id or p.mode<>'prepare' or p.expires_at>clock_timestamp()
  or p.enrolled_at is not null or p.verified_at is not null or p.generation<>(previous->>'generation')::bigint or p.template<>e.template or p.candidate_hash<>e.candidate_hash
  or v->>'originalProbeHash' is distinct from encode(sha256(convert_to(to_jsonb(p)::text,'UTF8')),'hex')
  or exists(select 1 from public.landing_experiment_probes where experiment=e.id and mode='prepare' and created_at>p.created_at and id<>p_probe)
  or coalesce(v->>'predecessor','')!~'^[a-f0-9-]{36}$' or coalesce(v->>'originalStep','')!~'^[a-f0-9-]{36}$'
  or coalesce(v->>'predecessorHash','')!~'^[a-f0-9]{64}$' or coalesce(v->>'originalStepHash','')!~'^[a-f0-9]{64}$'
  or coalesce(v->>'correction','')!~'^[a-f0-9]{40}$' or v->>'correction'=prior.result->>'correction'
  or jsonb_typeof(v->'funding') is distinct from 'object' or(select count(*)from jsonb_object_keys(v->'funding'))<>3
  or not(v->'funding'?&array['day','receiptHash','maximumModelUsd'])
  or coalesce(v#>>'{funding,receiptHash}','')!~'^[a-f0-9]{64}$' or v#>'{funding,maximumModelUsd}' is distinct from '0.02224'::jsonb
  or v#>>'{funding,day}' is distinct from to_char(h.recorded_at at time zone 'Australia/Sydney','YYYY-MM-DD')
  or v#>>'{funding,day}' is distinct from to_char(clock_timestamp() at time zone 'Australia/Sydney','YYYY-MM-DD') then return null;end if;
 candidate:=encode(sha256(convert_to('{"path":'||to_json(e.path)::text||',"copy":'||to_json(e.copy)::text||',"template":'||to_json(c.template)::text||',"evidenceHash":'||to_json(e.evidence_hash)::text||'}','UTF8')),'hex');
 expiry:=(v->>'expiresAt')::timestamptz;
 if v->>'candidateHash' is distinct from candidate or expiry<=clock_timestamp() or expiry>h.recorded_at+interval '45 minutes' or h.recorded_at>clock_timestamp()
  or v#>>'{funding,day}' is distinct from to_char(expiry at time zone 'Australia/Sydney','YYYY-MM-DD') then return null;end if;
 if e.state='candidate' then
  if c.template<>e.template or p_experiment<>e.id or to_jsonb(e) is distinct from original or v->'rollbackReceiptHash' is distinct from 'null'::jsonb then return null;end if;
 else
  if p_experiment=e.id or(to_jsonb(e)-array['state','lease_until']) is distinct from(original-array['state','lease_until'])
   or rolled.command is null or v->>'rollbackReceiptHash' is distinct from encode(sha256(convert_to(to_jsonb(rolled)::text,'UTF8')),'hex')
   or rolled.result is distinct from jsonb_build_object('experiment',e.id,'state','reverted')
   or rolled.request_hash is distinct from encode(sha256(convert_to(jsonb_build_array('rollback',e.id,jsonb_build_object('generation',c.generation,'candidateHash',e.candidate_hash,'reason','guard'))::text,'UTF8')),'hex') then return null;end if;
 end if;
 if target.id is null then
  if exists(select 1 from public.acquisition_experiment_reservation) then return null;end if;
 elsif target.state<>'candidate' or target.started_at is not null or target.reviewer is not null or target.visual_hash is not null or target.verified_at is not null
  or row(target.path,target.copy,target.control_copy,target.template,target.candidate_hash,target.evidence_hash,target.generator,target.minimum_exposures,target.duration_days)
   is distinct from row(e.path,e.copy,e.control_copy,c.template,candidate,e.evidence_hash,e.generator,e.minimum_exposures,e.duration_days)
  or not exists(select 1 from public.acquisition_experiment_reservation where lane='landing' and experiment=target.id) then return null;end if;
 return expiry;
 exception when invalid_text_representation or datetime_field_overflow or invalid_datetime_format or numeric_value_out_of_range then return null;
end$$;
revoke all on function public.landing_technical_resume_expiry(uuid,uuid) from public,anon,authenticated,service_role;
do $patch$declare f text;n text;begin
 f:=pg_get_functiondef('public.landing_packaging_recovery_expiry(uuid,jsonb)'::regprocedure);
 n:='begin';f:=regexp_replace(f,n,$body$begin
 if exists(select 1 from public.landing_experiment_receipts where stage='technical_resume' and result->>'newExperiment'=p_experiment::text and result->>'newProbe'=p_payload->>'probe') then
  if p_payload->>'mode' is distinct from 'prepare' then return null;end if;
  return public.landing_technical_resume_expiry(p_experiment,(p_payload->>'probe')::uuid);
 end if;
 $body$);execute f;
 f:=pg_get_functiondef('public.landing_packaging_prepare(uuid,jsonb)'::regprocedure);
 n:='begin';f:=regexp_replace(f,n,$body$begin
 select * into r from public.landing_experiment_receipts where stage='technical_resume' and result->>'newExperiment'=p_experiment::text order by recorded_at desc limit 1;
 if r.command is not null then
  select * into e from public.landing_experiments where id=r.experiment;
  select * into c from public.landing_experiment_control where singleton;
  return not exists(select 1 from public.landing_experiments where id=p_experiment)
   and p_payload=jsonb_build_object('generation',c.generation,'candidateHash',r.result->>'candidateHash','evidenceHash',e.evidence_hash,'template',c.template,'path',e.path,'copy',e.copy,'generator',e.generator,'minimumExposures',e.minimum_exposures,'durationDays',e.duration_days)
   and public.landing_technical_resume_expiry(p_experiment,(r.result->>'newProbe')::uuid) is not null;
 end if;
 $body$);execute f;
 f:=pg_get_functiondef('public.landing_experiment_command(text,uuid,text,uuid,jsonb)'::regprocedure);
 n:='if p_stage=''probe'' then';
 if position(n in f)=0 then raise exception 'Technical probe command anchor differs';end if;
 -- A new calendar day does not grant an unreceipted retry through the ordinary
 -- daily allowance. Replays of a previously committed command return earlier.
 f:=replace(f,n,n||$body$
  if p_payload->>'mode'='prepare' and exists(select 1 from public.landing_experiment_receipts resume where resume.stage='technical_resume' and resume.result->>'newExperiment'=p_experiment::text)
   and public.landing_technical_resume_expiry(p_experiment,(p_payload->>'probe')::uuid) is null then raise exception 'Technical probe unavailable';end if;
 $body$);execute f;
end$patch$;
commit;
