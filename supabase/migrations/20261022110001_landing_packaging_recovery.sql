-- One exact binary-packaging continuation. Both prior probes stay untouched.
begin;
create unique index landing_one_packaging_recovery on public.landing_experiment_receipts(experiment) where stage='prepare_packaging_recovery';
create unique index landing_packaging_replacement_identity on public.landing_experiment_receipts((result->>'newExperiment')) where stage='prepare_packaging_recovery';
create function public.landing_packaging_recovery_expiry(p_experiment uuid,p_payload jsonb)
returns timestamptz language plpgsql set search_path='' set timezone='UTC' as $$
declare c public.landing_experiment_control;e public.landing_experiments;replacement public.landing_experiments;p public.landing_experiment_probes;prior public.landing_experiment_probes;r public.landing_experiment_receipts;old public.landing_experiment_receipts;rolled public.landing_experiment_receipts;v jsonb;expiry timestamptz;
begin
 select * into c from public.landing_experiment_control where singleton;
 select * into r from public.landing_experiment_receipts where stage='prepare_packaging_recovery' and result->>'newExperiment'=p_experiment::text;v:=r.result;
 select * into e from public.landing_experiments where id=r.experiment;
 select * into replacement from public.landing_experiments where id=p_experiment;
 select * into old from public.landing_experiment_receipts where experiment=e.id and stage='prepare_recovery';
 select * into rolled from public.landing_experiment_receipts where experiment=e.id and stage='rollback' order by recorded_at desc limit 1;
 if r.command is null or old.command is null or rolled.command is null or jsonb_typeof(v) is distinct from 'object' or(select count(*) from jsonb_object_keys(v))<>19
  or not(v?&array['kind','admission','originalRequest','originalStep','originalProbe','originalProbeHash','priorProbe','priorProbeHash','priorRecoveryHash','newProbe','candidateHash','template','binding','generation','controlHash','expiresAt','newExperiment','originalExperimentHash','rollbackReceiptHash'])
  or v->>'kind' is distinct from 'prepare_packaging_recovery' or p_payload->>'mode' is distinct from 'prepare' or p_payload->>'probe' is distinct from v->>'newProbe'
  or v->>'newProbe' in(v->>'originalProbe',v->>'priorProbe') or v->>'originalProbe' is distinct from old.result->>'newProbe' or v->>'priorProbe' is distinct from old.result->>'originalProbe'
  or v->>'priorRecoveryHash' is distinct from encode(sha256(convert_to(to_jsonb(old)::text,'UTF8')),'hex')
  or old.request_hash is distinct from encode(sha256(convert_to(old.result::text,'UTF8')),'hex')
  or v->>'admission' is distinct from old.result->>'admission' or v->>'originalStep' is distinct from old.result->>'originalStep'
  or (v->>'expiresAt')::timestamptz is distinct from (old.result->>'expiresAt')::timestamptz
  or e.id is null or e.id=p_experiment or e.state<>'reverted' or e.started_at is not null or e.ends_at is not null or e.reviewer is not null or e.verified_at is not null or e.visual_hash is not null
  or v->>'originalExperimentHash' is distinct from encode(sha256(convert_to(to_jsonb(e)::text,'UTF8')),'hex')
  or v->>'rollbackReceiptHash' is distinct from encode(sha256(convert_to(to_jsonb(rolled)::text,'UTF8')),'hex')
  or rolled.result is distinct from jsonb_build_object('experiment',e.id,'state','reverted')
  or rolled.request_hash is distinct from encode(sha256(convert_to(jsonb_build_array('rollback',e.id,jsonb_build_object('generation',c.generation,'candidateHash',e.candidate_hash,'reason','guard'))::text,'UTF8')),'hex')
  or exists(select 1 from public.landing_experiment_assignments where experiment=e.id)
  or exists(select 1 from public.landing_experiments where created_at>e.created_at and id<>p_experiment)
  or e.control_copy is distinct from(case when e.path='/auckland-outdoor-living' then c.control_outdoor else c.control_acrylic end)
  or e.candidate_hash is distinct from v->>'candidateHash' or e.template is distinct from v->>'template'
  or(replacement.id is not null and (replacement.state<>'candidate' or row(replacement.path,replacement.template,replacement.copy,replacement.control_copy,replacement.candidate_hash,replacement.evidence_hash,replacement.generator,replacement.minimum_exposures,replacement.duration_days) is distinct from row(e.path,e.template,e.copy,e.control_copy,e.candidate_hash,e.evidence_hash,e.generator,e.minimum_exposures,e.duration_days)))
  or not c.enabled or c.generation is distinct from (v->>'generation')::bigint or c.binding is distinct from v->>'binding' or c.template is distinct from v->>'template'
  or v->>'controlHash' is distinct from encode(sha256(convert_to(to_jsonb(c)::text,'UTF8')),'hex') or v->>'controlHash' is distinct from old.result->>'controlHash'
  or r.request_hash is distinct from encode(sha256(convert_to(v::text,'UTF8')),'hex')
  or coalesce(v->>'originalRequest','')!~'^[a-f0-9-]{36}$' then return null;end if;
 expiry:=(v->>'expiresAt')::timestamptz;
 if expiry is null or expiry<=clock_timestamp() or expiry>old.recorded_at+interval '4 hours'
  or(expiry at time zone 'Pacific/Auckland')::date<>(old.recorded_at at time zone 'Pacific/Auckland')::date
  or(expiry at time zone 'Australia/Sydney')::date<>(old.recorded_at at time zone 'Australia/Sydney')::date then return null;end if;
 select * into p from public.landing_experiment_probes where id=(v->>'originalProbe')::uuid;
 select * into prior from public.landing_experiment_probes where id=(v->>'priorProbe')::uuid;
 if p.id is null or prior.id is null or p.id=prior.id
  or p.experiment<>e.id or prior.experiment<>e.id or p.mode<>'prepare' or prior.mode<>'prepare'
  or p.generation<>c.generation or prior.generation<>c.generation or p.candidate_hash<>e.candidate_hash or prior.candidate_hash<>e.candidate_hash or p.template<>c.template or prior.template<>c.template
  or p.expires_at>clock_timestamp() or prior.expires_at>clock_timestamp() or p.assignments<>0 or p.exposures<>0 or p.reloads<>0 or prior.assignments<>0 or prior.exposures<>0 or prior.reloads<>0
  or p.verified_at is not null or p.enrolled_at is not null or prior.verified_at is not null or prior.enrolled_at is not null
  or v->>'originalProbeHash' is distinct from encode(sha256(convert_to(to_jsonb(p)::text,'UTF8')),'hex')
  or v->>'priorProbeHash' is distinct from encode(sha256(convert_to(to_jsonb(prior)::text,'UTF8')),'hex') or v->>'priorProbeHash' is distinct from old.result->>'originalProbeHash'
  or(select count(*) from public.landing_experiment_probes where mode='prepare' and(created_at at time zone 'Pacific/Auckland')::date=(clock_timestamp() at time zone 'Pacific/Auckland')::date)<>2
  or(p.created_at at time zone 'Pacific/Auckland')::date<>(clock_timestamp() at time zone 'Pacific/Auckland')::date
  or(prior.created_at at time zone 'Pacific/Auckland')::date<>(clock_timestamp() at time zone 'Pacific/Auckland')::date then return null;end if;
 return expiry;
 exception when invalid_text_representation or datetime_field_overflow or invalid_datetime_format or numeric_value_out_of_range then return null;
