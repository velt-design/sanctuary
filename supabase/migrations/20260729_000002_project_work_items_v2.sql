begin;

-- Project Work Items V2.
--
-- This migration adds the replacement work-item/state foundation and marks
-- only projects created through the two governed creation paths. Existing
-- projects remain on the legacy model until a later reviewed migration.

create table if not exists public.project_work_model_versions (
  project_id uuid primary key references public.projects(id) on delete cascade,
  model_version smallint not null check (model_version = 2),
  cutover_at timestamptz not null default clock_timestamp(),
  cutover_by uuid null references public.portal_users(user_id) on delete set null,
  reason text not null check (reason in ('NEW_PROJECT','REVIEWED_MIGRATION','ADMIN_REPAIR'))
);

create table if not exists public.project_operational_states (
  project_id uuid primary key references public.projects(id) on delete cascade,
  state text not null check (state in ('ACTIVE','WAITING','CLOSED')),
  waiting_until timestamptz null,
  waiting_reason text null check (
    waiting_reason is null
    or char_length(btrim(waiting_reason)) between 1 and 500
  ),
  closed_outcome text null check (
    closed_outcome is null
    or closed_outcome in (
      'LOST_NO_RESPONSE',
      'LOST_BUDGET_PRICE',
      'LOST_OTHER_SUPPLIER',
      'LOST_TIMING_DEFERRED',
      'LOST_NOT_SUITABLE',
      'CANCELLED',
      'COMPLETE'
    )
  ),
  closed_note text null check (
    closed_note is null or char_length(closed_note) <= 1000
  ),
  row_version bigint not null default 1 check (row_version > 0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  created_by uuid null references public.portal_users(user_id) on delete set null,
  updated_by uuid null references public.portal_users(user_id) on delete set null,
  constraint project_operational_states_shape check (
    (
      state = 'ACTIVE'
      and waiting_until is null
      and waiting_reason is null
      and closed_outcome is null
      and closed_note is null
    )
    or (
      state = 'WAITING'
      and waiting_until is not null
      and waiting_reason is not null
      and closed_outcome is null
      and closed_note is null
    )
    or (
      state = 'CLOSED'
      and waiting_until is null
      and waiting_reason is null
      and closed_outcome is not null
    )
  )
);

create table if not exists public.project_state_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  command_id uuid not null,
  event_sequence integer not null default 0 check (event_sequence >= 0),
  event_type text not null,
  before_state jsonb null,
  after_state jsonb null,
  reason text null check (reason is null or char_length(reason) <= 1000),
  actor_user_id uuid null references public.portal_users(user_id) on delete set null,
  actor_kind text not null default 'STAFF' check (actor_kind in ('STAFF','SYSTEM','MIGRATION')),
  occurred_at timestamptz not null default clock_timestamp(),
  unique (command_id, event_sequence)
);

create table if not exists public.project_work_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  responsibility_area text not null check (
    responsibility_area in ('CUSTOMER','DESIGN','COMMERCIAL','OPERATIONS','ADMIN')
  ),
  status text not null default 'OPEN' check (status in ('OPEN','BLOCKED','DONE','CANCELLED')),
  due_at timestamptz not null,
  sla_breach_at timestamptz null,
  deadline_policy text null check (
    deadline_policy is null
    or deadline_policy in (
      'LEAD_FIRST_EMAIL_V1',
      'LEAD_FOLLOW_UP_V1',
      'LEAD_CLOSE_REVIEW_V1',
      'QUOTE_FOLLOW_UP_V1',
      'QUOTE_OUTCOME_REVIEW_V1',
      'MANUAL'
    )
  ),
  calendar_revision text null check (
    calendar_revision is null
    or char_length(calendar_revision) between 1 and 128
  ),
  assignee_user_id uuid null references public.portal_users(user_id) on delete set null,
  priority text not null default 'NORMAL' check (priority in ('NORMAL','CRITICAL')),
  priority_reason text null check (
    priority_reason is null
    or char_length(btrim(priority_reason)) between 1 and 500
  ),
  blocked_reason text null check (
    blocked_reason is null
    or char_length(btrim(blocked_reason)) between 1 and 500
  ),
  origin text not null check (origin in ('MANUAL','AUTOMATION','REVIEWED_MIGRATION')),
  source_type text not null check (source_type in ('LEAD_CADENCE','QUOTE_CADENCE','MANUAL','LEGACY_REVIEW')),
  source_key text null check (
    source_key is null or char_length(btrim(source_key)) between 1 and 240
  ),
  series_key text null check (
    series_key is null or char_length(btrim(series_key)) between 1 and 240
  ),
  subject_kind text null check (
    subject_kind is null or subject_kind in ('PROJECT','QUOTE_VERSION','ENQUIRY_REQUEST')
  ),
  subject_id uuid null,
  row_version bigint not null default 1 check (row_version > 0),
  outcome text null check (outcome is null or char_length(outcome) <= 1000),
  cancellation_reason text null check (
    cancellation_reason is null or char_length(btrim(cancellation_reason)) between 1 and 500
  ),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  created_by uuid null references public.portal_users(user_id) on delete set null,
  updated_by uuid null references public.portal_users(user_id) on delete set null,
  completed_at timestamptz null,
  completed_by uuid null references public.portal_users(user_id) on delete set null,
  cancelled_at timestamptz null,
  cancelled_by uuid null references public.portal_users(user_id) on delete set null,
  constraint project_work_items_sla_order check (
    sla_breach_at is null or sla_breach_at >= due_at
  ),
  constraint project_work_items_priority_shape check (
    (priority = 'CRITICAL' and priority_reason is not null)
    or (priority = 'NORMAL' and priority_reason is null)
  ),
  constraint project_work_items_blocked_shape check (
    (status = 'BLOCKED' and blocked_reason is not null)
    or (status <> 'BLOCKED' and blocked_reason is null)
  ),
  constraint project_work_items_origin_shape check (
    (origin = 'MANUAL' and source_type = 'MANUAL' and source_key is null)
    or (
      origin <> 'MANUAL'
      and source_type <> 'MANUAL'
      and source_key is not null
    )
  ),
  constraint project_work_items_subject_shape check (
    (subject_kind is null and subject_id is null)
    or (subject_kind is not null and subject_id is not null)
  ),
  constraint project_work_items_calendar_shape check (
    deadline_policy not in (
      'LEAD_FIRST_EMAIL_V1',
      'LEAD_FOLLOW_UP_V1',
      'LEAD_CLOSE_REVIEW_V1',
      'QUOTE_FOLLOW_UP_V1',
      'QUOTE_OUTCOME_REVIEW_V1'
    )
    or calendar_revision is not null
  ),
  constraint project_work_items_cadence_shape check (
    source_type not in ('LEAD_CADENCE','QUOTE_CADENCE')
    or (
      series_key is not null
      and subject_kind is not null
      and subject_id is not null
    )
  ),
  constraint project_work_items_status_shape check (
    (
      status in ('OPEN','BLOCKED')
      and completed_at is null
      and completed_by is null
      and cancelled_at is null
      and cancelled_by is null
      and cancellation_reason is null
    )
    or (
      status = 'DONE'
      and completed_at is not null
      and cancelled_at is null
      and cancelled_by is null
      and cancellation_reason is null
    )
    or (
      status = 'CANCELLED'
      and completed_at is null
      and completed_by is null
      and cancelled_at is not null
      and cancellation_reason is not null
    )
  )
);

create unique index if not exists project_work_items_source_key_unique
  on public.project_work_items(source_key)
  where source_key is not null;

create unique index if not exists project_work_items_one_active_series
  on public.project_work_items(series_key)
  where series_key is not null and status in ('OPEN','BLOCKED');

create index if not exists project_work_items_project_actionable
  on public.project_work_items(project_id, priority, due_at, created_at, id)
  where status = 'OPEN';

create index if not exists project_work_items_project_active
  on public.project_work_items(project_id, status, due_at, created_at)
  where status in ('OPEN','BLOCKED');

create index if not exists project_work_items_assignee_actionable
  on public.project_work_items(assignee_user_id, due_at, created_at)
  where status = 'OPEN';

create table if not exists public.project_work_item_events (
  id uuid primary key default gen_random_uuid(),
  work_item_id uuid not null references public.project_work_items(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  command_id uuid not null,
  event_sequence integer not null default 0 check (event_sequence >= 0),
  event_type text not null check (
    event_type in (
      'CREATED',
      'COMPLETED',
      'CANCELLED',
      'RESCHEDULED',
      'REASSIGNED',
      'BLOCKED',
      'UNBLOCKED',
      'PRIORITY_CHANGED',
      'REOPENED',
      'SYSTEM_RECONCILED'
    )
  ),
  before_state jsonb null,
  after_state jsonb null,
  reason text null check (reason is null or char_length(reason) <= 1000),
  actor_user_id uuid null references public.portal_users(user_id) on delete set null,
  actor_kind text not null default 'STAFF' check (actor_kind in ('STAFF','SYSTEM','MIGRATION')),
  occurred_at timestamptz not null default clock_timestamp(),
  unique (command_id, event_sequence)
);

create index if not exists project_work_item_events_project_recent
  on public.project_work_item_events(project_id, occurred_at desc, id desc);

create index if not exists project_work_item_events_item_recent
  on public.project_work_item_events(work_item_id, occurred_at desc, id desc);

create table if not exists public.project_confirmation_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  command_id uuid not null,
  event_sequence integer not null default 0 check (event_sequence >= 0),
  event_kind text not null check (event_kind in ('CONFIRMED','RETRACTED')),
  confirmation_type text not null check (
    confirmation_type in (
      'FIRST_ENQUIRY_EMAIL_SENT',
      'ENQUIRY_FOLLOW_UP_EMAIL_SENT',
      'ENQUIRY_CUSTOMER_REPLY_RECEIVED',
      'QUOTE_FOLLOW_UP_EMAIL_SENT',
      'QUOTE_CUSTOMER_REPLY_RECEIVED',
      'SITE_VISIT_COMPLETED'
    )
  ),
  subject_kind text null check (
    subject_kind is null or subject_kind in ('PROJECT','QUOTE_VERSION','ENQUIRY_REQUEST')
  ),
  subject_id uuid null,
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default clock_timestamp(),
  recorded_by uuid null references public.portal_users(user_id) on delete set null,
  actor_kind text not null default 'STAFF' check (actor_kind in ('STAFF','SYSTEM','MIGRATION')),
  source_key text null check (
    source_key is null or char_length(btrim(source_key)) between 1 and 240
  ),
  retracts_event_id uuid null references public.project_confirmation_events(id) on delete restrict,
  reason text null check (reason is null or char_length(btrim(reason)) between 1 and 1000),
  constraint project_confirmation_events_subject_shape check (
    (subject_kind is null and subject_id is null)
    or (subject_kind is not null and subject_id is not null)
  ),
  constraint project_confirmation_events_kind_shape check (
    (
      event_kind = 'CONFIRMED'
      and retracts_event_id is null
      and reason is null
    )
    or (
      event_kind = 'RETRACTED'
      and retracts_event_id is not null
      and reason is not null
    )
  ),
  unique (command_id, event_sequence)
);

create unique index if not exists project_confirmation_events_source_key_unique
  on public.project_confirmation_events(source_key)
  where source_key is not null;

create unique index if not exists project_confirmation_events_one_retraction
  on public.project_confirmation_events(retracts_event_id)
  where retracts_event_id is not null;

create index if not exists project_confirmation_events_project_type_recent
  on public.project_confirmation_events(project_id, confirmation_type, recorded_at desc);

create table if not exists public.project_command_receipts (
  command_id uuid primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  command_type text not null check (char_length(btrim(command_type)) between 1 and 120),
  intent_hash text not null check (char_length(intent_hash) = 64),
  actor_user_id uuid null references public.portal_users(user_id) on delete set null,
  actor_kind text not null check (actor_kind in ('STAFF','SYSTEM','MIGRATION')),
  committed_result jsonb not null,
  committed_at timestamptz not null default clock_timestamp()
);

create index if not exists project_command_receipts_project_recent
  on public.project_command_receipts(project_id, committed_at desc);

create table if not exists public.project_work_repair_signals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  repair_kind text not null default 'QUOTE_CADENCE_RECONCILIATION'
    check (repair_kind = 'QUOTE_CADENCE_RECONCILIATION'),
  source_event text not null
    check (source_event in ('QUOTE_SENT','QUOTE_RESENT','QUOTE_OUTCOME')),
  quote_version_id uuid not null
    references public.quote_versions(id) on delete restrict,
  command_id uuid not null unique,
  status text not null check (status in ('OPEN','RESOLVED')),
  error_code text not null
    check (char_length(btrim(error_code)) between 1 and 120),
  error_message text not null
    check (char_length(btrim(error_message)) between 1 and 500),
  attempt_count integer not null default 1 check (attempt_count > 0),
  row_version bigint not null default 1 check (row_version > 0),
  first_detected_at timestamptz not null default clock_timestamp(),
  last_detected_at timestamptz not null default clock_timestamp(),
  resolved_at timestamptz null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint project_work_repair_signals_status_shape check (
    (status = 'OPEN' and resolved_at is null)
    or (status = 'RESOLVED' and resolved_at is not null)
  ),
  constraint project_work_repair_signals_time_order check (
    last_detected_at >= first_detected_at
  )
);

create index if not exists project_work_repair_signals_open_project
  on public.project_work_repair_signals(
    project_id,
    first_detected_at,
    id
  )
  where status = 'OPEN';

create table if not exists public.business_calendar_year_coverage (
  region text not null,
  local_year integer not null check (local_year between 2000 and 2200),
  source_version text not null check (char_length(btrim(source_version)) between 1 and 200),
  verified_at timestamptz not null,
  verified_by uuid null references public.portal_users(user_id) on delete set null,
  primary key (region, local_year)
);

create index if not exists project_operational_states_state_wake
  on public.project_operational_states(state, waiting_until)
  where state = 'WAITING';

create index if not exists project_state_events_project_recent
  on public.project_state_events(project_id, occurred_at desc, id desc);

-- Employment New Zealand observed public-holiday dates, plus Auckland's
-- observed anniversary day:
-- https://www.employment.govt.nz/leave-and-holidays/public-holidays/public-holidays-and-anniversary-dates
insert into public.nz_holidays(date, name, scope, region)
values
  ('2026-01-01','New Year''s Day','national',null),
  ('2026-01-02','Day after New Year''s Day','national',null),
  ('2026-01-26','Auckland Anniversary Day','regional','Auckland'),
  ('2026-02-06','Waitangi Day','national',null),
  ('2026-04-03','Good Friday','national',null),
  ('2026-04-06','Easter Monday','national',null),
  ('2026-04-27','Anzac Day (observed)','national',null),
  ('2026-06-01','King''s Birthday','national',null),
  ('2026-07-10','Matariki','national',null),
  ('2026-10-26','Labour Day','national',null),
  ('2026-12-25','Christmas Day','national',null),
  ('2026-12-28','Boxing Day (observed)','national',null),
  ('2027-01-01','New Year''s Day','national',null),
  ('2027-01-04','Day after New Year''s Day (observed)','national',null),
  ('2027-02-01','Auckland Anniversary Day (observed)','regional','Auckland'),
  ('2027-02-08','Waitangi Day (observed)','national',null),
  ('2027-03-26','Good Friday','national',null),
  ('2027-03-29','Easter Monday','national',null),
  ('2027-04-26','Anzac Day (observed)','national',null),
  ('2027-06-07','King''s Birthday','national',null),
  ('2027-06-25','Matariki','national',null),
  ('2027-10-25','Labour Day','national',null),
  ('2027-12-27','Christmas Day (observed)','national',null),
  ('2027-12-28','Boxing Day (observed)','national',null)
on conflict(date) do update set
  name = excluded.name,
  scope = excluded.scope,
  region = excluded.region,
  updated_at = clock_timestamp();

insert into public.business_calendar_year_coverage(
  region,
  local_year,
  source_version,
  verified_at,
  verified_by
)
values
  ('Auckland', 2026, 'employment-nz-observed-dates-v1', '2026-07-29T00:00:00Z', null),
  ('Auckland', 2027, 'employment-nz-observed-dates-v1', '2026-07-29T00:00:00Z', null)
on conflict(region, local_year) do update set
  source_version = excluded.source_version,
  verified_at = excluded.verified_at;

create or replace function public.project_work_items_intent_hash(
  p_project_id uuid,
  p_command_type text,
  p_intent jsonb
)
returns text
language sql
immutable
set search_path = pg_catalog, pg_temp
as $$
  select encode(
    sha256(
      convert_to(
        jsonb_build_object(
          'projectId', p_project_id,
          'commandType', p_command_type,
          'intent', coalesce(p_intent, '{}'::jsonb)
        )::text,
        'UTF8'
      )
    ),
    'hex'
  );
$$;

