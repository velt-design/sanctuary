create table if not exists public.estimate_cost_actuals (
  estimate_id uuid primary key references public.estimates(id) on delete cascade,
  materials_ex_gst numeric(12, 2) null check (materials_ex_gst >= 0),
  install_ex_gst numeric(12, 2) null check (install_ex_gst >= 0),
  overhead_ex_gst numeric(12, 2) null check (overhead_ex_gst >= 0),
  travel_ex_gst numeric(12, 2) null check (travel_ex_gst >= 0),
  extras_ex_gst numeric(12, 2) null check (extras_ex_gst >= 0),
  crew_hours numeric(10, 2) null check (crew_hours >= 0),
  notes text null,
  is_complete boolean not null default false,
  updated_by uuid not null references auth.users(id),
  updated_by_email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_estimate_cost_actuals_updated_at
  on public.estimate_cost_actuals (updated_at desc);

grant select, insert, update on table public.estimate_cost_actuals to authenticated;

alter table public.estimate_cost_actuals enable row level security;

drop policy if exists estimate_cost_actuals_select on public.estimate_cost_actuals;
create policy estimate_cost_actuals_select on public.estimate_cost_actuals
  for select
  using (public.has_portal_access());

drop policy if exists estimate_cost_actuals_insert on public.estimate_cost_actuals;
create policy estimate_cost_actuals_insert on public.estimate_cost_actuals
  for insert
  with check (public.has_portal_access() and updated_by = auth.uid());

drop policy if exists estimate_cost_actuals_update on public.estimate_cost_actuals;
create policy estimate_cost_actuals_update on public.estimate_cost_actuals
  for update
  using (public.has_portal_access())
  with check (public.has_portal_access() and updated_by = auth.uid());

select pg_notify('pgrst', 'reload schema');
