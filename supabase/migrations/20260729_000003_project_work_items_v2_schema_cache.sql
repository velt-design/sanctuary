begin;

-- Repair the two project relationships used to classify V2 work safely when
-- an environment received a partial/idempotent table create, then force the
-- PostgREST schema cache reload after the DDL transaction has committed.
do $repair$
declare
  constraint_name text;
begin
  if to_regclass('public.project_work_model_versions') is null then
    raise exception 'project_work_model_versions is missing; apply 20260729_000002 first';
  end if;
  if to_regclass('public.project_operational_states') is null then
    raise exception 'project_operational_states is missing; apply 20260729_000002 first';
  end if;

  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.project_work_model_versions'::regclass
      and conname = 'project_work_model_versions_project_id_fkey'
      and not (
        contype = 'f'
        and confrelid = 'public.projects'::regclass
        and conkey = array[
          (
            select attnum
            from pg_attribute
            where attrelid = 'public.project_work_model_versions'::regclass
              and attname = 'project_id'
              and not attisdropped
          )
        ]::smallint[]
        and confkey = array[
          (
            select attnum
            from pg_attribute
            where attrelid = 'public.projects'::regclass
              and attname = 'id'
              and not attisdropped
          )
        ]::smallint[]
        and confdeltype = 'c'
      )
  ) then
    alter table public.project_work_model_versions
      drop constraint project_work_model_versions_project_id_fkey;
  end if;

  for constraint_name in
    select conname
    from pg_constraint
    where contype = 'f'
      and conrelid = 'public.project_work_model_versions'::regclass
      and confrelid = 'public.projects'::regclass
      and conkey = array[
        (
          select attnum
          from pg_attribute
          where attrelid = 'public.project_work_model_versions'::regclass
            and attname = 'project_id'
            and not attisdropped
        )
      ]::smallint[]
      and confkey = array[
        (
          select attnum
          from pg_attribute
          where attrelid = 'public.projects'::regclass
            and attname = 'id'
            and not attisdropped
        )
      ]::smallint[]
      and conname <> 'project_work_model_versions_project_id_fkey'
  loop
    execute format(
      'alter table public.project_work_model_versions drop constraint %I',
      constraint_name
    );
  end loop;

  if not exists (
    select 1
    from pg_constraint
    where contype = 'f'
      and conrelid = 'public.project_work_model_versions'::regclass
      and conname = 'project_work_model_versions_project_id_fkey'
      and confrelid = 'public.projects'::regclass
      and confdeltype = 'c'
  ) then
    alter table public.project_work_model_versions
      add constraint project_work_model_versions_project_id_fkey
      foreign key (project_id) references public.projects(id) on delete cascade;
  end if;

  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.project_operational_states'::regclass
      and conname = 'project_operational_states_project_id_fkey'
      and not (
        contype = 'f'
        and confrelid = 'public.projects'::regclass
        and conkey = array[
          (
            select attnum
            from pg_attribute
            where attrelid = 'public.project_operational_states'::regclass
              and attname = 'project_id'
              and not attisdropped
          )
        ]::smallint[]
        and confkey = array[
          (
            select attnum
            from pg_attribute
            where attrelid = 'public.projects'::regclass
              and attname = 'id'
              and not attisdropped
          )
        ]::smallint[]
        and confdeltype = 'c'
      )
  ) then
    alter table public.project_operational_states
      drop constraint project_operational_states_project_id_fkey;
  end if;

  for constraint_name in
    select conname
    from pg_constraint
    where contype = 'f'
      and conrelid = 'public.project_operational_states'::regclass
      and confrelid = 'public.projects'::regclass
      and conkey = array[
        (
          select attnum
          from pg_attribute
          where attrelid = 'public.project_operational_states'::regclass
            and attname = 'project_id'
            and not attisdropped
        )
      ]::smallint[]
      and confkey = array[
        (
          select attnum
          from pg_attribute
          where attrelid = 'public.projects'::regclass
            and attname = 'id'
            and not attisdropped
        )
      ]::smallint[]
      and conname <> 'project_operational_states_project_id_fkey'
  loop
    execute format(
      'alter table public.project_operational_states drop constraint %I',
      constraint_name
    );
  end loop;

  if not exists (
    select 1
    from pg_constraint
    where contype = 'f'
      and conrelid = 'public.project_operational_states'::regclass
      and conname = 'project_operational_states_project_id_fkey'
      and confrelid = 'public.projects'::regclass
      and confdeltype = 'c'
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
