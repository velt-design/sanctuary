begin;
select pg_advisory_xact_lock(819421,1);
create table public.meta_creative_execution (
 experiment uuid primary key references public.meta_creative_plans(id), plan jsonb not null check(octet_length(plan::text)<=8000),
 plan_hash text not null unique check(plan_hash ~ '^[a-f0-9]{64}$'), created_at timestamptz not null default clock_timestamp()
);
create table public.meta_creative_execution_intents (
 command uuid primary key references public.meta_creative_effects(command), experiment uuid not null references public.meta_creative_execution(experiment),
 kind text not null check(kind in('create_creative','create_control','create_challenger','create_study','pause_control','pause_challenger','end_study')),
 intent jsonb not null check(octet_length(intent::text)<=8000)
);
create table public.meta_creative_execution_receipts (
 command uuid primary key, experiment uuid not null references public.meta_creative_execution(experiment),
 stage text not null check(stage in('canary','measurement','cleanup')), evidence_hash text check(evidence_hash ~ '^[a-f0-9]{64}$'),
 recorded_at timestamptz not null default clock_timestamp()
);
alter table public.meta_creative_execution enable row level security;
alter table public.meta_creative_execution_intents enable row level security;
alter table public.meta_creative_execution_receipts enable row level security;
revoke all on public.meta_creative_execution,public.meta_creative_execution_intents,public.meta_creative_execution_receipts from public,anon,authenticated,service_role;
create trigger creative_execution_immutable before update or delete on public.meta_creative_execution for each row execute function public.meta_creative_immutable();
create trigger creative_intents_immutable before update or delete on public.meta_creative_execution_intents for each row execute function public.meta_creative_immutable();
create trigger creative_execution_receipts_immutable before update or delete on public.meta_creative_execution_receipts for each row execute function public.meta_creative_immutable();
create function public.meta_creative_registered_ads()
returns table(experiment uuid,ad_id text,arm text,campaign_id text,adset_id text,page_path text,starts_at timestamptz,ends_at timestamptz)
language sql security definer set search_path='' as $$
 select x.experiment,o.object_id,case when i.kind='create_control' then 'control' else 'challenger' end,
  x.plan->'scope'->>'campaign',x.plan->'scope'->>'adset',x.plan->'control'->>'path',
  to_timestamp((x.plan->>'start')::double precision),to_timestamp((x.plan->>'end')::double precision)
 from public.meta_creative_execution x join public.meta_creative_objects o on o.experiment=x.experiment and o.kind='ad'
 join public.meta_creative_execution_intents i on i.command=o.created_by and i.kind in('create_control','create_challenger')
