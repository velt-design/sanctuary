-- Promote Monochrome to a system preset in code and force all saved user themes to Stone Olive.

alter table public.portal_user_theme_settings
  alter column preset_id set default 'stone-olive';

update public.portal_user_theme_settings
set
  preset_id = 'stone-olive',
  user_preset_id = null,
  overrides = '{}'::jsonb,
  updated_at = now()
where
  preset_id is distinct from 'stone-olive'
  or user_preset_id is not null
  or coalesce(overrides, '{}'::jsonb) <> '{}'::jsonb;

delete from public.portal_user_theme_presets
where lower(name) = 'monochrome'
  and tokens = jsonb_build_object(
    'accent', '#333333',
    'text', '#404040',
    'text_muted', '#666666',
    'text_inverse', '#E6E6E6',
    'bg_page', '#D9D9D9',
    'bg_surface', '#F2F2F2',
    'border', '#D1D1D1'
  );

notify pgrst, 'reload schema';
