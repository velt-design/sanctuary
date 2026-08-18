-- Minimal isolated prerequisites for the Sanctuary AI task-ledger contract.
-- Test-only bootstrap: this is not a production migration.

do $$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end;
$$;

create schema if not exists auth;

do $$
begin
  if to_regclass('auth.users') is null then
    execute 'create table auth.users (id uuid primary key)';
  end if;
end;
$$;

do $bootstrap$
begin
  if to_regprocedure('auth.uid()') is null then
    execute $function$
      create function auth.uid()
      returns uuid
      language sql
      stable
      set search_path = pg_catalog
      as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
      $$
    $function$;
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;
  end if;
end;
$bootstrap$;

create table if not exists public.portal_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'staff')),
  is_active boolean not null default true
);

create table if not exists public.projects (
  id uuid primary key
);

grant select on table public.projects to authenticated;

create or replace function public.has_portal_access()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.portal_users portal_user
    where portal_user.user_id = auth.uid()
      and portal_user.is_active
  );
$$;

create or replace function public.is_portal_admin()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.portal_users portal_user
    where portal_user.user_id = auth.uid()
      and portal_user.role = 'admin'
      and portal_user.is_active
  );
$$;

revoke all on function public.has_portal_access() from public, anon, service_role;
revoke all on function public.is_portal_admin() from public, anon, service_role;
grant execute on function public.has_portal_access() to authenticated;
grant execute on function public.is_portal_admin() to authenticated;
