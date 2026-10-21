create function pg_temp.assert(ok boolean) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'Creative assertion failed';end if;end$$;
create function pg_temp.reject(statement text) returns void language plpgsql as $$begin begin execute statement;exception when others then return;end;raise exception 'Expected rejection';end$$;
create function pg_temp.cleanup_proof(e uuid) returns jsonb language sql as $$
 select jsonb_build_object('evidenceHash',repeat('f',64),'terminalStudy',
  (select jsonb_build_object('id',object_id,'end',floor(extract(epoch from clock_timestamp()))-1,'observationEnd',floor(extract(epoch from clock_timestamp()))-1,
    'observedAt',clock_timestamp(),'evidenceHash',repeat('e',64),'ended',true) from public.meta_creative_objects where experiment=e and kind='study'))
$$;
insert into public.meta_creative_control(binding,scope,original_ads,budget_hash,control_hash) values(repeat('b',64),'{"app":"11","principal":"12","business":"13","account":"14","page":"15","campaign":"16","adset":"17"}','["21","22","23","24"]',repeat('c',64),repeat('d',64));
create function pg_temp.plan() returns jsonb language sql as $$select jsonb_build_object('scope',scope,'originalAds',original_ads,'budgetHash',budget_hash,'controlHash',control_hash,'nativeContractHash',repeat('e',64),'approvalHash',repeat('f',64),'catalogueHash',repeat('a',64),'generator','author','reviewer','reviewer') from public.meta_creative_control$$;
select pg_temp.assert(not(select enabled from public.meta_creative_control));
select pg_temp.reject(format('select public.meta_creative_command(repeat(''b'',64),gen_random_uuid(),gen_random_uuid(),''reserve'',%L)',pg_temp.plan()));
select pg_temp.assert(not has_function_privilege('anon','meta_creative_command(text,uuid,uuid,text,jsonb)','EXECUTE'));
select pg_temp.assert(not has_table_privilege('service_role','meta_creative_effects','INSERT'));
select pg_temp.assert((select bool_and(relrowsecurity) from pg_class where oid in('public.meta_creative_plans'::regclass,'public.meta_creative_effects'::regclass,'public.meta_creative_objects'::regclass,'public.meta_creative_receipts'::regclass,'public.acquisition_experiment_reservation'::regclass)));
update public.meta_creative_control set enabled=true,cleanup_enabled=true,authority_current=true,global_stop=false,native_contract_hash=repeat('e',64);
select pg_temp.reject(format('select public.meta_creative_command(repeat(''b'',64),gen_random_uuid(),gen_random_uuid(),''reserve'',%L)',pg_temp.plan()||'{"budgetHash":null}'));
select pg_temp.reject(format('select public.meta_creative_command(repeat(''b'',64),gen_random_uuid(),gen_random_uuid(),''reserve'',%L)',pg_temp.plan()||'{"scope":{"account":"999"}}'));
-- Actual released landing command participates in the new global lock.
insert into public.landing_experiment_control(binding,template,campaign,adset,ads,admitted_until,enabled) values(repeat('a',64),repeat('t',64),'16','17',array['21','22','23','24'],'infinity',true);
create function pg_temp.landing_payload() returns jsonb language sql as $$select jsonb_build_object('generation',generation,'template',template,'candidateHash',repeat('c',64),'evidenceHash',repeat('e',64),'path','/auckland-outdoor-living','copy','explore','generator','author','minimumExposures',100,'durationDays',14) from public.landing_experiment_control$$;
select public.landing_experiment_command(repeat('a',64),gen_random_uuid(),'prepare','a1000000-0000-4000-8000-000000000001',pg_temp.landing_payload());
select pg_temp.reject(format('select public.meta_creative_command(repeat(''b'',64),gen_random_uuid(),gen_random_uuid(),''reserve'',%L)',pg_temp.plan()));
update public.landing_experiments set state='rejected' where id='a1000000-0000-4000-8000-000000000001';
select public.meta_creative_command(repeat('b',64),'b1000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000002','reserve',pg_temp.plan());
select public.meta_creative_command(repeat('b',64),'b1000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000002','reserve',pg_temp.plan());
select pg_temp.reject($$update public.landing_experiments set state='candidate' where id='a1000000-0000-4000-8000-000000000001'$$);
select pg_temp.reject($$update public.meta_creative_plans set plan='{}'$$);
create function pg_temp.effect(k text,target text default null) returns jsonb language sql as $$select jsonb_build_object('kind',k,'objectId',target,'requestHash',repeat('a',64),'generation',generation,'preStateHash',repeat('c',64),'observedAt',clock_timestamp()) from public.meta_creative_control$$;
do $$declare e uuid:='b1000000-0000-4000-8000-000000000002';cmd uuid:=gen_random_uuid();payload jsonb:=pg_temp.effect('create_paused_ad');r jsonb;
begin
 r:=public.meta_creative_command(repeat('b',64),cmd,e,'admit',payload);perform pg_temp.assert(not(r->>'dispatch')::boolean and (r->>'prepared')::boolean);
 r:=public.meta_creative_command(repeat('b',64),cmd,e,'admit',payload);perform pg_temp.assert(not(r->>'dispatch')::boolean);
 perform pg_temp.reject(format('select public.meta_creative_command(repeat(''b'',64),%L,%L,''admit'',%L)',cmd,e,payload||'{"kind":"create_study"}'));
 perform pg_temp.reject(format('select public.meta_creative_command(repeat(''b'',64),gen_random_uuid(),%L,''admit'',%L)',e,pg_temp.effect('create_paused_ad')));
 perform pg_temp.reject(format('select public.meta_creative_command(repeat(''b'',64),gen_random_uuid(),%L,''cleanup'',%L)',e,jsonb_build_object('evidenceHash',repeat('f',64))));
 perform public.meta_creative_command(repeat('b',64),cmd,e,'check',jsonb_build_object('requestHash',repeat('a',64)));
 -- Disposable fixture aging, not an operational reset or replay.
 update public.meta_creative_effects set admitted_at=clock_timestamp()-interval '91 seconds' where command=cmd;
 perform pg_temp.reject(format('select public.meta_creative_command(repeat(''b'',64),%L,%L,''check'',%L)',cmd,e,jsonb_build_object('requestHash',repeat('a',64))));
 update public.meta_creative_control set enabled=false;
 perform pg_temp.reject(format('select public.meta_creative_command(repeat(''b'',64),%L,%L,''check'',%L)',cmd,e,jsonb_build_object('requestHash',repeat('a',64))));
 -- Confirm an already-dispatched operation after Stop; never redispatch it.
 perform public.meta_creative_command(repeat('b',64),cmd,e,'confirm',jsonb_build_object('requestHash',repeat('a',64),'objectId','31','evidenceHash',repeat('f',64)));
 perform pg_temp.reject(format('select public.meta_creative_command(repeat(''b'',64),gen_random_uuid(),%L,''admit'',%L)',e,pg_temp.effect('pause_ad','31')));
 update public.meta_creative_control set enabled=true;
 perform pg_temp.reject(format('select public.meta_creative_command(repeat(''b'',64),gen_random_uuid(),%L,''admit'',%L)',e,pg_temp.effect('pause_ad','21')));
 perform pg_temp.reject(format('select public.meta_creative_command(repeat(''b'',64),gen_random_uuid(),%L,''cleanup'',%L)',e,jsonb_build_object('evidenceHash',repeat('f',64))));
 cmd:=gen_random_uuid();perform public.meta_creative_command(repeat('b',64),cmd,e,'admit',pg_temp.effect('create_study'));
 perform public.meta_creative_command(repeat('b',64),cmd,e,'check',jsonb_build_object('requestHash',repeat('a',64)));
 perform public.meta_creative_command(repeat('b',64),cmd,e,'confirm',jsonb_build_object('requestHash',repeat('a',64),'objectId','41','evidenceHash',repeat('f',64)));
 perform pg_temp.reject(format('select public.meta_creative_command(repeat(''b'',64),gen_random_uuid(),%L,''admit'',%L)',e,pg_temp.effect('create_study')));
 cmd:=gen_random_uuid();perform public.meta_creative_command(repeat('b',64),cmd,e,'admit',pg_temp.effect('pause_ad','31'));
 perform public.meta_creative_command(repeat('b',64),cmd,e,'check',jsonb_build_object('requestHash',repeat('a',64)));
 perform public.meta_creative_command(repeat('b',64),cmd,e,'confirm',jsonb_build_object('requestHash',repeat('a',64),'objectId','31','evidenceHash',repeat('f',64)));
 perform pg_temp.reject(format('select public.meta_creative_command(repeat(''b'',64),gen_random_uuid(),%L,''cleanup'',%L)',e,jsonb_build_object('evidenceHash',repeat('f',64))));
 cmd:=gen_random_uuid();perform public.meta_creative_command(repeat('b',64),cmd,e,'admit',pg_temp.effect('end_study','41'));
 perform public.meta_creative_command(repeat('b',64),cmd,e,'check',jsonb_build_object('requestHash',repeat('a',64)));
 perform public.meta_creative_command(repeat('b',64),cmd,e,'confirm',jsonb_build_object('requestHash',repeat('a',64),'objectId','41','evidenceHash',repeat('f',64)));
 perform public.meta_creative_command(repeat('b',64),gen_random_uuid(),e,'cleanup',pg_temp.cleanup_proof(e));
 perform pg_temp.assert(not exists(select 1 from public.acquisition_experiment_reservation));
 perform pg_temp.reject(format('select public.meta_creative_command(repeat(''b'',64),gen_random_uuid(),%L,''reserve'',%L)',e,pg_temp.plan()));
