begin;
-- Consent-gated experience receipts share the existing public transport and
-- canonical intake. No diagnostic or paused-capability record is a real visit.
create table public.meta_creative_visits (
 id uuid primary key, experiment uuid not null references public.meta_creative_execution(experiment),
 ad_id text not null, arm text not null check(arm in('control','challenger')),
 page_path text not null check(page_path in('/auckland-outdoor-living','/acrylic-roof-pergolas-auckland')),
 template text not null check(template ~ '^[a-f0-9]{64}$'), copies jsonb not null check(jsonb_typeof(copies)='object'),
 created_at timestamptz not null default clock_timestamp(), exposed_at timestamptz, revoked_at timestamptz
);
create table public.meta_creative_enquiries (
 enquiry_id uuid primary key references public.enquiry_requests(id),
 visit uuid not null references public.meta_creative_visits(id), created_at timestamptz not null default clock_timestamp()
);
alter table public.meta_creative_visits enable row level security;
alter table public.meta_creative_enquiries enable row level security;
revoke all on public.meta_creative_visits,public.meta_creative_enquiries from public,anon,authenticated,service_role;
create trigger creative_enquiry_immutable before update or delete on public.meta_creative_enquiries for each row execute function public.meta_creative_immutable();
create function public.meta_creative_visit_fence() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' or (to_jsonb(new)-'exposed_at'-'revoked_at') is distinct from (to_jsonb(old)-'exposed_at'-'revoked_at')
  or old.exposed_at is not null and new.exposed_at is distinct from old.exposed_at
  or old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at then raise exception 'Immutable creative experience';end if;
 return new;
end$$;
revoke all on function public.meta_creative_visit_fence() from public,anon,authenticated,service_role;
create trigger creative_visit_fence before update or delete on public.meta_creative_visits for each row execute function public.meta_creative_visit_fence();
alter function public.landing_experiment_visit(text,uuid,text,text,text,text,text,jsonb) rename to landing_experiment_visit_without_creative;
revoke all on function public.landing_experiment_visit_without_creative(text,uuid,text,text,text,text,text,jsonb) from public,anon,authenticated,service_role;
create function public.landing_experiment_visit(p_stage text,p_id uuid,p_path text,p_template text,p_ad text default null,p_campaign text default null,p_adset text default null,p_display jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.meta_creative_visits;r record;c public.meta_creative_control;l public.landing_experiment_control;stamp timestamptz:=clock_timestamp();copy jsonb;
begin
 perform pg_advisory_xact_lock(819421,1);
 select * into v from public.meta_creative_visits where id=p_id for update;
 if v.id is not null and p_stage='revoke' then
  if p_path is distinct from v.page_path then raise exception 'Creative receipt path differs';end if;
  update public.meta_creative_visits set revoked_at=coalesce(revoked_at,stamp) where id=v.id;return '{}'::jsonb;
 end if;
 select a.*,x.plan into r from public.meta_creative_registered_ads() a join public.meta_creative_execution x on x.experiment=a.experiment
 where a.ad_id=coalesce(v.ad_id,p_ad);
 if not found then return public.landing_experiment_visit_without_creative(p_stage,p_id,p_path,p_template,p_ad,p_campaign,p_adset,p_display);end if;
 select * into c from public.meta_creative_control where singleton;
 select * into l from public.landing_experiment_control where singleton;
 copy:=case p_path when '/auckland-outdoor-living' then l.control_outdoor when '/acrylic-roof-pergolas-auckland' then l.control_acrylic else '{}'::jsonb end;
 if p_stage not in('assign','expose') or p_id is null or p_path is distinct from r.page_path
  or not coalesce(c.enabled,false) or c.global_stop or not c.authority_current or r.plan->>'purpose' is distinct from 'formal_experiment'
  or p_template is distinct from l.template or p_template is distinct from r.plan->>'landingTemplate'
  or not exists(select 1 from public.acquisition_experiment_reservation where singleton and lane='creative' and experiment=r.experiment)
  or not exists(select 1 from public.meta_creative_execution_receipts where experiment=r.experiment and stage='activation')
  or stamp<r.starts_at or stamp>r.ends_at+interval '72 hours'
  or v.revoked_at is not null
 then return jsonb_build_object('assignment',null,'control',copy);end if;
 if p_stage='assign' then
  if p_campaign is distinct from r.campaign_id or p_adset is distinct from r.adset_id or p_ad is distinct from r.ad_id
    or v.id is null and stamp>=r.ends_at then return jsonb_build_object('assignment',null,'control',copy);end if;
  if v.id is null then
   insert into public.meta_creative_visits(id,experiment,ad_id,arm,page_path,template,copies)
    values(p_id,r.experiment,r.ad_id,r.arm,p_path,p_template,copy) returning * into v;
  end if;
 else
  if v.id is null then raise exception 'Creative assignment absent';end if;
  update public.meta_creative_visits set exposed_at=coalesce(exposed_at,stamp) where id=v.id;
 end if;
 return jsonb_build_object('assignment',v.id,'experiment',v.experiment,'path',v.page_path,'arm',v.arm,'copies',v.copies);
end$$;
revoke all on function public.landing_experiment_visit(text,uuid,text,text,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.landing_experiment_visit(text,uuid,text,text,text,text,text,jsonb) to service_role;
alter function public.marketing_experiment_intake(uuid,text,jsonb,uuid,jsonb) rename to marketing_experiment_intake_without_creative;
revoke all on function public.marketing_experiment_intake_without_creative(uuid,text,jsonb,uuid,jsonb) from public,anon,authenticated,service_role;
create function public.marketing_experiment_intake(p_submission_id uuid,p_upload_token_hash text,p_payload jsonb,p_assignment uuid,p_delivery jsonb default null)
returns table(contact_id uuid,project_id uuid,enquiry_request_id uuid,already_existed boolean,estimate_id uuid)
language plpgsql security definer set search_path='' as $$
declare r record;v public.meta_creative_visits;x public.meta_creative_execution;
begin
 select * into r from public.marketing_experiment_intake_without_creative(p_submission_id,p_upload_token_hash,p_payload,p_assignment,p_delivery);
 select * into v from public.meta_creative_visits where id=p_assignment;
 select * into x from public.meta_creative_execution where experiment=v.experiment;
 if v.exposed_at is not null and v.revoked_at is null and v.created_at>clock_timestamp()-interval '28 days'
  and p_payload#>>'{rawPayload,attribution,consent,analytics}'='true' and p_payload#>>'{rawPayload,attribution,consent,marketing}'='true'
  and p_payload#>>'{rawPayload,attribution,utm,utm_content}'=v.ad_id
  and p_payload#>>'{rawPayload,attribution,utm,utm_campaign}'=x.plan#>>'{scope,campaign}'
  and p_payload#>>'{rawPayload,attribution,utm,utm_term}'=x.plan#>>'{scope,adset}'
  and (p_payload->>'page'=v.page_path or p_payload#>>'{rawPayload,enquiryContext,sourcePath}'=v.page_path)
  and exists(select 1 from public.enquiry_requests original where original.id=r.enquiry_request_id and original.created_at>=v.exposed_at)
 then insert into public.meta_creative_enquiries(enquiry_id,visit) values(r.enquiry_request_id,v.id) on conflict(enquiry_id)do nothing;end if;
 return query select r.contact_id,r.project_id,r.enquiry_request_id,r.already_existed,r.estimate_id;
end$$;
revoke all on function public.marketing_experiment_intake(uuid,text,jsonb,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.marketing_experiment_intake(uuid,text,jsonb,uuid,jsonb) to service_role;
commit;
