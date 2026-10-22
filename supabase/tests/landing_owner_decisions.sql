-- All rows and identifiers are synthetic, in an owned disposable PostgreSQL cluster.
begin;
create function pg_temp.ok(value boolean,label text)returns void language plpgsql as $$begin if value is distinct from true then raise exception 'Owner decision: %',label;end if;end$$;
create function pg_temp.denied(statement text,label text)returns void language plpgsql as $$begin begin execute statement;exception when others then return;end;raise exception 'Accepted invalid owner decision: %',label;end$$;
insert into public.landing_experiment_control(binding,template,campaign,adset,ads,admitted_until,enabled,publishing)values(repeat('b',64),repeat('a',64),'11001','11002',array['11003'],'infinity',true,false);
-- A real rejected proposal is immutable evidence, not a delivered comparison.
insert into public.landing_experiments(id,path,template,copy,control_copy,state,candidate_hash,evidence_hash,generator,minimum_exposures,duration_days)
values('a1000000-0000-4000-8000-000000000001','/acrylic-roof-pergolas-auckland',repeat('f',64),'action-first','{}','rejected',repeat('c',64),repeat('e',64),'resp_original',100,14);
create function pg_temp.owner_payload(owner uuid,request uuid)returns jsonb language sql as $$
 select jsonb_build_object('owner',owner,'request',request,'generation',c.generation,'template',c.template,'controls',jsonb_build_object('/auckland-outdoor-living',c.control_outdoor,'/acrylic-roof-pergolas-auckland',c.control_acrylic),'prior',public.landing_decision_prior(),'correction',repeat('f',40),'day',to_char(clock_timestamp()at time zone 'Pacific/Auckland','YYYY-MM-DD'),'expiresAt',least(clock_timestamp()+interval '1 hour',date_trunc('day',clock_timestamp()at time zone 'Pacific/Auckland')at time zone 'Pacific/Auckland'+interval '1 day'-interval '1 second',date_trunc('day',clock_timestamp()at time zone 'Australia/Sydney')at time zone 'Australia/Sydney'+interval '1 day'-interval '1 second'),'funding',jsonb_build_object('day',to_char(clock_timestamp()at time zone 'Australia/Sydney','YYYY-MM-DD'),'receiptHash',repeat('a',64),'maximumModelUsd',.14308))from public.landing_experiment_control c
$$;
create function pg_temp.prepare_payload(copy text,decision uuid default null,request uuid default null)returns jsonb language sql as $$
 select jsonb_build_object('generation',generation,'template',template,'candidateHash',repeat('d',64),'evidenceHash',repeat('e',64),'path','/acrylic-roof-pergolas-auckland','copy',copy,'generator','resp_fresh','minimumExposures',100,'durationDays',14)||case when decision is null then '{}'::jsonb else jsonb_build_object('ownerDecision',decision,'ownerRequest',request)end from public.landing_experiment_control
