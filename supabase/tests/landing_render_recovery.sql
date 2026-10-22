-- Synthetic disposable PostgreSQL only. Never contains an actual admission.
begin;
set local timezone='UTC';
create or replace function pg_temp.assert(ok boolean) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'Render recovery assertion failed';end if;end$$;
create or replace function pg_temp.reject(statement text) returns void language plpgsql as $$begin begin execute statement;exception when others then return;end;raise exception 'Expected rejection';end$$;
insert into public.landing_experiment_control(binding,template,campaign,adset,ads,admitted_until,enabled)values(repeat('b',64),repeat('t',64),'11001','11002',array['11003'],'infinity',true);
insert into public.landing_experiments(id,path,template,copy,control_copy,state,candidate_hash,evidence_hash,generator,minimum_exposures,duration_days)
values('b1000000-0000-4000-8000-000000000001','/auckland-outdoor-living',repeat('t',64),'explore','{}','candidate',repeat('c',64),repeat('e',64),'resp_fixture',100,14);
do $$declare e uuid:='b1000000-0000-4000-8000-000000000001';oldprobe uuid:='b2000000-0000-4000-8000-000000000001';newprobe uuid:='b2000000-0000-4000-8000-000000000002';audit uuid:=gen_random_uuid();cmd uuid:=gen_random_uuid();g bigint;common jsonb;proof jsonb;oldrow jsonb;oldcandidate jsonb;before_receipts jsonb;result jsonb;statement text;begin
 select generation into g from public.landing_experiment_control;
 common:=jsonb_build_object('generation',g,'candidateHash',repeat('c',64),'template',repeat('t',64),'mode','prepare','probe',oldprobe);
 perform public.landing_experiment_command(repeat('b',64),gen_random_uuid(),'probe',e,common);
 -- Only disposable fixture time is advanced to the observed unused expiry.
 update public.landing_experiment_probes set expires_at=clock_timestamp()-interval '1 second' where id=oldprobe;
 select to_jsonb(p) into oldrow from public.landing_experiment_probes p where id=oldprobe;
 select to_jsonb(x) into oldcandidate from public.landing_experiments x where id=e;
 select jsonb_agg(to_jsonb(r) order by command) into before_receipts from public.landing_experiment_receipts r;
 common:=common||jsonb_build_object('probe',newprobe);
 perform pg_temp.reject(format('select public.landing_experiment_command(repeat(''b'',64),%L,''probe'',%L,%L::jsonb)',cmd,e,common));
 select jsonb_build_object('kind','prepare_recovery','admission',gen_random_uuid(),'originalRequest',gen_random_uuid(),'originalStep',gen_random_uuid(),
  'originalProbe',oldprobe,'originalProbeHash',encode(sha256(convert_to(oldrow::text,'UTF8')),'hex'),'newProbe',newprobe,'candidateHash',repeat('c',64),'template',template,'binding',binding,'generation',generation,
  'controlHash',encode(sha256(convert_to(to_jsonb(c)::text,'UTF8')),'hex'),'expiresAt',least(clock_timestamp()+interval '1 hour',((clock_timestamp() at time zone 'Pacific/Auckland')::date+1)::timestamp at time zone 'Pacific/Auckland',((clock_timestamp() at time zone 'Australia/Sydney')::date+1)::timestamp at time zone 'Australia/Sydney')-interval '1 second') into proof from public.landing_experiment_control c;
 insert into public.landing_experiment_receipts(command,experiment,stage,request_hash,result) values(audit,e,'prepare_recovery',encode(sha256(convert_to(proof::text,'UTF8')),'hex'),proof);
 perform pg_temp.assert(public.landing_prepare_recovery_expiry(e,common) is not null);
 foreach statement in array array[
  'update landing_experiment_control set enabled=false',
  'update landing_experiment_control set publishing=true',
  'update landing_experiment_control set binding=repeat(''d'',64)',
  'update landing_experiments set candidate_hash=repeat(''d'',64)',
  'update landing_experiments set state=''reviewed''',
  'update landing_experiment_probes set assignments=1',
  'update landing_experiment_probes set exposures=1',
  'update landing_experiment_probes set reloads=1',
  'update landing_experiment_probes set expires_at=clock_timestamp()+interval ''1 minute''',
  'update landing_experiment_probes set enrolled_at=clock_timestamp()',
  'update landing_experiment_probes set verified_at=clock_timestamp()',
  'update landing_experiment_receipts set request_hash=repeat(''f'',64) where stage=''prepare_recovery''',
  'update landing_experiment_receipts set result=result||jsonb_build_object(''expiresAt'',clock_timestamp()-interval ''1 second'') where stage=''prepare_recovery''',
  'update landing_experiment_receipts set result=result||jsonb_build_object(''expiresAt'',clock_timestamp()+interval ''5 hours'') where stage=''prepare_recovery'''
 ] loop
  begin execute statement;
   perform pg_temp.assert(public.landing_prepare_recovery_expiry(e,common) is null);
   perform pg_temp.reject(format('select public.landing_experiment_command(repeat(''b'',64),%L,''probe'',%L,%L::jsonb)',cmd,e,common));
   raise exception using errcode='P0002',message='Restore synthetic drift';
  exception when no_data_found then null;end;
 end loop;
 perform pg_temp.assert(public.landing_prepare_recovery_expiry(e,common||jsonb_build_object('probe',gen_random_uuid())) is null);
 perform pg_temp.reject(format('insert into public.landing_experiment_receipts(command,experiment,stage,request_hash,result)values(gen_random_uuid(),%L,''prepare_recovery'',repeat(''a'',64),%L::jsonb)',e,proof));
 result:=public.landing_experiment_command(repeat('b',64),cmd,'probe',e,common);
 perform pg_temp.assert(result->>'probe'=newprobe::text);
 perform pg_temp.assert(public.landing_experiment_command(repeat('b',64),cmd,'probe',e,common)=result);
 perform pg_temp.assert((select count(*)=2 from public.landing_experiment_probes));
 perform pg_temp.assert((select expires_at<=(proof->>'expiresAt')::timestamptz from public.landing_experiment_probes where id=newprobe));
 perform pg_temp.assert((select to_jsonb(p)=oldrow from public.landing_experiment_probes p where id=oldprobe));
 perform pg_temp.assert((select to_jsonb(x)=oldcandidate from public.landing_experiments x where id=e));
 perform pg_temp.assert((select jsonb_agg(to_jsonb(r) order by command)=before_receipts from public.landing_experiment_receipts r where command not in(audit,cmd)));
 perform pg_temp.reject(format('select public.landing_experiment_command(repeat(''b'',64),gen_random_uuid(),''probe'',%L,%L::jsonb)',e,common||jsonb_build_object('probe',gen_random_uuid())));
 perform public.landing_experiment_probe_visit(newprobe,'assign','/auckland-outdoor-living',repeat('t',64),g,repeat('c',64),'prepare',false,'11003','11001','11002');
 perform public.landing_experiment_probe_visit(newprobe,'expose','/auckland-outdoor-living',repeat('t',64),g,repeat('c',64),'prepare',true);
 perform public.landing_experiment_probe_visit(newprobe,'assign','/auckland-outdoor-living',repeat('t',64),g,repeat('c',64),'prepare',true,'11003','11001','11002');
 perform pg_temp.assert((select assignments=2 and exposures=1 and reloads=1 from public.landing_experiment_probes where id=newprobe));
 perform pg_temp.assert((select count(*)=0 from public.landing_experiment_assignments));
 perform pg_temp.assert((select count(*)=0 from public.landing_experiment_enquiries));
end$$;
set local role service_role;
do $$begin
 begin perform public.landing_prepare_recovery_expiry(gen_random_uuid(),'{}');raise exception 'Private helper exposed';exception when insufficient_privilege then null;end;
 begin insert into public.landing_experiment_receipts(command,experiment,stage,request_hash,result)values(gen_random_uuid(),gen_random_uuid(),'prepare_recovery',repeat('a',64),'{}');raise exception 'Private admission exposed';exception when insufficient_privilege then null;end;
end$$;
reset role;
rollback;
