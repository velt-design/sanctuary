begin;
select pg_advisory_xact_lock(819421,1);

-- Manual Meta UI provenance is reporting evidence only. These rows never enter
-- the provider execution, native acceptance, assignment or publishing registries.
create table private.meta_native_creative_reporting_tests (
 singleton boolean primary key default true check(singleton),
 native_test uuid not null unique,
 provenance text not null default 'meta_native_ui' check(provenance='meta_native_ui'),
 account_id text not null check(account_id='231087348606622'),
 campaign_id text not null check(campaign_id='120254691313600745'),
 adset_id text not null check(adset_id='120254691313610745'),
 page_id text not null check(page_id='304692390429608'),
 donor_ad text not null check(donor_ad='120254694264810745'),
 control_ad text not null check(control_ad~'^[1-9][0-9]{0,19}$'),
 challenger_ad text not null check(challenger_ad~'^[1-9][0-9]{0,19}$'and challenger_ad<>control_ad),
 page_path text not null check(page_path='/acrylic-roof-pergolas-auckland'),
 landing_template text not null check(landing_template~'^[a-f0-9]{64}$'),
 starts_at timestamptz not null,ends_at timestamptz not null,
 registration_receipt_hash text not null check(registration_receipt_hash~'^[a-f0-9]{64}$'),
 independent_review_hash text not null check(independent_review_hash~'^[a-f0-9]{64}$'),
 registered_at timestamptz not null default clock_timestamp(),
 published_at timestamptz,publication_receipt_hash text check(publication_receipt_hash~'^[a-f0-9]{64}$'),
 check(ends_at>starts_at and ends_at<=starts_at+interval'14 days'),
 check((published_at is null)=(publication_receipt_hash is null)),
 check(published_at is null or(published_at>=registered_at and published_at<ends_at)),
 check(control_ad not in('120254691313640745','120254694264800745','120254694264810745','120254694264820745')),
 check(challenger_ad not in('120254691313640745','120254694264800745','120254694264810745','120254694264820745'))
);
alter table private.meta_native_creative_reporting_tests enable row level security;
revoke all on private.meta_native_creative_reporting_tests from public,anon,authenticated,service_role;

create function private.meta_native_creative_reporting_guard()returns trigger language plpgsql set search_path=''as $$
begin
 perform pg_advisory_xact_lock(819421,1);
 if tg_op='DELETE'then raise exception 'Manual reporting history is retained';end if;
 if tg_op='UPDATE'then
  if(to_jsonb(new)-array['published_at','publication_receipt_hash'])is distinct from(to_jsonb(old)-array['published_at','publication_receipt_hash'])
   or old.published_at is not null then raise exception 'Manual reporting identity is immutable';end if;
 end if;
 if exists(select 1 from public.meta_creative_execution where experiment=new.native_test)then raise exception 'Manual test identity collides with execution';end if;
 if exists(select 1 from public.meta_creative_registered_ads()r where r.ad_id in(new.control_ad,new.challenger_ad))
  or exists(select 1 from public.meta_creative_objects where object_id in(new.control_ad,new.challenger_ad))
  or exists(select 1 from jsonb_array_elements(public.meta_creative_steady_ads())r where r->>'id'in(new.control_ad,new.challenger_ad))
  then raise exception 'Manual reporting ID collides with owned inventory';end if;
 if jsonb_array_length(public.meta_creative_reporting_registry_without_steady())+jsonb_array_length(public.meta_creative_steady_ads())+2>40
  then raise exception 'Campaign inventory exceeds bound';end if;
 return new;
end$$;
create trigger meta_native_creative_reporting_guard before insert or update or delete on private.meta_native_creative_reporting_tests
 for each row execute function private.meta_native_creative_reporting_guard();
revoke all on function private.meta_native_creative_reporting_guard()from public,anon,authenticated,service_role;

