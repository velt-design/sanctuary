-- Durable, consent-aware GA4 delivery for marketing lifecycle audit events.
-- Browser enquiry conversion stays in GTM; downstream portal conversions enter
-- this outbox so retries never depend on a staff browser or request lifetime.

begin;

-- Mutable row updated_at values cannot prove when a lifecycle transition
-- happened. Capture the first transition time inside PostgreSQL and never
-- backfill existing terminal rows: a legacy NULL must fail closed on replay.
alter table public.projects
  add column if not exists deposit_received_at timestamptz null;

alter table public.site_visit_events
  add column if not exists confirmed_at timestamptz null;

comment on column public.projects.deposit_received_at is
  'Database-owned first occurrence time for a deposit-stage transition with a paid date.';
comment on column public.site_visit_events.confirmed_at is
  'Database-owned first occurrence time for a confirmed site visit.';

create or replace function public.capture_project_deposit_received_at()
returns trigger
language plpgsql
set search_path = pg_catalog, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    new.deposit_received_at := case
      when upper(btrim(coalesce(new.pipeline_stage::text, ''))) = 'DEPOSIT'
        and new.deposit_paid_date is not null
      then clock_timestamp()
      else null
    end;
    return new;
  end if;

  if old.deposit_received_at is not null then
    new.deposit_received_at := old.deposit_received_at;
  elsif upper(btrim(coalesce(old.pipeline_stage::text, ''))) <> 'DEPOSIT'
    and upper(btrim(coalesce(new.pipeline_stage::text, ''))) = 'DEPOSIT'
    and new.deposit_paid_date is not null
  then
    new.deposit_received_at := clock_timestamp();
  else
    new.deposit_received_at := null;
  end if;

  return new;
end;
$$;

revoke all on function public.capture_project_deposit_received_at()
  from public, anon, authenticated, service_role;

drop trigger if exists projects_capture_deposit_received_at
  on public.projects;
create trigger projects_capture_deposit_received_at
before insert or update on public.projects
for each row
execute function public.capture_project_deposit_received_at();

create or replace function public.capture_site_visit_confirmed_at()
returns trigger
language plpgsql
set search_path = pg_catalog, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    new.confirmed_at := case
      when upper(btrim(coalesce(new.status::text, ''))) = 'CONFIRMED'
      then clock_timestamp()
      else null
    end;
    return new;
  end if;

  if old.confirmed_at is not null then
    new.confirmed_at := old.confirmed_at;
  elsif upper(btrim(coalesce(old.status::text, ''))) <> 'CONFIRMED'
    and upper(btrim(coalesce(new.status::text, ''))) = 'CONFIRMED'
  then
    new.confirmed_at := clock_timestamp();
  else
    new.confirmed_at := null;
  end if;

  return new;
end;
$$;

revoke all on function public.capture_site_visit_confirmed_at()
  from public, anon, authenticated, service_role;

drop trigger if exists site_visit_events_capture_confirmed_at
  on public.site_visit_events;
create trigger site_visit_events_capture_confirmed_at
before insert or update on public.site_visit_events
for each row
execute function public.capture_site_visit_confirmed_at();

create table public.marketing_conversion_deliveries (
  id uuid primary key default gen_random_uuid(),
  audit_event_id uuid not null references public.audit_events(id) on delete cascade,
  destination text not null default 'GA4' check (destination = 'GA4'),
  status text not null default 'PENDING'
    check (status in ('PENDING', 'PROCESSING', 'RETRY', 'SENT', 'SKIPPED', 'FAILED')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 100),
  max_attempts integer not null default 8 check (max_attempts between 1 and 20),
  next_attempt_at timestamptz not null default now(),
  lease_token uuid null,
  lease_expires_at timestamptz null,
  last_error_code text null
    check (
      last_error_code is null
      or last_error_code ~ '^[A-Z0-9_]{1,64}$'
    ),
  provider_status integer null check (provider_status between 100 and 599),
  sent_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (audit_event_id, destination),
  check (
    (
      status = 'PROCESSING'
      and lease_token is not null
      and lease_expires_at is not null
    )
    or (
      status <> 'PROCESSING'
      and lease_token is null
      and lease_expires_at is null
    )
  )
);

create index marketing_conversion_deliveries_due_idx
  on public.marketing_conversion_deliveries (next_attempt_at, created_at)
  where status in ('PENDING', 'RETRY', 'PROCESSING');

alter table public.marketing_conversion_deliveries enable row level security;
revoke all on table public.marketing_conversion_deliveries
  from public, anon, authenticated, service_role;

create or replace function public.marketing_conversion_delivery_enqueue()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  if new.type in (
    'marketing.site_visit_booked',
    'marketing.quote_accepted',
    'marketing.deposit_received',
    'marketing.project_lost'
  ) then
    insert into public.marketing_conversion_deliveries (audit_event_id)
    values (new.id)
    on conflict (audit_event_id, destination) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.marketing_conversion_delivery_enqueue()
  from public, anon, authenticated, service_role;

create trigger audit_events_enqueue_marketing_conversion_delivery
after insert on public.audit_events
for each row
execute function public.marketing_conversion_delivery_enqueue();

