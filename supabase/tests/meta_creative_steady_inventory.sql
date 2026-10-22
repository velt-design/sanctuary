begin;
-- Entirely synthetic canonical intake and native ledger composition. No provider.
select pg_advisory_xact_lock(819421,1);
delete from public.acquisition_experiment_reservation;
-- Isolate this rolled-back fixture from the preceding synthetic historical suite.
truncate public.meta_creative_plans cascade;
alter table public.enquiry_requests alter column created_at set default clock_timestamp();
alter table public.meta_creative_native_acceptance disable trigger native_acceptance_guard;
update public.meta_creative_control set enabled=true,delivery_enabled=true,cleanup_enabled=true,global_stop=false,authority_current=true;
update public.landing_experiment_control set template=repeat('a',64),enabled=true;
create function pg_temp.inventory_assert(ok boolean,label text)returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'Steady inventory: %',label;end if;end$$;
create temporary table inventory_proof(payload jsonb);
-- The same narrow local source-authority stub used by the existing outcomes
-- harness. The actual campaign outcome, canonical intake and reporting run here.
create table private.sanctuary_meta_operations(id uuid primary key,query jsonb);
create function public.sanctuary_meta_command(uuid,text,text,text,uuid,text,text,uuid)returns jsonb language plpgsql as $$begin
 if $1 is distinct from 'a0000000-0000-4000-8000-000000000001'::uuid or $7 is distinct from 'deliver'then raise exception 'Denied source';end if;return '{}';end$$;
