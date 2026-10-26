begin;
-- Generated strict synthetic contract, not an actual account or review receipt.
create temporary table owner_fixture(value jsonb);
insert into owner_fixture values('__OWNER_FIXTURE__');
create temporary table owner_checks(kind text);
create function pg_temp.owner_assert(ok boolean)returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'Owner bundle assertion failed';end if;insert into owner_checks values('assert');end$$;
create function pg_temp.owner_denied(statement text)returns void language plpgsql as $$begin begin execute statement;raise exception 'Unexpected owner approval'using errcode='P9999';exception when sqlstate'P0001'then insert into owner_checks values('denial');end;end$$;
delete from public.acquisition_experiment_reservation;
truncate public.meta_creative_plans cascade;
update public.landing_experiment_control set template=repeat('e',64);
update public.meta_creative_control set enabled=true,cleanup_enabled=true,authority_current=true,global_stop=false,delivery_enabled=false,native_contract_hash=repeat('d',64);
select pg_temp.owner_assert(not has_table_privilege('service_role','public.meta_creative_control','UPDATE'));
select pg_temp.owner_assert(not has_function_privilege('service_role','public.meta_creative_loss_cohort(text,uuid,timestamptz)','EXECUTE'));
do $fixture$
declare f jsonb:=(select value from owner_fixture);p jsonb:=f->'plan';envelope jsonb:=f->'envelope';e uuid:=(p->>'experiment')::uuid;
 cmd uuid;payload jsonb;g bigint;n bigint;intent jsonb;control jsonb;source text;through timestamptz;
begin
 select generation into g from public.meta_creative_control;
 update public.meta_creative_control set owner_proposal=jsonb_set(jsonb_set(envelope,'{plan}','null'),'{planHash}','null')where singleton and generation=g;
 get diagnostics n=row_count;perform pg_temp.owner_assert(n=1 and(select generation=g+1 from public.meta_creative_control));
 perform pg_temp.owner_assert(public.meta_creative_executor_command(repeat('b',64),gen_random_uuid(),null,'read','{}')->'ownerProposal'=(select owner_proposal from public.meta_creative_control));
 payload:=jsonb_build_object('plan',p,'planHash',envelope->'planHash');
 perform pg_temp.owner_denied(format('select public.meta_creative_executor_command(repeat(''b'',64),gen_random_uuid(),%L,''prepare'',%L::jsonb)',e,payload));
 update public.meta_creative_control set owner_proposal=envelope;
 perform pg_temp.owner_denied(format('select public.meta_creative_executor_command(repeat(''b'',64),gen_random_uuid(),%L,''prepare'',%L::jsonb)',e,jsonb_set(payload,'{plan,challengerPrimary}','"Changed synthetic copy"')));
 select generation into g from public.meta_creative_control;
 cmd:=gen_random_uuid();perform public.meta_creative_executor_command(repeat('b',64),cmd,e,'prepare',payload);
 perform pg_temp.owner_assert((select generation=g+1 from public.meta_creative_control));
 perform pg_temp.owner_assert((public.meta_creative_executor_command(repeat('b',64),gen_random_uuid(),e,'read','{}')->>'generation')::bigint=(select generation from public.meta_creative_control));
 perform public.meta_creative_executor_command(repeat('b',64),cmd,e,'prepare',payload);
 perform pg_temp.owner_assert((select count(*)=1 from public.meta_creative_execution where experiment=e));
 perform pg_temp.owner_assert((select plan=p and plan_hash=envelope->>'planHash' from public.meta_creative_execution where experiment=e));
 perform pg_temp.owner_assert((select count(*)=1 from public.acquisition_experiment_reservation where experiment=e));
 control:=public.meta_creative_winning_control(p,'999001');perform pg_temp.owner_assert(control=f->'expected');
 perform pg_temp.owner_denied(format('select public.meta_creative_winning_control(%L::jsonb,''999001'')',jsonb_set(p,'{control,payload,creative_sourcing_spec,unhandled_video}','"91001"')));
 payload:=(select plan from public.meta_creative_plans where id=e);
 perform pg_temp.owner_denied(format('select public.meta_creative_command(repeat(''b'',64),gen_random_uuid(),gen_random_uuid(),''reserve'',%L::jsonb)',jsonb_set(payload,'{ownerPlanHash}',to_jsonb(repeat('0',64)))));
 -- Root withdrawal revokes new dispatch; original bytes/history remain.
 update public.meta_creative_control set owner_proposal=null;
 perform pg_temp.owner_denied(format('select public.meta_creative_command(repeat(''b'',64),gen_random_uuid(),%L,''admit'',%L::jsonb)',e,jsonb_build_object('kind','create_creative')));
 perform pg_temp.owner_assert((select plan=p from public.meta_creative_execution where experiment=e));
 -- Existing delivery flag remains part of generation revocation.
 select generation into g from public.meta_creative_control;update public.meta_creative_control set delivery_enabled=true;
 perform pg_temp.owner_assert((select generation=g+1 from public.meta_creative_control));
