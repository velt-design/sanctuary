-- Exact same-candidate successor. Public Origin/CSRF and visitor paths unchanged.
begin;
create unique index landing_one_successor_recovery on public.landing_experiment_receipts(experiment) where stage='prepare_successor_recovery';
do $patch$ declare f text;old text;addition text;begin
 f:=pg_get_functiondef('public.landing_packaging_recovery_expiry(uuid,jsonb)'::regprocedure);
 old:='select * into c from public.landing_experiment_control where singleton;';
 addition:=$body$
 select * into r from public.landing_experiment_receipts where experiment=p_experiment and stage='prepare_successor_recovery';
 if r.command is not null then
  v:=r.result;
  select * into e from public.landing_experiments where id=p_experiment;
  select * into old from public.landing_experiment_receipts where stage='prepare_packaging_recovery' and result->>'newExperiment'=p_experiment::text;
  select * into p from public.landing_experiment_probes where id=(v->>'originalProbe')::uuid;
  if old.command is null or jsonb_typeof(v) is distinct from 'object' or(select count(*) from jsonb_object_keys(v))<>17
   or not(v?&array['kind','admission','originalRequest','originalStep','originalProbe','originalProbeHash','priorRecoveryHash','newProbe','candidateHash','template','binding','generation','controlHash','expiresAt','experimentHash','correction','nextAttempt'])
   or v->>'kind' is distinct from 'prepare_successor_recovery' or v->'nextAttempt' is distinct from '4'::jsonb
   or p_payload->>'mode' is distinct from 'prepare' or p_payload->>'probe' is distinct from v->>'newProbe'
   or v->>'originalProbe' is distinct from old.result->>'newProbe' or v->>'newProbe' in(v->>'originalProbe',old.result->>'originalProbe',old.result->>'priorProbe')
   or v->>'priorRecoveryHash' is distinct from encode(sha256(convert_to(to_jsonb(old)::text,'UTF8')),'hex')
   or old.request_hash is distinct from encode(sha256(convert_to(old.result::text,'UTF8')),'hex')
   or v->>'admission' is distinct from old.result->>'admission' or v->>'originalStep' is distinct from old.result->>'originalStep'
   or(v->>'expiresAt')::timestamptz is distinct from(old.result->>'expiresAt')::timestamptz
   or e.id is null or e.state<>'candidate' or e.started_at is not null or e.ends_at is not null or e.reviewer is not null or e.verified_at is not null or e.visual_hash is not null
   or v->>'experimentHash' is distinct from encode(sha256(convert_to(to_jsonb(e)::text,'UTF8')),'hex')
   or exists(select 1 from public.landing_experiment_assignments where experiment in(e.id,old.experiment))
   or exists(select 1 from public.landing_experiments where created_at>e.created_at)
   or not exists(select 1 from public.acquisition_experiment_reservation where lane='landing' and experiment=e.id)
   or e.control_copy is distinct from(case when e.path='/auckland-outdoor-living' then c.control_outdoor else c.control_acrylic end)
   or e.candidate_hash is distinct from v->>'candidateHash' or e.template is distinct from v->>'template'
   or not c.enabled or c.generation is distinct from(v->>'generation')::bigint or c.binding is distinct from v->>'binding' or c.template is distinct from v->>'template'
   or c.admitted_until<=clock_timestamp()
   or v->>'controlHash' is distinct from encode(sha256(convert_to(to_jsonb(c)::text,'UTF8')),'hex') or v->>'controlHash' is distinct from old.result->>'controlHash'
   or r.request_hash is distinct from encode(sha256(convert_to(v::text,'UTF8')),'hex')
   or coalesce(v->>'correction','')!~'^[a-f0-9]{40}$' or coalesce(v->>'originalRequest','')!~'^[a-f0-9-]{36}$'
   then return null;end if;
  expiry:=(v->>'expiresAt')::timestamptz;
  if expiry is null or expiry<=clock_timestamp() or expiry>old.recorded_at+interval '4 hours'
   or(expiry at time zone 'Pacific/Auckland')::date<>(old.recorded_at at time zone 'Pacific/Auckland')::date
   or(expiry at time zone 'Australia/Sydney')::date<>(old.recorded_at at time zone 'Australia/Sydney')::date
   or p.id is null or p.experiment<>e.id or p.mode<>'prepare' or p.generation<>c.generation or p.candidate_hash<>e.candidate_hash or p.template<>c.template
   or p.expires_at>clock_timestamp() or p.assignments<>0 or p.exposures<>0 or p.reloads<>0 or p.verified_at is not null or p.enrolled_at is not null
   or v->>'originalProbeHash' is distinct from encode(sha256(convert_to(to_jsonb(p)::text,'UTF8')),'hex')
   or(p.created_at at time zone 'Pacific/Auckland')::date<>(clock_timestamp() at time zone 'Pacific/Auckland')::date
   or(select count(*) from public.landing_experiment_probes where mode='prepare' and(created_at at time zone 'Pacific/Auckland')::date=(clock_timestamp() at time zone 'Pacific/Auckland')::date)<>3
   then return null;end if;
  -- All earlier zero-visit probes must still match their immutable proof.
  for prior in select * from public.landing_experiment_probes where id in((old.result->>'originalProbe')::uuid,(old.result->>'priorProbe')::uuid) loop
   if prior.assignments<>0 or prior.exposures<>0 or prior.reloads<>0 or prior.enrolled_at is not null or prior.verified_at is not null
    or encode(sha256(convert_to(to_jsonb(prior)::text,'UTF8')),'hex') is distinct from(case when prior.id::text=old.result->>'originalProbe' then old.result->>'originalProbeHash' else old.result->>'priorProbeHash' end) then return null;end if;
  end loop;
  if(select count(*) from public.landing_experiment_probes where id in((old.result->>'originalProbe')::uuid,(old.result->>'priorProbe')::uuid))<>2 then return null;end if;
  return expiry;
 end if;
 $body$;
 if position(old in f)=0 then raise exception 'Successor Source validator anchor differs';end if;
 execute replace(f,old,old||addition);
end$patch$;
commit;
