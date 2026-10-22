-- One explicitly funded owner decision per Auckland day. Normal diagnostic
-- capacity and all earlier decisions/probes remain counted and immutable.
begin;
create unique index landing_owner_decision_day on public.landing_experiment_receipts((result->>'owner'),(result->>'day')) where stage='owner_decision';
create unique index landing_owner_decision_preparation on public.landing_experiment_receipts((result->>'ownerDecision')) where stage='prepare' and result?'ownerDecision';
create unique index landing_owner_decision_probe on public.landing_experiment_receipts((result->>'ownerDecision')) where stage='probe' and result?'ownerDecision';

create function public.landing_decision_prior() returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',id,'candidateHash',candidate_hash,'state',state)
 from public.landing_experiments order by created_at desc,id desc limit 1
$$;
create function public.landing_decision_settled() returns boolean language sql stable set search_path='' as $$
 select not exists(select 1 from public.landing_experiments e where e.state in('candidate','reviewed','ready','live')
  or e.started_at is null and(exists(select 1 from public.landing_experiment_assignments a where a.experiment=e.id)
   or exists(select 1 from public.landing_experiment_receipts r where r.experiment=e.id and r.stage='publish')))
$$;
create function public.landing_owner_decision(p_id uuid) returns jsonb language sql stable set search_path='' as $$
 select h.result from public.landing_experiment_receipts h,public.landing_experiment_control c
 where h.command=p_id and h.stage='owner_decision' and c.singleton and c.enabled and c.admitted_until>statement_timestamp()
 and h.result->>'template'=c.template and(h.result->>'generation')::bigint=c.generation
 and h.result->'controls'=jsonb_build_object('/auckland-outdoor-living',c.control_outdoor,'/acrylic-roof-pergolas-auckland',c.control_acrylic)
 and(h.result->>'expiresAt')::timestamptz>statement_timestamp()
 and not exists(select 1 from public.landing_experiment_receipts ended where ended.stage='owner_end' and ended.result->>'ownerDecision'=p_id::text)
$$;

-- A reservation without a prepared experiment is only the finite decision
-- entitlement. Expiry releases that reservation, never a real experiment.
create function public.landing_owner_decision_expire() returns void language sql set search_path='' as $$
 delete from public.acquisition_experiment_reservation r using public.landing_experiment_receipts h
 where r.lane='landing' and r.experiment=h.command and h.stage='owner_decision'
 and(h.result->>'expiresAt')::timestamptz<=statement_timestamp()
 and not exists(select 1 from public.landing_experiments e where e.id=r.experiment)
$$;

do $patch$ declare f text;n text;begin
 f:=pg_get_functiondef('public.landing_experiment_command(text,uuid,text,uuid,jsonb)'::regprocedure);
 n:='where created_at>stamp-interval ''7 days''';
 if position(n in f)=0 then raise exception 'Landing cadence anchor differs';end if;
 f:=replace(f,n,'where started_at>stamp-interval ''7 days''');
 n:='if p_stage=''prepare'' then';
 f:=replace(f,n,n||' if not public.landing_decision_settled() then raise exception ''Prior delivery unresolved'';end if;');
 -- Comparison identity is the rendered control, not an implementation release.
 f:=replace(f,' and template=c.template and public.landing_control_identity',' and public.landing_control_identity');
 f:=replace(f,' and prior.template=c.template and public.landing_control_identity',' and public.landing_control_identity');
 n:='if (select count(*) from public.landing_experiment_probes where mode=p_payload->>''mode''';
 if position(n in f)=0 then raise exception 'Landing probe anchor differs';end if;
 f:=replace(f,n,'if not(p_stage=''probe'' and p_payload->>''mode''=''prepare'' and p_payload?''ownerDecision'') and (select count(*) from public.landing_experiment_probes where mode=p_payload->>''mode''');
 n:='insert into public.landing_experiment_receipts(command,experiment,stage,request_hash,result)values';
 if position(n in f)=0 then raise exception 'Landing receipt anchor differs';end if;
 f:=replace(f,n,'if p_stage in(''prepare'',''probe'') and p_payload?''ownerDecision'' then result:=result||jsonb_build_object(''ownerDecision'',p_payload->>''ownerDecision'',''ownerRequest'',p_payload->>''ownerRequest'');end if;'||n);
 execute f;
 f:=pg_get_functiondef('public.landing_authored_available(text,text,jsonb)'::regprocedure);
 f:=replace(f,' and template=p_template','');execute f;
