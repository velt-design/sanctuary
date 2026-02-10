alter table projects
  add column if not exists site_visit_priority_tier smallint null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'projects_site_visit_priority_tier_check'
  ) then
    alter table projects
      add constraint projects_site_visit_priority_tier_check
      check (site_visit_priority_tier is null or site_visit_priority_tier in (1,2));
  end if;
end $$;
