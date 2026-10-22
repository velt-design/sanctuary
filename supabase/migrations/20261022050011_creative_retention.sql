begin;
select pg_advisory_xact_lock(819421,1);
-- Continuation uses the existing immutable intents/objects/receipts and the
-- existing global acquisition lock. No new scheduler, table or access grant.
alter table public.meta_creative_execution_intents drop constraint meta_creative_execution_intents_kind_check;
alter table public.meta_creative_execution_intents add constraint meta_creative_execution_intents_kind_check check(kind in('create_creative','create_control','create_challenger','create_study','activate_control','activate_challenger','pause_control','pause_challenger','end_study','create_retained','pause_previous','activate_retained','pause_retained','restore_previous'));
create unique index creative_retention_once on public.meta_creative_execution_intents(experiment,kind) where kind in('create_retained','pause_previous','activate_retained','pause_retained','restore_previous');
alter table public.meta_creative_execution_receipts drop constraint meta_creative_execution_receipts_stage_check;
alter table public.meta_creative_execution_receipts add constraint meta_creative_execution_receipts_stage_check check(stage in('canary','measurement','activation','evaluation','cleanup','delivery_health','delivery_interrupted','analysis_started','analysis_ack','retention_aborted','retained','retention_reverted'));

create function public.meta_creative_retained_ads()returns jsonb language plpgsql stable set search_path='' as $$
declare result jsonb;
begin
 select coalesce(jsonb_agg(jsonb_build_object('experiment',x.experiment,'planHash',x.plan_hash,'donor',x.plan->>'controlAd','ad',o.object_id,'creative',(i.intent#>>'{body,creative}')::jsonb->>'creative_id')order by x.plan->>'controlAd'),'[]')into result
 from public.meta_creative_objects o join public.meta_creative_execution x on x.experiment=o.experiment
 join public.meta_creative_execution_intents i on i.command=o.created_by and i.kind='create_retained'
 join public.meta_creative_control c on c.singleton and x.plan->'scope'=c.scope and x.plan->'originalAds'=c.original_ads
 where exists(select 1 from public.meta_creative_execution_receipts r where r.experiment=x.experiment and r.stage='retained')
 and not exists(select 1 from public.meta_creative_execution_receipts r where r.experiment=x.experiment and r.stage='retention_reverted')
 and(select e.kind from public.meta_creative_effects e where e.object_id=o.object_id and e.state='confirmed' order by e.admitted_at desc,e.command desc limit 1)='activate_ad';
 if jsonb_array_length(result)>4 or(select count(distinct v->>'donor')from jsonb_array_elements(result)v)<>jsonb_array_length(result)then raise exception 'Retained donor bound';end if;
 return result;
end$$;

create function public.meta_creative_winning_control(p_plan jsonb,p_creative text)returns jsonb language plpgsql immutable set search_path='' as $$
declare result jsonb:=jsonb_set(jsonb_set(p_plan->'control','{id}',to_jsonb(p_creative)),'{primary}',p_plan->'challengerPrimary');
begin
 if result->>'format'='video_assets'then
  result:=jsonb_set(result,'{payload,asset_feed_spec,bodies,0,text}',p_plan->'challengerPrimary');
  if result#>'{payload,object_story_spec,video_data,message}'is not null then result:=jsonb_set(result,'{payload,object_story_spec,video_data,message}',p_plan->'challengerPrimary');end if;
 elsif result->>'format'='video_story'then result:=jsonb_set(result,'{payload,object_story_spec,video_data,message}',p_plan->'challengerPrimary');end if;
 return result;
end$$;

create function public.meta_creative_retention_state(p_experiment uuid)returns jsonb language plpgsql stable set search_path='' as $$
declare x public.meta_creative_execution;c public.meta_creative_control;a public.meta_creative_formal_analysis;result jsonb;
begin
 select * into x from public.meta_creative_execution where experiment=p_experiment;
 select * into c from public.meta_creative_control where singleton;
 select * into a from public.meta_creative_formal_analysis where experiment=p_experiment;
 if x.experiment is null or a.payload->>'decision'is distinct from'retain'then raise exception 'Retained result unavailable';end if;
 result:=jsonb_build_object('version',1,'experiment',x.experiment,'planHash',x.plan_hash,'analysisCommand',a.command,'donor',x.plan->>'controlAd',
  'generation',c.generation,'enabled',c.enabled and c.delivery_enabled,'cleanupEnabled',c.cleanup_enabled,'stopped',c.global_stop or not c.authority_current,
  'study',(select object_id from public.meta_creative_objects where experiment=x.experiment and kind='study'),
  'creative',(select object_id from public.meta_creative_effects where experiment=x.experiment and kind='create_creative'and state='confirmed'),
  'ad',(select o.object_id from public.meta_creative_objects o join public.meta_creative_execution_intents i on i.command=o.created_by where o.experiment=x.experiment and i.kind='create_retained'),
  'previous',coalesce(x.plan->'retainedBaseline','null'::jsonb),
  'otherBaselines',(select coalesce(jsonb_agg(v),'[]')from jsonb_array_elements(public.meta_creative_retained_ads())v where v->>'donor'<>x.plan->>'controlAd'),
  'testAds',(select coalesce(jsonb_agg(jsonb_build_object('arm',case i.kind when'create_control'then'control'else'challenger'end,'ad',o.object_id)order by i.kind),'[]')from public.meta_creative_objects o join public.meta_creative_execution_intents i on i.command=o.created_by where o.experiment=x.experiment and i.kind in('create_control','create_challenger')),
  'testCleanupComplete',exists(select 1 from public.meta_creative_execution_receipts where experiment=x.experiment and stage='cleanup')and not exists(select 1 from public.meta_creative_effects e join public.meta_creative_execution_intents i on i.command=e.command where e.experiment=x.experiment and i.kind in('create_creative','create_control','create_challenger','create_study','activate_control','activate_challenger','pause_control','pause_challenger','end_study')and e.state in('prepared','uncertain'))and not exists(select 1 from public.meta_creative_objects o join public.meta_creative_execution_intents i on i.command=o.created_by where o.experiment=x.experiment and i.kind in('create_control','create_challenger')and(select e.kind from public.meta_creative_effects e where e.object_id=o.object_id and e.state='confirmed'order by e.admitted_at desc,e.command desc limit 1)is distinct from'pause_ad'),
  'aborting',exists(select 1 from public.meta_creative_execution_receipts where experiment=x.experiment and stage='retention_aborted'),
  'finalized',(select case stage when'retained'then'retained'else'reverted'end from public.meta_creative_execution_receipts where experiment=x.experiment and stage in('retained','retention_reverted')order by recorded_at desc,command desc limit 1),
  'effects',(select coalesce(jsonb_agg(jsonb_build_object('command',e.command,'kind',i.kind,'state',e.state,'intent',i.intent-'proof','object',e.object_id,'evidenceHash',e.evidence_hash)order by e.admitted_at),'[]')from public.meta_creative_effects e join public.meta_creative_execution_intents i on i.command=e.command where e.experiment=x.experiment and i.kind in('create_retained','pause_previous','activate_retained','pause_retained','restore_previous')));
 return result;
end$$;

create function public.meta_creative_retention_next(s jsonb)returns text language plpgsql immutable set search_path='' as $$
declare done text[];seen text[];aborting boolean;
begin
 select array_agg(v->>'kind')filter(where v->>'state'='confirmed'),array_agg(v->>'kind')into done,seen from jsonb_array_elements(s->'effects')v;
 done:=coalesce(done,'{}');seen:=coalesce(seen,'{}');
 if(s->>'stopped')::boolean then return'stopped';end if;
 if exists(select 1 from jsonb_array_elements(s->'effects')v where v->>'state'in('prepared','uncertain'))then return'reconcile';end if;
 if s->>'finalized'='reverted'then return'closed';end if;
 aborting:=(s->>'aborting')::boolean or not(s->>'enabled')::boolean or exists(select 1 from jsonb_array_elements(s->'effects')v where v->>'state'='no_effect');
 if aborting then
  if not(s->>'cleanupEnabled')::boolean then return'stopped';end if;
  if s->>'ad'is not null and not('pause_retained'=any(done))then return case when'pause_retained'=any(seen)then'recovery_required'else'pause_retained'end;end if;
  if s->>'previous'is not null and'pause_previous'=any(done)and not('restore_previous'=any(done))then return case when not(s->>'enabled')::boolean or'restore_previous'=any(seen)then'recovery_required'else'restore_previous'end;end if;
  return'finish_reverted';
 end if;
 if s->>'finalized'='retained'then return'observe';end if;
 if s->>'ad'is null then return'create_retained';end if;
 if not('create_retained'=any(done))then raise exception 'Unproved retained registry';end if;
 if s->>'previous'is not null and not('pause_previous'=any(done))then return'pause_previous';end if;
 if not('activate_retained'=any(done))then return'activate_retained';end if;
 return'finish_retained';
end$$;

create function public.meta_creative_retention_current(p_experiment uuid,p_generation bigint,p_kind text,p_proof jsonb)returns void language plpgsql set search_path='' as $$
declare c public.meta_creative_control;x public.meta_creative_execution;a public.meta_creative_formal_analysis;r public.acquisition_experiment_reservation;acceptance jsonb;s jsonb;
begin
 select * into c from public.meta_creative_control where singleton for update;
 select * into x from public.meta_creative_execution where experiment=p_experiment;
 select * into a from public.meta_creative_formal_analysis where experiment=p_experiment;
 select * into r from public.acquisition_experiment_reservation where singleton for update;
 s:=public.meta_creative_retention_state(p_experiment);acceptance:=public.meta_creative_native_acceptance_for(p_experiment);
 if c.global_stop or not c.authority_current or c.generation is distinct from p_generation or r.lane is distinct from'creative'or r.experiment is distinct from p_experiment
  or c.scope is distinct from x.plan->'scope'or c.original_ads is distinct from x.plan->'originalAds'or c.native_contract_hash is distinct from x.plan->>'nativeContractHash'
  or x.plan->>'purpose'is distinct from'formal_experiment'or a.payload->>'decision'is distinct from'retain'or a.payload->>'planHash'is distinct from x.plan_hash
  or(a.payload->>'observedAt')::timestamptz<to_timestamp((x.plan->>'end')::double precision)+interval'72 hours'
  or not exists(select 1 from public.meta_creative_execution_receipts where experiment=p_experiment and stage='analysis_ack')
  or not(s->>'testCleanupComplete')::boolean
  then raise exception 'Retention authority changed';end if;
 if p_kind='pause_retained'then if not c.cleanup_enabled then raise exception 'Retention cleanup stopped';end if;return;end if;
 if not c.enabled or not c.delivery_enabled or acceptance is null or x.plan->>'landingTemplate'is distinct from(select template from public.landing_experiment_control where singleton)
  or p_proof->>'acceptance'is distinct from acceptance->>'id'or p_proof->>'planHash'is distinct from x.plan_hash or p_proof->>'analysisCommand'is distinct from a.command::text
  or p_proof->>'settingsHash'is distinct from x.plan->>'preStateHash'or p_proof->>'study'is distinct from s->>'study'
  or p_proof->>'studyEnd'is distinct from x.plan->>'end'or p_proof->>'studyObservationEnd'is distinct from x.plan->>'end'
  or(p_proof->>'observedAt')::timestamptz not between clock_timestamp()-interval'60 seconds'and clock_timestamp()+interval'1 second'
  or p_proof#>>'{candidate,ad}'is distinct from s->>'ad'or p_proof#>>'{previous,ad}'is distinct from s#>>'{previous,ad}'
  or jsonb_typeof(p_proof->'testAds')is distinct from'array'or jsonb_array_length(p_proof->'testAds')<>2
  or(select jsonb_agg(jsonb_build_object('arm',v->>'arm','ad',v->>'ad')order by v->>'arm')from jsonb_array_elements(p_proof->'testAds')v)is distinct from(select jsonb_agg(v order by v->>'arm')from jsonb_array_elements(s->'testAds')v)
  or exists(select 1 from jsonb_array_elements(p_proof->'testAds')v where v->>'status'is distinct from'PAUSED'or v->>'creative'is distinct from(case when v->>'arm'='control'then x.plan#>>'{control,id}'else s->>'creative'end))
  or(select coalesce(jsonb_agg(v-'proof'order by v->>'donor'),'[]')from jsonb_array_elements(p_proof->'otherBaselines')v)is distinct from(select coalesce(jsonb_agg(v order by v->>'donor'),'[]')from jsonb_array_elements(s->'otherBaselines')v)
  then raise exception 'Retention evidence changed';end if;
end$$;

-- Direct core dispatch cannot bypass the retention-specific proof fence.
alter function public.meta_creative_command(text,uuid,uuid,text,jsonb)rename to meta_creative_without_retention;
revoke all on function public.meta_creative_without_retention(text,uuid,uuid,text,jsonb)from public,anon,authenticated,service_role;
create function public.meta_creative_command(p_binding text,p_command uuid,p_experiment uuid,p_stage text,p_payload jsonb default '{}')returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.meta_creative_execution_intents where command=p_command and kind in('create_retained','pause_previous','activate_retained','pause_retained','restore_previous'))then raise exception 'Use retention fence';end if;
 return public.meta_creative_without_retention(p_binding,p_command,p_experiment,p_stage,p_payload);
end$$;

alter function public.meta_creative_executor_command(text,uuid,uuid,text,jsonb)rename to meta_creative_executor_without_retention;
revoke all on function public.meta_creative_executor_without_retention(text,uuid,uuid,text,jsonb)from public,anon,authenticated,service_role;
create function public.meta_creative_executor_command(p_binding text,p_command uuid,p_experiment uuid,p_stage text,p_payload jsonb default '{}')returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.meta_creative_control;x public.meta_creative_execution;previous public.meta_creative_execution;e public.meta_creative_effects;i public.meta_creative_execution_intents;
 result jsonb;s jsonb;intent jsonb;proof jsonb;refs jsonb;baseline jsonb;v_kind text;target_id text;v_object text;next_step text;h text;generic_kind text;
begin
 perform pg_advisory_xact_lock(819421,1);
 select * into c from public.meta_creative_control where singleton for update;
 if c.binding is null or c.binding is distinct from p_binding or p_command is null or jsonb_typeof(p_payload)is distinct from'object'or octet_length(p_payload::text)>14000 then raise exception 'Creative authority unavailable';end if;
 if p_stage='prepare'then
  refs:=public.meta_creative_retained_ads();select v into baseline from jsonb_array_elements(refs)v where v->>'donor'=p_payload#>>'{plan,controlAd}';
  if p_payload#>'{plan,retainedBaseline}'is distinct from baseline then raise exception 'Retained baseline changed';end if;
  if baseline is not null then
   select * into previous from public.meta_creative_execution where experiment=(baseline->>'experiment')::uuid;
   if p_payload#>'{plan,control}'is distinct from public.meta_creative_winning_control(previous.plan,baseline->>'creative')or p_payload#>'{plan,adTracking}'is distinct from previous.plan->'adTracking'then raise exception 'Retained control differs';end if;
  end if;
 end if;
 if p_stage not like'retention_%'then
  result:=public.meta_creative_executor_without_retention(p_binding,p_command,p_experiment,p_stage,p_payload);
  if p_stage='read'then
   result:=jsonb_set(result,'{effects}',(select coalesce(jsonb_agg(v),'[]')from jsonb_array_elements(result->'effects')v where v->>'kind'not in('create_retained','pause_previous','activate_retained','pause_retained','restore_previous')));
   result:=jsonb_set(result,'{objects}',(select coalesce(jsonb_agg(v),'[]')from jsonb_array_elements(result->'objects')v where not exists(select 1 from public.meta_creative_execution_intents j where j.command=(v->>'command')::uuid and j.kind='create_retained')));
   select coalesce(jsonb_agg(o.object_id order by o.object_id),'[]')into refs from public.meta_creative_objects o join public.meta_creative_execution y on y.experiment=o.experiment where o.kind='ad'and y.plan->'scope'=c.scope and exists(select 1 from public.meta_creative_execution_receipts r where r.experiment=o.experiment and r.stage='cleanup')and(select a.kind from public.meta_creative_effects a where a.object_id=o.object_id and a.state='confirmed'order by a.admitted_at desc,a.command desc limit 1)='pause_ad';
   return result||jsonb_build_object('retainedAds',public.meta_creative_retained_ads(),'settledAds',case when jsonb_array_length(refs)<=20 then refs else'null'::jsonb end);
  end if;return result;
 end if;
 select * into x from public.meta_creative_execution where experiment=p_experiment;
 s:=public.meta_creative_retention_state(p_experiment);next_step:=public.meta_creative_retention_next(s);
 if p_stage='retention_read'then return jsonb_build_object('state',s,'plan',x.plan,'analysis',(select payload from public.meta_creative_formal_analysis where experiment=p_experiment),'acceptance',public.meta_creative_native_acceptance_for(p_experiment),'retainedAds',public.meta_creative_retained_ads());end if;
 if p_stage='retention_authority'then
  if c.global_stop or not c.authority_current or c.generation is distinct from(p_payload->>'generation')::bigint or(not c.enabled and not c.cleanup_enabled)or not exists(select 1 from public.acquisition_experiment_reservation where lane='creative'and experiment=p_experiment)then raise exception 'Retention authority changed';end if;return jsonb_build_object('current',true);
 end if;
 if p_stage='retention_abort'then
  if coalesce(p_payload->>'evidenceHash','')!~'^[a-f0-9]{64}$'then raise exception 'Retention abort evidence differs';end if;
  if c.global_stop or not c.authority_current or not c.cleanup_enabled or c.generation is distinct from(p_payload->>'generation')::bigint then raise exception 'Retention abort unavailable';end if;
  if exists(select 1 from public.acquisition_experiment_reservation where lane<>'creative'or experiment<>p_experiment)then raise exception 'Acquisition reservation unavailable';end if;
  insert into public.acquisition_experiment_reservation(lane,experiment)values('creative',p_experiment)on conflict(singleton)do nothing;
  insert into public.meta_creative_execution_receipts(command,experiment,stage,evidence_hash)values(p_command,p_experiment,'retention_aborted',p_payload->>'evidenceHash')on conflict(command)do nothing;
  if not exists(select 1 from public.meta_creative_execution_receipts where command=p_command and experiment=p_experiment and stage='retention_aborted'and evidence_hash=p_payload->>'evidenceHash')then raise exception 'Retention abort conflict';end if;
  return jsonb_build_object('aborting',true);
 end if;
 if p_stage='retention_finish'then
  if coalesce(p_payload->>'evidenceHash','')!~'^[a-f0-9]{64}$'or p_payload->>'outcome'not in('retained','reverted')then raise exception 'Retention final evidence differs';end if;
  if exists(select 1 from public.meta_creative_execution_receipts where command=p_command)then
   if not exists(select 1 from public.meta_creative_execution_receipts where command=p_command and experiment=p_experiment and stage=case when p_payload->>'outcome'='retained'then'retained'else'retention_reverted'end and evidence_hash=p_payload->>'evidenceHash')then raise exception 'Retention final conflict';end if;
   return jsonb_build_object('finalized',p_payload->>'outcome');
  end if;
  if next_step not in('finish_retained','finish_reverted')or p_payload->>'outcome'is distinct from(case when next_step='finish_retained'then'retained'else'reverted'end)then raise exception 'Retention not settled';end if;
  perform public.meta_creative_retention_current(p_experiment,(p_payload->>'generation')::bigint,case when next_step='finish_retained'then'activate_retained'else'pause_retained'end,p_payload->'proof');
  insert into public.meta_creative_execution_receipts(command,experiment,stage,evidence_hash)values(p_command,p_experiment,case when next_step='finish_retained'then'retained'else'retention_reverted'end,p_payload->>'evidenceHash');
  delete from public.acquisition_experiment_reservation where lane='creative'and experiment=p_experiment;
  perform public.meta_creative_retained_ads();return jsonb_build_object('finalized',p_payload->>'outcome');
 end if;
 select * into e from public.meta_creative_effects where command=p_command for update;
 select * into i from public.meta_creative_execution_intents where command=p_command;
 if p_stage='retention_admit'then
  intent:=p_payload->'intent';proof:=p_payload->'proof';v_kind:=intent->>'kind';
  h:=encode(sha256(convert_to(jsonb_build_array(p_experiment,p_stage,p_payload)::text,'UTF8')),'hex');
  if e.command is not null then if e.command_hash<>h or e.experiment<>p_experiment then raise exception 'Retention command conflict';end if;return jsonb_build_object('prepared',true);end if;
  if v_kind not in('create_retained','pause_previous','activate_retained','pause_retained','restore_previous')or v_kind is distinct from next_step then raise exception 'Retention transition differs';end if;
  perform public.meta_creative_retention_current(p_experiment,(p_payload->>'generation')::bigint,v_kind,proof);
  target_id:=case when v_kind in('pause_previous','restore_previous')then s#>>'{previous,ad}'when v_kind='create_retained'then null else s->>'ad'end;
  if intent->>'target'is distinct from target_id or(target_id is not null and c.original_ads?target_id)or intent->>'path'is distinct from coalesce(target_id,'act_'||(c.scope->>'account')||'/ads')then raise exception 'Retention target differs';end if;
  if v_kind='create_retained'then
   if (intent->'body')-array['name','adset_id','creative','tracking_specs','status']<>'{}'::jsonb or(select count(*)from jsonb_object_keys(intent->'body'))<>5 or intent#>>'{body,name}'is distinct from'velt-'||p_experiment::text||'-retained'or intent#>>'{body,status}'is distinct from'PAUSED'or intent#>>'{body,adset_id}'is distinct from c.scope->>'adset'or(intent#>>'{body,creative}')::jsonb is distinct from jsonb_build_object('creative_id',s->>'creative')or(intent#>>'{body,tracking_specs}')::jsonb is distinct from x.plan->'adTracking'then raise exception 'Retained create differs';end if;
   generic_kind:='create_paused_ad';
  else
   generic_kind:=case when v_kind in('activate_retained','restore_previous')then'activate_ad'else'pause_ad'end;
   if intent->'body'is distinct from jsonb_build_object('status',case when generic_kind='activate_ad'then'ACTIVE'else'PAUSED'end)then raise exception 'Retention status differs';end if;
   if not exists(select 1 from public.meta_creative_objects where object_id=target_id and kind='ad'and experiment=case when v_kind in('pause_previous','restore_previous')then(s#>>'{previous,experiment}')::uuid else p_experiment end)then raise exception 'Retention target unowned';end if;
  end if;
  if to_timestamp((intent->>'at')::double precision/1000)not between clock_timestamp()-interval'60 seconds'and clock_timestamp()+interval'1 second'or coalesce(intent->>'requestHash','')!~'^[a-f0-9]{64}$'then raise exception 'Retention intent stale';end if;
  insert into public.meta_creative_effects(command,experiment,command_hash,request_hash,kind,target,generation,pre_state_hash,terminal_cleanup)values(p_command,p_experiment,h,intent->>'requestHash',generic_kind,target_id,c.generation,x.plan->>'preStateHash',v_kind='pause_retained');
  insert into public.meta_creative_execution_intents(command,experiment,kind,intent)values(p_command,p_experiment,v_kind,intent||jsonb_build_object('proof',proof));
  return jsonb_build_object('prepared',true);
 end if;
 if e.experiment is distinct from p_experiment or i.kind not in('create_retained','pause_previous','activate_retained','pause_retained','restore_previous')or e.request_hash is distinct from p_payload->>'requestHash'then raise exception 'Retention receipt differs';end if;
 if p_stage='retention_check'then
  if e.state<>'prepared'or e.admitted_at<clock_timestamp()-interval'60 seconds'then raise exception 'Retention dispatch consumed';end if;
  perform public.meta_creative_retention_current(p_experiment,e.generation,i.kind,i.intent->'proof');
  update public.meta_creative_effects set state='uncertain',dispatch_claimed_at=clock_timestamp()where command=p_command;
  return jsonb_build_object('dispatch',true);
 end if;
 if p_stage='retention_no_effect'then
  if coalesce(p_payload->>'evidenceHash','')!~'^[a-f0-9]{64}$'then raise exception 'Retention no-effect evidence differs';end if;
  if e.state='no_effect'and e.dispatch_claimed_at is null and e.evidence_hash=p_payload->>'evidenceHash'and p_payload->>'reason'='dispatch_not_started'then return jsonb_build_object('noEffect',true);end if;
  if e.dispatch_claimed_at is not null or e.state<>'prepared'or p_payload->>'reason'is distinct from'dispatch_not_started'then raise exception 'Retention no-effect unavailable';end if;
  update public.meta_creative_effects set state='no_effect',evidence_hash=p_payload->>'evidenceHash',confirmed_at=clock_timestamp()where command=p_command;return jsonb_build_object('noEffect',true);
 end if;
 if p_stage='retention_confirm'then
  v_object:=p_payload->>'objectId';
  if coalesce(v_object,'')!~'^[1-9][0-9]{0,19}$'or c.original_ads?v_object or coalesce(p_payload->>'evidenceHash','')!~'^[a-f0-9]{64}$'then raise exception 'Retention confirmation differs';end if;
  if e.state='confirmed'then if e.object_id is distinct from v_object or e.evidence_hash is distinct from p_payload->>'evidenceHash'then raise exception 'Retention confirmation conflict';end if;return jsonb_build_object('confirmed',true);end if;
  if e.state<>'uncertain'or e.dispatch_claimed_at is null then raise exception 'Retention not dispatched';end if;
  if i.kind='create_retained'then insert into public.meta_creative_objects(object_id,experiment,kind,created_by,request_hash,evidence_hash)values(v_object,p_experiment,'ad',p_command,e.request_hash,p_payload->>'evidenceHash');
  elsif e.target is distinct from v_object then raise exception 'Retention target differs';end if;
  update public.meta_creative_effects set state='confirmed',object_id=p_payload->>'objectId',evidence_hash=p_payload->>'evidenceHash',confirmed_at=clock_timestamp()where command=p_command;
  return jsonb_build_object('confirmed',true);
 end if;
 raise exception 'Unknown retention stage';
end$$;
revoke all on function public.meta_creative_retained_ads(),public.meta_creative_winning_control(jsonb,text),public.meta_creative_retention_state(uuid),public.meta_creative_retention_next(jsonb),public.meta_creative_retention_current(uuid,bigint,text,jsonb)from public,anon,authenticated,service_role;
revoke all on function public.meta_creative_command(text,uuid,uuid,text,jsonb),public.meta_creative_executor_command(text,uuid,uuid,text,jsonb)from public,anon,authenticated;
grant execute on function public.meta_creative_command(text,uuid,uuid,text,jsonb),public.meta_creative_executor_command(text,uuid,uuid,text,jsonb)to service_role;
commit;
