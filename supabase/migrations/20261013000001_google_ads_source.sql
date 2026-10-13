-- Install-only. No control is enabled, no provider credential or customer data is provisioned.
create table private.google_ads_control (
  singleton boolean primary key default true check(singleton), actor_id uuid references auth.users(id),
  customer_id text not null default '6328516633' check(customer_id ~ '^[1-9][0-9]{0,19}$'),
  manager_id text default '6596874249', conversion_customer_id text, action_id text, enquiry_action_ids text[] not null default '{}',
  binding_sha256 text, generation bigint not null default 1,
  reports_enabled boolean not null default false, uploads_enabled boolean not null default false,
  enhanced_matching_approved boolean not null default false, retractions_enabled boolean not null default false,
  consent_policy_approved boolean not null default false,
  disclosure_version text not null default '2026-10-sale-measurement-v1',
  upload_mode text not null default 'canary' check(upload_mode in('canary','routine')),
  canary_quote_id uuid references public.quotes(id),
  allowed_consent_bases text[] not null default '{}', consent_effective_from timestamptz,
  check(not uploads_enabled or upload_mode='routine' or canary_quote_id is not null),
  check(allowed_consent_bases <@ array['user_choice','regional_default']::text[]),
  check(not (reports_enabled or uploads_enabled) or (actor_id is not null and binding_sha256 is not null and binding_sha256 ~ '^[a-f0-9]{64}$')),
  check(not uploads_enabled or (conversion_customer_id is not null and conversion_customer_id ~ '^[1-9][0-9]{0,19}$'
    and action_id is not null and action_id ~ '^[1-9][0-9]{0,19}$' and consent_policy_approved
    and cardinality(allowed_consent_bases)>0 and consent_effective_from is not null))
);
insert into private.google_ads_control(singleton) values(true);
create table private.google_ads_runs (
  id uuid primary key default gen_random_uuid(), lane text not null check(lane in('report','sales','verify')),
  generation bigint not null, expires_at timestamptz not null, finished_at timestamptz,
  error_code text, credential_uncertain boolean not null default false
);
create unique index google_ads_one_running_lane on private.google_ads_runs(lane) where finished_at is null;
create table private.google_ads_report (
  singleton boolean primary key default true check(singleton), generation bigint not null,
  payload jsonb not null, fetched_at timestamptz not null, expires_at timestamptz not null
);
create table private.google_ads_sales (
  quote_id uuid primary key references public.quotes(id), project_id uuid not null references public.projects(id),
  generation bigint not null, source_fingerprint text not null,
  payload jsonb, destination jsonb not null, state text not null check(state in('SKIPPED','READY','SENDING','SUBMITTED','ACCEPTED','RETRY','FAILED','REVIEW_REQUIRED','RETRACTION_READY','RETRACTING','RETRACTED')),
  reason text, request_id text, attempts integer not null default 0, retraction_attempts integer not null default 0,
  lease_id uuid references private.google_ads_runs(id), next_attempt_at timestamptz not null default now(),
  first_submitted_at timestamptz, submitted_at timestamptz, checked_at timestamptz, updated_at timestamptz not null default now(),
  adjustment_at timestamptz, diagnostics jsonb,
  check(diagnostics is null or octet_length(diagnostics::text)<=16000),
  check(payload is null or octet_length(payload::text)<=10000)
);
create table private.google_ads_suppressions (
  project_id uuid primary key references public.projects(id), suppressed_at timestamptz not null default now(),
  reason text not null check(reason in('CUSTOMER_OPT_OUT','SOURCE_REVIEW')), recorded_by text not null
);
alter table private.google_ads_control enable row level security;
alter table private.google_ads_runs enable row level security;
alter table private.google_ads_report enable row level security;
alter table private.google_ads_sales enable row level security;
alter table private.google_ads_suppressions enable row level security;
revoke all on private.google_ads_control,private.google_ads_runs,private.google_ads_report,private.google_ads_sales,private.google_ads_suppressions from public,anon,authenticated,service_role;

create function private.google_ads_control_changed() returns trigger language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
begin
  if (to_jsonb(new)-'generation') is distinct from (to_jsonb(old)-'generation') then
    new.generation:=old.generation+1;
    update private.google_ads_runs set finished_at=clock_timestamp(),error_code='AUTHORITY_CHANGED' where finished_at is null;
    if row(new.actor_id,new.binding_sha256,new.customer_id,new.manager_id,new.conversion_customer_id,new.action_id)
      is not distinct from row(old.actor_id,old.binding_sha256,old.customer_id,old.manager_id,old.conversion_customer_id,old.action_id) then
      update private.google_ads_sales set generation=new.generation,updated_at=now() where generation=old.generation;
      update private.google_ads_report set generation=new.generation where generation=old.generation;
    else
      delete from private.google_ads_report where singleton=true;
      update private.google_ads_sales set state='REVIEW_REQUIRED',reason='AUTHORITY_CHANGED',updated_at=now()
        where state not in('SKIPPED','RETRACTED');
    end if;
    -- Immutable destination and frozen event are retained for corrections, even after revocation.
  end if;
  return new;
end $$;
create trigger google_ads_control_changed before update on private.google_ads_control for each row execute function private.google_ads_control_changed();
revoke all on function private.google_ads_control_changed() from public,anon,authenticated,service_role;

