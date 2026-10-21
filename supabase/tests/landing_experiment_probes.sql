begin;
create or replace function pg_temp.assert(ok boolean) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'Probe assertion failed';end if;end$$;
create or replace function pg_temp.reject(statement text) returns void language plpgsql as $$begin begin execute statement;exception when others then return;end;raise exception 'Expected rejection';end$$;
insert into public.landing_experiment_control(binding,template,campaign,adset,ads,admitted_until,enabled)values(repeat('b',64),repeat('t',64),'11001','11002',array['11003'],'infinity',true);
insert into public.landing_experiments(id,path,template,copy,control_copy,state,candidate_hash,evidence_hash,generator,minimum_exposures,duration_days)
values('b1000000-0000-4000-8000-000000000001','/auckland-outdoor-living',repeat('t',64),'explore','{}','candidate',repeat('c',64),repeat('e',64),'resp_fixture',100,14);
do $$declare e uuid:='b1000000-0000-4000-8000-000000000001';probe uuid:='b2000000-0000-4000-8000-000000000001';generation bigint;common jsonb;cmd uuid:=gen_random_uuid();receipt jsonb;begin
 select c.generation into generation from public.landing_experiment_control c;
 common:=jsonb_build_object('generation',generation,'candidateHash',repeat('c',64),'template',repeat('t',64),'mode','prepare','probe',probe);
 receipt:=public.landing_experiment_command(repeat('b',64),cmd,'probe',e,common);
 perform pg_temp.assert(receipt->>'probe'=probe::text);
 perform pg_temp.assert(public.landing_experiment_visit('assign',gen_random_uuid(),'/auckland-outdoor-living',repeat('t',64),'11003','11001','11002') is null);
 perform public.landing_experiment_probe_visit(probe,'assign','/auckland-outdoor-living',repeat('t',64),generation,repeat('c',64),'prepare',false,'11003','11001','11002');
 perform pg_temp.reject(format('select public.landing_experiment_probe_visit(%L,''expose'',''/auckland-outdoor-living'',repeat(''t'',64),%s,repeat(''c'',64),''prepare'',false)',probe,generation));
 perform public.landing_experiment_probe_visit(probe,'expose','/auckland-outdoor-living',repeat('t',64),generation,repeat('c',64),'prepare',true);
 perform public.landing_experiment_probe_visit(probe,'assign','/auckland-outdoor-living',repeat('t',64),generation,repeat('c',64),'prepare',true,'11003','11001','11002');
 perform public.landing_experiment_probe_visit(probe,'expose','/auckland-outdoor-living',repeat('t',64),generation,repeat('c',64),'prepare',true);
 perform pg_temp.reject(format('select public.landing_experiment_command(repeat(''b'',64),gen_random_uuid(),''verify'',%L,%L::jsonb)',e,common||jsonb_build_object('servedHash',repeat('c',64))));
 perform pg_temp.assert((select count(*) from public.landing_experiment_assignments)=0);
 perform pg_temp.assert((select count(*) from public.landing_experiment_enquiries)=0);
