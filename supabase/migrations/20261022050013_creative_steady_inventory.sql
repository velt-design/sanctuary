begin;
select pg_advisory_xact_lock(819421,1);

-- Inventory and serving are different facts. Never discard an owned PAUSED ad
-- just because it is no longer the donor's current winner.
create function public.meta_creative_steady_intervals(p_ad text)
returns table(starts_at timestamptz,ends_at timestamptz) language sql stable set search_path='' as $$
 select a.confirmed_at,closing.stamp
 from public.meta_creative_effects a
 cross join lateral(select min(p.dispatch_claimed_at) stamp from public.meta_creative_effects p
   where p.kind='pause_ad' and coalesce(p.target,p.object_id)=p_ad and p.dispatch_claimed_at>a.dispatch_claimed_at) closing
 where a.kind='activate_ad' and a.state='confirmed' and a.object_id=p_ad and a.dispatch_claimed_at is not null
  and a.confirmed_at is not null and (closing.stamp is null or closing.stamp>=a.confirmed_at)
  and exists(select 1 from public.meta_creative_objects o join public.meta_creative_execution_intents i on i.command=o.created_by
   where o.object_id=p_ad and o.kind='ad' and i.kind='create_retained')
 order by a.confirmed_at,a.command
$$;
create function public.meta_creative_steady_ads() returns jsonb language plpgsql stable set search_path='' as $$
declare result jsonb;winners jsonb:=public.meta_creative_retained_ads();
begin
 select coalesce(jsonb_agg(jsonb_build_object('kind','steady','experiment',x.experiment,'id',o.object_id,
  'creative',(i.intent#>>'{body,creative}')::jsonb->>'creative_id','donor',x.plan->>'controlAd',
  'account',x.plan#>>'{scope,account}','campaign',x.plan#>>'{scope,campaign}','adset',x.plan#>>'{scope,adset}','page',x.plan#>>'{scope,page}',
  'path',x.plan#>>'{control,path}','template',x.plan->>'landingTemplate','observedAt',clock_timestamp(),
  'current',exists(select 1 from jsonb_array_elements(winners) w where w->>'ad'=o.object_id),
  'state',case when last_effect.state='uncertain' then 'uncertain' when last_effect.kind='activate_ad' then 'active' else 'paused' end,
  'intervals',(select coalesce(jsonb_agg(jsonb_build_object('start',v.starts_at,'end',v.ends_at)order by v.starts_at),'[]')from public.meta_creative_steady_intervals(o.object_id)v)
 ) order by x.created_at,o.object_id),'[]') into result
 from public.meta_creative_objects o join public.meta_creative_execution_intents i on i.command=o.created_by and i.kind='create_retained'
 join public.meta_creative_execution x on x.experiment=o.experiment
 left join lateral(select e.kind,e.state from public.meta_creative_effects e where coalesce(e.target,e.object_id)=o.object_id
  and e.dispatch_claimed_at is not null and e.state in('confirmed','uncertain') order by e.dispatch_claimed_at desc,e.command desc limit 1)last_effect on true
 where o.kind='ad';
 if jsonb_array_length(result)>40 or exists(select 1 from jsonb_array_elements(result)v where jsonb_array_length(v->'intervals')>40)then raise exception 'Steady inventory exceeds bound';end if;
 return result;
end$$;
alter function public.meta_creative_reporting_registry() rename to meta_creative_reporting_registry_without_steady;
create function public.meta_creative_reporting_registry() returns jsonb language plpgsql security definer set search_path='' as $$
declare experimental jsonb:=public.meta_creative_reporting_registry_without_steady();steady jsonb:=public.meta_creative_steady_ads();
begin
 if jsonb_array_length(experimental)+jsonb_array_length(steady)>40 then raise exception 'Campaign inventory exceeds bound';end if;
 return jsonb_build_object('version',2,'experimental',experimental,'steady',steady);
end$$;

-- Under the same acquisition lock, count confirmed and in-flight creates. This
-- cannot deny pause/restore/reconciliation or reinterpret an uncertain create.
create function public.meta_creative_inventory_capacity() returns trigger language plpgsql set search_path='' as $$
begin
 if new.kind='create_paused_ad' then
  perform pg_advisory_xact_lock(819421,1);
  if (select count(*)from public.meta_creative_objects where kind='ad')+
    (select count(*)from public.meta_creative_effects where kind='create_paused_ad'and state in('prepared','uncertain'))>=40
   then raise exception 'Owned ad inventory capacity reached';end if;
 end if;
 return new;
end$$;
create trigger creative_inventory_capacity before insert on public.meta_creative_effects for each row execute function public.meta_creative_inventory_capacity();
alter function public.meta_creative_executor_command(text,uuid,uuid,text,jsonb) rename to meta_creative_executor_without_inventory;
create function public.meta_creative_executor_command(p_binding text,p_command uuid,p_experiment uuid,p_stage text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(819421,1);
 if p_stage='prepare'and not exists(select 1 from public.meta_creative_execution where experiment=p_experiment)
  and (select count(*)from public.meta_creative_objects where kind='ad')+
   (select count(*)from public.meta_creative_effects where kind='create_paused_ad'and state in('prepared','uncertain'))+
   (case when p_payload#>>'{plan,purpose}'='formal_experiment'then 3 else 1 end)>40
 then raise exception 'Owned ad inventory capacity reached';end if;
 -- The existing single acquisition reservation keeps these three slots for
 -- the two test arms and possible retained winner. Replays/cleanup are unchanged.
 return public.meta_creative_executor_without_inventory(p_binding,p_command,p_experiment,p_stage,p_payload);
end$$;
revoke all on function public.meta_creative_executor_without_inventory(text,uuid,uuid,text,jsonb)from public,anon,authenticated,service_role;
revoke all on function public.meta_creative_executor_command(text,uuid,uuid,text,jsonb)from public,anon,authenticated;
grant execute on function public.meta_creative_executor_command(text,uuid,uuid,text,jsonb)to service_role;

-- Reuse the signed, consent-gated visit transport. Null arm is only a steady
-- receipt, never an additional native experimental arm.
alter table public.meta_creative_visits add column delivery_kind text not null default 'native' check(delivery_kind in('native','steady'));
alter table public.meta_creative_visits alter column arm drop not null;
alter table public.meta_creative_visits add constraint creative_visit_delivery_arm check((delivery_kind='native'and arm in('control','challenger')and arm is not null)or(delivery_kind='steady'and arm is null));
alter function public.landing_experiment_visit(text,uuid,text,text,text,text,text,jsonb) rename to landing_experiment_visit_without_steady;
create function public.landing_experiment_visit(p_stage text,p_id uuid,p_path text,p_template text,p_ad text default null,p_campaign text default null,p_adset text default null,p_display jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.meta_creative_visits;r jsonb;c public.meta_creative_control;l public.landing_experiment_control;stamp timestamptz:=clock_timestamp();copy jsonb;
begin
 perform pg_advisory_xact_lock(819421,1);
 select * into v from public.meta_creative_visits where id=p_id for update;
 if v.id is not null and v.delivery_kind='steady' and p_stage='revoke'then
  if p_path is distinct from v.page_path then raise exception 'Steady receipt path differs';end if;
  update public.meta_creative_visits set revoked_at=coalesce(revoked_at,stamp)where id=v.id;return '{}'::jsonb;
 end if;
 if p_stage='assign'and v.id is not null and v.ad_id is distinct from p_ad then p_id:=gen_random_uuid();v:=null;end if;
 select value into r from jsonb_array_elements(public.meta_creative_steady_ads())where value->>'id'=coalesce(v.ad_id,p_ad);
 if r is null then return public.landing_experiment_visit_without_steady(p_stage,p_id,p_path,p_template,p_ad,p_campaign,p_adset,p_display);end if;
 select * into c from public.meta_creative_control where singleton;
 select * into l from public.landing_experiment_control where singleton;
 copy:=case p_path when '/auckland-outdoor-living'then l.control_outdoor when '/acrylic-roof-pergolas-auckland'then l.control_acrylic else '{}'::jsonb end;
 if p_stage not in('assign','expose')or p_id is null or p_path is distinct from r->>'path'
  or not coalesce(c.enabled,false)or c.global_stop or not c.authority_current
  or p_template is distinct from l.template or r->>'campaign' is distinct from c.scope->>'campaign' or r->>'adset' is distinct from c.scope->>'adset'
  or v.revoked_at is not null or(v.id is not null and(v.delivery_kind<>'steady'or v.created_at<stamp-interval'28 days'))
 then return jsonb_build_object('assignment',null,'control',copy);end if;
 if p_stage='assign'then
  if p_campaign is distinct from r->>'campaign'or p_adset is distinct from r->>'adset'or p_ad is distinct from r->>'id'
   or not exists(select 1 from public.meta_creative_steady_intervals(r->>'id')where starts_at<=stamp and ends_at is null)
   then return jsonb_build_object('assignment',null,'control',copy);end if;
  if v.id is null then
   insert into public.meta_creative_visits(id,experiment,ad_id,arm,page_path,template,copies,delivery_kind)
   values(p_id,(r->>'experiment')::uuid,r->>'id',null,p_path,p_template,copy,'steady')returning * into v;
  end if;
 else
  if v.id is null or not exists(select 1 from public.meta_creative_steady_intervals(v.ad_id)where starts_at<=v.created_at and starts_at<=stamp and ends_at is null)
   then return jsonb_build_object('assignment',null,'control',copy);end if;
  update public.meta_creative_visits set exposed_at=coalesce(exposed_at,stamp)where id=v.id;
 end if;
 return jsonb_build_object('kind','steady','assignment',v.id,'experiment',v.experiment,'path',v.page_path,'arm',null,'copies',v.copies);
end$$;

create function public.meta_creative_steady_enquiry(p_enquiry uuid) returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from public.enquiry_requests e join public.meta_creative_enquiries j on j.enquiry_id=e.id
 join public.meta_creative_visits v on v.id=j.visit and v.delivery_kind='steady'and v.arm is null
 join public.meta_creative_execution x on x.experiment=v.experiment
 where e.id=p_enquiry and e.source='website'and v.exposed_at>=v.created_at and v.exposed_at<=e.created_at and e.created_at<=v.created_at+interval'28 days'and v.revoked_at is null
 and e.raw_payload#>>'{attribution,consent,analytics}'='true'and e.raw_payload#>>'{attribution,consent,marketing}'='true'
 and e.raw_payload#>>'{attribution,utm,utm_source}'='facebook'and e.raw_payload#>>'{attribution,utm,utm_medium}'='paid_social'
 and(e.utm->>'utm_source'is null or e.utm->>'utm_source'='facebook')and(e.utm->>'utm_medium'is null or e.utm->>'utm_medium'='paid_social')
 and e.raw_payload#>>'{attribution,utm,utm_content}'=v.ad_id and e.raw_payload#>>'{attribution,utm,utm_campaign}'=x.plan#>>'{scope,campaign}'and e.raw_payload#>>'{attribution,utm,utm_term}'=x.plan#>>'{scope,adset}'
 and(e.utm->>'utm_content'is null or e.utm->>'utm_content'=v.ad_id)and(e.utm->>'utm_campaign'is null or e.utm->>'utm_campaign'=x.plan#>>'{scope,campaign}')and(e.utm->>'utm_term'is null or e.utm->>'utm_term'=x.plan#>>'{scope,adset}')
 and((e.page=v.page_path and(e.raw_payload#>>'{enquiryContext,sourcePath}'is null or e.raw_payload#>>'{enquiryContext,sourcePath}'=v.page_path))or(e.page='/contact'and e.raw_payload#>>'{enquiryContext,sourcePath}'=v.page_path))
 and exists(select 1 from public.meta_creative_steady_intervals(v.ad_id)s where s.starts_at<=v.created_at and s.starts_at<=v.exposed_at and(s.ends_at is null or v.exposed_at<s.ends_at))
 and exists(select 1 from public.meta_creative_objects o join public.meta_creative_execution_intents i on i.command=o.created_by where o.object_id=v.ad_id and o.experiment=v.experiment and i.kind='create_retained'))
$$;

-- Existing intake already commits the canonical enquiry and links a same-path,
-- both-consent receipt. The reporting predicate additionally checks the actual
-- serving interval, conflicting tags, kind and expiry. It never deletes intake.
revoke all on function public.meta_creative_steady_intervals(text),public.meta_creative_steady_ads(),public.meta_creative_inventory_capacity(),public.meta_creative_steady_enquiry(uuid),public.meta_creative_reporting_registry_without_steady(),public.landing_experiment_visit_without_steady(text,uuid,text,text,text,text,text,jsonb)from public,anon,authenticated,service_role;
revoke all on function public.meta_creative_reporting_registry(),public.landing_experiment_visit(text,uuid,text,text,text,text,text,jsonb)from public,anon,authenticated;
grant execute on function public.meta_creative_reporting_registry(),public.landing_experiment_visit(text,uuid,text,text,text,text,text,jsonb)to service_role;
-- Add only genuine steady provenance to unfrozen reports. Prior frozen cohorts
-- and the registered native arms retain their original bytes and windows.
create or replace function public.sanctuary_campaign_outcomes_without_intake(p_actor uuid,p_account text,p_binding text,p_source text,p_connection uuid,p_environment text,p_operation uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; n integer; scope jsonb; launch timestamptz;
begin
 -- Reuse exact source/actor/current-generation/kill/expiry/delivery checks.
 perform public.sanctuary_meta_command(p_actor,p_account,p_binding,p_source,p_connection,p_environment,'deliver',p_operation);
 if not exists(select 1 from private.sanctuary_meta_operations where id=p_operation and query::jsonb->>'health'='true') then raise exception 'Wrong evidence purpose';end if;
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
   union all select r->>'id','steady'from jsonb_array_elements(public.meta_creative_steady_ads())r where r->>'campaign'=scope->>'campaign'and r->>'adset'=scope->>'adset'),
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

create or replace function public.meta_creative_formal_cohort_v1(p_binding text,p_experiment uuid,p_freeze boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.meta_creative_control;x public.meta_creative_execution;s timestamptz;f timestamptz;m timestamptz;result jsonb;n integer;stamp timestamptz:=clock_timestamp();
begin
 perform pg_advisory_xact_lock(819421,1);
 select * into c from public.meta_creative_control where singleton;
 select * into x from public.meta_creative_execution where experiment=p_experiment;
 if p_freeze is null or c.binding is distinct from p_binding or c.binding is null or c.global_stop or not c.authority_current
  or x.experiment is null or x.plan->>'purpose' is distinct from 'formal_experiment' then raise exception 'Formal cohort unavailable';end if;
 select payload into result from public.meta_creative_formal_cohorts where experiment=p_experiment and plan_hash=x.plan_hash;
 if result is not null then return result;end if;
 s:=to_timestamp((x.plan->>'start')::double precision);f:=to_timestamp((x.plan->>'end')::double precision);m:=f+interval '72 hours';
 if p_freeze and stamp<m then raise exception 'Formal cohort not mature';end if;
 if not exists(select 1 from public.meta_creative_execution_receipts where experiment=p_experiment and stage='activation')
  or (select count(*)=2 and count(distinct arm)=2 from public.meta_creative_registered_ads() where experiment=p_experiment) is distinct from true then raise exception 'Formal registry incomplete';end if;
 select count(*) into n from public.enquiry_requests where created_at>=s and created_at<=m;
 if n>2000 then raise exception 'Formal cohort exceeds bound';end if;
 with registered as materialized(select * from public.meta_creative_registered_ads() where experiment=p_experiment),
 website as materialized(
  select e.*,e.raw_payload#>>'{attribution,utm,utm_content}' ad,
   e.raw_payload#>>'{attribution,utm,utm_campaign}' campaign,e.raw_payload#>>'{attribution,utm,utm_term}' adset,
   case when e.page in('/auckland-outdoor-living','/acrylic-roof-pergolas-auckland') and (e.raw_payload#>>'{enquiryContext,sourcePath}' is null or e.raw_payload#>>'{enquiryContext,sourcePath}'=e.page) then e.page when e.page='/contact' and e.raw_payload#>>'{enquiryContext,sourcePath}' in('/auckland-outdoor-living','/acrylic-roof-pergolas-auckland') then e.raw_payload#>>'{enquiryContext,sourcePath}' else null end route
  from public.enquiry_requests e where e.created_at>=s and e.created_at<=m and e.source='website'
   and e.id not in ('f3229ccf-6a1a-4e1a-bcf4-2edf5cc85e70'::uuid,'fdb7aa7a-bb3f-4fb3-89ed-ac3483d21118'::uuid)
   and (e.project_id is null or e.project_id not in ('10c5db1a-602c-4f0c-8193-855b186215bb'::uuid,'9d98b82b-679a-4ecb-8265-9fa05eaa78ef'::uuid))
   and (e.project_id is null or e.id=(select first.id from public.enquiry_requests first where first.project_id=e.project_id
    and first.id not in ('f3229ccf-6a1a-4e1a-bcf4-2edf5cc85e70'::uuid,'fdb7aa7a-bb3f-4fb3-89ed-ac3483d21118'::uuid) order by first.created_at,first.id limit 1))
 ), classified as materialized(
  select e.*,case when e.raw_payload#>>'{attribution,consent,marketing}'='true'
   and (e.utm->>'utm_content' is null or e.utm->>'utm_content'=e.ad)
   and (e.utm->>'utm_campaign' is null or e.utm->>'utm_campaign'=e.campaign)
   and (e.utm->>'utm_term' is null or e.utm->>'utm_term'=e.adset)
   then case
    when exists(select 1 from registered r where r.ad_id=e.ad and r.campaign_id=e.campaign and r.adset_id=e.adset and r.page_path=e.route) then 'native'
    when e.campaign=x.plan#>>'{scope,campaign}' and e.adset=x.plan#>>'{scope,adset}' and x.plan->'originalAds' ? e.ad
     and e.route in('/auckland-outdoor-living','/acrylic-roof-pergolas-auckland') then 'known_other'
    when exists(select 1 from public.meta_creative_registered_ads() r join public.meta_creative_execution other on other.experiment=r.experiment where other.plan->>'purpose'='formal_experiment' and exists(select 1 from public.meta_creative_execution_receipts proof where proof.experiment=r.experiment and proof.stage='activation') and r.experiment<>p_experiment and r.ad_id=e.ad and r.campaign_id=e.campaign and r.adset_id=e.adset and r.page_path=e.route) then 'known_other'
    when e.campaign=x.plan#>>'{scope,campaign}'and e.adset=x.plan#>>'{scope,adset}'and public.meta_creative_steady_enquiry(e.id)then 'known_other'
    else 'unknown' end else 'unknown' end coverage_kind
  from website e
 ), matching as materialized(
  select e.*,r.arm,r.ad_id,
   exists(select 1 from public.meta_creative_enquiries j join public.meta_creative_visits v on v.id=j.visit
    where j.enquiry_id=e.id and v.experiment=p_experiment and v.ad_id=r.ad_id and v.arm=r.arm and v.page_path=r.page_path
     and v.template=x.plan->>'landingTemplate' and v.created_at>=s and v.created_at<f
     and v.exposed_at>=v.created_at and v.exposed_at<f and v.exposed_at<=e.created_at and v.revoked_at is null) enrolled
  from classified e join registered r on r.ad_id=e.ad where e.coverage_kind='native'
 ), included as materialized(
  select e.arm,e.ad_id,e.id,e.created_at,(select q.state from private.enquiry_qualification_events q
   where q.enquiry_id=e.id and q.project_id=e.project_id and q.recorded_at<=least(stamp,m) order by q.version desc limit 1) qualification
  from matching e where e.created_at<f or e.enrolled
 ), quality as(select arm,ad_id ad,encode(sha256(convert_to('sp_enq_'||id::text,'UTF8')),'hex') key,
   created_at "savedAt",qualification from included order by id limit 400),
 arms as(select r.arm,r.ad_id ad,count(e.id)::integer enquiries from registered r left join included e on e.arm=r.arm group by r.arm,r.ad_id)
 select jsonb_build_object('version',1,'experiment',p_experiment,'planHash',x.plan_hash,'observedAt',stamp,
  'startsAt',s,'endsAt',f,'maturesAt',m,'frozen',p_freeze,'attributionCoverage','consented_attributable_only','allSavedCoverage',case when not exists(select 1 from classified where coverage_kind='unknown') and not exists(select 1 from matching where created_at>=f and not enrolled) then 'complete' else 'unknown' end,
  'coverage',jsonb_build_object('websiteGenuine',(select count(*)from classified),'nativeMatched',(select count(*)from included),
   'knownOtherRegistered',(select count(*)from classified where coverage_kind='known_other'),'unknownAttribution',(select count(*)from classified where coverage_kind='unknown'),
   'unlinkedNative',(select count(*)from matching where project_id is null and (created_at<f or enrolled))),
  'deduplication','first_saved_per_project_else_enquiry','arms',coalesce((select jsonb_agg(arms order by arm) from arms),'[]'),
  'unresolvedLate', (select count(*) from matching where created_at>=f and not enrolled),
  'quality',coalesce((select jsonb_agg(quality order by key) from quality),'[]'),
  'qualityOmitted',greatest(0,(select count(*) from included)-400)) into result;
 if p_freeze then insert into public.meta_creative_formal_cohorts(experiment,plan_hash,payload)values(p_experiment,x.plan_hash,result);end if;
 return result;
end$$;

create or replace function public.meta_creative_formal_cohort(p_binding text,p_experiment uuid,p_freeze boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.meta_creative_control;x public.meta_creative_execution;s timestamptz;f timestamptz;m timestamptz;result jsonb;n integer;stamp timestamptz:=clock_timestamp();
begin
 perform pg_advisory_xact_lock(819421,1);
 select * into c from public.meta_creative_control where singleton;
 select * into x from public.meta_creative_execution where experiment=p_experiment;
 if p_freeze is null or c.binding is distinct from p_binding or c.binding is null or c.global_stop or not c.authority_current
  or x.experiment is null or x.plan->>'purpose' is distinct from 'formal_experiment' then raise exception 'Formal cohort unavailable';end if;
 if x.plan#>>'{evaluation,ambiguity}' is distinct from 'finite_allocation_envelope_v1' then return public.meta_creative_formal_cohort_v1(p_binding,p_experiment,p_freeze);end if;
 select payload into result from public.meta_creative_formal_cohorts where experiment=p_experiment and plan_hash=x.plan_hash;
 if result is not null then return result;end if;
 s:=to_timestamp((x.plan->>'start')::double precision);f:=to_timestamp((x.plan->>'end')::double precision);m:=f+interval '72 hours';
 if p_freeze and stamp<m then raise exception 'Formal cohort not mature';end if;
 if not exists(select 1 from public.meta_creative_execution_receipts where experiment=p_experiment and stage='activation')
  or (select count(*)=2 and count(distinct arm)=2 from public.meta_creative_registered_ads() where experiment=p_experiment) is distinct from true then raise exception 'Formal registry incomplete';end if;
 select count(*) into n from public.enquiry_requests where created_at>=s and created_at<=m;
 if n>2000 then raise exception 'Formal cohort exceeds bound';end if;
 with registered as materialized(select * from public.meta_creative_registered_ads() where experiment=p_experiment),
 website as materialized(
  select e.*,e.raw_payload#>>'{attribution,utm,utm_content}' ad,
   e.raw_payload#>>'{attribution,utm,utm_campaign}' campaign,e.raw_payload#>>'{attribution,utm,utm_term}' adset,
   case when e.page in('/auckland-outdoor-living','/acrylic-roof-pergolas-auckland') and (e.raw_payload#>>'{enquiryContext,sourcePath}' is null or e.raw_payload#>>'{enquiryContext,sourcePath}'=e.page) then e.page when e.page='/contact' and e.raw_payload#>>'{enquiryContext,sourcePath}' in('/auckland-outdoor-living','/acrylic-roof-pergolas-auckland') then e.raw_payload#>>'{enquiryContext,sourcePath}' else null end route
  from public.enquiry_requests e where e.created_at>=s and e.created_at<=m and e.source='website'
   and e.id not in ('f3229ccf-6a1a-4e1a-bcf4-2edf5cc85e70'::uuid,'fdb7aa7a-bb3f-4fb3-89ed-ac3483d21118'::uuid)
   and (e.project_id is null or e.project_id not in ('10c5db1a-602c-4f0c-8193-855b186215bb'::uuid,'9d98b82b-679a-4ecb-8265-9fa05eaa78ef'::uuid))
   and (e.project_id is null or e.id=(select first.id from public.enquiry_requests first where first.project_id=e.project_id
    and first.id not in ('f3229ccf-6a1a-4e1a-bcf4-2edf5cc85e70'::uuid,'fdb7aa7a-bb3f-4fb3-89ed-ac3483d21118'::uuid) order by first.created_at,first.id limit 1))
 ), classified as materialized(
  select e.*,case when e.raw_payload#>>'{attribution,consent,marketing}'='true'
   and (e.utm->>'utm_content' is null or e.utm->>'utm_content'=e.ad)
   and (e.utm->>'utm_campaign' is null or e.utm->>'utm_campaign'=e.campaign)
   and (e.utm->>'utm_term' is null or e.utm->>'utm_term'=e.adset)
   then case
    when exists(select 1 from registered r where r.ad_id=e.ad and r.campaign_id=e.campaign and r.adset_id=e.adset and r.page_path=e.route) then 'native'
    when e.campaign=x.plan#>>'{scope,campaign}' and e.adset=x.plan#>>'{scope,adset}' and x.plan->'originalAds' ? e.ad
     and e.route in('/auckland-outdoor-living','/acrylic-roof-pergolas-auckland') then 'known_other'
    when exists(select 1 from public.meta_creative_registered_ads() r join public.meta_creative_execution other on other.experiment=r.experiment where other.plan->>'purpose'='formal_experiment' and exists(select 1 from public.meta_creative_execution_receipts proof where proof.experiment=r.experiment and proof.stage='activation') and r.experiment<>p_experiment and r.ad_id=e.ad and r.campaign_id=e.campaign and r.adset_id=e.adset and r.page_path=e.route) then 'known_other'
    when e.campaign=x.plan#>>'{scope,campaign}'and e.adset=x.plan#>>'{scope,adset}'and public.meta_creative_steady_enquiry(e.id)then 'known_other'
    else 'unknown' end else 'unknown' end coverage_kind
  from website e
 ), matching as materialized(
  select e.*,r.arm,r.ad_id,
   exists(select 1 from public.meta_creative_enquiries j join public.meta_creative_visits v on v.id=j.visit
    where j.enquiry_id=e.id and v.experiment=p_experiment and v.ad_id=r.ad_id and v.arm=r.arm and v.page_path=r.page_path
     and v.template=x.plan->>'landingTemplate' and v.created_at>=s and v.created_at<f
     and v.exposed_at>=v.created_at and v.exposed_at<f and v.exposed_at<=e.created_at and v.revoked_at is null) enrolled
  from classified e join registered r on r.ad_id=e.ad where e.coverage_kind='native'
 ), included as materialized(
  select e.arm,e.ad_id,e.id,e.created_at,(select q.state from private.enquiry_qualification_events q
   where q.enquiry_id=e.id and q.project_id=e.project_id and q.recorded_at<=least(stamp,m) order by q.version desc limit 1) qualification
  from matching e where e.created_at<f or e.enrolled
 ), unassigned as materialized(
  select id,project_id,created_at from classified where coverage_kind='unknown'
  union all select id,project_id,created_at from matching where created_at>=f and not enrolled
 ), ambiguous as materialized(
  select e.id,e.created_at,(select q.state from private.enquiry_qualification_events q where q.enquiry_id=e.id and q.project_id=e.project_id and q.recorded_at<=least(stamp,m) order by q.version desc limit 1) qualification from unassigned e
 ), conflicting_join as materialized(
  select distinct e.id from classified e join public.meta_creative_enquiries j on j.enquiry_id=e.id join public.meta_creative_visits v on v.id=j.visit
  where v.experiment=p_experiment and not(coalesce(e.coverage_kind='native' and e.ad=v.ad_id and e.route=v.page_path and v.template=x.plan->>'landingTemplate'
   and exists(select 1 from registered r where r.ad_id=v.ad_id and r.arm=v.arm and r.page_path=v.page_path)
   and v.created_at>=s and v.created_at<f and v.exposed_at>=v.created_at and v.exposed_at<f and v.exposed_at<=e.created_at and v.revoked_at is null,false))
 ), quality as(select arm,ad_id ad,encode(sha256(convert_to('sp_enq_'||id::text,'UTF8')),'hex') key,
   created_at "savedAt",qualification from included order by id limit 400),
 ambiguous_quality as(select encode(sha256(convert_to('sp_enq_'||id::text,'UTF8')),'hex') key,created_at "savedAt",qualification from ambiguous order by id limit greatest(0,400-(select count(*)from quality))),
 arms as(select r.arm,r.ad_id ad,count(e.id)::integer enquiries from registered r left join included e on e.arm=r.arm group by r.arm,r.ad_id)
 select jsonb_build_object('version',2,'experiment',p_experiment,'planHash',x.plan_hash,'observedAt',stamp,
  'startsAt',s,'endsAt',f,'maturesAt',m,'frozen',p_freeze,'attributionCoverage','consented_attributable_only','allSavedCoverage',case when not exists(select 1 from classified where coverage_kind='unknown') and not exists(select 1 from matching where created_at>=f and not enrolled) then 'complete' else 'unknown' end,
  'coverage',jsonb_build_object('websiteGenuine',(select count(*)from classified),'nativeMatched',(select count(*)from included),
   'knownOtherRegistered',(select count(*)from classified where coverage_kind='known_other'),'unknownAttribution',(select count(*)from classified where coverage_kind='unknown'),
   'unlinkedNative',(select count(*)from matching where project_id is null and (created_at<f or enrolled))),
  'deduplication','first_saved_per_project_else_enquiry','arms',coalesce((select jsonb_agg(arms order by arm) from arms),'[]'),
  'unresolvedLate', (select count(*) from matching where created_at>=f and not enrolled),
  'ambiguity',jsonb_build_object('pool',(select count(*)from ambiguous),'joinConflicts',(select count(*)from conflicting_join),'canonicalAdverse',(select count(*)from ambiguous where qualification='not_qualified'),
   'quality',coalesce((select jsonb_agg(ambiguous_quality order by key)from ambiguous_quality),'[]'),'qualityOmitted',(select count(*)from ambiguous)-(select count(*)from ambiguous_quality)),
  'quality',coalesce((select jsonb_agg(quality order by key) from quality),'[]'),
  'qualityOmitted',greatest(0,(select count(*) from included)-400)) into result;
 if p_freeze then insert into public.meta_creative_formal_cohorts(experiment,plan_hash,payload)values(p_experiment,x.plan_hash,result);end if;
 return result;
end$$;

commit;
