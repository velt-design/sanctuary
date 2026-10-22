begin;
-- Synthetic historical terminal cohorts only. Owner fixture inserts do not
-- establish Meta permissions, delivery, study semantics or real native proof.
create function pg_temp.ret_assert(ok boolean)returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'Retention assertion failed';end if;end$$;
create function pg_temp.ret_reject(statement text)returns void language plpgsql as $$begin begin execute statement;exception when others then return;end;raise exception 'Expected retention rejection';end$$;
update public.meta_creative_control set enabled=true,delivery_enabled=true,cleanup_enabled=true,authority_current=true,global_stop=false;
update public.landing_experiment_control set template=repeat('a',64);
create function pg_temp.ret_seed(donor text,baseline jsonb default null)returns uuid language plpgsql as $$
declare e uuid:=gen_random_uuid();p jsonb;a jsonb;h text;prefix bigint;cmd uuid;k text;obj text;stamp text;acceptance public.meta_creative_native_acceptance;begin
 prefix:=900000+(select count(*)from public.meta_creative_execution)*10;h:=encode(sha256(convert_to(e::text,'UTF8')),'hex');stamp:=to_char(clock_timestamp()at time zone'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
 select jsonb_build_object('experiment',e,'scope',scope,'originalAds',original_ads,'preStateHash',control_hash,'nativeContractHash',native_contract_hash,'controlAd',donor,
 'dailyMinor',40000,'weeklyMinor',280000,'studyDailyMinor',8000,'landingTemplate',repeat('a',64),'purpose','formal_experiment','currency','NZD','timezone','Pacific/Auckland',
 'generator','resp_synthetic_author','reviewer','resp_synthetic_review','approvalHash',repeat('a',64),'approvedAssetHash',repeat('a',64),'approvalUntil',clock_timestamp()-interval'1 hour',
 'adTracking','[]'::jsonb,'nativeObjective',jsonb_build_object('adspixels',jsonb_build_array(jsonb_build_object('id','8801'))),
 'control',jsonb_build_object('id',coalesce(baseline->>'creative','8001'),'format','image','page',scope->>'page','primary','Approved baseline.','path','/acrylic-roof-pergolas-auckland'),
 'challengerPrimary','Approved winning hook.','start',floor(extract(epoch from clock_timestamp()-interval'18 days')),'end',floor(extract(epoch from clock_timestamp()-interval'4 days')))
 into p from public.meta_creative_control;
 if baseline is not null then p:=p||jsonb_build_object('retainedBaseline',baseline);end if;
 insert into public.meta_creative_plans(id,plan,plan_hash,created_at)values(e,'{}',h,clock_timestamp()-interval'20 days');
 insert into public.meta_creative_execution(experiment,plan,plan_hash,created_at)values(e,p,h,clock_timestamp()-interval'20 days');
 foreach k in array array['create_creative','create_control','create_challenger','create_study']loop
  cmd:=gen_random_uuid();obj:=(prefix+case k when'create_creative'then 1 when'create_control'then 2 when'create_challenger'then 3 else 4 end)::text;
  insert into public.meta_creative_effects(command,experiment,command_hash,request_hash,kind,generation,pre_state_hash,state,dispatch_claimed_at,object_id,evidence_hash,admitted_at,confirmed_at)
  values(cmd,e,h,h,case when k in('create_control','create_challenger')then'create_paused_ad'else k end,1,h,'confirmed',clock_timestamp()-interval'18 days',obj,h,clock_timestamp()-interval'18 days',clock_timestamp()-interval'18 days');
  insert into public.meta_creative_execution_intents values(cmd,e,k,jsonb_build_object('kind',k));
  if k<>'create_creative'then insert into public.meta_creative_objects values(obj,e,case when k='create_study'then'study'else'ad'end,cmd,h,h,clock_timestamp()-interval'18 days');end if;
 end loop;
 foreach k in array array['pause_control','pause_challenger']loop
  cmd:=gen_random_uuid();obj:=(prefix+case k when'pause_control'then 2 else 3 end)::text;
  insert into public.meta_creative_effects(command,experiment,command_hash,request_hash,kind,target,generation,pre_state_hash,terminal_cleanup,state,dispatch_claimed_at,object_id,evidence_hash,admitted_at,confirmed_at)values(cmd,e,h,h,'pause_ad',obj,1,h,true,'confirmed',clock_timestamp()-interval'4 days',obj,h,clock_timestamp()-interval'4 days',clock_timestamp()-interval'4 days');
  insert into public.meta_creative_execution_intents values(cmd,e,k,jsonb_build_object('kind',k));
 end loop;
 insert into public.meta_creative_execution_receipts(command,experiment,stage,evidence_hash)select gen_random_uuid(),e,stages.stage,h from unnest(array['canary','cleanup','analysis_ack'])stages(stage);
 a:=jsonb_build_object('version',1,'experiment',e,'planHash',h,'policy','native-saved-enquiry-per-dollar-v1','observedAt',stamp,'cohortHash',h,'spendHash',h,'deliveryHash',h,'sourceDates',jsonb_build_object('cohort',stamp,'spend',stamp,'delivery',stamp),
 'allSavedCoverage','complete','coverageCounts',jsonb_build_object('websiteGenuine',60,'nativeMatched',60,'knownOtherRegistered',0,'unknownAttribution',0,'unlinkedNative',0),'unresolvedLate',0,
 'arms',jsonb_build_array(jsonb_build_object('arm','control','ad',(prefix+2)::text,'enquiries',20,'spend',100,'canonical',20,'correspondence',0,'intake',0,'assessed',20,'concerns',0,'conflicting',0,'unknown',0),jsonb_build_object('arm','challenger','ad',(prefix+3)::text,'enquiries',40,'spend',100,'canonical',40,'correspondence',0,'intake',0,'assessed',40,'concerns',0,'conflicting',0,'unknown',0)),
 'decision','retain','reason','formal_interval','interval',jsonb_build_object('lower',1.2,'upper',3,'upperUnbounded',false),'quality','passes');
 insert into public.meta_creative_formal_analysis(experiment,command,payload)values(e,gen_random_uuid(),a);
 acceptance.id:=gen_random_uuid();acceptance.example_experiment:=e;acceptance.example_study:=(prefix+4)::text;acceptance.scope:=p->'scope';acceptance.original_ads:=p->'originalAds';acceptance.native_contract_hash:=p->>'nativeContractHash';acceptance.pixel:='8801';
 acceptance.example_cells:=jsonb_build_array(jsonb_build_object('id','9401','ad',(prefix+2)::text,'arm','control'),jsonb_build_object('id','9402','ad',(prefix+3)::text,'arm','challenger'));
 acceptance.observed_at:=clock_timestamp()-interval'19 days';acceptance.recorded_at:=acceptance.observed_at;acceptance.provenance:='hosted_paused_study_and_native_ui';acceptance.evidence_hash:=h;
 acceptance.unit_proof_hash:=h;acceptance.allocation_proof_hash:=h;acceptance.originals_proof_hash:=h;acceptance.objective_proof_hash:=h;
 acceptance.semantics:='{"currency":"NZD","timezone":"Pacific/Auckland","budgetOwner":"campaign","dailyMinor":40000,"studyDailyMinor":8000,"uiStudyDaily":80,"offset":100,"allocation":"existing_campaign_portion","experimentalUnit":"SPLIT_TEST_V2_ad_cells","topology":"same_original_adset","objective":"CONVERSIONS","event":"Lead","isPrimary":true}';
 insert into public.meta_creative_native_acceptance select acceptance.*;
 insert into public.acquisition_experiment_reservation(lane,experiment)values('creative',e);return e;
end$$;
create function pg_temp.ret_proof(e uuid)returns jsonb language plpgsql as $$declare s jsonb;p jsonb;begin
 s:=public.meta_creative_retention_state(e);select plan into p from public.meta_creative_execution where experiment=e;
 return jsonb_build_object('version',1,'planHash',s->'planHash','analysisCommand',s->'analysisCommand','observedAt',clock_timestamp(),'study',s->'study','studyEnd',p->'end','studyObservationEnd',p->'end','studyProof',repeat('a',64),
 'acceptance',public.meta_creative_native_acceptance_for(e)->'id','originalsHash',repeat('a',64),'budgetHash',repeat('a',64),'settingsHash',p->'preStateHash','creativeHash',repeat('a',64),
 'candidate',case when s->>'ad'is null then'null'::jsonb else jsonb_build_object('ad',s->'ad','proof',repeat('a',64))end,
 'previous',case when s->>'previous'is null then'null'::jsonb else jsonb_build_object('ad',s#>'{previous,ad}','status','ACTIVE','proof',repeat('a',64))end,
 'testAds',(select jsonb_agg(v||jsonb_build_object('status','PAUSED','creative',case when v->>'arm'='control'then p#>'{control,id}'else s->'creative'end,'proof',repeat('a',64)))from jsonb_array_elements(s->'testAds')v),
 'otherBaselines',(select coalesce(jsonb_agg(v||jsonb_build_object('proof',repeat('a',64))),'[]')from jsonb_array_elements(s->'otherBaselines')v));
end$$;
create function pg_temp.ret_payload(e uuid,k text)returns jsonb language plpgsql as $$declare s jsonb;p jsonb;t text;b jsonb;begin
 s:=public.meta_creative_retention_state(e);select plan into p from public.meta_creative_execution where experiment=e;
 t:=case when k in('pause_previous','restore_previous')then s#>>'{previous,ad}'when k='create_retained'then null else s->>'ad'end;
 b:=case when k='create_retained'then jsonb_build_object('name','velt-'||e::text||'-retained','adset_id',p#>>'{scope,adset}','creative',jsonb_build_object('creative_id',s->>'creative')::text,'tracking_specs','[]','status','PAUSED')else jsonb_build_object('status',case when k in('activate_retained','restore_previous')then'ACTIVE'else'PAUSED'end)end;
 return jsonb_build_object('generation',s->'generation','proof',case when k='pause_retained'then'null'::jsonb else pg_temp.ret_proof(e)end,'intent',jsonb_build_object('kind',k,'path',coalesce(t,'act_'||(p#>>'{scope,account}')||'/ads'),'body',b,'target',t,'requestHash',repeat('e',64),'at',floor(extract(epoch from clock_timestamp())*1000)));
end$$;
create function pg_temp.ret_effect(e uuid,k text,new_ad text default null)returns void language plpgsql as $$declare cmd uuid:=gen_random_uuid();p jsonb;begin
 p:=pg_temp.ret_payload(e,k);perform public.meta_creative_executor_command(repeat('b',64),cmd,e,'retention_admit',p);
 perform public.meta_creative_executor_command(repeat('b',64),cmd,e,'retention_check',jsonb_build_object('requestHash',repeat('e',64)));
 perform public.meta_creative_executor_command(repeat('b',64),cmd,e,'retention_confirm',jsonb_build_object('requestHash',repeat('e',64),'objectId',coalesce(new_ad,p#>>'{intent,target}'),'evidenceHash',repeat('f',64)));
end$$;
create function pg_temp.ret_finish(e uuid,outcome text)returns void language plpgsql as $$declare cmd uuid:=gen_random_uuid();p jsonb;begin
 p:=jsonb_build_object('generation',(select generation from public.meta_creative_control),'outcome',outcome,'evidenceHash',repeat('a',64),'proof',case when outcome='retained'then pg_temp.ret_proof(e)else'null'::jsonb end);
 perform public.meta_creative_executor_command(repeat('b',64),cmd,e,'retention_finish',p);
 -- A lost final reply replays the immutable receipt, never reserves new work.
 perform public.meta_creative_executor_command(repeat('b',64),cmd,e,'retention_finish',p);
 perform pg_temp.ret_reject(format('select public.meta_creative_executor_command(%L,%L,%L,%L,%L)',repeat('b',64),cmd,e,'retention_finish',jsonb_set(p,'{evidenceHash}',to_jsonb(repeat('b',64)))));
end$$;
alter table public.meta_creative_native_acceptance disable trigger native_acceptance_guard;
do $$declare test_case text;e uuid;cmd uuid;p jsonb;begin
 foreach test_case in array array['global_stop','stop_resume','generation','expiry','target','budget_parameter','live_test','unsettled','no_effect','late_confirm']loop
  begin
   e:=pg_temp.ret_seed('21');cmd:=gen_random_uuid();p:=pg_temp.ret_payload(e,'create_retained');
   if test_case in('expiry','target','budget_parameter','live_test','unsettled')then
    if test_case='expiry'then p:=jsonb_set(p,'{proof,observedAt}',to_jsonb(clock_timestamp()-interval'61 seconds'));end if;
    if test_case='target'then p:=jsonb_set(p,'{intent,target}','"21"');end if;
    if test_case='budget_parameter'then p:=jsonb_set(p,'{intent,body,daily_budget}','"1"');end if;
    if test_case='live_test'then p:=jsonb_set(p,'{proof,testAds,0,status}','"ACTIVE"');end if;
    if test_case='unsettled'then insert into public.meta_creative_effects(command,experiment,command_hash,request_hash,kind,generation,pre_state_hash)values(gen_random_uuid(),e,repeat('a',64),repeat('a',64),'pause_ad',1,repeat('a',64));insert into public.meta_creative_execution_intents select command,e,'pause_control','{}'from public.meta_creative_effects where experiment=e and state='prepared';end if;
    perform pg_temp.ret_reject(format('select public.meta_creative_executor_command(%L,%L,%L,%L,%L)',repeat('b',64),cmd,e,'retention_admit',p));
   else
    perform public.meta_creative_executor_command(repeat('b',64),cmd,e,'retention_admit',p);
    if test_case='global_stop'then update public.meta_creative_control set global_stop=true;end if;
    if test_case='stop_resume'then update public.meta_creative_control set global_stop=true;update public.meta_creative_control set global_stop=false;end if;
    if test_case='generation'then update public.meta_creative_control set authority_current=false;update public.meta_creative_control set authority_current=true;end if;
    if test_case='no_effect'then
     perform public.meta_creative_executor_command(repeat('b',64),cmd,e,'retention_no_effect',jsonb_build_object('requestHash',repeat('e',64),'evidenceHash',repeat('a',64),'reason','dispatch_not_started'));
     perform public.meta_creative_executor_command(repeat('b',64),cmd,e,'retention_no_effect',jsonb_build_object('requestHash',repeat('e',64),'evidenceHash',repeat('a',64),'reason','dispatch_not_started'));
    end if;
    if test_case='late_confirm'then
     perform public.meta_creative_executor_command(repeat('b',64),cmd,e,'retention_check',jsonb_build_object('requestHash',repeat('e',64)));
     update public.meta_creative_control set global_stop=true;
     perform public.meta_creative_executor_command(repeat('b',64),cmd,e,'retention_confirm',jsonb_build_object('requestHash',repeat('e',64),'objectId','9799','evidenceHash',repeat('f',64)));
     perform pg_temp.ret_assert(public.meta_creative_retention_next(public.meta_creative_retention_state(e))='stopped');
    else
     perform pg_temp.ret_reject(format('select public.meta_creative_executor_command(%L,%L,%L,%L,%L)',repeat('b',64),cmd,e,'retention_check',jsonb_build_object('requestHash',repeat('e',64))));
    end if;
   end if;
   raise exception 'Rollback synthetic case'using errcode='P9998';
  exception when sqlstate'P9998'then null;end;
 end loop;
end$$;
do $$declare first_e uuid;second_e uuid;third_e uuid;other_e uuid;baseline jsonb;cmd uuid;p jsonb;before_rows jsonb;begin
 first_e:=pg_temp.ret_seed('21');select jsonb_agg(to_jsonb(x))into before_rows from public.meta_creative_execution x;
 perform pg_temp.ret_assert(public.meta_creative_retention_next(public.meta_creative_retention_state(first_e))='create_retained');
 cmd:=gen_random_uuid();p:=pg_temp.ret_payload(first_e,'create_retained');
 perform public.meta_creative_executor_command(repeat('b',64),cmd,first_e,'retention_admit',p);
 perform pg_temp.ret_reject(format('select public.meta_creative_command(%L,%L,%L,%L,%L)',repeat('b',64),cmd,first_e,'check',jsonb_build_object('requestHash',repeat('e',64))));
 perform public.meta_creative_executor_command(repeat('b',64),cmd,first_e,'retention_check',jsonb_build_object('requestHash',repeat('e',64)));
 -- Lost dispatch response: same command and a fresh command both cannot retry.
 perform pg_temp.ret_reject(format('select public.meta_creative_executor_command(%L,%L,%L,%L,%L)',repeat('b',64),cmd,first_e,'retention_check',jsonb_build_object('requestHash',repeat('e',64))));
 perform pg_temp.ret_reject(format('select public.meta_creative_executor_command(%L,%L,%L,%L,%L)',repeat('b',64),gen_random_uuid(),first_e,'retention_admit',p));
 perform public.meta_creative_executor_command(repeat('b',64),cmd,first_e,'retention_confirm',jsonb_build_object('requestHash',repeat('e',64),'objectId','9701','evidenceHash',repeat('f',64)));
 perform pg_temp.ret_effect(first_e,'activate_retained');perform pg_temp.ret_finish(first_e,'retained');
 perform pg_temp.ret_assert(jsonb_array_length(public.meta_creative_retained_ads())=1 and not exists(select 1 from public.acquisition_experiment_reservation));
 select v into baseline from jsonb_array_elements(public.meta_creative_retained_ads())v where v->>'donor'='21';
 other_e:=pg_temp.ret_seed('22');perform pg_temp.ret_effect(other_e,'create_retained','9702');perform pg_temp.ret_effect(other_e,'activate_retained');perform pg_temp.ret_finish(other_e,'retained');
 second_e:=pg_temp.ret_seed('21',baseline);
 -- Reverting an old baseline cannot run underneath a dependent reserved test.
 perform pg_temp.ret_reject(format('select public.meta_creative_executor_command(%L,gen_random_uuid(),%L,%L,%L)',repeat('b',64),first_e,'retention_abort',jsonb_build_object('generation',(select generation from public.meta_creative_control),'evidenceHash',repeat('a',64))));
 perform pg_temp.ret_effect(second_e,'create_retained','9703');
 perform pg_temp.ret_assert(jsonb_array_length(public.meta_creative_retained_ads())=2);
 perform pg_temp.ret_effect(second_e,'pause_previous');
 perform pg_temp.ret_assert(public.meta_creative_retained_ads()@>'[{"donor":"22","ad":"9702"}]');
 cmd:=gen_random_uuid();p:=jsonb_build_object('generation',(select generation from public.meta_creative_control),'evidenceHash',repeat('a',64));
 perform public.meta_creative_executor_command(repeat('b',64),cmd,second_e,'retention_abort',p);
 perform pg_temp.ret_effect(second_e,'pause_retained');perform pg_temp.ret_effect(second_e,'restore_previous');perform pg_temp.ret_finish(second_e,'reverted');
 perform public.meta_creative_executor_command(repeat('b',64),cmd,second_e,'retention_abort',p);
 perform pg_temp.ret_assert(not exists(select 1 from public.acquisition_experiment_reservation));
 perform pg_temp.ret_reject(format('select public.meta_creative_executor_command(%L,gen_random_uuid(),%L,%L,%L)',repeat('b',64),second_e,'retention_abort',p));
 perform pg_temp.ret_assert(jsonb_array_length(public.meta_creative_retained_ads())=2 and public.meta_creative_retained_ads()@>'[{"donor":"21","ad":"9701"},{"donor":"22","ad":"9702"}]');
 third_e:=pg_temp.ret_seed('21',baseline);perform pg_temp.ret_effect(third_e,'create_retained','9704');perform pg_temp.ret_effect(third_e,'pause_previous');perform pg_temp.ret_effect(third_e,'activate_retained');perform pg_temp.ret_finish(third_e,'retained');
 -- The former winner cannot restore an obsolete lineage after replacement.
 perform pg_temp.ret_reject(format('select public.meta_creative_executor_command(%L,gen_random_uuid(),%L,%L,%L)',repeat('b',64),first_e,'retention_abort',p));
 perform pg_temp.ret_assert(not exists(select 1 from public.acquisition_experiment_reservation));
 perform pg_temp.ret_assert(jsonb_array_length(public.meta_creative_retained_ads())=2 and public.meta_creative_retained_ads()@>'[{"donor":"21","ad":"9704"},{"donor":"22","ad":"9702"}]');
 perform pg_temp.ret_assert((select jsonb_agg(to_jsonb(x))=before_rows from public.meta_creative_execution x where experiment=first_e));
 perform pg_temp.ret_assert(not exists(select 1 from public.meta_creative_effects e join public.meta_creative_control c on c.singleton where c.original_ads?e.target));
end$$;
alter table public.meta_creative_native_acceptance enable trigger native_acceptance_guard;
select pg_temp.ret_assert(not has_function_privilege(role_name,'public.meta_creative_retention_current(uuid,bigint,text,jsonb)','EXECUTE'))from unnest(array['anon','authenticated','service_role'])role_name;
rollback;