-- One authoritative record per commercial scope. Stage labels are never sale evidence.
-- Current accepted versions and actual first-instalment payment evidence own value/date.
create function private.google_ads_sources() returns table(quote_id uuid,project_id uuid,source jsonb)
language sql stable security definer set search_path=pg_catalog,pg_temp as $$
  with accepted as (
    select p.id project_id,a.* from public.projects p cross join lateral public.commercial_current_accepted_quote_versions(p.id) a
  ), facts as (
    select q.id quote_id,q.project_id,a.total_inc_gst_cents,
      e.id receipt_id,e.created_at received_at,e.raw_payload,
      (select min(t.occurred_at) from (
        select entry.occurred_at from public.deposit_invoices i
        join public.xero_deposit_matches m on m.invoice_id=i.id and m.reversed_at is null and m.amount_inc_gst_cents>0
        join public.project_payment_entries entry on entry.id=m.payment_entry_id and entry.entry_type='PAYMENT'
        where i.quote_id=a.quote_id and i.payment_term_position=1 and i.status<>'VOID' and i.currency='NZD'
          and not exists(select 1 from public.project_payment_entries r where r.reverses_entry_id=entry.id)
        union all
        select coalesce((select min(entry.occurred_at) from public.project_payment_entries entry
          where entry.source_invoice_id=i.id and entry.entry_type='PAYMENT' and entry.amount_inc_gst_cents>0
            and not exists(select 1 from public.project_payment_entries r where r.reverses_entry_id=entry.id)),i.paid_at)
        from public.deposit_invoices i where i.quote_id=a.quote_id and i.payment_term_position=1
          and i.status='PAID' and i.total_inc_gst_cents>0 and i.currency='NZD'
      ) t) occurred_at,
      exists(select 1 from public.project_operational_states s where s.project_id=q.project_id and s.state='CLOSED' and s.closed_outcome='CANCELLED') cancelled
    from public.quotes q left join accepted a on a.quote_id=q.id
    left join lateral (select r.* from public.enquiry_requests r where r.project_id=q.project_id
      and r.id<>'f3229ccf-6a1a-4e1a-bcf4-2edf5cc85e70'::uuid order by r.created_at,r.id limit 1) e on true
    where q.project_id<>'10c5db1a-602c-4f0c-8193-855b186215bb'::uuid
  ), bodies as (
    select f.quote_id,f.project_id,jsonb_build_object('quoteId',f.quote_id,'projectId',f.project_id,'receiptId',f.receipt_id,
      'receivedAt',f.received_at,'occurredAt',f.occurred_at,'valueCents',f.total_inc_gst_cents,'currency','NZD',
      'active',coalesce(f.total_inc_gst_cents>0 and f.occurred_at is not null and not f.cancelled,false),
      'marketingConsent',coalesce(f.raw_payload#>'{attribution,consent,marketing}'='true'::jsonb,false)
        and not exists(select 1 from private.google_ads_suppressions s where s.project_id=f.project_id),
      'consentBasis',f.raw_payload#>>'{attribution,consent,basis}',
      'disclosureVersion',case when jsonb_typeof(f.raw_payload->'advertisingDisclosureVersion')='string' then f.raw_payload->>'advertisingDisclosureVersion' end,
      'email',f.raw_payload->>'email','phone',f.raw_payload->>'phone',
      'gclid',f.raw_payload#>>'{attribution,clickIds,gclid}','gbraid',f.raw_payload#>>'{attribution,clickIds,gbraid}',
      'wbraid',f.raw_payload#>>'{attribution,clickIds,wbraid}') body from facts f
  ) select b.quote_id,b.project_id,b.body||jsonb_build_object('fingerprint',encode(sha256(convert_to(b.body::text,'UTF8')),'hex')) from bodies b
$$;
revoke all on function private.google_ads_sources() from public,anon,authenticated,service_role;

create function private.google_ads_authority(p_actor uuid,p_binding text,p_run uuid default null)
returns private.google_ads_control language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare c private.google_ads_control; r private.google_ads_runs;
begin
  if auth.role()<>'service_role' then raise exception 'Service authority required' using errcode='42501'; end if;
  select * into strict c from private.google_ads_control where singleton;
  if p_actor is distinct from c.actor_id or p_binding is distinct from c.binding_sha256 or not exists(
    select 1 from auth.users u join public.portal_users portal_actor on portal_actor.user_id=u.id
      where u.id=p_actor and portal_actor.role in('admin','staff') and u.email_confirmed_at is not null and u.deleted_at is null
        and (u.banned_until is null or u.banned_until<now())) then
    raise exception 'Google authority unavailable' using errcode='42501';
  end if;
  if p_run is not null then
    select * into strict r from private.google_ads_runs where id=p_run;
    if r.generation<>c.generation or r.finished_at is not null or r.expires_at<=clock_timestamp()
      or r.credential_uncertain or (r.lane='report' and not c.reports_enabled) or (r.lane='sales' and not c.uploads_enabled) then
      raise exception 'Google lease unavailable' using errcode='42501';
    end if;
  end if;
  return c;
end $$;
revoke all on function private.google_ads_authority(uuid,text,uuid) from public,anon,authenticated,service_role;
