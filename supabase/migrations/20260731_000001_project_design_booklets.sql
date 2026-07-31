-- One active customer design booklet per project, with private project-scoped
-- image assets and generated PDF exports.

create table if not exists public.project_design_booklets (
  project_id uuid primary key references public.projects(id) on delete cascade,
  draft jsonb not null,
  revision bigint not null default 1 check (revision > 0),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_design_booklet_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  asset_key text not null,
  storage_path text not null unique,
  file_name text not null,
  media_type text not null check (media_type in ('image/jpeg', 'image/png')),
  byte_size integer not null check (byte_size > 0),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_design_booklet_assets_project_key_unique
    unique (project_id, asset_key),
  constraint project_design_booklet_assets_key_format
    check (
      char_length(asset_key) between 1 and 120
      and asset_key ~ '^[A-Za-z0-9][A-Za-z0-9._-]*$'
    )
);

create index if not exists project_design_booklet_assets_project_updated
  on public.project_design_booklet_assets (project_id, updated_at desc);

drop trigger if exists project_design_booklets_set_updated_at
  on public.project_design_booklets;
create trigger project_design_booklets_set_updated_at
before update on public.project_design_booklets
for each row execute function public.set_updated_at();

drop trigger if exists project_design_booklet_assets_set_updated_at
  on public.project_design_booklet_assets;
create trigger project_design_booklet_assets_set_updated_at
before update on public.project_design_booklet_assets
for each row execute function public.set_updated_at();

grant select, insert, update, delete
  on table public.project_design_booklets to authenticated;
grant select, insert, update, delete
  on table public.project_design_booklet_assets to authenticated;

alter table public.project_design_booklets enable row level security;
alter table public.project_design_booklet_assets enable row level security;

drop policy if exists project_design_booklets_staff_all
  on public.project_design_booklets;
create policy project_design_booklets_staff_all
  on public.project_design_booklets
  for all
  to authenticated
  using ((select public.has_portal_access()))
  with check ((select public.has_portal_access()));

drop policy if exists project_design_booklet_assets_staff_all
  on public.project_design_booklet_assets;
create policy project_design_booklet_assets_staff_all
  on public.project_design_booklet_assets
  for all
  to authenticated
  using ((select public.has_portal_access()))
  with check ((select public.has_portal_access()));

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'design-booklet-assets',
  'design-booklet-assets',
  false,
  20971520,
  array['image/jpeg', 'image/png', 'application/pdf']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists design_booklet_storage_staff_select
  on storage.objects;
create policy design_booklet_storage_staff_select
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'design-booklet-assets'
    and (select public.has_portal_access())
    and exists (
      select 1
      from public.projects
      where projects.id::text = split_part(storage.objects.name, '/', 1)
    )
  );

drop policy if exists design_booklet_storage_staff_insert
  on storage.objects;
create policy design_booklet_storage_staff_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'design-booklet-assets'
    and (select public.has_portal_access())
    and exists (
      select 1
      from public.projects
      where projects.id::text = split_part(storage.objects.name, '/', 1)
    )
  );

drop policy if exists design_booklet_storage_staff_update
  on storage.objects;
create policy design_booklet_storage_staff_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'design-booklet-assets'
    and (select public.has_portal_access())
    and exists (
      select 1
      from public.projects
      where projects.id::text = split_part(storage.objects.name, '/', 1)
    )
  )
  with check (
    bucket_id = 'design-booklet-assets'
    and (select public.has_portal_access())
    and exists (
      select 1
      from public.projects
      where projects.id::text = split_part(storage.objects.name, '/', 1)
    )
  );

drop policy if exists design_booklet_storage_staff_delete
  on storage.objects;
create policy design_booklet_storage_staff_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'design-booklet-assets'
    and (select public.has_portal_access())
    and exists (
      select 1
      from public.projects
      where projects.id::text = split_part(storage.objects.name, '/', 1)
    )
  );

comment on table public.project_design_booklets is
  'One active Design Booklet Workbench draft per project.';
comment on table public.project_design_booklet_assets is
  'Private image metadata for project Design Booklet Workbench drafts.';
comment on column public.project_design_booklets.revision is
  'Optimistic concurrency revision supplied by the project booklet API.';

notify pgrst, 'reload schema';
