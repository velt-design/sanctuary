begin;
set local timezone='UTC';
create function pg_temp.observed_ok(value boolean,label text)returns void language plpgsql as $$begin if value is distinct from true then raise exception 'Observed: %',label;end if;end$$;
create function pg_temp.observed_denied(statement text,label text)returns void language plpgsql as $$begin begin execute statement;exception when others then return;end;raise exception 'Accepted invalid observed context: %',label;end$$;
insert into public.landing_experiment_control(binding,template,campaign,adset,ads,admitted_until,enabled,publishing)values(repeat('b',64),repeat('a',64),'11001','11002',array['11003'],'infinity',true,false);
do $$declare owner uuid:=gen_random_uuid();id uuid:=gen_random_uuid();ended uuid:=gen_random_uuid();supplement uuid:=gen_random_uuid();p jsonb;v jsonb;before_rows jsonb;experiment uuid:=gen_random_uuid();command uuid:=gen_random_uuid();change text;begin
 select jsonb_build_object('owner',owner,'request',gen_random_uuid(),'generation',generation,'template',template,'controls',jsonb_build_object('/auckland-outdoor-living',control_outdoor,'/acrylic-roof-pergolas-auckland',control_acrylic),'prior',null,'correction',repeat('a',40),'day',to_char(clock_timestamp()at time zone 'Pacific/Auckland','YYYY-MM-DD'),'expiresAt',least(clock_timestamp()+interval '1 hour',date_trunc('day',clock_timestamp()at time zone 'Pacific/Auckland')at time zone 'Pacific/Auckland'+interval '1 day'-interval '1 second',date_trunc('day',clock_timestamp()at time zone 'Australia/Sydney')at time zone 'Australia/Sydney'+interval '1 day'-interval '1 second'),'funding',jsonb_build_object('day',to_char(clock_timestamp()at time zone 'Australia/Sydney','YYYY-MM-DD'),'receiptHash',repeat('a',64),'maximumModelUsd',.14308))into p from public.landing_experiment_control;
 perform public.landing_experiment_command(repeat('b',64),id,'owner_decision',null,p);
 perform public.landing_experiment_command(repeat('b',64),ended,'owner_end',null,jsonb_build_object('ownerDecision',id,'result','no_landing_hypothesis'));
 select jsonb_agg(to_jsonb(h)order by h.command)into before_rows from public.landing_experiment_receipts h;
 select jsonb_build_object('ownerDecision',id,'capacityHash',encode(sha256(convert_to(to_jsonb(h)::text,'UTF8')),'hex'),'endReceipt',ended,'endHash',encode(sha256(convert_to(to_jsonb(e)::text,'UTF8')),'hex'),
  'observationHash',repeat('d',64),'template',p->>'template','generation',p->'generation','controlsHash',encode(sha256(convert_to((p->'controls')::text,'UTF8')),'hex'),
  'sourceRelease',repeat('c',40),'correction',repeat('b',40),'expiresAt',p->'expiresAt','copy','estimate','hypothesis','make_estimate_visible')into v
 from public.landing_experiment_receipts h,public.landing_experiment_receipts e where h.command=id and e.command=ended;
 foreach change in array array['enabled=false','publishing=true','template=repeat(''c'',64)']loop
  begin execute 'update public.landing_experiment_control set '||change;
   perform pg_temp.observed_denied(format('insert into public.landing_experiment_receipts values(%L,null,''owner_observation'',%L,%L::jsonb,clock_timestamp())',supplement,encode(sha256(convert_to(jsonb_build_array('owner_observation',null,v)::text,'UTF8')),'hex'),v),'control drift '||change);raise no_data_found;
  exception when no_data_found then null;end;
 end loop;
 foreach change in array array['capacityHash','endHash','observationHash','template','correction','expiresAt','copy']loop
  perform pg_temp.observed_denied(format('insert into public.landing_experiment_receipts(command,stage,request_hash,result)values(%L,''owner_observation'',%L,%L::jsonb)',supplement,
   encode(sha256(convert_to(jsonb_build_array('owner_observation',null,jsonb_set(v,array[change],to_jsonb(case when change='expiresAt' then (clock_timestamp()-interval '1 second')::text else 'invalid' end)))::text,'UTF8')),'hex'),
   jsonb_set(v,array[change],to_jsonb(case when change='expiresAt' then (clock_timestamp()-interval '1 second')::text else 'invalid' end))),'invalid receipt '||change);
 end loop;
 insert into public.landing_experiment_receipts(command,stage,request_hash,result)values(supplement,'owner_observation',encode(sha256(convert_to(jsonb_build_array('owner_observation',null,v)::text,'UTF8')),'hex'),v);
 perform pg_temp.observed_ok(public.landing_owner_decision(id) is not null,'same original capacity now available');
 perform pg_temp.observed_ok((select count(*)=1 from public.acquisition_experiment_reservation),'one reservation');
 perform pg_temp.observed_ok((select jsonb_agg(to_jsonb(h)order by h.command)from public.landing_experiment_receipts h where h.command<>supplement)=before_rows,'all original rows immutable');
 perform pg_temp.observed_denied(format('insert into public.landing_experiment_receipts(command,stage,request_hash,result)values(gen_random_uuid(),''owner_observation'',%L,%L::jsonb)',encode(sha256(convert_to(jsonb_build_array('owner_observation',null,v)::text,'UTF8')),'hex'),v),'second supplement');
 -- A genuine author abstention consumes this supplement without replacing the
 -- earlier no-hypothesis end. The rollback below is only a local test fixture.
 begin
  perform public.landing_experiment_command(repeat('b',64),gen_random_uuid(),'owner_end',null,jsonb_build_object('ownerDecision',id,'result','no_candidate'));
  perform pg_temp.observed_ok(public.landing_owner_decision(id) is null,'supplement ends on author null');
  perform pg_temp.observed_ok(not exists(select 1 from public.acquisition_experiment_reservation),'null releases reservation');
  perform pg_temp.observed_ok((select count(*)=2 from public.landing_experiment_receipts where stage='owner_end'),'both terminal ends retained');
  raise no_data_found;
 exception when no_data_found then null;end;
 p:=jsonb_build_object('generation',p->'generation','template',p->>'template','candidateHash',repeat('e',64),'evidenceHash',repeat('f',64),'path','/acrylic-roof-pergolas-auckland','copy','estimate','generator','resp_synthetic_manual','minimumExposures',100,'durationDays',14,'ownerDecision',id,'ownerRequest',gen_random_uuid());
 perform pg_temp.observed_denied(format('select public.landing_experiment_command(repeat(''b'',64),%L,''prepare'',%L,%L::jsonb)',command,experiment,p||jsonb_build_object('copy','action-first')),'no rejected layout or arbitrary copy');
 perform public.landing_experiment_command(repeat('b',64),command,'prepare',experiment,p);
 perform pg_temp.observed_ok((select count(*)=1 from public.landing_experiments),'one genuine new candidate');
 perform pg_temp.observed_ok((select count(*)=1 from public.landing_experiment_receipts where stage='owner_decision'),'no third decision');
 perform pg_temp.observed_ok((select count(*)=0 from public.landing_experiment_probes),'no probe reset or remint');
 -- An uncertain replay uses the unchanged complete digest and old authority.
 update public.landing_experiment_control set enabled=false,generation=generation+1;
 perform pg_temp.observed_ok(public.landing_experiment_command(repeat('b',64),command,'prepare',experiment,p) is not null,'exact prepare replay after Stop');
 perform pg_temp.observed_denied(format('select public.landing_experiment_command(repeat(''b'',64),%L,''prepare'',%L,%L::jsonb)',command,experiment,p||jsonb_build_object('evidenceHash',repeat('0',64))),'changed replay');
end$$;
rollback;
