create table if not exists public.job_pack_sheet_overrides (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  sheet_key text not null,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid null,
  constraint job_pack_sheet_overrides_unique_sheet unique (estimate_id, sheet_key),
  constraint job_pack_sheet_overrides_sheet_key_check
    check (sheet_key in ('powdercoating-order'))
);

create index if not exists job_pack_sheet_overrides_by_estimate
  on public.job_pack_sheet_overrides (estimate_id, sheet_key);

drop trigger if exists job_pack_sheet_overrides_set_updated_at on public.job_pack_sheet_overrides;
create trigger job_pack_sheet_overrides_set_updated_at
before update on public.job_pack_sheet_overrides
for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.job_pack_sheet_overrides to authenticated;

alter table public.job_pack_sheet_overrides enable row level security;

drop policy if exists portal_access_all on public.job_pack_sheet_overrides;
create policy portal_access_all on public.job_pack_sheet_overrides
  for all
  using (public.has_portal_access())
  with check (public.has_portal_access());

notify pgrst, 'reload schema';