end$$;
select pg_temp.assert((select count(*) from public.meta_creative_objects)=2);
select pg_temp.reject($$delete from public.meta_creative_receipts$$);

-- CL1: normal effects cannot consume the final two pauses and study end.
create function pg_temp.finish_effect(e uuid,k text,target text,obj text,terminal boolean default false) returns void language plpgsql as $$
declare cmd uuid:=gen_random_uuid();begin
 perform public.meta_creative_command(repeat('b',64),cmd,e,case when terminal then 'admit_cleanup' else 'admit' end,pg_temp.effect(k,target));
 perform public.meta_creative_command(repeat('b',64),cmd,e,'check',jsonb_build_object('requestHash',repeat('a',64)));
 perform public.meta_creative_command(repeat('b',64),cmd,e,'confirm',jsonb_build_object('requestHash',repeat('a',64),'objectId',obj,'evidenceHash',repeat('f',64)));
end$$;
begin;
do $$declare e uuid:='c1000000-0000-4000-8000-000000000001';cmd uuid;begin
 perform public.meta_creative_command(repeat('b',64),gen_random_uuid(),e,'reserve',pg_temp.plan());
 perform pg_temp.finish_effect(e,'create_paused_ad',null,'51');
 perform pg_temp.finish_effect(e,'create_paused_ad',null,'52');
 perform pg_temp.finish_effect(e,'create_study',null,'61');
 for i in 1..10 loop
  perform pg_temp.finish_effect(e,'activate_ad','51','51');
  perform pg_temp.finish_effect(e,'pause_ad','51','51');
 end loop;
 perform pg_temp.finish_effect(e,'activate_ad','51','51');
 perform pg_temp.assert((select count(*) from public.meta_creative_effects where experiment=e)=24);
 perform pg_temp.reject(format('select public.meta_creative_command(repeat(''b'',64),gen_random_uuid(),%L,''admit'',%L)',e,pg_temp.effect('pause_ad','51')));
 update public.meta_creative_control set enabled=false;
 -- A publication stop permits only separately enabled terminal cleanup.
 perform pg_temp.reject(format('select public.meta_creative_command(repeat(''b'',64),gen_random_uuid(),%L,''admit_cleanup'',%L)',e,pg_temp.effect('activate_ad','51')));
 perform pg_temp.reject(format('select public.meta_creative_command(repeat(''b'',64),gen_random_uuid(),%L,''admit_cleanup'',%L)',e,pg_temp.effect('pause_ad','21')));
 perform pg_temp.reject(format('select public.meta_creative_command(repeat(''b'',64),gen_random_uuid(),%L,''admit_cleanup'',%L)',e,pg_temp.effect('pause_ad','99')));
 update public.meta_creative_control set cleanup_enabled=false;
 perform pg_temp.reject(format('select public.meta_creative_command(repeat(''b'',64),gen_random_uuid(),%L,''admit_cleanup'',%L)',e,pg_temp.effect('pause_ad','51')));
 update public.meta_creative_control set cleanup_enabled=true,global_stop=true;
 perform pg_temp.reject(format('select public.meta_creative_command(repeat(''b'',64),gen_random_uuid(),%L,''admit_cleanup'',%L)',e,pg_temp.effect('pause_ad','51')));
 update public.meta_creative_control set global_stop=false,authority_current=false;
 perform pg_temp.reject(format('select public.meta_creative_command(repeat(''b'',64),gen_random_uuid(),%L,''admit_cleanup'',%L)',e,pg_temp.effect('pause_ad','51')));
 update public.meta_creative_control set authority_current=true;
 cmd:=gen_random_uuid();
 perform public.meta_creative_command(repeat('b',64),cmd,e,'admit_cleanup',pg_temp.effect('pause_ad','51'));
 update public.meta_creative_control set global_stop=true;
 perform pg_temp.reject(format('select public.meta_creative_command(repeat(''b'',64),%L,%L,''check'',%L)',cmd,e,jsonb_build_object('requestHash',repeat('a',64))));
 update public.meta_creative_control set global_stop=false;
 -- Even after restoration, a stale generation cannot dispatch. Resolve only its
 -- untouched prepared fence; this consumes its finite admission slot.
 perform pg_temp.reject(format('select public.meta_creative_command(repeat(''b'',64),%L,%L,''check'',%L)',cmd,e,jsonb_build_object('requestHash',repeat('a',64))));
 perform public.meta_creative_command(repeat('b',64),cmd,e,'no_effect',jsonb_build_object('requestHash',repeat('a',64),'evidenceHash',repeat('f',64),'reason','dispatch_not_started'));
