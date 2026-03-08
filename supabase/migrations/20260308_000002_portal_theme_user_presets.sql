-- User-owned portal theme presets + linkage from active theme settings

create table if not exists public.portal_user_theme_presets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  tokens jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.portal_theme_tokens_valid(v jsonb)
returns boolean
language sql
immutable
as $$
  select
    jsonb_typeof(coalesce(v, '{}'::jsonb)) = 'object'
    and (
      select count(*)
      from jsonb_object_keys(coalesce(v, '{}'::jsonb))
    ) = 7
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

alter table public.portal_user_theme_presets
  drop constraint if exists portal_user_theme_presets_tokens_valid;

alter table public.portal_user_theme_presets
  add constraint portal_user_theme_presets_tokens_valid
  check (public.portal_theme_tokens_valid(tokens));

create unique index if not exists portal_user_theme_presets_user_name_unique
  on public.portal_user_theme_presets (user_id, lower(name));

create or replace function public.portal_user_theme_presets_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_portal_user_theme_presets_updated_at on public.portal_user_theme_presets;
create trigger trg_portal_user_theme_presets_updated_at
before update on public.portal_user_theme_presets
for each row execute procedure public.portal_user_theme_presets_touch_updated_at();

grant select, insert, update, delete on public.portal_user_theme_presets to authenticated;

alter table public.portal_user_theme_presets enable row level security;

drop policy if exists portal_theme_presets_select_own on public.portal_user_theme_presets;
create policy portal_theme_presets_select_own on public.portal_user_theme_presets
  for select
  using (user_id = auth.uid());

drop policy if exists portal_theme_presets_insert_own on public.portal_user_theme_presets;
create policy portal_theme_presets_insert_own on public.portal_user_theme_presets
  for insert
  with check (user_id = auth.uid());

drop policy if exists portal_theme_presets_update_own on public.portal_user_theme_presets;
create policy portal_theme_presets_update_own on public.portal_user_theme_presets
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists portal_theme_presets_delete_own on public.portal_user_theme_presets;
create policy portal_theme_presets_delete_own on public.portal_user_theme_presets
  for delete
  using (user_id = auth.uid());

alter table public.portal_user_theme_settings
  add column if not exists user_preset_id uuid;

alter table public.portal_user_theme_settings
  drop constraint if exists portal_user_theme_settings_user_preset_id_fkey;

alter table public.portal_user_theme_settings
  add constraint portal_user_theme_settings_user_preset_id_fkey
  foreign key (user_preset_id)
  references public.portal_user_theme_presets(id)
  on delete set null;

create index if not exists portal_user_theme_settings_user_preset_idx
  on public.portal_user_theme_settings (user_preset_id);

drop policy if exists portal_theme_insert_own on public.portal_user_theme_settings;
create policy portal_theme_insert_own on public.portal_user_theme_settings
  for insert
  with check (
    user_id = auth.uid()
    and (
      user_preset_id is null
      or exists (
        select 1
        from public.portal_user_theme_presets p
        where p.id = user_preset_id
          and p.user_id = auth.uid()
      )
    )
  );

drop policy if exists portal_theme_update_own on public.portal_user_theme_settings;
create policy portal_theme_update_own on public.portal_user_theme_settings
  for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (
      user_preset_id is null
      or exists (
        select 1
        from public.portal_user_theme_presets p
        where p.id = user_preset_id
          and p.user_id = auth.uid()
      )
    )
  );

notify pgrst, 'reload schema';
