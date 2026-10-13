-- Install-only: dedicated event-send authority; never reuses the Meta ads_read control.
create table private.meta_sale_control (
  singleton boolean primary key default true check(singleton), actor_id uuid references auth.users(id),
  dataset_id text, binding_sha256 text, credential_expires_at timestamptz, assignment_verified_at timestamptz,
  generation bigint not null default 1, uploads_enabled boolean not null default false,
  contact_matching_approved boolean not null default false, consent_policy_approved boolean not null default false,
  historical_enabled boolean not null default false,
  disclosure_version text not null default '2026-10-sale-measurement-v2',
  allowed_consent_bases text[] not null default '{}', consent_effective_from timestamptz,
  upload_mode text not null default 'canary' check(upload_mode in('canary','routine','historical')),
  canary_quote_id uuid references public.quotes(id),
  check(allowed_consent_bases <@ array['user_choice','regional_default']::text[]),
  check(not uploads_enabled or (actor_id is not null and dataset_id is not null and dataset_id ~ '^[1-9][0-9]{0,19}$'
    and binding_sha256 is not null and binding_sha256 ~ '^[a-f0-9]{64}$' and credential_expires_at is not null
    and assignment_verified_at is not null and consent_policy_approved and consent_effective_from is not null
    and cardinality(allowed_consent_bases)>0 and (upload_mode<>'canary' or canary_quote_id is not null)
    and (upload_mode<>'historical' or historical_enabled)))
);
insert into private.meta_sale_control(singleton) values(true);
create table private.meta_sale_runs (
  id uuid primary key default gen_random_uuid(), generation bigint not null, lane text not null check(lane in('sales','assess')),
  expires_at timestamptz not null, finished_at timestamptz, error_code text
);
create unique index meta_sale_one_active_run on private.meta_sale_runs((true)) where finished_at is null;
create table private.advertising_sale_suppressions (
  project_id uuid references public.projects(id), provider text check(provider in('google','meta')),
  recorded_at timestamptz not null default now(), recorded_by text not null, reason text not null check(reason in('CUSTOMER_OPT_OUT','SOURCE_REVIEW')),
  primary key(project_id,provider)
);
create table private.meta_sale_history_approvals (
  quote_id uuid primary key references public.quotes(id), source_fingerprint text not null check(source_fingerprint ~ '^[a-f0-9]{64}$'),
  identity_source text not null check(identity_source in('original','crm')),
  evidence_ref text not null check(length(evidence_ref) between 1 and 200),
  owner_approval_ref text not null check(length(owner_approval_ref) between 1 and 200),
  recorded_by text not null, approved_at timestamptz not null default now(), revoked_at timestamptz
);
create table private.meta_sale_assessments (
  quote_id uuid primary key references public.quotes(id), project_id uuid not null references public.projects(id),
  source_fingerprint text not null, reasons jsonb not null, matching jsonb not null, assessed_at timestamptz not null default now(),
  check(octet_length(reasons::text)<4000 and octet_length(matching::text)<2000)
);
create table private.meta_sales (
  quote_id uuid primary key references public.quotes(id), project_id uuid not null references public.projects(id),
  generation bigint not null, source_fingerprint text not null, payload jsonb not null, dataset_id text not null,
  state text not null check(state in('READY','SENDING','RETRY','ACCEPTED','REVIEW_REQUIRED','SUPPRESSED')),
  attempts int not null default 0, first_attempt_at timestamptz, next_attempt_at timestamptz not null default now(),
  lease_id uuid references private.meta_sale_runs(id), receipt_id text, accepted_at timestamptz,
  reason text, diagnostics jsonb, updated_at timestamptz not null default now(),
  check(octet_length(payload::text)<10000), check(diagnostics is null or octet_length(diagnostics::text)<2000)
);
alter table private.meta_sale_control enable row level security;
alter table private.meta_sale_runs enable row level security;
alter table private.advertising_sale_suppressions enable row level security;
alter table private.meta_sale_history_approvals enable row level security;
alter table private.meta_sale_assessments enable row level security;
alter table private.meta_sales enable row level security;
revoke all on private.meta_sale_control,private.meta_sale_runs,private.advertising_sale_suppressions,private.meta_sale_history_approvals,
  private.meta_sale_assessments,private.meta_sales from public,anon,authenticated,service_role;

create function private.meta_sale_control_changed() returns trigger language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
begin
  if (to_jsonb(new)-'generation') is distinct from (to_jsonb(old)-'generation') then
    new.generation:=old.generation+1;
    update private.meta_sale_runs set finished_at=clock_timestamp(),error_code='AUTHORITY_CHANGED' where finished_at is null;
    if row(new.actor_id,new.dataset_id,new.binding_sha256) is not distinct from row(old.actor_id,old.dataset_id,old.binding_sha256) then
      update private.meta_sales set generation=new.generation where generation=old.generation;
    else
      update private.meta_sales set state='REVIEW_REQUIRED',reason='AUTHORITY_CHANGED',updated_at=now() where state<>'SUPPRESSED';
    end if;
  end if;
  return new;