create or replace function public.meta_creative_reporting_registry()returns jsonb language plpgsql security definer set search_path=''as $$
declare experimental jsonb:=public.meta_creative_reporting_registry_without_steady();steady jsonb:=public.meta_creative_steady_ads();manual jsonb;
begin
 select coalesce(jsonb_agg(jsonb_build_object('experiment',t.native_test,'id',a.ad,'arm',a.arm,'campaign',t.campaign_id,'adset',t.adset_id,
  'page',t.page_id,'path',t.page_path,'template',t.landing_template,'purpose','formal_experiment',
  'delivery',t.published_at is not null,'startsAt',t.starts_at,'endsAt',t.ends_at)order by a.arm),'[]')into manual
 from private.meta_native_creative_reporting_tests t cross join lateral(values(t.control_ad,'control'),(t.challenger_ad,'challenger'))a(ad,arm);
 experimental:=experimental||manual;
 if jsonb_array_length(experimental)+jsonb_array_length(steady)>40 then raise exception 'Campaign inventory exceeds bound';end if;
 if exists(select 1 from(select r->>'id'id from jsonb_array_elements(experimental||steady)r)ads group by id having count(*)>1)
  or exists(select 1 from jsonb_array_elements(experimental||steady)r where r->>'id'in('120254691313640745','120254694264800745','120254694264810745','120254694264820745'))
  then raise exception 'Campaign reporting ID collision';end if;
 return jsonb_build_object('version',2,'experimental',experimental,'steady',steady);
end$$;
-- Preserve the existing function ACL and its scoped service reader.

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
   and e.id not in ('f3229ccf-6a1a-4e1a-bcf4-2edf5cc85e70'::uuid,'fdb7aa7a-bb3f-4fb3-89ed-ac3483d21118'::uuid)
   and (e.project_id is null or e.project_id not in ('10c5db1a-602c-4f0c-8193-855b186215bb'::uuid,'9d98b82b-679a-4ecb-8265-9fa05eaa78ef'::uuid))
 ), ads(id,delivery_kind) as (select value->>'id','original' from jsonb_array_elements(scope->'ads')
   union all select r.ad_id,'native' from public.meta_creative_registered_ads() r join public.meta_creative_execution x on x.experiment=r.experiment
    where r.campaign_id=scope->>'campaign' and r.adset_id=scope->>'adset' and x.plan->>'purpose'='formal_experiment'
   union all select r->>'id','steady'from jsonb_array_elements(public.meta_creative_steady_ads())r where r->>'campaign'=scope->>'campaign'and r->>'adset'=scope->>'adset'
   union all select ad,'native' from private.meta_native_creative_reporting_tests t cross join lateral(values(t.control_ad),(t.challenger_ad))a(ad)
    where t.campaign_id=scope->>'campaign'and t.adset_id=scope->>'adset'),
 included as materialized (select e.* from receipts e join ads a on a.id=e.ad where e.adset=scope->>'adset'and(a.delivery_kind<>'steady'or public.meta_creative_steady_enquiry(e.id))),
 facts as materialized (
   select e.*, (select state from private.enquiry_qualification_events where enquiry_id=e.id order by version desc limit 1) qualification,
     e.id=(select r.id from public.enquiry_requests r where r.project_id=e.project_id and r.id not in ('f3229ccf-6a1a-4e1a-bcf4-2edf5cc85e70'::uuid,'fdb7aa7a-bb3f-4fb3-89ed-ac3483d21118'::uuid) order by r.created_at,r.id limit 1) origin,
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
   from included e join public.projects p on p.id=e.project_id join public.contacts c on c.id=p.contact_id
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
   'correspondence',jsonb_build_object('total',(select count(*) from included),'eligible',(select count(*) from identities),
     'unlinked',(select count(*) from included)-(select count(*) from identities),'omitted',(select count(*) from identities)-(select count(*) from selected_identities),
     'contacts',coalesce((select jsonb_agg(jsonb_build_object('key',encode(sha256(convert_to('sp_enq_'||id::text,'UTF8')),'hex'),'ad',ad,
       'enquiryId',id,'projectId',project_id,'contactId',contact_id,'email',email,'multipleProjects',multiple_projects,'createdAt',created_at,'changedAt',changed_at)) from selected_identities),'[]'::jsonb)),
   'enquiryReferenceHashes',coalesce((select jsonb_agg(encode(sha256(convert_to('sp_enq_'||id::text,'UTF8')),'hex')) from included),'[]'::jsonb),
   'unmatchedCampaignEnquiries',(select count(*) from receipts where id not in (select id from included))) into result;
 return result;
end $$;

commit;
