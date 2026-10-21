begin;
create function pg_temp.assert(ok boolean) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'Creative measurement assertion failed';end if;end$$;
create function pg_temp.reject(statement text) returns void language plpgsql as $$begin begin execute statement;exception when others then return;end;raise exception 'Expected rejection';end$$;
-- Simulate the later intake HTTP transaction while keeping this fixture rolled back.
alter table public.enquiry_requests alter column created_at set default clock_timestamp();
update public.landing_experiments set created_at=clock_timestamp()-interval '8 days';
update public.landing_experiment_control set template=repeat('a',64),enabled=true,control_outdoor='{"support":"estimate"}';
select pg_temp.assert(not has_table_privilege('service_role','meta_creative_visits','SELECT'));
select pg_temp.assert(not has_function_privilege('anon','landing_experiment_visit(text,uuid,text,text,text,text,text,jsonb)','EXECUTE'));
select pg_temp.assert(not has_function_privilege('service_role','landing_experiment_visit_without_creative(text,uuid,text,text,text,text,text,jsonb)','EXECUTE'));
do $$declare first_record record;retry_record record;submission uuid:=gen_random_uuid();payload jsonb;e uuid:='e2000000-0000-4000-8000-000000000001';p jsonb;cmd uuid;intent jsonb;visit uuid:='e3000000-0000-4000-8000-000000000001';result jsonb;i int;begin
 select jsonb_build_object('experiment',e,'scope',scope,'originalAds',original_ads,'preStateHash',control_hash,'nativeContractHash',native_contract_hash,
 'dailyMinor',40000,'weeklyMinor',280000,'studyDailyMinor',8000,'landingTemplate',repeat('a',64),'purpose','formal_experiment','currency','NZD','timezone','Pacific/Auckland',
 'generator','resp_author','reviewer','resp_reviewer','approvalHash',repeat('a',64),'approvedAssetHash',repeat('a',64),'approvalUntil',clock_timestamp()+interval '1 day',
 'control',jsonb_build_object('path','/auckland-outdoor-living'),'start',floor(extract(epoch from clock_timestamp()-interval '1 day')),'end',floor(extract(epoch from clock_timestamp()+interval '13 days')))
 into p from public.meta_creative_control;
 perform public.meta_creative_executor_command(repeat('b',64),gen_random_uuid(),e,'prepare',jsonb_build_object('plan',p,'planHash',repeat('a',64)));
 for i in 1..2 loop
  cmd:=gen_random_uuid();intent:=jsonb_build_object('kind',case i when 1 then 'create_control' else 'create_challenger' end,'target',null,'requestHash',repeat('a',64),'at',extract(epoch from clock_timestamp())*1000);
  perform public.meta_creative_executor_command(repeat('b',64),cmd,e,'admit',jsonb_build_object('intent',intent,'cleanup',false,'generation',(select generation from public.meta_creative_control)));
  perform public.meta_creative_executor_command(repeat('b',64),cmd,e,'check',jsonb_build_object('requestHash',repeat('a',64)));
  perform public.meta_creative_executor_command(repeat('b',64),cmd,e,'confirm',jsonb_build_object('requestHash',repeat('a',64),'objectId',(8100+i)::text,'evidenceHash',repeat('f',64)));
 end loop;
 perform pg_temp.assert(jsonb_array_length(public.meta_creative_reporting_registry())=2);
 -- Paused preparation is not real delivery. This cannot create a visitor.
 perform public.landing_experiment_visit('assign',visit,'/auckland-outdoor-living',repeat('a',64),'8101','16','17');
 perform pg_temp.assert((select count(*) from public.meta_creative_visits)=0);
 -- Synthetic fixture only: successful activation receipt is not provider proof.
 insert into public.meta_creative_execution_receipts(command,experiment,stage,evidence_hash) values(gen_random_uuid(),e,'activation',repeat('f',64));
 perform public.landing_experiment_visit('assign',visit,'/auckland-outdoor-living',repeat('b',64),'8101','16','17');
 perform pg_temp.assert((select count(*) from public.meta_creative_visits)=0);
 perform public.landing_experiment_visit('assign',visit,'/auckland-outdoor-living',repeat('a',64),'8101','wrong','17');
 perform pg_temp.assert((select count(*) from public.meta_creative_visits)=0);
 result:=public.landing_experiment_visit('assign',visit,'/auckland-outdoor-living',repeat('a',64),'8101','16','17');
 perform pg_temp.assert(result->>'arm'='control' and result->'copies'='{"support":"estimate"}'::jsonb);
 perform pg_temp.assert(result=public.landing_experiment_visit('assign',visit,'/auckland-outdoor-living',repeat('a',64),'8101','16','17'));
 perform public.landing_experiment_visit('expose',visit,'/auckland-outdoor-living',repeat('a',64));
 perform pg_temp.assert((select exposed_at is not null from public.meta_creative_visits where id=visit));
 payload:=jsonb_build_object('enquiryType','residential','name','Creative fixture','email','creative@example.invalid','phone','','phoneRaw','','suburb','Albany','files','[]'::jsonb,'page','/auckland-outdoor-living','message','A residential pergola in Auckland.',
  'rawPayload','{"requestType":"project-discussion","attribution":{"consent":{"analytics":true,"marketing":true},"utm":{"utm_campaign":"16","utm_term":"17","utm_content":"8101"}}}'::jsonb);
 select * into first_record from public.marketing_experiment_intake(submission,'',payload,visit);
 select * into retry_record from public.marketing_experiment_intake(submission,'',payload,visit);
 perform pg_temp.assert(retry_record.already_existed and retry_record.enquiry_request_id=first_record.enquiry_request_id);
 perform pg_temp.assert((select count(*) from public.meta_creative_enquiries where enquiry_id=first_record.enquiry_request_id)=1);
 perform pg_temp.assert((select count(*) from public.landing_experiment_enquiries where enquiry_id=first_record.enquiry_request_id)=0);
 select * into retry_record from public.marketing_experiment_intake(gen_random_uuid(),'',jsonb_set(payload,'{rawPayload,attribution,consent,marketing}','false'),visit);
 perform pg_temp.assert(not exists(select 1 from public.meta_creative_enquiries where enquiry_id=retry_record.enquiry_request_id));
 select * into retry_record from public.marketing_experiment_intake(gen_random_uuid(),'',jsonb_set(payload,'{rawPayload,attribution,utm,utm_content}','"8102"'),visit);
 perform pg_temp.assert(not exists(select 1 from public.meta_creative_enquiries where enquiry_id=retry_record.enquiry_request_id));
 perform pg_temp.assert((select count(*) from public.email_outbox)=0);
 perform pg_temp.reject(format('update public.meta_creative_visits set arm=''challenger'' where id=%L',visit));
 perform public.landing_experiment_visit('revoke',visit,'/auckland-outdoor-living',repeat('a',64));
 perform pg_temp.assert((select revoked_at is not null from public.meta_creative_visits where id=visit));
 perform pg_temp.assert(public.landing_experiment_visit('assign',visit,'/auckland-outdoor-living',repeat('a',64),'8101','16','17')->'assignment'='null'::jsonb);
end$$;
rollback;