end$fixture$;
-- The full donor fixture matches reported wrapper sizes, not provider contents.
delete from public.acquisition_experiment_reservation;
truncate public.meta_creative_plans cascade;
do $thumbnail_capacity$
declare f jsonb:=(select value->'thumbnailDonor' from owner_fixture);p jsonb:=f->'plan';envelope jsonb:=f->'envelope';e uuid:=(p->>'experiment')::uuid;cmd uuid:=gen_random_uuid();g bigint;
begin
 perform pg_temp.owner_assert(octet_length(p::text)>8000 and octet_length(p::text)<=16000);
 perform pg_temp.owner_assert(octet_length(envelope::text)>12000 and octet_length(envelope::text)<=20000);
 perform pg_temp.owner_assert(octet_length((f->'intent')::text)<=16000);
 perform pg_temp.owner_assert(p#>>'{control,payload,object_story_spec,video_data,image_url}'is not null and p#>>'{control,payload,object_story_spec,video_data,image_hash}'=repeat('a',32));
 update public.meta_creative_control set owner_proposal=jsonb_set(jsonb_set(envelope,'{plan}','null'),'{planHash}','null');
 perform pg_temp.owner_denied(format('select public.meta_creative_executor_command(repeat(''b'',64),gen_random_uuid(),%L,''prepare'',%L::jsonb)',e,jsonb_build_object('plan',p,'planHash',envelope->'planHash')));
 -- The exact root CAS binds the same full prestate before Velt admission.
 -- Source prepare must not silently stale that final generation.
 update public.meta_creative_control set owner_proposal=envelope,control_hash=p->>'preStateHash';
 select generation into g from public.meta_creative_control;
 perform public.meta_creative_executor_command(repeat('b',64),gen_random_uuid(),e,'prepare',jsonb_build_object('plan',p,'planHash',envelope->'planHash'));
 perform pg_temp.owner_assert((select generation=g from public.meta_creative_control));
 perform pg_temp.owner_assert((select plan=p from public.meta_creative_execution where experiment=e));
 perform public.meta_creative_executor_command(repeat('b',64),cmd,e,'admit',jsonb_build_object('generation',(select generation from public.meta_creative_control),'cleanup',false,'intent',f->'intent'));
 perform public.meta_creative_executor_command(repeat('b',64),cmd,e,'admit',jsonb_build_object('generation',(select generation from public.meta_creative_control),'cleanup',false,'intent',f->'intent'));
 perform pg_temp.owner_assert((select count(*)=1 and bool_and(intent=f->'intent')from public.meta_creative_execution_intents where experiment=e));
 perform pg_temp.owner_assert(public.meta_creative_winning_control(p,'999001')=jsonb_set(f->'expected','{id}','"999001"'));
 perform pg_temp.owner_denied(format('select public.meta_creative_winning_control(%L::jsonb,''999001'')',jsonb_set(p,'{control,payload,media_sourcing_spec,bodies}','[{"text":"Different"}]')));
 perform pg_temp.owner_denied(format('select public.meta_creative_winning_control(%L::jsonb,''999001'')',jsonb_set(p,'{control,payload,media_sourcing_spec,titles}','[{"text":"First"},{"text":"Second"}]')));
 perform pg_temp.owner_denied(format('select public.meta_creative_winning_control(%L::jsonb,''999001'')',jsonb_set(p,'{control,payload,media_sourcing_spec,bodies,0,unknown}','"Synthetic"')));
 -- Actual table CHECKs reject oversized owner data and retain old generic caps.
 begin
  insert into public.meta_creative_execution(experiment,plan,plan_hash)values(gen_random_uuid(),jsonb_set(p,'{control,payload,synthetic_overflow}',to_jsonb(repeat('x',16000))),repeat('a',64));
  raise exception 'Unexpected owner size approval'using errcode='P9999';
 exception when check_violation then insert into owner_checks values('denial');end;
 begin
  update public.meta_creative_control set owner_proposal=jsonb_set(envelope,'{proposal,primary}',to_jsonb(repeat('x',20000)));
  raise exception 'Unexpected envelope approval'using errcode='P9999';
 exception when check_violation then insert into owner_checks values('denial');end;
 perform pg_temp.owner_assert((select plan=p from public.meta_creative_execution where experiment=e));
 update public.meta_creative_control set owner_proposal=null;
 perform pg_temp.owner_denied(format('select public.meta_creative_executor_command(repeat(''b'',64),gen_random_uuid(),%L,''admit'',%L::jsonb)',e,jsonb_build_object('generation',(select generation from public.meta_creative_control),'cleanup',false,'intent',f->'intent')));
end$thumbnail_capacity$;
-- Public RPC must carry the complete near-bound plan through every existing
-- learning/retained/inventory wrapper, not just the private executor body.
delete from public.acquisition_experiment_reservation;
truncate public.meta_creative_plans cascade;
do $public_owner_capacity$
declare f jsonb:=(select value->'upperBoundOwner'from owner_fixture);p jsonb:=f->'plan';envelope jsonb:=f->'envelope';e uuid:=(p->>'experiment')::uuid;
 payload jsonb:=jsonb_build_object('plan',p,'planHash',envelope->'planHash');intent_payload jsonb;cmd uuid:=gen_random_uuid();intent_cmd uuid:=gen_random_uuid();g bigint;
begin
 perform pg_temp.owner_assert(octet_length(p::text)>14000 and octet_length(p::text)<=16000);
 perform pg_temp.owner_assert(octet_length(payload::text)>14000 and octet_length(payload::text)<=20000);
 perform pg_temp.owner_assert(octet_length((f->'intent')::text)>14000 and octet_length((f->'intent')::text)<=16000);
 update public.meta_creative_control set owner_proposal=null;
 perform pg_temp.owner_denied(format('select public.meta_creative_executor_command(repeat(''b'',64),gen_random_uuid(),%L,''prepare'',%L::jsonb)',e,payload));
 update public.meta_creative_control set owner_proposal=envelope,control_hash=p->>'preStateHash';
 perform pg_temp.owner_denied(format('select public.meta_creative_executor_command(repeat(''b'',64),gen_random_uuid(),%L,''prepare'',%L::jsonb)',e,jsonb_set(payload,'{planHash}',to_jsonb(repeat('0',64)))));
 perform pg_temp.owner_denied(format('select public.meta_creative_executor_command(repeat(''b'',64),gen_random_uuid(),%L,''prepare'',%L::jsonb)',e,jsonb_set(payload,'{plan,challengerPrimary}','"Changed synthetic copy"')));
 perform pg_temp.owner_denied(format('select public.meta_creative_executor_command(repeat(''b'',64),gen_random_uuid(),gen_random_uuid(),''prepare'',%L::jsonb)',payload));
 perform pg_temp.owner_denied(format('select public.meta_creative_executor_command(repeat(''b'',64),gen_random_uuid(),%L,''prepare'',%L::jsonb)',e,payload||jsonb_build_object('synthetic_overflow',repeat('x',20000))));
 perform pg_temp.owner_denied(format('select public.meta_creative_executor_command(repeat(''b'',64),gen_random_uuid(),%L,''confirm'',%L::jsonb)',e,payload));
 update public.meta_creative_control set owner_proposal=jsonb_set(envelope,'{expiresAt}','"2020-01-01T00:00:00.000Z"');
 perform pg_temp.owner_denied(format('select public.meta_creative_executor_command(repeat(''b'',64),gen_random_uuid(),%L,''prepare'',%L::jsonb)',e,payload));
 update public.meta_creative_control set owner_proposal=envelope;
 select generation into g from public.meta_creative_control;
 perform public.meta_creative_executor_command(repeat('b',64),cmd,e,'prepare',payload);
 perform public.meta_creative_executor_command(repeat('b',64),cmd,e,'prepare',payload);
 perform pg_temp.owner_assert((select generation=g from public.meta_creative_control));
 perform pg_temp.owner_assert((select plan=p and plan_hash=envelope->>'planHash'from public.meta_creative_execution where experiment=e));
 perform pg_temp.owner_assert((select count(*)=1 from public.acquisition_experiment_reservation where experiment=e));
 intent_payload:=jsonb_build_object('generation',g,'cleanup',false,'intent',f->'intent');
 perform public.meta_creative_executor_command(repeat('b',64),intent_cmd,e,'admit',intent_payload);
 perform public.meta_creative_executor_command(repeat('b',64),intent_cmd,e,'admit',intent_payload);
 perform pg_temp.owner_assert((select count(*)=1 and bool_and(intent=f->'intent')from public.meta_creative_execution_intents where experiment=e));
 update public.meta_creative_control set owner_proposal=jsonb_set(envelope,'{planHash}',to_jsonb(repeat('0',64)));
 perform pg_temp.owner_denied(format('select public.meta_creative_executor_command(repeat(''b'',64),gen_random_uuid(),%L,''admit'',%L::jsonb)',e,intent_payload));
 update public.meta_creative_control set owner_proposal=null;
 perform pg_temp.owner_denied(format('select public.meta_creative_executor_command(repeat(''b'',64),gen_random_uuid(),%L,''admit'',%L::jsonb)',e,intent_payload));
 perform pg_temp.owner_assert((select count(*)=1 from public.meta_creative_execution_intents where experiment=e));
end$public_owner_capacity$;
-- Disposable historical delivery fixture. It is not a real provider activation
-- or a claim that the HTTP broker would prepare a study after its start.
delete from public.acquisition_experiment_reservation;
truncate public.meta_creative_plans cascade;
truncate public.enquiry_requests cascade;
do $cutoff_fixture$
declare f jsonb:=(select value->'historical' from owner_fixture);p jsonb:=f->'plan';e uuid:=(p->>'experiment')::uuid;
 cmd uuid;intent jsonb;result jsonb;through timestamptz;first_count bigint;enq uuid:=gen_random_uuid();i int;
begin
 update public.meta_creative_control set owner_proposal=f->'envelope',delivery_enabled=true;
 perform public.meta_creative_executor_command(repeat('b',64),gen_random_uuid(),e,'prepare',jsonb_build_object('plan',p,'planHash',f#>'{envelope,planHash}'));
 for i in 1..2 loop
  cmd:=gen_random_uuid();intent:=jsonb_build_object('kind',case i when 1 then 'create_control' else 'create_challenger' end,'target',null,'requestHash',repeat('a',64),'at',extract(epoch from clock_timestamp())*1000);
  perform public.meta_creative_executor_command(repeat('b',64),cmd,e,'admit',jsonb_build_object('intent',intent,'cleanup',false,'generation',(select generation from public.meta_creative_control)));
  perform public.meta_creative_executor_command(repeat('b',64),cmd,e,'check',jsonb_build_object('requestHash',repeat('a',64)));
  perform public.meta_creative_executor_command(repeat('b',64),cmd,e,'confirm',jsonb_build_object('requestHash',repeat('a',64),'objectId',(88100+i)::text,'evidenceHash',repeat('f',64)));
 end loop;
 insert into public.meta_creative_execution_receipts(command,experiment,stage,evidence_hash)values(gen_random_uuid(),e,'activation',repeat('f',64));
 insert into public.meta_creative_formal_cohorts(experiment,plan_hash,payload)values(e,f#>>'{envelope,planHash}','{"sentinel":"historical frozen cohort"}');
 through:=date_trunc('day',(clock_timestamp()-interval'72 hours')at time zone'Pacific/Auckland')at time zone'Pacific/Auckland';
 result:=public.meta_creative_executor_command(repeat('b',64),gen_random_uuid(),e,'cohort',jsonb_build_object('freeze',false,'through',through));
 perform pg_temp.owner_assert(result->>'version'='2'and result->'frozen'='false'::jsonb and(result->>'endsAt')::timestamptz=through and(result->>'maturesAt')::timestamptz=through+interval'72 hours');
 perform pg_temp.owner_assert(result->>'allSavedCoverage'='complete'and result#>>'{coverage,nativeMatched}'='0'and result#>>'{ambiguity,pool}'='0');
 perform pg_temp.owner_assert((select payload='{"sentinel":"historical frozen cohort"}'::jsonb from public.meta_creative_formal_cohorts where experiment=e));
 perform pg_temp.owner_denied(format('select public.meta_creative_executor_command(repeat(''b'',64),gen_random_uuid(),%L,''cohort'',%L::jsonb)',e,jsonb_build_object('freeze',true,'through',through)));
 perform pg_temp.owner_denied(format('select public.meta_creative_executor_command(repeat(''b'',64),gen_random_uuid(),%L,''cohort'',%L::jsonb)',e,jsonb_build_object('freeze',false,'through',through+interval'1 second')));
 perform pg_temp.owner_denied(format('select public.meta_creative_executor_command(repeat(''b'',64),gen_random_uuid(),%L,''cohort'',%L::jsonb)',e,jsonb_build_object('freeze',false,'through',clock_timestamp()-interval'1 hour')));
 insert into public.enquiry_requests(id,enquiry_type,page,created_at,utm,raw_payload)values(enq,'residential','/acrylic-roof-pergolas-auckland',through-interval'1 hour','{}','{}');
 result:=public.meta_creative_executor_command(repeat('b',64),gen_random_uuid(),e,'cohort',jsonb_build_object('freeze',false,'through',through));
 perform pg_temp.owner_assert(result->>'allSavedCoverage'='unknown'and result#>>'{coverage,unknownAttribution}'='1'and result#>>'{ambiguity,pool}'='1');
 delete from public.enquiry_requests where id=enq;
 insert into public.enquiry_requests(id,enquiry_type,page,created_at,utm,raw_payload)values(enq,'residential','/acrylic-roof-pergolas-auckland',through+interval'1 hour','{}','{"attribution":{"consent":{"marketing":true,"analytics":true},"utm":{"utm_content":"88102","utm_campaign":"16","utm_term":"17"}}}');
 result:=public.meta_creative_executor_command(repeat('b',64),gen_random_uuid(),e,'cohort',jsonb_build_object('freeze',false,'through',through));
 perform pg_temp.owner_assert(result->>'unresolvedLate'='1'and result#>>'{ambiguity,pool}'='1');
 insert into public.enquiry_requests(id,enquiry_type,created_at)select gen_random_uuid(),'residential',through-interval'1 day'from generate_series(1,2001);
 perform pg_temp.owner_denied(format('select public.meta_creative_executor_command(repeat(''b'',64),gen_random_uuid(),%L,''cohort'',%L::jsonb)',e,jsonb_build_object('freeze',false,'through',through)));
end$cutoff_fixture$;
select jsonb_build_object('checks',count(*),'assertions',count(*)filter(where kind='assert'),'denials',count(*)filter(where kind='denial'),'pendingFinalAndCutoff',true,
 'publicUpperBound',(select jsonb_build_object('planBytes',octet_length((value#>'{upperBoundOwner,plan}')::text),'prepareBytes',octet_length(jsonb_build_object('plan',value#>'{upperBoundOwner,plan}','planHash',value#>>'{upperBoundOwner,envelope,planHash}')::text),'intentBytes',octet_length((value#>'{upperBoundOwner,intent}')::text),'envelopeBytes',octet_length((value#>'{upperBoundOwner,envelope}')::text))from owner_fixture))from owner_checks;
rollback;
