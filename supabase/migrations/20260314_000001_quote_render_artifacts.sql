alter table if exists public.quote_versions
  add column if not exists render_hash text,
  add column if not exists preview_base_payload jsonb,
  add column if not exists preview_rendered_at timestamptz;

create index if not exists quote_versions_render_hash_idx
  on public.quote_versions (render_hash);

notify pgrst, 'reload schema';