end$$;
rollback;
-- Clean capacity case proves all three owned objects stop after all 24 normal slots.
begin;
do $$declare e uuid:='c2000000-0000-4000-8000-000000000001';begin
 perform public.meta_creative_command(repeat('b',64),gen_random_uuid(),e,'reserve',pg_temp.plan());
 perform pg_temp.finish_effect(e,'create_paused_ad',null,'51');
 perform pg_temp.finish_effect(e,'create_paused_ad',null,'52');
 perform pg_temp.finish_effect(e,'create_study',null,'61');
 for i in 1..10 loop perform pg_temp.finish_effect(e,'activate_ad','51','51');perform pg_temp.finish_effect(e,'pause_ad','51','51');end loop;
 perform pg_temp.finish_effect(e,'activate_ad','51','51');
 update public.meta_creative_control set enabled=false;
 perform pg_temp.finish_effect(e,'pause_ad','51','51',true);
 update public.meta_creative_control set enabled=true;
 perform pg_temp.reject(format('select public.meta_creative_command(repeat(''b'',64),gen_random_uuid(),%L,''admit'',%L)',e,pg_temp.effect('activate_ad','51')));
 perform pg_temp.reject(format('select public.meta_creative_command(repeat(''b'',64),gen_random_uuid(),%L,''admit_cleanup'',%L)',e,pg_temp.effect('pause_ad','51')));
 perform pg_temp.finish_effect(e,'pause_ad','52','52',true);
 perform pg_temp.finish_effect(e,'end_study','61','61',true);
 perform pg_temp.assert((select count(*) from public.meta_creative_effects where experiment=e)=27);
 perform pg_temp.reject(format('select public.meta_creative_command(repeat(''b'',64),gen_random_uuid(),%L,''cleanup'',%L)',e,jsonb_build_object('evidenceHash',repeat('f',64))));
 perform pg_temp.reject(format('select public.meta_creative_command(repeat(''b'',64),gen_random_uuid(),%L,''cleanup'',%L)',e,
   jsonb_set(pg_temp.cleanup_proof(e),'{terminalStudy,observedAt}','null'::jsonb)));
 perform pg_temp.reject(format('select public.meta_creative_command(repeat(''b'',64),gen_random_uuid(),%L,''cleanup'',%L)',e,
   jsonb_set(pg_temp.cleanup_proof(e),'{terminalStudy,observedAt}',to_jsonb(clock_timestamp()-interval '2 minutes'))));
 perform pg_temp.reject(format('select public.meta_creative_command(repeat(''b'',64),gen_random_uuid(),%L,''cleanup'',%L)',e,
   jsonb_set(pg_temp.cleanup_proof(e),'{terminalStudy,id}','"999"'::jsonb)));

 perform public.meta_creative_command(repeat('b',64),gen_random_uuid(),e,'cleanup',pg_temp.cleanup_proof(e));
 perform pg_temp.assert(not exists(select 1 from public.acquisition_experiment_reservation));
