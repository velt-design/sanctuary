-- Extend existing audited report corrections without changing project ownership or finances.
alter table private.project_sales_designers drop constraint project_sales_designers_designer_key_check;
alter table private.project_sales_designers add constraint project_sales_designers_designer_key_check
  check (designer_key in ('ellen','jordan','jp','joe','bruce','dave','steve'));
alter table private.project_sales_outcomes drop constraint project_sales_outcomes_outcome_check;
alter table private.project_sales_outcomes add constraint project_sales_outcomes_outcome_check
  check (outcome in ('cancelled','refunded','test'));

create or replace function public.project_sales_designer_assign(p_project uuid,p_command uuid,p_expected_revision integer,p_designer text,p_basis text) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog,pg_temp as $$
declare actor uuid; body jsonb; previous private.project_sales_designer_commands%rowtype; before_value jsonb; result jsonb;
begin
  actor:=private.sales_designer_actor();
  if p_project is null or p_command is null or p_expected_revision is null or p_expected_revision<0
    or (p_designer is not null and p_designer not in ('ellen','jordan','jp','joe','bruce','dave','steve'))
    or p_basis is null or length(btrim(p_basis)) not between 3 and 500 then
    raise exception 'Invalid sales designer assignment' using errcode='22023'; end if;
  body:=jsonb_build_object('projectId',p_project,'expectedRevision',p_expected_revision,'designerKey',p_designer,'basis',btrim(p_basis));
  perform pg_advisory_xact_lock(hashtextextended('sales-designer:'||p_command::text,0));
  select * into previous from private.project_sales_designer_commands where command_id=p_command;
  if found then
    if previous.actor_id<>actor or previous.request<>body then raise exception 'Command already used' using errcode='40001'; end if;
    return previous.result;
  end if;
  perform 1 from public.projects where id=p_project for update;
  if not found then raise exception 'Project unavailable' using errcode='P0002'; end if;
  before_value:=private.sales_designer_json(p_project);
  if (before_value->>'revision')::integer<>p_expected_revision then raise exception 'Assignment changed; reload before saving' using errcode='40001'; end if;
  insert into private.project_sales_designers(project_id,designer_key,revision,basis,updated_at,updated_by)
    values(p_project,p_designer,p_expected_revision+1,btrim(p_basis),now(),actor)
    on conflict(project_id) do update set designer_key=excluded.designer_key,revision=excluded.revision,basis=excluded.basis,
      updated_at=excluded.updated_at,updated_by=excluded.updated_by;
  result:=private.sales_designer_json(p_project);
  insert into private.project_sales_designer_commands(command_id,project_id,actor_id,request,before_assignment,result)
    values(p_command,p_project,actor,body,before_value,result);
  return result;
end $$;

create or replace function public.project_sales_outcome_record(p_project uuid,p_command uuid,p_expected_revision integer,p_outcome text,p_basis text) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog,pg_temp as $$
declare actor uuid; body jsonb; previous private.project_sales_outcome_commands%rowtype; before_value jsonb; result jsonb;
begin
  actor:=private.sales_designer_actor();
  if p_project is null or p_command is null or p_expected_revision is null or p_expected_revision<0
    or (p_outcome is not null and p_outcome not in ('cancelled','refunded','test'))
    or p_basis is null or length(btrim(p_basis)) not between 3 and 500 then
    raise exception 'Invalid sales outcome' using errcode='22023'; end if;
  body:=jsonb_build_object('projectId',p_project,'expectedRevision',p_expected_revision,'outcome',p_outcome,'basis',btrim(p_basis));
  perform pg_advisory_xact_lock(hashtextextended('sales-outcome:'||p_command::text,0));
  select * into previous from private.project_sales_outcome_commands where command_id=p_command;
  if found then
    if previous.actor_id<>actor or previous.request<>body then raise exception 'Command already used' using errcode='40001'; end if;
    return previous.result;
  end if;
  perform 1 from public.projects where id=p_project for update;
  if not found then raise exception 'Project unavailable' using errcode='P0002'; end if;
  before_value:=private.sales_outcome_json(p_project);
  if (before_value->>'revision')::integer<>p_expected_revision then raise exception 'Outcome changed; reload before saving' using errcode='40001'; end if;
  insert into private.project_sales_outcomes(project_id,outcome,revision,basis,updated_at,updated_by)
    values(p_project,p_outcome,p_expected_revision+1,btrim(p_basis),now(),actor)
    on conflict(project_id) do update set outcome=excluded.outcome,revision=excluded.revision,basis=excluded.basis,
      updated_at=excluded.updated_at,updated_by=excluded.updated_by;
  result:=private.sales_outcome_json(p_project);
  insert into private.project_sales_outcome_commands(command_id,project_id,actor_id,request,before_outcome,result)
    values(p_command,p_project,actor,body,before_value,result);
  return result;
end $$;

-- CREATE OR REPLACE preserves the existing authenticated-only ACL and volatile actor locks.