end$$;
update public.landing_experiment_control set publishing=true;
update public.landing_experiments set state='live',started_at=clock_timestamp(),ends_at=clock_timestamp()+interval '14 days',lease_until=clock_timestamp()+interval '5 hours';
do $$declare e uuid:='b1000000-0000-4000-8000-000000000001';probe uuid:='b2000000-0000-4000-8000-000000000002';generation bigint;common jsonb;cmd uuid:=gen_random_uuid();receipt jsonb;statement text;begin
 select c.generation into generation from public.landing_experiment_control c;
 common:=jsonb_build_object('generation',generation,'candidateHash',repeat('c',64),'template',repeat('t',64),'mode','live','probe',probe);
 perform public.landing_experiment_command(repeat('b',64),gen_random_uuid(),'probe',e,common);
 -- Each stop/template/state/expiry race denies serving before any assignment.
 foreach statement in array array[
 'update landing_experiment_control set enabled=false',
 'update landing_experiment_control set publishing=false',
 'update landing_experiment_control set admitted_until=clock_timestamp()-interval ''1 second''',
 'update landing_experiment_control set template=repeat(''x'',64)',
 'update landing_experiments set state=''reverted''',
 'update landing_experiments set lease_until=clock_timestamp()-interval ''1 second''',
 'update landing_experiments set candidate_hash=repeat(''d'',64)',
 'update landing_experiment_probes set expires_at=clock_timestamp()-interval ''1 second'''
 ] loop
   begin
     execute statement;
     perform pg_temp.reject(format('select public.landing_experiment_probe_visit(%L,''assign'',''/auckland-outdoor-living'',repeat(''t'',64),%s,repeat(''c'',64),''live'',false,''11003'',''11001'',''11002'')',probe,generation));
     raise exception using errcode='P0002',message='restore synthetic gate fixture';
   exception when no_data_found then null;end;
 end loop;
 foreach statement in array array[
 format('select public.landing_experiment_probe_visit(%L,''assign'',''/auckland-outdoor-living'',repeat(''x'',64),%s,repeat(''c'',64),''live'',false,''11003'',''11001'',''11002'')',probe,generation),
 format('select public.landing_experiment_probe_visit(%L,''assign'',''/acrylic-roof-pergolas-auckland'',repeat(''t'',64),%s,repeat(''c'',64),''live'',false,''11003'',''11001'',''11002'')',probe,generation),
 format('select public.landing_experiment_probe_visit(%L,''assign'',''/auckland-outdoor-living'',repeat(''t'',64),%s,repeat(''c'',64),''prepare'',false,''11003'',''11001'',''11002'')',probe,generation),
 format('select public.landing_experiment_probe_visit(%L,''assign'',''/auckland-outdoor-living'',repeat(''t'',64),%s,repeat(''c'',64),''live'',false,''99999'',''11001'',''11002'')',probe,generation)
 ] loop perform pg_temp.reject(statement);end loop;
 perform public.landing_experiment_probe_visit(probe,'assign','/auckland-outdoor-living',repeat('t',64),generation,repeat('c',64),'live',false,'11003','11001','11002');
 perform public.landing_experiment_probe_visit(probe,'expose','/auckland-outdoor-living',repeat('t',64),generation,repeat('c',64),'live',true);
 perform public.landing_experiment_probe_visit(probe,'assign','/auckland-outdoor-living',repeat('t',64),generation,repeat('c',64),'live',true,'11003','11001','11002');
 perform public.landing_experiment_probe_visit(probe,'expose','/auckland-outdoor-living',repeat('t',64),generation,repeat('c',64),'live',true);
 perform pg_temp.assert((select count(*) from public.landing_experiment_assignments)=0);
 common:=jsonb_build_object('generation',generation,'candidateHash',repeat('c',64),'servedHash',repeat('c',64),'probe',probe);
 receipt:=public.landing_experiment_command(repeat('b',64),cmd,'verify',e,common);
 perform pg_temp.assert(receipt->>'state'='live');
 perform pg_temp.reject(format('select public.landing_experiment_command(repeat(''b'',64),gen_random_uuid(),''verify'',%L,%L::jsonb)',e,common));
 -- Advance only disposable fixture time to closed enrolment. A genuinely
 -- earlier diagnostic enrollment is carried forward; no genuine rows exist.
 update public.landing_experiments set ends_at=stamp-interval '1 hour' from (select clock_timestamp() stamp) clock;
 update public.landing_experiment_probes set enrolled_at=clock_timestamp()-interval '2 hours' where id=probe;
 perform pg_temp.assert(public.landing_experiment_visit('assign',gen_random_uuid(),'/auckland-outdoor-living',repeat('t',64),'11003','11001','11002')='{"control":{}}');
 perform public.landing_experiment_command(repeat('b',64),gen_random_uuid(),'probe',e,jsonb_build_object('generation',generation,'candidateHash',repeat('c',64),'template',repeat('t',64),'mode','live','probe','b2000000-0000-4000-8000-000000000003'));
 perform public.landing_experiment_probe_visit('b2000000-0000-4000-8000-000000000003','assign','/auckland-outdoor-living',repeat('t',64),generation,repeat('c',64),'live',false,'11003','11001','11002');
 perform pg_temp.assert((select count(*) from public.landing_experiment_assignments)=0);
 -- Exact immutable source receipt remains readable after stop/generation change.
 update public.landing_experiment_control set enabled=false;
 perform pg_temp.assert(public.landing_experiment_command(repeat('b',64),gen_random_uuid(),'receipt',e,jsonb_build_object('command',cmd,'stage','verify','payload',common))=receipt);
 perform pg_temp.reject(format('select public.landing_experiment_command(repeat(''b'',64),gen_random_uuid(),''receipt'',%L,%L::jsonb)',e,jsonb_build_object('command',cmd,'stage','verify','payload',common||'{"servedHash":"wrong"}')));
end$$;
set local role service_role;
do $$begin begin perform * from public.landing_experiment_probes;raise exception 'Private probe rows readable';exception when insufficient_privilege then null;end;end$$;
reset role;
rollback;
