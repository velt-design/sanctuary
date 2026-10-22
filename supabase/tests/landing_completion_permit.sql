-- Called from the genuine four-probe native chain, in a rollback-only fixture.
create or replace function pg_temp.exercise_completion(e uuid,p uuid)returns void language plpgsql as $$
declare prior landing_experiment_receipts;original jsonb;previous jsonb;proof jsonb;oldrows jsonb;oldprobes jsonb;oldreceipts jsonb;
 derivative uuid:=gen_random_uuid();probe uuid:=gen_random_uuid();audit uuid:=gen_random_uuid();preparecmd uuid:=gen_random_uuid();probecmd uuid:=gen_random_uuid();common jsonb;payload jsonb;candidate text;result jsonb;statement text;begin
 if (select path from landing_experiments where id=e)<>'/acrylic-roof-pergolas-auckland' then return;end if;
 begin
  select to_jsonb(x)into original from landing_experiments x where id=e;
  select to_jsonb(c)into previous from landing_experiment_control c;
  perform landing_experiment_probe_visit(p,'assign',original->>'path',previous->>'template',(previous->>'generation')::bigint,original->>'candidate_hash','prepare',false,'11003','11001','11002');
  perform landing_experiment_probe_visit(p,'expose',original->>'path',previous->>'template',(previous->>'generation')::bigint,original->>'candidate_hash','prepare',true);
  update landing_experiment_probes set expires_at=clock_timestamp()-interval '1 second'where id=p;
  select * into prior from landing_experiment_receipts where experiment=e and stage='prepare_successor_recovery';
  select jsonb_agg(to_jsonb(x)order by id)into oldprobes from landing_experiment_probes x;
  select jsonb_agg(to_jsonb(x)order by command)into oldreceipts from landing_experiment_receipts x;
  -- Exact operator transaction: locks, current control transition, ordinary
  -- terminal command, immutable linked receipt, ordinary prepare. No publication.
  perform pg_advisory_xact_lock(819421,1);perform 1 from landing_experiment_control for update;
  update landing_experiment_control set template=repeat('f',64);
  perform landing_experiment_command(previous->>'binding',gen_random_uuid(),'rollback',e,jsonb_build_object('generation',(previous->>'generation')::bigint+1,'candidateHash',original->>'candidate_hash','reason','guard'));
  select to_jsonb(x)into oldrows from landing_experiments x where id=e;
  candidate:=encode(sha256(convert_to('{"path":'||to_json(original->>'path')::text||',"copy":'||to_json(original->>'copy')::text||',"template":'||to_json(repeat('f',64))::text||',"evidenceHash":'||to_json(original->>'evidence_hash')::text||'}','UTF8')),'hex');
  select jsonb_build_object('kind','prepare_completion','admission',prior.result->>'admission','originalRequest',gen_random_uuid(),'originalStep',prior.result->>'originalStep',
   'originalProbe',p,'originalProbeHash',(select encode(sha256(convert_to(to_jsonb(x)::text,'UTF8')),'hex')from landing_experiment_probes x where id=p),
   'priorReceiptHash',encode(sha256(convert_to(to_jsonb(prior)::text,'UTF8')),'hex'),'originalExperiment',original,'previousControl',previous,
   'rollbackReceiptHash',(select encode(sha256(convert_to(to_jsonb(x)::text,'UTF8')),'hex')from landing_experiment_receipts x where experiment=e and stage='rollback'),
   'newExperiment',derivative,'newProbe',probe,'template',c.template,'candidateHash',candidate,'generation',c.generation,'controlHash',encode(sha256(convert_to(to_jsonb(c)::text,'UTF8')),'hex'),
   'expiresAt',clock_timestamp()+interval '30 minutes','correction',repeat('a',40),'nextAttempt',5,'providerTerminalHash',repeat('b',64),'geometryHash',repeat('c',64),'originalExpiry',prior.result->>'expiresAt')into proof from landing_experiment_control c;
  insert into landing_experiment_receipts(command,experiment,stage,request_hash,result)values(audit,e,'prepare_completion',encode(sha256(convert_to(proof::text,'UTF8')),'hex'),proof);
  perform pg_temp.assert(landing_completion_expiry(derivative,probe)is not null);
  payload:=jsonb_build_object('generation',(proof->>'generation')::bigint,'template',proof->>'template','candidateHash',candidate,'evidenceHash',original->>'evidence_hash','path',original->>'path','copy',original->>'copy','generator',original->>'generator','minimumExposures',100,'durationDays',14);
  foreach statement in array array[
   'update landing_experiment_control set enabled=false','update landing_experiment_control set publishing=true','update landing_experiment_control set template=repeat(''1'',64)',
   format('update landing_experiment_probes set assignments=2 where id=%L',p),format('update landing_experiment_probes set reloads=1 where id=%L',p),
   format('update landing_experiment_probes set expires_at=clock_timestamp()+interval ''1 minute''where id=%L',p),
   format('update landing_experiment_probes set verified_at=clock_timestamp()where id=%L',p),
   format('update landing_experiments set generator=''resp_different''where id=%L',e),
   'update landing_experiment_receipts set result=jsonb_set(result,''{nextAttempt}'',''6'')where stage=''prepare_completion''',
   'update landing_experiment_receipts set result=jsonb_set(result,''{expiresAt}'',to_jsonb(clock_timestamp()+interval ''1 hour''))where stage=''prepare_completion'''
  ]loop begin
   execute statement;perform pg_temp.assert(landing_completion_expiry(derivative,probe)is null);
   perform pg_temp.reject(format('select landing_experiment_command(%L,gen_random_uuid(),''prepare'',%L,%L::jsonb)',previous->>'binding',derivative,payload));
   raise exception using errcode='P0002',message='Restore synthetic drift';exception when no_data_found then null;end;end loop;
  perform pg_temp.reject(format('select landing_experiment_command(%L,gen_random_uuid(),''prepare'',%L,%L::jsonb)',previous->>'binding',derivative,payload||'{"generator":"resp_other"}'));
  result:=landing_experiment_command(previous->>'binding',preparecmd,'prepare',derivative,payload);
  perform pg_temp.assert(landing_experiment_command(previous->>'binding',preparecmd,'prepare',derivative,payload)=result);
  perform pg_temp.assert((select experiment=derivative and lane='landing'from acquisition_experiment_reservation));
  perform pg_temp.assert((select count(*)=1 from landing_experiments where state in('candidate','reviewed','ready','live')));
  common:=jsonb_build_object('generation',(proof->>'generation')::bigint,'template',proof->>'template','candidateHash',candidate,'probe',probe,'mode','prepare');
  result:=landing_experiment_command(previous->>'binding',probecmd,'probe',derivative,common);
  perform pg_temp.assert(result->>'probe'=probe::text);
  perform pg_temp.assert(landing_experiment_command(previous->>'binding',probecmd,'probe',derivative,common)=result);
  perform pg_temp.reject(format('select landing_experiment_command(%L,gen_random_uuid(),''probe'',%L,%L::jsonb)',previous->>'binding',derivative,common||jsonb_build_object('probe',gen_random_uuid())));
  perform pg_temp.assert((select count(*)=5 from landing_experiment_probes));
  perform pg_temp.assert((select jsonb_agg(to_jsonb(x)order by id)=oldprobes from landing_experiment_probes x where id<>probe));
  perform pg_temp.assert((select to_jsonb(x)=oldrows from landing_experiments x where id=e));
  perform pg_temp.assert((select jsonb_agg(to_jsonb(x)order by command)=oldreceipts from landing_experiment_receipts x where command in(select (value->>'command')::uuid from jsonb_array_elements(oldreceipts))));
  perform landing_experiment_probe_visit(probe,'assign',original->>'path',proof->>'template',(proof->>'generation')::bigint,candidate,'prepare',false,'11003','11001','11002');
  perform landing_experiment_probe_visit(probe,'expose',original->>'path',proof->>'template',(proof->>'generation')::bigint,candidate,'prepare',true);
  perform landing_experiment_probe_visit(probe,'assign',original->>'path',proof->>'template',(proof->>'generation')::bigint,candidate,'prepare',true,'11003','11001','11002');
  perform pg_temp.assert((select assignments=2 and exposures=1 and reloads=1 from landing_experiment_probes where id=probe));
  perform pg_temp.assert((select count(*)=0 from landing_experiment_assignments));
  -- A failure closes the derivative separately, never the previous terminal row.
  perform landing_experiment_command(previous->>'binding',gen_random_uuid(),'rollback',derivative,jsonb_build_object('generation',(proof->>'generation')::bigint,'candidateHash',candidate,'reason','guard'));
  perform pg_temp.assert(not exists(select 1 from acquisition_experiment_reservation));
  perform pg_temp.assert((select to_jsonb(x)=oldrows from landing_experiments x where id=e));
  raise exception using errcode='P0002',message='Restore earlier native chain';
 exception when no_data_found then null;end;
end$$;
