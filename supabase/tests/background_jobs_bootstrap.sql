-- Minimal isolated prerequisites for the Wave 3 background-job database tests.
-- This is test-only bootstrap, not a production migration. The repository's
-- historical migration chain depends on legacy baseline objects, so the
-- background-job contract runs against only the objects it actually needs.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end;
$$;

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key
);

create table if not exists public.projects (
  id uuid primary key
);

-- The Supabase Postgres image deliberately owns auth with its internal admin
-- role. The isolated harness may therefore create these two stub relations as
-- supabase_admin, but all migrations and assertions still execute as postgres.
grant all privileges on table auth.users to postgres;
grant all privileges on table public.projects to postgres;
