begin;
-- Synthetic data only. The actor guard stands in for the existing scoped lease
-- in this disposable cluster, as in the preceding native reporting fixture.
create table private.sanctuary_meta_operations(id uuid primary key,query jsonb);
create function public.sanctuary_meta_command(uuid,text,text,text,uuid,text,text,uuid)returns jsonb language plpgsql as $$begin
 if $1 is distinct from 'a0000000-0000-4000-8000-000000000001'::uuid or $7 is distinct from 'deliver'then raise exception 'Denied source';end if;return '{}';end$$;
create table public.site_visit_events(project_id uuid,status text,confirmed_at timestamptz);
create table public.quotes(id uuid,project_id uuid);
create table public.quote_versions(id uuid,quote_id uuid,sent_at timestamptz,accepted_at timestamptz,status text);
create table public.xero_deposit_matches(project_id uuid,reversed_at timestamptz,amount_inc_gst_cents bigint);
create table public.deposit_invoices(project_id uuid,quote_version_id uuid,status text,payment_term_position integer,total_inc_gst_cents bigint);
create function public.commercial_current_accepted_quote_versions(uuid)returns table(quote_version_id uuid)language sql as $$select null::uuid where false$$;

insert into private.sanctuary_meta_operations values
 ('a1000000-0000-4000-8000-000000000001','{"health":true,"scope":{"account":"99100","campaign":"99200","adset":"99300","launchDay":"2026-01-01","ads":[{"id":"99401"},{"id":"99402"},{"id":"99403"},{"id":"99404"}]}}');
create function pg_temp.ordinary_outcomes() returns jsonb language sql as $$
 select public.sanctuary_campaign_outcomes('a0000000-0000-4000-8000-000000000001','99100','binding','source',null,'test','a1000000-0000-4000-8000-000000000001');
$$;
do $$begin
 if public.meta_creative_reporting_registry()->>'version'<>'2' or pg_temp.ordinary_outcomes()?'ordinaryAds' then
   raise exception 'Empty registry must preserve legacy payloads';
 end if;
 if has_table_privilege('service_role','private.meta_ordinary_reporting_ads','SELECT,INSERT,UPDATE,DELETE')
  or has_table_privilege('authenticated','private.meta_ordinary_reporting_ads','SELECT,INSERT,UPDATE,DELETE')
  or has_table_privilege('anon','private.meta_ordinary_reporting_ads','SELECT,INSERT,UPDATE,DELETE') then
   raise exception 'Ordinary inventory is operator-only';
 end if;
end$$;
insert into private.meta_ordinary_reporting_ads values
 ('99501','Sample deck','99100','99200','99300','/projects/sample-deck',statement_timestamp()-interval '2 days',null),
 ('99502','Sample courtyard','99100','99200','99300','/projects/sample-courtyard',statement_timestamp()-interval '1 day',null),
 ('99503','Sample terrace','99100','99200','99300','/auckland-outdoor-living',statement_timestamp()-interval '1 day',null),
 ('99504','Retired sample','99100','99200','99300','/auckland-outdoor-living',statement_timestamp()-interval '2 days',statement_timestamp()-interval '1 day');
insert into public.contacts(id,name,email) values('b2000000-0000-4000-8000-000000000001','Synthetic contact','example@example.invalid');
insert into public.projects(id,contact_id) values('b3000000-0000-4000-8000-000000000001','b2000000-0000-4000-8000-000000000001');
insert into public.enquiry_requests(id,project_id,enquiry_type,page,created_at,raw_payload)
select id,project,'residential','/contact',stamp,
 jsonb_build_object('attribution',jsonb_build_object('consent',jsonb_build_object('marketing',consent),'verification',verification,
  'utm',jsonb_build_object('utm_campaign','99200','utm_term',adset,'utm_content',ad)))
