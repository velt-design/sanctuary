begin;
-- Synthetic canonical facts exercise the actual replaced outcome function and
-- intake wrapper. Source delegation itself is unchanged and represented here by
-- a strict local stub. No provider, mailbox or customer operation is performed.
create function pg_temp.assert(ok boolean) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'Creative outcome preservation failed';end if;end$$;
create table private.sanctuary_meta_operations(id uuid primary key,query jsonb);
create function public.sanctuary_meta_command(uuid,text,text,text,uuid,text,text,uuid) returns jsonb language plpgsql as $$begin
 if $1 is distinct from 'a0000000-0000-4000-8000-000000000001'::uuid or $7 is distinct from 'deliver' then raise exception 'Denied source';end if;return '{}';end$$;
create table public.site_visit_events(project_id uuid,status text,confirmed_at timestamptz);
create table public.quotes(id uuid,project_id uuid);
create table public.quote_versions(id uuid,quote_id uuid,sent_at timestamptz,accepted_at timestamptz,status text);
create table public.xero_deposit_matches(project_id uuid,reversed_at timestamptz,amount_inc_gst_cents bigint);
create table public.deposit_invoices(project_id uuid,quote_version_id uuid,status text,payment_term_position integer,total_inc_gst_cents bigint);
create function public.commercial_current_accepted_quote_versions(uuid) returns table(quote_version_id uuid) language sql as $$select null::uuid where false$$;
insert into private.sanctuary_meta_operations values('a1000000-0000-4000-8000-000000000001','{"health":true,"scope":{"campaign":"16","adset":"17","launchDay":"2026-10-01","ads":[{"id":"18"},{"id":"19"},{"id":"20"},{"id":"21"}]}}');
insert into public.contacts(id,name,email)values('a2000000-0000-4000-8000-000000000001','Synthetic outcome fixture','fixture@example.invalid');
insert into public.projects(id,contact_id)values
 ('a3000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001'),
 ('10c5db1a-602c-4f0c-8193-855b186215bb','a2000000-0000-4000-8000-000000000001'),
 ('9d98b82b-679a-4ecb-8265-9fa05eaa78ef','a2000000-0000-4000-8000-000000000001');
-- Both launch-test IDs precede a genuine enquiry in an ordinary project. This
-- separately tests earliest-origin preservation, not just receipt exclusion.
insert into public.enquiry_requests(id,project_id,enquiry_type,created_at,raw_payload)
select id,project,'residential',stamp,'{"attribution":{"consent":{"marketing":true},"utm":{"utm_campaign":"16","utm_term":"17","utm_content":"18"}}}'::jsonb
from(values
 ('f3229ccf-6a1a-4e1a-bcf4-2edf5cc85e70'::uuid,'a3000000-0000-4000-8000-000000000001'::uuid,'2026-10-02T00:00:00Z'::timestamptz),
 ('fdb7aa7a-bb3f-4fb3-89ed-ac3483d21118','a3000000-0000-4000-8000-000000000001','2026-10-03T00:00:00Z'),
 ('a4000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001','2026-10-04T00:00:00Z'),
 ('a4000000-0000-4000-8000-000000000002','10c5db1a-602c-4f0c-8193-855b186215bb','2026-10-04T00:00:00Z'),
 ('a4000000-0000-4000-8000-000000000003','9d98b82b-679a-4ecb-8265-9fa05eaa78ef','2026-10-04T00:00:00Z'),
 ('a4000000-0000-4000-8000-000000000004',null,'2026-10-05T00:00:00Z')
) fixture(id,project,stamp);
insert into public.site_visit_events values('a3000000-0000-4000-8000-000000000001','CONFIRMED','2026-10-06T00:00:00Z');
insert into public.quotes values('a5000000-0000-4000-8000-000000000001','a3000000-0000-4000-8000-000000000001');
insert into public.quote_versions values('a6000000-0000-4000-8000-000000000001','a5000000-0000-4000-8000-000000000001','2026-10-07T00:00:00Z',null,'SENT');
do $$declare result jsonb;ad jsonb;begin
 result:=public.sanctuary_campaign_outcomes('a0000000-0000-4000-8000-000000000001','synthetic','binding','source',null,'test','a1000000-0000-4000-8000-000000000001');
 select value into ad from jsonb_array_elements(result->'ads')where value->>'id'='18';
 perform pg_temp.assert(ad->>'enquiries'='2' and ad->>'confirmedVisits'='1' and ad->>'quotedProjects'='1');
 perform pg_temp.assert(result#>>'{correspondence,total}'='2' and result#>>'{correspondence,eligible}'='1' and result#>>'{correspondence,unlinked}'='1');
 perform pg_temp.assert(result#>>'{correspondence,contacts,0,enquiryId}'='a4000000-0000-4000-8000-000000000001');
 perform pg_temp.assert(jsonb_array_length(result->'enquiryReferenceHashes')=2 and result->'creativeAds'='[]'::jsonb and result->>'unmatchedCampaignEnquiries'='0');
 begin perform public.sanctuary_campaign_outcomes(null,'synthetic','binding','source',null,'test','a1000000-0000-4000-8000-000000000001');raise exception 'Source denial bypassed';exception when raise_exception then if sqlerrm<>'Denied source' then raise;end if;end;
 perform pg_temp.assert((select count(*)from public.email_outbox)=0);
end$$;
rollback;
