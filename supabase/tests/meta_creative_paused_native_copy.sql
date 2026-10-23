begin;
-- Disposable synthetic state only; rollback restores the harness's earlier rows.
delete from public.acquisition_experiment_reservation;
truncate public.meta_creative_plans cascade;
update public.meta_creative_control set enabled=true,cleanup_enabled=true,authority_current=true,global_stop=false;
update public.landing_experiment_control set template=repeat('a',64);
create function pg_temp.native_copy_assert(ok boolean)returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'Native copy assertion failed';end if;end$$;
create function pg_temp.native_copy_denied(statement text)returns void language plpgsql as $$begin begin execute statement;raise exception 'Unexpected native copy authority'using errcode='P9999';exception when sqlstate 'P0001'then null;end;end$$;
do $$declare e uuid:=gen_random_uuid();p jsonb;cmd uuid;pause_cmd uuid;intent jsonb;proof jsonb;source_ad text;creative text:='888001';originals jsonb;state jsonb;key text;bad jsonb;begin
 select original_ads,original_ads->>0 into originals,source_ad from public.meta_creative_control;
 select jsonb_build_object('experiment',e,'scope',scope,'originalAds',original_ads,'preStateHash',repeat('f',64),'nativeContractHash',native_contract_hash,
  'dailyMinor',40000,'weeklyMinor',280000,'studyDailyMinor',8000,'landingTemplate',repeat('a',64),'purpose','paused_capability','currency','NZD','timezone','Pacific/Auckland',
  'generator',null,'reviewer',null,'approvalHash',repeat('a',64),'approvedAssetHash',repeat('a',64),'approvalUntil',clock_timestamp()+interval '12 hours','controlAd',source_ad,
  'control',jsonb_build_object('format','native_reference','id',creative,'sourceAd',source_ad,'snapshotHash',repeat('b',64),'path','/acrylic-roof-pergolas-auckland','primary','Unchanged synthetic source'),
  'challengerPrimary','Unchanged synthetic source','start',floor(extract(epoch from clock_timestamp())),'end',floor(extract(epoch from clock_timestamp()+interval '1 hour')))
 into p from public.meta_creative_control;
 foreach key in array array['purpose','donor','snapshot','retained']loop
  bad:=case key when'purpose'then jsonb_set(p,'{purpose}','"formal_experiment"')when'donor'then jsonb_set(p,'{control,sourceAd}','"99"')when'snapshot'then jsonb_set(p,'{control,snapshotHash}','"bad"')else p||'{"retainedBaseline":{}}'end;
  perform pg_temp.native_copy_denied(format('select public.meta_creative_executor_command(repeat(''b'',64),gen_random_uuid(),%L,''prepare'',%L::jsonb)',e,jsonb_build_object('plan',bad,'planHash',repeat('a',64))));
 end loop;
 -- Shared acquisition ownership denies the proof before any provider dispatch.
 insert into public.acquisition_experiment_reservation(lane,experiment)values('landing',gen_random_uuid());
 perform pg_temp.native_copy_denied(format('select public.meta_creative_executor_command(repeat(''b'',64),gen_random_uuid(),%L,''prepare'',%L::jsonb)',e,jsonb_build_object('plan',p,'planHash',repeat('a',64))));
 delete from public.acquisition_experiment_reservation;
 perform public.meta_creative_executor_command(repeat('b',64),gen_random_uuid(),e,'prepare',jsonb_build_object('plan',p,'planHash',repeat('a',64)));
 intent:=jsonb_build_object('kind','create_control','path',source_ad||'/copies','body',jsonb_build_object('adset_id',p#>>'{scope,adset}','status_option','PAUSED'),'target',null,'requestHash',repeat('a',64),'at',extract(epoch from clock_timestamp())*1000);
 foreach key in array array['create_creative','create_challenger','create_study','activate_control','status','body','path']loop
  bad:=case key when'status'then jsonb_set(intent,'{body,status_option}','"ACTIVE"')when'body'then jsonb_set(intent,'{body,creative_parameters}','{}')when'path'then jsonb_set(intent,'{path}','"99/copies"')else jsonb_set(intent,'{kind}',to_jsonb(key))end;
  perform pg_temp.native_copy_denied(format('select public.meta_creative_executor_command(repeat(''b'',64),gen_random_uuid(),%L,''admit'',%L::jsonb)',e,jsonb_build_object('intent',bad,'cleanup',false,'generation',(select generation from public.meta_creative_control))));
 end loop;
 update public.meta_creative_control set global_stop=true;
 perform pg_temp.native_copy_denied(format('select public.meta_creative_executor_command(repeat(''b'',64),gen_random_uuid(),%L,''admit'',%L::jsonb)',e,jsonb_build_object('intent',intent,'cleanup',false,'generation',(select generation from public.meta_creative_control))));
 update public.meta_creative_control set global_stop=false;
 cmd:=gen_random_uuid();
 perform public.meta_creative_executor_command(repeat('b',64),cmd,e,'admit',jsonb_build_object('intent',intent,'cleanup',false,'generation',(select generation from public.meta_creative_control)));
 perform public.meta_creative_executor_command(repeat('b',64),cmd,e,'check',jsonb_build_object('requestHash',repeat('a',64)));
 perform pg_temp.native_copy_denied(format('select public.meta_creative_executor_command(repeat(''b'',64),%L,%L,''check'',%L::jsonb)',cmd,e,jsonb_build_object('requestHash',repeat('a',64))));
 perform pg_temp.native_copy_denied(format('select public.meta_creative_executor_command(repeat(''b'',64),gen_random_uuid(),%L,''admit'',%L::jsonb)',e,jsonb_build_object('intent',intent,'cleanup',false,'generation',(select generation from public.meta_creative_control))));
 perform pg_temp.native_copy_denied(format('select public.meta_creative_executor_command(repeat(''b'',64),%L,%L,''no_effect'',%L::jsonb)',cmd,e,jsonb_build_object('requestHash',repeat('a',64),'evidenceHash',repeat('f',64),'reason','dispatch_not_started')));
 perform public.meta_creative_executor_command(repeat('b',64),cmd,e,'confirm',jsonb_build_object('requestHash',repeat('a',64),'objectId','8201','evidenceHash',repeat('f',64)));
 perform pg_temp.native_copy_assert((public.meta_creative_executor_command(repeat('b',64),gen_random_uuid(),e,'measurement','{}')->>'ready')::boolean);
 proof:=jsonb_build_object('evidenceHash',repeat('f',64),'nativeCopy',jsonb_build_object('sourceAd',source_ad,'creative',creative,'ad','8201','requestHash',repeat('a',64),'readbackHash',repeat('f',64)));
 perform pg_temp.native_copy_denied(format('select public.meta_creative_executor_command(repeat(''b'',64),gen_random_uuid(),%L,''canary'',%L::jsonb)',e,proof-'nativeCopy'));
 foreach key in array array['sourceAd','creative','ad','requestHash','readbackHash']loop
  bad:=jsonb_set(proof,array['nativeCopy',key],to_jsonb('0'::text));
  perform pg_temp.native_copy_denied(format('select public.meta_creative_executor_command(repeat(''b'',64),gen_random_uuid(),%L,''canary'',%L::jsonb)',e,bad));
 end loop;
 perform public.meta_creative_executor_command(repeat('b',64),gen_random_uuid(),e,'canary',proof);
 state:=public.meta_creative_executor_command(repeat('b',64),gen_random_uuid(),e,'read','{}');
 perform pg_temp.native_copy_assert(state->>'state'='canary_ready'and state->'creativeReference'='null'::jsonb and state->'activationReady'='false'::jsonb);
 perform pg_temp.native_copy_assert((select count(*)=1 from public.meta_creative_objects where experiment=e and kind='ad'));
 perform pg_temp.native_copy_assert(not exists(select 1 from public.meta_creative_effects where experiment=e and kind in('create_creative','activate_ad','create_study')));
 pause_cmd:=gen_random_uuid();intent:=jsonb_build_object('kind','pause_control','path','8201','body',jsonb_build_object('status','PAUSED'),'target','8201','requestHash',repeat('c',64),'at',extract(epoch from clock_timestamp())*1000);
 perform public.meta_creative_executor_command(repeat('b',64),pause_cmd,e,'admit',jsonb_build_object('intent',intent,'cleanup',true,'generation',(select generation from public.meta_creative_control)));
 perform public.meta_creative_executor_command(repeat('b',64),pause_cmd,e,'check',jsonb_build_object('requestHash',repeat('c',64)));
 perform public.meta_creative_executor_command(repeat('b',64),pause_cmd,e,'confirm',jsonb_build_object('requestHash',repeat('c',64),'objectId','8201','evidenceHash',repeat('f',64)));
 perform public.meta_creative_executor_command(repeat('b',64),gen_random_uuid(),e,'cleanup',jsonb_build_object('evidenceHash',repeat('f',64),'terminalStudy',null));
 perform pg_temp.native_copy_assert(not exists(select 1 from public.acquisition_experiment_reservation));
 perform pg_temp.native_copy_assert((select original_ads=originals from public.meta_creative_control));
 perform pg_temp.native_copy_assert((select count(*)=1 from public.meta_creative_registered_ads()where experiment=e));
 perform pg_temp.native_copy_assert((select count(*)=0 from public.meta_creative_visits));
end$$;
rollback;
