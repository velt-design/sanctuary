create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.project_enquiry_attachments (
  id uuid primary key default gen_random_uuid(),
  enquiry_request_id uuid not null references public.enquiry_requests(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  submission_id uuid not null,
  file_ordinal smallint not null check (file_ordinal between 0 and 7),
  storage_bucket text not null default 'enquiry-attachments'
    check (storage_bucket = 'enquiry-attachments'),
  storage_path text not null check (char_length(storage_path) between 1 and 512),
  original_filename text not null check (char_length(btrim(original_filename)) between 1 and 160),
  content_type text not null check (content_type in (
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp'
  )),
  size_bytes bigint not null check (size_bytes between 1 and 20971520),
  link_origin text not null check (link_origin in (
    'intake',
    'historical_backfill',
    'reconciliation'
  )),
  linked_at timestamptz not null default clock_timestamp(),
  unlinked_at timestamptz,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint project_enquiry_attachments_storage_path_key
    unique (storage_bucket, storage_path),
  constraint project_enquiry_attachments_request_ordinal_key
    unique (enquiry_request_id, file_ordinal),
  constraint project_enquiry_attachments_submission_path_check check (
    storage_path like 'pending/' || submission_id::text || '/%'
  ),
  constraint project_enquiry_attachments_link_state_check check (
    (project_id is not null and unlinked_at is null)
    or (project_id is null and unlinked_at is not null)
  )
);

create index if not exists project_enquiry_attachments_project_idx
  on public.project_enquiry_attachments(project_id, created_at desc)
  where project_id is not null;

create index if not exists project_enquiry_attachments_enquiry_idx
  on public.project_enquiry_attachments(enquiry_request_id, file_ordinal);

create table if not exists public.project_enquiry_attachment_events (
  id uuid primary key default gen_random_uuid(),
  attachment_id uuid references public.project_enquiry_attachments(id) on delete set null,
  enquiry_request_id uuid references public.enquiry_requests(id) on delete set null,
  event_type text not null check (event_type in (
    'linked',
    'relinked',
    'unlinked',
    'view_url_issued',
    'download_url_issued'
  )),
  previous_project_id uuid,
  project_id uuid,
  actor_user_id uuid,
  request_id text check (request_id is null or char_length(request_id) between 1 and 160),
  link_origin text check (link_origin is null or link_origin in (
    'intake',
    'historical_backfill',
    'reconciliation'
  )),
  occurred_at timestamptz not null default clock_timestamp(),
  constraint project_enquiry_attachment_events_shape_check check (
    (
      event_type in ('linked', 'relinked', 'unlinked')
      and actor_user_id is null
      and request_id is null
      and link_origin is not null
    )
    or (
      event_type in ('view_url_issued', 'download_url_issued')
      and actor_user_id is not null
      and project_id is not null
      and previous_project_id is null
      and request_id is not null
      and link_origin is null
    )
  )
);

create index if not exists project_enquiry_attachment_events_attachment_idx
  on public.project_enquiry_attachment_events(attachment_id, occurred_at desc);

create index if not exists project_enquiry_attachment_events_project_idx
  on public.project_enquiry_attachment_events(project_id, occurred_at desc)
  where project_id is not null;

create table if not exists public.project_enquiry_attachment_backfill_runs (
  run_id uuid primary key,
  payload_hash text not null check (payload_hash ~ '^[a-f0-9]{64}$'),
  candidate_count integer not null check (candidate_count between 1 and 5000),
  inserted_count integer not null check (inserted_count >= 0),
  existing_count integer not null check (existing_count >= 0),
  applied_at timestamptz not null default clock_timestamp(),
  check (inserted_count + existing_count = candidate_count)
);

alter table public.project_enquiry_attachments enable row level security;
alter table public.project_enquiry_attachment_events enable row level security;
alter table public.project_enquiry_attachment_backfill_runs enable row level security;

revoke all on table public.project_enquiry_attachments
  from public, anon, authenticated, service_role;
revoke all on table public.project_enquiry_attachment_events
  from public, anon, authenticated, service_role;
revoke all on table public.project_enquiry_attachment_backfill_runs
  from public, anon, authenticated, service_role;

grant select on table public.project_enquiry_attachments to authenticated;
grant select on table public.project_enquiry_attachments to service_role;
grant insert on table public.project_enquiry_attachment_events to authenticated;
grant select on table public.project_enquiry_attachment_events to authenticated;

drop policy if exists project_enquiry_attachments_staff_select
  on public.project_enquiry_attachments;
create policy project_enquiry_attachments_staff_select
  on public.project_enquiry_attachments
  for select
  to authenticated
  using (
    project_id is not null
    and (select public.has_portal_access())
  );

drop policy if exists project_enquiry_attachment_events_staff_insert
  on public.project_enquiry_attachment_events;
create policy project_enquiry_attachment_events_staff_insert
  on public.project_enquiry_attachment_events
  for insert
  to authenticated
  with check (
    actor_user_id = (select auth.uid())
    and project_id is not null
    and exists (
      select 1
      from public.project_enquiry_attachments attachment
      where attachment.id = project_enquiry_attachment_events.attachment_id
        and attachment.project_id = project_enquiry_attachment_events.project_id
    )
  );

drop policy if exists project_enquiry_attachment_events_admin_select
  on public.project_enquiry_attachment_events;
create policy project_enquiry_attachment_events_admin_select
  on public.project_enquiry_attachment_events
  for select
  to authenticated
  using ((select public.is_portal_admin()));

create or replace function private.project_enquiry_attachment_validate_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enquiry public.enquiry_requests%rowtype;
begin
  select *
  into v_enquiry
  from public.enquiry_requests
  where id = new.enquiry_request_id;

  if not found
     or v_enquiry.submission_id is distinct from new.submission_id
     or v_enquiry.project_id is distinct from new.project_id then
    raise exception 'project_enquiry_attachment_link_mismatch' using errcode = '23514';
  end if;

  if new.project_id is null then
    new.unlinked_at := coalesce(new.unlinked_at, clock_timestamp());
  else
    new.unlinked_at := null;
  end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

revoke all on function private.project_enquiry_attachment_validate_link()
  from public, anon, authenticated, service_role;

drop trigger if exists project_enquiry_attachments_validate_link
  on public.project_enquiry_attachments;
create trigger project_enquiry_attachments_validate_link
before insert or update of enquiry_request_id, project_id, submission_id
on public.project_enquiry_attachments
for each row execute function private.project_enquiry_attachment_validate_link();

create or replace function private.project_enquiry_attachment_record_link_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.project_enquiry_attachment_events (
      attachment_id,
      enquiry_request_id,
      event_type,
      previous_project_id,
      project_id,
      actor_user_id,
      link_origin
    ) values (
      new.id,
      new.enquiry_request_id,
      case when new.project_id is null then 'unlinked' else 'linked' end,
      null,
      new.project_id,
      null,
      new.link_origin
    );
  elsif old.project_id is distinct from new.project_id then
    insert into public.project_enquiry_attachment_events (
      attachment_id,
      enquiry_request_id,
      event_type,
      previous_project_id,
      project_id,
      actor_user_id,
      link_origin
    ) values (
      new.id,
      new.enquiry_request_id,
      case
        when new.project_id is null then 'unlinked'
        when old.project_id is null then 'linked'
        else 'relinked'
      end,
      old.project_id,
      new.project_id,
      null,
      new.link_origin
    );
  end if;
  return new;
end;
$$;

revoke all on function private.project_enquiry_attachment_record_link_event()
  from public, anon, authenticated, service_role;

drop trigger if exists project_enquiry_attachments_record_link_event
  on public.project_enquiry_attachments;
create trigger project_enquiry_attachments_record_link_event
after insert or update of project_id
on public.project_enquiry_attachments
for each row execute function private.project_enquiry_attachment_record_link_event();

create or replace function private.project_enquiry_attachment_link_new_enquiry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_file record;
begin
  if jsonb_typeof(new.files) is distinct from 'array' then
    raise exception 'invalid_enquiry_attachment_files' using errcode = '22023';
  end if;

  if jsonb_array_length(new.files) > 8
     or exists (
       select 1
       from jsonb_array_elements(new.files) entry
       where nullif(entry->>'path', '') is null
     )
     or coalesce((
       select sum((entry->>'size')::bigint)
       from jsonb_array_elements(new.files) entry
     ), 0) > 20971520 then
    raise exception 'invalid_enquiry_attachment_files' using errcode = '22023';
  end if;

  for v_file in
    select entry, (ordinality - 1)::smallint as file_ordinal
    from jsonb_array_elements(new.files) with ordinality as file(entry, ordinality)
  loop
    if new.project_id is null
       or coalesce(v_file.entry->>'path', '') !~ (
         '^pending/' || new.submission_id::text || '/[0-7]-[A-Za-z0-9._-]{1,160}$'
       )
       or coalesce(v_file.entry->>'name', '') = ''
       or coalesce(v_file.entry->>'type', '') not in (
         'application/pdf', 'image/jpeg', 'image/png', 'image/webp'
       )
       or coalesce((v_file.entry->>'size')::bigint, 0) not between 1 and 20971520
       or not exists (
         select 1
         from storage.objects object
         where object.bucket_id = 'enquiry-attachments'
           and object.name = v_file.entry->>'path'
       ) then
      raise exception 'invalid_or_missing_enquiry_attachment' using errcode = '22023';
    end if;

    insert into public.project_enquiry_attachments (
      enquiry_request_id,
      project_id,
      submission_id,
      file_ordinal,
      storage_bucket,
      storage_path,
      original_filename,
      content_type,
      size_bytes,
      link_origin,
      linked_at,
      created_at,
      updated_at
    ) values (
      new.id,
      new.project_id,
      new.submission_id,
      v_file.file_ordinal,
      'enquiry-attachments',
      v_file.entry->>'path',
      v_file.entry->>'name',
      v_file.entry->>'type',
      (v_file.entry->>'size')::bigint,
      'intake',
      coalesce(new.created_at, clock_timestamp()),
      coalesce(new.created_at, clock_timestamp()),
      clock_timestamp()
    );
  end loop;
  return new;
end;
$$;

revoke all on function private.project_enquiry_attachment_link_new_enquiry()
  from public, anon, authenticated, service_role;

drop trigger if exists enquiry_requests_link_project_attachments
  on public.enquiry_requests;
create trigger enquiry_requests_link_project_attachments
after insert on public.enquiry_requests
for each row execute function private.project_enquiry_attachment_link_new_enquiry();

create or replace function private.project_enquiry_attachment_follow_project()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.project_id is distinct from new.project_id then
    update public.project_enquiry_attachments
    set
      project_id = new.project_id,
      linked_at = case
        when new.project_id is null then linked_at
        else clock_timestamp()
      end,
      unlinked_at = case
        when new.project_id is null then clock_timestamp()
        else null
      end,
      updated_at = clock_timestamp()
    where enquiry_request_id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function private.project_enquiry_attachment_follow_project()
  from public, anon, authenticated, service_role;

drop trigger if exists enquiry_requests_follow_project_attachments
  on public.enquiry_requests;
create trigger enquiry_requests_follow_project_attachments
after update of project_id on public.enquiry_requests
for each row execute function private.project_enquiry_attachment_follow_project();

drop policy if exists enquiry_attachments_staff_signed_read on storage.objects;
create policy enquiry_attachments_staff_signed_read
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'enquiry-attachments'
    and (select public.has_portal_access())
    and exists (
      select 1
      from public.project_enquiry_attachments attachment
      where attachment.storage_bucket = storage.objects.bucket_id
        and attachment.storage_path = storage.objects.name
        and attachment.project_id is not null
    )
  );

