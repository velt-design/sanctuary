begin;

-- Repair the two project relationships used to classify V2 work safely when
-- an environment received a partial/idempotent table create, then force the
-- PostgREST schema cache reload after the DDL transaction has committed.
do $repair$
begin
  if to_regclass('public.project_work_model_versions') is null then
    raise exception 'project_work_model_versions is missing; apply 20260729_000002 first';
  end if;
  if to_regclass('public.project_operational_states') is null then
    raise exception 'project_operational_states is missing; apply 20260729_000002 first';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where contype = 'f'
      and conrelid = 'public.project_work_model_versions'::regclass
      and confrelid = 'public.projects'::regclass
  ) then
    alter table public.project_work_model_versions
      add constraint project_work_model_versions_project_id_fkey
      foreign key (project_id) references public.projects(id) on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where contype = 'f'
      and conrelid = 'public.project_operational_states'::regclass
      and confrelid = 'public.projects'::regclass
  ) then
    alter table public.project_operational_states
      add constraint project_operational_states_project_id_fkey
      foreign key (project_id) references public.projects(id) on delete cascade;
  end if;
end
$repair$;

commit;

-- Keep this outside the DDL transaction. Some hosted PostgREST deployments
-- did not observe the original transaction-scoped cache notification.
notify pgrst, 'reload schema';
