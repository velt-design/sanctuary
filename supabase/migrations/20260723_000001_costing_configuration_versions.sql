create table public.costing_configuration_versions (
  id uuid primary key default gen_random_uuid(),
  version_number bigint generated always as identity unique,
  status text not null default 'draft' check (status in ('draft', 'published')),
  schema_version text not null check (length(schema_version) between 1 and 100),
  base_manifest_version text not null check (length(base_manifest_version) between 1 and 100),
  based_on_version_id uuid null references public.costing_configuration_versions(id) on delete restrict,
  config_json jsonb not null check (jsonb_typeof(config_json) = 'object'),
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_by_email text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid not null references auth.users(id) on delete restrict,
  updated_by_email text not null,
  published_at timestamptz null,
  published_by uuid null references auth.users(id) on delete restrict,
  published_by_email text null,
  publish_note text null,
  publication_diff jsonb null,
  publication_impact jsonb null,
  constraint costing_configuration_published_metadata check (
    (
      status = 'draft'
      and published_at is null
      and published_by is null
      and published_by_email is null
      and publish_note is null
      and publication_diff is null
      and publication_impact is null
    )
    or
    (
      status = 'published'
      and published_at is not null
      and published_by is not null
      and published_by_email is not null
      and publish_note is not null
      and publication_diff is not null
      and publication_impact is not null
    )
  )
);

create index costing_configuration_versions_status_created_idx
  on public.costing_configuration_versions (status, created_at desc);

create table public.costing_configuration_publication (
  singleton boolean primary key default true check (singleton),
  current_version_id uuid not null references public.costing_configuration_versions(id) on delete restrict,
  published_at timestamptz not null,
  published_by uuid not null references auth.users(id) on delete restrict,
  published_by_email text not null
);

create table public.costing_configuration_audit_events (
  id bigint generated always as identity primary key,
  event_type text not null check (event_type = 'version.published'),
  version_id uuid not null references public.costing_configuration_versions(id) on delete restrict,
  actor_id uuid not null references auth.users(id) on delete restrict,
  actor_email text not null,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object')
);

create index costing_configuration_audit_version_occurred_idx
  on public.costing_configuration_audit_events (version_id, occurred_at desc);

alter table public.estimates
  add column costing_config_version_id uuid null
    references public.costing_configuration_versions(id) on delete restrict;

create index estimates_costing_config_version_idx
  on public.estimates (costing_config_version_id)
  where costing_config_version_id is not null;

create or replace function public.guard_costing_configuration_version_immutability()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.status = 'published' then
    raise exception 'published costing configuration versions are immutable' using errcode = '55000';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  if new.status = 'published'
    and coalesce(current_setting('app.costing_configuration_publish', true), '') <> 'enabled'
  then
    raise exception 'costing configuration versions must be published through the publish function'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger guard_costing_configuration_version_immutability
before update or delete on public.costing_configuration_versions
for each row execute function public.guard_costing_configuration_version_immutability();

create or replace function public.guard_estimate_costing_configuration_provenance()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.costing_config_version_id is not null
    and not exists (
      select 1
      from public.costing_configuration_versions versions
      where versions.id = new.costing_config_version_id
        and versions.status = 'published'
    )
  then
    raise exception 'estimate costing provenance must reference a published configuration version'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger guard_estimate_costing_configuration_provenance
before insert or update of costing_config_version_id on public.estimates
for each row execute function public.guard_estimate_costing_configuration_provenance();

create or replace function public.publish_costing_configuration_version(
  p_version_id uuid,
  p_expected_current_version_id uuid,
  p_expected_content_hash text,
  p_publish_note text,
  p_publication_diff jsonb,
  p_publication_impact jsonb
)
returns public.costing_configuration_versions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_email text;
  current_version_id uuid;
  draft public.costing_configuration_versions;
  published public.costing_configuration_versions;
