begin;
-- Synthetic scope and business facts in the existing disposable PG harness.
-- Provider/source authorization is represented by the same deny-by-default stub
-- as the historical campaign outcome fixtures. No mailbox/provider call occurs.
select pg_advisory_xact_lock(819421,1);
delete from public.acquisition_experiment_reservation;
truncate public.meta_creative_plans cascade;
create temporary table manual_reporting_checks(kind text,label text);
create temporary table manual_reporting_evidence(kind text,value jsonb);
create function pg_temp.manual_assert(ok boolean,label text)returns void language plpgsql as $$begin
 if ok is distinct from true then raise exception 'Manual reporting: %',label;end if;
 insert into manual_reporting_checks values('assert',label);
end$$;
create function pg_temp.manual_denied(statement text,label text)returns void language plpgsql as $$begin
 begin execute statement;raise exception 'Unexpectedly accepted manual reporting';
 exception when others then if sqlerrm='Unexpectedly accepted manual reporting'then raise;end if;end;
 insert into manual_reporting_checks values('denial',label);
end$$;
create table private.sanctuary_meta_operations(id uuid primary key,query jsonb);
create function public.sanctuary_meta_command(uuid,text,text,text,uuid,text,text,uuid)returns jsonb language plpgsql as $$begin
 if $1 is distinct from 'a0000000-0000-4000-8000-000000000001'::uuid or $7 is distinct from 'deliver'then raise exception 'Denied source';end if;return '{}';end$$;
create table public.site_visit_events(project_id uuid,status text,confirmed_at timestamptz);
create table public.quotes(id uuid,project_id uuid);
create table public.quote_versions(id uuid,quote_id uuid,sent_at timestamptz,accepted_at timestamptz,status text);
create table public.xero_deposit_matches(project_id uuid,reversed_at timestamptz,amount_inc_gst_cents bigint);
create table public.deposit_invoices(project_id uuid,quote_version_id uuid,status text,payment_term_position integer,total_inc_gst_cents bigint);
create function public.commercial_current_accepted_quote_versions(uuid)returns table(quote_version_id uuid)language sql as $$select null::uuid where false$$;
insert into private.sanctuary_meta_operations values('a1000000-0000-4000-8000-000000000001','{"health":true,"scope":{"campaign":"120254691313600745","adset":"120254691313610745","launchDay":"2026-10-01","ads":[{"id":"120254691313640745"},{"id":"120254694264800745"},{"id":"120254694264810745"},{"id":"120254694264820745"}]}}');
create function pg_temp.manual_insert(control_id text default '99900001',challenger_id text default '99900002',test_id uuid default 'b0000000-0000-4000-8000-000000000001',start_time timestamptz default statement_timestamp()-interval'14days',end_time timestamptz default statement_timestamp()-interval'1day')returns void language sql as $$
 insert into private.meta_native_creative_reporting_tests(native_test,account_id,campaign_id,adset_id,page_id,donor_ad,control_ad,challenger_ad,page_path,landing_template,starts_at,ends_at,registration_receipt_hash,independent_review_hash,registered_at)
 values(test_id,'231087348606622','120254691313600745','120254691313610745','304692390429608','120254694264810745',control_id,challenger_id,'/acrylic-roof-pergolas-auckland',repeat('a',64),start_time,end_time,repeat('b',64),repeat('c',64),statement_timestamp()-interval'15days');
