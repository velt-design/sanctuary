begin;
select pg_advisory_xact_lock(819421,1);
alter table public.meta_creative_control add column delivery_enabled boolean not null default false;
create or replace function public.meta_creative_generation() returns trigger language plpgsql set search_path='' as $$
begin if row(new.enabled,new.cleanup_enabled,new.authority_current,new.global_stop,new.binding,new.native_contract_hash,new.scope,new.original_ads,new.budget_hash,new.control_hash,new.delivery_enabled) is distinct from row(old.enabled,old.cleanup_enabled,old.authority_current,old.global_stop,old.binding,old.native_contract_hash,old.scope,old.original_ads,old.budget_hash,old.control_hash,old.delivery_enabled) then new.generation:=old.generation+1;else new.generation:=old.generation;end if;return new;end$$;
create table public.meta_creative_activation_proofs (
 command uuid primary key references public.meta_creative_effects(command) deferrable initially deferred,
 experiment uuid not null references public.meta_creative_execution(experiment),generation bigint not null,
 request_hash text not null check(request_hash~'^[a-f0-9]{64}$'),kind text not null check(kind in('activate_control','activate_challenger')),
 target text not null check(target~'^[1-9][0-9]{0,19}$'),payload jsonb not null check(octet_length(payload::text)<=2500),
 recorded_at timestamptz not null default clock_timestamp()
);
alter table public.meta_creative_activation_proofs enable row level security;
revoke all on public.meta_creative_activation_proofs from public,anon,authenticated,service_role;
create trigger creative_activation_proof_immutable before update or delete on public.meta_creative_activation_proofs for each row execute function public.meta_creative_immutable();
alter table public.meta_creative_execution_intents drop constraint meta_creative_execution_intents_kind_check;
alter table public.meta_creative_execution_intents add constraint meta_creative_execution_intents_kind_check check(kind in('create_creative','create_control','create_challenger','create_study','activate_control','activate_challenger','pause_control','pause_challenger','end_study'));
-- Also called at the actual one-use dispatch fence, including direct core RPC.
create function public.meta_creative_activation_current(p_command uuid,p_experiment uuid,p_request_hash text) returns void language plpgsql security definer set search_path='' as $$
declare proof public.meta_creative_activation_proofs;x public.meta_creative_execution;c public.meta_creative_control;a jsonb;arm jsonb;k text;expected text;
begin
 perform pg_advisory_xact_lock(819421,1);
 select * into proof from public.meta_creative_activation_proofs where command=p_command and experiment=p_experiment;
 select * into x from public.meta_creative_execution where experiment=p_experiment;
 select * into c from public.meta_creative_control where singleton;
 a:=public.meta_creative_native_acceptance_for(p_experiment);
 if proof.command is null or proof.request_hash is distinct from p_request_hash or proof.generation is distinct from c.generation
 or x.plan->>'purpose' is distinct from 'formal_experiment' or not c.delivery_enabled or not c.enabled or not c.authority_current or c.global_stop
 or x.plan->>'landingTemplate' is distinct from (select template from public.landing_experiment_control where singleton)
 or to_timestamp((x.plan->>'start')::double precision)<=clock_timestamp() or (x.plan->>'approvalUntil')::timestamptz<=clock_timestamp()
 or a is null or proof.payload->>'acceptance' is distinct from a->>'id'
 or not exists(select 1 from public.meta_creative_execution_receipts where experiment=p_experiment and stage='measurement')
 or not exists(select 1 from public.meta_creative_execution_receipts where experiment=p_experiment and stage='canary')
 or exists(select 1 from public.meta_creative_effects where experiment=p_experiment and terminal_cleanup)
 then raise exception 'Activation authority changed';end if;
 if jsonb_typeof(proof.payload) is distinct from 'object' or (select count(*)from jsonb_object_keys(proof.payload))<>9 or not(proof.payload?&array['version','planHash','acceptance','study','observedAt','preStateHash','studyProofHash','objectiveProofHash','arms']) then raise exception 'Invalid activation proof';end if;
 if proof.payload->'version' is distinct from '1'::jsonb or proof.payload->>'planHash' is distinct from x.plan_hash
 or proof.payload->>'preStateHash' is distinct from x.plan->>'preStateHash'
 or jsonb_typeof(proof.payload->'observedAt') is distinct from 'string'
 or (proof.payload->>'observedAt')::timestamptz not between clock_timestamp()-interval '60 seconds' and clock_timestamp()+interval '1 second'
 or not exists(select 1 from public.meta_creative_objects where experiment=p_experiment and kind='study' and object_id=proof.payload->>'study')
 or jsonb_typeof(proof.payload->'arms') is distinct from 'array' or jsonb_array_length(proof.payload->'arms')<>2
 then raise exception 'Activation evidence changed';end if;
 foreach k in array array['studyProofHash','objectiveProofHash'] loop
  if jsonb_typeof(proof.payload->k) is distinct from 'string' or coalesce(proof.payload->>k,'')!~'^[a-f0-9]{64}$' then raise exception 'Invalid activation hash';end if;
 end loop;
 if (select count(distinct v->>'arm') from jsonb_array_elements(proof.payload->'arms')v)<>2 then raise exception 'Activation arms differ';end if;
 for arm in select value from jsonb_array_elements(proof.payload->'arms') loop
  if jsonb_typeof(arm) is distinct from 'object' or (select count(*)from jsonb_object_keys(arm))<>7 or not(arm?&array['arm','ad','status','creative','start','end','trackingHash']) then raise exception 'Invalid arm proof';end if;
  expected:=case when exists(select 1 from public.meta_creative_execution_intents i join public.meta_creative_effects e on e.command=i.command where i.experiment=p_experiment and i.kind='activate_'||(arm->>'arm') and e.state='confirmed') then 'ACTIVE' else 'PAUSED' end;
  if coalesce(arm->>'arm','') not in('control','challenger') or arm->>'status' is distinct from expected
   or arm->>'start' is distinct from x.plan->>'start' or arm->>'end' is distinct from x.plan->>'end'
   or jsonb_typeof(arm->'start') is distinct from 'number' or jsonb_typeof(arm->'end') is distinct from 'number'
   or coalesce(arm->>'trackingHash','')!~'^[a-f0-9]{64}$'
   or arm->>'creative' is distinct from (case when arm->>'arm'='control' then x.plan#>>'{control,id}' else (select object_id from public.meta_creative_effects where experiment=p_experiment and kind='create_creative' and state='confirmed' order by confirmed_at desc limit 1)end)
   or not exists(select 1 from public.meta_creative_objects o join public.meta_creative_execution_intents i on i.command=o.created_by where o.experiment=p_experiment and o.kind='ad' and o.object_id=arm->>'ad' and i.kind='create_'||(arm->>'arm'))
   then raise exception 'Activation arm changed';end if;
  if proof.kind='activate_'||(arm->>'arm') and (proof.target is distinct from arm->>'ad' or expected<>'PAUSED') then raise exception 'Activation target differs';end if;
 end loop;
end$$;
revoke all on function public.meta_creative_activation_current(uuid,uuid,text) from public,anon,authenticated,service_role;
alter function public.meta_creative_command(text,uuid,uuid,text,jsonb) rename to meta_creative_without_activation;
revoke all on function public.meta_creative_without_activation(text,uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
create function public.meta_creative_command(p_binding text,p_command uuid,p_experiment uuid,p_stage text,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(819421,1);
 if (p_stage in('admit','admit_cleanup') and p_payload->>'kind'='activate_ad') or (p_stage='check' and exists(select 1 from public.meta_creative_effects where command=p_command and kind='activate_ad')) then
  perform public.meta_creative_activation_current(p_command,p_experiment,p_payload->>'requestHash');
 end if;
 return public.meta_creative_without_activation(p_binding,p_command,p_experiment,p_stage,p_payload);
end$$;
revoke all on function public.meta_creative_command(text,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.meta_creative_command(text,uuid,uuid,text,jsonb) to service_role;
alter function public.meta_creative_executor_command(text,uuid,uuid,text,jsonb) rename to meta_creative_executor_without_activation;
revoke all on function public.meta_creative_executor_without_activation(text,uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
create function public.meta_creative_executor_command(p_binding text,p_command uuid,p_experiment uuid,p_stage text,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.meta_creative_control;x public.meta_creative_execution;saved_intent public.meta_creative_execution_intents;intent jsonb;proof jsonb;result jsonb;k text;target text;
begin
 perform pg_advisory_xact_lock(819421,1);
 if p_stage='admit' and p_payload#>>'{intent,kind}' in('activate_control','activate_challenger') then
  select * into c from public.meta_creative_control where singleton;
  select * into x from public.meta_creative_execution where experiment=p_experiment;
  intent:=p_payload->'intent';proof:=p_payload->'activationProof';k:=intent->>'kind';target:=intent->>'target';
  if c.binding is null or c.binding is distinct from p_binding or p_command is null or x.experiment is null
   or jsonb_typeof(p_payload) is distinct from 'object' or p_payload-array['generation','intent','cleanup','activationProof']<>'{}'::jsonb
   or p_payload->'cleanup' is distinct from 'false'::jsonb or (p_payload->>'generation')::bigint is distinct from c.generation
   or jsonb_typeof(intent) is distinct from 'object' or (select count(*)from jsonb_object_keys(intent))<>6
   or not(intent?&array['kind','path','body','target','requestHash','at']) or intent->'body' is distinct from '{"status":"ACTIVE"}'::jsonb
   or intent->>'path' is distinct from target or coalesce(intent->>'requestHash','')!~'^[a-f0-9]{64}$'
   or jsonb_typeof(intent->'at') is distinct from 'number' or to_timestamp((intent->>'at')::double precision/1000) not between clock_timestamp()-interval '60 seconds' and clock_timestamp()+interval '1 second'
   or proof is null or octet_length(proof::text)>2500 then raise exception 'Invalid activation intent';end if;
  select * into saved_intent from public.meta_creative_execution_intents where command=p_command;
  if found then
   if saved_intent.experiment=p_experiment and saved_intent.intent=intent and exists(select 1 from public.meta_creative_activation_proofs where command=p_command and payload=proof) then return jsonb_build_object('prepared',true);end if;
   raise exception 'Activation intent conflict';
  end if;
  if exists(select 1 from public.meta_creative_execution_intents where experiment=p_experiment and kind=k) then raise exception 'Activation already admitted';end if;
  insert into public.meta_creative_activation_proofs(command,experiment,generation,request_hash,kind,target,payload)values(p_command,p_experiment,c.generation,intent->>'requestHash',k,target,proof);
  result:=public.meta_creative_command(p_binding,p_command,p_experiment,'admit',jsonb_build_object('kind','activate_ad','objectId',target,'requestHash',intent->>'requestHash','generation',c.generation,'preStateHash',x.plan->>'preStateHash','observedAt',to_timestamp((intent->>'at')::double precision/1000)));
  insert into public.meta_creative_execution_intents(command,experiment,kind,intent)values(p_command,p_experiment,k,intent);
  return result;
 end if;
 result:=public.meta_creative_executor_without_activation(p_binding,p_command,p_experiment,p_stage,p_payload);
 if p_stage='confirm' and exists(select 1 from public.meta_creative_execution_intents where command=p_command and kind in('activate_control','activate_challenger'))
  and (select count(distinct i.kind) from public.meta_creative_execution_intents i join public.meta_creative_effects e on e.command=i.command where i.experiment=p_experiment and i.kind in('activate_control','activate_challenger') and e.state='confirmed')=2 then
  insert into public.meta_creative_execution_receipts(command,experiment,stage,evidence_hash)
   select p_command,p_experiment,'activation',encode(sha256(convert_to(jsonb_agg(jsonb_build_object('command',e.command,'request',e.request_hash,'readback',e.evidence_hash,'proof',a.payload) order by i.kind)::text,'UTF8')),'hex')
   from public.meta_creative_execution_intents i join public.meta_creative_effects e on e.command=i.command join public.meta_creative_activation_proofs a on a.command=e.command
   where i.experiment=p_experiment and i.kind in('activate_control','activate_challenger') and e.state='confirmed'
   having count(*)=2 on conflict(command)do nothing;
 end if;
 if p_stage='read' then
  select * into x from public.meta_creative_execution where experiment=(result#>>'{plan,experiment}')::uuid;
  result:=result||jsonb_build_object('delivery',case when not exists(select 1 from public.meta_creative_execution_receipts where experiment=x.experiment and stage='activation')then 'unconfirmed'
   when clock_timestamp()<to_timestamp((x.plan->>'start')::double precision)then 'scheduled'
   when clock_timestamp()<to_timestamp((x.plan->>'end')::double precision)then 'delivering' else 'ended' end);
 end if;
 return result;
end$$;
revoke all on function public.meta_creative_executor_command(text,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.meta_creative_executor_command(text,uuid,uuid,text,jsonb) to service_role;
commit;
