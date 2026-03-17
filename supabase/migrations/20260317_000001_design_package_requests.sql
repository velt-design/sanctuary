create table if not exists public.design_package_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  estimate_id uuid null references public.estimates(id) on delete set null,
  request_version integer not null check (request_version > 0),
  status text not null default 'OPEN'
    check (status in ('OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED', 'BLOCKED')),
  priority_tier text not null
    check (priority_tier in ('TIER_1', 'TIER_2', 'TIER_3', 'TIER_4', 'UNPRICED')),
  price_total_inc_gst_cents integer null
    check (price_total_inc_gst_cents is null or price_total_inc_gst_cents >= 0),
  request_source text not null
    check (request_source in ('calculator_generate', 'estimates_tab', 'legacy_backfill')),
  request_note text null,
  designer_note text null,
  assigned_designer uuid null,
  due_at timestamptz null,
  requested_at timestamptz not null default now(),
  started_at timestamptz null,
  completed_at timestamptz null,
  cancelled_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint design_package_requests_unique_version unique (project_id, request_version),
  constraint design_package_requests_estimate_required_nonlegacy
    check (request_source = 'legacy_backfill' or estimate_id is not null),
  constraint design_package_requests_request_note_len
    check (request_note is null or char_length(request_note) <= 4000),
  constraint design_package_requests_designer_note_len
    check (designer_note is null or char_length(designer_note) <= 4000)
);

create index if not exists design_package_requests_by_project_requested_at
  on public.design_package_requests (project_id, requested_at desc);

create index if not exists design_package_requests_by_status_tier_due
  on public.design_package_requests (status, priority_tier, due_at);

create index if not exists design_package_requests_by_estimate
  on public.design_package_requests (estimate_id);

create unique index if not exists design_package_requests_one_active_per_project
  on public.design_package_requests (project_id)
  where status in ('OPEN', 'IN_PROGRESS', 'BLOCKED');

drop trigger if exists design_package_requests_set_updated_at on public.design_package_requests;
create trigger design_package_requests_set_updated_at
before update on public.design_package_requests
for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.design_package_requests to authenticated;

alter table public.design_package_requests enable row level security;

drop policy if exists portal_access_all on public.design_package_requests;
create policy portal_access_all on public.design_package_requests
  for all
  using (public.has_portal_access())
  with check (public.has_portal_access());

insert into public.design_package_requests (
  id,
  project_id,
  estimate_id,
  request_version,
  status,
  priority_tier,
  price_total_inc_gst_cents,
  request_source,
  request_note,
  designer_note,
  assigned_designer,
  due_at,
  requested_at,
  started_at,
  completed_at,
  cancelled_at,
  created_at,
  updated_at
)
select
  t.id,
  t.project_id,
  null,
  1,
  t.status,
  t.tier,
  null,
  'legacy_backfill',
  t.notes,
  null,
  t.assigned_designer,
  t.due_at,
  coalesce(t.created_at, now()),
  case when t.status = 'IN_PROGRESS' then coalesce(t.created_at, now()) else null end,
  t.completed_at,
  null,
  coalesce(t.created_at, now()),
  coalesce(t.completed_at, t.created_at, now())
from public.design_package_tickets t
where not exists (
  select 1
  from public.design_package_requests r
  where r.id = t.id
     or (r.project_id = t.project_id and r.request_version = 1)
);

notify pgrst, 'reload schema';
