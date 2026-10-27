begin;
-- Synthetic connected proof using the complete installed command functions.
create temporary table normalization_fixture(value jsonb);
insert into normalization_fixture values('__NORMALIZATION_FIXTURE__');
create temporary table normalization_checks(kind text);
create function pg_temp.normalization_assert(ok boolean)returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'Normalization assertion failed';end if;insert into normalization_checks values('assert');end$$;
create function pg_temp.normalization_denied(statement text)returns void language plpgsql as $$begin begin execute statement;raise exception 'Unexpected normalization approval'using errcode='P9999';exception when sqlstate'P0001'then insert into normalization_checks values('denial');end;end$$;
create function pg_temp.withdraw_before_dispatch(e uuid,cmd uuid,h text)returns void language plpgsql as $$begin
 update public.meta_creative_control set owner_proposal=null;
 perform public.meta_creative_executor_command(repeat('b',64),cmd,e,'check',jsonb_build_object('requestHash',h));
end$$;
create function pg_temp.formal_normalization_prepare(p jsonb)returns void language plpgsql as $$declare f jsonb:=(select value from normalization_fixture);envelope jsonb;begin
 envelope:=jsonb_set(jsonb_set(f->'envelope','{plan}',p),'{planHash}',to_jsonb(repeat('e',64)));
 update public.meta_creative_control set owner_proposal=envelope,control_hash=p->>'preStateHash';
 perform public.meta_creative_executor_command(repeat('b',64),gen_random_uuid(),(p->>'experiment')::uuid,'prepare',jsonb_build_object('plan',p,'planHash',repeat('e',64)));
end$$;
delete from public.acquisition_experiment_reservation;
truncate public.meta_creative_plans cascade;
update public.landing_experiment_control set template=repeat('e',64);
update public.meta_creative_control set enabled=true,cleanup_enabled=true,authority_current=true,global_stop=false,delivery_enabled=false,native_contract_hash=repeat('d',64),owner_proposal=null;
do $normalization$
declare f jsonb:=(select value from normalization_fixture);p jsonb:=f->'paused';e uuid:=(p->>'experiment')::uuid;cmd uuid;intent jsonb;k text;payload jsonb;bad jsonb;
begin
 perform pg_temp.normalization_assert(octet_length(p::text)>8000 and octet_length(p::text)<=16000);
 perform pg_temp.normalization_assert(octet_length((f->'made')::text)>8000 and octet_length((f->'made')::text)<=16000);
 perform pg_temp.normalization_assert(not has_function_privilege('service_role','public.meta_creative_pending_normalization(jsonb,jsonb)','EXECUTE'));
 payload:=jsonb_build_object('plan',p,'planHash',f->>'planHash');
 perform pg_temp.normalization_denied(format('select public.meta_creative_executor_command(repeat(''b'',64),gen_random_uuid(),%L,''prepare'',%L::jsonb)',e,payload));
 update public.meta_creative_control set owner_proposal=jsonb_set(f->'pending','{expiresAt}','"2020-01-01T00:00:00.000Z"');
 perform pg_temp.normalization_denied(format('select public.meta_creative_executor_command(repeat(''b'',64),gen_random_uuid(),%L,''prepare'',%L::jsonb)',e,payload));
 update public.meta_creative_control set owner_proposal=f->'pending';
 bad:=jsonb_set(payload,'{plan,capabilityReview,proposal,instructionHash}',to_jsonb(repeat('0',64)));
 perform pg_temp.normalization_denied(format('select public.meta_creative_executor_command(repeat(''b'',64),gen_random_uuid(),%L,''prepare'',%L::jsonb)',e,bad));
 perform public.meta_creative_executor_command(repeat('b',64),gen_random_uuid(),e,'prepare',payload);
 perform pg_temp.normalization_assert((select plan=p from public.meta_creative_execution where experiment=e));
 foreach k in array array['made','ad','pause']loop
  if k='pause' then
   perform public.meta_creative_executor_command(repeat('b',64),gen_random_uuid(),e,'measurement','{}');
   perform public.meta_creative_executor_command(repeat('b',64),gen_random_uuid(),e,'canary',jsonb_build_object('evidenceHash',repeat('c',64)));
  end if;
  cmd:=gen_random_uuid();intent:=f->k;
  perform public.meta_creative_executor_command(repeat('b',64),cmd,e,'admit',jsonb_build_object('intent',intent,'cleanup',k='pause','generation',(select generation from public.meta_creative_control)));
  if k='made' then perform pg_temp.normalization_denied(format('select pg_temp.withdraw_before_dispatch(%L,%L,%L)',e,cmd,intent->>'requestHash'));end if;
  perform public.meta_creative_executor_command(repeat('b',64),cmd,e,'check',jsonb_build_object('requestHash',intent->>'requestHash'));
  perform public.meta_creative_executor_command(repeat('b',64),cmd,e,'confirm',jsonb_build_object('requestHash',intent->>'requestHash','objectId',case when k='made'then'999101'else'999102'end,'evidenceHash',repeat('c',64)));
 end loop;
 perform public.meta_creative_executor_command(repeat('b',64),gen_random_uuid(),e,'cleanup',jsonb_build_object('evidenceHash',repeat('c',64),'terminalStudy',null));
 perform pg_temp.normalization_assert(not exists(select 1 from public.acquisition_experiment_reservation));
 perform pg_temp.normalization_assert((select count(*)=1 from public.meta_creative_objects where experiment=e));
 perform pg_temp.normalization_assert(not exists(select 1 from public.meta_creative_objects where object_id='999101'));
 perform pg_temp.normalization_assert(public.meta_creative_executor_command(repeat('b',64),gen_random_uuid(),e,'read','{}')->>'state'='closed');
 foreach k in array array['planHash','sourceCreative','ad','creative','evidenceHash']loop
  bad:=jsonb_set(f->'formal',array['capabilityBaseline',k],to_jsonb(case when k in('planHash','evidenceHash')then repeat('0',64)else'777777'end));
  perform pg_temp.normalization_denied(format('select pg_temp.formal_normalization_prepare(%L::jsonb)',bad));
 end loop;
 bad:=jsonb_set(f->'formal','{adSettings,priority}','1');
 perform pg_temp.normalization_denied(format('select pg_temp.formal_normalization_prepare(%L::jsonb)',bad));
 update public.meta_creative_control set owner_proposal=f->'envelope',control_hash=f#>>'{formal,preStateHash}';
 perform public.meta_creative_executor_command(repeat('b',64),gen_random_uuid(),(f#>>'{formal,experiment}')::uuid,'prepare',jsonb_build_object('plan',f->'formal','planHash',f#>>'{envelope,planHash}'));
 perform pg_temp.normalization_assert((select plan=f->'formal' from public.meta_creative_execution where experiment=(f#>>'{formal,experiment}')::uuid));
 perform pg_temp.normalization_assert(f#>>'{envelope,proposal,controlCreative}'=p#>>'{control,id}');
end$normalization$;
select jsonb_build_object('checks',count(*),'assertions',count(*)filter(where kind='assert'),'denials',count(*)filter(where kind='denial'),'fullPendingPausedClosedFormal',true,'providerCalls',0)from normalization_checks;
rollback;