$$;
-- Declared future display window does not erase known late campaign enquiries.
do $$declare r jsonb;before_rows jsonb;begin
 perform pg_temp.manual_assert((select relrowsecurity from pg_class where oid='private.meta_native_creative_reporting_tests'::regclass),'inventory RLS');
 perform pg_temp.manual_assert(not has_table_privilege('service_role','private.meta_native_creative_reporting_tests','SELECT,INSERT,UPDATE,DELETE'),'no service table access');
 perform pg_temp.manual_assert(not has_table_privilege('anon','private.meta_native_creative_reporting_tests','SELECT,INSERT,UPDATE,DELETE'),'no anon table access');
 perform pg_temp.manual_assert(not has_table_privilege('authenticated','private.meta_native_creative_reporting_tests','SELECT,INSERT,UPDATE,DELETE'),'no browser table access');
 perform pg_temp.manual_denied('select pg_temp.manual_insert(''120254694264810745'')','original collision');
 perform pg_temp.manual_denied('select pg_temp.manual_insert(''99900001'',''99900001'')','duplicate arms');
 perform pg_temp.manual_denied('select pg_temp.manual_insert(''not-an-id'')','invalid ID');
 perform pg_temp.manual_denied('select pg_temp.manual_insert(end_time=>clock_timestamp()+interval''15days'')','unbounded window');
 insert into public.meta_creative_plans(id,plan,plan_hash)values('b0000000-0000-4000-8000-000000000002','{}',repeat('d',64));
 insert into public.meta_creative_execution(experiment,plan,plan_hash)values('b0000000-0000-4000-8000-000000000002','{}',repeat('e',64));
 perform pg_temp.manual_denied('select pg_temp.manual_insert(test_id=>''b0000000-0000-4000-8000-000000000002'')','execution UUID collision');
 -- Inventory identity is truthful even with a Source object lacking registry join.
 insert into public.meta_creative_effects(command,experiment,command_hash,request_hash,kind,generation,pre_state_hash,state,object_id,evidence_hash)
 values('b0000000-0000-4000-8000-000000000003','b0000000-0000-4000-8000-000000000002',repeat('a',64),repeat('a',64),'create_paused_ad',1,repeat('a',64),'confirmed','99900003',repeat('a',64));
 insert into public.meta_creative_objects(object_id,experiment,kind,created_by,request_hash,evidence_hash)
 values('99900003','b0000000-0000-4000-8000-000000000002','ad','b0000000-0000-4000-8000-000000000003',repeat('a',64),repeat('a',64));
 perform pg_temp.manual_denied('select pg_temp.manual_insert(''99900003'')','owned object collision');
 select jsonb_build_object('effects',(select jsonb_agg(to_jsonb(t))from public.meta_creative_effects t),'execution',(select jsonb_agg(to_jsonb(t))from public.meta_creative_execution t),'objects',(select jsonb_agg(to_jsonb(t))from public.meta_creative_objects t),'assignments',(select count(*)from public.meta_creative_visits))into before_rows;
 perform pg_temp.manual_insert();r:=public.meta_creative_reporting_registry();
 perform pg_temp.manual_assert(r->>'version'='2'and jsonb_array_length(r->'experimental')=2 and r->'steady'='[]'::jsonb,'compatible version2 inventory');
 perform pg_temp.manual_assert((select count(*)=2 from jsonb_array_elements(r->'experimental')v where v->>'purpose'='formal_experiment'and v->>'delivery'='false'and v->>'template'=repeat('a',64)),'registration is not delivery');
 perform pg_temp.manual_assert((select count(distinct v->>'arm')=2 from jsonb_array_elements(r->'experimental')v),'exact two arms');
 perform pg_temp.manual_assert(not r::text like '%meta_native_ui%'and not r::text like '%receipt_hash%','private provenance not exported');
 perform pg_temp.manual_denied('select pg_temp.manual_insert()','singleton duplicate');
 perform pg_temp.manual_denied('update private.meta_native_creative_reporting_tests set control_ad=''99900004''','identity immutable');
 perform pg_temp.manual_denied('delete from private.meta_native_creative_reporting_tests','history retained');
 update private.meta_native_creative_reporting_tests set published_at=statement_timestamp()-interval'14days',publication_receipt_hash=repeat('f',64);
 perform pg_temp.manual_assert((select bool_and((v->>'delivery')::boolean)from jsonb_array_elements(public.meta_creative_reporting_registry()->'experimental')v),'explicit publication evidence');
 perform pg_temp.manual_denied('update private.meta_native_creative_reporting_tests set published_at=null,publication_receipt_hash=null','publication cannot be erased');
 perform pg_temp.manual_assert(before_rows=jsonb_build_object('effects',(select jsonb_agg(to_jsonb(t))from public.meta_creative_effects t),'execution',(select jsonb_agg(to_jsonb(t))from public.meta_creative_execution t),'objects',(select jsonb_agg(to_jsonb(t))from public.meta_creative_objects t),'assignments',(select count(*)from public.meta_creative_visits)),'no fake effect/execution/object/assignment');
end$$;
insert into public.contacts(id,name,email)values('b2000000-0000-4000-8000-000000000001','Synthetic native report','native@example.invalid');
insert into public.projects(id,contact_id)values('b3000000-0000-4000-8000-000000000001','b2000000-0000-4000-8000-000000000001');
-- One genuine project receipt, one known late ID, one unknown ID, and one denied consent.
insert into public.enquiry_requests(id,project_id,enquiry_type,page,suburb,message,created_at,raw_payload)
select id,project,'residential','/acrylic-roof-pergolas-auckland','Albany','Synthetic fixture',stamp,
 jsonb_build_object('suburb','Albany','message','Synthetic fixture','attribution',jsonb_build_object('consent',jsonb_build_object('marketing',consent),'utm',jsonb_build_object('utm_source','facebook','utm_medium','paid_social','utm_campaign','120254691313600745','utm_term','120254691313610745','utm_content',ad)))