create or replace function public.project_enquiry_attachment_backfill_apply(
  p_run_id uuid,
  p_candidates jsonb
)
returns table (
  inserted_count integer,
  existing_count integer,
  replayed boolean,
  payload_hash text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash text;
  v_existing_run public.project_enquiry_attachment_backfill_runs%rowtype;
  v_candidate record;
  v_enquiry public.enquiry_requests%rowtype;
  v_file jsonb;
  v_attachment_id uuid;
  v_inserted integer := 0;
  v_existing integer := 0;
begin
  if p_run_id is null
     or jsonb_typeof(p_candidates) is distinct from 'array'
     or jsonb_array_length(p_candidates) not between 1 and 5000 then
    raise exception 'invalid_attachment_backfill_input' using errcode = '22023';
  end if;

  v_hash := encode(
    extensions.digest(convert_to(p_candidates::text, 'UTF8'), 'sha256'),
    'hex'
  );
  perform pg_advisory_xact_lock(hashtextextended('project-enquiry-attachment-backfill:' || p_run_id::text, 0));

  select *
  into v_existing_run
  from public.project_enquiry_attachment_backfill_runs
  where run_id = p_run_id;

  if found then
    if v_existing_run.payload_hash is distinct from v_hash then
      raise exception 'attachment_backfill_command_conflict' using errcode = '23505';
    end if;
    inserted_count := v_existing_run.inserted_count;
    existing_count := v_existing_run.existing_count;
    replayed := true;
    payload_hash := v_hash;
    return next;
    return;
  end if;

  for v_candidate in
    select value as candidate
    from jsonb_array_elements(p_candidates)
  loop
    select *
    into v_enquiry
    from public.enquiry_requests
    where id = (v_candidate.candidate->>'enquiry_request_id')::uuid
      and project_id = (v_candidate.candidate->>'project_id')::uuid
      and submission_id = (v_candidate.candidate->>'submission_id')::uuid
    for update;

    if not found then
      raise exception 'attachment_backfill_source_changed' using errcode = '40001';
    end if;

    if coalesce((v_candidate.candidate->>'file_ordinal')::integer, -1) not between 0 and 7 then
      raise exception 'attachment_backfill_invalid_ordinal' using errcode = '22023';
    end if;

    v_file := v_enquiry.files -> (v_candidate.candidate->>'file_ordinal')::integer;
    if v_file is null
       or v_file->>'path' is distinct from v_candidate.candidate->>'storage_path'
       or v_file->>'name' is distinct from v_candidate.candidate->>'original_filename'
       or v_file->>'type' is distinct from v_candidate.candidate->>'content_type'
       or (v_file->>'size')::bigint is distinct from (v_candidate.candidate->>'size_bytes')::bigint
       or not exists (
         select 1
         from storage.objects object
         where object.bucket_id = 'enquiry-attachments'
           and object.name = v_candidate.candidate->>'storage_path'
       ) then
      raise exception 'attachment_backfill_source_changed' using errcode = '40001';
    end if;

    v_attachment_id := null;
    insert into public.project_enquiry_attachments (
      enquiry_request_id,
      project_id,
      submission_id,
      file_ordinal,
      storage_bucket,
      storage_path,
      original_filename,
      content_type,
      size_bytes,
      link_origin,
      linked_at,
      created_at,
      updated_at
    ) values (
      v_enquiry.id,
      v_enquiry.project_id,
      v_enquiry.submission_id,
      (v_candidate.candidate->>'file_ordinal')::smallint,
      'enquiry-attachments',
      v_candidate.candidate->>'storage_path',
      v_candidate.candidate->>'original_filename',
      v_candidate.candidate->>'content_type',
      (v_candidate.candidate->>'size_bytes')::bigint,
      'historical_backfill',
      clock_timestamp(),
      coalesce(v_enquiry.created_at, clock_timestamp()),
      clock_timestamp()
    )
    on conflict (storage_bucket, storage_path) do nothing
    returning id into v_attachment_id;

    if v_attachment_id is not null then
      v_inserted := v_inserted + 1;
    elsif exists (
      select 1
      from public.project_enquiry_attachments attachment
      where attachment.storage_bucket = 'enquiry-attachments'
        and attachment.storage_path = v_candidate.candidate->>'storage_path'
        and attachment.enquiry_request_id = v_enquiry.id
        and attachment.project_id = v_enquiry.project_id
        and attachment.submission_id = v_enquiry.submission_id
        and attachment.file_ordinal = (v_candidate.candidate->>'file_ordinal')::smallint
        and attachment.original_filename = v_candidate.candidate->>'original_filename'
        and attachment.content_type = v_candidate.candidate->>'content_type'
        and attachment.size_bytes = (v_candidate.candidate->>'size_bytes')::bigint
    ) then
      v_existing := v_existing + 1;
    else
      raise exception 'attachment_backfill_ambiguous_match' using errcode = '23505';
    end if;
  end loop;

  insert into public.project_enquiry_attachment_backfill_runs (
    run_id,
    payload_hash,
    candidate_count,
    inserted_count,
    existing_count
  ) values (
    p_run_id,
    v_hash,
    jsonb_array_length(p_candidates),
    v_inserted,
    v_existing
  );

  inserted_count := v_inserted;
  existing_count := v_existing;
  replayed := false;
  payload_hash := v_hash;
  return next;
end;
$$;

revoke all on function public.project_enquiry_attachment_backfill_apply(uuid,jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.project_enquiry_attachment_backfill_apply(uuid,jsonb)
  to service_role;
