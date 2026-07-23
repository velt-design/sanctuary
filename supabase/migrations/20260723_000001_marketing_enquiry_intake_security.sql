create extension if not exists pgcrypto;
create extension if not exists pg_cron with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

alter table public.enquiry_requests
  add column if not exists submission_id uuid;

update public.enquiry_requests
set submission_id = gen_random_uuid()
where submission_id is null;

alter table public.enquiry_requests
  alter column submission_id set default gen_random_uuid(),
  alter column submission_id set not null;

create unique index if not exists enquiry_requests_submission_id_uidx
  on public.enquiry_requests(submission_id);

create table if not exists public.marketing_public_rate_limits (
  scope text not null check (scope ~ '^[a-z0-9_]{1,64}$'),
  key_hash text not null check (key_hash ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null default now(),
  hit_count integer not null default 1 check (hit_count > 0),
  updated_at timestamptz not null default now(),
  primary key (scope, key_hash)
);

create index if not exists marketing_public_rate_limits_updated_idx
  on public.marketing_public_rate_limits(updated_at);

create table if not exists public.marketing_enquiry_upload_sessions (
  submission_id uuid primary key,
  token_hash text not null check (token_hash ~ '^[a-f0-9]{64}$'),
  ip_key_hash text not null check (ip_key_hash ~ '^[a-f0-9]{64}$'),
  expected_files jsonb not null check (
    jsonb_typeof(expected_files) = 'array'
    and jsonb_array_length(expected_files) between 1 and 8
  ),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  cleanup_started_at timestamptz,
  enquiry_request_id uuid references public.enquiry_requests(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketing_enquiry_upload_sessions_cleanup_idx
  on public.marketing_enquiry_upload_sessions(expires_at, cleanup_started_at)
  where consumed_at is null;

alter table public.marketing_public_rate_limits enable row level security;
alter table public.marketing_enquiry_upload_sessions enable row level security;

revoke all on table public.marketing_public_rate_limits
  from public, anon, authenticated, service_role;
revoke all on table public.marketing_enquiry_upload_sessions
  from public, anon, authenticated, service_role;

create or replace function private.marketing_public_rate_limit_take_core(
  p_scope text,
  p_key_hash text,
  p_max_hits integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window interval;
  v_row public.marketing_public_rate_limits%rowtype;
begin
  if p_scope !~ '^[a-z0-9_]{1,64}$'
     or p_key_hash !~ '^[a-f0-9]{64}$'
     or p_max_hits not between 1 and 100
     or p_window_seconds not between 60 and 86400 then
    raise exception 'invalid_rate_limit_input' using errcode = '22023';
  end if;

  v_window := make_interval(secs => p_window_seconds);

  insert into public.marketing_public_rate_limits (
    scope,
    key_hash,
    window_started_at,
    hit_count,
    updated_at
  )
  values (p_scope, p_key_hash, v_now, 1, v_now)
  on conflict (scope, key_hash) do update
  set
    window_started_at = case
      when public.marketing_public_rate_limits.window_started_at <= v_now - v_window
        then v_now
      else public.marketing_public_rate_limits.window_started_at
    end,
    hit_count = case
      when public.marketing_public_rate_limits.window_started_at <= v_now - v_window
        then 1
      else public.marketing_public_rate_limits.hit_count + 1
    end,
    updated_at = v_now
  returning * into v_row;

  allowed := v_row.hit_count <= p_max_hits;
  retry_after_seconds := case
    when allowed then 0
    else greatest(
      1,
      ceil(extract(epoch from ((v_row.window_started_at + v_window) - v_now)))::integer
    )
  end;
  return next;
end;
$$;

revoke all on function private.marketing_public_rate_limit_take_core(text,text,integer,integer)
  from public, anon, authenticated, service_role;

create or replace function public.marketing_public_rate_limit_take(
  p_scope text,
  p_key_hash text,
  p_max_hits integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  retry_after_seconds integer
)
language sql
security definer
set search_path = ''
as $$
  select *
  from private.marketing_public_rate_limit_take_core(
    p_scope,
    p_key_hash,
    p_max_hits,
    p_window_seconds
  );
$$;

revoke all on function public.marketing_public_rate_limit_take(text,text,integer,integer)
  from public, anon, authenticated, service_role;
grant execute on function public.marketing_public_rate_limit_take(text,text,integer,integer)
  to service_role;

create or replace function public.marketing_enquiry_prepare_upload_session(
  p_submission_id uuid,
  p_token_hash text,
  p_ip_key_hash text,
  p_files jsonb,
  p_max_hits integer default 5,
  p_window_seconds integer default 600
)
returns table (
  allowed boolean,
  retry_after_seconds integer,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rate record;
  v_total_bytes bigint;
  v_expires_at timestamptz := clock_timestamp() + interval '15 minutes';
begin
  if p_submission_id is null
     or p_token_hash !~ '^[a-f0-9]{64}$'
     or p_ip_key_hash !~ '^[a-f0-9]{64}$'
     or jsonb_typeof(p_files) is distinct from 'array'
     or jsonb_array_length(p_files) not between 1 and 8 then
    raise exception 'invalid_upload_session_input' using errcode = '22023';
  end if;

  select coalesce(sum((entry->>'size')::bigint), 0)
  into v_total_bytes
  from jsonb_array_elements(p_files) entry;

  if v_total_bytes <= 0 or v_total_bytes > 20971520 or exists (
    select 1
    from jsonb_array_elements(p_files) entry
    where coalesce(entry->>'name', '') = ''
       or coalesce(entry->>'path', '') !~ (
         '^pending/' || p_submission_id::text || '/[0-7]-[A-Za-z0-9._-]{1,160}$'
       )
       or coalesce(entry->>'type', '') not in (
         'application/pdf',
         'image/jpeg',
         'image/png',
         'image/webp'
       )
       or coalesce((entry->>'size')::bigint, 0) not between 1 and 20971520
  ) then
    raise exception 'invalid_upload_file_metadata' using errcode = '22023';
  end if;

  select *
  into v_rate
  from private.marketing_public_rate_limit_take_core(
    'enquiry_upload_sign',
    p_ip_key_hash,
    p_max_hits,
    p_window_seconds
  );

  if not v_rate.allowed then
    allowed := false;
    retry_after_seconds := v_rate.retry_after_seconds;
    expires_at := null;
    return next;
    return;
  end if;

  insert into public.marketing_enquiry_upload_sessions (
    submission_id,
    token_hash,
    ip_key_hash,
    expected_files,
    expires_at,
    consumed_at,
    cleanup_started_at,
    enquiry_request_id,
    updated_at
  )
  values (
    p_submission_id,
    p_token_hash,
    p_ip_key_hash,
    p_files,
    v_expires_at,
    null,
    null,
    null,
    clock_timestamp()
  )
  on conflict (submission_id) do update
  set
    token_hash = excluded.token_hash,
    ip_key_hash = excluded.ip_key_hash,
    expected_files = excluded.expected_files,
    expires_at = excluded.expires_at,
    updated_at = excluded.updated_at
  where public.marketing_enquiry_upload_sessions.consumed_at is null
    and public.marketing_enquiry_upload_sessions.cleanup_started_at is null;

  if not found then
    raise exception 'upload_session_already_consumed' using errcode = '23505';
  end if;

  allowed := true;
  retry_after_seconds := 0;
  expires_at := v_expires_at;
  return next;
end;
$$;

revoke all on function public.marketing_enquiry_prepare_upload_session(uuid,text,text,jsonb,integer,integer)
  from public, anon, authenticated, service_role;
grant execute on function public.marketing_enquiry_prepare_upload_session(uuid,text,text,jsonb,integer,integer)
  to service_role;

create or replace function public.marketing_enquiry_intake(
  p_submission_id uuid,
  p_upload_token_hash text,
  p_payload jsonb
)
returns table (
  contact_id uuid,
  project_id uuid,
  enquiry_request_id uuid,
  already_existed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.enquiry_requests%rowtype;
  v_session public.marketing_enquiry_upload_sessions%rowtype;
  v_contact_id uuid;
  v_project_id uuid;
  v_enquiry_id uuid;
  v_enquiry_type text;
  v_name text;
  v_email text;
  v_phone text;
  v_phone_raw text;
  v_suburb text;
  v_files jsonb;
  v_has_stored_files boolean;
begin
  if p_submission_id is null or jsonb_typeof(p_payload) is distinct from 'object' then
    raise exception 'invalid_enquiry_intake_input' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_submission_id::text, 0));

  select *
  into v_existing
  from public.enquiry_requests
  where submission_id = p_submission_id;

  if found then
    contact_id := v_existing.contact_id;
    project_id := v_existing.project_id;
    enquiry_request_id := v_existing.id;
    already_existed := true;
    return next;
    return;
  end if;

  v_enquiry_type := lower(btrim(coalesce(p_payload->>'enquiryType', '')));
  v_name := btrim(coalesce(p_payload->>'name', ''));
  v_email := lower(btrim(coalesce(p_payload->>'email', '')));
  v_phone := btrim(coalesce(p_payload->>'phone', ''));
  v_phone_raw := btrim(coalesce(p_payload->>'phoneRaw', ''));
  v_suburb := btrim(coalesce(p_payload->>'suburb', ''));
  v_files := coalesce(p_payload->'files', '[]'::jsonb);

  if v_enquiry_type not in ('residential', 'commercial', 'professional')
     or v_name = ''
     or v_phone = ''
     or jsonb_typeof(v_files) is distinct from 'array'
     or jsonb_array_length(v_files) > 8 then
    raise exception 'invalid_enquiry_intake_input' using errcode = '22023';
  end if;

  select exists (
    select 1
    from jsonb_array_elements(v_files) entry
    where nullif(entry->>'path', '') is not null
  ) into v_has_stored_files;

  if v_has_stored_files then
    if p_upload_token_hash !~ '^[a-f0-9]{64}$' then
      raise exception 'invalid_upload_session' using errcode = '22023';
    end if;

    select *
    into v_session
    from public.marketing_enquiry_upload_sessions
    where submission_id = p_submission_id
      and token_hash = p_upload_token_hash
      and consumed_at is null
      and expires_at > clock_timestamp()
    for update;

    if not found or exists (
      select 1
      from jsonb_array_elements(v_files) supplied
      where nullif(supplied->>'path', '') is not null
        and not exists (
          select 1
          from jsonb_array_elements(v_session.expected_files) expected
          where expected->>'path' = supplied->>'path'
            and expected->>'name' = supplied->>'name'
            and expected->>'type' = supplied->>'type'
            and (expected->>'size')::bigint = (supplied->>'size')::bigint
        )
    ) then
      raise exception 'invalid_upload_session' using errcode = '22023';
    end if;
  end if;

  if v_email <> '' then
    select id
    into v_contact_id
    from public.contacts
    where lower(email) = v_email
    limit 1;
  end if;

  if v_contact_id is null then
    select id
    into v_contact_id
    from public.contacts
    where phone = v_phone
    limit 1;
  end if;

  if v_contact_id is null and v_phone_raw <> '' and v_phone_raw <> v_phone then
    select id
    into v_contact_id
    from public.contacts
    where phone = v_phone_raw
    limit 1;
  end if;

  if v_contact_id is null then
    insert into public.contacts (name, email, phone)
    values (v_name, nullif(v_email, ''), v_phone)
    returning id into v_contact_id;
  else
    update public.contacts
    set
      name = case when nullif(btrim(name), '') is null then v_name else name end,
      email = case when nullif(btrim(email), '') is null then nullif(v_email, '') else email end,
      phone = case when nullif(btrim(phone), '') is null then v_phone else phone end
    where id = v_contact_id;
  end if;

  insert into public.projects (
    contact_id,
    name,
    pipeline_stage,
    site_address
  )
  values (
    v_contact_id,
    v_name || ' - ' || coalesce(nullif(v_suburb, ''), 'Enquiry'),
    'NEW',
    nullif(v_suburb, '')
  )
  returning id into v_project_id;

  insert into public.enquiry_requests (
    submission_id,
    contact_id,
    project_id,
    enquiry_type,
    suburb,
    message,
    width_m,
    depth_m,
    height_m,
    style,
    roof_materials,
    add_ons,
    base_budget_low_inc_gst,
    base_budget_high_inc_gst,
    blinds_budget_low_inc_gst,
    blinds_budget_high_inc_gst,
    budget_basis,
    company,
    files,
    source,
    page,
    utm,
    raw_payload
  )
  values (
    p_submission_id,
    v_contact_id,
    v_project_id,
    v_enquiry_type,
    nullif(v_suburb, ''),
    nullif(p_payload->>'message', ''),
    nullif(p_payload->>'widthM', '')::numeric,
    nullif(p_payload->>'depthM', '')::numeric,
    nullif(p_payload->>'heightM', '')::numeric,
    nullif(p_payload->>'style', ''),
    case
      when jsonb_typeof(p_payload->'roofMaterials') = 'array'
        then array(select jsonb_array_elements_text(p_payload->'roofMaterials'))
      else null
    end,
    coalesce(p_payload->'addOns', '{}'::jsonb),
    nullif(p_payload->>'baseBudgetLowIncGst', '')::integer,
    nullif(p_payload->>'baseBudgetHighIncGst', '')::integer,
    nullif(p_payload->>'blindsBudgetLowIncGst', '')::integer,
    nullif(p_payload->>'blindsBudgetHighIncGst', '')::integer,
    nullif(p_payload->>'budgetBasis', ''),
    nullif(p_payload->>'company', ''),
    v_files,
    coalesce(nullif(p_payload->>'source', ''), 'website'),
    nullif(p_payload->>'page', ''),
    coalesce(p_payload->'utm', '{}'::jsonb),
    coalesce(p_payload->'rawPayload', '{}'::jsonb)
  )
  returning id into v_enquiry_id;

  if v_has_stored_files then
    update public.marketing_enquiry_upload_sessions
    set
      consumed_at = clock_timestamp(),
      enquiry_request_id = v_enquiry_id,
      updated_at = clock_timestamp()
    where submission_id = p_submission_id;
  end if;

  contact_id := v_contact_id;
  project_id := v_project_id;
  enquiry_request_id := v_enquiry_id;
  already_existed := false;
  return next;
end;
$$;

revoke all on function public.marketing_enquiry_intake(uuid,text,jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.marketing_enquiry_intake(uuid,text,jsonb)
  to service_role;

create or replace function public.marketing_enquiry_stale_upload_sessions(
  p_limit integer default 50
)
returns table (
  submission_id uuid,
  expected_files jsonb
)
language sql
security definer
set search_path = ''
as $$
  with stale as (
    select session.submission_id
    from public.marketing_enquiry_upload_sessions session
    where session.consumed_at is null
      and session.expires_at < clock_timestamp()
      and (
        session.cleanup_started_at is null
        or session.cleanup_started_at < clock_timestamp() - interval '1 hour'
      )
    order by session.expires_at asc
    limit greatest(1, least(coalesce(p_limit, 50), 200))
    for update skip locked
  )
  update public.marketing_enquiry_upload_sessions session
  set
    cleanup_started_at = clock_timestamp(),
    updated_at = clock_timestamp()
  from stale
  where session.submission_id = stale.submission_id
  returning session.submission_id, session.expected_files;
$$;

revoke all on function public.marketing_enquiry_stale_upload_sessions(integer)
  from public, anon, authenticated, service_role;
grant execute on function public.marketing_enquiry_stale_upload_sessions(integer)
  to service_role;

create or replace function public.marketing_enquiry_delete_stale_upload_sessions(
  p_submission_ids uuid[]
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted bigint;
begin
  delete from public.marketing_enquiry_upload_sessions
  where submission_id = any(coalesce(p_submission_ids, array[]::uuid[]))
    and consumed_at is null
    and expires_at < clock_timestamp()
    and cleanup_started_at is not null;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.marketing_enquiry_delete_stale_upload_sessions(uuid[])
  from public, anon, authenticated, service_role;
grant execute on function public.marketing_enquiry_delete_stale_upload_sessions(uuid[])
  to service_role;

create or replace function public.purge_marketing_enquiry_security()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted bigint := 0;
  v_count bigint;
begin
  delete from public.marketing_public_rate_limits
  where updated_at < clock_timestamp() - interval '2 days';
  get diagnostics v_deleted = row_count;

  delete from public.marketing_enquiry_upload_sessions
  where consumed_at < clock_timestamp() - interval '30 days';
  get diagnostics v_count = row_count;
  v_deleted := v_deleted + v_count;

  return v_deleted;
end;
$$;

revoke all on function public.purge_marketing_enquiry_security()
  from public, anon, authenticated, service_role;

select cron.schedule(
  'marketing-enquiry-security-retention-daily',
  '29 3 * * *',
  $cron$select public.purge_marketing_enquiry_security();$cron$
);

notify pgrst, 'reload schema';