create or replace function public.project_work_items_is_business_date(
  p_date date,
  p_region text default 'Auckland'
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select
    extract(isodow from p_date) between 1 and 5
    and not exists (
      select 1
      from public.nz_holidays holiday
      where holiday.date = p_date
        and (
          holiday.scope = 'national'
          or (
            holiday.scope = 'regional'
            and lower(btrim(coalesce(holiday.region, ''))) = lower(btrim(p_region))
          )
        )
    )
    and not exists (
      select 1
      from public.company_closures closure
      where closure.date = p_date
        and (
          nullif(btrim(coalesce(closure.region, '')), '') is null
          or lower(btrim(closure.region)) = lower(btrim(p_region))
        )
    );
$$;

create or replace function public.project_work_items_require_calendar_coverage(
  p_start_date date,
  p_end_date date,
  p_region text default 'Auckland'
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_year integer;
begin
  if p_start_date is null or p_end_date is null or p_end_date < p_start_date then
    raise exception 'invalid business-calendar range' using errcode = '22023';
  end if;

  for v_year in
    select generate_series(
      extract(year from p_start_date)::integer,
      extract(year from p_end_date)::integer
    )
  loop
    if not exists (
      select 1
      from public.business_calendar_year_coverage coverage
      where lower(btrim(coverage.region)) = lower(btrim(p_region))
        and coverage.local_year = v_year
    ) then
      raise exception 'BUSINESS_CALENDAR_UNAVAILABLE: % coverage for % is not verified', p_region, v_year
        using errcode = 'P0001';
    end if;
  end loop;
end;
$$;

create or replace function public.project_work_items_calendar_revision(
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_region text default 'Auckland'
)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_start date := (least(p_start_at, p_end_at) at time zone 'Pacific/Auckland')::date;
  v_end date := (greatest(p_start_at, p_end_at) at time zone 'Pacific/Auckland')::date;
  v_material text;
begin
  perform public.project_work_items_require_calendar_coverage(v_start, v_end, p_region);

  select concat_ws(
    '|',
    'work-items-calendar-v1',
    lower(btrim(p_region)),
    coalesce((
      select string_agg(
        coverage.local_year::text || ':' || coverage.source_version,
        ',' order by coverage.local_year
      )
      from public.business_calendar_year_coverage coverage
      where lower(btrim(coverage.region)) = lower(btrim(p_region))
        and coverage.local_year between extract(year from v_start)::integer
          and extract(year from v_end)::integer
    ), ''),
    coalesce((
      select string_agg(
        holiday.date::text || ':' || holiday.scope || ':' ||
          coalesce(lower(btrim(holiday.region)), '') || ':' || holiday.name,
        ',' order by holiday.date, holiday.scope, holiday.name
      )
      from public.nz_holidays holiday
      where holiday.date between v_start and v_end
        and (
          holiday.scope = 'national'
          or lower(btrim(coalesce(holiday.region, ''))) = lower(btrim(p_region))
        )
    ), ''),
    coalesce((
      select string_agg(
        closure.date::text || ':' ||
          coalesce(lower(btrim(closure.region)), '') || ':' || closure.name,
        ',' order by closure.date, closure.name
      )
      from public.company_closures closure
      where closure.date between v_start and v_end
        and (
          nullif(btrim(coalesce(closure.region, '')), '') is null
          or lower(btrim(closure.region)) = lower(btrim(p_region))
        )
    ), '')
  )
  into v_material;

  return encode(sha256(convert_to(v_material, 'UTF8')), 'hex');
end;
$$;

create or replace function public.project_work_items_add_open_hours(
  p_from timestamptz,
  p_hours integer,
  p_region text default 'Auckland'
)
returns timestamptz
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_local timestamp without time zone;
  v_date date;
  v_close timestamp without time zone;
  v_remaining interval;
  v_available interval;
  v_guard integer := 0;
begin
  if p_from is null or p_hours <= 0 or p_hours > 80 then
    raise exception 'invalid open-hours deadline input' using errcode = '22023';
  end if;

  v_local := p_from at time zone 'Pacific/Auckland';
  v_remaining := make_interval(hours => p_hours);

  while v_remaining > interval '0 seconds' loop
    v_guard := v_guard + 1;
    if v_guard > 400 then
      raise exception 'BUSINESS_CALENDAR_UNAVAILABLE: deadline exceeded calendar guard'
        using errcode = 'P0001';
    end if;

    v_date := v_local::date;
    perform public.project_work_items_require_calendar_coverage(v_date, v_date, p_region);

    if not public.project_work_items_is_business_date(v_date, p_region) then
      v_local := (v_date + 1) + time '09:00';
      continue;
    end if;

    if v_local::time < time '09:00' then
      v_local := v_date + time '09:00';
    elsif v_local::time >= time '17:00' then
      v_local := (v_date + 1) + time '09:00';
      continue;
    end if;

    v_close := v_local::date + time '17:00';
    v_available := v_close - v_local;
    if v_remaining <= v_available then
      v_local := v_local + v_remaining;
      v_remaining := interval '0 seconds';
    else
      v_remaining := v_remaining - v_available;
      v_local := (v_local::date + 1) + time '09:00';
    end if;
  end loop;

  return v_local at time zone 'Pacific/Auckland';
end;
$$;

create or replace function public.project_work_items_add_business_days_due(
  p_from timestamptz,
  p_days integer,
  p_region text default 'Auckland'
)
returns timestamptz
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_date date;
  v_remaining integer := p_days;
  v_guard integer := 0;
begin
  if p_from is null or p_days <= 0 or p_days > 365 then
    raise exception 'invalid business-days deadline input' using errcode = '22023';
  end if;

  v_date := (p_from at time zone 'Pacific/Auckland')::date + 1;
  while v_remaining > 0 loop
    v_guard := v_guard + 1;
    if v_guard > 800 then
      raise exception 'BUSINESS_CALENDAR_UNAVAILABLE: deadline exceeded calendar guard'
        using errcode = 'P0001';
    end if;
    perform public.project_work_items_require_calendar_coverage(v_date, v_date, p_region);
    if public.project_work_items_is_business_date(v_date, p_region) then
      v_remaining := v_remaining - 1;
      if v_remaining = 0 then
        return (v_date + time '17:00') at time zone 'Pacific/Auckland';
      end if;
    end if;
    v_date := v_date + 1;
  end loop;

  raise exception 'BUSINESS_CALENDAR_UNAVAILABLE: failed to resolve deadline'
    using errcode = 'P0001';
end;
$$;

create or replace function public.project_work_items_last_business_day_due(
  p_date date,
  p_region text default 'Auckland'
)
returns timestamptz
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_date date := p_date;
  v_guard integer := 0;
begin
  if p_date is null then
    raise exception 'invalid expiry date' using errcode = '22023';
  end if;
  loop
    v_guard := v_guard + 1;
    if v_guard > 30 then
      raise exception 'BUSINESS_CALENDAR_UNAVAILABLE: failed to resolve expiry deadline'
        using errcode = 'P0001';
    end if;
    perform public.project_work_items_require_calendar_coverage(v_date, v_date, p_region);
    if public.project_work_items_is_business_date(v_date, p_region) then
      return (v_date + time '17:00') at time zone 'Pacific/Auckland';
    end if;
    v_date := v_date - 1;
  end loop;
end;
$$;

create or replace function public.project_work_items_first_business_day_after_due(
  p_date date,
  p_region text default 'Auckland'
)
returns timestamptz
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_date date := p_date + 1;
  v_guard integer := 0;
begin
  if p_date is null then
    raise exception 'invalid expiry date' using errcode = '22023';
  end if;
  loop
    v_guard := v_guard + 1;
    if v_guard > 30 then
      raise exception 'BUSINESS_CALENDAR_UNAVAILABLE: failed to resolve post-expiry deadline'
        using errcode = 'P0001';
    end if;
    perform public.project_work_items_require_calendar_coverage(v_date, v_date, p_region);
    if public.project_work_items_is_business_date(v_date, p_region) then
      return (v_date + time '17:00') at time zone 'Pacific/Auckland';
    end if;
    v_date := v_date + 1;
  end loop;
end;
$$;

create or replace function public.project_work_items_append_only_guard()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = '42501';
end;
$$;

create or replace function public.project_work_items_governed_write_guard()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  if current_setting('sanctuary.project_work_command', true) = 'allowed' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  raise exception '% may only be changed by a project-work command', tg_table_name
    using errcode = '42501';
end;
$$;

drop trigger if exists project_work_model_versions_governed_write
  on public.project_work_model_versions;
create trigger project_work_model_versions_governed_write
before insert or update or delete on public.project_work_model_versions
for each row execute function public.project_work_items_governed_write_guard();

drop trigger if exists project_operational_states_governed_write
  on public.project_operational_states;
create trigger project_operational_states_governed_write
before insert or update or delete on public.project_operational_states
for each row execute function public.project_work_items_governed_write_guard();

drop trigger if exists project_work_items_governed_write
  on public.project_work_items;
create trigger project_work_items_governed_write
before insert or update or delete on public.project_work_items
for each row execute function public.project_work_items_governed_write_guard();

create or replace function public.project_work_repair_signal_write_guard()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  if current_setting('sanctuary.project_work_repair_signal', true) = 'allowed'
  then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  raise exception
    'project work repair signals may only be changed by their service command'
    using errcode = '42501';
end;
$$;

drop trigger if exists project_work_repair_signals_governed_write
  on public.project_work_repair_signals;
create trigger project_work_repair_signals_governed_write
before insert or update or delete on public.project_work_repair_signals
for each row execute function public.project_work_repair_signal_write_guard();

drop trigger if exists project_operational_states_set_updated_at
  on public.project_operational_states;
create trigger project_operational_states_set_updated_at
before update on public.project_operational_states
for each row execute function public.set_updated_at();

drop trigger if exists project_work_items_set_updated_at
  on public.project_work_items;
create trigger project_work_items_set_updated_at
before update on public.project_work_items
for each row execute function public.set_updated_at();

drop trigger if exists project_work_repair_signals_set_updated_at
  on public.project_work_repair_signals;
create trigger project_work_repair_signals_set_updated_at
before update on public.project_work_repair_signals
for each row execute function public.set_updated_at();

drop trigger if exists project_state_events_append_only
  on public.project_state_events;
create trigger project_state_events_append_only
before update or delete on public.project_state_events
for each row execute function public.project_work_items_append_only_guard();

drop trigger if exists project_work_item_events_append_only
  on public.project_work_item_events;
create trigger project_work_item_events_append_only
before update or delete on public.project_work_item_events
for each row execute function public.project_work_items_append_only_guard();

drop trigger if exists project_confirmation_events_append_only
  on public.project_confirmation_events;
create trigger project_confirmation_events_append_only
before update or delete on public.project_confirmation_events
for each row execute function public.project_work_items_append_only_guard();

drop trigger if exists project_command_receipts_append_only
  on public.project_command_receipts;
create trigger project_command_receipts_append_only
before update or delete on public.project_command_receipts
for each row execute function public.project_work_items_append_only_guard();

create or replace function public.project_work_items_assert_v2(
  p_project_id uuid,
  p_for_update boolean default false
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_exists boolean;
begin
  if p_project_id is null then
    raise exception 'project id is required' using errcode = '22023';
  end if;
  if p_for_update then
    perform 1 from public.projects where id = p_project_id for update;
    if not found then
      raise exception 'PROJECT_NOT_FOUND' using errcode = 'P0002';
    end if;
  else
    select exists(select 1 from public.projects where id = p_project_id)
      into v_exists;
    if not v_exists then
      raise exception 'PROJECT_NOT_FOUND' using errcode = 'P0002';
    end if;
  end if;
  if not exists (
    select 1
    from public.project_work_model_versions model
    where model.project_id = p_project_id
      and model.model_version = 2
  ) then
    raise exception 'PROJECT_WORK_MODEL_NOT_V2' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.project_work_items_compatibility_write_guard()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if (
    old.next_action is distinct from new.next_action
    or old.next_action_type is distinct from new.next_action_type
    or old.next_action_at is distinct from new.next_action_at
    or old.next_action_date is distinct from new.next_action_date
    or old.follow_up_date is distinct from new.follow_up_date
  )
  and exists (
    select 1
    from public.project_work_model_versions model
    where model.project_id = old.id
      and model.model_version = 2
  )
  and current_setting('sanctuary.work_items_projection', true)
    is distinct from 'allowed'
  then
    raise exception 'V2 project compatibility fields are projection-owned'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists projects_work_items_compatibility_write_guard
  on public.projects;
create trigger projects_work_items_compatibility_write_guard
before update on public.projects
for each row execute function public.project_work_items_compatibility_write_guard();

create or replace function public.project_work_items_archive_write_guard()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_uses_v2 boolean;
begin
  if old.archived_at is not distinct from new.archived_at then
    return new;
  end if;
  select exists (
      select 1
      from public.project_work_model_versions model
      where model.project_id = old.id
        and model.model_version = 2
    )
  into v_uses_v2;
  if v_uses_v2
    and current_setting('sanctuary.project_archive_command', true)
      is distinct from 'allowed'
  then
    raise exception 'V2 project archive state requires the archive command'
      using errcode = '42501';
  elsif not v_uses_v2 and not public.is_portal_admin() then
    raise exception 'project archive changes require admin'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists projects_work_items_archive_write_guard
  on public.projects;
create trigger projects_work_items_archive_write_guard
before update on public.projects
for each row execute function public.project_work_items_archive_write_guard();

create or replace function public.project_work_items_refresh_projection(
  p_project_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_archived_at timestamptz;
  v_state text;
  v_item public.project_work_items%rowtype;
  v_previous_setting text;
  v_title text;
  v_due_at timestamptz;
begin
  if not exists (
    select 1
    from public.project_work_model_versions model
    where model.project_id = p_project_id
      and model.model_version = 2
  ) then
    return;
  end if;

  select project.archived_at, state.state
  into v_archived_at, v_state
  from public.projects project
  join public.project_operational_states state
    on state.project_id = project.id
  where project.id = p_project_id;

  if v_archived_at is null and v_state = 'ACTIVE' then
    select item.*
    into v_item
    from public.project_work_items item
    where item.project_id = p_project_id
      and item.status = 'OPEN'
    order by
      case item.priority when 'CRITICAL' then 0 else 1 end,
      item.due_at,
      item.created_at,
      item.id
    limit 1;
    if found then
      v_title := v_item.title;
      v_due_at := v_item.due_at;
    end if;
  end if;

  v_previous_setting := current_setting('sanctuary.work_items_projection', true);
  perform set_config('sanctuary.work_items_projection', 'allowed', true);
  update public.projects
  set
    next_action = v_title,
    next_action_type = null,
    next_action_at = v_due_at,
    next_action_date = case
      when v_due_at is null then null
      else (v_due_at at time zone 'Pacific/Auckland')::date
    end,
    follow_up_date = case
      when v_due_at is null then null
      else (v_due_at at time zone 'Pacific/Auckland')::date
    end
  where id = p_project_id
    and (
      next_action is distinct from v_title
      or next_action_type is not null
      or next_action_at is distinct from v_due_at
      or next_action_date is distinct from case
        when v_due_at is null then null
        else (v_due_at at time zone 'Pacific/Auckland')::date
      end
      or follow_up_date is distinct from case
        when v_due_at is null then null
        else (v_due_at at time zone 'Pacific/Auckland')::date
      end
    );
  perform set_config(
    'sanctuary.work_items_projection',
    coalesce(v_previous_setting, ''),
    true
  );
exception
  when others then
    perform set_config(
      'sanctuary.work_items_projection',
      coalesce(v_previous_setting, ''),
      true
    );
    raise;
end;
$$;

create or replace function public.project_work_items_initialize_project_v2(
  p_project_id uuid,
  p_created_at timestamptz default null,
  p_actor_user_id uuid default null,
  p_reason text default 'NEW_PROJECT'
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_project public.projects%rowtype;
  v_contact_email text;
  v_anchor timestamptz;
  v_due_at timestamptz;
  v_sla_at timestamptz;
  v_calendar_revision text;
  v_status text;
  v_blocked_reason text;
  v_item_id uuid;
  v_state_inserted boolean := false;
  v_item_inserted boolean := false;
  v_command_id uuid := gen_random_uuid();
  v_previous_setting text;
begin
  if p_reason not in ('NEW_PROJECT','REVIEWED_MIGRATION','ADMIN_REPAIR') then
    raise exception 'invalid work-model initialization reason'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_project_id::text, 0));
  select project.*
  into v_project
  from public.projects project
  where project.id = p_project_id
  for update;
  if not found then
    raise exception 'PROJECT_NOT_FOUND' using errcode = 'P0002';
  end if;

  select nullif(btrim(contact.email), '')
  into v_contact_email
  from public.contacts contact
  where contact.id = v_project.contact_id;

  v_anchor := coalesce(p_created_at, v_project.created_at, clock_timestamp());
  v_due_at := public.project_work_items_add_open_hours(v_anchor, 2, 'Auckland');
  v_sla_at := public.project_work_items_add_open_hours(v_anchor, 4, 'Auckland');
  v_calendar_revision := public.project_work_items_calendar_revision(
    v_anchor,
    v_sla_at,
    'Auckland'
  );
  v_status := case when v_contact_email is null then 'BLOCKED' else 'OPEN' end;
  v_blocked_reason := case
    when v_contact_email is null then 'Customer email address is missing'
    else null
  end;

  v_previous_setting := current_setting('sanctuary.project_work_command', true);
  perform set_config('sanctuary.project_work_command', 'allowed', true);

  insert into public.project_work_model_versions(
    project_id,
    model_version,
    cutover_at,
    cutover_by,
    reason
  )
  values (
    p_project_id,
    2,
    clock_timestamp(),
    p_actor_user_id,
    p_reason
  )
  on conflict(project_id) do nothing;

  insert into public.project_operational_states(
    project_id,
    state,
    row_version,
    created_by,
    updated_by
  )
  values (
    p_project_id,
    'ACTIVE',
    1,
    p_actor_user_id,
    p_actor_user_id
  )
  on conflict(project_id) do nothing
  returning true into v_state_inserted;

  if v_state_inserted then
    insert into public.project_state_events(
      project_id,
      command_id,
      event_sequence,
      event_type,
      before_state,
      after_state,
      actor_user_id,
      actor_kind
    )
    values (
      p_project_id,
      v_command_id,
      0,
      'WORK_MODEL_INITIALIZED',
      null,
      jsonb_build_object('state','ACTIVE','row_version',1),
      p_actor_user_id,
      case when p_actor_user_id is null then 'SYSTEM' else 'STAFF' end
    );
  end if;

  insert into public.project_work_items(
    project_id,
    title,
    responsibility_area,
    status,
    due_at,
    sla_breach_at,
    deadline_policy,
    calendar_revision,
    priority,
    blocked_reason,
    origin,
    source_type,
    source_key,
    series_key,
    subject_kind,
    subject_id,
    created_by,
    updated_by
  )
  values (
    p_project_id,
    'Send first enquiry email',
    'CUSTOMER',
    v_status,
    v_due_at,
    v_sla_at,
    'LEAD_FIRST_EMAIL_V1',
    v_calendar_revision,
    'NORMAL',
    v_blocked_reason,
    'AUTOMATION',
    'LEAD_CADENCE',
    'lead:first-email:' || p_project_id::text || ':v1',
    'lead:' || p_project_id::text || ':v1',
    'PROJECT',
    p_project_id,
    p_actor_user_id,
    p_actor_user_id
  )
  on conflict(source_key) where source_key is not null do nothing
  returning id, true into v_item_id, v_item_inserted;

  if v_item_inserted then
    insert into public.project_work_item_events(
      work_item_id,
      project_id,
      command_id,
      event_sequence,
      event_type,
      before_state,
      after_state,
      actor_user_id,
      actor_kind
    )
    select
      item.id,
      item.project_id,
      v_command_id,
      1,
      'CREATED',
      null,
      to_jsonb(item),
      p_actor_user_id,
      case when p_actor_user_id is null then 'SYSTEM' else 'STAFF' end
    from public.project_work_items item
    where item.id = v_item_id;
  else
    select item.id
    into v_item_id
    from public.project_work_items item
    where item.source_key = 'lead:first-email:' || p_project_id::text || ':v1';
  end if;

  perform public.project_work_items_refresh_projection(p_project_id);
  perform set_config(
    'sanctuary.project_work_command',
    coalesce(v_previous_setting, ''),
    true
  );

  return jsonb_build_object(
    'project_id', p_project_id,
    'work_item_id', v_item_id,
    'row_version', 1,
    'replayed', not (v_state_inserted or v_item_inserted),
    'refresh_required', false
  );
exception
  when others then
    perform set_config(
      'sanctuary.project_work_command',
      coalesce(v_previous_setting, ''),
      true
    );
    raise;
end;
$$;

create or replace function public.project_work_items_initialize_enquiry_v2()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  if new.project_id is not null
    and exists (
      select 1
      from public.projects project
      where project.id = new.project_id
        and upper(btrim(project.pipeline_stage)) = 'NEW'
        and project.created_at
          between new.created_at - interval '5 minutes'
          and new.created_at + interval '1 minute'
    )
  then
    perform public.project_work_items_initialize_project_v2(
      new.project_id,
      new.created_at,
      null,
      'NEW_PROJECT'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists enquiry_requests_initialize_project_work_v2
  on public.enquiry_requests;
create trigger enquiry_requests_initialize_project_work_v2
after insert on public.enquiry_requests
for each row execute function public.project_work_items_initialize_enquiry_v2();

create or replace function public.project_create_v2(
  p_project_id uuid,
  p_contact_id uuid,
  p_name text,
  p_quote_ref text default null,
  p_region text default null,
  p_site_address text default null
)
returns table (
  project jsonb,
  replayed boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_project public.projects%rowtype;
  v_actor uuid := auth.uid();
  v_replayed boolean := false;
begin
  if not public.has_portal_access() then
    raise exception 'staff access required' using errcode = '42501';
  end if;
  if p_project_id is null
    or p_contact_id is null
    or nullif(btrim(p_name), '') is null
    or char_length(btrim(p_name)) > 200
  then
    raise exception 'invalid project creation input' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.contacts contact where contact.id = p_contact_id
  ) then
    raise exception 'CONTACT_NOT_FOUND' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_project_id::text, 0));
  select existing.*
  into v_project
  from public.projects existing
  where existing.id = p_project_id
  for update;

  if found then
    if v_project.contact_id is distinct from p_contact_id
      or btrim(v_project.name) is distinct from btrim(p_name)
      or nullif(btrim(coalesce(v_project.quote_ref, '')), '') is distinct from
        nullif(btrim(coalesce(p_quote_ref, '')), '')
      or nullif(btrim(coalesce(v_project.region, '')), '') is distinct from
        nullif(btrim(coalesce(p_region, '')), '')
      or nullif(btrim(coalesce(v_project.site_address, '')), '') is distinct from
        nullif(btrim(coalesce(p_site_address, '')), '')
    then
      raise exception
        'PROJECT_CREATION_COMMAND_CONFLICT: project id is already used for different details'
        using errcode = '40001';
    end if;
    if not exists (
      select 1
      from public.project_work_model_versions model
      where model.project_id = p_project_id
        and model.model_version = 2
    ) then
      raise exception
        'PROJECT_CREATION_COMMAND_CONFLICT: existing legacy projects cannot become V2 create replays'
        using errcode = '40001';
    end if;
    v_replayed := true;
  else
    insert into public.projects(
      id,
      contact_id,
      name,
      quote_ref,
      region,
      site_address,
      pipeline_stage,
      notes
    )
    values (
      p_project_id,
      p_contact_id,
      btrim(p_name),
      nullif(btrim(coalesce(p_quote_ref, '')), ''),
      nullif(btrim(coalesce(p_region, '')), ''),
      nullif(btrim(coalesce(p_site_address, '')), ''),
      'NEW',
      ''
    )
    returning * into v_project;
  end if;

  perform public.project_work_items_initialize_project_v2(
    p_project_id,
    v_project.created_at,
    v_actor,
    'NEW_PROJECT'
  );
  select current_project.*
  into v_project
  from public.projects current_project
  where current_project.id = p_project_id;

  project := to_jsonb(v_project);
  replayed := v_replayed;
  return next;
end;
$$;

create or replace function public.project_work_items_receipt_replay(
  p_project_id uuid,
  p_command_id uuid,
  p_command_type text,
  p_intent jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_receipt public.project_command_receipts%rowtype;
  v_hash text;
begin
  v_hash := public.project_work_items_intent_hash(
    p_project_id,
    p_command_type,
    p_intent
  );
  select receipt.*
  into v_receipt
  from public.project_command_receipts receipt
  where receipt.command_id = p_command_id;
  if not found then
    return null;
  end if;
  if v_receipt.project_id is distinct from p_project_id
    or v_receipt.command_type is distinct from p_command_type
    or v_receipt.intent_hash is distinct from v_hash
  then
    raise exception 'PROJECT_WORK_COMMAND_CONFLICT: command id was used for another intent'
      using errcode = '40001';
  end if;
  return v_receipt.committed_result || jsonb_build_object('replayed', true);
end;
$$;

create or replace function public.project_work_items_store_receipt(
  p_project_id uuid,
  p_command_id uuid,
  p_command_type text,
  p_intent jsonb,
  p_actor_user_id uuid,
  p_actor_kind text,
  p_result jsonb
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
begin
  insert into public.project_command_receipts(
    command_id,
    project_id,
    command_type,
    intent_hash,
    actor_user_id,
    actor_kind,
    committed_result
  )
  values (
    p_command_id,
    p_project_id,
    p_command_type,
    public.project_work_items_intent_hash(
      p_project_id,
      p_command_type,
      p_intent
    ),
    p_actor_user_id,
    p_actor_kind,
    p_result - 'replayed'
  );
end;
$$;

create or replace function public.project_work_items_cancel_active(
  p_project_id uuid,
  p_command_id uuid,
  p_reason text,
  p_actor_user_id uuid,
  p_actor_kind text,
  p_start_sequence integer default 0,
  p_source_type text default null,
  p_series_key text default null,
  p_exclude_series_key text default null
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_item public.project_work_items%rowtype;
  v_after public.project_work_items%rowtype;
  v_count integer := 0;
begin
  if nullif(btrim(coalesce(p_reason, '')), '') is null
    or char_length(btrim(p_reason)) > 500
  then
    raise exception 'a cancellation reason is required' using errcode = '22023';
  end if;

  for v_item in
    select item.*
    from public.project_work_items item
    where item.project_id = p_project_id
      and item.status in ('OPEN','BLOCKED')
      and (p_source_type is null or item.source_type = p_source_type)
      and (p_series_key is null or item.series_key = p_series_key)
      and (
        p_exclude_series_key is null
        or item.series_key is distinct from p_exclude_series_key
      )
    order by item.created_at, item.id
    for update
  loop
    update public.project_work_items
    set
      status = 'CANCELLED',
      blocked_reason = null,
      cancellation_reason = btrim(p_reason),
      cancelled_at = clock_timestamp(),
      cancelled_by = p_actor_user_id,
      updated_by = p_actor_user_id,
      row_version = row_version + 1
    where id = v_item.id
    returning * into v_after;

    insert into public.project_work_item_events(
      work_item_id,
      project_id,
      command_id,
      event_sequence,
      event_type,
      before_state,
      after_state,
      reason,
      actor_user_id,
      actor_kind
    )
    values (
      v_item.id,
      p_project_id,
      p_command_id,
      p_start_sequence + v_count,
      'CANCELLED',
      to_jsonb(v_item),
      to_jsonb(v_after),
      btrim(p_reason),
      p_actor_user_id,
      p_actor_kind
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create or replace function public.project_work_item_command(
  p_project_id uuid,
  p_command_id uuid,
  p_command text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_command text := upper(btrim(coalesce(p_command, '')));
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_command_type text;
  v_replay jsonb;
  v_project_archived_at timestamptz;
  v_state text;
  v_item public.project_work_items%rowtype;
  v_before public.project_work_items%rowtype;
  v_replacement public.project_work_items%rowtype;
  v_work_item_id uuid;
  v_expected_version bigint;
  v_due_at timestamptz;
  v_assignee uuid;
  v_event_type text;
  v_event_reason text;
  v_result jsonb;
  v_previous_setting text;
begin
  if not public.has_portal_access() then
    raise exception 'staff access required' using errcode = '42501';
  end if;
  if p_command_id is null
    or v_command not in (
      'CREATE','COMPLETE','CANCEL','RESCHEDULE','REASSIGN',
      'BLOCK','UNBLOCK','SET_CRITICAL','REOPEN','REPLACE_REVIEW'
    )
    or jsonb_typeof(v_payload) is distinct from 'object'
  then
    raise exception 'invalid work-item command' using errcode = '22023';
  end if;

  v_command_type := 'WORK_ITEM_' || v_command;
  perform pg_advisory_xact_lock(hashtextextended(p_command_id::text, 1));
  v_replay := public.project_work_items_receipt_replay(
    p_project_id,
    p_command_id,
    v_command_type,
    v_payload
  );
  if v_replay is not null then
    return v_replay;
  end if;

  perform public.project_work_items_assert_v2(p_project_id, true);
  select project.archived_at, state.state
  into v_project_archived_at, v_state
  from public.projects project
  join public.project_operational_states state
    on state.project_id = project.id
  where project.id = p_project_id
  for update of state;
  if v_project_archived_at is not null then
    raise exception 'archived projects cannot change work items'
      using errcode = '22023';
  end if;
  if v_state <> 'ACTIVE' then
    raise exception 'project must be Active before changing work items'
      using errcode = '22023';
  end if;

  v_previous_setting := current_setting('sanctuary.project_work_command', true);
  perform set_config('sanctuary.project_work_command', 'allowed', true);

  if v_command = 'CREATE' then
    if nullif(btrim(v_payload->>'title'), '') is null
      or char_length(btrim(v_payload->>'title')) > 160
      or v_payload->>'responsibilityArea' not in (
        'CUSTOMER','DESIGN','COMMERCIAL','OPERATIONS','ADMIN'
      )
      or nullif(v_payload->>'dueAt', '') is null
      or coalesce(v_payload->>'priority', 'NORMAL') not in ('NORMAL','CRITICAL')
    then
      raise exception 'invalid manual work item' using errcode = '22023';
    end if;
    v_due_at := (v_payload->>'dueAt')::timestamptz;
    if v_payload ? 'assigneeUserId'
      and v_payload->>'assigneeUserId' is not null
    then
      v_assignee := (v_payload->>'assigneeUserId')::uuid;
      if not exists (
        select 1
        from public.portal_users user_row
        join auth.users auth_user on auth_user.id = user_row.user_id
        where user_row.user_id = v_assignee
          and auth_user.deleted_at is null
          and (
            auth_user.banned_until is null
            or auth_user.banned_until <= clock_timestamp()
          )
      ) then
        raise exception 'assignee is not an active portal user'
          using errcode = '22023';
      end if;
    end if;
    if coalesce(v_payload->>'priority', 'NORMAL') = 'CRITICAL'
      and (
        nullif(btrim(v_payload->>'priorityReason'), '') is null
        or char_length(btrim(v_payload->>'priorityReason')) > 500
      )
    then
      raise exception 'Critical work requires a reason' using errcode = '22023';
    end if;

    insert into public.project_work_items(
      project_id,
      title,
      responsibility_area,
      status,
      due_at,
      deadline_policy,
      assignee_user_id,
      priority,
      priority_reason,
      origin,
      source_type,
      created_by,
      updated_by
    )
    values (
      p_project_id,
      btrim(v_payload->>'title'),
      v_payload->>'responsibilityArea',
      'OPEN',
      v_due_at,
      'MANUAL',
      v_assignee,
      coalesce(v_payload->>'priority', 'NORMAL'),
      case
        when coalesce(v_payload->>'priority', 'NORMAL') = 'CRITICAL'
          then btrim(v_payload->>'priorityReason')
        else null
      end,
      'MANUAL',
      'MANUAL',
      v_actor,
      v_actor
    )
    returning * into v_item;
    v_event_type := 'CREATED';
  else
    v_work_item_id := (v_payload->>'workItemId')::uuid;
    v_expected_version := (v_payload->>'expectedRowVersion')::bigint;
    if v_work_item_id is null or v_expected_version is null or v_expected_version <= 0 then
      raise exception 'work item and expected row version are required'
        using errcode = '22023';
    end if;
    select item.*
    into v_item
    from public.project_work_items item
    where item.id = v_work_item_id
      and item.project_id = p_project_id
    for update;
    if not found then
      raise exception 'WORK_ITEM_NOT_FOUND' using errcode = 'P0002';
    end if;
    if v_item.row_version <> v_expected_version then
      raise exception 'STALE_WORK_ITEM: expected row version %, found %',
        v_expected_version, v_item.row_version
        using errcode = '40001';
    end if;
    if v_item.source_type in ('LEAD_CADENCE','QUOTE_CADENCE')
      and v_command in ('COMPLETE','CANCEL','RESCHEDULE','REOPEN')
    then
      raise exception 'cadence work must use its semantic confirmation or lifecycle command'
        using errcode = '22023';
    end if;
    v_before := v_item;

    if v_command = 'COMPLETE' then
      if v_item.status <> 'OPEN' then
        raise exception 'only Open work can be completed' using errcode = '22023';
      end if;
      update public.project_work_items
      set
        status = 'DONE',
        completed_at = clock_timestamp(),
        completed_by = v_actor,
        outcome = nullif(btrim(v_payload->>'outcome'), ''),
        updated_by = v_actor,
        row_version = row_version + 1
      where id = v_item.id
      returning * into v_item;
      v_event_type := 'COMPLETED';
    elsif v_command = 'CANCEL' then
      if v_item.status not in ('OPEN','BLOCKED')
        or nullif(btrim(v_payload->>'reason'), '') is null
      then
        raise exception 'active work and a cancellation reason are required'
          using errcode = '22023';
      end if;
      update public.project_work_items
      set
        status = 'CANCELLED',
        blocked_reason = null,
        cancelled_at = clock_timestamp(),
        cancelled_by = v_actor,
        cancellation_reason = btrim(v_payload->>'reason'),
        updated_by = v_actor,
        row_version = row_version + 1
      where id = v_item.id
      returning * into v_item;
      v_event_type := 'CANCELLED';
      v_event_reason := btrim(v_payload->>'reason');
    elsif v_command = 'RESCHEDULE' then
      if v_item.status not in ('OPEN','BLOCKED')
        or nullif(v_payload->>'dueAt', '') is null
      then
        raise exception 'active work and a due time are required'
          using errcode = '22023';
      end if;
      v_due_at := (v_payload->>'dueAt')::timestamptz;
      update public.project_work_items
      set
        due_at = v_due_at,
        deadline_policy = 'MANUAL',
        calendar_revision = null,
        sla_breach_at = null,
        updated_by = v_actor,
        row_version = row_version + 1
      where id = v_item.id
      returning * into v_item;
      v_event_type := 'RESCHEDULED';
      v_event_reason := nullif(btrim(v_payload->>'reason'), '');
    elsif v_command = 'REASSIGN' then
      if v_item.status not in ('OPEN','BLOCKED') then
        raise exception 'only active work can be reassigned' using errcode = '22023';
      end if;
      if v_payload ? 'assigneeUserId'
        and v_payload->>'assigneeUserId' is not null
      then
        v_assignee := (v_payload->>'assigneeUserId')::uuid;
        if not exists (
          select 1
          from public.portal_users user_row
          join auth.users auth_user on auth_user.id = user_row.user_id
          where user_row.user_id = v_assignee
            and auth_user.deleted_at is null
            and (
              auth_user.banned_until is null
              or auth_user.banned_until <= clock_timestamp()
            )
        ) then
          raise exception 'assignee is not an active portal user'
            using errcode = '22023';
        end if;
      end if;
      update public.project_work_items
      set
        assignee_user_id = v_assignee,
        updated_by = v_actor,
        row_version = row_version + 1
      where id = v_item.id
      returning * into v_item;
      v_event_type := 'REASSIGNED';
    elsif v_command = 'BLOCK' then
      if v_item.status <> 'OPEN'
        or nullif(btrim(v_payload->>'reason'), '') is null
      then
        raise exception 'Open work and a blocked reason are required'
          using errcode = '22023';
      end if;
      update public.project_work_items
      set
        status = 'BLOCKED',
        blocked_reason = btrim(v_payload->>'reason'),
        updated_by = v_actor,
        row_version = row_version + 1
      where id = v_item.id
      returning * into v_item;
      v_event_type := 'BLOCKED';
      v_event_reason := btrim(v_payload->>'reason');
    elsif v_command = 'UNBLOCK' then
      if v_item.status <> 'BLOCKED' then
        raise exception 'only Blocked work can be unblocked' using errcode = '22023';
      end if;
      if v_item.source_type = 'LEAD_CADENCE'
        and v_item.source_key =
          'lead:first-email:' || p_project_id::text || ':v1'
        and not exists (
          select 1
          from public.projects project
          join public.contacts contact on contact.id = project.contact_id
          where project.id = p_project_id
            and nullif(btrim(contact.email), '') is not null
        )
      then
        raise exception
          'LEAD_EMAIL_REQUIRED: add the customer email before unblocking'
          using errcode = '22023';
      end if;
      update public.project_work_items
      set
        status = 'OPEN',
        blocked_reason = null,
        updated_by = v_actor,
        row_version = row_version + 1
      where id = v_item.id
      returning * into v_item;
      v_event_type := 'UNBLOCKED';
    elsif v_command = 'SET_CRITICAL' then
      if v_item.status not in ('OPEN','BLOCKED')
        or jsonb_typeof(v_payload->'critical') <> 'boolean'
        or nullif(btrim(v_payload->>'reason'), '') is null
      then
        raise exception 'active work, Critical state, and reason are required'
          using errcode = '22023';
      end if;
      update public.project_work_items
      set
        priority = case
          when (v_payload->>'critical')::boolean then 'CRITICAL'
          else 'NORMAL'
        end,
        priority_reason = case
          when (v_payload->>'critical')::boolean
            then btrim(v_payload->>'reason')
          else null
        end,
        updated_by = v_actor,
        row_version = row_version + 1
      where id = v_item.id
      returning * into v_item;
      v_event_type := 'PRIORITY_CHANGED';
      v_event_reason := btrim(v_payload->>'reason');
    elsif v_command = 'REPLACE_REVIEW' then
      if v_item.status not in ('OPEN','BLOCKED')
        or nullif(btrim(v_payload->>'reason'), '') is null
        or char_length(btrim(v_payload->>'reason')) > 500
        or not (
          (
            v_item.source_type = 'LEAD_CADENCE'
            and v_item.deadline_policy = 'LEAD_CLOSE_REVIEW_V1'
            and v_item.source_key =
              'lead:close-review:' || p_project_id::text || ':v1'
          )
          or (
            v_item.source_type = 'QUOTE_CADENCE'
            and v_item.deadline_policy = 'QUOTE_OUTCOME_REVIEW_V1'
            and v_item.subject_kind = 'QUOTE_VERSION'
            and v_item.source_key =
              'quote:outcome-review:' || v_item.subject_id::text || ':v1'
          )
        )
      then
        raise exception
          'active lead or quote review and a replacement reason are required'
          using errcode = '22023';
      end if;
      if nullif(btrim(v_payload->>'title'), '') is null
        or char_length(btrim(v_payload->>'title')) > 160
        or v_payload->>'responsibilityArea' not in (
          'CUSTOMER','DESIGN','COMMERCIAL','OPERATIONS','ADMIN'
        )
        or nullif(v_payload->>'dueAt', '') is null
        or coalesce(v_payload->>'priority', 'NORMAL')
          not in ('NORMAL','CRITICAL')
      then
        raise exception 'invalid replacement work item'
          using errcode = '22023';
      end if;
      v_due_at := (v_payload->>'dueAt')::timestamptz;
      if v_payload ? 'assigneeUserId'
        and v_payload->>'assigneeUserId' is not null
      then
        v_assignee := (v_payload->>'assigneeUserId')::uuid;
        if not exists (
          select 1
          from public.portal_users user_row
          join auth.users auth_user on auth_user.id = user_row.user_id
          where user_row.user_id = v_assignee
            and auth_user.deleted_at is null
            and (
              auth_user.banned_until is null
              or auth_user.banned_until <= clock_timestamp()
            )
        ) then
          raise exception 'assignee is not an active portal user'
            using errcode = '22023';
        end if;
      end if;
      if coalesce(v_payload->>'priority', 'NORMAL') = 'CRITICAL'
        and (
          nullif(btrim(v_payload->>'priorityReason'), '') is null
          or char_length(btrim(v_payload->>'priorityReason')) > 500
        )
      then
        raise exception 'Critical work requires a reason'
          using errcode = '22023';
      end if;

      update public.project_work_items
      set
        status = 'CANCELLED',
        blocked_reason = null,
        cancelled_at = clock_timestamp(),
        cancelled_by = v_actor,
        cancellation_reason = btrim(v_payload->>'reason'),
        updated_by = v_actor,
        row_version = row_version + 1
      where id = v_item.id
      returning * into v_item;
      v_event_type := 'CANCELLED';
      v_event_reason := btrim(v_payload->>'reason');

      insert into public.project_work_items(
        project_id,
        title,
        responsibility_area,
        status,
        due_at,
        deadline_policy,
        assignee_user_id,
        priority,
        priority_reason,
        origin,
        source_type,
        created_by,
        updated_by
      )
      values (
        p_project_id,
        btrim(v_payload->>'title'),
        v_payload->>'responsibilityArea',
        'OPEN',
        v_due_at,
        'MANUAL',
        v_assignee,
        coalesce(v_payload->>'priority', 'NORMAL'),
        case
          when coalesce(v_payload->>'priority', 'NORMAL') = 'CRITICAL'
            then btrim(v_payload->>'priorityReason')
          else null
        end,
        'MANUAL',
        'MANUAL',
        v_actor,
        v_actor
      )
      returning * into v_replacement;
    elsif v_command = 'REOPEN' then
      if v_item.status not in ('DONE','CANCELLED')
        or nullif(btrim(v_payload->>'reason'), '') is null
      then
        raise exception 'completed or cancelled work and a reason are required'
          using errcode = '22023';
      end if;
      v_due_at := coalesce(
        nullif(v_payload->>'dueAt', '')::timestamptz,
        greatest(v_item.due_at, clock_timestamp())
      );
      update public.project_work_items
      set
        status = 'OPEN',
        due_at = v_due_at,
        blocked_reason = null,
        outcome = null,
        cancellation_reason = null,
        completed_at = null,
        completed_by = null,
        cancelled_at = null,
        cancelled_by = null,
        updated_by = v_actor,
        row_version = row_version + 1
      where id = v_item.id
      returning * into v_item;
      v_event_type := 'REOPENED';
      v_event_reason := btrim(v_payload->>'reason');
    end if;
  end if;

  insert into public.project_work_item_events(
    work_item_id,
    project_id,
    command_id,
    event_sequence,
    event_type,
    before_state,
    after_state,
    reason,
    actor_user_id,
    actor_kind
  )
  values (
    v_item.id,
    p_project_id,
    p_command_id,
    0,
    v_event_type,
    case when v_command = 'CREATE' then null else to_jsonb(v_before) end,
    to_jsonb(v_item),
    v_event_reason,
    v_actor,
    'STAFF'
  );
  if v_replacement.id is not null then
    insert into public.project_work_item_events(
      work_item_id,
      project_id,
      command_id,
      event_sequence,
      event_type,
      before_state,
      after_state,
      reason,
      actor_user_id,
      actor_kind
    )
    values (
      v_replacement.id,
      p_project_id,
      p_command_id,
      1,
      'CREATED',
      null,
      to_jsonb(v_replacement),
      'Manual work replaced a decision review',
      v_actor,
      'STAFF'
    );
  end if;

  perform public.project_work_items_refresh_projection(p_project_id);
  v_result := jsonb_build_object(
    'project_id', p_project_id,
    'work_item_id', coalesce(v_replacement.id, v_item.id),
    'row_version', coalesce(v_replacement.row_version, v_item.row_version),
    'replaced_work_item_id', case
      when v_replacement.id is null then null
      else v_item.id
    end,
    'replayed', false,
    'refresh_required', false
  );
  perform public.project_work_items_store_receipt(
    p_project_id,
    p_command_id,
    v_command_type,
    v_payload,
    v_actor,
    'STAFF',
    v_result
  );
  perform set_config(
    'sanctuary.project_work_command',
    coalesce(v_previous_setting, ''),
    true
  );
  return v_result;
exception
  when others then
    perform set_config(
      'sanctuary.project_work_command',
      coalesce(v_previous_setting, ''),
      true
    );
    raise;
end;
$$;

create or replace function public.project_operational_state_command(
  p_project_id uuid,
  p_command_id uuid,
  p_command text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_command text := upper(btrim(coalesce(p_command, '')));
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_command_type text;
  v_replay jsonb;
  v_project public.projects%rowtype;
  v_state public.project_operational_states%rowtype;
  v_before public.project_operational_states%rowtype;
  v_expected_version bigint;
  v_waiting_until timestamptz;
  v_reason text;
  v_cancel_reason text;
  v_cancelled integer := 0;
  v_result jsonb;
  v_previous_setting text;
begin
  if not public.has_portal_access() then
    raise exception 'staff access required' using errcode = '42501';
  end if;
  if p_command_id is null
    or v_command not in ('ACTIVATE','WAIT','CLOSE','REOPEN')
    or jsonb_typeof(v_payload) is distinct from 'object'
  then
    raise exception 'invalid project-state command' using errcode = '22023';
  end if;
  v_expected_version := (v_payload->>'expectedRowVersion')::bigint;
  if v_expected_version is null or v_expected_version <= 0 then
    raise exception 'expected state row version is required' using errcode = '22023';
  end if;

  v_command_type := 'PROJECT_STATE_' || v_command;
  perform pg_advisory_xact_lock(hashtextextended(p_command_id::text, 1));
  v_replay := public.project_work_items_receipt_replay(
    p_project_id,
    p_command_id,
    v_command_type,
    v_payload
  );
  if v_replay is not null then
    return v_replay;
  end if;

  perform public.project_work_items_assert_v2(p_project_id, true);
  select project.*
  into v_project
  from public.projects project
  where project.id = p_project_id;
  if v_project.archived_at is not null then
    raise exception 'archived projects must be restored before changing state'
      using errcode = '22023';
  end if;
  select state.*
  into v_state
  from public.project_operational_states state
  where state.project_id = p_project_id
  for update;
  if v_state.row_version <> v_expected_version then
    raise exception 'STALE_PROJECT_STATE: expected row version %, found %',
      v_expected_version, v_state.row_version
      using errcode = '40001';
  end if;
  v_before := v_state;
  v_reason := nullif(btrim(v_payload->>'reason'), '');
  v_cancel_reason := nullif(btrim(v_payload->>'cancellationReason'), '');

  v_previous_setting := current_setting('sanctuary.project_work_command', true);
  perform set_config('sanctuary.project_work_command', 'allowed', true);

  if v_command = 'WAIT' then
    v_waiting_until := (v_payload->>'waitingUntil')::timestamptz;
    v_reason := nullif(btrim(v_payload->>'reason'), '');
    if v_state.state not in ('ACTIVE','WAITING')
      or v_waiting_until is null
      or v_waiting_until <= clock_timestamp()
      or v_reason is null
      or char_length(v_reason) > 500
      or v_cancel_reason is null
    then
      raise exception
        'Active project, future waiting time, waiting reason, and cancellation reason are required'
        using errcode = '22023';
    end if;
    v_cancelled := public.project_work_items_cancel_active(
      p_project_id,
      p_command_id,
      v_cancel_reason,
      v_actor,
      'STAFF'
    );
    update public.project_operational_states
    set
      state = 'WAITING',
      waiting_until = v_waiting_until,
      waiting_reason = v_reason,
      closed_outcome = null,
      closed_note = null,
      row_version = row_version + 1,
      updated_by = v_actor
    where project_id = p_project_id
    returning * into v_state;
  elsif v_command = 'ACTIVATE' then
    if v_state.state <> 'WAITING' then
      raise exception 'only a Waiting project can be activated'
        using errcode = '22023';
    end if;
    update public.project_operational_states
    set
      state = 'ACTIVE',
      waiting_until = null,
      waiting_reason = null,
      closed_outcome = null,
      closed_note = null,
      row_version = row_version + 1,
      updated_by = v_actor
    where project_id = p_project_id
    returning * into v_state;
  elsif v_command = 'CLOSE' then
    if v_state.state not in ('ACTIVE','WAITING')
      or v_payload->>'outcome' not in (
        'LOST_NO_RESPONSE','LOST_BUDGET_PRICE','LOST_OTHER_SUPPLIER',
        'LOST_TIMING_DEFERRED','LOST_NOT_SUITABLE','CANCELLED','COMPLETE'
      )
      or v_cancel_reason is null
    then
      raise exception 'open project, valid outcome, and cancellation reason are required'
        using errcode = '22023';
    end if;
    if v_payload->>'outcome' = 'COMPLETE' then
      if not exists (
        select 1
        from public.scheduled_jobs scheduled
        where scheduled.job_id = p_project_id
          and scheduled.status = 'done'
          and scheduled.actual_finish is not null
      ) then
        raise exception
          'PROJECT_NOT_COMPLETE: Schedule V2 has not confirmed completion'
          using errcode = '22023';
      end if;
      if exists (
        select 1
        from public.quotes quote
        join public.quote_versions version on version.quote_id = quote.id
        where quote.project_id = p_project_id
          and version.status = 'ACCEPTED'
      )
      and v_project.final_payment_date is null
      then
        raise exception
          'PROJECT_NOT_COMPLETE: final commercial payment is still unconfirmed'
          using errcode = '22023';
      end if;
      if exists (
        select 1
        from public.deposit_invoices invoice
        where invoice.project_id = p_project_id
          and invoice.status = 'OPEN'
      )
      and v_project.deposit_paid_date is null
      then
        raise exception
          'PROJECT_NOT_COMPLETE: deposit payment is still unconfirmed'
          using errcode = '22023';
      end if;
    end if;
    v_cancelled := public.project_work_items_cancel_active(
      p_project_id,
      p_command_id,
      v_cancel_reason,
      v_actor,
      'STAFF'
    );
    update public.project_operational_states
    set
      state = 'CLOSED',
      waiting_until = null,
      waiting_reason = null,
      closed_outcome = v_payload->>'outcome',
      closed_note = nullif(btrim(v_payload->>'note'), ''),
      row_version = row_version + 1,
      updated_by = v_actor
    where project_id = p_project_id
    returning * into v_state;
  elsif v_command = 'REOPEN' then
    if v_state.state <> 'CLOSED' then
      raise exception 'only a Closed project can be reopened'
        using errcode = '22023';
    end if;
    update public.project_operational_states
    set
      state = 'ACTIVE',
      waiting_until = null,
      waiting_reason = null,
      closed_outcome = null,
      closed_note = null,
      row_version = row_version + 1,
      updated_by = v_actor
    where project_id = p_project_id
    returning * into v_state;
  end if;

  insert into public.project_state_events(
    project_id,
    command_id,
    event_sequence,
    event_type,
    before_state,
    after_state,
    reason,
    actor_user_id,
    actor_kind
  )
  values (
    p_project_id,
    p_command_id,
    0,
    v_command,
    to_jsonb(v_before),
    to_jsonb(v_state),
    coalesce(v_reason, v_cancel_reason),
    v_actor,
    'STAFF'
  );

  perform public.project_work_items_refresh_projection(p_project_id);
  v_result := jsonb_build_object(
    'project_id', p_project_id,
    'work_item_id', null,
    'row_version', v_state.row_version,
    'cancelled_count', v_cancelled,
    'replayed', false,
    'refresh_required', false
  );
  perform public.project_work_items_store_receipt(
    p_project_id,
    p_command_id,
    v_command_type,
    v_payload,
    v_actor,
    'STAFF',
    v_result
  );
  perform set_config(
    'sanctuary.project_work_command',
    coalesce(v_previous_setting, ''),
    true
  );
  return v_result;
exception
  when others then
    perform set_config(
      'sanctuary.project_work_command',
      coalesce(v_previous_setting, ''),
      true
    );
    raise;
end;
$$;

create or replace function public.project_work_archive_command(
  p_project_id uuid,
  p_command_id uuid,
  p_archived boolean,
  p_expected_state_version bigint,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_intent jsonb;
  v_replay jsonb;
  v_project public.projects%rowtype;
  v_old_archived_at timestamptz;
  v_state public.project_operational_states%rowtype;
  v_before_state public.project_operational_states%rowtype;
  v_cancelled integer := 0;
  v_result jsonb;
  v_previous_setting text;
  v_previous_archive_setting text;
begin
  if not public.is_portal_admin() then
    raise exception 'project archive changes require admin'
      using errcode = '42501';
  end if;
  if p_command_id is null
    or p_archived is null
    or p_expected_state_version is null
    or p_expected_state_version <= 0
    or nullif(btrim(coalesce(p_reason, '')), '') is null
    or char_length(btrim(p_reason)) > 500
  then
    raise exception 'archive intent, state version, and reason are required'
      using errcode = '22023';
  end if;
  v_intent := jsonb_build_object(
    'archived', p_archived,
    'expectedStateVersion', p_expected_state_version,
    'reason', btrim(p_reason)
  );

  perform pg_advisory_xact_lock(hashtextextended(p_command_id::text, 1));
  v_replay := public.project_work_items_receipt_replay(
    p_project_id,
    p_command_id,
    'PROJECT_ARCHIVE',
    v_intent
  );
  if v_replay is not null then
    return v_replay;
  end if;
  perform public.project_work_items_assert_v2(p_project_id, true);
  select project.*
  into v_project
  from public.projects project
  where project.id = p_project_id;
  v_old_archived_at := v_project.archived_at;
  select state.*
  into v_state
  from public.project_operational_states state
  where state.project_id = p_project_id
  for update;
  if v_state.row_version <> p_expected_state_version then
    raise exception 'STALE_PROJECT_STATE: expected row version %, found %',
      p_expected_state_version, v_state.row_version
      using errcode = '40001';
  end if;

  v_previous_setting := current_setting('sanctuary.project_work_command', true);
  perform set_config('sanctuary.project_work_command', 'allowed', true);
  v_previous_archive_setting := current_setting(
    'sanctuary.project_archive_command',
    true
  );
  perform set_config('sanctuary.project_archive_command', 'allowed', true);
  if (v_project.archived_at is not null) = p_archived then
    v_result := jsonb_build_object(
      'project_id', p_project_id,
      'work_item_id', null,
      'row_version', v_state.row_version,
      'archived_at', v_project.archived_at,
      'cancelled_count', 0,
      'replayed', false,
      'refresh_required', false
    );
  else
    v_before_state := v_state;
    if p_archived then
      v_cancelled := public.project_work_items_cancel_active(
        p_project_id,
        p_command_id,
        btrim(p_reason),
        v_actor,
        'STAFF'
      );
    end if;
    update public.projects
    set archived_at = case when p_archived then clock_timestamp() else null end
    where id = p_project_id
    returning * into v_project;
    update public.project_operational_states
    set
      row_version = row_version + 1,
      updated_by = v_actor
    where project_id = p_project_id
    returning * into v_state;
    insert into public.project_state_events(
      project_id,
      command_id,
      event_sequence,
      event_type,
      before_state,
      after_state,
      reason,
      actor_user_id,
      actor_kind
    )
    values (
      p_project_id,
      p_command_id,
      0,
      case when p_archived then 'PROJECT_ARCHIVED' else 'PROJECT_RESTORED' end,
      to_jsonb(v_before_state) || jsonb_build_object(
        'archived_at', v_old_archived_at
      ),
      to_jsonb(v_state) || jsonb_build_object('archived_at', v_project.archived_at),
      btrim(p_reason),
      v_actor,
      'STAFF'
    );
    perform public.project_work_items_refresh_projection(p_project_id);
    v_result := jsonb_build_object(
      'project_id', p_project_id,
      'work_item_id', null,
      'row_version', v_state.row_version,
      'archived_at', v_project.archived_at,
      'cancelled_count', v_cancelled,
      'replayed', false,
      'refresh_required', false
    );
  end if;

  perform public.project_work_items_store_receipt(
    p_project_id,
    p_command_id,
    'PROJECT_ARCHIVE',
    v_intent,
    v_actor,
    'STAFF',
    v_result
  );
  perform set_config(
    'sanctuary.project_work_command',
    coalesce(v_previous_setting, ''),
    true
  );
  perform set_config(
    'sanctuary.project_archive_command',
    coalesce(v_previous_archive_setting, ''),
    true
  );
  return v_result;
exception
  when others then
    perform set_config(
      'sanctuary.project_work_command',
      coalesce(v_previous_setting, ''),
      true
    );
    perform set_config(
      'sanctuary.project_archive_command',
      coalesce(v_previous_archive_setting, ''),
      true
    );
    raise;
end;
$$;

create or replace function public.project_work_integrity_report_v2(
  p_project_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_project public.projects%rowtype;
  v_state public.project_operational_states%rowtype;
  v_expected_title text;
  v_expected_due_at timestamptz;
  v_marker boolean;
begin
  if not public.is_portal_admin() then
    raise exception 'project integrity reports require admin'
      using errcode = '42501';
  end if;
  select project.*
  into v_project
  from public.projects project
  where project.id = p_project_id;
  if not found then
    raise exception 'PROJECT_NOT_FOUND' using errcode = 'P0002';
  end if;
  select exists (
    select 1
    from public.project_work_model_versions model
    where model.project_id = p_project_id
      and model.model_version = 2
  ) into v_marker;
  select state.*
  into v_state
  from public.project_operational_states state
  where state.project_id = p_project_id;
  if v_marker
    and v_project.archived_at is null
    and v_state.state = 'ACTIVE'
  then
    select item.title, item.due_at
    into v_expected_title, v_expected_due_at
    from public.project_work_items item
    where item.project_id = p_project_id
      and item.status = 'OPEN'
    order by
      case item.priority when 'CRITICAL' then 0 else 1 end,
      item.due_at,
      item.created_at,
      item.id
    limit 1;
  end if;
  return jsonb_build_object(
    'project_id', p_project_id,
    'model_version', case when v_marker then 2 else null end,
    'state_present', v_state.project_id is not null,
    'state', v_state.state,
    'state_row_version', v_state.row_version,
    'archived_at', v_project.archived_at,
    'open_work_items', (
      select count(*) from public.project_work_items item
      where item.project_id = p_project_id and item.status = 'OPEN'
    ),
    'blocked_work_items', (
      select count(*) from public.project_work_items item
      where item.project_id = p_project_id and item.status = 'BLOCKED'
    ),
    'open_repair_signals', (
      select count(*) from public.project_work_repair_signals signal
      where signal.project_id = p_project_id and signal.status = 'OPEN'
    ),
    'latest_open_repair', (
      select jsonb_build_object(
        'id', signal.id,
        'repair_kind', signal.repair_kind,
        'source_event', signal.source_event,
        'quote_version_id', signal.quote_version_id,
        'command_id', signal.command_id,
        'error_code', signal.error_code,
        'error_message', signal.error_message,
        'attempt_count', signal.attempt_count,
        'first_detected_at', signal.first_detected_at,
        'last_detected_at', signal.last_detected_at
      )
      from public.project_work_repair_signals signal
      where signal.project_id = p_project_id
        and signal.status = 'OPEN'
      order by signal.first_detected_at, signal.id
      limit 1
    ),
    'projection_consistent',
      v_project.next_action is not distinct from v_expected_title
      and v_project.next_action_at is not distinct from v_expected_due_at
      and v_project.next_action_type is null,
    'legacy_residue', jsonb_build_object(
      'tasks', (
        select count(*) from public.tasks row_item
        where row_item.project_id = p_project_id
      ),
      'followup_plans', (
        select count(*) from public.followup_plans row_item
        where row_item.project_id = p_project_id
      ),
      'followup_tasks', (
        select count(*) from public.followup_tasks row_item
        where row_item.project_id = p_project_id
      ),
      'manual_actions', (
        select count(*) from public.project_manual_actions row_item
        where row_item.project_id = p_project_id
      ),
      'primary_selection', (
        select count(*) from public.project_primary_action_selections row_item
        where row_item.project_id = p_project_id
      ),
      'task_checks', (
        select count(*) from public.project_task_checks row_item
        where row_item.project_id = p_project_id
      )
    )
  );
end;
$$;

create or replace function public.project_confirmation_command(
  p_project_id uuid,
  p_command_id uuid,
  p_command text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_command text := upper(btrim(coalesce(p_command, '')));
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_command_type text;
  v_confirmation_type text;
  v_confirmation_source_key text;
  v_subject_kind text := 'PROJECT';
  v_subject_id uuid := p_project_id;
  v_occurred_at timestamptz;
  v_quote_version_id uuid;
  v_quote_expires_at date;
  v_quote_status text;
  v_operational_state text;
  v_replay jsonb;
  v_existing_confirmation public.project_confirmation_events%rowtype;
  v_confirmation_id uuid;
  v_item public.project_work_items%rowtype;
  v_before public.project_work_items%rowtype;
  v_next_item public.project_work_items%rowtype;
  v_due_at timestamptz;
  v_calendar_revision text;
  v_contact_email text;
  v_cancelled integer := 0;
  v_event_sequence integer := 0;
  v_result jsonb;
  v_previous_setting text;
begin
  if not public.has_portal_access() then
    raise exception 'staff access required' using errcode = '42501';
  end if;
  if p_command_id is null
    or v_command not in (
      'RECORD_FIRST_ENQUIRY_EMAIL_SENT',
      'RECORD_ENQUIRY_FOLLOW_UP_EMAIL_SENT',
      'RECORD_ENQUIRY_CUSTOMER_REPLY',
      'RECORD_QUOTE_FOLLOW_UP_EMAIL_SENT',
      'RECORD_QUOTE_CUSTOMER_REPLY',
      'RECORD_SITE_VISIT_COMPLETED'
    )
    or jsonb_typeof(v_payload) is distinct from 'object'
  then
    raise exception 'invalid confirmation command' using errcode = '22023';
  end if;
  v_occurred_at := coalesce(
    nullif(v_payload->>'occurredAt', '')::timestamptz,
    clock_timestamp()
  );
  if v_occurred_at > clock_timestamp() + interval '5 minutes' then
    raise exception 'confirmation occurrence cannot be in the future'
      using errcode = '22023';
  end if;

  if v_command in (
    'RECORD_QUOTE_FOLLOW_UP_EMAIL_SENT',
    'RECORD_QUOTE_CUSTOMER_REPLY'
  ) then
    v_quote_version_id := (v_payload->>'subjectId')::uuid;
    if coalesce(v_payload->>'subjectKind', '') <> 'QUOTE_VERSION'
      or v_quote_version_id is null
    then
      raise exception 'quote version subject is required' using errcode = '22023';
    end if;
    v_subject_kind := 'QUOTE_VERSION';
    v_subject_id := v_quote_version_id;
  end if;

  v_confirmation_type := case v_command
    when 'RECORD_FIRST_ENQUIRY_EMAIL_SENT' then 'FIRST_ENQUIRY_EMAIL_SENT'
    when 'RECORD_ENQUIRY_FOLLOW_UP_EMAIL_SENT' then 'ENQUIRY_FOLLOW_UP_EMAIL_SENT'
    when 'RECORD_ENQUIRY_CUSTOMER_REPLY' then 'ENQUIRY_CUSTOMER_REPLY_RECEIVED'
    when 'RECORD_QUOTE_FOLLOW_UP_EMAIL_SENT' then 'QUOTE_FOLLOW_UP_EMAIL_SENT'
    when 'RECORD_QUOTE_CUSTOMER_REPLY' then 'QUOTE_CUSTOMER_REPLY_RECEIVED'
    when 'RECORD_SITE_VISIT_COMPLETED' then 'SITE_VISIT_COMPLETED'
  end;
  v_confirmation_source_key := 'confirmation:' ||
    lower(replace(v_confirmation_type, '_', '-')) || ':' ||
    v_subject_id::text || ':v1';
  v_command_type := 'CONFIRMATION_' || v_confirmation_type;

  perform pg_advisory_xact_lock(hashtextextended(p_command_id::text, 1));
  v_replay := public.project_work_items_receipt_replay(
    p_project_id,
    p_command_id,
    v_command_type,
    v_payload
  );
  if v_replay is not null then
    return v_replay;
  end if;
  if v_quote_version_id is not null then
    select version.expires_at, version.status
    into v_quote_expires_at, v_quote_status
    from public.quote_versions version
    join public.quotes quote on quote.id = version.quote_id
    where version.id = v_quote_version_id
      and quote.project_id = p_project_id
    for update of version;
    if not found then
      raise exception 'QUOTE_VERSION_NOT_FOUND' using errcode = 'P0002';
    end if;
    if v_command = 'RECORD_QUOTE_FOLLOW_UP_EMAIL_SENT'
      and v_quote_status <> 'SENT'
    then
      raise exception
        'QUOTE_FOLLOW_UP_NOT_SENDABLE: quote status is %',
        v_quote_status
        using errcode = '22023';
    end if;
  end if;
  perform public.project_work_items_assert_v2(p_project_id, true);
  if exists (
    select 1 from public.projects project
    where project.id = p_project_id and project.archived_at is not null
  ) then
    raise exception 'archived projects cannot record confirmations'
      using errcode = '22023';
  end if;
  select state.state
  into v_operational_state
  from public.project_operational_states state
  where state.project_id = p_project_id
  for update;
  if not found then
    raise exception 'PROJECT_OPERATIONAL_STATE_NOT_FOUND'
      using errcode = 'P0002';
  end if;
  if v_operational_state <> 'ACTIVE' then
    raise exception 'project must be Active before recording confirmations'
      using errcode = '22023';
  end if;

  select confirmation.*
  into v_existing_confirmation
  from public.project_confirmation_events confirmation
  where confirmation.source_key = v_confirmation_source_key;
  if found then
    v_result := jsonb_build_object(
      'project_id', p_project_id,
      'work_item_id', null,
      'row_version', null,
      'confirmation_event_id', v_existing_confirmation.id,
      'replayed', true,
      'refresh_required', false
    );
    perform public.project_work_items_store_receipt(
      p_project_id,
      p_command_id,
      v_command_type,
      v_payload,
      v_actor,
      'STAFF',
      v_result
    );
    return v_result;
  end if;

  v_previous_setting := current_setting('sanctuary.project_work_command', true);
  perform set_config('sanctuary.project_work_command', 'allowed', true);

  insert into public.project_confirmation_events(
    project_id,
    command_id,
    event_sequence,
    event_kind,
    confirmation_type,
    subject_kind,
    subject_id,
    occurred_at,
    recorded_by,
    actor_kind,
    source_key
  )
  values (
    p_project_id,
    p_command_id,
    0,
    'CONFIRMED',
    v_confirmation_type,
    v_subject_kind,
    v_subject_id,
    v_occurred_at,
    v_actor,
    'STAFF',
    v_confirmation_source_key
  )
  returning id into v_confirmation_id;

  if v_command = 'RECORD_FIRST_ENQUIRY_EMAIL_SENT' then
    select item.*
    into v_item
    from public.project_work_items item
    where item.project_id = p_project_id
      and item.source_key = 'lead:first-email:' || p_project_id::text || ':v1'
    for update;
    if not found or v_item.status not in ('OPEN','BLOCKED') then
      raise exception 'LEAD_FIRST_EMAIL_WORK_ITEM_NOT_ACTIVE'
        using errcode = 'P0002';
    end if;
    select nullif(btrim(contact.email), '')
    into v_contact_email
    from public.projects project
    left join public.contacts contact on contact.id = project.contact_id
    where project.id = p_project_id;
    if v_contact_email is null then
      raise exception
        'LEAD_EMAIL_REQUIRED: add the customer email before recording send'
        using errcode = '22023';
    end if;
    v_before := v_item;
    update public.project_work_items
    set
      status = 'DONE',
      blocked_reason = null,
      completed_at = v_occurred_at,
      completed_by = v_actor,
      outcome = 'Email sent',
      updated_by = v_actor,
      row_version = row_version + 1
    where id = v_item.id
    returning * into v_item;
    insert into public.project_work_item_events(
      work_item_id,project_id,command_id,event_sequence,event_type,
      before_state,after_state,reason,actor_user_id,actor_kind
    )
    values (
      v_item.id,p_project_id,p_command_id,v_event_sequence,'COMPLETED',
      to_jsonb(v_before),to_jsonb(v_item),'First enquiry email confirmed',
      v_actor,'STAFF'
    );
    v_event_sequence := v_event_sequence + 1;
    v_due_at := public.project_work_items_add_business_days_due(
      v_occurred_at,
      5,
      'Auckland'
    );
    v_calendar_revision := public.project_work_items_calendar_revision(
      v_occurred_at,
      v_due_at,
      'Auckland'
    );
    insert into public.project_work_items(
      project_id,title,responsibility_area,status,due_at,deadline_policy,
      calendar_revision,priority,origin,source_type,source_key,series_key,
      subject_kind,subject_id,created_by,updated_by
    )
    values (
      p_project_id,'Send enquiry follow-up email','CUSTOMER','OPEN',v_due_at,
      'LEAD_FOLLOW_UP_V1',v_calendar_revision,'NORMAL','AUTOMATION',
      'LEAD_CADENCE','lead:follow-up:' || p_project_id::text || ':v1',
      'lead:' || p_project_id::text || ':v1','PROJECT',p_project_id,
      v_actor,v_actor
    )
    returning * into v_next_item;
  elsif v_command = 'RECORD_ENQUIRY_FOLLOW_UP_EMAIL_SENT' then
    select item.*
    into v_item
    from public.project_work_items item
    where item.project_id = p_project_id
      and item.source_key = 'lead:follow-up:' || p_project_id::text || ':v1'
    for update;
    if not found or v_item.status not in ('OPEN','BLOCKED') then
      raise exception 'LEAD_FOLLOW_UP_WORK_ITEM_NOT_ACTIVE'
        using errcode = 'P0002';
    end if;
    v_before := v_item;
    update public.project_work_items
    set
      status = 'DONE',
      blocked_reason = null,
      completed_at = v_occurred_at,
      completed_by = v_actor,
      outcome = 'Follow-up email sent',
      updated_by = v_actor,
      row_version = row_version + 1
    where id = v_item.id
    returning * into v_item;
    insert into public.project_work_item_events(
      work_item_id,project_id,command_id,event_sequence,event_type,
      before_state,after_state,reason,actor_user_id,actor_kind
    )
    values (
      v_item.id,p_project_id,p_command_id,v_event_sequence,'COMPLETED',
      to_jsonb(v_before),to_jsonb(v_item),'Enquiry follow-up email confirmed',
      v_actor,'STAFF'
    );
    v_event_sequence := v_event_sequence + 1;
    v_due_at := public.project_work_items_add_business_days_due(
      v_occurred_at,
      5,
      'Auckland'
    );
    v_calendar_revision := public.project_work_items_calendar_revision(
      v_occurred_at,
      v_due_at,
      'Auckland'
    );
    insert into public.project_work_items(
      project_id,title,responsibility_area,status,due_at,deadline_policy,
      calendar_revision,priority,origin,source_type,source_key,series_key,
      subject_kind,subject_id,created_by,updated_by
    )
    values (
      p_project_id,'Review unresponsive enquiry','CUSTOMER','OPEN',v_due_at,
      'LEAD_CLOSE_REVIEW_V1',v_calendar_revision,'NORMAL','AUTOMATION',
      'LEAD_CADENCE','lead:close-review:' || p_project_id::text || ':v1',
      'lead:' || p_project_id::text || ':v1','PROJECT',p_project_id,
      v_actor,v_actor
    )
    returning * into v_next_item;
  elsif v_command = 'RECORD_ENQUIRY_CUSTOMER_REPLY' then
    v_cancelled := public.project_work_items_cancel_active(
      p_project_id,
      p_command_id,
      'Customer replied to enquiry email',
      v_actor,
      'STAFF',
      0,
      'LEAD_CADENCE'
    );
  elsif v_command = 'RECORD_QUOTE_FOLLOW_UP_EMAIL_SENT' then
    select item.*
    into v_item
    from public.project_work_items item
    where item.project_id = p_project_id
      and item.source_key =
        'quote:follow-up:' || v_quote_version_id::text || ':v1'
    for update;
    if not found or v_item.status not in ('OPEN','BLOCKED') then
      raise exception 'QUOTE_FOLLOW_UP_WORK_ITEM_NOT_ACTIVE'
        using errcode = 'P0002';
    end if;
    v_before := v_item;
    update public.project_work_items
    set
      status = 'DONE',
      blocked_reason = null,
      completed_at = v_occurred_at,
      completed_by = v_actor,
      outcome = 'Quote follow-up email sent',
      updated_by = v_actor,
      row_version = row_version + 1
    where id = v_item.id
    returning * into v_item;
    insert into public.project_work_item_events(
      work_item_id,project_id,command_id,event_sequence,event_type,
      before_state,after_state,reason,actor_user_id,actor_kind
    )
    values (
      v_item.id,p_project_id,p_command_id,v_event_sequence,'COMPLETED',
      to_jsonb(v_before),to_jsonb(v_item),'Quote follow-up email confirmed',
      v_actor,'STAFF'
    );
    v_event_sequence := v_event_sequence + 1;
    if v_quote_expires_at is not null then
      v_due_at := public.project_work_items_first_business_day_after_due(
        v_quote_expires_at,
        'Auckland'
      );
      v_calendar_revision := public.project_work_items_calendar_revision(
        v_occurred_at,
        v_due_at,
        'Auckland'
      );
      insert into public.project_work_items(
        project_id,title,responsibility_area,status,due_at,deadline_policy,
        calendar_revision,priority,origin,source_type,source_key,series_key,
        subject_kind,subject_id,created_by,updated_by
      )
      values (
        p_project_id,'Review unanswered quote','COMMERCIAL','OPEN',v_due_at,
        'QUOTE_OUTCOME_REVIEW_V1',v_calendar_revision,'NORMAL','AUTOMATION',
        'QUOTE_CADENCE',
        'quote:outcome-review:' || v_quote_version_id::text || ':v1',
        'quote:' || v_quote_version_id::text || ':v1',
        'QUOTE_VERSION',v_quote_version_id,v_actor,v_actor
      )
      returning * into v_next_item;
    end if;
  elsif v_command = 'RECORD_QUOTE_CUSTOMER_REPLY' then
    v_cancelled := public.project_work_items_cancel_active(
      p_project_id,
      p_command_id,
      'Customer replied about quote',
      v_actor,
      'STAFF',
      0,
      'QUOTE_CADENCE',
      'quote:' || v_quote_version_id::text || ':v1'
    );
  end if;

  if v_next_item.id is not null then
    insert into public.project_work_item_events(
      work_item_id,project_id,command_id,event_sequence,event_type,
      before_state,after_state,reason,actor_user_id,actor_kind
    )
    values (
      v_next_item.id,p_project_id,p_command_id,v_event_sequence,'CREATED',
      null,to_jsonb(v_next_item),'Cadence advanced after confirmation',
      v_actor,'STAFF'
    );
  end if;

  perform public.project_work_items_refresh_projection(p_project_id);
  v_result := jsonb_build_object(
    'project_id', p_project_id,
    'work_item_id', coalesce(v_next_item.id, v_item.id),
    'row_version', coalesce(v_next_item.row_version, v_item.row_version),
    'confirmation_event_id', v_confirmation_id,
    'cancelled_count', v_cancelled,
    'replayed', false,
    'refresh_required', false
  );
  perform public.project_work_items_store_receipt(
    p_project_id,
    p_command_id,
    v_command_type,
    v_payload,
    v_actor,
    'STAFF',
    v_result
  );
  perform set_config(
    'sanctuary.project_work_command',
    coalesce(v_previous_setting, ''),
    true
  );
  return v_result;
exception
  when unique_violation then
    perform set_config(
      'sanctuary.project_work_command',
      coalesce(v_previous_setting, ''),
      true
    );
    raise exception 'CONFIRMATION_ALREADY_RECORDED'
      using errcode = '40001';
  when others then
    perform set_config(
      'sanctuary.project_work_command',
      coalesce(v_previous_setting, ''),
      true
    );
    raise;
end;
$$;

create or replace function public.project_work_item_reconcile(
  p_project_id uuid,
  p_command_id uuid,
  p_event text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_event text := upper(btrim(coalesce(p_event, '')));
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
  v_command_type text;
  v_replay jsonb;
  v_quote_version_id uuid;
  v_quote_status text;
  v_quote_id uuid;
  v_quote_version_number integer;
  v_quote_expires_at date;
  v_sent_at timestamptz;
  v_due_at timestamptz;
  v_expiry_due_at timestamptz;
  v_calendar_revision text;
  v_outcome text;
  v_series_key text;
  v_item public.project_work_items%rowtype;
  v_before public.project_work_items%rowtype;
  v_event_sequence integer := 0;
  v_cancelled integer := 0;
  v_cancel_batch integer := 0;
  v_repaired integer := 0;
  v_contact_email text;
  v_project_archived_at timestamptz;
  v_operational_state text;
  v_result jsonb;
  v_previous_setting text;
begin
  if p_command_id is null
    or v_event not in (
      'QUOTE_SENT','QUOTE_RESENT','QUOTE_OUTCOME','RECONCILE_PROJECT'
    )
    or jsonb_typeof(v_payload) is distinct from 'object'
  then
    raise exception 'invalid project-work reconciliation event'
      using errcode = '22023';
  end if;
  v_command_type := 'SYSTEM_' || v_event;

  perform pg_advisory_xact_lock(hashtextextended(p_command_id::text, 1));
  v_replay := public.project_work_items_receipt_replay(
    p_project_id,
    p_command_id,
    v_command_type,
    v_payload
  );
  if v_replay is not null then
    return v_replay;
  end if;
  perform public.project_work_items_assert_v2(p_project_id, true);
  select project.archived_at, state.state
  into v_project_archived_at, v_operational_state
  from public.projects project
  join public.project_operational_states state
    on state.project_id = project.id
  where project.id = p_project_id
  for update of state;
  if not found then
    raise exception 'PROJECT_OPERATIONAL_STATE_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if v_event <> 'RECONCILE_PROJECT' then
    v_quote_version_id := (v_payload->>'quote_version_id')::uuid;
    if v_quote_version_id is null then
      raise exception 'quote_version_id is required' using errcode = '22023';
    end if;
    select
      version.status,
      version.quote_id,
      version.version_number,
      version.expires_at
    into
      v_quote_status,
      v_quote_id,
      v_quote_version_number,
      v_quote_expires_at
    from public.quote_versions version
    join public.quotes quote on quote.id = version.quote_id
    where version.id = v_quote_version_id
      and quote.project_id = p_project_id;
    if not found then
      raise exception 'QUOTE_VERSION_NOT_FOUND' using errcode = 'P0002';
    end if;
    v_series_key := 'quote:' || v_quote_version_id::text || ':v1';
  end if;

  v_previous_setting := current_setting('sanctuary.project_work_command', true);
  perform set_config('sanctuary.project_work_command', 'allowed', true);

  if v_project_archived_at is not null or v_operational_state <> 'ACTIVE' then
    v_cancelled := public.project_work_items_cancel_active(
      p_project_id,
      p_command_id,
      'Inactive projects cannot retain active work',
      null,
      'SYSTEM'
    );
    perform public.project_work_items_refresh_projection(p_project_id);
    v_result := jsonb_build_object(
      'project_id', p_project_id,
      'work_item_id', null,
      'row_version', null,
      'cancelled_count', v_cancelled,
      'repaired_count', v_cancelled,
      'inactive', true,
      'replayed', false,
      'refresh_required', false
    );
    perform public.project_work_items_store_receipt(
      p_project_id,
      p_command_id,
      v_command_type,
      v_payload,
      null,
      'SYSTEM',
      v_result
    );
    perform set_config(
      'sanctuary.project_work_command',
      coalesce(v_previous_setting, ''),
      true
    );
    return v_result;
  end if;

  if v_event <> 'RECONCILE_PROJECT' then
    v_cancelled := public.project_work_items_cancel_active(
      p_project_id,
      p_command_id,
      'Durable quote progress supersedes enquiry follow-up',
      null,
      'SYSTEM',
      0,
      'LEAD_CADENCE'
    );
    v_event_sequence := v_cancelled;
  end if;

  if v_event in ('QUOTE_SENT','QUOTE_RESENT') then
    if v_quote_status <> 'SENT' then
      raise exception 'QUOTE_NOT_DURABLY_SENT' using errcode = '22023';
    end if;
    if exists (
      select 1
      from public.quote_versions newer
      where newer.quote_id = v_quote_id
        and newer.version_number > v_quote_version_number
        and newer.status in ('SENT','ACCEPTED','DECLINED')
        and (
          newer.sent_at is not null
          or newer.status in ('ACCEPTED','DECLINED')
        )
    ) then
      v_cancel_batch := public.project_work_items_cancel_active(
        p_project_id,
        p_command_id,
        'A newer durable quote version already supersedes this send',
        null,
        'SYSTEM',
        v_event_sequence,
        'QUOTE_CADENCE',
        v_series_key
      );
      v_cancelled := v_cancelled + v_cancel_batch;
      v_event_sequence := v_event_sequence + v_cancel_batch;
      perform public.project_work_items_refresh_projection(p_project_id);
      v_result := jsonb_build_object(
        'project_id', p_project_id,
        'work_item_id', null,
        'row_version', null,
        'cancelled_count', v_cancelled,
        'repaired_count', 0,
        'superseded', true,
        'replayed', false,
        'refresh_required', false
      );
      perform public.project_work_items_store_receipt(
        p_project_id,
        p_command_id,
        v_command_type,
        v_payload,
        null,
        'SYSTEM',
        v_result
      );
      perform set_config(
        'sanctuary.project_work_command',
        coalesce(v_previous_setting, ''),
        true
      );
      return v_result;
    end if;
    select max(coalesce(log.sent_at, log.created_at))
    into v_sent_at
    from public.quote_send_logs log
    where log.project_id = p_project_id
      and log.quote_version_id = v_quote_version_id
      and log.status = 'SENT';
    if v_sent_at is null then
      select version.sent_at
      into v_sent_at
      from public.quote_versions version
      where version.id = v_quote_version_id;
    end if;
    if v_sent_at is null then
      raise exception 'QUOTE_NOT_DURABLY_SENT: no successful send timestamp'
        using errcode = '22023';
    end if;

    v_cancel_batch := public.project_work_items_cancel_active(
      p_project_id,
      p_command_id,
      'A newer quote version became current',
      null,
      'SYSTEM',
      v_event_sequence,
      'QUOTE_CADENCE',
      null,
      v_series_key
    );
    v_cancelled := v_cancelled + v_cancel_batch;
    v_event_sequence := v_event_sequence + v_cancel_batch;
    v_due_at := public.project_work_items_add_business_days_due(
      v_sent_at,
      5,
      'Auckland'
    );
    if v_quote_expires_at is not null then
      v_expiry_due_at := public.project_work_items_last_business_day_due(
        v_quote_expires_at,
        'Auckland'
      );
      v_due_at := least(v_due_at, v_expiry_due_at);
    end if;
    v_calendar_revision := public.project_work_items_calendar_revision(
      v_sent_at,
      v_due_at,
      'Auckland'
    );

    select item.*
    into v_item
    from public.project_work_items item
    where item.source_key =
      'quote:follow-up:' || v_quote_version_id::text || ':v1'
    for update;
    if found and v_item.status in ('OPEN','BLOCKED') then
      v_before := v_item;
      update public.project_work_items
      set
        due_at = v_due_at,
        deadline_policy = 'QUOTE_FOLLOW_UP_V1',
        calendar_revision = v_calendar_revision,
        updated_by = null,
        row_version = row_version + 1
      where id = v_item.id
      returning * into v_item;
      insert into public.project_work_item_events(
        work_item_id,project_id,command_id,event_sequence,event_type,
        before_state,after_state,reason,actor_user_id,actor_kind
      )
      values (
        v_item.id,p_project_id,p_command_id,v_event_sequence,
        case when v_event = 'QUOTE_RESENT' then 'RESCHEDULED'
          else 'SYSTEM_RECONCILED' end,
        to_jsonb(v_before),to_jsonb(v_item),
        case when v_event = 'QUOTE_RESENT'
          then 'Same quote version was resent'
          else 'Durable quote send reconciled' end,
        null,'SYSTEM'
      );
      v_repaired := v_repaired + 1;
    elsif not found then
      if not exists (
        select 1
        from public.project_work_items existing
        where existing.series_key = v_series_key
          and existing.status in ('OPEN','BLOCKED')
      ) then
        insert into public.project_work_items(
          project_id,title,responsibility_area,status,due_at,deadline_policy,
          calendar_revision,priority,origin,source_type,source_key,series_key,
          subject_kind,subject_id,created_by,updated_by
        )
        values (
          p_project_id,'Send quote follow-up email','COMMERCIAL','OPEN',v_due_at,
          'QUOTE_FOLLOW_UP_V1',v_calendar_revision,'NORMAL','AUTOMATION',
          'QUOTE_CADENCE',
          'quote:follow-up:' || v_quote_version_id::text || ':v1',
          v_series_key,'QUOTE_VERSION',v_quote_version_id,null,null
        )
        returning * into v_item;
        insert into public.project_work_item_events(
          work_item_id,project_id,command_id,event_sequence,event_type,
          before_state,after_state,reason,actor_user_id,actor_kind
        )
        values (
          v_item.id,p_project_id,p_command_id,v_event_sequence,'CREATED',
          null,to_jsonb(v_item),'Durable quote send created follow-up',
          null,'SYSTEM'
        );
        v_repaired := v_repaired + 1;
      end if;
    end if;
  elsif v_event = 'QUOTE_OUTCOME' then
    v_outcome := upper(btrim(coalesce(v_payload->>'outcome', '')));
    if v_outcome not in ('ACCEPTED','DECLINED','SUPERSEDED','CUSTOMER_REPLY') then
      raise exception 'invalid quote outcome' using errcode = '22023';
    end if;
    if v_outcome in ('ACCEPTED','DECLINED')
      and v_quote_status <> v_outcome
    then
      raise exception 'QUOTE_OUTCOME_NOT_DURABLE: expected %, found %',
        v_outcome, v_quote_status
        using errcode = '22023';
    end if;
    if v_outcome = 'SUPERSEDED'
      and not exists (
        select 1
        from public.quote_versions newer
        where newer.quote_id = v_quote_id
          and newer.version_number > v_quote_version_number
      )
    then
      raise exception 'QUOTE_OUTCOME_NOT_DURABLE: no newer version exists'
        using errcode = '22023';
    end if;
    v_cancel_batch := public.project_work_items_cancel_active(
      p_project_id,
      p_command_id,
      'Quote outcome: ' || lower(replace(v_outcome, '_', ' ')),
      null,
      'SYSTEM',
      v_event_sequence,
      'QUOTE_CADENCE',
      v_series_key
    );
    v_cancelled := v_cancelled + v_cancel_batch;
    v_event_sequence := v_event_sequence + v_cancel_batch;
  else
    select nullif(btrim(contact.email), '')
    into v_contact_email
    from public.projects project
    left join public.contacts contact on contact.id = project.contact_id
    where project.id = p_project_id;
    select item.*
    into v_item
    from public.project_work_items item
    where item.project_id = p_project_id
      and item.source_key = 'lead:first-email:' || p_project_id::text || ':v1'
    for update;
    if found and v_item.status in ('OPEN','BLOCKED') then
      if v_contact_email is null and v_item.status = 'OPEN' then
        v_before := v_item;
        update public.project_work_items
        set
          status = 'BLOCKED',
          blocked_reason = 'Customer email address is missing',
          row_version = row_version + 1,
          updated_by = null
        where id = v_item.id
        returning * into v_item;
        insert into public.project_work_item_events(
          work_item_id,project_id,command_id,event_sequence,event_type,
          before_state,after_state,reason,actor_user_id,actor_kind
        )
        values (
          v_item.id,p_project_id,p_command_id,v_event_sequence,'BLOCKED',
          to_jsonb(v_before),to_jsonb(v_item),
          'Customer email address is missing',null,'SYSTEM'
        );
        v_event_sequence := v_event_sequence + 1;
        v_repaired := v_repaired + 1;
      elsif v_contact_email is not null
        and v_item.status = 'BLOCKED'
        and v_item.blocked_reason = 'Customer email address is missing'
      then
        v_before := v_item;
        update public.project_work_items
        set
          status = 'OPEN',
          blocked_reason = null,
          row_version = row_version + 1,
          updated_by = null
        where id = v_item.id
        returning * into v_item;
        insert into public.project_work_item_events(
          work_item_id,project_id,command_id,event_sequence,event_type,
          before_state,after_state,reason,actor_user_id,actor_kind
        )
        values (
          v_item.id,p_project_id,p_command_id,v_event_sequence,'UNBLOCKED',
          to_jsonb(v_before),to_jsonb(v_item),
          'Customer email address is now available',null,'SYSTEM'
        );
        v_event_sequence := v_event_sequence + 1;
        v_repaired := v_repaired + 1;
      end if;
    end if;

    for v_item in
      select item.*
      from public.project_work_items item
      join public.quote_versions version on version.id = item.subject_id
      join public.quotes quote on quote.id = version.quote_id
      where item.project_id = p_project_id
        and item.source_type = 'QUOTE_CADENCE'
        and item.status in ('OPEN','BLOCKED')
        and item.subject_kind = 'QUOTE_VERSION'
        and quote.project_id = p_project_id
        and version.status in ('ACCEPTED','DECLINED')
      order by item.created_at, item.id
    loop
      v_cancelled := v_cancelled +
        public.project_work_items_cancel_active(
          p_project_id,
          p_command_id,
          'Terminal quote outcome reconciled',
          null,
          'SYSTEM',
          v_event_sequence,
          'QUOTE_CADENCE',
          v_item.series_key
        );
      v_event_sequence := v_event_sequence + 1;
    end loop;
  end if;

  perform public.project_work_items_refresh_projection(p_project_id);
  v_result := jsonb_build_object(
    'project_id', p_project_id,
    'work_item_id', v_item.id,
    'row_version', v_item.row_version,
    'cancelled_count', v_cancelled,
    'repaired_count', v_repaired,
    'replayed', false,
    'refresh_required', false
  );
  perform public.project_work_items_store_receipt(
    p_project_id,
    p_command_id,
    v_command_type,
    v_payload,
    null,
    'SYSTEM',
    v_result
  );
  perform set_config(
    'sanctuary.project_work_command',
    coalesce(v_previous_setting, ''),
    true
  );
  return v_result;
exception
  when others then
    perform set_config(
      'sanctuary.project_work_command',
      coalesce(v_previous_setting, ''),
      true
    );
    raise;
end;
$$;

create or replace function public.project_work_quote_repair_signal_command(
  p_project_id uuid,
  p_command_id uuid,
  p_event text,
  p_quote_version_id uuid,
  p_action text,
  p_error_code text default null,
  p_error_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_event text := upper(btrim(coalesce(p_event, '')));
  v_action text := upper(btrim(coalesce(p_action, '')));
  v_error_code text := nullif(btrim(coalesce(p_error_code, '')), '');
  v_error_message text := nullif(btrim(coalesce(p_error_message, '')), '');
  v_signal public.project_work_repair_signals%rowtype;
  v_changed boolean := false;
  v_resolved_count integer := 0;
  v_previous_setting text;
begin
  if p_project_id is null
    or p_command_id is null
    or p_quote_version_id is null
    or v_event not in ('QUOTE_SENT','QUOTE_RESENT','QUOTE_OUTCOME')
    or v_action not in ('OPEN','RESOLVE')
  then
    raise exception 'invalid quote repair signal command'
      using errcode = '22023';
  end if;
  if v_action = 'OPEN'
    and (
      v_error_code is null
      or char_length(v_error_code) > 120
      or v_error_message is null
      or char_length(v_error_message) > 500
    )
  then
    raise exception
      'OPEN quote repair signals require a bounded staff-safe error'
      using errcode = '22023';
  end if;

  perform public.project_work_items_assert_v2(p_project_id, false);
  if not exists (
    select 1
    from public.quote_versions version
    join public.quotes quote on quote.id = version.quote_id
    where version.id = p_quote_version_id
      and quote.project_id = p_project_id
  ) then
    raise exception 'QUOTE_VERSION_NOT_FOUND' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_command_id::text, 2));
  select signal.*
  into v_signal
  from public.project_work_repair_signals signal
  where signal.command_id = p_command_id
  for update;
  if found and (
    v_signal.project_id is distinct from p_project_id
    or v_signal.source_event is distinct from v_event
    or v_signal.quote_version_id is distinct from p_quote_version_id
  ) then
    raise exception
      'PROJECT_WORK_REPAIR_SIGNAL_CONFLICT: command id belongs to another reconciliation'
      using errcode = '40001';
  end if;

  v_previous_setting := current_setting(
    'sanctuary.project_work_repair_signal',
    true
  );
  perform set_config(
    'sanctuary.project_work_repair_signal',
    'allowed',
    true
  );

  if v_action = 'OPEN' then
    if v_signal.id is null then
      insert into public.project_work_repair_signals(
        project_id,
        source_event,
        quote_version_id,
        command_id,
        status,
        error_code,
        error_message
      )
      values (
        p_project_id,
        v_event,
        p_quote_version_id,
        p_command_id,
        'OPEN',
        v_error_code,
        v_error_message
      )
      returning * into v_signal;
    else
      update public.project_work_repair_signals
      set
        status = 'OPEN',
        error_code = v_error_code,
        error_message = v_error_message,
        attempt_count = attempt_count + 1,
        row_version = row_version + 1,
        last_detected_at = clock_timestamp(),
        resolved_at = null
      where id = v_signal.id
      returning * into v_signal;
    end if;
    v_changed := true;
  else
    update public.project_work_repair_signals signal
    set
      status = 'RESOLVED',
      row_version = row_version + 1,
      resolved_at = clock_timestamp()
    from
      public.quote_versions signal_version,
      public.quote_versions current_version
    where signal.project_id = p_project_id
      and signal.status = 'OPEN'
      and signal.quote_version_id = signal_version.id
      and current_version.id = p_quote_version_id
      and signal_version.quote_id = current_version.quote_id
      and signal_version.version_number <= current_version.version_number
      and (
        v_event = 'QUOTE_OUTCOME'
        or signal.source_event in ('QUOTE_SENT','QUOTE_RESENT')
      );
    get diagnostics v_resolved_count = row_count;
    v_changed := v_resolved_count > 0;
    if v_signal.id is not null then
      select signal.*
      into v_signal
      from public.project_work_repair_signals signal
      where signal.id = v_signal.id;
    end if;
  end if;

  perform set_config(
    'sanctuary.project_work_repair_signal',
    coalesce(v_previous_setting, ''),
    true
  );
  return jsonb_build_object(
    'project_id', p_project_id,
    'repair_signal_id', v_signal.id,
    'status', coalesce(v_signal.status, 'RESOLVED'),
    'row_version', v_signal.row_version,
    'attempt_count', coalesce(v_signal.attempt_count, 0),
    'resolved_count', v_resolved_count,
    'present', v_signal.id is not null,
    'changed', v_changed
  );
exception
  when others then
    perform set_config(
      'sanctuary.project_work_repair_signal',
      coalesce(v_previous_setting, ''),
      true
    );
    raise;
end;
$$;

create or replace function public.project_work_items_contact_email_changed()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_project_id uuid;
  v_item public.project_work_items%rowtype;
  v_before public.project_work_items%rowtype;
  v_command_id uuid;
  v_email text := nullif(btrim(new.email), '');
  v_previous_setting text;
begin
  if nullif(btrim(coalesce(old.email, '')), '') is not distinct from
    nullif(btrim(coalesce(new.email, '')), '')
  then
    return new;
  end if;
  v_previous_setting := current_setting('sanctuary.project_work_command', true);
  perform set_config('sanctuary.project_work_command', 'allowed', true);

  for v_project_id in
    select project.id
    from public.projects project
    join public.project_work_model_versions model
      on model.project_id = project.id
      and model.model_version = 2
    where project.contact_id = new.id
    order by project.id
  loop
    select item.*
    into v_item
    from public.project_work_items item
    where item.project_id = v_project_id
      and item.source_key =
        'lead:first-email:' || v_project_id::text || ':v1'
    for update;
    if not found or v_item.status not in ('OPEN','BLOCKED') then
      continue;
    end if;
    v_before := v_item;
    v_command_id := gen_random_uuid();
    if v_email is null and v_item.status = 'OPEN' then
      update public.project_work_items
      set
        status = 'BLOCKED',
        blocked_reason = 'Customer email address is missing',
        row_version = row_version + 1,
        updated_by = null
      where id = v_item.id
      returning * into v_item;
      insert into public.project_work_item_events(
        work_item_id,project_id,command_id,event_sequence,event_type,
        before_state,after_state,reason,actor_user_id,actor_kind
      )
      values (
        v_item.id,v_project_id,v_command_id,0,'BLOCKED',
        to_jsonb(v_before),to_jsonb(v_item),
        'Customer email address was removed',null,'SYSTEM'
      );
      perform public.project_work_items_refresh_projection(v_project_id);
    elsif v_email is not null
      and v_item.status = 'BLOCKED'
      and v_item.blocked_reason = 'Customer email address is missing'
    then
      update public.project_work_items
      set
        status = 'OPEN',
        blocked_reason = null,
        row_version = row_version + 1,
        updated_by = null
      where id = v_item.id
      returning * into v_item;
      insert into public.project_work_item_events(
        work_item_id,project_id,command_id,event_sequence,event_type,
        before_state,after_state,reason,actor_user_id,actor_kind
      )
      values (
        v_item.id,v_project_id,v_command_id,0,'UNBLOCKED',
        to_jsonb(v_before),to_jsonb(v_item),
        'Customer email address is now available',null,'SYSTEM'
      );
      perform public.project_work_items_refresh_projection(v_project_id);
    end if;
  end loop;
  perform set_config(
    'sanctuary.project_work_command',
    coalesce(v_previous_setting, ''),
    true
  );
  return new;
exception
  when others then
    perform set_config(
      'sanctuary.project_work_command',
      coalesce(v_previous_setting, ''),
      true
    );
    raise;
end;
$$;

drop trigger if exists contacts_reconcile_project_work_email
  on public.contacts;
create trigger contacts_reconcile_project_work_email
after update of email on public.contacts
for each row execute function public.project_work_items_contact_email_changed();

alter table public.project_running_job_meta
  add column if not exists materials_ordered_at timestamptz null,
  add column if not exists materials_ordered_by uuid null,
  add column if not exists roofing_ordered_at timestamptz null,
  add column if not exists roofing_ordered_by uuid null,
  add column if not exists row_version bigint not null default 1;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'project_running_job_meta_row_version_positive'
      and conrelid = 'public.project_running_job_meta'::regclass
  ) then
    alter table public.project_running_job_meta
      add constraint project_running_job_meta_row_version_positive
      check (row_version > 0);
  end if;
end;
$$;

with legacy_facts as (
  select
    task.project_id,
    max(task.completed_at) filter (
      where task.task_key in ('order_materials','materials_ordered')
    ) as materials_ordered_at,
    (array_agg(task.completed_by order by task.completed_at desc) filter (
      where task.task_key in ('order_materials','materials_ordered')
    ))[1] as materials_ordered_by,
    max(task.completed_at) filter (
      where task.task_key = 'roofing_ordered'
    ) as roofing_ordered_at,
    (array_agg(task.completed_by order by task.completed_at desc) filter (
      where task.task_key = 'roofing_ordered'
    ))[1] as roofing_ordered_by
  from public.project_task_checks task
  where task.task_key in (
    'order_materials','materials_ordered','roofing_ordered'
  )
  group by task.project_id
)
insert into public.project_running_job_meta(
  project_id,
  materials_ordered_at,
  materials_ordered_by,
  roofing_ordered_at,
  roofing_ordered_by,
  row_version
)
select
  fact.project_id,
  fact.materials_ordered_at,
  fact.materials_ordered_by,
  fact.roofing_ordered_at,
  fact.roofing_ordered_by,
  1
from legacy_facts fact
on conflict(project_id) do update set
  materials_ordered_at = coalesce(
    public.project_running_job_meta.materials_ordered_at,
    excluded.materials_ordered_at
  ),
  materials_ordered_by = coalesce(
    public.project_running_job_meta.materials_ordered_by,
    excluded.materials_ordered_by
  ),
  roofing_ordered_at = coalesce(
    public.project_running_job_meta.roofing_ordered_at,
    excluded.roofing_ordered_at
  ),
  roofing_ordered_by = coalesce(
    public.project_running_job_meta.roofing_ordered_by,
    excluded.roofing_ordered_by
  );

create or replace function public.project_running_job_fact_write_guard()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_project_id uuid;
begin
  v_project_id := case when tg_op = 'DELETE' then old.project_id else new.project_id end;
  if not exists (
    select 1
    from public.project_work_model_versions model
    where model.project_id = v_project_id
      and model.model_version = 2
  ) then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if current_setting('sanctuary.running_job_fact_command', true) = 'allowed' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'INSERT' then
    if new.materials_ordered_at is not null
      or new.materials_ordered_by is not null
      or new.roofing_ordered_at is not null
      or new.roofing_ordered_by is not null
      or new.row_version <> 1
    then
      raise exception 'V2 running-job facts require their command'
        using errcode = '42501';
    end if;
    return new;
  elsif tg_op = 'UPDATE' then
    if old.materials_ordered_at is distinct from new.materials_ordered_at
      or old.materials_ordered_by is distinct from new.materials_ordered_by
      or old.roofing_ordered_at is distinct from new.roofing_ordered_at
      or old.roofing_ordered_by is distinct from new.roofing_ordered_by
      or old.row_version is distinct from new.row_version
    then
      raise exception 'V2 running-job facts require their command'
        using errcode = '42501';
    end if;
    return new;
  end if;
  raise exception 'V2 running-job fact rows cannot be deleted directly'
    using errcode = '42501';
end;
$$;

drop trigger if exists project_running_job_meta_fact_write_guard
  on public.project_running_job_meta;
create trigger project_running_job_meta_fact_write_guard
before insert or update or delete on public.project_running_job_meta
for each row execute function public.project_running_job_fact_write_guard();

create or replace function public.project_running_job_fact_command(
  p_project_id uuid,
  p_command_id uuid,
  p_fact text,
  p_value boolean,
  p_expected_row_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_fact text := lower(btrim(coalesce(p_fact, '')));
  v_intent jsonb;
  v_replay jsonb;
  v_meta public.project_running_job_meta%rowtype;
  v_before jsonb;
  v_result jsonb;
  v_previous_setting text;
begin
  if not public.has_portal_access() then
    raise exception 'staff access required' using errcode = '42501';
  end if;
  if p_command_id is null
    or v_fact not in ('materials_ordered','roofing_ordered')
    or p_value is null
    or p_expected_row_version is null
    or p_expected_row_version < 0
  then
    raise exception 'invalid running-job fact command' using errcode = '22023';
  end if;
  v_intent := jsonb_build_object(
    'fact', v_fact,
    'value', p_value,
    'expectedRowVersion', p_expected_row_version
  );
  perform pg_advisory_xact_lock(hashtextextended(p_command_id::text, 1));
  v_replay := public.project_work_items_receipt_replay(
    p_project_id,
    p_command_id,
    'RUNNING_JOB_FACT',
    v_intent
  );
  if v_replay is not null then
    return v_replay;
  end if;
  perform public.project_work_items_assert_v2(p_project_id, true);

  select meta.*
  into v_meta
  from public.project_running_job_meta meta
  where meta.project_id = p_project_id
  for update;
  if not found and p_expected_row_version <> 0 then
    raise exception
      'STALE_RUNNING_JOB_FACT: expected row version %, but the fact row is absent',
      p_expected_row_version
      using errcode = '40001';
  elsif found and v_meta.row_version <> p_expected_row_version then
    raise exception 'STALE_RUNNING_JOB_FACT: expected row version %, found %',
      p_expected_row_version, v_meta.row_version
      using errcode = '40001';
  end if;

  v_before := case when found then to_jsonb(v_meta) else null end;
  v_previous_setting := current_setting(
    'sanctuary.running_job_fact_command',
    true
  );
  perform set_config('sanctuary.running_job_fact_command', 'allowed', true);
  if v_meta.project_id is null then
    insert into public.project_running_job_meta(
      project_id,
      materials_ordered_at,
      materials_ordered_by,
      roofing_ordered_at,
      roofing_ordered_by,
      row_version
    )
    values (
      p_project_id,
      case when v_fact = 'materials_ordered' and p_value
        then clock_timestamp() else null end,
      case when v_fact = 'materials_ordered' and p_value
        then v_actor else null end,
      case when v_fact = 'roofing_ordered' and p_value
        then clock_timestamp() else null end,
      case when v_fact = 'roofing_ordered' and p_value
        then v_actor else null end,
      1
    )
    returning * into v_meta;
  else
    update public.project_running_job_meta
    set
      materials_ordered_at = case
        when v_fact <> 'materials_ordered' then materials_ordered_at
        when p_value then coalesce(materials_ordered_at, clock_timestamp())
        else null
      end,
      materials_ordered_by = case
        when v_fact <> 'materials_ordered' then materials_ordered_by
        when p_value then coalesce(materials_ordered_by, v_actor)
        else null
      end,
      roofing_ordered_at = case
        when v_fact <> 'roofing_ordered' then roofing_ordered_at
        when p_value then coalesce(roofing_ordered_at, clock_timestamp())
        else null
      end,
      roofing_ordered_by = case
        when v_fact <> 'roofing_ordered' then roofing_ordered_by
        when p_value then coalesce(roofing_ordered_by, v_actor)
        else null
      end,
      row_version = row_version + 1
    where project_id = p_project_id
    returning * into v_meta;
  end if;

  insert into public.project_command_audit(
    project_id,
    command_id,
    event_sequence,
    event_type,
    source_kind,
    source_id,
    actor_user_id,
    reason,
    before_state,
    after_state
  )
  values (
    p_project_id,
    p_command_id,
    0,
    'RUNNING_JOB_FACT_SET',
    null,
    null,
    v_actor,
    v_fact,
    v_before,
    to_jsonb(v_meta)
  );

  v_result := jsonb_build_object(
    'project_id', p_project_id,
    'work_item_id', null,
    'row_version', v_meta.row_version,
    'fact', v_fact,
    'value', p_value,
    'replayed', false,
    'refresh_required', false
  );
  perform public.project_work_items_store_receipt(
    p_project_id,
    p_command_id,
    'RUNNING_JOB_FACT',
    v_intent,
    v_actor,
    'STAFF',
    v_result
  );
  perform set_config(
    'sanctuary.running_job_fact_command',
    coalesce(v_previous_setting, ''),
    true
  );
  return v_result;
exception
  when others then
    perform set_config(
      'sanctuary.running_job_fact_command',
      coalesce(v_previous_setting, ''),
      true
    );
    raise;
end;
$$;

create or replace function public.project_work_queue_v2(
  p_now timestamptz default clock_timestamp(),
  p_limit integer default 200
)
returns table (
  project_id uuid,
  project_name text,
  queue_group text,
  title text,
  due_at timestamptz,
  priority text,
  blocked_reason text,
  assignee_user_id uuid,
  project_owner_key text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_now timestamptz := coalesce(p_now, clock_timestamp());
  v_limit integer := greatest(1, least(coalesce(p_limit, 200), 500));
  v_today date;
  v_seven_day_boundary timestamptz;
begin
  if not public.has_portal_access() then
    raise exception 'staff access required' using errcode = '42501';
  end if;
  v_today := (v_now at time zone 'Pacific/Auckland')::date;
  v_seven_day_boundary := public.project_work_items_add_business_days_due(
    v_now,
    7,
    'Auckland'
  );

  return query
  with eligible_projects as (
    select
      project.id as project_id,
      project.name as project_name,
      state.state,
      state.waiting_until,
      state.waiting_reason,
      owner_assignment.owner_key as project_owner_key
    from public.projects project
    join public.project_work_model_versions model
      on model.project_id = project.id and model.model_version = 2
    join public.project_operational_states state
      on state.project_id = project.id
    left join public.project_owner_assignments owner_assignment
      on owner_assignment.project_id = project.id
    where project.archived_at is null
  ),
  active_project_rows as (
    select
      project.project_id,
      project.project_name,
      case
        when repair_signal.id is not null then 'blocked'
        when open_item.id is not null
          and (open_item.due_at at time zone 'Pacific/Auckland')::date < v_today
          then 'overdue'
        when open_item.id is not null
          and (open_item.due_at at time zone 'Pacific/Auckland')::date = v_today
          then 'today'
        when open_item.id is not null then 'nextSevenBusinessDays'
        when blocked_item.id is not null then 'blocked'
        else 'needsTriage'
      end as queue_group,
      case
        when repair_signal.id is not null then 'Repair quote follow-up sync'
        else coalesce(open_item.title, blocked_item.title, 'Needs triage')
      end as title,
      coalesce(
        open_item.due_at,
        blocked_item.due_at,
        repair_signal.first_detected_at
      ) as due_at,
      case
        when repair_signal.id is not null then 'CRITICAL'
        else coalesce(open_item.priority, blocked_item.priority)
      end as priority,
      coalesce(repair_signal.error_message, blocked_item.blocked_reason)
        as blocked_reason,
      coalesce(open_item.assignee_user_id, blocked_item.assignee_user_id)
        as assignee_user_id,
      project.project_owner_key,
      case
        when repair_signal.id is not null then 3
        when open_item.id is not null
          and (open_item.due_at at time zone 'Pacific/Auckland')::date < v_today
          then 0
        when open_item.id is not null
          and (open_item.due_at at time zone 'Pacific/Auckland')::date = v_today
          then 1
        when open_item.id is not null then 2
        when blocked_item.id is not null then 3
        else 4
      end as group_rank
    from eligible_projects project
    left join lateral (
      select signal.*
      from public.project_work_repair_signals signal
      where signal.project_id = project.project_id
        and signal.status = 'OPEN'
      order by signal.first_detected_at, signal.id
      limit 1
    ) repair_signal on true
    left join lateral (
      select item.*
      from public.project_work_items item
      where item.project_id = project.project_id
        and item.status = 'OPEN'
        and item.due_at <= v_seven_day_boundary
      order by
        case item.priority when 'CRITICAL' then 0 else 1 end,
        case
          when (item.due_at at time zone 'Pacific/Auckland')::date < v_today
            then 0
          when (item.due_at at time zone 'Pacific/Auckland')::date = v_today
            then 1
          else 2
        end,
        item.due_at,
        item.created_at,
        item.id
      limit 1
    ) open_item on repair_signal.id is null
    left join lateral (
      select item.*
      from public.project_work_items item
      where item.project_id = project.project_id
        and item.status = 'BLOCKED'
      order by item.due_at, item.created_at, item.id
      limit 1
    ) blocked_item
      on repair_signal.id is null and open_item.id is null
    where project.state = 'ACTIVE'
      and (
        repair_signal.id is not null
        or open_item.id is not null
        or blocked_item.id is not null
        or not exists (
          select 1
          from public.project_work_items item
          where item.project_id = project.project_id
            and item.status in ('OPEN','BLOCKED')
        )
      )
  ),
  waiting_project_rows as (
    select
      project.project_id,
      project.project_name,
      'needsTriage'::text as queue_group,
      'Review waiting project'::text as title,
      project.waiting_until as due_at,
      null::text as priority,
      coalesce(project.waiting_reason, 'Waiting period has ended')
        as blocked_reason,
      null::uuid as assignee_user_id,
      project.project_owner_key,
      4 as group_rank
    from eligible_projects project
    where project.state = 'WAITING'
      and project.waiting_until <= v_now
  ),
  combined as (
    select * from active_project_rows
    union all
    select * from waiting_project_rows
  )
  select
    combined.project_id,
    combined.project_name,
    combined.queue_group,
    combined.title,
    combined.due_at,
    combined.priority,
    combined.blocked_reason,
    combined.assignee_user_id,
    combined.project_owner_key
  from combined
  order by
    combined.group_rank,
    case combined.priority when 'CRITICAL' then 0 else 1 end,
    combined.due_at nulls last,
    lower(combined.project_name),
    combined.project_id
  limit v_limit;
end;
$$;

-- Design-package persistence remains authoritative, but V2 projects no
-- longer mirror design readiness into the retired generic task system.
create or replace function public.project_command_sync_design_task(
  p_project_id uuid,
  p_operation text,
  p_idempotency_key text,
  p_title text,
  p_details text,
  p_due_at timestamptz,
  p_status text,
  p_meta jsonb
)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  if not public.has_portal_access() then
    raise exception 'portal access required' using errcode = '42501';
  end if;
  if not exists(select 1 from public.projects where id=p_project_id) then
    raise exception 'project not found' using errcode = 'P0002';
  end if;
  if exists (
    select 1
    from public.project_work_model_versions model
    where model.project_id = p_project_id
      and model.model_version = 2
  ) then
    return;
  end if;
  if p_idempotency_key not like
    'design\_request:' || p_project_id::text || ':v%' escape '\'
  then
    raise exception 'invalid design task key' using errcode = '22023';
  end if;
  if p_operation='upsert' then
    if nullif(trim(p_title),'') is null then
      raise exception 'design task title is required' using errcode = '22023';
    end if;
    insert into public.tasks(
      project_id,type,status,title,details,due_at,meta,idempotency_key
    )
    values(
      p_project_id,'CREATE_DESIGN_PACKAGE','OPEN',trim(p_title),p_details,
      p_due_at,coalesce(p_meta,'{}'::jsonb),p_idempotency_key
    )
    on conflict(idempotency_key) do update set
      status='OPEN',
      title=excluded.title,
      details=excluded.details,
      due_at=excluded.due_at,
      meta=excluded.meta,
      completed_at=null,
      updated_at=now();
  elsif p_operation='set_status' then
    if p_status not in ('OPEN','DONE','SKIPPED') then
      raise exception 'invalid design task status' using errcode = '22023';
    end if;
    update public.tasks set
      status=p_status,
      completed_at=case when p_status in ('DONE','SKIPPED')
        then now() else null end,
      updated_at=now()
    where project_id=p_project_id
      and type='CREATE_DESIGN_PACKAGE'
      and idempotency_key=p_idempotency_key;
  elsif p_operation='set_due' then
    update public.tasks
    set due_at=p_due_at,updated_at=now()
    where project_id=p_project_id
      and type='CREATE_DESIGN_PACKAGE'
      and idempotency_key=p_idempotency_key;
  else
    raise exception 'invalid design task operation' using errcode = '22023';
  end if;
end;
$$;

create or replace function public.project_work_items_legacy_write_guard()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_old_project_id uuid;
  v_new_project_id uuid;
begin
  if current_setting('sanctuary.legacy_v2_override', true) = 'allowed' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op in ('UPDATE','DELETE') then
    v_old_project_id := old.project_id;
  end if;
  if tg_op in ('INSERT','UPDATE') then
    v_new_project_id := new.project_id;
  end if;
  if exists (
    select 1
    from public.project_work_model_versions model
    where model.project_id in (v_old_project_id, v_new_project_id)
      and model.model_version = 2
  )
  then
    raise exception
      'LEGACY_PROJECT_WORK_WRITE_BLOCKED: V2 projects use project work commands'
      using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists tasks_block_v2_legacy_write on public.tasks;
create trigger tasks_block_v2_legacy_write
before insert or update or delete on public.tasks
for each row execute function public.project_work_items_legacy_write_guard();

drop trigger if exists followup_plans_block_v2_legacy_write
  on public.followup_plans;
create trigger followup_plans_block_v2_legacy_write
before insert or update or delete on public.followup_plans
for each row execute function public.project_work_items_legacy_write_guard();

drop trigger if exists followup_tasks_block_v2_legacy_write
  on public.followup_tasks;
create trigger followup_tasks_block_v2_legacy_write
before insert or update or delete on public.followup_tasks
for each row execute function public.project_work_items_legacy_write_guard();

drop trigger if exists project_manual_actions_block_v2_legacy_write
  on public.project_manual_actions;
create trigger project_manual_actions_block_v2_legacy_write
before insert or update or delete on public.project_manual_actions
for each row execute function public.project_work_items_legacy_write_guard();

drop trigger if exists project_action_controls_block_v2_legacy_write
  on public.project_action_controls;
create trigger project_action_controls_block_v2_legacy_write
before insert or update or delete on public.project_action_controls
for each row execute function public.project_work_items_legacy_write_guard();

drop trigger if exists project_primary_action_selections_block_v2_legacy_write
  on public.project_primary_action_selections;
create trigger project_primary_action_selections_block_v2_legacy_write
before insert or update or delete on public.project_primary_action_selections
for each row execute function public.project_work_items_legacy_write_guard();

drop trigger if exists project_action_versions_block_v2_legacy_write
  on public.project_action_versions;
create trigger project_action_versions_block_v2_legacy_write
before insert or update or delete on public.project_action_versions
for each row execute function public.project_work_items_legacy_write_guard();

drop trigger if exists project_task_checks_block_v2_legacy_write
  on public.project_task_checks;
create trigger project_task_checks_block_v2_legacy_write
before insert or update or delete on public.project_task_checks
for each row execute function public.project_work_items_legacy_write_guard();

alter table public.project_work_model_versions enable row level security;
alter table public.project_operational_states enable row level security;
alter table public.project_state_events enable row level security;
alter table public.project_work_items enable row level security;
alter table public.project_work_item_events enable row level security;
alter table public.project_confirmation_events enable row level security;
alter table public.project_command_receipts enable row level security;
alter table public.project_work_repair_signals enable row level security;
alter table public.business_calendar_year_coverage enable row level security;

revoke all on public.project_work_model_versions
  from public, anon, authenticated, service_role;
revoke all on public.project_operational_states
  from public, anon, authenticated, service_role;
revoke all on public.project_state_events
  from public, anon, authenticated, service_role;
revoke all on public.project_work_items
  from public, anon, authenticated, service_role;
revoke all on public.project_work_item_events
  from public, anon, authenticated, service_role;
revoke all on public.project_confirmation_events
  from public, anon, authenticated, service_role;
revoke all on public.project_command_receipts
  from public, anon, authenticated, service_role;
revoke all on public.project_work_repair_signals
  from public, anon, authenticated, service_role;
revoke all on public.business_calendar_year_coverage
  from public, anon, authenticated, service_role;

grant select on public.project_work_model_versions to authenticated;
grant select on public.project_operational_states to authenticated;
grant select on public.project_state_events to authenticated;
grant select on public.project_work_items to authenticated;
grant select on public.project_work_item_events to authenticated;
grant select on public.project_confirmation_events to authenticated;
grant select on public.project_work_repair_signals to authenticated;
grant select on public.business_calendar_year_coverage to authenticated;
grant select on public.project_work_model_versions to service_role;
grant select on public.project_operational_states to service_role;

drop policy if exists project_work_model_versions_staff_select
  on public.project_work_model_versions;
create policy project_work_model_versions_staff_select
  on public.project_work_model_versions
  for select
  to authenticated
  using ((select public.has_portal_access()));

drop policy if exists project_operational_states_staff_select
  on public.project_operational_states;
create policy project_operational_states_staff_select
  on public.project_operational_states
  for select
  to authenticated
  using ((select public.has_portal_access()));

drop policy if exists project_state_events_staff_select
  on public.project_state_events;
create policy project_state_events_staff_select
  on public.project_state_events
  for select
  to authenticated
  using ((select public.has_portal_access()));

drop policy if exists project_work_items_staff_select
  on public.project_work_items;
create policy project_work_items_staff_select
  on public.project_work_items
  for select
  to authenticated
  using ((select public.has_portal_access()));

drop policy if exists project_work_item_events_staff_select
  on public.project_work_item_events;
create policy project_work_item_events_staff_select
  on public.project_work_item_events
  for select
  to authenticated
  using ((select public.has_portal_access()));

drop policy if exists project_confirmation_events_staff_select
  on public.project_confirmation_events;
create policy project_confirmation_events_staff_select
  on public.project_confirmation_events
  for select
  to authenticated
  using ((select public.has_portal_access()));

drop policy if exists project_work_repair_signals_staff_select
  on public.project_work_repair_signals;
create policy project_work_repair_signals_staff_select
  on public.project_work_repair_signals
  for select
  to authenticated
  using ((select public.has_portal_access()));

drop policy if exists business_calendar_year_coverage_staff_select
  on public.business_calendar_year_coverage;
create policy business_calendar_year_coverage_staff_select
  on public.business_calendar_year_coverage
  for select
  to authenticated
  using ((select public.has_portal_access()));

revoke all on function public.project_work_items_append_only_guard()
  from public, anon, authenticated, service_role;
revoke all on function public.project_work_items_governed_write_guard()
  from public, anon, authenticated, service_role;
revoke all on function public.project_work_repair_signal_write_guard()
  from public, anon, authenticated, service_role;
revoke all on function public.project_work_items_assert_v2(uuid,boolean)
  from public, anon, authenticated, service_role;
revoke all on function public.project_work_items_compatibility_write_guard()
  from public, anon, authenticated, service_role;
revoke all on function public.project_work_items_archive_write_guard()
  from public, anon, authenticated, service_role;
revoke all on function public.project_work_items_refresh_projection(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.project_work_items_initialize_project_v2(
  uuid,timestamptz,uuid,text
) from public, anon, authenticated, service_role;
revoke all on function public.project_work_items_initialize_enquiry_v2()
  from public, anon, authenticated, service_role;
revoke all on function public.project_work_items_receipt_replay(
  uuid,uuid,text,jsonb
) from public, anon, authenticated, service_role;
revoke all on function public.project_work_items_store_receipt(
  uuid,uuid,text,jsonb,uuid,text,jsonb
) from public, anon, authenticated, service_role;
revoke all on function public.project_work_items_cancel_active(
  uuid,uuid,text,uuid,text,integer,text,text,text
) from public, anon, authenticated, service_role;
revoke all on function public.project_work_items_legacy_write_guard()
  from public, anon, authenticated, service_role;
revoke all on function public.project_running_job_fact_write_guard()
  from public, anon, authenticated, service_role;
revoke all on function public.project_work_items_contact_email_changed()
  from public, anon, authenticated, service_role;

revoke all on function public.project_work_items_intent_hash(uuid,text,jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.project_work_items_is_business_date(date,text)
  from public, anon, authenticated, service_role;
revoke all on function public.project_work_items_require_calendar_coverage(
  date,date,text
) from public, anon, authenticated, service_role;
revoke all on function public.project_work_items_calendar_revision(
  timestamptz,timestamptz,text
) from public, anon, authenticated, service_role;
revoke all on function public.project_work_items_add_open_hours(
  timestamptz,integer,text
) from public, anon, authenticated, service_role;
revoke all on function public.project_work_items_add_business_days_due(
  timestamptz,integer,text
) from public, anon, authenticated, service_role;
revoke all on function public.project_work_items_last_business_day_due(date,text)
  from public, anon, authenticated, service_role;
revoke all on function public.project_work_items_first_business_day_after_due(
  date,text
) from public, anon, authenticated, service_role;

revoke all on function public.project_create_v2(
  uuid,uuid,text,text,text,text
) from public, anon, authenticated, service_role;
grant execute on function public.project_create_v2(
  uuid,uuid,text,text,text,text
) to authenticated;

revoke all on function public.project_work_item_command(
  uuid,uuid,text,jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.project_work_item_command(
  uuid,uuid,text,jsonb
) to authenticated;

revoke all on function public.project_operational_state_command(
  uuid,uuid,text,jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.project_operational_state_command(
  uuid,uuid,text,jsonb
) to authenticated;

revoke all on function public.project_confirmation_command(
  uuid,uuid,text,jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.project_confirmation_command(
  uuid,uuid,text,jsonb
) to authenticated;

revoke all on function public.project_work_archive_command(
  uuid,uuid,boolean,bigint,text
) from public, anon, authenticated, service_role;
grant execute on function public.project_work_archive_command(
  uuid,uuid,boolean,bigint,text
) to authenticated;

revoke all on function public.project_work_integrity_report_v2(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.project_work_integrity_report_v2(uuid)
  to authenticated;

revoke all on function public.project_work_queue_v2(timestamptz,integer)
  from public, anon, authenticated, service_role;
grant execute on function public.project_work_queue_v2(timestamptz,integer)
  to authenticated;

revoke all on function public.project_running_job_fact_command(
  uuid,uuid,text,boolean,bigint
) from public, anon, authenticated, service_role;
grant execute on function public.project_running_job_fact_command(
  uuid,uuid,text,boolean,bigint
) to authenticated;

revoke all on function public.project_work_item_reconcile(
  uuid,uuid,text,jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.project_work_item_reconcile(
  uuid,uuid,text,jsonb
) to service_role;

revoke all on function public.project_work_quote_repair_signal_command(
  uuid,uuid,text,uuid,text,text,text
) from public, anon, authenticated, service_role;
grant execute on function public.project_work_quote_repair_signal_command(
  uuid,uuid,text,uuid,text,text,text
) to service_role;

select pg_notify('pgrst', 'reload schema');

commit;
