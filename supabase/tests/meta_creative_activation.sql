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
 'control',jsonb_build_object('id','8001','path','/acrylic-roof-pergolas-auckland'),'start',floor(extract(epoch from clock_timestamp()+interval '3 days')),'end',floor(extract(epoch from clock_timestamp()+interval '17 days')))
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
 r.observed_at:=clock_timestamp();r.recorded_at:=clock_timestamp();r.provenance:='hosted_paused_study_and_native_ui';r.evidence_hash:=proof_hash;
 r.unit_proof_hash:=repeat('1',64);r.allocation_proof_hash:=repeat('2',64);r.originals_proof_hash:=repeat('3',64);r.objective_proof_hash:=repeat('4',64);
 r.semantics:='{"currency":"NZD","timezone":"Pacific/Auckland","budgetOwner":"campaign","dailyMinor":40000,"studyDailyMinor":8000,"uiStudyDaily":80,"offset":100,"allocation":"existing_campaign_portion","experimentalUnit":"SPLIT_TEST_V2_ad_cells","topology":"same_original_adset","objective":"CONVERSIONS","event":"Lead","isPrimary":true}';
 r:=jsonb_populate_record(r,change);insert into public.meta_creative_native_acceptance select r.*;
end$$;
select pg_temp.acceptance('e7000000-0000-4000-8000-000000000001',repeat('a',64));

create function pg_temp.activate(cmd uuid,kind text default 'activate_control',change jsonb default '{}') returns jsonb language plpgsql as $$
declare x public.meta_creative_execution;proof jsonb;target text;intent jsonb;begin
 select * into x from public.meta_creative_execution where experiment='e6000000-0000-4000-8000-000000000001';
 target:=case kind when 'activate_control' then '8201' else '8202' end;
 select jsonb_build_object('version',1,'planHash',x.plan_hash,'acceptance','e7000000-0000-4000-8000-000000000001','study','8301','observedAt',clock_timestamp(),'preStateHash',x.plan->>'preStateHash','studyProofHash',repeat('b',64),'objectiveProofHash',repeat('c',64),'arms',jsonb_build_array(
 jsonb_build_object('arm','control','ad','8201','status',case when exists(select 1 from meta_creative_effects e where e.kind='activate_ad' and e.target='8201' and e.state='confirmed')then 'ACTIVE' else 'PAUSED' end,'creative','8001','start',x.plan->'start','end',x.plan->'end','trackingHash',repeat('d',64)),
 jsonb_build_object('arm','challenger','ad','8202','status','PAUSED','creative','8300','start',x.plan->'start','end',x.plan->'end','trackingHash',repeat('d',64))))||change into proof;
 intent:=jsonb_build_object('kind',kind,'target',target,'path',target,'body',jsonb_build_object('status','ACTIVE'),'requestHash',repeat('e',64),'at',floor(extract(epoch from clock_timestamp())*1000));
 return public.meta_creative_executor_command(repeat('b',64),cmd,x.experiment,'admit',jsonb_build_object('intent',intent,'generation',(select generation from meta_creative_control),'cleanup',false,'activationProof',proof));
