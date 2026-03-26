create table if not exists public.install_driver_curve_overrides (
  curve_key text primary key,
  points_json jsonb not null,
  updated_by text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if to_regclass('public.set_updated_at') is not null then
    drop trigger if exists install_driver_curve_overrides_set_updated_at on public.install_driver_curve_overrides;
    create trigger install_driver_curve_overrides_set_updated_at before update on public.install_driver_curve_overrides
    for each row execute function public.set_updated_at();
  end if;
end $$;

grant select, insert, update, delete on table public.install_driver_curve_overrides to anon, authenticated;

alter table public.install_driver_curve_overrides enable row level security;

drop policy if exists portal_access_all on public.install_driver_curve_overrides;
create policy portal_access_all on public.install_driver_curve_overrides
  for all
  using (public.has_portal_access())
  with check (public.has_portal_access());

select pg_notify('pgrst', 'reload schema');