-- Preserve events committed shortly before this migration is applied.
insert into public.marketing_conversion_deliveries (audit_event_id)
select event.id
from public.audit_events event
where event.type in (
  'marketing.site_visit_booked',
  'marketing.quote_accepted',
  'marketing.deposit_received',
  'marketing.project_lost'
)
  and event.created_at >= now() - interval '72 hours'
on conflict (audit_event_id, destination) do nothing;

create or replace function public.marketing_conversion_delivery_claim(
  p_limit integer default 20,
  p_lease_seconds integer default 120
)
returns table (
  delivery_id uuid,
  audit_event_id uuid,
  event_type text,
  event_timestamp timestamptz,
  payload jsonb,
  attempt_count integer,
  max_attempts integer,
  lease_token uuid
)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  update public.marketing_conversion_deliveries delivery
  set status = 'FAILED',
      lease_token = null,
      lease_expires_at = null,
      last_error_code = 'MAX_ATTEMPTS_EXHAUSTED',
      updated_at = now()
  where delivery.attempt_count >= delivery.max_attempts
    and (
      delivery.status in ('PENDING', 'RETRY')
      or (
        delivery.status = 'PROCESSING'
        and delivery.lease_expires_at <= now()
      )
    );

  return query
  with candidates as (
    select delivery.id
    from public.marketing_conversion_deliveries delivery
    where delivery.attempt_count < delivery.max_attempts
      and (
        (
          delivery.status in ('PENDING', 'RETRY')
          and delivery.next_attempt_at <= now()
        ) or (
          delivery.status = 'PROCESSING'
          and delivery.lease_expires_at <= now()
        )
      )
    order by delivery.next_attempt_at, delivery.created_at
    for update skip locked
    limit least(greatest(coalesce(p_limit, 20), 1), 100)
  ),
  claimed as (
    update public.marketing_conversion_deliveries delivery
    set status = 'PROCESSING',
        attempt_count = delivery.attempt_count + 1,
        lease_token = gen_random_uuid(),
        lease_expires_at = now()
          + make_interval(secs => least(greatest(coalesce(p_lease_seconds, 120), 30), 600)),
        updated_at = now()
    from candidates
    where delivery.id = candidates.id
    returning delivery.*
  )
  select
    claimed.id,
    claimed.audit_event_id,
    event.type,
    event.created_at,
    event.payload,
    claimed.attempt_count,
    claimed.max_attempts,
    claimed.lease_token
  from claimed
  join public.audit_events event on event.id = claimed.audit_event_id
  order by claimed.created_at;
end;
$$;

create or replace function public.marketing_conversion_delivery_complete(
  p_delivery_id uuid,
  p_lease_token uuid,
  p_outcome text,
  p_error_code text default null,
  p_provider_status integer default null,
  p_retry_after_seconds integer default null
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_status text;
begin
  if p_outcome not in ('SENT', 'SKIPPED', 'RETRY', 'FAILED') then
    raise exception 'invalid marketing conversion delivery outcome'
      using errcode = '22023';
  end if;
  if p_error_code is not null
     and p_error_code !~ '^[A-Z0-9_]{1,64}$' then
    raise exception 'invalid marketing conversion delivery error code'
      using errcode = '22023';
  end if;
  if p_provider_status is not null
     and p_provider_status not between 100 and 599 then
    raise exception 'invalid marketing conversion provider status'
      using errcode = '22023';
  end if;

  update public.marketing_conversion_deliveries delivery
  set status = case
        when p_outcome = 'RETRY' and delivery.attempt_count >= delivery.max_attempts
          then 'FAILED'
        else p_outcome
      end,
      next_attempt_at = case
        when p_outcome = 'RETRY' and delivery.attempt_count < delivery.max_attempts
          then now()
            + make_interval(
                secs => least(greatest(coalesce(p_retry_after_seconds, 300), 30), 86400)
              )
        else delivery.next_attempt_at
      end,
      lease_token = null,
      lease_expires_at = null,
      last_error_code = p_error_code,
      provider_status = p_provider_status,
      sent_at = case when p_outcome = 'SENT' then now() else delivery.sent_at end,
      updated_at = now()
  where delivery.id = p_delivery_id
    and delivery.status = 'PROCESSING'
    and delivery.lease_token = p_lease_token
    and delivery.lease_expires_at > now()
  returning delivery.status into v_status;

  if not found then
    raise exception 'marketing conversion delivery lease is no longer owned'
      using errcode = '55000';
  end if;
  return v_status;
end;
$$;

revoke all on function public.marketing_conversion_delivery_claim(integer, integer)
  from public, anon, authenticated;
grant execute on function public.marketing_conversion_delivery_claim(integer, integer)
  to service_role;

revoke all on function public.marketing_conversion_delivery_complete(
  uuid, uuid, text, text, integer, integer
) from public, anon, authenticated;
grant execute on function public.marketing_conversion_delivery_complete(
  uuid, uuid, text, text, integer, integer
) to service_role;

notify pgrst, 'reload schema';

commit;
