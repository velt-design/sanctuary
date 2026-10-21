begin;
select pg_advisory_xact_lock(819421,1);
-- No Graph schema or provider dispatcher. This local candidate remains uninstalled.
create table public.acquisition_experiment_reservation (
 singleton boolean primary key default true check(singleton), lane text not null check(lane in('landing','creative')),
 experiment uuid not null, held_at timestamptz not null default clock_timestamp()
);
create table public.meta_creative_control (
 singleton boolean primary key default true check(singleton), enabled boolean not null default false,
 cleanup_enabled boolean not null default false, authority_current boolean not null default false,
 global_stop boolean not null default true,
 binding text not null check(binding ~ '^[a-f0-9]{64}$'), generation bigint not null default 1,
 scope jsonb not null, original_ads jsonb not null, budget_hash text not null, control_hash text not null,
 native_contract_hash text check(native_contract_hash ~ '^[a-f0-9]{64}$')
);
create table public.meta_creative_plans (
 id uuid primary key, plan jsonb not null check(octet_length(plan::text)<=6000), plan_hash text not null,
 created_at timestamptz not null default clock_timestamp(), check(plan_hash ~ '^[a-f0-9]{64}$')
);
create table public.meta_creative_effects (
 command uuid primary key, experiment uuid not null references public.meta_creative_plans(id),
 command_hash text not null, request_hash text not null check(request_hash ~ '^[a-f0-9]{64}$'), kind text not null
 check(kind in('create_creative','create_paused_ad','create_study','activate_ad','pause_ad','end_study')),
 target text, generation bigint not null, pre_state_hash text not null,
 terminal_cleanup boolean not null default false,
 state text not null default 'prepared' check(state in('prepared','uncertain','confirmed','no_effect')),
 dispatch_claimed_at timestamptz,
 object_id text, evidence_hash text, admitted_at timestamptz not null default clock_timestamp(), confirmed_at timestamptz
);
create table public.meta_creative_objects (
 object_id text primary key check(object_id ~ '^[1-9][0-9]{0,19}$'), experiment uuid not null references public.meta_creative_plans(id),
 kind text not null check(kind in('creative','ad','study')), created_by uuid not null unique references public.meta_creative_effects(command),
 request_hash text not null, evidence_hash text not null, registered_at timestamptz not null default clock_timestamp()
);
create table public.meta_creative_receipts (
 command uuid primary key, experiment uuid not null references public.meta_creative_plans(id),
 stage text not null check(stage in('reserve','cleanup')), request_hash text not null,
 evidence_hash text, recorded_at timestamptz not null default clock_timestamp()
);
alter table public.acquisition_experiment_reservation enable row level security;
alter table public.meta_creative_control enable row level security;
alter table public.meta_creative_plans enable row level security;
alter table public.meta_creative_effects enable row level security;
alter table public.meta_creative_objects enable row level security;
alter table public.meta_creative_receipts enable row level security;
revoke all on public.acquisition_experiment_reservation,public.meta_creative_control,public.meta_creative_plans,
 public.meta_creative_effects,public.meta_creative_objects,public.meta_creative_receipts from public,anon,authenticated,service_role;
create function public.meta_creative_immutable() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Immutable creative evidence';end$$;
create trigger creative_plan_immutable before update or delete on public.meta_creative_plans for each row execute function public.meta_creative_immutable();
create trigger creative_object_immutable before update or delete on public.meta_creative_objects for each row execute function public.meta_creative_immutable();
create trigger creative_receipt_immutable before update or delete on public.meta_creative_receipts for each row execute function public.meta_creative_immutable();
create function public.acquisition_landing_reservation() returns trigger language plpgsql security definer set search_path='' as $$
declare r public.acquisition_experiment_reservation;
begin
 perform pg_advisory_xact_lock(819421,1);
 if tg_op='DELETE' then raise exception 'Experiment history cannot be deleted';end if;
 select * into r from public.acquisition_experiment_reservation where singleton for update;
 if new.state in('candidate','reviewed','ready','live') then
  if r.experiment is not null and (r.lane<>'landing' or r.experiment<>new.id) then raise exception 'Acquisition test already reserved';end if;
  insert into public.acquisition_experiment_reservation(lane,experiment) values('landing',new.id) on conflict(singleton) do nothing;
 elsif r.lane='landing' and r.experiment=new.id then delete from public.acquisition_experiment_reservation where singleton;end if;
 return new;
