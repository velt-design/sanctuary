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
alter table private.enquiry_qualification_events add column project_id uuid,add column recorded_at timestamptz not null default clock_timestamp();
do $$declare f timestamptz;s timestamptz;m timestamptz;enq uuid;proj uuid;ad text;first_record record;retry_record record;submission uuid:=gen_random_uuid();payload jsonb;e uuid:='e2000000-0000-4000-8000-000000000001';p jsonb;cmd uuid;intent jsonb;visit uuid:='e3000000-0000-4000-8000-000000000001';result jsonb;i int;begin
 select jsonb_build_object('experiment',e,'scope',scope,'originalAds',original_ads,'preStateHash',control_hash,'nativeContractHash',native_contract_hash,
 'dailyMinor',40000,'weeklyMinor',280000,'studyDailyMinor',8000,'landingTemplate',repeat('a',64),'purpose','formal_experiment','currency','NZD','timezone','Pacific/Auckland',
 'generator','resp_author','reviewer','resp_reviewer','approvalHash',repeat('a',64),'approvedAssetHash',repeat('a',64),'approvalUntil',clock_timestamp()+interval '1 day',
 'control',jsonb_build_object('path','/auckland-outdoor-living'),'start',floor(extract(epoch from clock_timestamp()-interval '19 days')),'end',floor(extract(epoch from clock_timestamp()-interval '5 days')))
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
 s:=to_timestamp((p->>'start')::double precision);f:=to_timestamp((p->>'end')::double precision);m:=f+interval '72 hours';
 for i in 1..11 loop
  enq:=('e4000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid;
  proj:=('e5000000-0000-4000-8000-'||lpad((case when i=3 then 2 else i end)::text,12,'0'))::uuid;
  ad:=case when i=8 then '999' when i in(2,3,5) then '8102' else '8101' end;
  insert into public.projects(id)values(proj)on conflict do nothing;
  insert into public.enquiry_requests(id,project_id,enquiry_type,page,created_at,utm,raw_payload)values(enq,proj,'residential','/auckland-outdoor-living',
   case when i in(4,5) then f+interval '1 hour' when i=6 then m+interval '1 second' when i=10 then s-interval '1 second' else s+interval '1 day'+i*interval '1 second' end,
   case when i=9 then '{"utm_content":"wrong"}'::jsonb else '{}'::jsonb end,
   jsonb_build_object('attribution',jsonb_build_object('consent',jsonb_build_object('marketing',i<>7,'analytics',i<>11),'utm',jsonb_build_object('utm_content',ad,'utm_campaign','16','utm_term','17'))));
  if i=4 then
   insert into public.meta_creative_visits(id,experiment,ad_id,arm,page_path,template,copies,created_at,exposed_at)values(visit,e,ad,'control','/auckland-outdoor-living',repeat('a',64),'{}',s+interval '1 hour',s+interval '2 hours');
   insert into public.meta_creative_enquiries(enquiry_id,visit)values(enq,visit);
  end if;
  if i in(1,2) then insert into private.enquiry_qualification_events(enquiry_id,project_id,state,version,recorded_at)values(enq,proj,case i when 1 then 'qualified' else 'not_qualified' end,1,f-interval '1 hour');end if;
  if i=1 then insert into private.enquiry_qualification_events(enquiry_id,project_id,state,version,recorded_at)values(enq,proj,'not_qualified',2,m+interval '1 hour');end if;
 end loop;
 result:=public.meta_creative_executor_command(repeat('b',64),gen_random_uuid(),e,'cohort','{"freeze":true}');
 perform pg_temp.assert(result->>'frozen'='true' and result->>'allSavedCoverage'='unknown' and result->>'unresolvedLate'='1');
 perform pg_temp.assert((select value->>'enquiries'='3' from jsonb_array_elements(result->'arms')where value->>'arm'='control'));
 perform pg_temp.assert((select value->>'enquiries'='1' from jsonb_array_elements(result->'arms')where value->>'arm'='challenger'));
 perform pg_temp.assert(jsonb_array_length(result->'quality')=4 and (select count(*)=1 from jsonb_array_elements(result->'quality')where value->>'qualification'='qualified'));
 perform pg_temp.assert(not has_table_privilege('service_role','meta_creative_formal_cohorts','SELECT') and not has_function_privilege('anon','meta_creative_formal_cohort(text,uuid,boolean)','EXECUTE'));
 perform pg_temp.reject(format('update public.meta_creative_formal_cohorts set payload=''{}'' where experiment=%L',e));
 perform pg_temp.reject(format('select public.meta_creative_executor_command(%L,gen_random_uuid(),%L,''cohort'',''{"freeze":null}'')',repeat('b',64),e));
 perform pg_temp.reject(format('select public.meta_creative_formal_cohort(%L,%L,true)',repeat('c',64),e));
 insert into private.enquiry_qualification_events(enquiry_id,project_id,state,version,recorded_at)values('e4000000-0000-4000-8000-000000000001','e5000000-0000-4000-8000-000000000001','not_qualified',3,m-interval '1 hour');
 perform pg_temp.assert(result=public.meta_creative_formal_cohort(repeat('b',64),e,true));
 perform pg_temp.assert((select count(*)from public.email_outbox)=0);
end$$;
rollback;