end$$;
rollback;

-- CL2: only the exact still-prepared, never-claimed fence can resolve no effect.
begin;
do $$declare e uuid:='d1000000-0000-4000-8000-000000000001';cmd uuid:=gen_random_uuid();payload jsonb:=pg_temp.effect('create_paused_ad');proof jsonb:=jsonb_build_object('requestHash',repeat('a',64),'evidenceHash',repeat('f',64),'reason','dispatch_not_started');r jsonb;begin
 perform public.meta_creative_command(repeat('b',64),gen_random_uuid(),e,'reserve',pg_temp.plan());
 perform public.meta_creative_command(repeat('b',64),cmd,e,'admit',payload);
 update public.meta_creative_effects set admitted_at=clock_timestamp()-interval '91 seconds' where command=cmd;
 perform pg_temp.reject(format('select public.meta_creative_command(repeat(''b'',64),%L,%L,''check'',%L)',cmd,e,jsonb_build_object('requestHash',repeat('a',64))));
 perform pg_temp.reject(format('select public.meta_creative_command(repeat(''b'',64),gen_random_uuid(),%L,''cleanup'',%L)',e,jsonb_build_object('evidenceHash',repeat('f',64))));
 perform pg_temp.reject(format('select public.meta_creative_command(repeat(''b'',64),%L,%L,''no_effect'',%L)',cmd,e,proof||'{"reason":"expired"}'));
 perform pg_temp.reject(format('select public.meta_creative_command(repeat(''b'',64),%L,%L,''no_effect'',%L)',cmd,e,proof||jsonb_build_object('requestHash',repeat('b',64))));
 perform pg_temp.reject(format('select public.meta_creative_command(repeat(''b'',64),gen_random_uuid(),%L,''no_effect'',%L)',e,proof));
 perform public.meta_creative_command(repeat('b',64),cmd,e,'no_effect',proof);
 perform public.meta_creative_command(repeat('b',64),cmd,e,'no_effect',proof);
 perform pg_temp.reject(format('select public.meta_creative_command(repeat(''b'',64),%L,%L,''no_effect'',%L)',cmd,e,proof||jsonb_build_object('evidenceHash',repeat('b',64))));
 r:=public.meta_creative_command(repeat('b',64),cmd,e,'admit',payload);perform pg_temp.assert(r->>'state'='no_effect' and not(r->>'dispatch')::boolean);
 perform pg_temp.reject(format('select public.meta_creative_command(repeat(''b'',64),%L,%L,''check'',%L)',cmd,e,jsonb_build_object('requestHash',repeat('a',64))));
 perform pg_temp.reject(format('select public.meta_creative_command(repeat(''b'',64),%L,%L,''confirm'',%L)',cmd,e,jsonb_build_object('requestHash',repeat('a',64),'objectId','71','evidenceHash',repeat('f',64))));
 perform pg_temp.assert(not exists(select 1 from public.meta_creative_objects where experiment=e));
 perform public.meta_creative_command(repeat('b',64),gen_random_uuid(),e,'cleanup',pg_temp.cleanup_proof(e));
 perform pg_temp.assert(not exists(select 1 from public.acquisition_experiment_reservation));