create table public.site_visit_events(project_id uuid,status text,confirmed_at timestamptz);
create table public.quotes(id uuid,project_id uuid);
create table public.quote_versions(id uuid,quote_id uuid,sent_at timestamptz,accepted_at timestamptz,status text);
create table public.xero_deposit_matches(project_id uuid,reversed_at timestamptz,amount_inc_gst_cents bigint);
create table public.deposit_invoices(project_id uuid,quote_version_id uuid,status text,payment_term_position integer,total_inc_gst_cents bigint);
create function public.commercial_current_accepted_quote_versions(uuid)returns table(quote_version_id uuid)language sql as $$select null::uuid where false$$;
insert into private.sanctuary_meta_operations select 'a1000000-0000-4000-8000-000000000001',jsonb_build_object('health',true,'scope',scope||jsonb_build_object('launchDay','2026-01-01','ads',(select jsonb_agg(jsonb_build_object('id',v))from jsonb_array_elements_text(original_ads)v)))from public.meta_creative_control;
do $$declare first_e uuid;second_e uuid;third_e uuid;next_e uuid;baseline jsonb;cmd uuid;p jsonb;visit uuid:=gen_random_uuid();saved record;missing record;denied record;late record;invalid record;frozen_before jsonb;payload jsonb;before_count int;report jsonb;intervals jsonb;begin
 first_e:=public.retention_fixture_ret_seed('21');
 select count(*)into before_count from public.meta_creative_registered_ads();
 perform public.retention_fixture_ret_effect(first_e,'create_retained','99001');
 report:=public.meta_creative_reporting_registry();
 perform pg_temp.inventory_assert(report->'steady'@>'[{"id":"99001","state":"paused","intervals":[]}]','paused create is inventoried without serving');
 perform pg_temp.inventory_assert(jsonb_array_length(report->'experimental')=before_count,'no third native arm');
 insert into inventory_proof values(jsonb_build_object('stage','paused','registry',report));
 perform pg_temp.inventory_assert(public.landing_experiment_visit('assign',visit,'/acrylic-roof-pergolas-auckland',repeat('a',64),'99001','16','17')->'assignment'='null'::jsonb,'paused assignment denied');
 perform public.retention_fixture_ret_effect(first_e,'activate_retained');perform public.retention_fixture_ret_finish(first_e,'retained');
 report:=public.meta_creative_reporting_registry();insert into inventory_proof values(jsonb_build_object('stage','active','registry',report));
 perform pg_temp.inventory_assert(report->'steady'@>'[{"id":"99001","state":"active","current":true}]','confirmed activation');
 p:=public.landing_experiment_visit('assign',visit,'/acrylic-roof-pergolas-auckland',repeat('a',64),'99001','16','17');
 perform pg_temp.inventory_assert(p->>'kind'='steady'and p->'arm'='null'::jsonb,'steady receipt is not an arm');
 perform public.landing_experiment_visit('expose',visit,'/acrylic-roof-pergolas-auckland',repeat('a',64));
 payload:=jsonb_build_object('enquiryType','residential','name','Steady synthetic fixture','email','steady@example.invalid','phone','','phoneRaw','','suburb','Albany','files','[]'::jsonb,'page','/acrylic-roof-pergolas-auckland','message','A residential pergola in Auckland.',
  'rawPayload','{"requestType":"project-discussion","attribution":{"consent":{"analytics":true,"marketing":true},"utm":{"utm_source":"facebook","utm_medium":"paid_social","utm_campaign":"16","utm_term":"17","utm_content":"99001"}}}'::jsonb);
 select * into saved from public.marketing_experiment_intake(gen_random_uuid(),'',payload,visit);
 perform pg_temp.inventory_assert(public.meta_creative_steady_enquiry(saved.enquiry_request_id),'actual consented saved intake');
 select * into missing from public.marketing_experiment_intake(gen_random_uuid(),'',payload,null);
 select * into denied from public.marketing_experiment_intake(gen_random_uuid(),'',jsonb_set(payload,'{rawPayload,attribution,consent,marketing}','false'),visit);
 perform pg_temp.inventory_assert(not public.meta_creative_steady_enquiry(missing.enquiry_request_id)and not public.meta_creative_steady_enquiry(denied.enquiry_request_id),'missing/denied receipt remains unknown');
 perform pg_temp.inventory_assert((select count(*)=3 from public.enquiry_requests where id in(saved.enquiry_request_id,missing.enquiry_request_id,denied.enquiry_request_id)),'canonical enquiries preserved');
 select v into baseline from jsonb_array_elements(public.meta_creative_retained_ads())v where v->>'ad'='99001';
 second_e:=public.retention_fixture_ret_seed('21',baseline);perform public.retention_fixture_ret_effect(second_e,'create_retained','99002');
 cmd:=gen_random_uuid();p:=public.retention_fixture_ret_payload(second_e,'pause_previous');
 perform public.meta_creative_executor_command(repeat('b',64),cmd,second_e,'retention_admit',p);
 perform pg_temp.inventory_assert((select ends_at is null from public.meta_creative_steady_intervals('99001')),'prepared pause is not dispatch');
 perform public.meta_creative_executor_command(repeat('b',64),cmd,second_e,'retention_check',jsonb_build_object('requestHash',repeat('e',64)));
 perform pg_temp.inventory_assert((select ends_at is not null from public.meta_creative_steady_intervals('99001')),'uncertain pause closes confidence');
 perform pg_temp.inventory_assert(public.meta_creative_steady_ads()@>'[{"id":"99001","state":"uncertain"}]','uncertain state truthful');
 perform pg_temp.inventory_assert(public.landing_experiment_visit('assign',gen_random_uuid(),'/acrylic-roof-pergolas-auckland',repeat('a',64),'99001','16','17')->'assignment'='null'::jsonb,'no new exposure after dispatch');
 select * into late from public.marketing_experiment_intake(gen_random_uuid(),'',payload,visit);
 perform pg_temp.inventory_assert(public.meta_creative_steady_enquiry(late.enquiry_request_id),'valid late receipt after pause');
 report:=public.sanctuary_campaign_outcomes('a0000000-0000-4000-8000-000000000001','synthetic','binding','source',null,'test','a1000000-0000-4000-8000-000000000001');
 perform pg_temp.inventory_assert(report->'steadyAds'@>'[{"id":"99001","enquiries":2}]'and report->>'unmatchedCampaignEnquiries'='1','actual outcomes separate consented steady matches and missing receipt');
 perform pg_temp.inventory_assert(jsonb_array_length(report->'ads')=4 and jsonb_array_length(report->'creativeAds')=4,'outcomes preserve original/test identities');
 insert into inventory_proof values(jsonb_build_object('stage','late_outcomes','outcomes',report-'correspondence'-'enquiryReferenceHashes'));
 perform public.meta_creative_executor_command(repeat('b',64),cmd,second_e,'retention_confirm',jsonb_build_object('requestHash',repeat('e',64),'objectId','99001','evidenceHash',repeat('f',64)));
 p:=jsonb_build_object('generation',(select generation from public.meta_creative_control),'evidenceHash',repeat('a',64));
 perform public.meta_creative_executor_command(repeat('b',64),gen_random_uuid(),second_e,'retention_abort',p);
 perform public.retention_fixture_ret_effect(second_e,'pause_retained');perform public.retention_fixture_ret_effect(second_e,'restore_previous');perform public.retention_fixture_ret_finish(second_e,'reverted');
 perform pg_temp.inventory_assert((select count(*)=2 and count(*)filter(where ends_at is null)=1 from public.meta_creative_steady_intervals('99001')),'restore opens a distinct confirmed interval');
 report:=public.meta_creative_reporting_registry();insert into inventory_proof values(jsonb_build_object('stage','restored','registry',report));
 perform pg_temp.inventory_assert(report->'steady'@>'[{"id":"99001","current":true},{"id":"99002","state":"paused","current":false}]','rollback preserves both identities');
 third_e:=public.retention_fixture_ret_seed('21',baseline);perform public.retention_fixture_ret_effect(third_e,'create_retained','99003');perform public.retention_fixture_ret_effect(third_e,'pause_previous');perform public.retention_fixture_ret_effect(third_e,'activate_retained');perform public.retention_fixture_ret_finish(third_e,'retained');
 perform public.retention_fixture_ret_reject(format('select public.meta_creative_executor_command(%L,gen_random_uuid(),%L,%L,%L)',repeat('b',64),first_e,'retention_abort',p));
 report:=public.meta_creative_reporting_registry();insert into inventory_proof values(jsonb_build_object('stage','superseded','registry',report));
 perform pg_temp.inventory_assert(report->'steady'@>'[{"id":"99001","current":false,"state":"paused"},{"id":"99002","current":false,"state":"paused"},{"id":"99003","current":true,"state":"active"}]','replacement retains historical inventory');
 next_e:=public.retention_fixture_ret_seed('22');
 -- Synthetic future test window only. Its real cohort query must classify the
 -- exposure-linked steady enquiries as outside the exact two native arms.
 alter table public.meta_creative_execution disable trigger creative_execution_immutable;
 update public.meta_creative_execution set plan=plan||jsonb_build_object('start',floor(extract(epoch from clock_timestamp()-interval'1 day')),'end',floor(extract(epoch from clock_timestamp()+interval'1 day')),'evaluation',jsonb_build_object('ambiguity','finite_allocation_envelope_v1'))where experiment=next_e;
 alter table public.meta_creative_execution enable trigger creative_execution_immutable;
 insert into public.meta_creative_execution_receipts(command,experiment,stage,evidence_hash)values(gen_random_uuid(),next_e,'activation',repeat('a',64));
 p:=public.meta_creative_formal_cohort(repeat('b',64),next_e,false);
 perform pg_temp.inventory_assert(p#>>'{coverage,nativeMatched}'='0'and p#>>'{coverage,knownOtherRegistered}'='2'and p#>>'{coverage,unknownAttribution}'='2'and jsonb_array_length(p->'arms')=2,'next cohort keeps proven outside-test and unknown separate');
 insert into inventory_proof values(jsonb_build_object('stage','next_cohort','cohort',p));
 insert into public.meta_creative_execution_receipts(command,experiment,stage,evidence_hash)values(gen_random_uuid(),first_e,'activation',repeat('a',64));
 frozen_before:=public.meta_creative_formal_cohort(repeat('b',64),first_e,true);
 -- Each invalid variant is rolled back locally after proving canonical intake
 -- remains saved. No invalid provenance is promoted to a known outside arm.
 begin
  select * into invalid from public.marketing_experiment_intake(gen_random_uuid(),'',payload,null);
  perform pg_temp.inventory_assert(not public.meta_creative_steady_enquiry(invalid.enquiry_request_id)and exists(select 1 from public.enquiry_requests where id=invalid.enquiry_request_id),'late return without receipt saved but unknown');
  raise exception using errcode='P9901';
 exception when sqlstate 'P9901' then null;end;
 begin
  update public.enquiry_requests set utm=jsonb_build_object('utm_source','google','utm_campaign','16','utm_term','17','utm_content','99001')where id=saved.enquiry_request_id;
  perform pg_temp.inventory_assert(not public.meta_creative_steady_enquiry(saved.enquiry_request_id),'normalized source conflict denied');
  update public.enquiry_requests set utm=jsonb_build_object('utm_source','facebook','utm_medium','organic')where id=saved.enquiry_request_id;
  perform pg_temp.inventory_assert(not public.meta_creative_steady_enquiry(saved.enquiry_request_id),'normalized medium conflict denied');
  update public.enquiry_requests set utm=jsonb_build_object('utm_content','99003')where id=saved.enquiry_request_id;
  perform pg_temp.inventory_assert(not public.meta_creative_steady_enquiry(saved.enquiry_request_id),'different known ad cannot borrow receipt');
  raise exception using errcode='P9901';
 exception when sqlstate 'P9901' then null;end;
 begin
  update public.enquiry_requests set created_at=clock_timestamp()+interval'29 days'where id=saved.enquiry_request_id;
  perform pg_temp.inventory_assert(not public.meta_creative_steady_enquiry(saved.enquiry_request_id)and exists(select 1 from public.enquiry_requests where id=saved.enquiry_request_id),'expired exposure receipt does not remove canonical enquiry');
  raise exception using errcode='P9901';
 exception when sqlstate 'P9901' then null;end;
 begin
  cmd:=gen_random_uuid();
  -- A malformed synthetic historical row cannot gain reporting credit. Normal
  -- exposure commands already refuse this paused gap and immutable rows cannot
  -- be rewritten into it.
  insert into public.meta_creative_visits(id,experiment,ad_id,arm,page_path,template,copies,delivery_kind,created_at,exposed_at)
   select cmd,experiment,ad_id,arm,page_path,template,copies,delivery_kind,created_at,(select min(ends_at)+interval'1 microsecond'from public.meta_creative_steady_intervals('99001'))from public.meta_creative_visits where id=visit;
  select * into invalid from public.marketing_experiment_intake(gen_random_uuid(),'',payload,cmd);
  perform pg_temp.inventory_assert(not public.meta_creative_steady_enquiry(invalid.enquiry_request_id)and exists(select 1 from public.enquiry_requests where id=invalid.enquiry_request_id),'exposure in paused gap saved but unknown');
  raise exception using errcode='P9901';
 exception when sqlstate 'P9901' then null;end;
 perform pg_temp.inventory_assert(public.meta_creative_steady_enquiry(saved.enquiry_request_id),'independent invalid fixtures restored exactly');
 perform public.landing_experiment_visit('revoke',visit,'/acrylic-roof-pergolas-auckland',repeat('a',64));
 perform pg_temp.inventory_assert(not public.meta_creative_steady_enquiry(saved.enquiry_request_id)and not public.meta_creative_steady_enquiry(late.enquiry_request_id),'revocation removes attribution only');
 p:=public.meta_creative_formal_cohort(repeat('b',64),next_e,false);
 perform pg_temp.inventory_assert(p#>>'{coverage,knownOtherRegistered}'='0'and p#>>'{coverage,unknownAttribution}'='4','revoked attribution remains unknown in unfrozen cohort');
 perform pg_temp.inventory_assert((select count(*)=4 from public.enquiry_requests where id in(saved.enquiry_request_id,missing.enquiry_request_id,denied.enquiry_request_id,late.enquiry_request_id)),'revocation preserves saved enquiries');
 report:=public.sanctuary_campaign_outcomes('a0000000-0000-4000-8000-000000000001','synthetic','binding','source',null,'test','a1000000-0000-4000-8000-000000000001');
 perform pg_temp.inventory_assert(report->'steadyAds'@>'[{"id":"99001","enquiries":0}]'and report->>'unmatchedCampaignEnquiries'='3','revocation changes attribution without losing canonical enquiries');
 perform pg_temp.inventory_assert(public.meta_creative_formal_cohort(repeat('b',64),first_e,false)=frozen_before,'frozen historical cohort bytes preserved after revocation');
 perform pg_temp.inventory_assert(jsonb_array_length(public.meta_creative_retained_ads())<=4,'current winners bounded separately');
 perform pg_temp.inventory_assert((select count(*)=2 from public.meta_creative_registered_ads()where experiment=first_e),'original two arms unchanged');
end$$;
select pg_temp.inventory_assert(not has_function_privilege(role_name,'public.meta_creative_steady_ads()','EXECUTE'),'private projection ACL')from unnest(array['anon','authenticated','service_role'])role_name;
select jsonb_build_object('scope',jsonb_build_object('account',scope->>'account','campaign',scope->>'campaign','adset',scope->>'adset',
 'ads',(select jsonb_agg(jsonb_build_object('id',v,'label',(array['Riverhead photo','Riverhead video','Acrylic photo','Acrylic video'])[n]))from jsonb_array_elements_text(original_ads)with ordinality original(v,n)),
 'launchDay','2026-01-01','dailyAverage',400,'maximumDay',700,'weeklyAllowance',2800,'weekStartsOn',1,'weeklyWindowVerified',true),
 'stages',(select jsonb_agg(payload)from inventory_proof))from public.meta_creative_control;
rollback;
