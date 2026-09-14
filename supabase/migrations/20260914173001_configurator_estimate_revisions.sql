-- Server-prepared staff revisions. Installation does not approve rates or enable a UI.
create table private.configurator_estimate_revisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id),
  source_estimate_id uuid not null references public.estimates(id),
  estimate_id uuid not null unique references public.estimates(id),
  request_id uuid not null,
  actor_user_id uuid not null references public.portal_users(user_id),
  prepared_estimate jsonb not null check (jsonb_typeof(prepared_estimate) = 'object'),
  created_at timestamptz not null default now(),
  unique(project_id, request_id)
);
revoke all on private.configurator_estimate_revisions from public, anon, authenticated, service_role;

create function public.configurator_estimate_revision_create(
  p_project_id uuid, p_source_estimate_id uuid, p_request_id uuid,
  p_actor_user_id uuid, p_estimate jsonb
)
returns table (revision_id uuid, estimate_id uuid, already_existed boolean)
language plpgsql security definer set search_path = pg_catalog, pg_temp
as $$
declare
  v_existing private.configurator_estimate_revisions%rowtype;
  v_estimate public.estimates%rowtype;
  v_source public.estimates%rowtype;
  v_price jsonb;
  v_version integer;
  v_estimate_id uuid;
  v_revision_id uuid;
begin
  if p_request_id is null or not exists (
    select 1 from public.portal_users u where u.user_id=p_actor_user_id and u.role in ('staff','admin')
  ) then raise exception 'staff_revision_actor_required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('configurator-revision:' || p_project_id::text, 0));
  if not exists (select 1 from public.projects p where p.id=p_project_id and p.archived_at is null) then
    raise exception 'revision_project_unavailable' using errcode='P0002';
  end if;
  select * into v_source from public.estimates e where e.id=p_source_estimate_id and e.project_id=p_project_id;
  if not found or v_source.outputs->'snapshot'->>'source' is distinct from 'marketing_enquiry' then
    raise exception 'revision_source_unavailable' using errcode='P0002';
  end if;
  select * into v_existing from private.configurator_estimate_revisions r
    where r.project_id=p_project_id and r.request_id=p_request_id;
  if found then
    if v_existing.source_estimate_id <> p_source_estimate_id
      or v_existing.actor_user_id <> p_actor_user_id
      or v_existing.prepared_estimate is distinct from p_estimate then
      raise exception 'revision_request_conflict' using errcode='23505';
    end if;
    return query select v_existing.id, v_existing.estimate_id, true;
    return;
  end if;
  v_price := p_estimate->'outputs'->'snapshot'->'frozenConfiguratorPrice'->'customerPrice';
  if jsonb_typeof(p_estimate) is distinct from 'object' or octet_length(p_estimate::text)>2097152
    or jsonb_typeof(p_estimate->'inputs') is distinct from 'object'
    or p_estimate->'outputs'->'derived'->>'pricingMode' is distinct from 'configured_customer_snapshot'
    or p_estimate->'outputs'->'snapshot'->>'source' is distinct from 'marketing_enquiry'
    or p_estimate->'outputs'->'snapshot'->'configuredQuoteInputs' is distinct from p_estimate->'inputs'
    or p_estimate->'outputs'->'snapshot'->'frozenConfiguratorPrice'->>'schemaVersion' is distinct from 'configurator-pricing.v1'
    or jsonb_typeof(p_estimate->'outputs'->'snapshot'->'frozenConfiguratorPrice'->'design') is distinct from 'object'
    or v_price->>'currency' is distinct from 'NZD' or v_price->'includesGst' is distinct from 'true'::jsonb
    or jsonb_typeof(v_price->'amountIncGst') is distinct from 'number'
    or coalesce(v_price->>'amountIncGst','') !~ '^[1-9][0-9]*$'
    or jsonb_typeof(v_price->'breakdown') is distinct from 'array' then
    raise exception 'invalid_prepared_revision' using errcode='22023';
  end if;
  if jsonb_array_length(v_price->'breakdown')=0 or exists (
    select 1 from jsonb_array_elements(v_price->'breakdown') line
    where jsonb_typeof(line->'label') is distinct from 'string' or nullif(btrim(line->>'label'),'') is null
      or jsonb_typeof(line->'amountIncGst') is distinct from 'number'
      or coalesce(line->>'amountIncGst','') !~ '^(0|[1-9][0-9]*)$'
  ) then raise exception 'invalid_revision_breakdown' using errcode='22023'; end if;
  if (v_price->>'amountIncGst')::numeric > 90071992547409
    or (select sum((line->>'amountIncGst')::numeric) from jsonb_array_elements(v_price->'breakdown') line)
    <> (v_price->>'amountIncGst')::numeric then
    raise exception 'revision_total_mismatch' using errcode='22023';
  end if;
  select coalesce(max(e.version),0)+1 into v_version from public.estimates e where e.project_id=p_project_id;
  v_estimate := jsonb_populate_record(null::public.estimates, p_estimate);
  insert into public.estimates(project_id,status,version,created_by,summary_json,inputs,outputs,warnings,
    costing_manifest,costing_rules,costing_config_version_id,crew_hours,duration_days,materials_ex_gst,
    install_payout_ex_gst,overhead_ex_gst,total_true_cost_ex_gst,total_true_cost_inc_gst)
  values(p_project_id,'draft',v_version,p_actor_user_id::text,v_estimate.summary_json,v_estimate.inputs,
    v_estimate.outputs || jsonb_build_object('version',v_version,'configuratorRevision',jsonb_build_object(
      'sourceEstimateId',p_source_estimate_id,'requestId',p_request_id,'actorUserId',p_actor_user_id)),
    coalesce(v_estimate.warnings,'[]'::jsonb),v_estimate.costing_manifest,v_estimate.costing_rules,
    v_estimate.costing_config_version_id,v_estimate.crew_hours,v_estimate.duration_days,
    v_estimate.materials_ex_gst,v_estimate.install_payout_ex_gst,v_estimate.overhead_ex_gst,
    v_estimate.total_true_cost_ex_gst,v_estimate.total_true_cost_inc_gst) returning id into v_estimate_id;
  insert into private.configurator_estimate_revisions(project_id,source_estimate_id,estimate_id,request_id,actor_user_id,prepared_estimate)
    values(p_project_id,p_source_estimate_id,v_estimate_id,p_request_id,p_actor_user_id,p_estimate) returning id into v_revision_id;
  return query select v_revision_id,v_estimate_id,false;
end;
$$;
revoke all on function public.configurator_estimate_revision_create(uuid,uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.configurator_estimate_revision_create(uuid,uuid,uuid,uuid,jsonb) to service_role;
