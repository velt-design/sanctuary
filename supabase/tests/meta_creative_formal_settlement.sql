begin;
create function pg_temp.assert(ok boolean) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'Native acceptance assertion failed';end if;end$$;
create function pg_temp.reject(statement text) returns void language plpgsql as $$begin begin execute statement;exception when others then return;end;raise exception 'Expected rejection';end$$;
update public.landing_experiment_control set template=repeat('a',64);
-- Fixed synthetic identities; these are not provider/API acceptance evidence.
do $$declare e uuid:='e6000000-0000-4000-8000-000000000001';p jsonb;cmd uuid;k text;intent jsonb;begin
 select jsonb_build_object('experiment',e,'scope',scope,'originalAds',original_ads,'preStateHash',control_hash,'nativeContractHash',native_contract_hash,
 'dailyMinor',40000,'weeklyMinor',280000,'studyDailyMinor',8000,'landingTemplate',repeat('a',64),'purpose','formal_experiment','currency','NZD','timezone','Pacific/Auckland',
 'generator','resp_author','reviewer','resp_reviewer','approvalHash',repeat('a',64),'approvedAssetHash',repeat('a',64),'approvalUntil',clock_timestamp()+interval '1 day',
 'nativeObjective',jsonb_build_object('adspixels',jsonb_build_array(jsonb_build_object('id','8801'))),
 'control',jsonb_build_object('id','8001','path','/acrylic-roof-pergolas-auckland'),'start',floor(extract(epoch from clock_timestamp()+interval '-18 days')),'end',floor(extract(epoch from clock_timestamp()+interval '-4 days')))
 into p from public.meta_creative_control;
 perform public.meta_creative_executor_command(repeat('b',64),gen_random_uuid(),e,'prepare',jsonb_build_object('plan',p,'planHash',repeat('a',64)));
 foreach k in array array['create_creative','create_control','create_challenger','create_study'] loop
  cmd:=gen_random_uuid();intent:=jsonb_build_object('kind',k,'target',null,'requestHash',repeat('a',64),'at',extract(epoch from clock_timestamp())*1000);
  perform public.meta_creative_executor_command(repeat('b',64),cmd,e,'admit',jsonb_build_object('intent',intent,'cleanup',false,'generation',(select generation from public.meta_creative_control)));
  perform public.meta_creative_executor_command(repeat('b',64),cmd,e,'check',jsonb_build_object('requestHash',repeat('a',64)));
  perform public.meta_creative_executor_command(repeat('b',64),cmd,e,'confirm',jsonb_build_object('requestHash',repeat('a',64),'objectId',case k when 'create_creative' then '8300' when 'create_control' then '8201' when 'create_challenger' then '8202' else '8301' end,'evidenceHash',repeat('f',64)));
 end loop;
 perform public.meta_creative_executor_command(repeat('b',64),gen_random_uuid(),e,'measurement','{}');
 perform public.meta_creative_executor_command(repeat('b',64),gen_random_uuid(),e,'canary',jsonb_build_object('evidenceHash',repeat('f',64)));
end$$;
create function pg_temp.acceptance(proof_id uuid,proof_hash text,change jsonb default '{}') returns void language plpgsql as $$
declare r public.meta_creative_native_acceptance;p jsonb;begin
 select plan into p from public.meta_creative_execution where experiment='e6000000-0000-4000-8000-000000000001';
 r.id:=proof_id;r.example_experiment:='e6000000-0000-4000-8000-000000000001';r.example_study:='8301';r.scope:=p->'scope';r.original_ads:=p->'originalAds';r.native_contract_hash:=p->>'nativeContractHash';r.pixel:='8801';
 r.example_cells:='[{"id":"8401","ad":"8201","arm":"control"},{"id":"8402","ad":"8202","arm":"challenger"}]';
 r.observed_at:=to_timestamp((p->>'start')::double precision)-interval '2 hours';r.recorded_at:=r.observed_at+interval '1 minute';r.provenance:='hosted_paused_study_and_native_ui';r.evidence_hash:=proof_hash;
 r.unit_proof_hash:=repeat('1',64);r.allocation_proof_hash:=repeat('2',64);r.originals_proof_hash:=repeat('3',64);r.objective_proof_hash:=repeat('4',64);
 r.semantics:='{"currency":"NZD","timezone":"Pacific/Auckland","budgetOwner":"campaign","dailyMinor":40000,"studyDailyMinor":8000,"uiStudyDaily":80,"offset":100,"allocation":"existing_campaign_portion","experimentalUnit":"SPLIT_TEST_V2_ad_cells","topology":"same_original_adset","objective":"CONVERSIONS","event":"Lead","isPrimary":true}';
 r:=jsonb_populate_record(r,change);insert into public.meta_creative_native_acceptance select r.*;
