begin;
create function pg_temp.assert(ok boolean) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'Authored copy assertion failed';end if;end$$;
create function pg_temp.reject(statement text) returns void language plpgsql as $$begin begin execute statement;exception when others then return;end;raise exception 'Expected authored rejection';end$$;
select pg_temp.assert(public.landing_copy_slot('copy:design:Explore your outdoor space')='design');
select pg_temp.assert(public.landing_copy_slot('copy:support:Choose your roof and size. See an installed estimate.')='support');
select pg_temp.assert(public.landing_copy_slot('copy:design:Free pergola') is null);
select pg_temp.assert(public.landing_copy_slot('copy:design:See https://example.test') is null);
select pg_temp.assert(public.landing_copy_slot('copy:design:<img src=x>') is null);
select pg_temp.assert(public.landing_copy_slot('copy:design:Get 20 percent off') is null);
select pg_temp.assert(not public.landing_copy_map_valid('{"design":"copy:help:Plan your space"}'));
select pg_temp.assert(not public.landing_copy_map_valid('{"price":"copy:help:Plan your space"}'));
insert into public.landing_experiment_control(binding,template,campaign,adset,ads,admitted_until,enabled,publishing,control_outdoor)
 values(repeat('b',64),repeat('t',64),'11001','11002',array['11003'],'infinity',true,true,'{"help":"copy:help:Plan your outdoor space"}') on conflict(singleton) do update set binding=excluded.binding,template=excluded.template,campaign=excluded.campaign,adset=excluded.adset,ads=excluded.ads,admitted_until=excluded.admitted_until,enabled=true,publishing=true,control_outdoor=excluded.control_outdoor;
update public.landing_experiments set created_at=clock_timestamp()-interval '8 days';
do $$declare g bigint;id uuid:='ab100000-0000-4000-8000-000000000001';p jsonb;common jsonb;probe uuid:=gen_random_uuid();r jsonb;before_enquiries bigint;before_mail bigint;before_assignments bigint;
begin
 select count(*) into before_enquiries from public.enquiry_requests;select count(*) into before_mail from public.email_outbox;select count(*) into before_assignments from public.landing_experiment_assignments;
 select generation into g from public.landing_experiment_control;
 p:=jsonb_build_object('generation',g,'candidateHash',repeat('c',64),'evidenceHash',repeat('e',64),'template',repeat('t',64),'path','/auckland-outdoor-living','copy','copy:design:Explore your outdoor space','generator','resp_author','minimumExposures',100,'durationDays',14);
 common:=jsonb_build_object('generation',g,'candidateHash',repeat('c',64));
 perform pg_temp.reject(format('select public.landing_experiment_command(repeat(''b'',64),gen_random_uuid(),''prepare'',gen_random_uuid(),%L::jsonb)',p||'{"copy":"copy:design:Design your pergola"}'));
 perform public.landing_experiment_command(repeat('b',64),gen_random_uuid(),'prepare',id,p);
 perform pg_temp.assert((public.landing_experiment_command(repeat('b',64),gen_random_uuid(),'read',null)->'authoredCopy'->>'/auckland-outdoor-living')::boolean);
 perform public.landing_experiment_command(repeat('b',64),gen_random_uuid(),'probe',id,common||jsonb_build_object('template',repeat('t',64),'mode','prepare','probe',probe));
 r:=public.landing_experiment_probe_visit(probe,'assign','/auckland-outdoor-living',repeat('t',64),g,repeat('c',64),'prepare',false,'11003','11001','11002');
 perform pg_temp.assert(r->'copies'='{"design":"copy:design:Explore your outdoor space","help":"copy:help:Plan your outdoor space"}');
 perform pg_temp.assert((select count(*) from public.landing_experiment_assignments)=before_assignments);
 perform public.landing_experiment_command(repeat('b',64),gen_random_uuid(),'review',id,common||'{"reviewer":"resp_independent_pixels","verdict":"pass"}');
 perform public.landing_experiment_command(repeat('b',64),gen_random_uuid(),'visual',id,common||jsonb_build_object('visualHash',repeat('f',64),'template',repeat('t',64)));
 perform public.landing_experiment_command(repeat('b',64),gen_random_uuid(),'publish',id,common);
 r:=public.landing_experiment_visit('assign','a2000000-0000-4000-8000-000000000001','/auckland-outdoor-living',repeat('t',64),'11003','11001','11002');
 perform pg_temp.assert(r->>'arm'='challenger');
 perform pg_temp.assert(r->'copies'->>'design'='copy:design:Explore your outdoor space');
 perform public.landing_experiment_command(repeat('b',64),gen_random_uuid(),'rollback',id,common);
 perform pg_temp.assert((select control_outdoor='{"help":"copy:help:Plan your outdoor space"}' from public.landing_experiment_control));
 perform pg_temp.assert((select count(*) from public.enquiry_requests)=before_enquiries);
 perform pg_temp.assert((select count(*) from public.email_outbox)=before_mail);
 -- The exact earlier candidate remains forbidden even after arbitrary receipt
 -- churn; existing immutable source history owns repetition, not a UI tail.
 update public.landing_experiments set created_at=clock_timestamp()-interval '8 days';
 perform pg_temp.reject(format('select public.landing_experiment_command(repeat(''b'',64),gen_random_uuid(),''prepare'',gen_random_uuid(),%L::jsonb)',p));
end$$;
rollback;
