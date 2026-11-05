begin;

-- Operator-owned reporting inventory. It carries no provider write authority,
-- experiment identity, or credentials. Register the exact reviewed IDs privately.
create table private.meta_ordinary_reporting_ads (
 ad_id text primary key check (ad_id ~ '^[1-9][0-9]{0,19}$'),
 label text not null check (label=trim(label) and char_length(label) between 1 and 100 and label !~ '[[:cntrl:]]'),
 account_id text not null check (account_id ~ '^[1-9][0-9]{0,19}$'),
 campaign_id text not null check (campaign_id ~ '^[1-9][0-9]{0,19}$'),
 adset_id text not null check (adset_id ~ '^[1-9][0-9]{0,19}$'),
 path text not null check (char_length(path)<=120 and path ~ '^/(auckland-outdoor-living|acrylic-roof-pergolas-auckland|projects/[a-z0-9]+(-[a-z0-9]+)*)$'),
 starts_at timestamptz not null check (isfinite(starts_at)),
 retired_at timestamptz check (isfinite(retired_at) and retired_at>starts_at)
);
alter table private.meta_ordinary_reporting_ads enable row level security;
revoke all on private.meta_ordinary_reporting_ads from public,anon,authenticated,service_role;

-- Extend the reviewed predecessor in place so existing collision checks,
-- function identity and grants survive without copying private deployment values.
do $migration$
declare registry oid:=to_regprocedure('public.meta_creative_reporting_registry()');
 outcome oid:=to_regprocedure('public.sanctuary_campaign_outcomes_without_intake(uuid,text,text,text,uuid,text,uuid)');
 definition text;
begin
 if (select md5(replace(prosrc,chr(13),'')) from pg_proc where oid=registry) is distinct from '901d4cb7836ac38c08e7f25f2c2d9658'
 or (select md5(replace(prosrc,chr(13),'')) from pg_proc where oid=outcome) is distinct from 'd211d6314f90cddc491060527657c969'
 then raise exception 'Campaign reporting predecessor differs';end if;
 definition:=replace(pg_get_functiondef(registry),chr(13),'');
 definition:=replace(definition,'manual jsonb;','manual jsonb;ordinary jsonb;');
 definition:=replace(definition,' if jsonb_array_length(experimental)+jsonb_array_length(steady)>40',$replace$ select coalesce(jsonb_agg(jsonb_build_object('id',a.ad_id,'label',a.label,'account',a.account_id,
  'campaign',a.campaign_id,'adset',a.adset_id,'path',a.path,'startsAt',a.starts_at,'retiredAt',a.retired_at) order by a.starts_at,a.ad_id),'[]') into ordinary
 from private.meta_ordinary_reporting_ads a;
 if jsonb_array_length(experimental)+jsonb_array_length(steady)+jsonb_array_length(ordinary)>40$replace$);
 definition:=replace(definition,'jsonb_array_elements(experimental||steady)','jsonb_array_elements(experimental||steady||ordinary)');
 definition:=replace(definition,$replace$ return jsonb_build_object('version',2,'experimental',experimental,'steady',steady);$replace$,
 $replace$ if ordinary='[]'::jsonb then return jsonb_build_object('version',2,'experimental',experimental,'steady',steady);end if;
 return jsonb_build_object('version',3,'experimental',experimental,'steady',steady,'ordinary',ordinary);$replace$);
 execute definition;
end $migration$;