$$;
create function public.meta_creative_executor_command(p_binding text,p_command uuid,p_experiment uuid,p_stage text,p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.meta_creative_control;r public.acquisition_experiment_reservation;x public.meta_creative_execution;
 e public.meta_creative_effects;i public.meta_creative_execution_intents;v_kind text;v_target text;result jsonb;payload jsonb;ready boolean;
begin
 perform pg_advisory_xact_lock(819421,1);
 select * into c from public.meta_creative_control where singleton for update;
 if c.binding is null or c.binding is distinct from p_binding or p_command is null or jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>14000 then raise exception 'Creative authority unavailable';end if;
 select * into r from public.acquisition_experiment_reservation where singleton for update;
 if p_stage='read' and p_experiment is null and r.lane='creative' then p_experiment:=r.experiment;end if;
 select * into x from public.meta_creative_execution where experiment=p_experiment;
 if p_stage='read' then
  return jsonb_build_object('enabled',c.enabled,'cleanupEnabled',c.cleanup_enabled,'stopped',c.global_stop or not c.authority_current,'generation',c.generation,'plan',x.plan,
   'activationReady',false,'measurementReady',exists(select 1 from public.meta_creative_execution_receipts where experiment=x.experiment and stage='measurement'),
   'state',case when x.experiment is null then 'empty' when r.experiment is distinct from x.experiment then 'closed'
    when exists(select 1 from public.meta_creative_effects where experiment=x.experiment and terminal_cleanup) then 'cleanup'
    when exists(select 1 from public.meta_creative_execution_receipts where experiment=x.experiment and stage='canary') then 'canary_ready' else 'prepared' end,
   'objects',(select coalesce(jsonb_agg(jsonb_build_object('id',o.object_id,'kind',case when j.kind='create_control' then 'control' when j.kind='create_challenger' then 'challenger' else o.kind end,
      'command',o.created_by,'requestHash',o.request_hash)),'[]') from public.meta_creative_objects o join public.meta_creative_execution_intents j on j.command=o.created_by where o.experiment=x.experiment),
   'effects',(select coalesce(jsonb_agg(jsonb_build_object('command',a.command,'kind',j.kind,'requestHash',a.request_hash,'state',a.state,'object',a.object_id,'evidenceHash',a.evidence_hash,'intent',j.intent) order by a.admitted_at),'[]')
     from public.meta_creative_effects a join public.meta_creative_execution_intents j on j.command=a.command where a.experiment=x.experiment));
 end if;
 if p_stage='prepare' then
  -- Authenticated broker validates the full versioned plan before this command;
  -- SQL independently binds its immutable scope/control/budget/approval identity.
  payload:=p_payload->'plan';
  if coalesce(p_payload->>'planHash','') !~ '^[a-f0-9]{64}$' or jsonb_typeof(payload) is distinct from 'object' or octet_length(payload::text)>8000
   or payload->>'experiment' is distinct from p_experiment::text or payload->'scope' is distinct from c.scope or payload->'originalAds' is distinct from c.original_ads
   or payload->>'preStateHash' is distinct from c.control_hash or payload->>'nativeContractHash' is distinct from c.native_contract_hash
   or payload->>'dailyMinor' is distinct from '40000' or payload->>'weeklyMinor' is distinct from '280000' or payload->>'studyDailyMinor' is distinct from '8000'
   or payload->>'currency' is distinct from 'NZD' or payload->>'timezone' is distinct from 'Pacific/Auckland'
   or coalesce(payload->>'generator','')='' or payload->>'generator' is not distinct from payload->>'reviewer'
   or (payload->>'approvalUntil')::timestamptz<=clock_timestamp() then raise exception 'Unapproved execution plan';end if;
  if x.experiment is not null then if x.plan=payload and x.plan_hash=p_payload->>'planHash' then return jsonb_build_object('prepared',true);end if;raise exception 'Plan conflict';end if;
  if exists(select 1 from public.meta_creative_execution where created_at>clock_timestamp()-interval '7 days') then raise exception 'Creative cadence';end if;
  result:=public.meta_creative_command(p_binding,p_command,p_experiment,'reserve',jsonb_build_object('scope',c.scope,'originalAds',c.original_ads,'approvalHash',payload->>'approvalHash',
   'catalogueHash',payload->>'approvedAssetHash','controlHash',c.control_hash,'budgetHash',c.budget_hash,'nativeContractHash',c.native_contract_hash,'generator',payload->>'generator','reviewer',payload->>'reviewer'));
  insert into public.meta_creative_execution(experiment,plan,plan_hash) values(p_experiment,payload,p_payload->>'planHash');return result;
 end if;
 if x.experiment is null then raise exception 'Execution plan unavailable';end if;
 if p_stage='receipt' then
  select to_jsonb(a) into result from public.meta_creative_effects a where command=p_command and experiment=p_experiment;return result;
 end if;
 if p_stage='authority' then
  if c.global_stop or not c.authority_current or (not c.enabled and not c.cleanup_enabled) or c.generation is distinct from (p_payload->>'generation')::bigint
   or r.lane is distinct from 'creative' or r.experiment is distinct from p_experiment then raise exception 'Execution authority changed';end if;return jsonb_build_object('current',true);
 end if;
 if p_stage='admit' then
  payload:=p_payload->'intent';v_kind:=payload->>'kind';v_target:=payload->>'target';
  if coalesce(v_kind,'') not in('create_creative','create_control','create_challenger','create_study','pause_control','pause_challenger','end_study')
   or jsonb_typeof(payload) is distinct from 'object' or coalesce(payload->>'requestHash','') !~ '^[a-f0-9]{64}$'
   or jsonb_typeof(p_payload->'cleanup') is distinct from 'boolean' then raise exception 'Invalid execution intent';end if;
  select * into i from public.meta_creative_execution_intents where command=p_command;
  if found then if i.intent=payload and i.experiment=p_experiment then return jsonb_build_object('prepared',true);end if;raise exception 'Intent conflict';end if;
  if exists(select 1 from public.meta_creative_execution_intents where experiment=p_experiment and kind=v_kind) then raise exception 'Execution step already admitted';end if;
  result:=public.meta_creative_command(p_binding,p_command,p_experiment,case when (p_payload->>'cleanup')::boolean then 'admit_cleanup' else 'admit' end,
   jsonb_build_object('kind',case when v_kind in('create_control','create_challenger') then 'create_paused_ad' when v_kind in('pause_control','pause_challenger') then 'pause_ad' else v_kind end,
    'objectId',v_target,'requestHash',payload->>'requestHash','generation',p_payload->'generation','preStateHash',x.plan->>'preStateHash','observedAt',to_timestamp((payload->>'at')::double precision/1000)));
  insert into public.meta_creative_execution_intents(command,experiment,kind,intent) values(p_command,p_experiment,v_kind,payload);return result;
 end if;
 if p_stage in('check','confirm','no_effect') then return public.meta_creative_command(p_binding,p_command,p_experiment,p_stage,p_payload);end if;
 if p_stage='measurement' then
  -- Registry join proof only. Consumer release compatibility is additionally
  -- required before activation, which this executor cannot perform.
  select count(*)=2 and count(distinct arm)=2 into ready from public.meta_creative_registered_ads() where experiment=p_experiment;
  if ready then insert into public.meta_creative_execution_receipts(command,experiment,stage) values(p_command,p_experiment,p_stage) on conflict(command)do nothing;end if;
  return jsonb_build_object('ready',ready);
 end if;
 if p_stage in('canary','cleanup') then
  if coalesce(p_payload->>'evidenceHash','') !~ '^[a-f0-9]{64}$' then raise exception 'Missing confirmation';end if;
  if p_stage='cleanup' then result:=public.meta_creative_command(p_binding,p_command,p_experiment,'cleanup',p_payload);
  else
   if (select count(*) from public.meta_creative_objects where experiment=p_experiment and kind in('ad','study'))<>3
    or exists(select 1 from public.meta_creative_effects where experiment=p_experiment and state in('prepared','uncertain')) then raise exception 'Canary unconfirmed';end if;
   result:=jsonb_build_object('paused',true,'activationReady',false);
  end if;
  insert into public.meta_creative_execution_receipts(command,experiment,stage,evidence_hash) values(p_command,p_experiment,p_stage,p_payload->>'evidenceHash') on conflict(command)do nothing;
  return result;
 end if;
 raise exception 'Unknown execution stage';
end$$;
revoke all on function public.meta_creative_registered_ads() from public,anon,authenticated;
grant execute on function public.meta_creative_registered_ads() to service_role;
revoke all on function public.meta_creative_executor_command(text,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.meta_creative_executor_command(text,uuid,uuid,text,jsonb) to service_role;
commit;