$$;
do $$declare owner uuid:=gen_random_uuid();decision uuid:=gen_random_uuid();request uuid:=gen_random_uuid();experiment uuid:=gen_random_uuid();cmd uuid:=gen_random_uuid();probe_cmd uuid:=gen_random_uuid();p jsonb;r jsonb;prep jsonb;probe jsonb;old jsonb;before_count int;change text;prepared jsonb;observed jsonb;begin
 select to_jsonb(e)into old from public.landing_experiments e where id='a1000000-0000-4000-8000-000000000001';
 r:=public.landing_experiment_command(repeat('b',64),gen_random_uuid(),'read',null);
 perform pg_temp.ok(r#>'{excluded,/acrylic-roof-pergolas-auckland}'?'action-first','same rendered control remains excluded across template release');
 perform pg_temp.ok(r#>>'{preparation,settled}'='true','never launched reject is settled');
 p:=pg_temp.owner_payload(owner,request);
 perform pg_temp.denied(format('select public.landing_experiment_command(repeat(''b'',64),%L,''owner_decision'',null,%L::jsonb)',decision,p||jsonb_build_object('expiresAt',(date_trunc('day',clock_timestamp()at time zone 'Australia/Sydney')at time zone 'Australia/Sydney')+interval '1 day')),'funded midnight');
 r:=public.landing_experiment_command(repeat('b',64),decision,'owner_decision',null,p);
 perform pg_temp.ok(r->>'ownerDecision'=decision::text and r->'observedLayoutAllowed'='false','capacity does not revive action-first');
 perform pg_temp.ok(public.landing_experiment_command(repeat('b',64),decision,'owner_decision',null,p)=r,'idempotent exact readback');
 perform pg_temp.ok(public.landing_experiment_command(repeat('b',64),gen_random_uuid(),'receipt',null,jsonb_build_object('stage','owner_decision','command',decision,'payload',p))=r,'signed exact receipt');
 perform pg_temp.denied(format('select public.landing_experiment_command(repeat(''b'',64),gen_random_uuid(),''owner_decision'',null,%L::jsonb)',p),'one owner/day');
 perform pg_temp.denied(format('select public.landing_experiment_command(repeat(''b'',64),gen_random_uuid(),''prepare'',gen_random_uuid(),%L::jsonb)',pg_temp.prepare_payload('explore')),'ordinary competing reservation');
 perform pg_temp.denied(format('select public.landing_experiment_command(repeat(''b'',64),gen_random_uuid(),''prepare'',gen_random_uuid(),%L::jsonb)',pg_temp.prepare_payload('action-first',decision,request)),'rejected copy is not new hypothesis');
 prep:=pg_temp.prepare_payload('explore',decision,request);r:=public.landing_experiment_command(repeat('b',64),cmd,'prepare',experiment,prep);
 perform pg_temp.ok(r->>'state'='candidate' and r->>'ownerDecision'=decision::text,'distinct prepared candidate');
 perform pg_temp.ok(public.landing_experiment_command(repeat('b',64),cmd,'prepare',experiment,prep)=r,'same preparation readback');
 perform pg_temp.denied(format('select public.landing_experiment_command(repeat(''b'',64),gen_random_uuid(),''prepare'',gen_random_uuid(),%L::jsonb)',pg_temp.prepare_payload('project',decision,request)),'no second candidate');
 -- The ordinary finite daily preparation allowance is already consumed. Its row stays.
 insert into public.landing_experiment_probes(id,experiment,mode,template,generation,candidate_hash,expires_at)select gen_random_uuid(),'a1000000-0000-4000-8000-000000000001','prepare',template,generation,repeat('c',64),clock_timestamp()+interval '100 seconds'from public.landing_experiment_control;
 select count(*)into before_count from public.landing_experiment_probes;
 probe:=jsonb_build_object('probe',gen_random_uuid(),'generation',(select generation from public.landing_experiment_control),'template',repeat('a',64),'candidateHash',repeat('d',64),'mode','prepare','ownerDecision',decision,'ownerRequest',gen_random_uuid());
 r:=public.landing_experiment_command(repeat('b',64),probe_cmd,'probe',experiment,probe);
 perform pg_temp.ok(r->>'ownerDecision'=decision::text and(select count(*)from public.landing_experiment_probes)=before_count+1,'one additive probe retains ordinary usage');
 perform pg_temp.ok(public.landing_experiment_command(repeat('b',64),probe_cmd,'probe',experiment,probe)=r,'probe replay is exact receipt only');
 perform pg_temp.denied(format('select public.landing_experiment_command(repeat(''b'',64),gen_random_uuid(),''probe'',%L,%L::jsonb)',experiment,probe),'no second probe');
 select result into prepared from public.landing_experiment_receipts where command=cmd;
 -- Lost replies remain reconcilable after capacity is revoked. Each test change
 -- rolls back locally; receipts, probe expiry/counters and reservation stay exact.
 select jsonb_build_array((select jsonb_agg(to_jsonb(t)order by t.command)from public.landing_experiment_receipts t),
  (select jsonb_agg(to_jsonb(t)order by t.id)from public.landing_experiment_probes t),
  (select jsonb_agg(to_jsonb(t)order by t.id)from public.landing_experiments t),
  (select jsonb_agg(to_jsonb(t)order by t.experiment)from public.acquisition_experiment_reservation t))into observed;
 foreach change in array array['publishing=true','enabled=false','admitted_until=clock_timestamp()-interval ''1 second''']loop
  begin
   execute 'update public.landing_experiment_control set '||change;
   perform pg_temp.ok(public.landing_owner_decision(decision)is null,'current owner capacity unavailable');
   perform pg_temp.ok(public.landing_experiment_command(repeat('b',64),cmd,'prepare',experiment,prep)=prepared,'revoked preparation replay');
   perform pg_temp.ok(public.landing_experiment_command(repeat('b',64),probe_cmd,'probe',experiment,probe)=r,'revoked probe replay preserves expiry');
   perform pg_temp.ok(public.landing_experiment_command(repeat('b',64),gen_random_uuid(),'receipt',experiment,jsonb_build_object('stage','probe','command',probe_cmd,'payload',probe))=r,'receipt-only probe readback');
   perform pg_temp.denied(format('select public.landing_experiment_command(repeat(''b'',64),%L,''probe'',%L,%L::jsonb)',probe_cmd,experiment,probe||jsonb_build_object('ownerRequest',gen_random_uuid())),'changed owner request');
   perform pg_temp.denied(format('select public.landing_experiment_command(repeat(''b'',64),%L,''probe'',gen_random_uuid(),%L::jsonb)',probe_cmd,probe),'changed experiment');
   perform pg_temp.denied(format('select public.landing_experiment_command(repeat(''b'',64),%L,''prepare'',%L,%L::jsonb)',probe_cmd,experiment,probe),'changed stage');
   perform pg_temp.denied(format('select public.landing_experiment_command(repeat(''b'',64),%L,''prepare'',%L,%L::jsonb)',cmd,experiment,prep||jsonb_build_object('copy','project')),'changed preparation');
   perform pg_temp.denied(format('select public.landing_experiment_command(repeat(''0'',64),%L,''probe'',%L,%L::jsonb)',probe_cmd,experiment,probe),'wrong binding replay');
   perform pg_temp.denied(format('select public.landing_experiment_command(repeat(''b'',64),gen_random_uuid(),''probe'',%L,%L::jsonb)',experiment,probe),'no fresh probe under revoked capacity');
   perform pg_temp.denied(format('select public.landing_experiment_command(repeat(''b'',64),gen_random_uuid(),''prepare'',gen_random_uuid(),%L::jsonb)',prep),'no fresh preparation under revoked capacity');
   perform pg_temp.denied(format('select public.landing_experiment_command(repeat(''b'',64),gen_random_uuid(),''receipt'',%L,%L::jsonb)',experiment,jsonb_build_object('stage','probe','command',probe_cmd,'payload',probe||jsonb_build_object('probe',gen_random_uuid()))),'receipt payload conflict');
   perform pg_temp.ok(observed=jsonb_build_array((select jsonb_agg(to_jsonb(t)order by t.command)from public.landing_experiment_receipts t),
    (select jsonb_agg(to_jsonb(t)order by t.id)from public.landing_experiment_probes t),
    (select jsonb_agg(to_jsonb(t)order by t.id)from public.landing_experiments t),
    (select jsonb_agg(to_jsonb(t)order by t.experiment)from public.acquisition_experiment_reservation t)),'readback has no effects');
   raise no_data_found;
  exception when no_data_found then null;end;
 end loop;
 perform public.landing_experiment_command(repeat('b',64),gen_random_uuid(),'review',experiment,jsonb_build_object('generation',(select generation from public.landing_experiment_control),'candidateHash',repeat('d',64),'verdict','reject','reviewer','resp_independent_reject'));
 perform pg_temp.ok((select state='rejected'from public.landing_experiments where id=experiment),'genuine reject terminal');
 perform pg_temp.ok(not exists(select 1 from public.acquisition_experiment_reservation),'reservation released on rejection');
 perform pg_temp.denied(format('select public.landing_experiment_command(repeat(''b'',64),gen_random_uuid(),''owner_decision'',null,%L::jsonb)',pg_temp.owner_payload(owner,gen_random_uuid())),'null/reject consumes same day decision');
 perform pg_temp.ok((select to_jsonb(e)=old from public.landing_experiments e where id='a1000000-0000-4000-8000-000000000001'),'old rejection unchanged');
 -- A distinct owner fixture may abstain; releasing capacity never refunds its day.
 owner:=gen_random_uuid();decision:=gen_random_uuid();p:=pg_temp.owner_payload(owner,gen_random_uuid());perform public.landing_experiment_command(repeat('b',64),decision,'owner_decision',null,p);
 perform public.landing_experiment_command(repeat('b',64),gen_random_uuid(),'owner_end',null,jsonb_build_object('ownerDecision',decision,'result','no_landing_hypothesis'));
 perform pg_temp.ok(not exists(select 1 from public.acquisition_experiment_reservation),'abstention releases unused reservation');
 perform pg_temp.denied(format('select public.landing_experiment_command(repeat(''b'',64),gen_random_uuid(),''owner_decision'',null,%L::jsonb)',p),'abstention never refunds');
end$$;
-- Null start is insufficient if a genuine assignment or publish receipt exists.
insert into public.landing_experiment_assignments(id,experiment,arm,ad)values(gen_random_uuid(),'a1000000-0000-4000-8000-000000000001','control','11003');
select pg_temp.ok(not public.landing_decision_settled(),'partial genuine delivery denies');
select pg_temp.denied(format('select public.landing_experiment_command(repeat(''b'',64),gen_random_uuid(),''owner_decision'',null,%L::jsonb)',pg_temp.owner_payload(gen_random_uuid(),gen_random_uuid())),'genuine delivery');
delete from public.landing_experiment_assignments;
update public.landing_experiments set started_at=clock_timestamp(),ends_at=clock_timestamp()+interval '14 days'where id='a1000000-0000-4000-8000-000000000001';
select pg_temp.denied(format('select public.landing_experiment_command(repeat(''b'',64),gen_random_uuid(),''owner_decision'',null,%L::jsonb)',pg_temp.owner_payload(gen_random_uuid(),gen_random_uuid())),'genuine live-test cadence');
select pg_temp.ok(not has_function_privilege(role_name,'public.landing_owner_decision(uuid)','EXECUTE'),'helper remains private')from unnest(array['anon','authenticated','service_role'])role_name;
rollback;