end$$;
-- Only the isolated fixture installs historical metadata. The actual current
-- acceptance/activation fences are exercised separately without these overrides.
alter table public.meta_creative_execution disable trigger creative_execution_immutable;
update public.meta_creative_execution set created_at=to_timestamp((plan->>'start')::double precision)-interval '1 day'where experiment='e6000000-0000-4000-8000-000000000001';
alter table public.meta_creative_execution enable trigger creative_execution_immutable;
alter table public.meta_creative_native_acceptance disable trigger native_acceptance_guard;
select pg_temp.acceptance('e7000000-0000-4000-8000-000000000001',repeat('a',64));
alter table public.meta_creative_native_acceptance enable trigger native_acceptance_guard;

-- Historical ledger fixture only. These owner inserts represent already
-- confirmed provider evidence; no past dispatch or provider call is performed.
do $$declare e uuid:='e6000000-0000-4000-8000-000000000001';p jsonb;cmd uuid;k text;obj text;started timestamptz;ended timestamptz;payload jsonb;v jsonb;cohort jsonb;analysis jsonb;admitted jsonb;begin
 select plan into p from public.meta_creative_execution where experiment=e;
 started:=to_timestamp((p->>'start')::double precision);ended:=to_timestamp((p->>'end')::double precision);
 foreach k in array array['activate_control','activate_challenger']loop
  cmd:=gen_random_uuid();obj:=case k when 'activate_control'then '8201'else '8202'end;
  insert into public.meta_creative_effects(command,experiment,command_hash,request_hash,kind,target,generation,pre_state_hash,state,dispatch_claimed_at,object_id,evidence_hash,admitted_at,confirmed_at)values(cmd,e,repeat('a',64),repeat('b',64),'activate_ad',obj,1,repeat('a',64),'confirmed',started-interval '1 minute',obj,repeat('c',64),started-interval '2 minutes',started-interval '1 second');
  insert into public.meta_creative_execution_intents values(cmd,e,k,jsonb_build_object('kind',k));
  insert into public.meta_creative_activation_proofs(command,experiment,kind,target,generation,request_hash,payload)values(cmd,e,k,obj,1,repeat('b',64),jsonb_build_object('acceptance','e7000000-0000-4000-8000-000000000001','study','8301','objectiveProofHash',repeat('a',64)));
 end loop;
 insert into public.meta_creative_execution_receipts(command,experiment,stage,evidence_hash,recorded_at)values(gen_random_uuid(),e,'activation',repeat('a',64),started-interval '1 second');
 insert into public.meta_creative_execution_receipts(command,experiment,stage,evidence_hash,recorded_at)select gen_random_uuid(),e,'delivery_health',repeat('a',64),t from generate_series(started+interval '1 hour',ended-interval '1 second',interval '4 hours')t;
 foreach k in array array['pause_control','pause_challenger']loop
  cmd:=gen_random_uuid();obj:=case k when 'pause_control'then '8201'else '8202'end;
  perform public.meta_creative_executor_command(repeat('b',64),cmd,e,'admit',jsonb_build_object('generation',(select generation from public.meta_creative_control),'cleanup',true,'intent',jsonb_build_object('kind',k,'target',obj,'requestHash',repeat('d',64),'at',extract(epoch from clock_timestamp())*1000)));
  perform public.meta_creative_executor_command(repeat('b',64),cmd,e,'check',jsonb_build_object('requestHash',repeat('d',64)));
  perform public.meta_creative_executor_command(repeat('b',64),cmd,e,'confirm',jsonb_build_object('requestHash',repeat('d',64),'objectId',obj,'evidenceHash',repeat('f',64)));
 end loop;
 cmd:=gen_random_uuid();payload:=jsonb_build_object('evidenceHash',repeat('f',64),'terminalStudy',jsonb_build_object('id','8301','end',p->'end','observationEnd',p->'end','observedAt',clock_timestamp(),'ended',true,'evidenceHash',repeat('f',64)));
 perform pg_temp.assert(public.meta_creative_executor_command(repeat('b',64),cmd,e,'cleanup',payload)->'released'='false'::jsonb);
 v:=public.meta_creative_delivery_proof(e);perform pg_temp.assert(v->'windowComplete'='true'::jsonb);
 admitted:=public.meta_creative_executor_command(repeat('b',64),gen_random_uuid(),e,'begin_analysis',jsonb_build_object('planHash',repeat('a',64)));perform pg_temp.assert(admitted->'admitted'='true'::jsonb);
 perform pg_temp.assert(public.meta_creative_executor_command(repeat('b',64),gen_random_uuid(),e,'begin_analysis',jsonb_build_object('planHash',repeat('a',64)))->'admitted'='false'::jsonb);
 cohort:=public.meta_creative_executor_command(repeat('b',64),gen_random_uuid(),e,'cohort','{"freeze":true}');
 analysis:=jsonb_build_object('version',1,'experiment',e,'planHash',repeat('a',64),'policy','native-saved-enquiry-per-dollar-v1','observedAt',clock_timestamp(),'cohortHash',repeat('a',64),'spendHash',repeat('b',64),'deliveryHash',repeat('c',64),'sourceDates',jsonb_build_object('cohort',cohort->'observedAt','spend',clock_timestamp(),'delivery',v->'verifiedAt'),'allSavedCoverage',cohort->'allSavedCoverage','coverageCounts',cohort->'coverage','unresolvedLate',cohort->'unresolvedLate','arms',jsonb_build_array(jsonb_build_object('arm','control','ad','8201','enquiries',0,'spend',10,'canonical',0,'correspondence',0,'intake',0,'assessed',0,'concerns',0,'conflicting',0,'unknown',0),jsonb_build_object('arm','challenger','ad','8202','enquiries',0,'spend',20,'canonical',0,'correspondence',0,'intake',0,'assessed',0,'concerns',0,'conflicting',0,'unknown',0)),'decision','inconclusive','reason','no_enquiries','interval',null,'quality','unknown_or_fails');
 perform pg_temp.assert(public.meta_creative_analysis_valid(analysis));
 perform pg_temp.assert(not public.meta_creative_analysis_valid(analysis||'{"decision":null}'));
 perform pg_temp.assert(not public.meta_creative_analysis_valid(analysis||'{"email":"private@example.invalid"}'));
 perform pg_temp.assert(not public.meta_creative_analysis_valid(analysis||'{"decision":"retain"}'));
 cmd:='e9000000-0000-4000-8000-000000000001';
 perform pg_temp.assert(public.meta_creative_executor_command(repeat('b',64),cmd,e,'analysis',jsonb_build_object('analysis',analysis))=analysis);
 -- A committed result with no Velt acknowledgement cannot start another test.
 perform pg_temp.assert(exists(select 1 from public.acquisition_experiment_reservation where experiment=e));
 perform pg_temp.assert(public.meta_creative_executor_command(repeat('b',64),cmd,e,'analysis',jsonb_build_object('analysis',analysis))=analysis);
 perform pg_temp.assert(public.meta_creative_executor_command(repeat('b',64),gen_random_uuid(),null,'read','{}')->'analysis'=analysis);
 perform pg_temp.reject(format('select public.meta_creative_executor_command(%L,gen_random_uuid(),%L,''analysis'',%L)',repeat('b',64),e,jsonb_build_object('analysis',analysis||'{"reason":"evidence_incomplete"}')));
 perform pg_temp.reject(format('select public.meta_creative_executor_command(%L,gen_random_uuid(),%L,''analysis_ack'',''{"analysisCommand":"e9000000-0000-4000-8000-000000000002"}'')',repeat('b',64),e));
 payload:=jsonb_build_object('analysisCommand',cmd);
 perform public.meta_creative_executor_command(repeat('b',64),gen_random_uuid(),e,'analysis_ack',payload);
 perform pg_temp.assert(not exists(select 1 from public.acquisition_experiment_reservation where experiment=e));
 perform pg_temp.assert(public.meta_creative_executor_command(repeat('b',64),gen_random_uuid(),e,'read','{}')->'analysis'=analysis);
end$$;
select pg_temp.reject($q$update public.meta_creative_formal_analysis set payload=payload$q$);
rollback;
