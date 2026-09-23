-- Enquiry/Proposal measure open opportunities; later journeys retain history.
-- Extend only the state predicate of the existing bounded, RLS-owned index.
do $migration$
declare
  v_definition text;
  v_allowed text := $old$'ALL','ACTIVE','WAITING','CLOSED','ARCHIVED'$old$;
  v_predicate text := $old$input.state_filter = 'ALL'
        or case
          when project.archived_at is not null then 'ARCHIVED'
          else state.state
        end = input.state_filter$old$;
begin
  select pg_get_functiondef(p.oid) into v_definition
  from pg_proc p
  where p.oid = to_regprocedure('public.staff_projects_index_v3(text,text,text,text,date,integer,integer,text,text,text[],text)')
    and not p.prosecdef and p.provolatile = 's';
  -- Production retains CRLF in the stored PL/pgSQL body; compare normalized text.
  v_definition := replace(v_definition, E'\r\n', E'\n');
  if v_definition is null
    or (length(v_definition) - length(replace(v_definition, v_allowed, ''))) / length(v_allowed) <> 1
    or (length(v_definition) - length(replace(v_definition, v_predicate, ''))) / length(v_predicate) <> 1 then
    raise exception 'OPEN_PIPELINE_INDEX_CONTRACT_MISMATCH';
  end if;
  v_definition := replace(v_definition, v_allowed, $new$'ALL','OPEN','ACTIVE','WAITING','CLOSED','ARCHIVED'$new$);
  v_definition := replace(v_definition, v_predicate, $new$input.state_filter = 'ALL'
        or (
          input.state_filter = 'OPEN'
          and project.archived_at is null
          and state.state in ('ACTIVE','WAITING')
        )
        or case
          when project.archived_at is not null then 'ARCHIVED'
          else state.state
        end = input.state_filter$new$);
  execute v_definition;
end;
$migration$;

create function public.staff_dashboard_pipeline_counts_v1()
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $function$
declare
  v_counts jsonb;
begin
  if not coalesce(public.has_portal_access(), false) then
    raise exception 'PORTAL_ACCESS_REQUIRED' using errcode = '42501';
  end if;
  if exists (
    select 1
    from public.projects project
    left join public.project_work_model_versions model
      on model.project_id = project.id and model.model_version = 2
    left join public.project_operational_states state on state.project_id = project.id
    where model.project_id is null or state.project_id is null
  ) then
    raise exception 'PROJECT_WORK_ROLLOUT_INCOMPLETE: project marker/state is missing' using errcode = 'P0001';
  end if;

  select jsonb_object_agg(stage.key, coalesce(totals.count, 0)) into v_counts
  from unnest(array['NEW','CONTACTED','SITE_VISIT','QUOTING','SENT','DEPOSIT','SCHEDULED','COMPLETED','PAID']) stage(key)
  left join (
    select upper(project.pipeline_stage::text) as key, count(*) as count
    from public.projects project
    join public.project_work_model_versions model on model.project_id = project.id and model.model_version = 2
    join public.project_operational_states state on state.project_id = project.id
    where project.archived_at is null
      and (
        upper(project.pipeline_stage::text) in ('DEPOSIT','SCHEDULED','COMPLETED','PAID')
        or state.state in ('ACTIVE','WAITING')
      )
    group by upper(project.pipeline_stage::text)
  ) totals on totals.key = stage.key;
  return jsonb_build_object('scope', 'open_enquiry_proposal_v1', 'counts', v_counts);
end;
$function$;

revoke all on function public.staff_dashboard_pipeline_counts_v1() from public, anon, authenticated, service_role;
grant execute on function public.staff_dashboard_pipeline_counts_v1() to authenticated, service_role;
comment on function public.staff_dashboard_pipeline_counts_v1() is
  'Exact uncapped journey counts: open Enquiry/Proposal, all unarchived later stages. SECURITY INVOKER and portfolio rollout checks match the Projects index.';

select pg_notify('pgrst', 'reload schema');
