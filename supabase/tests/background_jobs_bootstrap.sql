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
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- CREATE TABLE IF NOT EXISTS still checks CREATE on the schema before it can
-- report that the Supabase image's protected relation already exists.
do $$
begin
  if to_regclass('auth.users') is null then
    execute 'create table auth.users (id uuid primary key)';
  end if;
end;
$$;

create table if not exists public.projects (
  id uuid primary key
);
