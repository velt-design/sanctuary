create extension if not exists pg_cron with schema extensions;

create table if not exists public.portal_performance_metrics (
  id bigint generated always as identity primary key,
  captured_at timestamptz not null default now(),
  metric_name text not null check (metric_name in ('CLS', 'FCP', 'INP', 'LCP', 'TTFB')),
  metric_value double precision not null check (metric_value >= 0 and metric_value <= 600000),
  rating text not null check (rating in ('good', 'needs-improvement', 'poor')),
  route_template text not null check (route_template in (
    '/dashboard',
    '/staff/projects',
    '/staff/projects/[projectId]',
    '/staff/projects/[projectId]/design-workbench',
    '/staff/projects/design-packages',
    '/staff/projects/running-jobs',
    '/staff/contacts',
    '/staff/contacts/[contactId]',
    '/staff/schedule',
    '/staff/calculator',
    '/admin'
  )),
  navigation_type text not null check (navigation_type in (
    'navigate', 'reload', 'back-forward', 'back-forward-cache', 'prerender', 'restore'
  )),
  device_class text not null check (device_class in ('desktop', 'tablet', 'mobile')),
  build_id text null check (build_id is null or build_id ~ '^[a-zA-Z0-9._-]{1,128}$')
);

create index if not exists portal_performance_metrics_route_metric_captured_idx
  on public.portal_performance_metrics(route_template, metric_name, captured_at desc);
create index if not exists portal_performance_metrics_captured_idx
  on public.portal_performance_metrics(captured_at);

alter table public.portal_performance_metrics enable row level security;

grant insert, select on table public.portal_performance_metrics to authenticated;
grant usage, select on sequence public.portal_performance_metrics_id_seq to authenticated;

drop policy if exists portal_performance_metrics_staff_insert on public.portal_performance_metrics;
create policy portal_performance_metrics_staff_insert
  on public.portal_performance_metrics
  for insert
  with check (public.has_portal_access());

drop policy if exists portal_performance_metrics_admin_select on public.portal_performance_metrics;
create policy portal_performance_metrics_admin_select
  on public.portal_performance_metrics
  for select
  using (public.is_portal_admin());

create or replace function public.portal_performance_summary(p_days integer default 7)
returns table (
  route_template text,
  metric_name text,
  sample_count bigint,
  p75 double precision,
  p95 double precision,
  poor_count bigint
)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
begin
  if p_days not in (7, 30) then
    raise exception 'p_days must be 7 or 30' using errcode = '22023';
  end if;
  if not public.is_portal_admin() then
    raise exception 'portal admin access required' using errcode = '42501';
  end if;

  return query
  select
    metrics.route_template,
    metrics.metric_name,
    count(*)::bigint,
    percentile_cont(0.75) within group (order by metrics.metric_value)::double precision,
    percentile_cont(0.95) within group (order by metrics.metric_value)::double precision,
    count(*) filter (where metrics.rating = 'poor')::bigint
  from public.portal_performance_metrics metrics
  where metrics.captured_at >= now() - make_interval(days => p_days)
  group by metrics.route_template, metrics.metric_name
  order by metrics.route_template, metrics.metric_name;
end;
$$;

revoke all on function public.portal_performance_summary(integer) from public;
grant execute on function public.portal_performance_summary(integer) to authenticated;

create or replace function public.purge_portal_performance_metrics()
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  deleted_count bigint;
begin
  delete from public.portal_performance_metrics
  where captured_at < now() - interval '30 days';
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.purge_portal_performance_metrics() from public, anon, authenticated;

select cron.schedule(
  'portal-performance-retention-daily',
  '17 3 * * *',
  $cron$select public.purge_portal_performance_metrics();$cron$
);

notify pgrst, 'reload schema';
