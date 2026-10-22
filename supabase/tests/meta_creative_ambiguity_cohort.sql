begin;
-- Synthetic historical fixture only; all changes roll back.
delete from public.acquisition_experiment_reservation;
alter table public.meta_creative_execution disable trigger creative_execution_immutable;
update public.meta_creative_execution set created_at=clock_timestamp()-interval '30 days';
alter table public.meta_creative_execution enable trigger creative_execution_immutable;
create temporary table ambiguity_fixture_receipts(label text,payload jsonb);
-- Obtain the actual immutable freeze response, then roll back only that synthetic
-- snapshot so independent scenarios can use the same registered fixture.
create function pg_temp.snapshot(e uuid) returns jsonb language plpgsql as $$declare result jsonb;begin
 begin result:=public.meta_creative_formal_cohort(repeat('b',64),e,true);raise exception 'synthetic snapshot rollback';
 exception when others then if sqlerrm<>'synthetic snapshot rollback' then raise;end if;end;return result;end$$;
create function pg_temp.assert(ok boolean) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'Creative measurement assertion failed';end if;end$$;
create function pg_temp.reject(statement text) returns void language plpgsql as $$begin begin execute statement;exception when others then return;end;raise exception 'Expected rejection';end$$;
-- Simulate the later intake HTTP transaction while keeping this fixture rolled back.
alter table public.enquiry_requests alter column created_at set default clock_timestamp();
update public.landing_experiments set created_at=clock_timestamp()-interval '8 days';
update public.landing_experiment_control set template=repeat('a',64),enabled=true,control_outdoor='{"support":"estimate"}';
delete from public.acquisition_experiment_reservation;
update public.meta_creative_control set enabled=true,authority_current=true,global_stop=false;
select pg_temp.assert(not has_table_privilege('service_role','meta_creative_visits','SELECT'));
select pg_temp.assert(not has_function_privilege('anon','landing_experiment_visit(text,uuid,text,text,text,text,text,jsonb)','EXECUTE'));
select pg_temp.assert(not has_function_privilege('service_role','landing_experiment_visit_without_creative(text,uuid,text,text,text,text,text,jsonb)','EXECUTE'));
do $$declare f timestamptz;s timestamptz;m timestamptz;enq uuid;proj uuid;ad text;first_record record;retry_record record;submission uuid:=gen_random_uuid();payload jsonb;e uuid:='e2000000-0000-4000-8000-000000000001';p jsonb;cmd uuid;intent jsonb;visit uuid:='e3000000-0000-4000-8000-000000000001';result jsonb;i int;begin
 select jsonb_build_object('experiment',e,'scope',scope,'originalAds',original_ads,'preStateHash',control_hash,'nativeContractHash',native_contract_hash,
 'dailyMinor',40000,'weeklyMinor',280000,'studyDailyMinor',8000,'landingTemplate',repeat('a',64),'purpose','formal_experiment','currency','NZD','timezone','Pacific/Auckland',
 'generator','resp_author','reviewer','resp_reviewer','approvalHash',repeat('a',64),'approvedAssetHash',repeat('a',64),'approvalUntil',clock_timestamp()+interval '1 day',
 'controlAd','24','challengerPrimary','Synthetic ambiguity variant.','evaluation',jsonb_build_object('ambiguity','finite_allocation_envelope_v1','unknownMeans','finite_pool_sensitivity_else_inconclusive'),'control',jsonb_build_object('id','88001','page',scope->>'page','primary','Synthetic approved control.','path','/auckland-outdoor-living'),'start',extract(epoch from ((clock_timestamp() at time zone 'Pacific/Auckland')::date-19)::timestamp at time zone 'Pacific/Auckland'),'end',extract(epoch from ((clock_timestamp() at time zone 'Pacific/Auckland')::date-5)::timestamp at time zone 'Pacific/Auckland'))
 into p from public.meta_creative_control;
 perform pg_temp.reject(format('select public.meta_creative_executor_command(%L,gen_random_uuid(),%L,''prepare'',%L)',repeat('b',64),e,jsonb_build_object('plan',p-'evaluation','planHash',repeat('a',64))));
 perform public.meta_creative_executor_command(repeat('b',64),gen_random_uuid(),e,'prepare',jsonb_build_object('plan',p,'planHash',repeat('a',64)));
 perform pg_temp.assert(public.meta_creative_executor_command(repeat('b',64),gen_random_uuid(),e,'prepare',jsonb_build_object('plan',p,'planHash',repeat('a',64)))->>'prepared'='true');
 for i in 1..2 loop
  cmd:=gen_random_uuid();intent:=jsonb_build_object('kind',case i when 1 then 'create_control' else 'create_challenger' end,'target',null,'requestHash',repeat('a',64),'at',extract(epoch from clock_timestamp())*1000);
  perform public.meta_creative_executor_command(repeat('b',64),cmd,e,'admit',jsonb_build_object('intent',intent,'cleanup',false,'generation',(select generation from public.meta_creative_control)));
  perform public.meta_creative_executor_command(repeat('b',64),cmd,e,'check',jsonb_build_object('requestHash',repeat('a',64)));
  perform public.meta_creative_executor_command(repeat('b',64),cmd,e,'confirm',jsonb_build_object('requestHash',repeat('a',64),'objectId',(88100+i)::text,'evidenceHash',repeat('f',64)));
 end loop;
 perform pg_temp.assert((select count(*)=2 from public.meta_creative_registered_ads()where experiment=e));
 -- Paused preparation is not real delivery. This cannot create a visitor.
 perform public.landing_experiment_visit('assign',visit,'/auckland-outdoor-living',repeat('a',64),'88101','16','17');
 perform pg_temp.assert((select count(*) from public.meta_creative_visits)=0);
 -- Synthetic fixture only: successful activation receipt is not provider proof.
 insert into public.meta_creative_execution_receipts(command,experiment,stage,evidence_hash) values(gen_random_uuid(),e,'activation',repeat('f',64));
 s:=to_timestamp((p->>'start')::double precision);f:=to_timestamp((p->>'end')::double precision);m:=f+interval '72 hours';
 for i in 1..14 loop
  enq:=('e4000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid;
  proj:=('e5000000-0000-4000-8000-'||lpad((case when i=3 then 2 else i end)::text,12,'0'))::uuid;
  if i=12 then proj:=null;end if;
  ad:=case when i=13 then '21' when i in(8,14) then '999' when i in(2,3,5) then '88102' else '88101' end;
  if proj is not null then insert into public.projects(id)values(proj)on conflict do nothing;end if;
  insert into public.enquiry_requests(id,project_id,enquiry_type,page,created_at,utm,raw_payload)values(enq,proj,'residential','/auckland-outdoor-living',
   case when i in(4,5) then f+interval '1 hour' when i=6 then m+interval '1 second' when i=10 then s-interval '1 second' else s+interval '1 day'+i*interval '1 second' end,
   case when i=9 then '{"utm_content":"wrong"}'::jsonb else '{}'::jsonb end,
   jsonb_build_object('attribution',jsonb_build_object('consent',jsonb_build_object('marketing',i<>7,'analytics',i<>11),'utm',jsonb_build_object('utm_content',ad,'utm_campaign',case when i=14 then '999' else '16' end,'utm_term','17'))));
  if i=4 then
   insert into public.meta_creative_visits(id,experiment,ad_id,arm,page_path,template,copies,created_at,exposed_at)values(visit,e,ad,'control','/auckland-outdoor-living',repeat('a',64),'{}',s+interval '1 hour',s+interval '2 hours');
   insert into public.meta_creative_enquiries(enquiry_id,visit)values(enq,visit);
  end if;
  if i in(1,2) then insert into private.enquiry_qualification_events(enquiry_id,project_id,state,version,recorded_at)values(enq,proj,case i when 1 then 'qualified' else 'not_qualified' end,1,f-interval '1 hour');end if;
  if i=1 then insert into private.enquiry_qualification_events(enquiry_id,project_id,state,version,recorded_at)values(enq,proj,'not_qualified',2,m+interval '1 hour');end if;
 end loop;
 -- Existing excluded launch tests cannot steal a genuine formal project's origin.
 insert into public.enquiry_requests(id,project_id,enquiry_type,created_at)values
 ('f3229ccf-6a1a-4e1a-bcf4-2edf5cc85e70','e5000000-0000-4000-8000-000000000001','residential',s-interval '2 days'),
 ('fdb7aa7a-bb3f-4fb3-89ed-ac3483d21118','e5000000-0000-4000-8000-000000000001','residential',s-interval '1 day');
 result:=public.meta_creative_executor_command(repeat('b',64),gen_random_uuid(),e,'cohort','{"freeze":false}');
 perform pg_temp.assert(result->>'frozen'='false' and result->>'allSavedCoverage'='unknown' and result->>'unresolvedLate'='1');
 perform pg_temp.assert((select value->>'enquiries'='4' from jsonb_array_elements(result->'arms')where value->>'arm'='control'));
 perform pg_temp.assert((select value->>'enquiries'='1' from jsonb_array_elements(result->'arms')where value->>'arm'='challenger'));
 perform pg_temp.assert(jsonb_array_length(result->'quality')=5 and (select count(*)=1 from jsonb_array_elements(result->'quality')where value->>'qualification'='qualified'));
 -- Verified original-ad traffic is separate. Arbitrary other campaigns, missing
 -- consent, contradictory canonical tags and unknown ads remain unknown.
 perform pg_temp.assert(result->'coverage'='{"websiteGenuine":11,"nativeMatched":5,"knownOtherRegistered":1,"unknownAttribution":4,"unlinkedNative":1}'::jsonb);
 -- A separate synthetic complete-coverage scenario, not removal of real records.
 delete from public.enquiry_requests where id in(select ('e4000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid from unnest(array[5,7,8,9,14])n);
 result:=public.meta_creative_executor_command(repeat('b',64),gen_random_uuid(),e,'cohort','{"freeze":false}');
 perform pg_temp.assert(result->>'version'='2'and result->>'allSavedCoverage'='complete'and result#>>'{ambiguity,pool}'='0');
 insert into ambiguity_fixture_receipts values('baseline',pg_temp.snapshot(e));
 -- Ordinary separate website acquisition remains ambiguous, even with Google
 -- labels and both consents. Neither path nor tags prove outside-test provenance.
 insert into public.projects(id)values('ea000000-0000-4000-8000-000000000001');
 insert into public.enquiry_requests(id,project_id,enquiry_type,page,created_at,utm,raw_payload)values('ea000000-0000-4000-8000-000000000002','ea000000-0000-4000-8000-000000000001','residential','/ads/acrylic-pergolas',s+interval'1 day','{}','{"attribution":{"consent":{"marketing":true,"analytics":true},"utm":{"utm_source":"google","utm_medium":"cpc"}}}');
 result:=public.meta_creative_formal_cohort(repeat('b',64),e,false);
 perform pg_temp.assert(result#>>'{ambiguity,pool}'='1'and result#>>'{coverage,unknownAttribution}'='1'and result->>'unresolvedLate'='0'and result->>'allSavedCoverage'='unknown'and result#>>'{ambiguity,joinConflicts}'='0');
 perform pg_temp.assert(result->'arms'=(select r.payload->'arms'from ambiguity_fixture_receipts r where label='baseline'));
 insert into ambiguity_fixture_receipts values('google',pg_temp.snapshot(e));
 insert into private.enquiry_qualification_events(enquiry_id,project_id,state,version,recorded_at)values('ea000000-0000-4000-8000-000000000002','ea000000-0000-4000-8000-000000000001','not_qualified',1,f-interval'1 hour');
 result:=public.meta_creative_formal_cohort(repeat('b',64),e,false);perform pg_temp.assert(result#>>'{ambiguity,canonicalAdverse}'='1');insert into ambiguity_fixture_receipts values('adverse',pg_temp.snapshot(e));
 insert into public.enquiry_requests(id,enquiry_type,page,created_at,utm,raw_payload)values('ea000000-0000-4000-8000-000000000003','residential','/auckland-outdoor-living',f+interval'1 hour','{}','{"attribution":{"consent":{"marketing":true,"analytics":true},"utm":{"utm_content":"88101","utm_campaign":"16","utm_term":"17"}}}');
 result:=public.meta_creative_formal_cohort(repeat('b',64),e,false);perform pg_temp.assert(result#>>'{ambiguity,pool}'='2'and result->>'unresolvedLate'='1'and result#>>'{coverage,unknownAttribution}'='1');insert into ambiguity_fixture_receipts values('late',pg_temp.snapshot(e));
 insert into public.meta_creative_enquiries(enquiry_id,visit)values('ea000000-0000-4000-8000-000000000003',visit);
 result:=public.meta_creative_formal_cohort(repeat('b',64),e,false);perform pg_temp.assert(result#>>'{ambiguity,pool}'='1'and result->>'unresolvedLate'='0');insert into ambiguity_fixture_receipts values('late_joined',pg_temp.snapshot(e));
 insert into public.meta_creative_enquiries(enquiry_id,visit)values('ea000000-0000-4000-8000-000000000002',visit);
 result:=public.meta_creative_formal_cohort(repeat('b',64),e,false);perform pg_temp.assert(result#>>'{ambiguity,joinConflicts}'='1');insert into ambiguity_fixture_receipts values('conflict',pg_temp.snapshot(e));
 begin
  insert into public.enquiry_requests(id,enquiry_type,created_at)select gen_random_uuid(),'residential',s+interval'2 days'from generate_series(1,2001);
  perform public.meta_creative_formal_cohort(repeat('b',64),e,false);raise exception 'Overflow accepted';
 exception when others then if sqlerrm<>'Formal cohort exceeds bound'then raise;end if;end;
 result:=public.meta_creative_formal_cohort(repeat('b',64),e,true);perform pg_temp.assert(result->>'frozen'='true');
 perform pg_temp.assert(not has_table_privilege('service_role','meta_creative_formal_cohorts','SELECT') and not has_function_privilege('anon','meta_creative_formal_cohort(text,uuid,boolean)','EXECUTE'));
 perform pg_temp.reject(format('update public.meta_creative_formal_cohorts set payload=''{}'' where experiment=%L',e));
 perform pg_temp.reject(format('select public.meta_creative_executor_command(%L,gen_random_uuid(),%L,''cohort'',''{"freeze":null}'')',repeat('b',64),e));
 perform pg_temp.reject(format('select public.meta_creative_formal_cohort(%L,%L,true)',repeat('c',64),e));
 insert into private.enquiry_qualification_events(enquiry_id,project_id,state,version,recorded_at)values('e4000000-0000-4000-8000-000000000001','e5000000-0000-4000-8000-000000000001','not_qualified',3,m-interval '1 hour');
 perform pg_temp.assert(result=public.meta_creative_formal_cohort(repeat('b',64),e,true));
 perform pg_temp.assert((select count(*)from public.email_outbox)=0);
end$$;
select jsonb_object_agg(label,payload)from ambiguity_fixture_receipts;
rollback;