end$$;
rollback;
begin;
do $$declare e uuid:='d2000000-0000-4000-8000-000000000001';cmd uuid:=gen_random_uuid();begin
 perform public.meta_creative_command(repeat('b',64),gen_random_uuid(),e,'reserve',pg_temp.plan());
 perform public.meta_creative_command(repeat('b',64),cmd,e,'admit',pg_temp.effect('create_paused_ad'));
 perform public.meta_creative_command(repeat('b',64),cmd,e,'check',jsonb_build_object('requestHash',repeat('a',64)));
 update public.meta_creative_effects set admitted_at=clock_timestamp()-interval '91 seconds' where command=cmd;
 perform pg_temp.reject(format('select public.meta_creative_command(repeat(''b'',64),%L,%L,''check'',%L)',cmd,e,jsonb_build_object('requestHash',repeat('a',64))));
 perform pg_temp.reject(format('select public.meta_creative_command(repeat(''b'',64),%L,%L,''no_effect'',%L)',cmd,e,jsonb_build_object('requestHash',repeat('a',64),'evidenceHash',repeat('f',64),'reason','dispatch_not_started')));
 perform pg_temp.reject(format('select public.meta_creative_command(repeat(''b'',64),gen_random_uuid(),%L,''cleanup'',%L)',e,jsonb_build_object('evidenceHash',repeat('f',64))));
 perform pg_temp.assert((select state='uncertain' from public.meta_creative_effects where command=cmd));
 perform pg_temp.assert(exists(select 1 from public.acquisition_experiment_reservation where experiment=e));
end$$;
rollback;
