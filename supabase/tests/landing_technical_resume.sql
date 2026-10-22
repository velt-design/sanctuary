-- Synthetic continuation of the genuine native completion chain. Every mutation
-- rolls back; no public probe, identity, customer row or model is used.
create or replace function pg_temp.exercise_technical_resume(e uuid,p uuid)returns void language plpgsql as $$
declare prior landing_experiment_receipts;original jsonb;proof jsonb;oldrow jsonb;oldprobe jsonb;previousControl jsonb;candidate text;before_rows jsonb;binding text;generation bigint;
 target uuid;fresh uuid;receipt uuid;command uuid;payload jsonb;result jsonb;statement text;ordinal integer;
begin
 begin
  select c.binding,c.generation into binding,generation from landing_experiment_control c;
  -- Real past timestamps, no fake clock. Preserve them across the newly funded
  -- continuation; this entire synthetic subtransaction is rolled back.
  update landing_experiments set created_at=created_at-interval '1 day';
  update landing_experiment_probes set created_at=created_at-interval '1 day',expires_at=expires_at-interval '1 day';
  update landing_experiment_receipts set recorded_at=recorded_at-interval '1 day';
  update landing_experiment_receipts x set result=jsonb_set(x.result,'{expiresAt}',to_jsonb((x.result->>'expiresAt')::timestamptz-interval '1 day'))where stage='prepare_completion';
  update landing_experiment_receipts x set request_hash=encode(sha256(convert_to(x.result::text,'UTF8')),'hex')where stage='prepare_completion';
  for ordinal in 6..9 loop
   select to_jsonb(x)into original from landing_experiments x where id=e;
   if ordinal=6 then update landing_experiment_probes set assignments=1,exposures=1 where id=p;else
   perform landing_experiment_probe_visit(p,'assign',original->>'path',original->>'template',generation,original->>'candidate_hash','prepare',false,'11003','11001','11002');
   perform landing_experiment_probe_visit(p,'expose',original->>'path',original->>'template',generation,original->>'candidate_hash','prepare',true);end if;
   update landing_experiment_probes set expires_at=clock_timestamp()-interval '1 second'where id=p;
   select to_jsonb(x)into oldprobe from landing_experiment_probes x where id=p;
   select x.* into prior from landing_experiment_receipts x where x.result->>'newProbe'=p::text and x.stage in('prepare_completion','technical_resume');
   select to_jsonb(c)into previousControl from landing_experiment_control c;
   target:=case when ordinal in(7,8) then gen_random_uuid()else e end;fresh:=gen_random_uuid();receipt:=gen_random_uuid();command:=gen_random_uuid();
   if ordinal in(7,8)then update landing_experiment_control set template=repeat(ordinal::text,64);select c.generation into generation from landing_experiment_control c;end if;
   if target<>e then perform landing_experiment_command(binding,gen_random_uuid(),'rollback',e,jsonb_build_object('generation',generation,'candidateHash',original->>'candidate_hash','reason','guard'));end if;
   select to_jsonb(x)into oldrow from landing_experiments x where id=e;
   select encode(sha256(convert_to('{"path":'||to_json(original->>'path')::text||',"copy":'||to_json(original->>'copy')::text||',"template":'||to_json(c.template)::text||',"evidenceHash":'||to_json(original->>'evidence_hash')::text||'}','UTF8')),'hex')into candidate from landing_experiment_control c;
   select jsonb_build_object('kind','technical_resume','admission',prior.result->>'admission','predecessor',gen_random_uuid(),'predecessorHash',repeat('2',64),
    'originalStep',gen_random_uuid(),'originalStepHash',repeat('3',64),'originalProbe',p,'originalProbeHash',encode(sha256(convert_to(oldprobe::text,'UTF8')),'hex'),
    'priorReceipt',prior.command,'priorReceiptHash',encode(sha256(convert_to(to_jsonb(prior)::text,'UTF8')),'hex'),
    'previousControl',previousControl,'originalExperiment',original,'experimentHash',encode(sha256(convert_to(original::text,'UTF8')),'hex'),
    'newExperiment',target,'newProbe',fresh,'template',c.template,'candidateHash',candidate,'generation',c.generation,'controlHash',encode(sha256(convert_to(to_jsonb(c)::text,'UTF8')),'hex'),
    'expiresAt',least(clock_timestamp()+interval '30 minutes',date_trunc('day',clock_timestamp()at time zone 'Australia/Sydney')at time zone 'Australia/Sydney'+interval '1 day'-interval '1 second'),
    'correction',repeat(ordinal::text,40),'nextAttempt',ordinal,
    'funding',jsonb_build_object('day',to_char(clock_timestamp()at time zone 'Australia/Sydney','YYYY-MM-DD'),'receiptHash',repeat('9',64),'maximumModelUsd',.02224),
    'rollbackReceiptHash',case when target<>e then(select encode(sha256(convert_to(to_jsonb(x)::text,'UTF8')),'hex')from landing_experiment_receipts x where experiment=e and stage='rollback'order by recorded_at desc limit 1)else null end)
    into proof from landing_experiment_control c;
   insert into landing_experiment_receipts(command,experiment,stage,request_hash,result)values(receipt,e,'technical_resume',encode(sha256(convert_to(proof::text,'UTF8')),'hex'),proof);
   if ordinal=9 then perform pg_temp.assert(landing_technical_resume_expiry(target,fresh)is null);exit;end if;
   perform pg_temp.assert(landing_technical_resume_expiry(target,fresh)is not null);
   foreach statement in array array[
    'update landing_experiment_control set enabled=false','update landing_experiment_control set publishing=true','update landing_experiment_control set template=repeat(''1'',64)',
    format('update landing_experiments set reviewer=''resp_other''where id=%L',e),
    format('update landing_experiment_probes set enrolled_at=clock_timestamp()where id=%L',p),
    format('update landing_experiment_probes set assignments=assignments+1 where id=%L',p),
    format('update landing_experiment_probes set expires_at=clock_timestamp()+interval ''1 minute''where id=%L',p),
    format('update landing_experiment_receipts set result=jsonb_set(result,''{funding,day}'',to_jsonb(to_char(clock_timestamp()-interval ''1 day'',''YYYY-MM-DD'')))where command=%L',receipt),
    format('update landing_experiment_receipts set result=jsonb_set(result,''{expiresAt}'',to_jsonb(clock_timestamp()+interval ''1 hour''))where command=%L',receipt)
   ]loop begin execute statement;perform pg_temp.assert(landing_technical_resume_expiry(target,fresh)is null);raise exception using errcode='P0002',message='Restore drift';exception when no_data_found then null;end;end loop;
   perform pg_temp.reject(format('insert into landing_experiment_receipts(command,experiment,stage,request_hash,result)values(gen_random_uuid(),%L,''technical_resume'',%L,%L)',e,repeat('0',64),proof));
   if target<>e then
    payload:=jsonb_build_object('generation',generation,'template',proof->>'template','candidateHash',candidate,'evidenceHash',original->>'evidence_hash','path',original->>'path','copy',original->>'copy','generator',original->>'generator','minimumExposures',100,'durationDays',14);
    result:=landing_experiment_command(binding,command,'prepare',target,payload);
    perform pg_temp.assert(landing_experiment_command(binding,command,'prepare',target,payload)=result);
    perform pg_temp.assert((select to_jsonb(x)=oldrow from landing_experiments x where id=e));
   end if;
   command:=gen_random_uuid();payload:=jsonb_build_object('generation',generation,'template',proof->>'template','candidateHash',candidate,'probe',fresh,'mode','prepare');
   result:=landing_experiment_command(binding,command,'probe',target,payload);
   perform pg_temp.assert(result->>'probe'=fresh::text);
   perform pg_temp.assert(landing_experiment_command(binding,command,'probe',target,payload)=result);
   perform pg_temp.reject(format('select landing_experiment_command(%L,gen_random_uuid(),''probe'',%L,%L::jsonb)',binding,target,payload||jsonb_build_object('probe',gen_random_uuid())));
   perform pg_temp.assert((select to_jsonb(x)=oldprobe from landing_experiment_probes x where id=p));
   perform pg_temp.assert((select count(*)=1 from acquisition_experiment_reservation));
   perform pg_temp.assert((select count(*)=0 from landing_experiment_assignments));
   e:=target;p:=fresh;
  end loop;
  raise exception using errcode='P0002',message='Restore full completion chain';
 exception when no_data_found then null;end;
end$$;