end$$;
-- Existing active landing work is preserved and immediately participates.
insert into public.acquisition_experiment_reservation(lane,experiment) select 'landing',id from public.landing_experiments where state in('candidate','reviewed','ready','live');
create trigger acquisition_landing_reservation before insert or update or delete on public.landing_experiments for each row execute function public.acquisition_landing_reservation();
create function public.meta_creative_generation() returns trigger language plpgsql set search_path='' as $$
begin if row(new.enabled,new.cleanup_enabled,new.authority_current,new.global_stop,new.binding,new.native_contract_hash,new.scope,new.original_ads,new.budget_hash,new.control_hash) is distinct from row(old.enabled,old.cleanup_enabled,old.authority_current,old.global_stop,old.binding,old.native_contract_hash,old.scope,old.original_ads,old.budget_hash,old.control_hash) then new.generation:=old.generation+1;else new.generation:=old.generation;end if;return new;end$$;
create trigger meta_creative_generation before update on public.meta_creative_control for each row execute function public.meta_creative_generation();
create function public.meta_creative_command(p_binding text,p_command uuid,p_experiment uuid,p_stage text,p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.meta_creative_control; r public.acquisition_experiment_reservation; p public.meta_creative_plans;
 e public.meta_creative_effects; receipt public.meta_creative_receipts; h text; obj text; v_kind text; key_count int;
begin
 perform pg_advisory_xact_lock(819421,1);
 select * into c from public.meta_creative_control where singleton for update;
 if c.binding is distinct from p_binding or c.binding is null or p_command is null or p_experiment is null or p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>8000 then raise exception 'Creative authority unavailable';end if;
 h:=encode(sha256(convert_to(jsonb_build_array(p_experiment,p_stage,p_payload)::text,'UTF8')),'hex');
 select * into p from public.meta_creative_plans where id=p_experiment;
 select * into r from public.acquisition_experiment_reservation where singleton for update;
 if p_stage='read' then return jsonb_build_object('enabled',c.enabled,'cleanupEnabled',c.cleanup_enabled,'authorityCurrent',c.authority_current,'globalStop',c.global_stop,'generation',c.generation,'nativeContractHash',c.native_contract_hash,'plan',p.plan,'reservation',to_jsonb(r),'effects',(select coalesce(jsonb_agg(x),'[]') from public.meta_creative_effects x where experiment=p_experiment),'objects',(select coalesce(jsonb_agg(x),'[]') from public.meta_creative_objects x where experiment=p_experiment),'receipts',(select coalesce(jsonb_agg(x),'[]') from public.meta_creative_receipts x where experiment=p_experiment));end if;
 select * into receipt from public.meta_creative_receipts where command=p_command;
 if found then if receipt.request_hash<>h then raise exception 'Command conflict';end if;return jsonb_build_object('confirmed',true);end if;
 if p_stage='reserve' then
  if not c.enabled or not c.authority_current or c.global_stop or c.native_contract_hash is null or p_payload->>'nativeContractHash' is distinct from c.native_contract_hash then raise exception 'Creative contract not admitted';end if;
  if p_payload->'scope' is distinct from c.scope or p_payload->'originalAds' is distinct from c.original_ads or p_payload->>'budgetHash' is distinct from c.budget_hash or p_payload->>'controlHash' is distinct from c.control_hash then raise exception 'Plan differs from source scope';end if;
  if r.experiment is not null then raise exception 'Acquisition test already reserved';end if;
  if p.id is not null then raise exception 'Existing plan cannot restart';end if;
  select count(*) into key_count from jsonb_object_keys(p_payload);
  if key_count<>9 or not(p_payload ?& array['scope','originalAds','approvalHash','catalogueHash','controlHash','budgetHash','nativeContractHash','generator','reviewer']) then raise exception 'Invalid plan fields';end if;
  if jsonb_typeof(p_payload->'originalAds')<>'array' or jsonb_array_length(p_payload->'originalAds')<>4 or (select count(distinct value) from jsonb_array_elements_text(p_payload->'originalAds'))<>4 or exists(select 1 from jsonb_array_elements_text(p_payload->'originalAds') where value !~ '^[1-9][0-9]{0,19}$') then raise exception 'Invalid original ads';end if;
  if jsonb_typeof(p_payload->'scope')<>'object' or (select count(*) from jsonb_object_keys(p_payload->'scope'))<>7 or not((p_payload->'scope') ?& array['app','principal','business','account','page','campaign','adset']) or exists(select 1 from jsonb_each_text(p_payload->'scope') where value !~ '^[1-9][0-9]{0,19}$') then raise exception 'Invalid scope';end if;
  if exists(select 1 from jsonb_each_text(p_payload) where key in('approvalHash','catalogueHash','controlHash','budgetHash','nativeContractHash') and coalesce(value,'') !~ '^[a-f0-9]{64}$') or coalesce(length(p_payload->>'generator'),0) not between 1 and 150 or coalesce(length(p_payload->>'reviewer'),0) not between 1 and 150 or p_payload->>'generator'=p_payload->>'reviewer' then raise exception 'Invalid approval';end if;
  insert into public.meta_creative_plans(id,plan,plan_hash) values(p_experiment,p_payload,h);
  insert into public.acquisition_experiment_reservation(lane,experiment) values('creative',p_experiment);
  insert into public.meta_creative_receipts(command,experiment,stage,request_hash) values(p_command,p_experiment,p_stage,h);
  return jsonb_build_object('reserved',true);
 end if;
 if p.id is null then raise exception 'Unknown plan';end if;
 if p_stage in('admit','admit_cleanup') then
  -- No externally-dispatched effect is retried, even after expiry or Stop.
  select * into e from public.meta_creative_effects where command=p_command;
  if found then if e.command_hash<>h or e.request_hash is distinct from p_payload->>'requestHash' or e.experiment<>p_experiment then raise exception 'Effect conflict';end if;return jsonb_build_object('dispatch',false,'state',e.state);end if;
  if not c.authority_current or c.global_stop or (case when p_stage='admit_cleanup' then not c.cleanup_enabled else not c.enabled end) or c.native_contract_hash is distinct from p.plan->>'nativeContractHash' or c.scope is distinct from p.plan->'scope' or c.original_ads is distinct from p.plan->'originalAds' or c.budget_hash is distinct from p.plan->>'budgetHash' or c.control_hash is distinct from p.plan->>'controlHash' or (p_payload->>'generation')::bigint is distinct from c.generation or r.lane<>'creative' or r.experiment is distinct from p_experiment then raise exception 'Creative admission revoked';end if;
  select count(*) into key_count from jsonb_object_keys(p_payload);
  if key_count<>6 or not(p_payload ?& array['kind','objectId','requestHash','generation','preStateHash','observedAt']) or coalesce(p_payload->>'requestHash','') !~ '^[a-f0-9]{64}$' or coalesce(p_payload->>'preStateHash','') !~ '^[a-f0-9]{64}$' or p_payload->>'observedAt' is null or (p_payload->>'observedAt')::timestamptz not between clock_timestamp()-interval '5 minutes' and clock_timestamp() then raise exception 'Invalid effect proof';end if;
  v_kind:=p_payload->>'kind';obj:=p_payload->>'objectId';
  if v_kind not in('create_creative','create_paused_ad','create_study','activate_ad','pause_ad','end_study') then raise exception 'Unapproved effect';end if;
  if exists(select 1 from public.meta_creative_effects where experiment=p_experiment and state in('prepared','uncertain')) then raise exception 'Unresolved effect requires reconciliation';end if;
  if p_stage='admit_cleanup' and v_kind not in('pause_ad','end_study') then raise exception 'Cleanup effect not allowed';end if;
  if p_stage='admit' and exists(select 1 from public.meta_creative_effects where experiment=p_experiment and terminal_cleanup) then raise exception 'Terminal cleanup has started';end if;
  if v_kind in('create_creative','create_paused_ad','create_study') then
   if obj is not null then raise exception 'Create cannot name an object';end if;
   if (select count(*) from public.meta_creative_objects o where o.experiment=p_experiment and o.kind=case when v_kind='create_paused_ad' then 'ad' when v_kind='create_creative' then 'creative' else 'study' end)>=(case when v_kind='create_paused_ad' then 2 else 1 end) then raise exception 'Registry bound';end if;
  else
   if obj is null or not exists(select 1 from public.meta_creative_objects o where o.experiment=p_experiment and o.object_id=obj and o.kind=case when v_kind='end_study' then 'study' else 'ad' end) then raise exception 'Unowned target';end if;
  end if;
  -- Normal work cannot consume the three reserved terminal slots (two ads + study).
  -- Cleanup cannot resume normal work or repeatedly dispatch against a stopped target.
  if p_stage='admit_cleanup' then
   if (select count(*) from public.meta_creative_effects where experiment=p_experiment and terminal_cleanup)>=3 or exists(select 1 from public.meta_creative_effects where experiment=p_experiment and terminal_cleanup and target=obj and state<>'no_effect') then raise exception 'Cleanup effect bound';end if;
  elsif (select count(*) from public.meta_creative_effects where experiment=p_experiment and not terminal_cleanup)>=24 then raise exception 'Effect bound';end if;
  insert into public.meta_creative_effects(command,experiment,command_hash,request_hash,kind,target,generation,pre_state_hash,terminal_cleanup) values(p_command,p_experiment,h,p_payload->>'requestHash',v_kind,obj,c.generation,p_payload->>'preStateHash',p_stage='admit_cleanup');
  return jsonb_build_object('dispatch',false,'prepared',true,'state','prepared');
 end if;
 if p_stage='check' then
  select * into e from public.meta_creative_effects where command=p_command;
  if (select count(*) from jsonb_object_keys(p_payload))<>1 or not(p_payload?'requestHash') or e.admitted_at<clock_timestamp()-interval '90 seconds' or e.experiment is distinct from p_experiment or e.request_hash is distinct from p_payload->>'requestHash' or e.state<>'prepared' or not c.authority_current or c.global_stop or (case when e.terminal_cleanup then not c.cleanup_enabled else not c.enabled end) or e.generation<>c.generation or c.native_contract_hash is distinct from p.plan->>'nativeContractHash' or c.scope is distinct from p.plan->'scope' or c.original_ads is distinct from p.plan->'originalAds' or c.budget_hash is distinct from p.plan->>'budgetHash' or c.control_hash is distinct from p.plan->>'controlHash' or r.lane is distinct from 'creative' or r.experiment is distinct from p_experiment then raise exception 'Creative dispatch authority revoked';end if;
  -- One-use dispatch fence. A lost check response is uncertain, never permission to retry.
  update public.meta_creative_effects set state='uncertain',dispatch_claimed_at=clock_timestamp() where command=p_command;
  return jsonb_build_object('current',true,'dispatch',true);
 end if;
 if p_stage='no_effect' then
  select * into e from public.meta_creative_effects where command=p_command for update;
  if (select count(*) from jsonb_object_keys(p_payload))<>3 or not(p_payload ?& array['requestHash','evidenceHash','reason']) or p_payload->>'reason' is distinct from 'dispatch_not_started' or coalesce(p_payload->>'evidenceHash','') !~ '^[a-f0-9]{64}$' or e.experiment is distinct from p_experiment or e.request_hash is distinct from p_payload->>'requestHash' or e.dispatch_claimed_at is not null then raise exception 'No-effect proof rejected';end if;
  if e.state='no_effect' then
   if e.evidence_hash is distinct from p_payload->>'evidenceHash' then raise exception 'Conflicting no-effect proof';end if;
   return jsonb_build_object('noEffect',true);
  end if;
  if e.state<>'prepared' then raise exception 'No-effect proof rejected';end if;
  -- Stored absence of the one-use dispatch claim plus the exact authority-bound
  -- executor receipt, not expiry or an empty provider search, proves no dispatch.
  update public.meta_creative_effects set state='no_effect',evidence_hash=p_payload->>'evidenceHash',confirmed_at=clock_timestamp() where command=p_command;
  return jsonb_build_object('noEffect',true);
 end if;
 if p_stage='confirm' then
  select * into e from public.meta_creative_effects where command=p_command for update;
  obj:=p_payload->>'objectId';
  if e.experiment is distinct from p_experiment or e.request_hash is distinct from p_payload->>'requestHash' or (select count(*) from jsonb_object_keys(p_payload))<>3 or not(p_payload ?& array['requestHash','objectId','evidenceHash']) or obj is null or obj !~ '^[1-9][0-9]{0,19}$' or coalesce(p_payload->>'evidenceHash','') !~ '^[a-f0-9]{64}$' then raise exception 'Unmatched effect confirmation';end if;
  if e.state='confirmed' then if e.object_id<>obj or e.evidence_hash<>p_payload->>'evidenceHash' then raise exception 'Conflicting confirmation';end if;return jsonb_build_object('confirmed',true);end if;
  if e.state<>'uncertain' or e.dispatch_claimed_at is null then raise exception 'Effect was not dispatched';end if;
  if p.plan->'originalAds' ? obj then raise exception 'Original ad is not owned';end if;
  if e.kind in('create_creative','create_paused_ad','create_study') then
   insert into public.meta_creative_objects(object_id,experiment,kind,created_by,request_hash,evidence_hash) values(obj,p_experiment,case when e.kind='create_study' then 'study' when e.kind='create_creative' then 'creative' else 'ad' end,p_command,e.request_hash,p_payload->>'evidenceHash');
  elsif e.target<>obj then raise exception 'Target changed';end if;
  update public.meta_creative_effects set state='confirmed',object_id=obj,evidence_hash=p_payload->>'evidenceHash',confirmed_at=clock_timestamp() where command=p_command;
  return jsonb_build_object('confirmed',true);
 end if;
 if p_stage='cleanup' then
  if (select count(*) from jsonb_object_keys(p_payload)) not in(1,2) or exists(select 1 from jsonb_object_keys(p_payload) k where k not in('evidenceHash','terminalStudy')) or coalesce(p_payload->>'evidenceHash','') !~ '^[a-f0-9]{64}$' then raise exception 'Invalid cleanup proof';end if;
  if exists(select 1 from public.meta_creative_objects where experiment=p_experiment and kind='study') then
   if jsonb_typeof(p_payload->'terminalStudy') is distinct from 'object' or (select count(*) from jsonb_object_keys(p_payload->'terminalStudy'))<>6
    or not(p_payload->'terminalStudy' ?& array['id','end','observationEnd','observedAt','evidenceHash','ended'])
    or p_payload->'terminalStudy'->'ended' is distinct from 'true'::jsonb
    or not exists(select 1 from public.meta_creative_objects where experiment=p_experiment and kind='study' and object_id=p_payload->'terminalStudy'->>'id')
    or coalesce(p_payload->'terminalStudy'->>'end','') !~ '^[0-9]{1,11}$'
    or p_payload->'terminalStudy'->>'end' is distinct from p_payload->'terminalStudy'->>'observationEnd'
    or to_timestamp((p_payload->'terminalStudy'->>'end')::double precision)>clock_timestamp()
    or (p_payload->'terminalStudy'->>'observedAt')::timestamptz not between clock_timestamp()-interval '60 seconds' and clock_timestamp()+interval '5 seconds'
    or coalesce(p_payload->'terminalStudy'->>'evidenceHash','') !~ '^[a-f0-9]{64}$' then raise exception 'Study terminal readback required';end if;
  elsif p_payload ? 'terminalStudy' and p_payload->'terminalStudy'<>'null'::jsonb then raise exception 'Unowned study proof';end if;
  if r.lane is distinct from 'creative' or r.experiment is distinct from p_experiment or exists(select 1 from public.meta_creative_effects where experiment=p_experiment and state in('prepared','uncertain')) then raise exception 'Cleanup unresolved';end if;
  if exists(select 1 from public.meta_creative_objects o where o.experiment=p_experiment and o.kind='ad' and not exists(select 1 from public.meta_creative_effects x where x.command=(select command from public.meta_creative_effects where experiment=p_experiment and object_id=o.object_id and state='confirmed' order by admitted_at desc limit 1) and x.kind=case when o.kind='ad' then 'pause_ad' else 'end_study' end)) then raise exception 'Owned objects not stopped';end if;
  insert into public.meta_creative_receipts(command,experiment,stage,request_hash,evidence_hash) values(p_command,p_experiment,p_stage,h,p_payload->>'evidenceHash');
  delete from public.acquisition_experiment_reservation where singleton;
  return jsonb_build_object('released',true);
 end if;
 raise exception 'Unknown creative command';
end$$;
revoke all on function public.meta_creative_immutable(),public.acquisition_landing_reservation(),public.meta_creative_generation() from public,anon,authenticated,service_role;
revoke all on function public.meta_creative_command(text,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.meta_creative_command(text,uuid,uuid,text,jsonb) to service_role;
commit;