end$$;
revoke all on function public.landing_packaging_recovery_expiry(uuid,jsonb) from public,anon,authenticated,service_role;

-- Existing prepare payload, fixed replacement identity, no new HTTP command.
create function public.landing_packaging_prepare(p_experiment uuid,p_payload jsonb)
returns boolean language plpgsql set search_path='' set timezone='UTC' as $$
declare r public.landing_experiment_receipts;e public.landing_experiments;c public.landing_experiment_control;begin
 select * into r from public.landing_experiment_receipts where stage='prepare_packaging_recovery' and result->>'newExperiment'=p_experiment::text;
 select * into e from public.landing_experiments where id=r.experiment;
 select * into c from public.landing_experiment_control where singleton;
 return e.id is not null and not exists(select 1 from public.landing_experiments where id=p_experiment)
  and p_payload=jsonb_build_object('generation',c.generation,'candidateHash',e.candidate_hash,'evidenceHash',e.evidence_hash,'template',e.template,'path',e.path,'copy',e.copy,'generator',e.generator,'minimumExposures',e.minimum_exposures,'durationDays',e.duration_days)
  and public.landing_packaging_recovery_expiry(p_experiment,jsonb_build_object('mode','prepare','probe',r.result->>'newProbe')) is not null;
end$$;
revoke all on function public.landing_packaging_prepare(uuid,jsonb) from public,anon,authenticated,service_role;
do $patch$ declare f text;old text:='public.landing_prepare_recovery_expiry(p_experiment,p_payload)';begin
 f:=pg_get_functiondef('public.landing_experiment_command(text,uuid,text,uuid,jsonb)'::regprocedure);
 if(length(f)-length(replace(f,old,'')))/length(old)<>2 then raise exception 'Preparation recovery predicate differs';end if;
 f:=replace(f,old,'coalesce(public.landing_prepare_recovery_expiry(p_experiment,p_payload),public.landing_packaging_recovery_expiry(p_experiment,p_payload))');
 old:='then raise exception ''Candidate cadence exceeded'';';if position(old in f)=0 then raise exception 'Cadence predicate differs';end if;
 f:=replace(f,old,'and not public.landing_packaging_prepare(p_experiment,p_payload) then raise exception ''Candidate cadence exceeded'';');
 old:='then raise exception ''Previously evaluated candidate'';';if position(old in f)=0 then raise exception 'Copy exclusion predicate differs';end if;
 f:=replace(f,old,'and not public.landing_packaging_prepare(p_experiment,p_payload) then raise exception ''Previously evaluated candidate'';');
 execute f;
end$patch$;
commit;