create or replace function public.sanctuary_campaign_outcomes_without_intake(p_actor uuid,p_account text,p_binding text,p_source text,p_connection uuid,p_environment text,p_operation uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; n integer; scope jsonb; launch timestamptz;
begin
 -- Reuse exact source/actor/current-generation/kill/expiry/delivery checks.
 perform public.sanctuary_meta_command(p_actor,p_account,p_binding,p_source,p_connection,p_environment,'deliver',p_operation);
 if not exists(select 1 from private.sanctuary_meta_operations where id=p_operation and query::jsonb->>'health'='true') then raise exception 'Wrong evidence purpose';end if;
 -- Validate the complete reporting set before UNION ALL can multiply facts.
 perform public.meta_creative_reporting_registry();
 select query::jsonb->'scope' into scope from private.sanctuary_meta_operations where id=p_operation;
 launch:=(scope->>'launchDay')::date::timestamp at time zone 'Pacific/Auckland';
 select count(*) into n from public.enquiry_requests where created_at>=launch;
 if n>2000 then raise exception 'Campaign cohort exceeds bound';end if;
 with receipts as materialized (
   select e.*, coalesce(e.raw_payload#>>'{attribution,utm,utm_content}',e.utm->>'utm_content') ad,
     coalesce(e.raw_payload#>>'{attribution,utm,utm_term}',e.utm->>'utm_term') adset
   from public.enquiry_requests e where e.created_at>=launch
   and e.raw_payload#>>'{attribution,consent,marketing}'='true'
   and coalesce(e.raw_payload#>>'{attribution,utm,utm_campaign}',e.utm->>'utm_campaign')=scope->>'campaign'
   and not private.marketing_test_enquiry(e.id,e.project_id)
   and (e.project_id is null or not private.marketing_test_project(e.project_id))
 ), ads(id,delivery_kind,starts_at) as (select value->>'id','original',null::timestamptz from jsonb_array_elements(scope->'ads')
   union all select r.ad_id,'native',null::timestamptz from public.meta_creative_registered_ads() r join public.meta_creative_execution x on x.experiment=r.experiment
    where r.campaign_id=scope->>'campaign' and r.adset_id=scope->>'adset' and x.plan->>'purpose'='formal_experiment'
   union all select r->>'id','steady',null::timestamptz from jsonb_array_elements(public.meta_creative_steady_ads())r where r->>'campaign'=scope->>'campaign'and r->>'adset'=scope->>'adset'
   union all select ad,'native',null::timestamptz from private.meta_native_creative_reporting_tests t cross join lateral(values(t.control_ad),(t.challenger_ad))a(ad)
    where t.campaign_id=scope->>'campaign'and t.adset_id=scope->>'adset'
   union all select a.ad_id,'ordinary',a.starts_at from private.meta_ordinary_reporting_ads a
    where a.account_id=scope->>'account' and a.campaign_id=scope->>'campaign' and a.adset_id=scope->>'adset'),
 included as materialized (select e.*, a.delivery_kind from receipts e join ads a on a.id=e.ad
   where e.adset=scope->>'adset' and (a.delivery_kind<>'steady' or public.meta_creative_steady_enquiry(e.id))
   and (a.starts_at is null or (e.created_at>=a.starts_at and e.created_at<=statement_timestamp()))),
 -- Ordinary ads extend the saved report only, preserving the established Outlook and model cohort.
 correspondence_cohort as materialized (select * from included where delivery_kind<>'ordinary'),
 facts as materialized (
   select e.*, (select state from private.enquiry_qualification_events where enquiry_id=e.id order by version desc limit 1) qualification,
     e.id=(select r.id from public.enquiry_requests r where r.project_id=e.project_id and not private.marketing_test_enquiry(r.id,r.project_id) order by r.created_at,r.id limit 1) origin,
     exists(select 1 from public.site_visit_events v where v.project_id=e.project_id and (to_jsonb(v)->>'confirmed_at' is not null or v.status='CONFIRMED')) visited,
     exists(select 1 from public.quotes q join public.quote_versions v on v.quote_id=q.id where q.project_id=e.project_id and (v.sent_at is not null or v.accepted_at is not null or v.status in ('SENT','ACCEPTED'))) quoted,
     exists(select 1 from public.commercial_current_accepted_quote_versions(e.project_id)) accepted,
     (exists(select 1 from public.xero_deposit_matches m where m.project_id=e.project_id and m.reversed_at is null and m.amount_inc_gst_cents>0)
       or exists(select 1 from public.deposit_invoices i join public.commercial_current_accepted_quote_versions(e.project_id) a on a.quote_version_id=i.quote_version_id
         where i.project_id=e.project_id and i.status='PAID' and i.payment_term_position=1 and i.total_inc_gst_cents>0)) paid
   from included e
 ), identities as materialized (
   select e.id,e.ad,e.created_at,p.id project_id,c.id contact_id,lower(trim(c.email)) email,
     greatest(e.created_at,coalesce((to_jsonb(p)->>'updated_at')::timestamptz,e.created_at),coalesce((to_jsonb(c)->>'updated_at')::timestamptz,e.created_at)) changed_at,
     (select count(*)>1 from public.projects other join public.contacts mailbox_contact on mailbox_contact.id=other.contact_id
       where lower(trim(mailbox_contact.email))=lower(trim(c.email))) multiple_projects
   from correspondence_cohort e join public.projects p on p.id=e.project_id join public.contacts c on c.id=p.contact_id
   where c.email~'^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+$' and length(c.email)<=254
     and coalesce(to_jsonb(e)->>'contact_id',p.contact_id::text)=p.contact_id::text
 ), selected_identities as (
   select * from identities order by (created_at>=clock_timestamp()-interval '2 days') desc,
     md5(id::text||(clock_timestamp() at time zone 'Pacific/Auckland')::date::text) limit 200
 ), counts as (
   select a.id,a.delivery_kind,count(f.id) enquiries,count(f.id) filter(where qualification='qualified') qualified,
     count(f.id) filter(where qualification is null or qualification='unreviewed') unreviewed,
     count(distinct project_id) filter(where origin and visited) visits,count(distinct project_id) filter(where origin and quoted) quoted,
     count(distinct project_id) filter(where origin and accepted) accepted,count(distinct project_id) filter(where origin and paid) paid
   from ads a left join facts f on f.ad=a.id group by a.id,a.delivery_kind
 ) select jsonb_build_object('observedAt',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'cohortStart',scope->>'launchDay',
   'ads',(select jsonb_agg(jsonb_build_object('id',id,'enquiries',enquiries,'qualified',qualified,'unreviewed',unreviewed,'confirmedVisits',visits,
     'quotedProjects',quoted,'acceptedProjects',accepted,'paidProjects',paid) order by id) from counts where delivery_kind='original'),
   'creativeAds',coalesce((select jsonb_agg(jsonb_build_object('id',id,'enquiries',enquiries,'qualified',qualified,'unreviewed',unreviewed,'confirmedVisits',visits,
     'quotedProjects',quoted,'acceptedProjects',accepted,'paidProjects',paid) order by id) from counts where delivery_kind='native'),'[]'),
   'steadyAds',coalesce((select jsonb_agg(jsonb_build_object('id',id,'enquiries',enquiries,'qualified',qualified,'unreviewed',unreviewed,'confirmedVisits',visits,
     'quotedProjects',quoted,'acceptedProjects',accepted,'paidProjects',paid) order by id) from counts where delivery_kind='steady'),'[]'),
   'ordinaryAds',coalesce((select jsonb_agg(jsonb_build_object('id',id,'enquiries',enquiries,'qualified',qualified,'unreviewed',unreviewed,'confirmedVisits',visits,
     'quotedProjects',quoted,'acceptedProjects',accepted,'paidProjects',paid) order by id) from counts where delivery_kind='ordinary'),'[]'),
   'correspondence',jsonb_build_object('total',(select count(*) from correspondence_cohort),'eligible',(select count(*) from identities),
     'unlinked',(select count(*) from correspondence_cohort)-(select count(*) from identities),'omitted',(select count(*) from identities)-(select count(*) from selected_identities),
     'contacts',coalesce((select jsonb_agg(jsonb_build_object('key',encode(sha256(convert_to('sp_enq_'||id::text,'UTF8')),'hex'),'ad',ad,
       'enquiryId',id,'projectId',project_id,'contactId',contact_id,'email',email,'multipleProjects',multiple_projects,'createdAt',created_at,'changedAt',changed_at)) from selected_identities),'[]'::jsonb)),
   'enquiryReferenceHashes',coalesce((select jsonb_agg(encode(sha256(convert_to('sp_enq_'||id::text,'UTF8')),'hex')) from correspondence_cohort),'[]'::jsonb),
   'unmatchedCampaignEnquiries',(select count(*) from receipts where id not in (select id from included))) into result;
 return case when result->'ordinaryAds'='[]'::jsonb then result-'ordinaryAds' else result end;
end $$;

commit;
