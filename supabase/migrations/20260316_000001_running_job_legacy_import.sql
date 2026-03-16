create table if not exists public.running_job_legacy_import_batches (
  id uuid primary key default gen_random_uuid(),
  source_filename text not null,
  source_sheet_name text not null,
  source_file_sha256 text null,
  imported_row_count integer not null default 0 check (imported_row_count >= 0),
  matched_row_count integer not null default 0 check (matched_row_count >= 0),
  visible_row_count integer not null default 0 check (visible_row_count >= 0),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists running_job_legacy_import_batches_set_updated_at on public.running_job_legacy_import_batches;
create trigger running_job_legacy_import_batches_set_updated_at
before update on public.running_job_legacy_import_batches
for each row execute function public.set_updated_at();

create unique index if not exists running_job_legacy_import_batches_one_active_idx
  on public.running_job_legacy_import_batches (is_active)
  where is_active = true;

grant select, insert, update, delete on public.running_job_legacy_import_batches to authenticated;

alter table public.running_job_legacy_import_batches enable row level security;

drop policy if exists portal_access_all on public.running_job_legacy_import_batches;
create policy portal_access_all on public.running_job_legacy_import_batches
  for all
  using (public.has_portal_access())
  with check (public.has_portal_access());

create table if not exists public.running_job_legacy_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.running_job_legacy_import_batches(id) on delete cascade,
  source_row_number integer not null check (source_row_number > 0),
  raw_cells jsonb not null,
  display_cells jsonb not null,
  normalized_client_name text null,
  normalized_phone text null,
  normalized_address text null,
  group_year integer null check (group_year is null or group_year between 2000 and 2100),
  sort_date date null,
  match_status text not null default 'unmatched' check (match_status in ('unmatched', 'matched_live')),
  matched_project_id uuid null references public.projects(id) on delete set null,
  match_method text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint running_job_legacy_rows_unique_source_row unique (batch_id, source_row_number)
);

drop trigger if exists running_job_legacy_rows_set_updated_at on public.running_job_legacy_rows;
create trigger running_job_legacy_rows_set_updated_at
before update on public.running_job_legacy_rows
for each row execute function public.set_updated_at();

create index if not exists running_job_legacy_rows_batch_match_idx
  on public.running_job_legacy_rows (batch_id, match_status, source_row_number);

create index if not exists running_job_legacy_rows_matched_project_idx
  on public.running_job_legacy_rows (matched_project_id);

grant select, insert, update, delete on public.running_job_legacy_rows to authenticated;

alter table public.running_job_legacy_rows enable row level security;

drop policy if exists portal_access_all on public.running_job_legacy_rows;
create policy portal_access_all on public.running_job_legacy_rows
  for all
  using (public.has_portal_access())
  with check (public.has_portal_access());

notify pgrst, 'reload schema';
