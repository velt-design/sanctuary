create extension if not exists "pgcrypto";

-- MATERIAL COST OVERRIDES (admin-only edits)
create table if not exists public.material_cost_overrides (
  material_id text primary key,
  cost_ex_gst_cents integer not null,
  updated_by text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if to_regclass('public.set_updated_at') is not null then
    drop trigger if exists material_cost_overrides_set_updated_at on public.material_cost_overrides;
    create trigger material_cost_overrides_set_updated_at before update on public.material_cost_overrides
    for each row execute function public.set_updated_at();
  end if;
end $$;

-- INSTALL ACTION MINUTES OVERRIDES (admin-only edits)
create table if not exists public.install_action_minutes_overrides (
  action_id text primary key,
  base_minutes integer not null,
  updated_by text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if to_regclass('public.set_updated_at') is not null then
    drop trigger if exists install_action_minutes_overrides_set_updated_at on public.install_action_minutes_overrides;
    create trigger install_action_minutes_overrides_set_updated_at before update on public.install_action_minutes_overrides
    for each row execute function public.set_updated_at();
  end if;
end $$;

-- DRIVER CURVE OVERRIDES (admin-only edits)
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

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table public.material_cost_overrides to anon, authenticated;
grant select, insert, update, delete on table public.install_action_minutes_overrides to anon, authenticated;
grant select, insert, update, delete on table public.install_driver_curve_overrides to anon, authenticated;

select pg_notify('pgrst', 'reload schema');
