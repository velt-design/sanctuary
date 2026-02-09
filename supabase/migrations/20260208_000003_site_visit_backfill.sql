do $$
declare
  has_site_visits boolean;
  has_archived_at boolean;
begin
  select to_regclass('public.site_visit_events') is not null into has_site_visits;
  if not has_site_visits then
    return;
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'projects'
      and column_name = 'archived_at'
  ) into has_archived_at;

  if has_archived_at then
    insert into public.site_visit_events (project_id, status, created_at, updated_at)
    select p.id, 'UNSCHEDULED', now(), now()
    from public.projects p
    where p.archived_at is null
      and lower(regexp_replace(p.pipeline_stage, '[^a-z0-9]+', '_', 'g')) in ('site_visit', 'site_visits', 'sitevisit')
      and not exists (
        select 1 from public.site_visit_events s where s.project_id = p.id
      );
  else
    insert into public.site_visit_events (project_id, status, created_at, updated_at)
    select p.id, 'UNSCHEDULED', now(), now()
    from public.projects p
    where lower(regexp_replace(p.pipeline_stage, '[^a-z0-9]+', '_', 'g')) in ('site_visit', 'site_visits', 'sitevisit')
      and not exists (
        select 1 from public.site_visit_events s where s.project_id = p.id
      );
  end if;
end $$;
