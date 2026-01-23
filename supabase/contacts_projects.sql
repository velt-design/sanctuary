-- Supabase schema for Contacts + Projects.
-- Note: `gen_random_uuid()` requires `pgcrypto`.

create extension if not exists pgcrypto;

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  address text,
  created_at timestamptz default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts(id),
  name text not null,
  site_address text,
  pipeline_stage text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Compatibility columns for the existing portal codebase.
alter table public.contacts add column if not exists updated_at timestamptz default now();
alter table public.contacts add column if not exists data jsonb not null default '{}'::jsonb;

alter table public.projects add column if not exists version int not null default 1;
alter table public.projects add column if not exists data jsonb not null default '{}'::jsonb;

-- Permissions for the anon/authenticated roles (so the portal can use the anon key).
-- SECURITY NOTE: This makes these tables accessible to anyone with your anon key unless you enable RLS.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.contacts to anon, authenticated;
grant select, insert, update, delete on public.projects to anon, authenticated;
grant references on public.contacts to anon, authenticated;

-- Recommended for production: enable RLS and use `SUPABASE_SERVICE_ROLE_KEY` in server-side API routes.
-- alter table public.contacts enable row level security;
-- alter table public.projects enable row level security;

-- Prompt PostgREST to refresh its schema cache after DDL changes.
notify pgrst, 'reload schema';
