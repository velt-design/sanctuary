-- Synthetic disposable PostgreSQL only. No actual operational identities.
begin;
set local timezone='UTC';
create or replace function pg_temp.assert(ok boolean) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'Packaging recovery assertion failed';end if;end$$;
create or replace function pg_temp.reject(statement text) returns void language plpgsql as $$begin begin execute statement;exception when others then return;end;raise exception 'Expected rejection';end$$;
insert into public.landing_experiment_control(binding,template,campaign,adset,ads,admitted_until,enabled)values(repeat('b',64),repeat('t',64),'11001','11002',array['11003'],'infinity',true);
insert into public.landing_experiments(id,path,template,copy,control_copy,state,candidate_hash,evidence_hash,generator,minimum_exposures,duration_days)
values('b1000000-0000-4000-8000-000000000001','/auckland-outdoor-living',repeat('t',64),'explore','{}','candidate',repeat('c',64),repeat('e',64),'resp_fixture',100,14);
do $$declare e uuid:='b1000000-0000-4000-8000-000000000001';firstprobe uuid:='b2000000-0000-4000-8000-000000000001';secondprobe uuid:='b2000000-0000-4000-8000-000000000002';newprobe uuid:='b2000000-0000-4000-8000-000000000003';audit uuid:=gen_random_uuid();cmd uuid:=gen_random_uuid();replacement uuid:='b1000000-0000-4000-8000-000000000002';preparecmd uuid:=gen_random_uuid();preparation jsonb;g bigint;common jsonb;proof jsonb;oldreceipt jsonb;oldrows jsonb;oldcandidate jsonb;before_receipts jsonb;result jsonb;statement text;begin
 select generation into g from public.landing_experiment_control;
 common:=jsonb_build_object('generation',g,'candidateHash',repeat('c',64),'template',repeat('t',64),'mode','prepare','probe',firstprobe);
 perform public.landing_experiment_command(repeat('b',64),gen_random_uuid(),'probe',e,common);
 update public.landing_experiment_probes set expires_at=clock_timestamp()-interval '1 second' where id=firstprobe;
 select jsonb_build_object('kind','prepare_recovery','admission',gen_random_uuid(),'originalRequest',gen_random_uuid(),'originalStep',gen_random_uuid(),
  'originalProbe',firstprobe,'originalProbeHash',(select encode(sha256(convert_to(to_jsonb(p)::text,'UTF8')),'hex')from landing_experiment_probes p where id=firstprobe),'newProbe',secondprobe,'candidateHash',repeat('c',64),'template',template,'binding',binding,'generation',generation,
  'controlHash',encode(sha256(convert_to(to_jsonb(c)::text,'UTF8')),'hex'),'expiresAt',least(clock_timestamp()+interval '1 hour',((clock_timestamp() at time zone 'Pacific/Auckland')::date+1)::timestamp at time zone 'Pacific/Auckland',((clock_timestamp() at time zone 'Australia/Sydney')::date+1)::timestamp at time zone 'Australia/Sydney')-interval '1 second') into proof from public.landing_experiment_control c;
 insert into public.landing_experiment_receipts(command,experiment,stage,request_hash,result) values(gen_random_uuid(),e,'prepare_recovery',encode(sha256(convert_to(proof::text,'UTF8')),'hex'),proof);
 perform public.landing_experiment_command(repeat('b',64),gen_random_uuid(),'probe',e,common||jsonb_build_object('probe',secondprobe));
 update public.landing_experiment_probes set expires_at=clock_timestamp()-interval '1 second' where id=secondprobe;
 perform public.landing_experiment_command(repeat('b',64),gen_random_uuid(),'rollback',e,jsonb_build_object('generation',g,'candidateHash',repeat('c',64),'reason','guard'));
 select to_jsonb(r) into oldreceipt from public.landing_experiment_receipts r where experiment=e and stage='prepare_recovery';
 select jsonb_agg(to_jsonb(p)order by id) into oldrows from public.landing_experiment_probes p;
 select to_jsonb(x) into oldcandidate from public.landing_experiments x where id=e;
 select jsonb_agg(to_jsonb(r)order by command) into before_receipts from public.landing_experiment_receipts r;
 proof:=proof||jsonb_build_object('kind','prepare_packaging_recovery','originalRequest',gen_random_uuid(),'originalProbe',secondprobe,'originalProbeHash',(select encode(sha256(convert_to(to_jsonb(p)::text,'UTF8')),'hex')from landing_experiment_probes p where id=secondprobe),
  'priorProbe',firstprobe,'priorProbeHash',proof->>'originalProbeHash','priorRecoveryHash',encode(sha256(convert_to(oldreceipt::text,'UTF8')),'hex'),'newProbe',newprobe,'newExperiment',replacement,'originalExperimentHash',encode(sha256(convert_to(oldcandidate::text,'UTF8')),'hex'),'rollbackReceiptHash',(select encode(sha256(convert_to(to_jsonb(r)::text,'UTF8')),'hex')from landing_experiment_receipts r where experiment=e and stage='rollback'));
 common:=common||jsonb_build_object('probe',newprobe);
 perform pg_temp.reject(format('select landing_experiment_command(repeat(''b'',64),%L,''probe'',%L,%L::jsonb)',cmd,replacement,common));
 insert into public.landing_experiment_receipts(command,experiment,stage,request_hash,result) values(audit,e,'prepare_packaging_recovery',encode(sha256(convert_to(proof::text,'UTF8')),'hex'),proof);
 perform pg_temp.assert(public.landing_packaging_recovery_expiry(replacement,common) is not null);
 foreach statement in array array[
  'update landing_experiment_control set enabled=false',
  'update landing_experiment_control set publishing=true',
  'update landing_experiment_control set binding=repeat(''d'',64)',
  'update landing_experiments set candidate_hash=repeat(''d'',64)',
  'update landing_experiments set state=''reviewed''',
  format('update landing_experiment_probes set assignments=1 where id=%L',firstprobe),
  format('update landing_experiment_probes set exposures=1 where id=%L',firstprobe),
  format('update landing_experiment_probes set reloads=1 where id=%L',firstprobe),
  format('update landing_experiment_probes set enrolled_at=clock_timestamp() where id=%L',firstprobe),
  format('update landing_experiment_probes set verified_at=clock_timestamp() where id=%L',firstprobe),
  format('update landing_experiment_probes set assignments=1 where id=%L',secondprobe),
  format('update landing_experiment_probes set exposures=1 where id=%L',secondprobe),
  format('update landing_experiment_probes set reloads=1 where id=%L',secondprobe),
  format('update landing_experiment_probes set enrolled_at=clock_timestamp() where id=%L',secondprobe),
  format('update landing_experiment_probes set verified_at=clock_timestamp() where id=%L',secondprobe),
  'update landing_experiment_probes set expires_at=clock_timestamp()+interval ''1 minute''',
  'update landing_experiment_receipts set request_hash=repeat(''f'',64) where stage=''prepare_packaging_recovery''',
  'update landing_experiment_receipts set result=result||jsonb_build_object(''expiresAt'',clock_timestamp()-interval ''1 second'') where stage=''prepare_packaging_recovery''',
  'update landing_experiment_receipts set result=result||jsonb_build_object(''expiresAt'',clock_timestamp()+interval ''2 hours'') where stage=''prepare_packaging_recovery''',
  'update landing_experiment_receipts set result=result||jsonb_build_object(''priorRecoveryHash'',repeat(''a'',64)) where stage=''prepare_packaging_recovery'''
 ] loop
  begin execute statement;perform pg_temp.assert(public.landing_packaging_recovery_expiry(replacement,common) is null);
   perform pg_temp.reject(format('select landing_experiment_command(repeat(''b'',64),%L,''probe'',%L,%L::jsonb)',cmd,replacement,common));
   raise exception using errcode='P0002',message='Restore synthetic drift';
  exception when no_data_found then null;end;
 end loop;
 select jsonb_build_object('generation',g,'candidateHash',candidate_hash,'evidenceHash',evidence_hash,'template',template,'path',path,'copy',copy,'generator',generator,'minimumExposures',minimum_exposures,'durationDays',duration_days)into preparation from landing_experiments where id=e;
 perform pg_temp.reject(format('select landing_experiment_command(repeat(''b'',64),gen_random_uuid(),''prepare'',%L,%L::jsonb)',replacement,preparation||jsonb_build_object('generator','resp_wrong')));
 begin
  insert into acquisition_experiment_reservation(lane,experiment)values('creative',gen_random_uuid());
  perform pg_temp.reject(format('select landing_experiment_command(repeat(''b'',64),%L,''prepare'',%L,%L::jsonb)',preparecmd,replacement,preparation));
  raise exception using errcode='P0002',message='Restore competing synthetic reservation';
 exception when no_data_found then null;end;
 result:=public.landing_experiment_command(repeat('b',64),preparecmd,'prepare',replacement,preparation);
 perform pg_temp.assert(public.landing_experiment_command(repeat('b',64),preparecmd,'prepare',replacement,preparation)=result);
 perform pg_temp.assert((select lane='landing' and experiment=replacement from acquisition_experiment_reservation));
 perform pg_temp.assert((public.landing_experiment_command(repeat('b',64),gen_random_uuid(),'read',null)->'excluded'->'/auckland-outdoor-living')?'explore');
 result:=public.landing_experiment_command(repeat('b',64),cmd,'probe',replacement,common);
 perform pg_temp.assert(result->>'probe'=newprobe::text);
 perform pg_temp.assert(public.landing_experiment_command(repeat('b',64),cmd,'probe',replacement,common)=result);
 perform pg_temp.assert((select count(*)=3 from public.landing_experiment_probes));
 perform pg_temp.assert((select expires_at<=(proof->>'expiresAt')::timestamptz from public.landing_experiment_probes where id=newprobe));
 perform pg_temp.assert((select jsonb_agg(to_jsonb(p)order by id)=oldrows from public.landing_experiment_probes p where id<>newprobe));
 perform pg_temp.assert((select to_jsonb(x)=oldcandidate from public.landing_experiments x where id=e));
 perform pg_temp.assert((select jsonb_agg(to_jsonb(r)order by command)=before_receipts from public.landing_experiment_receipts r where command not in(audit,cmd,preparecmd)));
 perform pg_temp.reject(format('select landing_experiment_command(repeat(''b'',64),gen_random_uuid(),''probe'',%L,%L::jsonb)',replacement,common||jsonb_build_object('probe',gen_random_uuid())));
 perform pg_temp.exercise_render_successor(replacement,newprobe,common);
 perform public.landing_experiment_probe_visit(newprobe,'assign','/auckland-outdoor-living',repeat('t',64),g,repeat('c',64),'prepare',false,'11003','11001','11002');
 perform public.landing_experiment_probe_visit(newprobe,'expose','/auckland-outdoor-living',repeat('t',64),g,repeat('c',64),'prepare',true);
 perform public.landing_experiment_probe_visit(newprobe,'assign','/auckland-outdoor-living',repeat('t',64),g,repeat('c',64),'prepare',true,'11003','11001','11002');
 perform pg_temp.assert((select assignments=2 and exposures=1 and reloads=1 from public.landing_experiment_probes where id=newprobe));
 perform pg_temp.assert((select count(*)=0 from public.landing_experiment_assignments));
 perform pg_temp.assert((select count(*)=0 from public.landing_experiment_enquiries));
end$$;
set local role service_role;
do $$begin
 begin perform public.landing_packaging_recovery_expiry(gen_random_uuid(),'{}');raise exception 'Private helper exposed';exception when insufficient_privilege then null;end;
end$$;
reset role;
rollback;
