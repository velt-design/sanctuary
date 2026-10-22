-- Synthetic native regression: original records keep their raw representations.
begin;
create function pg_temp.identity_assert(ok boolean) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'Copy identity assertion failed';end if;end$$;
create function pg_temp.identity_prepare(p_copy text) returns jsonb language plpgsql as $$
declare c public.landing_experiment_control;begin
 select * into c from public.landing_experiment_control;
 return public.landing_experiment_command(repeat('b',64),gen_random_uuid(),'prepare',gen_random_uuid(),jsonb_build_object(
  'generation',c.generation,'template',c.template,'path','/acrylic-roof-pergolas-auckland','copy',p_copy,
  'candidateHash',repeat('d',64),'evidenceHash',repeat('e',64),'generator','resp_identity','minimumExposures',100,'durationDays',14));
end$$;
create function pg_temp.identity_reject(p_copy text,p_message text) returns void language plpgsql as $$
declare actual text;begin
 begin perform pg_temp.identity_prepare(p_copy);exception when others then
  get stacked diagnostics actual=message_text;
  if actual=p_message then return;end if;raise exception 'Wrong rejection: %',actual;
 end;raise exception 'Repeated rendered copy accepted';
end$$;
update public.landing_experiments set state='rejected',created_at=clock_timestamp()-interval '90 days';
insert into public.landing_experiment_control(binding,template,campaign,adset,ads,admitted_until,enabled,publishing)
 values(repeat('b',64),repeat('a',64),'11001','11002',array['11003'],'infinity',true,false)
 on conflict(singleton) do update set binding=excluded.binding,template=excluded.template,campaign=excluded.campaign,adset=excluded.adset,ads=excluded.ads,admitted_until=excluded.admitted_until,enabled=true,publishing=false,control_acrylic='{}';
do $$declare pair record; i integer:=0;template_key text;prior uuid;before_row jsonb;candidate jsonb;state jsonb;begin
 for pair in select * from(values
  ('explore','copy:design:Explore your pergola','{}'::jsonb,'{}'::jsonb),
  ('copy:design:Explore your pergola','explore','{}','{}'),
  ('estimate','copy:support:Choose a size and roof. See an installed estimate.','{}','{}'),
  ('copy:support:Choose a size and roof. See an installed estimate.','estimate','{}','{}'),
  ('copy:design:Plan your space','copy:design:Plan your space','{}','{}'),
  ('estimate','copy:support:Choose a size and roof. See an installed estimate.','{"design":"explore"}','{"design":"copy:design:Explore your pergola"}'),
  ('project','project','{}','{"design":"copy:design:Design your pergola"}')
 )p(old_copy,new_copy,old_control,new_control) loop
  i:=i+1;template_key:=encode(sha256(convert_to(i::text,'UTF8')),'hex');prior:=gen_random_uuid();
  update public.landing_experiment_control set template=template_key,control_acrylic=pair.new_control where singleton;
  insert into public.landing_experiments(id,path,template,copy,control_copy,state,candidate_hash,evidence_hash,generator,minimum_exposures,duration_days,created_at)
   values(prior,'/acrylic-roof-pergolas-auckland',template_key,pair.old_copy,pair.old_control,'inconclusive',repeat('c',64),repeat('e',64),'resp_prior',100,14,now()-interval '80 days');
  select to_jsonb(e) into before_row from public.landing_experiments e where id=prior;
  perform pg_temp.identity_assert(public.landing_copy_identity(pair.old_copy)=public.landing_copy_identity(pair.new_copy));
  state:=public.landing_experiment_command(repeat('b',64),gen_random_uuid(),'read',null);
  perform pg_temp.identity_assert(state->'excluded'->'/acrylic-roof-pergolas-auckland'?public.landing_copy_identity(pair.new_copy));
  perform pg_temp.identity_reject(pair.new_copy,'Previously evaluated candidate');
  candidate:=pg_temp.identity_prepare('copy:design:Plan your outdoor space');
  perform pg_temp.identity_assert(candidate->>'state'='candidate');
  update public.landing_experiments set state='rejected',created_at=now()-interval '8 days' where id=(candidate->>'experiment')::uuid;
  perform pg_temp.identity_assert((select to_jsonb(e)=before_row from public.landing_experiments e where id=prior));
 end loop;
 -- An arbitrarily long unrelated result tail does not erase durable exclusions.
 insert into public.landing_experiments(id,path,template,copy,control_copy,state,candidate_hash,evidence_hash,generator,minimum_exposures,duration_days,created_at)
  select gen_random_uuid(),'/auckland-outdoor-living',repeat('f',64),'explore','{}','inconclusive',repeat('c',64),repeat('e',64),'resp_tail',100,14,now()-interval '9 days' from generate_series(1,160);
 perform pg_temp.identity_reject('project','Previously evaluated candidate');
 state:=public.landing_experiment_command(repeat('b',64),gen_random_uuid(),'read',null);
 perform pg_temp.identity_assert(state->'excluded'->'/acrylic-roof-pergolas-auckland'?'project');
 -- Retained/current text is a no-op regardless of the other representation.
 update public.landing_experiment_control set template=repeat('9',64),control_acrylic='{"design":"explore"}' where singleton;
 perform pg_temp.identity_reject('copy:design:Explore your pergola','Unchanged text');
 update public.landing_experiment_control set control_acrylic='{"design":"copy:design:Explore your pergola"}' where singleton;
 perform pg_temp.identity_reject('explore','Unchanged text');
 perform pg_temp.identity_assert(public.landing_copy_identity('copy:design:Plan your space')<>public.landing_copy_identity('copy:help:Plan your space'));
 candidate:=pg_temp.identity_prepare('copy:help:Plan your space');perform pg_temp.identity_assert(candidate->>'state'='candidate');
end$$;
select pg_temp.identity_assert(not has_function_privilege(role_name,'public.landing_copy_identity(text)','EXECUTE')
 and not has_function_privilege(role_name,'public.landing_control_identity(text,jsonb)','EXECUTE')) from unnest(array['anon','authenticated','service_role']) role_name;
rollback;