from(values
 ('b4000000-0000-4000-8000-000000000001'::uuid,'b3000000-0000-4000-8000-000000000001'::uuid,clock_timestamp()-interval'5 hours','99501','99300',true,false),
 ('b4000000-0000-4000-8000-000000000002','b3000000-0000-4000-8000-000000000001',clock_timestamp()-interval'3 hours','99502','99300',true,false),
 ('b4000000-0000-4000-8000-000000000003',null,clock_timestamp()-interval'1 hour','99504','99300',true,false),
 ('b4000000-0000-4000-8000-000000000004',null,clock_timestamp()-interval'1 hour','99501','99301',true,false),
 ('b4000000-0000-4000-8000-000000000005',null,clock_timestamp()-interval'1 hour','99501','99300',false,false),
 ('b4000000-0000-4000-8000-000000000006',null,clock_timestamp()-interval'3 days','99501','99300',true,false),
 ('b4000000-0000-4000-8000-000000000007','b3000000-0000-4000-8000-000000000001',clock_timestamp()-interval'6 hours','99502','99300',true,true),
 ('b4000000-0000-4000-8000-000000000008',null,clock_timestamp()+interval'1 day','99501','99300',true,false)
) f(id,project,stamp,ad,adset,consent,verification);
insert into private.enquiry_qualification_events(enquiry_id,state,version)
 values('b4000000-0000-4000-8000-000000000001','qualified',1);
insert into public.site_visit_events values('b3000000-0000-4000-8000-000000000001','CONFIRMED',clock_timestamp());
insert into public.quotes values('b5000000-0000-4000-8000-000000000001','b3000000-0000-4000-8000-000000000001');
insert into public.quote_versions values('b6000000-0000-4000-8000-000000000001','b5000000-0000-4000-8000-000000000001',clock_timestamp(),null,'SENT');
insert into public.xero_deposit_matches values('b3000000-0000-4000-8000-000000000001',null,100);
do $$declare registry jsonb:=public.meta_creative_reporting_registry(); result jsonb:=pg_temp.ordinary_outcomes();begin
 if registry->>'version'<>'3' or jsonb_array_length(registry->'ordinary')<>4
  or registry->'experimental'<>'[]'::jsonb or registry->'steady'<>'[]'::jsonb or jsonb_array_length(result->'ads')<>4 then
   raise exception 'Ordinary rows displaced other inventory';
 end if;
 if result->'ordinaryAds' is distinct from '[
  {"id":"99501","enquiries":1,"qualified":1,"unreviewed":0,"confirmedVisits":1,"quotedProjects":1,"acceptedProjects":0,"paidProjects":1},
  {"id":"99502","enquiries":1,"qualified":0,"unreviewed":1,"confirmedVisits":0,"quotedProjects":0,"acceptedProjects":0,"paidProjects":0},
  {"id":"99503","enquiries":0,"qualified":0,"unreviewed":0,"confirmedVisits":0,"quotedProjects":0,"acceptedProjects":0,"paidProjects":0},
  {"id":"99504","enquiries":1,"qualified":0,"unreviewed":1,"confirmedVisits":0,"quotedProjects":0,"acceptedProjects":0,"paidProjects":0}]'::jsonb then
   raise exception 'Ordinary joins, origin dedup, consent, timing, retired returns, or zero row differ';
 end if;
 if result#>>'{correspondence,total}'<>'0' or result->'enquiryReferenceHashes'<>'[]'::jsonb
   or result->>'unmatchedCampaignEnquiries'<>'3' then raise exception 'Analysis cohort widened or coverage misstated';end if;
 begin
   insert into private.meta_ordinary_reporting_ads
   select (99700+i)::text,'Synthetic overflow','99100','99200','99300','/auckland-outdoor-living',statement_timestamp(),null
   from generate_series(1,37)i;
   perform public.meta_creative_reporting_registry();
   raise exception 'Expected inventory bound';
 exception when others then if sqlerrm<>'Campaign inventory exceeds bound' then raise;end if;end;
end$$;
select jsonb_build_object('registry',public.meta_creative_reporting_registry(),'outcomes',pg_temp.ordinary_outcomes());
rollback;
