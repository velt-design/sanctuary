create table if not exists public.project_notes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  author_email text not null,
  author_display_name text null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

create index if not exists idx_project_notes_project_id_created_at
  on public.project_notes (project_id, created_at desc);

create index if not exists idx_project_notes_author_id
  on public.project_notes (author_id);

grant select, insert, update, delete on table public.project_notes to authenticated;

alter table public.project_notes enable row level security;

drop policy if exists project_notes_select on public.project_notes;
create policy project_notes_select on public.project_notes
  for select
  using (public.has_portal_access());

drop policy if exists project_notes_insert on public.project_notes;
create policy project_notes_insert on public.project_notes
  for insert
  with check (public.has_portal_access() and author_id = auth.uid());

drop policy if exists project_notes_update on public.project_notes;
create policy project_notes_update on public.project_notes
  for update
  using (public.has_portal_access() and (author_id = auth.uid() or public.is_portal_admin()))
  with check (public.has_portal_access() and (author_id = auth.uid() or public.is_portal_admin()));

drop policy if exists project_notes_delete on public.project_notes;
create policy project_notes_delete on public.project_notes
  for delete
  using (public.has_portal_access() and (author_id = auth.uid() or public.is_portal_admin()));

select pg_notify('pgrst', 'reload schema');
