-- Adds missing optional columns used by the portal UI/API.
-- Safe to run multiple times.

do $$
begin
  if to_regclass('public.projects') is null then
    raise exception 'public.projects does not exist. Run supabase/portal_schema.sql first.';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='projects' and column_name='region'
  ) then
    alter table public.projects add column region text;
  end if;
end $$;

select pg_notify('pgrst', 'reload schema');

