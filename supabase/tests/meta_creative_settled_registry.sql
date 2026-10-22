begin;
create function pg_temp.assert(ok boolean) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'Paused capability assertion failed';end if;end$$;
update public.landing_experiment_control set template=repeat('a',64);
do $$declare e uuid:='e4000000-0000-4000-8000-000000000001';p jsonb;cmd uuid;intent jsonb;proof jsonb;state jsonb;k text;begin
 select jsonb_build_object('experiment',e,'scope',scope,'originalAds',original_ads,'preStateHash',repeat('f',64),'nativeContractHash',native_contract_hash,
 'dailyMinor',40000,'weeklyMinor',280000,'studyDailyMinor',8000,'landingTemplate',repeat('a',64),'purpose','paused_capability','currency','NZD','timezone','Pacific/Auckland',
 'generator',null,'reviewer',null,'approvalHash',repeat('a',64),'approvedAssetHash',repeat('a',64),'approvalUntil',clock_timestamp()+interval '12 hours',
 'control',jsonb_build_object('path','/acrylic-roof-pergolas-auckland','primary','Unchanged fixture'),'challengerPrimary','Unchanged fixture','start',floor(extract(epoch from clock_timestamp())),'end',floor(extract(epoch from clock_timestamp()+interval '1 hour')))
 into p from public.meta_creative_control;
 perform public.meta_creative_executor_command(repeat('b',64),gen_random_uuid(),e,'prepare',jsonb_build_object('plan',p,'planHash',repeat('a',64)));
 perform pg_temp.assert((select control_hash=repeat('f',64) from meta_creative_control));
 foreach k in array array['create_creative','create_control','pause_control'] loop
  if k='pause_control' then
   perform pg_temp.assert((public.meta_creative_executor_command(repeat('b',64),gen_random_uuid(),e,'measurement','{}')->>'ready')::boolean);
   perform public.meta_creative_executor_command(repeat('b',64),gen_random_uuid(),e,'canary',jsonb_build_object('evidenceHash',repeat('f',64)));
  end if;
  cmd:=gen_random_uuid();intent:=jsonb_build_object('kind',k,'target',case when k='pause_control' then '8201' else null end,'requestHash',repeat('a',64),'at',extract(epoch from clock_timestamp())*1000);
  perform public.meta_creative_executor_command(repeat('b',64),cmd,e,'admit',jsonb_build_object('intent',intent,'cleanup',k='pause_control','generation',(select generation from public.meta_creative_control)));
  perform public.meta_creative_executor_command(repeat('b',64),cmd,e,'check',jsonb_build_object('requestHash',repeat('a',64)));
  perform public.meta_creative_executor_command(repeat('b',64),cmd,e,'confirm',jsonb_build_object('requestHash',repeat('a',64),'objectId',case when k='create_creative' then '8301' else '8201' end,'evidenceHash',repeat('f',64)));
 end loop;
 perform pg_temp.assert((select count(*) from meta_creative_objects where experiment=e)=1);
 perform pg_temp.assert(not exists(select 1 from meta_creative_objects where object_id='8301'));
 state:=public.meta_creative_executor_command(repeat('b',64),gen_random_uuid(),e,'read','{}');perform pg_temp.assert(state->>'creativeReference'='8301');
 perform public.meta_creative_executor_command(repeat('b',64),gen_random_uuid(),e,'cleanup',jsonb_build_object('evidenceHash',repeat('f',64),'terminalStudy',null));
 perform pg_temp.assert(not exists(select 1 from acquisition_experiment_reservation));
 perform pg_temp.assert(public.meta_creative_executor_command(repeat('b',64),gen_random_uuid(),e,'read','{}')->>'state'='closed');
 perform pg_temp.assert((select count(*) from meta_creative_registered_ads() where experiment=e)=1);
 perform pg_temp.assert((select count(*) from meta_creative_visits)=0);
 state:=public.meta_creative_executor_command(repeat('b',64),gen_random_uuid(),null,'read','{}');
 perform pg_temp.assert(state->'plan'='null'::jsonb);
 perform pg_temp.assert((state->>'capabilityReady')::boolean and state->'settledAds'='["8201"]'::jsonb);
 perform pg_temp.assert(not has_function_privilege('service_role','meta_creative_executor_without_settled_registry(text,uuid,uuid,text,jsonb)','EXECUTE'));
 update public.meta_creative_control set native_contract_hash=repeat('9',64);
 state:=public.meta_creative_executor_command(repeat('b',64),gen_random_uuid(),null,'read','{}');
 perform pg_temp.assert(not(state->>'capabilityReady')::boolean and state->'settledAds'='["8201"]'::jsonb);
 update public.meta_creative_control set scope=scope||'{"account":"999"}';
 state:=public.meta_creative_executor_command(repeat('b',64),gen_random_uuid(),null,'read','{}');
 perform pg_temp.assert(not(state->>'capabilityReady')::boolean and state->'settledAds'='[]'::jsonb);

end$$;
rollback;
