begin;
create or replace function pg_temp.assert(ok boolean) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'Layout assertion failed';end if;end$$;
insert into public.landing_experiment_control(binding,template,campaign,adset,ads,admitted_until,enabled,publishing)
 values(repeat('b',64),repeat('t',64),'11001','11002',array['11003'],'infinity',true,true);
insert into public.landing_experiments(id,path,template,copy,control_copy,state,candidate_hash,evidence_hash,generator,minimum_exposures,duration_days,ends_at,lease_until)
 values('d1000000-0000-4000-8000-000000000001','/acrylic-roof-pergolas-auckland',repeat('t',64),'action-first','{}','live',repeat('c',64),repeat('e',64),'resp_fixture',100,14,clock_timestamp()+interval '14 days',clock_timestamp()+interval '5 hours');
do $$declare i integer;id uuid;r jsonb;begin
 for i in 1..12 loop
  id:=md5('layout:'||i)::uuid;
  r:=public.landing_experiment_visit('assign',id,'/acrylic-roof-pergolas-auckland',repeat('t',64),'11003','11001','11002');
  perform public.landing_experiment_visit('expose',id,'/acrylic-roof-pergolas-auckland',repeat('t',64),p_display=>jsonb_build_object('mobile',i<=6,'actionFirst',i<=6 and r->>'arm'='challenger'));
  -- A later resized/repeated exposure cannot rewrite the original cohort.
  perform public.landing_experiment_visit('expose',id,'/acrylic-roof-pergolas-auckland',repeat('t',64),p_display=>'{"mobile":false,"actionFirst":false}');
 end loop;
 perform pg_temp.assert((select count(*) from public.landing_experiment_assignments where mobile)=6);
 perform pg_temp.assert((select count(*) from public.landing_experiment_assignments where action_first and arm='control')=0);
 perform pg_temp.assert((select sum((value->>'exposures')::int) from jsonb_array_elements(public.landing_experiment_counts('d1000000-0000-4000-8000-000000000001')))=12);
 perform pg_temp.assert((select sum((value->>'mobileExposures')::int) from jsonb_array_elements(public.landing_experiment_counts('d1000000-0000-4000-8000-000000000001')))=6);
 begin
  update public.landing_experiments set path='/auckland-outdoor-living';raise exception 'Wrong route accepted';
 exception when check_violation then null;end;
end$$;
rollback;
