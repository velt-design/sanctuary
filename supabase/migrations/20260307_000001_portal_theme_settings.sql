-- Per-user portal theme settings (preset + manual overrides)

create table if not exists public.portal_user_theme_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preset_id text not null default 'sanctuary-burgundy',
  overrides jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.portal_theme_overrides_valid(v jsonb)
returns boolean
language sql
immutable
as $$
  select
    jsonb_typeof(coalesce(v, '{}'::jsonb)) = 'object'
    and not exists (
      select 1
      from jsonb_object_keys(coalesce(v, '{}'::jsonb)) as k(key)
      where k.key not in (
        'accent',
        'text',
        'text_muted',
        'text_inverse',
        'bg_page',
        'bg_surface',
        'border'
      )
    )
    and not exists (
      select 1
      from jsonb_each_text(coalesce(v, '{}'::jsonb)) as e(key, val)
      where e.val !~ '^#[0-9A-Fa-f]{6}$'
    );
$$;

alter table public.portal_user_theme_settings
  drop constraint if exists portal_user_theme_settings_overrides_valid;

alter table public.portal_user_theme_settings
  add constraint portal_user_theme_settings_overrides_valid
  check (public.portal_theme_overrides_valid(overrides));

create or replace function public.portal_user_theme_settings_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_portal_user_theme_settings_updated_at on public.portal_user_theme_settings;
create trigger trg_portal_user_theme_settings_updated_at
before update on public.portal_user_theme_settings
for each row execute procedure public.portal_user_theme_settings_touch_updated_at();

grant select, insert, update on public.portal_user_theme_settings to authenticated;

alter table public.portal_user_theme_settings enable row level security;

drop policy if exists portal_theme_select_own on public.portal_user_theme_settings;
create policy portal_theme_select_own on public.portal_user_theme_settings
  for select
  using (user_id = auth.uid());

drop policy if exists portal_theme_insert_own on public.portal_user_theme_settings;
create policy portal_theme_insert_own on public.portal_user_theme_settings
  for insert
  with check (user_id = auth.uid());

drop policy if exists portal_theme_update_own on public.portal_user_theme_settings;
create policy portal_theme_update_own on public.portal_user_theme_settings
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

notify pgrst, 'reload schema';

