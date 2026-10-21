begin;
create or replace function pg_temp.assert(ok boolean) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'Learning assertion failed';end if;end$$;
insert into public.landing_experiment_control(binding,template,campaign,adset,ads,admitted_until,enabled)
 values(repeat('b',64),repeat('a',64),'11001','11002',array['11003'],'infinity',true);
-- Much more terminal history than any bounded Velt display. Repeated keys remain
-- a finite set, and all three non-retained outcomes are authoritative.
insert into public.landing_experiments(id,path,template,copy,control_copy,state,candidate_hash,evidence_hash,generator,minimum_exposures,duration_days,created_at)
 select md5('old:'||g)::uuid,'/acrylic-roof-pergolas-auckland',repeat('a',64),
  (array['explore','project','estimate','action-first'])[1+g%4],'{}',
  (array['rejected','reverted','inconclusive'])[1+g%3],repeat('c',64),repeat('e',64),'resp_fixture',100,14,now()-interval '30 days'-g*interval '1 hour'
 from generate_series(1,160)g;
do $$declare r jsonb;p jsonb;choice text;begin
 r:=public.landing_experiment_command(repeat('b',64),gen_random_uuid(),'read',null);
 perform pg_temp.assert(r->'excluded'->'/acrylic-roof-pergolas-auckland'='["action-first","estimate","explore","project"]'::jsonb);
 perform pg_temp.assert(r->'excluded'->'/auckland-outdoor-living'='[]'::jsonb);
 p:=jsonb_build_object('generation',1,'template',repeat('a',64),'path','/acrylic-roof-pergolas-auckland','candidateHash',repeat('c',64),'evidenceHash',repeat('e',64),'generator','resp_fixture','minimumExposures',100,'durationDays',14);
 foreach choice in array array['explore','project','estimate','action-first'] loop
  begin
   perform public.landing_experiment_command(repeat('b',64),gen_random_uuid(),'prepare',gen_random_uuid(),p||jsonb_build_object('copy',choice));
   raise exception 'Historical candidate admitted';
  exception when raise_exception then
   if sqlerrm<>'Previously evaluated candidate' then raise;end if;
  end;
 end loop;
 -- The whole control baseline matters, not merely the slot being tested.
 update public.landing_experiment_control set control_acrylic='{"help":"project"}';
 r:=public.landing_experiment_command(repeat('b',64),gen_random_uuid(),'read',null);
 perform pg_temp.assert(r->'excluded'->'/acrylic-roof-pergolas-auckland'='[]'::jsonb);
 perform public.landing_experiment_command(repeat('b',64),gen_random_uuid(),'prepare',gen_random_uuid(),p||'{"copy":"explore"}');
 update public.landing_experiments set state='rejected',created_at=now()-interval '20 days' where state='candidate';
 -- A relevant template change also permits a fresh candidate on original copy.
 update public.landing_experiment_control set control_acrylic='{}',template=repeat('f',64);
 r:=public.landing_experiment_command(repeat('b',64),gen_random_uuid(),'read',null);
 perform pg_temp.assert(r->'excluded'->'/acrylic-roof-pergolas-auckland'='[]'::jsonb);
 perform public.landing_experiment_command(repeat('b',64),gen_random_uuid(),'prepare',gen_random_uuid(),p||jsonb_build_object('copy','explore','template',repeat('f',64),'generation',(r->>'generation')::bigint));
end$$;
rollback;