end $$;
create trigger meta_sale_control_changed before update on private.meta_sale_control for each row execute function private.meta_sale_control_changed();
revoke all on function private.meta_sale_control_changed() from public,anon,authenticated,service_role;

create function private.meta_sale_sources() returns table(quote_id uuid,project_id uuid,source jsonb)
language sql stable security definer set search_path=pg_catalog,pg_temp as $$
  with bodies as (
    select common.quote_id,common.project_id,jsonb_build_object('quoteId',common.quote_id,'projectId',common.project_id,
      'receiptId',f.receipt_id,'receivedAt',f.received_at,'occurredAt',f.occurred_at,'valueCents',f.total_inc_gst_cents,
      'active',coalesce(f.total_inc_gst_cents>0 and f.occurred_at is not null and not f.cancelled,false),
      'marketingConsent',coalesce(f.raw_payload#>'{attribution,consent,marketing}'='true'::jsonb,false),
      'marketingDenied',coalesce(f.raw_payload#>'{attribution,consent,marketing}'='false'::jsonb
        and f.raw_payload#>>'{attribution,consent,basis}'='user_choice',false),
      'suppressed',exists(select 1 from private.advertising_sale_suppressions s where s.project_id=common.project_id and s.provider='meta'),
      'consentBasis',f.raw_payload#>>'{attribution,consent,basis}',
      'disclosureVersion',case when jsonb_typeof(f.raw_payload->'advertisingDisclosureVersion')='string' then f.raw_payload->>'advertisingDisclosureVersion' end,
      'email',f.raw_payload->>'email','phone',f.raw_payload->>'phone','crmEmail',contact.email,'crmPhone',contact.phone,
      'fbc',f.raw_payload#>>'{attribution,meta,fbc}','fbp',f.raw_payload#>>'{attribution,meta,fbp}') body
    from private.advertising_scope_facts() common
    cross join lateral jsonb_to_record(common.facts) as f(total_inc_gst_cents bigint,receipt_id uuid,received_at timestamptz,raw_payload jsonb,occurred_at timestamptz,cancelled boolean)
    join public.projects p on p.id=common.project_id left join public.contacts contact on contact.id=p.contact_id
  ), fingerprints as (
    select b.*,encode(sha256(convert_to(b.body::text,'UTF8')),'hex') fingerprint from bodies b
  ) select b.quote_id,b.project_id,b.body||jsonb_build_object('fingerprint',b.fingerprint,'historicalApproval',case when h.quote_id is not null
      then jsonb_build_object('identitySource',h.identity_source,'approvedAt',h.approved_at) else null end)
    from fingerprints b left join private.meta_sale_history_approvals h on h.quote_id=b.quote_id and h.source_fingerprint=b.fingerprint and h.revoked_at is null and h.approved_at<=now()
$$;
revoke all on function private.meta_sale_sources() from public,anon,authenticated,service_role;

-- The shared suppression operation extends Google's existing projection without changing other fields.
do $$ declare definition text; needle text:='and not exists(select 1 from private.google_ads_suppressions s where s.project_id=f.project_id)';
begin
  select pg_get_functiondef('private.google_ads_sources()'::regprocedure) into definition;
  if length(definition)-length(replace(definition,needle,''))<>length(needle) then raise exception 'Google projection baseline changed'; end if;
  execute replace(definition,needle,needle||' and not exists(select 1 from private.advertising_sale_suppressions s where s.project_id=f.project_id and s.provider=''google'')');
end $$;

create function private.meta_sale_authority(p_actor uuid,p_binding text,p_run uuid default null) returns private.meta_sale_control
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare c private.meta_sale_control; r private.meta_sale_runs;
begin
  if auth.role()<>'service_role' then raise exception 'Service authority required' using errcode='42501'; end if;
  select * into strict c from private.meta_sale_control where singleton=true;
  if p_actor is distinct from c.actor_id or p_binding is distinct from c.binding_sha256 or c.actor_id is null or c.binding_sha256 is null
    or not exists(select 1 from auth.users u join public.portal_users p on p.user_id=u.id where u.id=p_actor and p.role in('admin','staff')
      and u.email_confirmed_at is not null and u.deleted_at is null and (u.banned_until is null or u.banned_until<now())) then
    raise exception 'Meta sale authority unavailable' using errcode='42501'; end if;
  if p_run is not null then
    select * into strict r from private.meta_sale_runs where id=p_run;
    if r.generation<>c.generation or r.finished_at is not null or r.expires_at<=clock_timestamp()
      or (r.lane='sales' and (not c.uploads_enabled or c.credential_expires_at<=clock_timestamp()+interval '1 minute')) then
      raise exception 'Meta sale lease unavailable' using errcode='42501'; end if;
  end if;
  return c;
end $$;
revoke all on function private.meta_sale_authority(uuid,text,uuid) from public,anon,authenticated,service_role;
