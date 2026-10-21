begin;
create function pg_temp.assert(ok boolean) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'Experiment assertion failed';end if;end$$;
create function pg_temp.reject(statement text) returns void language plpgsql as $$begin begin execute statement;exception when others then return;end;raise exception 'Expected rejection';end$$;
insert into public.landing_experiment_control(binding,template,campaign,adset,ads,admitted_until) values(repeat('b',64),repeat('t',64),'11001','11002',array['11003'],'infinity');
select pg_temp.assert((public.landing_experiment_command(repeat('b',64),gen_random_uuid(),'read',null)->>'enabled')::boolean=false);
set local role anon;
do $$begin begin perform public.landing_experiment_public_control('/auckland-outdoor-living',repeat('t',64));raise exception 'Anonymous executed private RPC';exception when insufficient_privilege then null;end;end$$;
reset role;
update public.landing_experiment_control set enabled=true;
do $$declare generation bigint; id uuid:='a1000000-0000-4000-8000-000000000001'; cmd uuid:='a1000000-0000-4000-8000-000000000002';p jsonb; common jsonb; r jsonb;
begin
 select c.generation into generation from public.landing_experiment_control c;
 p:=jsonb_build_object('generation',generation,'candidateHash',repeat('c',64),'evidenceHash',repeat('e',64),'template',repeat('t',64),'path','/auckland-outdoor-living','copy','explore','generator','resp_generate','minimumExposures',100,'durationDays',14);
 common:=jsonb_build_object('generation',generation,'candidateHash',repeat('c',64));
 r:=public.landing_experiment_command(repeat('b',64),cmd,'prepare',id,p);
 perform pg_temp.assert(r=public.landing_experiment_command(repeat('b',64),cmd,'prepare',id,p));
 perform pg_temp.reject(format('select public.landing_experiment_command(repeat(''b'',64),%L,''prepare'',%L,%L::jsonb)',cmd,id,p||'{"copy":"project"}'));
 perform pg_temp.reject(format('select public.landing_experiment_command(repeat(''b'',64),gen_random_uuid(),''prepare'',gen_random_uuid(),%L::jsonb)',p));
 perform pg_temp.reject(format('select public.landing_experiment_command(repeat(''b'',64),gen_random_uuid(),''publish'',%L,%L::jsonb)',id,common));
 perform public.landing_experiment_command(repeat('b',64),gen_random_uuid(),'review',id,common||'{"reviewer":"resp_review","verdict":"pass"}');
 perform public.landing_experiment_command(repeat('b',64),gen_random_uuid(),'visual',id,common||jsonb_build_object('visualHash',repeat('a',64),'template',repeat('t',64)));
 perform pg_temp.reject(format('select public.landing_experiment_command(repeat(''b'',64),gen_random_uuid(),''publish'',%L,%L::jsonb)',id,common));
end$$;
update public.landing_experiment_control set publishing=true;
select public.landing_experiment_command(repeat('b',64),gen_random_uuid(),'publish','a1000000-0000-4000-8000-000000000001',jsonb_build_object('generation',generation,'candidateHash',repeat('c',64))) from public.landing_experiment_control;
-- Client-supplied arms do not exist. Template, campaign and signed ID stay server-owned.
select pg_temp.assert(public.landing_experiment_visit('assign','a2000000-0000-4000-8000-000000000001','/auckland-outdoor-living',repeat('x',64),'11003','11001','11002')='{"control":{}}');
select pg_temp.assert((select count(*) from public.landing_experiment_assignments)=0);
select pg_temp.assert(public.landing_experiment_visit('assign','a2000000-0000-4000-8000-000000000001','/auckland-outdoor-living',repeat('t',64),'wrong','11001','11002') is null);
select pg_temp.assert(public.landing_experiment_visit('assign','a2000000-0000-4000-8000-000000000001','/auckland-outdoor-living',repeat('t',64),'11003','11001','11002')->>'arm'='challenger');
select pg_temp.assert(public.landing_experiment_visit('expose','a2000000-0000-4000-8000-000000000001','/auckland-outdoor-living',repeat('x',64))='{"control":{}}');
select pg_temp.assert((select exposed_at is null from public.landing_experiment_assignments limit 1));
select public.landing_experiment_visit('expose','a2000000-0000-4000-8000-000000000001','/auckland-outdoor-living',repeat('t',64));
select public.landing_experiment_visit('expose','a2000000-0000-4000-8000-000000000001','/auckland-outdoor-living',repeat('t',64));
select pg_temp.assert((select sum((value->>'exposures')::int) from jsonb_array_elements(public.landing_experiment_counts('a1000000-0000-4000-8000-000000000001')))=1);
do $$declare first record;again record;submission uuid:=gen_random_uuid();payload jsonb;begin
 -- This fixture is one transaction. Represent the earlier, separate exposure HTTP transaction.
 update public.landing_experiment_assignments set created_at=now()-interval '2 hours',exposed_at=now()-interval '1 hour' where id='a2000000-0000-4000-8000-000000000001';
 payload:=jsonb_build_object('enquiryType','residential','name','Experiment fixture','email','experiment@example.invalid','phone','','phoneRaw','','suburb','Albany','files','[]'::jsonb,'page','/auckland-outdoor-living','message','A residential pergola in Auckland.',
 'rawPayload','{"requestType":"project-discussion","attribution":{"consent":{"analytics":true,"marketing":true}}}'::jsonb);
 select * into first from public.marketing_experiment_intake(submission,'',payload,'a2000000-0000-4000-8000-000000000001');
 select * into again from public.marketing_experiment_intake(submission,'',payload||'{"message":"changed retry"}','a2000000-0000-4000-8000-000000000001');
 perform pg_temp.assert(again.already_existed and again.enquiry_request_id=first.enquiry_request_id);
 perform pg_temp.assert((select count(*) from public.landing_experiment_enquiries where enquiry_id=first.enquiry_request_id)=1);
 perform pg_temp.assert((select count(*) from public.email_outbox)=0);
