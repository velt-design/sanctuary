-- Exact operator-only exception for one expired, unused preparation probe.
-- Ordinary signed HTTP payload and provider/visitor boundaries are unchanged.
begin;
create unique index landing_one_prepare_recovery on public.landing_experiment_receipts(experiment) where stage='prepare_recovery';
create function public.landing_prepare_recovery_expiry(p_experiment uuid,p_payload jsonb)
returns timestamptz language plpgsql set search_path='' set timezone='UTC' as $$
declare c public.landing_experiment_control;e public.landing_experiments;p public.landing_experiment_probes;r public.landing_experiment_receipts;v jsonb;expiry timestamptz;
begin
 select * into c from public.landing_experiment_control where singleton;
 select * into e from public.landing_experiments where id=p_experiment;
 select * into r from public.landing_experiment_receipts where experiment=p_experiment and stage='prepare_recovery';v:=r.result;
 if r.command is null or jsonb_typeof(v) is distinct from 'object' or(select count(*) from jsonb_object_keys(v))<>13
  or not(v?&array['kind','admission','originalRequest','originalStep','originalProbe','originalProbeHash','newProbe','candidateHash','template','binding','generation','controlHash','expiresAt'])
  or v->>'kind' is distinct from 'prepare_recovery' or p_payload->>'mode' is distinct from 'prepare'
  or p_payload->>'probe' is distinct from v->>'newProbe' or v->>'newProbe'=v->>'originalProbe'
  or e.id is null or e.state<>'candidate' or e.candidate_hash is distinct from v->>'candidateHash' or e.template is distinct from v->>'template'
  or not c.enabled or c.generation is distinct from (v->>'generation')::bigint or c.binding is distinct from v->>'binding' or c.template is distinct from v->>'template'
  or v->>'controlHash' is distinct from encode(sha256(convert_to(to_jsonb(c)::text,'UTF8')),'hex')
  or r.request_hash is distinct from encode(sha256(convert_to(v::text,'UTF8')),'hex')
  or coalesce(v->>'admission','')!~'^[a-f0-9-]{36}$' or coalesce(v->>'originalRequest','')!~'^[a-f0-9-]{36}$' or coalesce(v->>'originalStep','')!~'^[a-f0-9-]{36}$'
  then return null;end if;
 expiry:=(v->>'expiresAt')::timestamptz;
 if expiry is null or expiry<=clock_timestamp() or expiry>r.recorded_at+interval '4 hours'
  or(expiry at time zone 'Pacific/Auckland')::date<>(r.recorded_at at time zone 'Pacific/Auckland')::date
  or(expiry at time zone 'Australia/Sydney')::date<>(r.recorded_at at time zone 'Australia/Sydney')::date then return null;end if;
 select * into p from public.landing_experiment_probes where id=(v->>'originalProbe')::uuid;
 if p.id is null or p.experiment<>e.id or p.mode<>'prepare' or p.generation<>c.generation or p.candidate_hash<>e.candidate_hash or p.template<>c.template
  or p.expires_at>clock_timestamp() or p.assignments<>0 or p.exposures<>0 or p.reloads<>0 or p.verified_at is not null or p.enrolled_at is not null
  or v->>'originalProbeHash' is distinct from encode(sha256(convert_to(to_jsonb(p)::text,'UTF8')),'hex')
  or(select count(*) from public.landing_experiment_probes where mode='prepare' and(created_at at time zone 'Pacific/Auckland')::date=(clock_timestamp() at time zone 'Pacific/Auckland')::date)<>1
  or(p.created_at at time zone 'Pacific/Auckland')::date<>(clock_timestamp() at time zone 'Pacific/Auckland')::date
  then return null;end if;
 return expiry;
 exception when invalid_text_representation or datetime_field_overflow or invalid_datetime_format or numeric_value_out_of_range then return null;
end$$;
revoke all on function public.landing_prepare_recovery_expiry(uuid,jsonb) from public,anon,authenticated,service_role;
do $patch$
declare f text;old text;new text;
begin
 f:=pg_get_functiondef('public.landing_experiment_command(text,uuid,text,uuid,jsonb)'::regprocedure);
 old:='then raise exception ''Probe daily limit'';end if;';
 new:='and public.landing_prepare_recovery_expiry(p_experiment,p_payload) is null then raise exception ''Probe daily limit'';end if;';
 if (length(f)-length(replace(f,old,'')))/length(old)<>1 then raise exception 'Preparation limit differs';end if;f:=replace(f,old,new);
 old:='stamp+case when p_payload->>''mode''=''prepare'' then interval ''100 seconds'' else interval ''25 seconds'' end';
 new:='least(stamp+case when p_payload->>''mode''=''prepare'' then interval ''100 seconds'' else interval ''25 seconds'' end,coalesce(public.landing_prepare_recovery_expiry(p_experiment,p_payload),''infinity''::timestamptz))';
 if position(old in f)=0 then raise exception 'Preparation expiry differs';end if;f:=replace(f,old,new);execute f;
end$patch$;
commit;