from(values
 ('b4000000-0000-4000-8000-000000000001'::uuid,'b3000000-0000-4000-8000-000000000001'::uuid,clock_timestamp()-interval'5days','99900001',true),
 ('b4000000-0000-4000-8000-000000000002',null,clock_timestamp()-interval'1hour','99900002',true),
 ('b4000000-0000-4000-8000-000000000003',null,clock_timestamp(),'99999999',true),
 ('b4000000-0000-4000-8000-000000000004',null,clock_timestamp(),'99900001',false)
)f(id,project,stamp,ad,consent);
-- Current peer policy excludes an audited test project, explicit verification
-- receipt and consented reserved QA source. An earlier verification submission
-- must not steal genuine origin credit on the same project.
insert into public.projects(id,contact_id)values('b3000000-0000-4000-8000-000000000002','b2000000-0000-4000-8000-000000000001');
insert into private.project_sales_outcomes values('b3000000-0000-4000-8000-000000000002','test');
insert into public.enquiry_requests(id,project_id,enquiry_type,page,created_at,raw_payload)
select id,project,'residential','/acrylic-roof-pergolas-auckland',stamp,payload from(values
 ('b4000000-0000-4000-8000-000000000005'::uuid,'b3000000-0000-4000-8000-000000000001'::uuid,clock_timestamp()-interval'6days','{"attribution":{"verification":true,"consent":{"marketing":true},"utm":{"utm_source":"facebook","utm_medium":"paid_social","utm_campaign":"120254691313600745","utm_term":"120254691313610745","utm_content":"99900001"}}}'::jsonb),
 ('b4000000-0000-4000-8000-000000000006','b3000000-0000-4000-8000-000000000002',clock_timestamp()-interval'2days','{"attribution":{"consent":{"marketing":true},"utm":{"utm_source":"facebook","utm_medium":"paid_social","utm_campaign":"120254691313600745","utm_term":"120254691313610745","utm_content":"99900001"}}}'),
 ('b4000000-0000-4000-8000-000000000007',null,clock_timestamp(),' {"attribution":{"consent":{"marketing":true},"utm":{"utm_source":"codex_qa","utm_medium":"qa","utm_campaign":"120254691313600745","utm_term":"120254691313610745","utm_content":"99900001"}}}')
)f(id,project,stamp,payload);
insert into private.enquiry_qualification_events(enquiry_id,state,version)values('b4000000-0000-4000-8000-000000000001','qualified',1);
insert into public.site_visit_events values('b3000000-0000-4000-8000-000000000001','CONFIRMED',clock_timestamp());
insert into public.quotes values('b5000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000001');
insert into public.quote_versions values('b6000000-0000-4000-8000-000000000001','b5000000-0000-4000-8000-000000000001',clock_timestamp(),null,'SENT');
insert into public.xero_deposit_matches values('b3000000-0000-4000-8000-000000000001',null,100);
do $$declare result jsonb;ad jsonb;begin
 result:=public.sanctuary_campaign_outcomes('a0000000-0000-4000-8000-000000000001','synthetic','binding','source',null,'test','a1000000-0000-4000-8000-000000000001');
 select value into ad from jsonb_array_elements(result->'creativeAds')where value->>'id'='99900001';
 perform pg_temp.manual_assert(ad->>'enquiries'='1'and ad->>'qualified'='1'and ad->>'confirmedVisits'='1'and ad->>'quotedProjects'='1'and ad->>'paidProjects'='1','exact project business joins');
 perform pg_temp.manual_assert((select value->>'enquiries'='1'from jsonb_array_elements(result->'creativeAds')where value->>'id'='99900002'),'late known enquiry retained');
 perform pg_temp.manual_assert(result#>>'{correspondence,total}'='2'and result#>>'{correspondence,eligible}'='1'and result#>>'{correspondence,contacts,0,intake,provenance}'='meta_form_user_text','same scoped Outlook/intake cohort');
 perform pg_temp.manual_assert(jsonb_array_length(result->'enquiryReferenceHashes')=2 and result->>'unmatchedCampaignEnquiries'='1','unknown ID retained unknown; consent excluded');
 perform pg_temp.manual_assert(jsonb_array_length(result->'ads')=4,'original four outcomes retained');
 perform pg_temp.manual_assert(not exists(select 1 from jsonb_array_elements_text(result->'enquiryReferenceHashes')v where v in(encode(sha256(convert_to('sp_enq_b4000000-0000-4000-8000-000000000005','UTF8')),'hex'),encode(sha256(convert_to('sp_enq_b4000000-0000-4000-8000-000000000006','UTF8')),'hex'),encode(sha256(convert_to('sp_enq_b4000000-0000-4000-8000-000000000007','UTF8')),'hex'))),'current shared test predicates retained');
 insert into manual_reporting_evidence values('registry',public.meta_creative_reporting_registry()),('outcomes',result);
 perform pg_temp.manual_denied('select public.sanctuary_campaign_outcomes(null,''synthetic'',''binding'',''source'',null,''test'',''a1000000-0000-4000-8000-000000000001'')','source authorization unchanged');
end$$;
-- Clearing an audited test classification restores that real receipt through the
-- same current helper; this migration owns no test/customer record write.
delete from private.project_sales_outcomes where project_id='b3000000-0000-4000-8000-000000000002';
do $$declare r jsonb;begin r:=public.sanctuary_campaign_outcomes('a0000000-0000-4000-8000-000000000001','synthetic','binding','source',null,'test','a1000000-0000-4000-8000-000000000001');perform pg_temp.manual_assert((select value->>'enquiries'='2'from jsonb_array_elements(r->'creativeAds')where value->>'id'='99900001'),'cleared audited test returns through existing helper');end$$;
-- The existing Source registry remains the owner of Source-created ads. Synthetic
-- root rows below exercise only collisions/capacity after manual registration.
insert into public.meta_creative_plans(id,plan,plan_hash)values('b0000000-0000-4000-8000-000000000005','{}',repeat('8',64));
insert into public.meta_creative_execution(experiment,plan,plan_hash)values('b0000000-0000-4000-8000-000000000005',
 jsonb_build_object('scope',jsonb_build_object('campaign','120254691313600745','adset','120254691313610745','page','304692390429608'),'control',jsonb_build_object('path','/acrylic-roof-pergolas-auckland'),'landingTemplate',repeat('a',64),'purpose','formal_experiment','start',1793098800,'end',1794308400),repeat('9',64));
create function pg_temp.manual_source_ad(ad text)returns void language plpgsql as $$declare cmd uuid:=gen_random_uuid();begin
 insert into public.meta_creative_effects(command,experiment,command_hash,request_hash,kind,generation,pre_state_hash,state,object_id,evidence_hash)
 values(cmd,'b0000000-0000-4000-8000-000000000005',repeat('a',64),repeat('a',64),'create_paused_ad',1,repeat('a',64),'confirmed',ad,repeat('a',64));
 insert into public.meta_creative_execution_intents(command,experiment,kind,intent)values(cmd,'b0000000-0000-4000-8000-000000000005','create_control','{}');
 insert into public.meta_creative_objects(object_id,experiment,kind,created_by,request_hash,evidence_hash)
 values(ad,'b0000000-0000-4000-8000-000000000005','ad',cmd,repeat('a',64),repeat('a',64));
end$$;
do $$begin
 begin perform pg_temp.manual_source_ad('99900001');perform public.meta_creative_reporting_registry();raise exception 'Collision accepted';
 exception when others then if sqlerrm<>'Campaign reporting ID collision'then raise;end if;end;
 perform pg_temp.manual_assert(true,'later execution collision denied without multiplying facts');
 for i in 1..38 loop perform pg_temp.manual_source_ad((99910000+i)::text);end loop;
 perform pg_temp.manual_assert(jsonb_array_length(public.meta_creative_reporting_registry()->'experimental')=40,'combined40 includes manual pair');
 perform pg_temp.manual_source_ad('99910039');
 perform pg_temp.manual_denied('select public.meta_creative_reporting_registry()','combined41 denied');
 perform pg_temp.manual_denied('select public.sanctuary_campaign_outcomes(''a0000000-0000-4000-8000-000000000001'',''synthetic'',''binding'',''source'',null,''test'',''a1000000-0000-4000-8000-000000000001'')','overflow cannot multiply outcome joins');
end$$;
select jsonb_build_object('checks',count(*),'assertions',count(*)filter(where kind='assert'),'denials',count(*)filter(where kind='denial'),'reportingOnly',true,'providerCalls',0,'registry',(select value from manual_reporting_evidence where kind='registry'),'outcomes',(select value from manual_reporting_evidence where kind='outcomes'))from manual_reporting_checks;
rollback;
