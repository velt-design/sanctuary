-- Reuse one unspent owner decision after a separately recorded observation.
-- Operator-only receipt installation; no public endpoint, new quota or expiry.
begin;
create unique index landing_owner_observation on public.landing_experiment_receipts((result->>'ownerDecision')) where stage='owner_observation';
create function public.landing_owner_observation_insert() returns trigger language plpgsql set search_path='' set timezone='UTC' as $$
declare c public.landing_experiment_control;h public.landing_experiment_receipts;e public.landing_experiment_receipts;v jsonb:=new.result;
begin
 if new.stage<>'owner_observation' then return new;end if;
 perform pg_advisory_xact_lock(819421,1);
 select * into c from public.landing_experiment_control where singleton for update;
 select * into h from public.landing_experiment_receipts where command=(v->>'ownerDecision')::uuid and stage='owner_decision';
 select * into e from public.landing_experiment_receipts where command=(v->>'endReceipt')::uuid and stage='owner_end';
 if new.experiment is not null or jsonb_typeof(v) is distinct from 'object' or(select count(*)from jsonb_object_keys(v))<>13
  or not(v?&array['ownerDecision','capacityHash','endReceipt','endHash','observationHash','template','generation','controlsHash','sourceRelease','correction','expiresAt','copy','hypothesis'])
  or h.command is null or e.command is null or e.result is distinct from jsonb_build_object('ownerDecision',h.command,'result','no_landing_hypothesis')
  or v->>'capacityHash' is distinct from encode(sha256(convert_to(to_jsonb(h)::text,'UTF8')),'hex')
  or v->>'endHash' is distinct from encode(sha256(convert_to(to_jsonb(e)::text,'UTF8')),'hex')
  or coalesce(v->>'observationHash','')!~'^[a-f0-9]{64}$' or coalesce(v->>'sourceRelease','')!~'^[a-f0-9]{40}$' or coalesce(v->>'correction','')!~'^[a-f0-9]{40}$'
  or v->>'correction'=h.result->>'correction' or v->>'copy' is distinct from 'estimate' or v->>'hypothesis' is distinct from 'make_estimate_visible'
  or c.singleton is null or not c.enabled or c.publishing or c.admitted_until<=(v->>'expiresAt')::timestamptz
  or v->>'template' is distinct from c.template or h.result->>'template' is distinct from c.template
  or(v->>'generation')::bigint is distinct from c.generation or(h.result->>'generation')::bigint is distinct from c.generation
  or h.result->'controls' is distinct from jsonb_build_object('/auckland-outdoor-living',c.control_outdoor,'/acrylic-roof-pergolas-auckland',c.control_acrylic)
  or v->>'controlsHash' is distinct from encode(sha256(convert_to((h.result->'controls')::text,'UTF8')),'hex')
  or(v->>'expiresAt')::timestamptz is distinct from(h.result->>'expiresAt')::timestamptz or(v->>'expiresAt')::timestamptz<=clock_timestamp()
  or h.result->'prior' is distinct from coalesce(public.landing_decision_prior(),'null'::jsonb) or not public.landing_decision_settled()
  or exists(select 1 from public.landing_experiment_receipts x where x.stage='owner_decision' and x.result->>'owner'=h.result->>'owner' and x.recorded_at>h.recorded_at)
  or exists(select 1 from public.landing_experiment_receipts x where x.result->>'ownerDecision'=h.command::text and(x.stage in('prepare','probe') or x.stage='owner_end' and x.command<>e.command))
  or exists(select 1 from public.acquisition_experiment_reservation)
  or exists(select 1 from public.landing_experiments x where x.path='/acrylic-roof-pergolas-auckland' and x.state in('rejected','reverted','inconclusive')
   and public.landing_copy_identity(x.copy)=public.landing_copy_identity('estimate') and public.landing_control_identity(x.path,x.control_copy)=public.landing_control_identity(x.path,c.control_acrylic))
  or new.request_hash is distinct from encode(sha256(convert_to(jsonb_build_array('owner_observation',null,v)::text,'UTF8')),'hex')
  then raise exception 'Observed owner capacity unavailable';end if;
 insert into public.acquisition_experiment_reservation(lane,experiment)values('landing',h.command);
 return new;
end$$;
create trigger landing_owner_observation_insert before insert on public.landing_experiment_receipts for each row execute function public.landing_owner_observation_insert();
do $patch$ declare f text;n text;begin
 f:=pg_get_functiondef('public.landing_owner_decision(uuid)'::regprocedure);
 n:='and not exists(select 1 from public.landing_experiment_receipts ended where ended.stage=''owner_end'' and ended.result->>''ownerDecision''=p_id::text)';
 if position(n in f)=0 then raise exception 'Observed capacity anchor differs';end if;
 f:=replace(f,n,$body$and(not exists(select 1 from public.landing_experiment_receipts ended where ended.stage='owner_end' and ended.result->>'ownerDecision'=p_id::text)
 or exists(select 1 from public.landing_experiment_receipts o where o.stage='owner_observation' and o.result->>'ownerDecision'=p_id::text
  and not exists(select 1 from public.landing_experiment_receipts ended where ended.stage='owner_end' and ended.result->>'ownerDecision'=p_id::text and ended.command::text<>o.result->>'endReceipt')))$body$);execute f;
 f:=pg_get_functiondef('public.landing_experiment_command(text,uuid,text,uuid,jsonb)'::regprocedure);
 n:='v:=public.landing_owner_decision((p_payload->>''ownerDecision'')::uuid);';
 if position(n in f)=0 then raise exception 'Observed preparation anchor differs';end if;
 f:=replace(f,n,n||$body$
  if p_stage='prepare' and exists(select 1 from public.landing_experiment_receipts where stage='owner_observation' and result->>'ownerDecision'=p_payload->>'ownerDecision')
   and(p_payload->>'copy' is distinct from 'estimate' or p_payload->>'path' is distinct from '/acrylic-roof-pergolas-auckland')then raise exception 'Observed hypothesis scope differs';end if;
 $body$);execute f;
end$patch$;
revoke all on function public.landing_owner_observation_insert() from public,anon,authenticated,service_role;
commit;
