-- Disposable only. Existing strict signed payload and receipt replay stay intact.
begin;
create function pg_temp.reassessment_ok(value boolean,label text)returns void language plpgsql as $$begin if value is distinct from true then raise exception 'Reassessment: %',label;end if;end$$;
create function pg_temp.reassessment_denied(statement text,label text)returns void language plpgsql as $$begin begin execute statement;exception when others then return;end;raise exception 'Accepted invalid reassessment: %',label;end$$;
insert into public.landing_experiment_control(binding,template,campaign,adset,ads,admitted_until,enabled,publishing)values(repeat('b',64),repeat('a',64),'11001','11002',array['11003'],'infinity',true,false);
create function pg_temp.reassessment_payload(owner uuid,correction text,funding text)returns jsonb language sql as $$
 select jsonb_build_object('owner',owner,'request',gen_random_uuid(),'generation',c.generation,'template',c.template,'controls',jsonb_build_object('/auckland-outdoor-living',c.control_outdoor,'/acrylic-roof-pergolas-auckland',c.control_acrylic),'prior',public.landing_decision_prior(),'correction',repeat(correction,40),'day',to_char(clock_timestamp()at time zone 'Pacific/Auckland','YYYY-MM-DD'),'expiresAt',least(clock_timestamp()+interval '1 hour',date_trunc('day',clock_timestamp()at time zone 'Pacific/Auckland')at time zone 'Pacific/Auckland'+interval '1 day'-interval '1 second',date_trunc('day',clock_timestamp()at time zone 'Australia/Sydney')at time zone 'Australia/Sydney'+interval '1 day'-interval '1 second'),'funding',jsonb_build_object('day',to_char(clock_timestamp()at time zone 'Australia/Sydney','YYYY-MM-DD'),'receiptHash',repeat(funding,64),'maximumModelUsd',.14308))from public.landing_experiment_control c
$$;
do $$declare owner uuid:=gen_random_uuid();first_id uuid:=gen_random_uuid();next_id uuid:=gen_random_uuid();p jsonb;r jsonb;old jsonb;change text;begin
 p:=pg_temp.reassessment_payload(owner,'a','a');perform public.landing_experiment_command(repeat('b',64),first_id,'owner_decision',null,p);
 perform pg_temp.reassessment_denied(format('select public.landing_experiment_command(repeat(''b'',64),%L,''owner_decision'',null,%L::jsonb)',next_id,pg_temp.reassessment_payload(owner,'b','b')),'active capacity');
 perform public.landing_experiment_command(repeat('b',64),gen_random_uuid(),'owner_end',null,jsonb_build_object('ownerDecision',first_id,'result','no_landing_hypothesis'));
 select jsonb_agg(to_jsonb(h)order by command)into old from public.landing_experiment_receipts h;
 perform pg_temp.reassessment_denied(format('select public.landing_experiment_command(repeat(''b'',64),%L,''owner_decision'',null,%L::jsonb)',next_id,pg_temp.reassessment_payload(owner,'a','b')),'same correction');
 perform pg_temp.reassessment_denied(format('select public.landing_experiment_command(repeat(''b'',64),%L,''owner_decision'',null,%L::jsonb)',next_id,pg_temp.reassessment_payload(owner,'b','a')),'same funding');
 foreach change in array array['enabled=false','publishing=true','admitted_until=clock_timestamp()-interval ''1 second''','template=repeat(''c'',64)']loop
  begin
   execute 'update public.landing_experiment_control set '||change;
   perform pg_temp.reassessment_denied(format('select public.landing_experiment_command(repeat(''b'',64),%L,''owner_decision'',null,%L::jsonb)',next_id,pg_temp.reassessment_payload(owner,'b','b')),'Stop or changed baseline');
   raise no_data_found;
  exception when no_data_found then null;end;
 end loop;
 p:=pg_temp.reassessment_payload(owner,'b','b');r:=public.landing_experiment_command(repeat('b',64),next_id,'owner_decision',null,p);
 perform pg_temp.reassessment_ok((select count(*)=1 and min(command::text)=first_id::text from public.landing_experiment_receipts where stage='owner_decision' and result->>'owner'=owner::text and result->>'day'=p->>'day' and command<>next_id),'exact sole immutable predecessor');
 perform pg_temp.reassessment_ok((select jsonb_agg(to_jsonb(h)order by command)from public.landing_experiment_receipts h where command<>next_id)=old,'all prior rows unchanged');
 perform pg_temp.reassessment_ok(public.landing_experiment_command(repeat('b',64),next_id,'owner_decision',null,p)=r,'exact idempotent readback');
 perform pg_temp.reassessment_ok(public.landing_experiment_command(repeat('b',64),gen_random_uuid(),'receipt',null,jsonb_build_object('stage','owner_decision','command',next_id,'payload',p))=r,'existing signed receipt contract');
 perform pg_temp.reassessment_ok((select count(*)from jsonb_object_keys(r))=12,'wire shape unchanged');
 perform public.landing_experiment_command(repeat('b',64),gen_random_uuid(),'owner_end',null,jsonb_build_object('ownerDecision',next_id,'result','no_landing_hypothesis'));
 perform pg_temp.reassessment_denied(format('select public.landing_experiment_command(repeat(''b'',64),gen_random_uuid(),''owner_decision'',null,%L::jsonb)',pg_temp.reassessment_payload(owner,'c','c')),'no third decision');
 perform pg_temp.reassessment_ok(not exists(select 1 from public.landing_experiment_probes),'no probe reset or creation');
 -- Unknown/stopped is not a completed no-hypothesis decision.
 owner:=gen_random_uuid();first_id:=gen_random_uuid();perform public.landing_experiment_command(repeat('b',64),first_id,'owner_decision',null,pg_temp.reassessment_payload(owner,'a','a'));
 perform public.landing_experiment_command(repeat('b',64),gen_random_uuid(),'owner_end',null,jsonb_build_object('ownerDecision',first_id,'result','stopped'));
 perform pg_temp.reassessment_denied(format('select public.landing_experiment_command(repeat(''b'',64),gen_random_uuid(),''owner_decision'',null,%L::jsonb)',pg_temp.reassessment_payload(owner,'b','b')),'unknown predecessor');
end$$;
rollback;
