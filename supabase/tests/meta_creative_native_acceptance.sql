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
 'control',jsonb_build_object('path','/acrylic-roof-pergolas-auckland'),'start',floor(extract(epoch from clock_timestamp()+interval '3 days')),'end',floor(extract(epoch from clock_timestamp()+interval '17 days')))
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
select pg_temp.assert(public.meta_creative_native_acceptance_for('e6000000-0000-4000-8000-000000000001') is null);
select pg_temp.reject($q$select pg_temp.acceptance(gen_random_uuid(),repeat('a',64),'{"allocation_proof_hash":null}')$q$);
select pg_temp.reject($q$select pg_temp.acceptance(gen_random_uuid(),repeat('a',64),'{"example_study":"999"}')$q$);
select pg_temp.reject($q$select pg_temp.acceptance(gen_random_uuid(),repeat('a',64),'{"pixel":"999"}')$q$);
select pg_temp.reject($q$select pg_temp.acceptance(gen_random_uuid(),repeat('a',64),'{"scope":{}}')$q$);
select pg_temp.reject($q$select pg_temp.acceptance(gen_random_uuid(),repeat('a',64),'{"example_cells":[{"id":"8401","ad":"8201","arm":"control"},{"id":"8402","ad":"999","arm":"challenger"}]}')$q$);
select pg_temp.reject($q$select pg_temp.acceptance(gen_random_uuid(),repeat('a',64),'{"example_cells":[{"id":null,"ad":"8201","arm":"control"},{"id":"8402","ad":"8202","arm":"challenger"}]}')$q$);
select pg_temp.acceptance('e7000000-0000-4000-8000-000000000001',repeat('a',64));
select pg_temp.assert(public.meta_creative_native_acceptance_for('e6000000-0000-4000-8000-000000000001')->>'id'='e7000000-0000-4000-8000-000000000001');
select pg_temp.assert(public.meta_creative_executor_command(repeat('b',64),gen_random_uuid(),'e6000000-0000-4000-8000-000000000001','read','{}')#>>'{nativeAcceptance,allocationProofHash}'=repeat('2',64));
do $$declare h text;s jsonb;begin
 select native_contract_hash,scope into h,s from public.meta_creative_control;
 update public.meta_creative_control set native_contract_hash=repeat('9',64);
 perform pg_temp.assert(public.meta_creative_native_acceptance_for('e6000000-0000-4000-8000-000000000001') is null);
 update public.meta_creative_control set native_contract_hash=h;
 perform pg_temp.assert(public.meta_creative_native_acceptance_for('e6000000-0000-4000-8000-000000000001') is not null);
 update public.meta_creative_control set scope=scope||'{"account":"999"}';
 perform pg_temp.assert(public.meta_creative_native_acceptance_for('e6000000-0000-4000-8000-000000000001') is null);
 update public.meta_creative_control set scope=s;
 perform pg_temp.assert(public.meta_creative_native_acceptance_for('e6000000-0000-4000-8000-000000000001') is not null);
end$$;
select pg_temp.reject($q$update public.meta_creative_native_acceptance set pixel='999'$q$);
select pg_temp.reject($q$delete from public.meta_creative_native_acceptance$q$);
select pg_temp.acceptance('e7000000-0000-4000-8000-000000000002',repeat('b',64));
insert into public.meta_creative_native_revocations(acceptance,reason,evidence_hash)values('e7000000-0000-4000-8000-000000000002','provider_behavior_changed',repeat('f',64));
select pg_temp.assert(public.meta_creative_native_acceptance_for('e6000000-0000-4000-8000-000000000001') is null);
select pg_temp.assert((select count(*) from public.meta_creative_native_acceptance)=2);
select pg_temp.assert(not has_table_privilege('service_role','meta_creative_native_acceptance','INSERT'));
select pg_temp.assert(not has_table_privilege('service_role','meta_creative_native_revocations','INSERT'));
select pg_temp.assert(not has_function_privilege('service_role','meta_creative_native_acceptance_for(uuid)','EXECUTE'));
select pg_temp.assert(not has_function_privilege('service_role','meta_creative_executor_without_native_acceptance(text,uuid,uuid,text,jsonb)','EXECUTE'));
-- Revocation prevents acceptance but does not prevent exact owned PAUSED cleanup.
select public.meta_creative_executor_command(repeat('b',64),gen_random_uuid(),'e6000000-0000-4000-8000-000000000001','admit',jsonb_build_object('generation',(select generation from meta_creative_control),'cleanup',true,'intent',jsonb_build_object('kind','pause_control','target','8201','requestHash',repeat('c',64),'at',extract(epoch from clock_timestamp())*1000)));
rollback;