begin
  if not public.is_portal_admin() then
    raise exception 'portal admin access required' using errcode = '42501';
  end if;

  if p_publish_note is null or length(trim(p_publish_note)) < 3 or length(p_publish_note) > 1000 then
    raise exception 'publish note must contain between 3 and 1000 characters' using errcode = '22023';
  end if;
  if p_expected_content_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'expected content hash is invalid' using errcode = '22023';
  end if;
  if jsonb_typeof(p_publication_diff) <> 'array' or jsonb_typeof(p_publication_impact) <> 'array' then
    raise exception 'publication diff and impact must be arrays' using errcode = '22023';
  end if;

  actor_email := coalesce(auth.jwt() ->> 'email', '');
  if actor_email = '' then
    raise exception 'authenticated actor email is required' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtext('costing_configuration_publication'));

  select publication.current_version_id
    into current_version_id
  from public.costing_configuration_publication publication
  where publication.singleton = true;

  if current_version_id is distinct from p_expected_current_version_id then
    raise exception 'published costing configuration changed; refresh the comparison before publishing'
      using errcode = '40001';
  end if;

  select *
    into draft
  from public.costing_configuration_versions versions
  where versions.id = p_version_id
  for update;

  if not found then
    raise exception 'costing configuration draft not found' using errcode = 'P0002';
  end if;
  if draft.status <> 'draft' then
    raise exception 'only draft costing configurations can be published' using errcode = '55000';
  end if;
  if draft.content_hash <> p_expected_content_hash then
    raise exception 'costing configuration draft changed; validate it again before publishing'
      using errcode = '40001';
  end if;

  perform set_config('app.costing_configuration_publish', 'enabled', true);

  update public.costing_configuration_versions
  set
    status = 'published',
    updated_at = now(),
    updated_by = auth.uid(),
    updated_by_email = actor_email,
    published_at = now(),
    published_by = auth.uid(),
    published_by_email = actor_email,
    publish_note = trim(p_publish_note),
    publication_diff = p_publication_diff,
    publication_impact = p_publication_impact
  where id = p_version_id
  returning * into published;

  insert into public.costing_configuration_publication (
    singleton,
    current_version_id,
    published_at,
    published_by,
    published_by_email
  )
  values (true, published.id, published.published_at, auth.uid(), actor_email)
  on conflict (singleton) do update
  set
    current_version_id = excluded.current_version_id,
    published_at = excluded.published_at,
    published_by = excluded.published_by,
    published_by_email = excluded.published_by_email;

  insert into public.costing_configuration_audit_events (
    event_type,
    version_id,
    actor_id,
    actor_email,
    metadata
  )
  values (
    'version.published',
    published.id,
    auth.uid(),
    actor_email,
    jsonb_build_object(
      'previous_version_id', current_version_id,
      'content_hash', published.content_hash,
      'publish_note', published.publish_note,
      'diff', p_publication_diff,
      'impact', p_publication_impact
    )
  );

  return published;
end;
$$;

alter table public.costing_configuration_versions enable row level security;
alter table public.costing_configuration_publication enable row level security;
alter table public.costing_configuration_audit_events enable row level security;

create policy costing_configuration_versions_staff_read_published
  on public.costing_configuration_versions
  for select
  using (
    (status = 'published' and public.has_portal_access())
    or public.is_portal_admin()
  );

create policy costing_configuration_versions_admin_insert_draft
  on public.costing_configuration_versions
  for insert
  with check (
    public.is_portal_admin()
    and status = 'draft'
    and created_by = auth.uid()
    and updated_by = auth.uid()
  );

create policy costing_configuration_versions_admin_update_draft
  on public.costing_configuration_versions
  for update
  using (public.is_portal_admin() and status = 'draft')
  with check (
    public.is_portal_admin()
    and status = 'draft'
    and updated_by = auth.uid()
  );

create policy costing_configuration_publication_staff_read
  on public.costing_configuration_publication
  for select
  using (public.has_portal_access());

create policy costing_configuration_audit_admin_read
  on public.costing_configuration_audit_events
  for select
  using (public.is_portal_admin());

grant select, insert, update on public.costing_configuration_versions to authenticated;
grant select on public.costing_configuration_publication to authenticated;
grant select on public.costing_configuration_audit_events to authenticated;
grant usage, select on sequence public.costing_configuration_versions_version_number_seq to authenticated;
grant usage, select on sequence public.costing_configuration_audit_events_id_seq to authenticated;

revoke all on function public.publish_costing_configuration_version(uuid, uuid, text, text, jsonb, jsonb)
  from public, anon;
grant execute on function public.publish_costing_configuration_version(uuid, uuid, text, text, jsonb, jsonb)
  to authenticated;

select pg_notify('pgrst', 'reload schema');
