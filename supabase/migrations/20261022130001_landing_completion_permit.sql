-- Private operator receipt for ONE current-template derivative of an unserved
-- paid proposal. The operator's control transition, terminal close, receipt and
-- ordinary prepare execute in one transaction. No receipt is installed here.
begin;
create unique index landing_one_completion_permit on public.landing_experiment_receipts((result->>'admission')) where stage='prepare_completion';
create unique index landing_completion_identity on public.landing_experiment_receipts((result->>'newExperiment')) where stage='prepare_completion';
create function public.landing_completion_expiry(p_experiment uuid,p_probe uuid)
returns timestamptz language plpgsql set search_path='' set timezone='UTC' as $$
declare r public.landing_experiment_receipts;prior public.landing_experiment_receipts;rolled public.landing_experiment_receipts;
 c public.landing_experiment_control;e public.landing_experiments;n public.landing_experiments;p public.landing_experiment_probes;
 v jsonb;original jsonb;previous jsonb;expiry timestamptz;candidate text;
begin
 select * into r from public.landing_experiment_receipts where stage='prepare_completion' and result->>'newExperiment'=p_experiment::text;v:=r.result;original:=v->'originalExperiment';previous:=v->'previousControl';
 select * into e from public.landing_experiments where id=r.experiment;
 select * into n from public.landing_experiments where id=p_experiment;
 select * into c from public.landing_experiment_control where singleton;
 select * into prior from public.landing_experiment_receipts where experiment=e.id and stage='prepare_successor_recovery';
 select * into rolled from public.landing_experiment_receipts where experiment=e.id and stage='rollback' order by recorded_at desc limit 1;
 select * into p from public.landing_experiment_probes where id=(v->>'originalProbe')::uuid;
 if r.command is null or prior.command is null or rolled.command is null or jsonb_typeof(v) is distinct from 'object' or(select count(*)from jsonb_object_keys(v))<>22
  or not(v?&array['kind','admission','originalRequest','originalStep','originalProbe','originalProbeHash','priorReceiptHash','originalExperiment','previousControl','rollbackReceiptHash','newExperiment','newProbe','template','candidateHash','generation','controlHash','expiresAt','correction','nextAttempt','providerTerminalHash','geometryHash','originalExpiry'])
  or v->>'kind' is distinct from 'prepare_completion' or v->'nextAttempt' is distinct from '5'::jsonb
  or v->>'newProbe' is distinct from p_probe::text or v->>'originalProbe' is distinct from prior.result->>'newProbe' or p_probe=p.id
  or v->>'admission' is distinct from prior.result->>'admission' or v->>'originalStep' is distinct from prior.result->>'originalStep'
  or(v->>'originalExpiry')::timestamptz is distinct from(prior.result->>'expiresAt')::timestamptz
  or v->>'priorReceiptHash' is distinct from encode(sha256(convert_to(to_jsonb(prior)::text,'UTF8')),'hex')
  or prior.request_hash is distinct from encode(sha256(convert_to(prior.result::text,'UTF8')),'hex')
  or e.id is null or e.id=p_experiment or e.state<>'reverted' or e.started_at is not null or e.ends_at is not null or e.reviewer is not null or e.verified_at is not null or e.visual_hash is not null
  or e.path<>'/acrylic-roof-pergolas-auckland' or e.copy<>'action-first'
  or original->>'state' is distinct from 'candidate' or original->>'id' is distinct from e.id::text
  or (to_jsonb(e)-array['state','lease_until']) is distinct from (original-array['state','lease_until'])
  or encode(sha256(convert_to(original::text,'UTF8')),'hex') is distinct from prior.result->>'experimentHash'
  or encode(sha256(convert_to(previous::text,'UTF8')),'hex') is distinct from prior.result->>'controlHash'
  or v->>'rollbackReceiptHash' is distinct from encode(sha256(convert_to(to_jsonb(rolled)::text,'UTF8')),'hex')
  or rolled.result is distinct from jsonb_build_object('experiment',e.id,'state','reverted')
  or rolled.request_hash is distinct from encode(sha256(convert_to(jsonb_build_array('rollback',e.id,jsonb_build_object('generation',c.generation,'candidateHash',e.candidate_hash,'reason','guard'))::text,'UTF8')),'hex')
  or exists(select 1 from public.landing_experiment_assignments where experiment=e.id)
  or exists(select 1 from public.landing_experiments where created_at>e.created_at and id<>p_experiment)
  or e.control_copy is distinct from c.control_acrylic or c.control_acrylic?'layout'
  or not c.enabled or c.publishing or c.admitted_until<=clock_timestamp() or c.generation<>(v->>'generation')::bigint
  or c.generation<>(previous->>'generation')::bigint+1 or (to_jsonb(c)-array['template','generation']) is distinct from(previous-array['template','generation'])
  or c.template is distinct from v->>'template' or c.template=e.template
  or v->>'controlHash' is distinct from encode(sha256(convert_to(to_jsonb(c)::text,'UTF8')),'hex')
  or r.request_hash is distinct from encode(sha256(convert_to(v::text,'UTF8')),'hex')
  or coalesce(v->>'correction','')!~'^[a-f0-9]{40}$' or coalesce(v->>'providerTerminalHash','')!~'^[a-f0-9]{64}$' or coalesce(v->>'geometryHash','')!~'^[a-f0-9]{64}$'
  or coalesce(v->>'originalRequest','')!~'^[a-f0-9-]{36}$' then return null;end if;
 candidate:=encode(sha256(convert_to('{"path":'||to_json(e.path)::text||',"copy":'||to_json(e.copy)::text||',"template":'||to_json(c.template)::text||',"evidenceHash":'||to_json(e.evidence_hash)::text||'}','UTF8')),'hex');
 expiry:=(v->>'expiresAt')::timestamptz;
 if v->>'candidateHash' is distinct from candidate or expiry<=clock_timestamp() or expiry>r.recorded_at+interval '45 minutes'
  or(expiry at time zone 'Australia/Sydney')::date<>((v->>'originalExpiry')::timestamptz at time zone 'Australia/Sydney')::date
  or p.id is null or p.experiment<>e.id or p.mode<>'prepare' or p.expires_at>clock_timestamp() or p.assignments<>1 or p.exposures<>1 or p.reloads<>0 or p.verified_at is not null or p.enrolled_at is not null
  or p.generation<>(previous->>'generation')::bigint or p.template<>e.template or p.candidate_hash<>e.candidate_hash
  or v->>'originalProbeHash' is distinct from encode(sha256(convert_to(to_jsonb(p)::text,'UTF8')),'hex')
  or(select count(*)from public.landing_experiment_probes where mode='prepare' and(created_at at time zone 'Australia/Sydney')::date=(r.recorded_at at time zone 'Australia/Sydney')::date)<>4
  or exists(select 1 from public.landing_experiment_probes where mode='prepare' and id<>p.id and(created_at at time zone 'Australia/Sydney')::date=(r.recorded_at at time zone 'Australia/Sydney')::date and(assignments<>0 or exposures<>0 or reloads<>0 or enrolled_at is not null or verified_at is not null))
  or(n.id is not null and (n.state<>'candidate' or row(n.path,n.copy,n.control_copy,n.evidence_hash,n.generator,n.minimum_exposures,n.duration_days) is distinct from row(e.path,e.copy,e.control_copy,e.evidence_hash,e.generator,e.minimum_exposures,e.duration_days)
   or n.template<>c.template or n.candidate_hash<>candidate or n.started_at is not null or n.reviewer is not null or n.visual_hash is not null or n.verified_at is not null))
  or(n.id is null and exists(select 1 from public.acquisition_experiment_reservation))
  or(n.id is not null and not exists(select 1 from public.acquisition_experiment_reservation where lane='landing' and experiment=n.id)) then return null;end if;
 return expiry;
 exception when invalid_text_representation or datetime_field_overflow or invalid_datetime_format or numeric_value_out_of_range then return null;