end$$;
update public.landing_experiments set ends_at=clock_timestamp()-interval '1 hour';
select pg_temp.assert(public.landing_experiment_visit('assign',gen_random_uuid(),'/auckland-outdoor-living',repeat('t',64),'11003','11001','11002')='{"control":{}}');
select pg_temp.assert(public.landing_experiment_visit('assign','a2000000-0000-4000-8000-000000000001','/auckland-outdoor-living',repeat('t',64),'11003','11001','11002')->>'arm'='challenger');
select public.landing_experiment_visit('revoke','a2000000-0000-4000-8000-000000000001','/auckland-outdoor-living',repeat('t',64));
select pg_temp.assert((select sum((value->>'exposures')::int) from jsonb_array_elements(public.landing_experiment_counts('a1000000-0000-4000-8000-000000000001')))=0);
-- Technical rollback is allowed with no conversion/quality evidence.
select public.landing_experiment_command(repeat('b',64),gen_random_uuid(),'rollback','a1000000-0000-4000-8000-000000000001',jsonb_build_object('generation',generation,'candidateHash',repeat('c',64))) from public.landing_experiment_control;
select pg_temp.assert((select state='reverted' from public.landing_experiments));
select pg_temp.assert((select count(*) from public.landing_experiment_receipts)>=5);
-- Fixed-window conversion analysis, including zero-conversion harm and late leads.
update public.landing_experiments set ends_at=clock_timestamp()-interval '73 hours';
insert into public.landing_experiment_assignments(id,experiment,arm,ad,created_at,exposed_at)
 select md5('assignment:'||g)::uuid,'a1000000-0000-4000-8000-000000000001',case when g<=500 then 'control' else 'challenger' end,'11003',clock_timestamp()-interval '20 days',clock_timestamp()-interval '20 days' from generate_series(1,1000)g;
insert into public.enquiry_requests(id,enquiry_type)select md5('enquiry:'||g)::uuid,'residential' from generate_series(1,40)g;
insert into public.landing_experiment_enquiries(enquiry_id,assignment,created_at)
 select md5('enquiry:'||g)::uuid,md5('assignment:'||case when g<=6 then g else g+494 end)::uuid,clock_timestamp()-interval '100 hours' from generate_series(1,18)g;
select pg_temp.assert(public.landing_experiment_decision('a1000000-0000-4000-8000-000000000001')='inconclusive');
delete from public.landing_experiment_enquiries;
insert into public.landing_experiment_enquiries(enquiry_id,assignment,created_at)
 select md5('enquiry:'||g)::uuid,md5('assignment:'||g)::uuid,clock_timestamp()-interval '100 hours' from generate_series(1,20)g;
select pg_temp.assert(public.landing_experiment_decision('a1000000-0000-4000-8000-000000000001')='revert');
insert into public.landing_experiment_enquiries(enquiry_id,assignment,created_at)
 select md5('enquiry:'||g)::uuid,md5('assignment:'||(g+500))::uuid,clock_timestamp() from generate_series(21,40)g;
select pg_temp.assert(public.landing_experiment_decision('a1000000-0000-4000-8000-000000000001')='revert');
select pg_temp.assert((select sum((value->>'enquiries')::int) from jsonb_array_elements(public.landing_experiment_counts('a1000000-0000-4000-8000-000000000001')))=20);
-- Retention applies to anonymous rendering and preserves an earlier slot winner.
delete from public.landing_experiment_enquiries;
insert into public.landing_experiment_enquiries(enquiry_id,assignment,created_at)
 select md5('enquiry:'||g)::uuid,md5('assignment:'||(g+500))::uuid,clock_timestamp()-interval '100 hours' from generate_series(1,20)g;
update public.landing_experiment_control set control_outdoor='{"support":"estimate"}';
update public.landing_experiments set state='live',control_copy='{"support":"estimate"}',created_at=clock_timestamp()-interval '20 days';
select public.landing_experiment_command(repeat('b',64),gen_random_uuid(),'evaluate','a1000000-0000-4000-8000-000000000001',jsonb_build_object('generation',generation,'candidateHash',repeat('c',64),'decision','retain','qualityGuard','pass','qualityHash',repeat('f',64))) from public.landing_experiment_control;
select pg_temp.assert(public.landing_experiment_public_control('/auckland-outdoor-living',repeat('t',64))='{"support":"estimate","design":"explore"}'::jsonb);
select pg_temp.assert(public.landing_experiment_public_control('/acrylic-roof-pergolas-auckland',repeat('t',64))='{}'::jsonb);
select public.landing_experiment_command(repeat('b',64),gen_random_uuid(),'prepare','a1000000-0000-4000-8000-000000000003',jsonb_build_object('generation',generation,'candidateHash',repeat('d',64),'evidenceHash',repeat('e',64),'template',repeat('t',64),'path','/auckland-outdoor-living','copy','project','generator','resp_second','minimumExposures',100,'durationDays',14)) from public.landing_experiment_control;
select pg_temp.assert((select control_copy='{"support":"estimate","design":"explore"}'::jsonb from public.landing_experiments where id='a1000000-0000-4000-8000-000000000003'));
rollback;
