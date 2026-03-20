create table if not exists public.job_pack_generations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  quote_version_id uuid not null references public.quote_versions(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by text
);

create unique index if not exists job_pack_generations_quote_version_id_key
  on public.job_pack_generations (quote_version_id);

create index if not exists job_pack_generations_project_id_idx
  on public.job_pack_generations (project_id, created_at desc);

create index if not exists job_pack_generations_estimate_id_idx
  on public.job_pack_generations (estimate_id, created_at desc);

notify pgrst, 'reload schema';