end$$;
revoke all on function public.landing_completion_expiry(uuid,uuid) from public,anon,authenticated,service_role;

do $patch$ declare f text;n text;begin
 f:=pg_get_functiondef('public.landing_packaging_recovery_expiry(uuid,jsonb)'::regprocedure);
 n:='select * into c from public.landing_experiment_control where singleton;';
 if position(n in f)=0 then raise exception 'Completion probe anchor differs';end if;
 f:=replace(f,n,$body$
 if exists(select 1 from public.landing_experiment_receipts where stage='prepare_completion' and result->>'newExperiment'=p_experiment::text) then
  if p_payload->>'mode' is distinct from 'prepare' then return null;end if;
  return public.landing_completion_expiry(p_experiment,(p_payload->>'probe')::uuid);
 end if;
 $body$||n);execute f;
 f:=pg_get_functiondef('public.landing_packaging_prepare(uuid,jsonb)'::regprocedure);
 n:='select * into r from public.landing_experiment_receipts where stage=''prepare_packaging_recovery'' and result->>''newExperiment''=p_experiment::text;';
 if position(n in f)=0 then raise exception 'Completion prepare anchor differs';end if;
 f:=replace(f,n,$body$
 select * into r from public.landing_experiment_receipts where stage='prepare_completion' and result->>'newExperiment'=p_experiment::text;
 if r.command is not null then
  select * into e from public.landing_experiments where id=r.experiment;
  select * into c from public.landing_experiment_control where singleton;
  return not exists(select 1 from public.landing_experiments where id=p_experiment)
   and p_payload=jsonb_build_object('generation',c.generation,'candidateHash',r.result->>'candidateHash','evidenceHash',e.evidence_hash,'template',c.template,'path',e.path,'copy',e.copy,'generator',e.generator,'minimumExposures',e.minimum_exposures,'durationDays',e.duration_days)
   and public.landing_completion_expiry(p_experiment,(r.result->>'newProbe')::uuid) is not null;
 end if;
 $body$||n);execute f;
end$patch$;
commit;