end$patch$;

alter function public.landing_experiment_command(text,uuid,text,uuid,jsonb) rename to landing_experiment_without_owner_decision;
create function public.landing_experiment_command(p_binding text,p_command uuid,p_stage text,p_experiment uuid,p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare c public.landing_experiment_control;h public.landing_experiment_receipts;v jsonb;answer jsonb;stamp timestamptz:=clock_timestamp();expiry timestamptz;digest text;
begin
 perform pg_advisory_xact_lock(819421,1);
 select * into c from public.landing_experiment_control where singleton for update;
 if c.singleton is null or c.binding is distinct from p_binding then raise exception 'Experiment authority unavailable';end if;
 perform public.landing_owner_decision_expire();
 if p_stage='receipt' and p_payload->>'stage' in('owner_decision','owner_end') then
  if p_experiment is not null then raise exception 'Owner receipt scope differs';end if;
  select * into h from public.landing_experiment_receipts where command=(p_payload->>'command')::uuid;
  if h.command is null then return null;end if;
  digest:=encode(sha256(convert_to(jsonb_build_array(p_payload->>'stage',null,p_payload->'payload')::text,'UTF8')),'hex');
  if h.stage<>p_payload->>'stage' or h.request_hash<>digest or h.experiment is not null then raise exception 'Owner receipt differs';end if;return h.result;
 end if;
 if p_stage in('owner_decision','owner_end') then
  if p_command is null or p_experiment is not null or jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>4096 then raise exception 'Invalid owner decision';end if;
  digest:=encode(sha256(convert_to(jsonb_build_array(p_stage,p_experiment,p_payload)::text,'UTF8')),'hex');
  select * into h from public.landing_experiment_receipts where command=p_command;
  if h.command is not null then if h.stage<>p_stage or h.request_hash<>digest then raise exception 'Owner decision conflict';end if;return h.result;end if;
  if p_stage='owner_decision' then
   expiry:=(p_payload->>'expiresAt')::timestamptz;
   if(select count(*)from jsonb_object_keys(p_payload))<>10 or not(p_payload?&array['owner','request','generation','template','controls','prior','expiresAt','funding','correction','day'])
    or coalesce(p_payload->>'owner','')!~'^[a-f0-9-]{36}$' or coalesce(p_payload->>'request','')!~'^[a-f0-9-]{36}$'
    or coalesce(p_payload->>'correction','')!~'^[a-f0-9]{40}$' or not c.enabled or c.publishing or c.admitted_until<=stamp
    or(p_payload->>'generation')::bigint is distinct from c.generation or p_payload->>'template' is distinct from c.template
    or p_payload->'controls' is distinct from jsonb_build_object('/auckland-outdoor-living',c.control_outdoor,'/acrylic-roof-pergolas-auckland',c.control_acrylic)
    or p_payload->'prior' is distinct from coalesce(public.landing_decision_prior(),'null'::jsonb)
    or expiry is null or expiry<=stamp or expiry>stamp+interval '4 hours'
    or(expiry at time zone 'Australia/Sydney')::date<>(stamp at time zone 'Australia/Sydney')::date
    or(expiry at time zone 'Pacific/Auckland')::date<>(stamp at time zone 'Pacific/Auckland')::date
    or p_payload->>'day' is distinct from to_char(stamp at time zone 'Pacific/Auckland','YYYY-MM-DD')
    or jsonb_typeof(p_payload->'funding') is distinct from 'object' or(select count(*)from jsonb_object_keys(p_payload->'funding'))<>3
    or p_payload#>>'{funding,day}' is distinct from to_char(stamp at time zone 'Australia/Sydney','YYYY-MM-DD')
    or coalesce(p_payload#>>'{funding,receiptHash}','')!~'^[a-f0-9]{64}$' or p_payload#>'{funding,maximumModelUsd}' is distinct from '0.14308'::jsonb
    or not public.landing_decision_settled() or exists(select 1 from public.landing_experiments where started_at>stamp-interval '7 days')
    or exists(select 1 from public.acquisition_experiment_reservation)
    then raise exception 'Owner decision unavailable';end if;
   answer:=p_payload||jsonb_build_object('ownerDecision',p_command,'observedLayoutAllowed',not exists(select 1 from public.landing_experiments e
    where e.path='/acrylic-roof-pergolas-auckland' and public.landing_copy_identity(e.copy)='action-first' and e.state in('rejected','reverted','inconclusive')
    and public.landing_control_identity(e.path,e.control_copy)=public.landing_control_identity(e.path,c.control_acrylic)));
   insert into public.acquisition_experiment_reservation(lane,experiment)values('landing',p_command);
  else
   if(select count(*)from jsonb_object_keys(p_payload))<>2 or not(p_payload?&array['ownerDecision','result']) or p_payload->>'result' not in('no_candidate','no_landing_hypothesis','stopped') then raise exception 'Invalid owner decision ending';end if;
   select * into h from public.landing_experiment_receipts where command=(p_payload->>'ownerDecision')::uuid and stage='owner_decision';
   if h.command is null or exists(select 1 from public.landing_experiment_receipts where stage='prepare' and result->>'ownerDecision'=h.command::text) then raise exception 'Prepared decision cannot be released';end if;
   answer:=p_payload;delete from public.acquisition_experiment_reservation where lane='landing' and experiment=h.command;
  end if;
  insert into public.landing_experiment_receipts(command,experiment,stage,request_hash,result)values(p_command,null,p_stage,digest,answer);return answer;
 end if;
 if p_stage in('prepare','probe') and p_payload?'ownerDecision' then
  v:=public.landing_owner_decision((p_payload->>'ownerDecision')::uuid);
  if v is null or coalesce(p_payload->>'ownerRequest','')!~'^[a-f0-9-]{36}$' then raise exception 'Owner capacity unavailable';end if;
  -- Exact existing command replay is read-only; any new identity is consumed.
  if not exists(select 1 from public.landing_experiment_receipts where command=p_command) then
   if p_stage='prepare' then
    if exists(select 1 from public.landing_experiment_receipts where stage='prepare' and result->>'ownerDecision'=v->>'ownerDecision')
     or not exists(select 1 from public.acquisition_experiment_reservation where lane='landing' and experiment=(v->>'ownerDecision')::uuid)
     or v->'prior' is distinct from coalesce(public.landing_decision_prior(),'null'::jsonb) then raise exception 'Owner preparation consumed';end if;
    delete from public.acquisition_experiment_reservation where lane='landing' and experiment=(v->>'ownerDecision')::uuid;
   else
    if p_payload->>'mode'<>'prepare' or not exists(select 1 from public.landing_experiment_receipts where stage='prepare' and experiment=p_experiment and result->>'ownerDecision'=v->>'ownerDecision')
     or exists(select 1 from public.landing_experiment_receipts where stage='probe' and result->>'ownerDecision'=v->>'ownerDecision')
     or exists(select 1 from public.landing_experiment_probes where experiment=p_experiment and mode='prepare') then raise exception 'Owner render consumed';end if;
   end if;
  end if;
 end if;
 answer:=public.landing_experiment_without_owner_decision(p_binding,p_command,p_stage,p_experiment,p_payload);
 if p_stage='read' then
  answer:=answer||jsonb_build_object('preparation',jsonb_build_object('settled',public.landing_decision_settled(),'reserved',exists(select 1 from public.acquisition_experiment_reservation),
   'ordinaryProbes',(select count(*)from public.landing_experiment_probes where mode='prepare' and(created_at at time zone 'Pacific/Auckland')::date=(stamp at time zone 'Pacific/Auckland')::date),
   'ownerDecisions',(select count(*)from public.landing_experiment_receipts where stage='owner_decision' and result->>'day'=to_char(stamp at time zone 'Pacific/Auckland','YYYY-MM-DD')),
   'ownerDecision',(select r.experiment from public.acquisition_experiment_reservation r join public.landing_experiment_receipts rec on rec.command=r.experiment and rec.stage='owner_decision' where r.lane='landing'),
   'resetsAt',((stamp at time zone 'Pacific/Auckland')::date+1)::timestamp at time zone 'Pacific/Auckland',
   'cadenceUntil',(select max(started_at)+interval '7 days'from public.landing_experiments)));
 end if;
 return answer;
end$$;
revoke all on function public.landing_decision_prior(),public.landing_decision_settled(),public.landing_owner_decision(uuid),public.landing_owner_decision_expire(),public.landing_experiment_without_owner_decision(text,uuid,text,uuid,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.landing_experiment_command(text,uuid,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.landing_experiment_command(text,uuid,text,uuid,jsonb) to service_role;
commit;