end$$;
-- Missing proof cannot bypass the dedicated executor via direct core authority.
select pg_temp.reject($q$select public.meta_creative_command(repeat('b',64),gen_random_uuid(),'e6000000-0000-4000-8000-000000000001','admit',jsonb_build_object('kind','activate_ad','objectId','8201','requestHash',repeat('e',64),'generation',(select generation from meta_creative_control),'preStateHash',repeat('c',64),'observedAt',clock_timestamp()))$q$);
select pg_temp.reject($q$select pg_temp.activate(gen_random_uuid(),'activate_control','{"acceptance":null}')$q$);
select pg_temp.reject($q$select pg_temp.activate(gen_random_uuid(),'activate_control','{"observedAt":"2020-01-01T00:00:00Z"}')$q$);
select pg_temp.reject($q$select pg_temp.activate(gen_random_uuid(),'activate_control','{"study":"9999"}')$q$);
select pg_temp.reject($q$select pg_temp.activate(gen_random_uuid(),'activate_control','{"raw":"never retain"}')$q$);
select pg_temp.reject($q$select pg_temp.activate(gen_random_uuid())$q$);
update public.meta_creative_control set delivery_enabled=true;
select pg_temp.activate('e8000000-0000-4000-8000-000000000001');
select pg_temp.assert((select count(*)from public.meta_creative_activation_proofs)=1);
savepoint baseline;
insert into public.meta_creative_native_revocations values('e7000000-0000-4000-8000-000000000001',clock_timestamp(),'operator_withdrawn',repeat('f',64));
select pg_temp.reject($q$select public.meta_creative_command(repeat('b',64),'e8000000-0000-4000-8000-000000000001','e6000000-0000-4000-8000-000000000001','check',jsonb_build_object('requestHash',repeat('e',64)))$q$);
rollback to baseline;
update public.meta_creative_control set global_stop=true;
select pg_temp.reject($q$select public.meta_creative_command(repeat('b',64),'e8000000-0000-4000-8000-000000000001','e6000000-0000-4000-8000-000000000001','check',jsonb_build_object('requestHash',repeat('e',64)))$q$);
rollback to baseline;
update public.landing_experiment_control set template=repeat('9',64);
select pg_temp.reject($q$select public.meta_creative_command(repeat('b',64),'e8000000-0000-4000-8000-000000000001','e6000000-0000-4000-8000-000000000001','check',jsonb_build_object('requestHash',repeat('e',64)))$q$);
rollback to baseline;
select public.meta_creative_executor_command(repeat('b',64),'e8000000-0000-4000-8000-000000000001','e6000000-0000-4000-8000-000000000001','check',jsonb_build_object('requestHash',repeat('e',64)));
select public.meta_creative_executor_command(repeat('b',64),'e8000000-0000-4000-8000-000000000001','e6000000-0000-4000-8000-000000000001','confirm',jsonb_build_object('requestHash',repeat('e',64),'objectId','8201','evidenceHash',repeat('f',64)));
select pg_temp.activate('e8000000-0000-4000-8000-000000000002','activate_challenger');
select public.meta_creative_executor_command(repeat('b',64),'e8000000-0000-4000-8000-000000000002','e6000000-0000-4000-8000-000000000001','check',jsonb_build_object('requestHash',repeat('e',64)));
select public.meta_creative_executor_command(repeat('b',64),'e8000000-0000-4000-8000-000000000002','e6000000-0000-4000-8000-000000000001','confirm',jsonb_build_object('requestHash',repeat('e',64),'objectId','8202','evidenceHash',repeat('f',64)));
select pg_temp.assert((select count(*)from meta_creative_execution_receipts where stage='activation')=1);
select pg_temp.assert(public.meta_creative_executor_command(repeat('b',64),gen_random_uuid(),'e6000000-0000-4000-8000-000000000001','read','{}')->>'delivery'='scheduled');
select pg_temp.assert(not has_table_privilege('service_role','meta_creative_activation_proofs','INSERT'));
select pg_temp.assert(not has_function_privilege('service_role','meta_creative_without_activation(text,uuid,uuid,text,jsonb)','EXECUTE'));
select pg_temp.reject($q$update meta_creative_activation_proofs set target='9999'$q$);
-- Confirmed test cleanup retains the exact global owner through maturity. An
-- early terminal read is interruption evidence, never a complete-window result.
do $$declare e uuid:='e6000000-0000-4000-8000-000000000001';cmd uuid;k text;payload jsonb;held timestamptz;result jsonb;begin
 select held_at into held from public.acquisition_experiment_reservation where singleton;
 foreach k in array array['pause_control','pause_challenger']loop
  cmd:=gen_random_uuid();
  perform public.meta_creative_executor_command(repeat('b',64),cmd,e,'admit',jsonb_build_object('generation',(select generation from public.meta_creative_control),'cleanup',true,'intent',jsonb_build_object('kind',k,'target',case k when 'pause_control'then '8201'else '8202'end,'requestHash',repeat('d',64),'at',extract(epoch from clock_timestamp())*1000)));
  perform public.meta_creative_executor_command(repeat('b',64),cmd,e,'check',jsonb_build_object('requestHash',repeat('d',64)));
  perform public.meta_creative_executor_command(repeat('b',64),cmd,e,'confirm',jsonb_build_object('requestHash',repeat('d',64),'objectId',case k when 'pause_control'then '8201'else '8202'end,'evidenceHash',repeat('f',64)));
 end loop;
 cmd:=gen_random_uuid();payload:=jsonb_build_object('evidenceHash',repeat('f',64),'terminalStudy',jsonb_build_object('id','8301','end',floor(extract(epoch from clock_timestamp())),'observationEnd',floor(extract(epoch from clock_timestamp())),'observedAt',clock_timestamp(),'ended',true,'evidenceHash',repeat('f',64)));
 result:=public.meta_creative_executor_command(repeat('b',64),cmd,e,'cleanup',payload);
 perform pg_temp.assert(result->'released'='false'::jsonb and result->'maturing'='true'::jsonb);
 perform pg_temp.assert((select experiment=e and held_at=held from public.acquisition_experiment_reservation where singleton));
 perform public.meta_creative_executor_command(repeat('b',64),cmd,e,'cleanup',payload);
 result:=public.meta_creative_executor_command(repeat('b',64),gen_random_uuid(),e,'read','{}');
 perform pg_temp.assert(result->>'state'='maturing' and result->'cleanupComplete'='true'::jsonb and result#>'{deliveryProof,windowComplete}'='false'::jsonb);
 perform pg_temp.assert((select count(*)from public.meta_creative_execution_receipts where experiment=e and stage='delivery_interrupted')=1);
end$$;
select pg_temp.reject($q$select public.meta_creative_executor_command(repeat('b',64),gen_random_uuid(),'e6000000-0000-4000-8000-000000000001','begin_analysis',jsonb_build_object('planHash',repeat('a',64)))$q$);
select pg_temp.assert(not has_table_privilege('service_role','meta_creative_formal_analysis','INSERT'));
select pg_temp.assert(not has_function_privilege('service_role','meta_creative_without_formal_settlement(text,uuid,uuid,text,jsonb)','EXECUTE'));
rollback;
