-- Called with the genuine native three-probe/replacement history, then rolled
-- back internally so the earlier accepted proof also executes unchanged.
create or replace function pg_temp.exercise_render_successor(e uuid,p uuid,common jsonb) returns void language plpgsql as $$
declare proof jsonb;old public.landing_experiment_receipts;newprobe uuid:=gen_random_uuid();audit uuid:=gen_random_uuid();cmd uuid:=gen_random_uuid();result jsonb;before_rows jsonb;statement text;begin
 begin
  update landing_experiment_probes set expires_at=clock_timestamp()-interval '1 second' where id=p;
  select x.* into old from landing_experiment_receipts x where x.stage='prepare_packaging_recovery' and x.result->>'newExperiment'=e::text;
  select jsonb_build_array((select jsonb_agg(to_jsonb(x)order by id)from landing_experiments x),(select jsonb_agg(to_jsonb(x)order by id)from landing_experiment_probes x),(select jsonb_agg(to_jsonb(x)order by command)from landing_experiment_receipts x))into before_rows;
  select jsonb_build_object('kind','prepare_successor_recovery','admission',old.result->>'admission','originalRequest',gen_random_uuid(),'originalStep',old.result->>'originalStep',
   'originalProbe',p,'originalProbeHash',(select encode(sha256(convert_to(to_jsonb(x)::text,'UTF8')),'hex')from landing_experiment_probes x where id=p),'priorRecoveryHash',encode(sha256(convert_to(to_jsonb(old)::text,'UTF8')),'hex'),
   'newProbe',newprobe,'candidateHash',old.result->>'candidateHash','template',c.template,'binding',c.binding,'generation',c.generation,'controlHash',encode(sha256(convert_to(to_jsonb(c)::text,'UTF8')),'hex'),
   'expiresAt',old.result->>'expiresAt','experimentHash',(select encode(sha256(convert_to(to_jsonb(x)::text,'UTF8')),'hex')from landing_experiments x where id=e),'correction',repeat('a',40),'nextAttempt',4)into proof from landing_experiment_control c;
  common:=common||jsonb_build_object('probe',newprobe);
  insert into landing_experiment_receipts(command,experiment,stage,request_hash,result)values(audit,e,'prepare_successor_recovery',encode(sha256(convert_to(proof::text,'UTF8')),'hex'),proof);
  perform pg_temp.assert(landing_packaging_recovery_expiry(e,common)is not null);
  foreach statement in array array[
   'update landing_experiment_control set enabled=false','update landing_experiment_control set publishing=true','delete from acquisition_experiment_reservation',
   format('update landing_experiments set state=''reverted'' where id=%L',e),format('update landing_experiments set reviewer=''resp_other'' where id=%L',e),
   format('update landing_experiment_probes set assignments=1 where id=%L',p),format('update landing_experiment_probes set exposures=1 where id=%L',p),format('update landing_experiment_probes set reloads=1 where id=%L',p),
   format('update landing_experiment_probes set enrolled_at=clock_timestamp() where id=%L',p),format('update landing_experiment_probes set verified_at=clock_timestamp() where id=%L',p),
   format('update landing_experiment_probes set expires_at=clock_timestamp()+interval ''1 minute'' where id=%L',p),
   format('update landing_experiment_probes set assignments=1 where id=%L',old.result->>'priorProbe'),
   'update landing_experiment_receipts set result=result||jsonb_build_object(''nextAttempt'',5) where stage=''prepare_successor_recovery''',
   'update landing_experiment_receipts set result=result||jsonb_build_object(''expiresAt'',clock_timestamp()+interval ''1 day'') where stage=''prepare_successor_recovery''',
   'update landing_experiment_receipts set request_hash=repeat(''f'',64) where stage=''prepare_successor_recovery'''
  ]loop
   begin execute statement;perform pg_temp.assert(landing_packaging_recovery_expiry(e,common)is null);
    perform pg_temp.reject(format('select landing_experiment_command(repeat(''b'',64),%L,''probe'',%L,%L::jsonb)',cmd,e,common));
    raise exception using errcode='P0002',message='Restore synthetic drift';exception when no_data_found then null;end;
  end loop;
  result:=landing_experiment_command(repeat('b',64),cmd,'probe',e,common);
  perform pg_temp.assert(result->>'probe'=newprobe::text);
  perform pg_temp.assert(landing_experiment_command(repeat('b',64),cmd,'probe',e,common)=result);
  perform pg_temp.assert((select count(*)=4 from landing_experiment_probes));
  perform pg_temp.assert((select expires_at<=(proof->>'expiresAt')::timestamptz from landing_experiment_probes where id=newprobe));
  perform pg_temp.assert(before_rows=jsonb_build_array((select jsonb_agg(to_jsonb(x)order by id)from landing_experiments x),(select jsonb_agg(to_jsonb(x)order by id)from landing_experiment_probes x where id<>newprobe),(select jsonb_agg(to_jsonb(x)order by command)from landing_experiment_receipts x where command not in(audit,cmd))));
  perform pg_temp.reject(format('select landing_experiment_command(repeat(''b'',64),gen_random_uuid(),''probe'',%L,%L::jsonb)',e,common||jsonb_build_object('probe',gen_random_uuid())));
  perform landing_experiment_probe_visit(newprobe,'assign','/auckland-outdoor-living',repeat('t',64),(common->>'generation')::bigint,repeat('c',64),'prepare',false,'11003','11001','11002');
  perform landing_experiment_probe_visit(newprobe,'expose','/auckland-outdoor-living',repeat('t',64),(common->>'generation')::bigint,repeat('c',64),'prepare',true);
  perform landing_experiment_probe_visit(newprobe,'assign','/auckland-outdoor-living',repeat('t',64),(common->>'generation')::bigint,repeat('c',64),'prepare',true,'11003','11001','11002');
  perform pg_temp.assert((select assignments=2 and exposures=1 and reloads=1 from landing_experiment_probes where id=newprobe));
  perform pg_temp.assert((select count(*)=0 from landing_experiment_assignments));
  raise exception using errcode='P0002',message='Restore earlier native proof';
 exception when no_data_found then null;end;
end$$;
