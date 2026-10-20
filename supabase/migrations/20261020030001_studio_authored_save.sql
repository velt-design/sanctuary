-- Install-only foundation. Studio authored revisions remain UNPRICED.
-- The server validates the canonical spatial contract before calling this command.
create table private.studio_authored_save_receipts (
  estimate_id uuid not null references public.estimates(id),
  request_id uuid not null,
  -- Historical identity must survive removal of current Portal membership.
  -- The command checks current staff access before every write or replay.
  actor_user_id uuid not null,
  request_payload jsonb not null,
  revision bigint not null check (revision > 0),
  saved_at timestamptz not null,
  primary key (estimate_id, request_id)
);
revoke all on private.studio_authored_save_receipts from public, anon, authenticated, service_role;

-- Quote creation and studio save take the same estimate row lock. This closes
-- the race between checking for quote references and attaching a new quote.
create function private.studio_quote_source_guard() returns trigger
language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
declare v_outputs jsonb;
begin
  if tg_op = 'UPDATE' and new.source_estimate_version_id is not distinct from old.source_estimate_version_id then return new; end if;
  if new.source_estimate_version_id is null then return new; end if;
  select e.outputs into v_outputs from public.estimates e where e.id=new.source_estimate_version_id for update;
  if v_outputs ? 'studio_authored' then
    raise exception 'studio_costing_required' using errcode='23514';
  end if;
  return new;
end;
$$;
revoke all on function private.studio_quote_source_guard() from public, anon, authenticated, service_role;
create trigger studio_quote_source_guard before insert or update of source_estimate_version_id
on public.quote_versions for each row execute function private.studio_quote_source_guard();

-- Generic estimate writers may change notes/name, but cannot strip or overwrite
-- a studio revision and thereby make its retained price quoteable again.
create function private.studio_estimate_write_guard() returns trigger
language plpgsql set search_path = pg_catalog, pg_temp as $$
begin
  if (coalesce(old.outputs,'{}'::jsonb) ? 'studio_authored' or coalesce(new.outputs,'{}'::jsonb) ? 'studio_authored')
    and (old.inputs is distinct from new.inputs or old.outputs is distinct from new.outputs)
    and not (coalesce(current_setting('sanctuary.studio_command',true),'')='save'
      and current_user = pg_get_userbyid((select p.proowner from pg_proc p where p.oid='public.studio_authored_save(uuid,uuid,uuid,uuid,timestamptz,bigint,jsonb,jsonb,jsonb,jsonb)'::regprocedure))) then
    raise exception 'studio_command_required' using errcode='42501';
  end if;
  return new;
end;
$$;
revoke all on function private.studio_estimate_write_guard() from public, anon, authenticated, service_role;
create trigger studio_estimate_write_guard before update of inputs, outputs
on public.estimates for each row execute function private.studio_estimate_write_guard();

create function public.studio_authored_save(
  p_project_id uuid, p_estimate_id uuid, p_actor_user_id uuid, p_request_id uuid,
  p_expected_updated_at timestamptz, p_expected_revision bigint,
  p_authored jsonb, p_spatial jsonb, p_validated_stored_authored jsonb, p_client_request jsonb
) returns table (revision bigint, saved_at timestamptz, already_existed boolean)
language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
declare
  v_estimate public.estimates%rowtype;
  v_receipt private.studio_authored_save_receipts%rowtype;
  v_request jsonb;
  v_current jsonb;
  v_revision bigint;
  v_next bigint;
  v_saved_at timestamptz;
  v_previous_context text;
begin
  if p_request_id is null or p_expected_revision is null or p_expected_revision < 0
    or not exists(select 1 from public.portal_users u where u.user_id=p_actor_user_id and u.role in ('staff','admin')) then
    raise exception 'studio_staff_required' using errcode='42501';
  end if;
  select * into v_estimate from public.estimates e where e.id=p_estimate_id and e.project_id=p_project_id for update;
  if not found then raise exception 'studio_estimate_unavailable' using errcode='P0002'; end if;
  -- The server reconstructs private retained fields from the current source.
  -- Retry identity must use the exact browser command, never that reconstruction:
  -- a later save may have changed private fields before an earlier retry arrives.
  if jsonb_typeof(p_client_request) is distinct from 'object' then
    raise exception 'studio_invalid_payload' using errcode='22023';
  end if;
  v_request := jsonb_build_object('projectId',p_project_id,'expectedUpdatedAt',p_expected_updated_at,
    'expectedRevision',p_expected_revision,'clientRequest',p_client_request);
  select * into v_receipt from private.studio_authored_save_receipts r where r.estimate_id=p_estimate_id and r.request_id=p_request_id;
  if found then
    if v_receipt.actor_user_id<>p_actor_user_id or v_receipt.request_payload is distinct from v_request then
      raise exception 'studio_request_conflict' using errcode='23505';
    end if;
    return query select v_receipt.revision,v_receipt.saved_at,true;
    return;
  end if;
  -- JSONB concatenation with a scalar/array would hide the marker inside an
  -- array, defeating marker-based readers. Preserve unsupported source data.
  if v_estimate.outputs is not null and jsonb_typeof(v_estimate.outputs)<>'object' then
    raise exception 'studio_schema_unsupported' using errcode='22023';
  end if;
  if not exists(select 1 from public.projects p where p.id=p_project_id and p.archived_at is null)
    or v_estimate.status is distinct from 'draft' then
    raise exception 'studio_estimate_unavailable' using errcode='P0002';
  end if;
  -- A quote's source stays unchanged, even for a prepared draft quote. The UI
  -- creates a new estimate revision instead of modifying any referenced source.
  if exists(select 1 from public.quote_versions q where q.source_estimate_version_id=p_estimate_id) then
    raise exception 'studio_estimate_referenced' using errcode='23514';
  end if;
  if v_estimate.updated_at is distinct from p_expected_updated_at then
    raise exception 'studio_stale' using errcode='PT409';
  end if;
  if jsonb_typeof(p_authored) is distinct from 'object' or jsonb_typeof(p_spatial) is distinct from 'object'
    or octet_length(v_request::text)>2097152
    or p_authored->>'schemaVersion' is distinct from 'studio_authored.v1'
    or p_authored->>'spatialOutputKey' is distinct from 'drawing_object_first'
    or jsonb_typeof(p_authored->'revision') is distinct from 'number'
    or p_authored->>'revision' !~ '^[1-9][0-9]*$'
    or (p_authored->>'revision')::numeric <> greatest(1,p_expected_revision) then
    raise exception 'studio_invalid_payload' using errcode='22023';
  end if;
  v_current := v_estimate.outputs->'studio_authored';
  if v_current is distinct from p_validated_stored_authored then
    raise exception 'studio_schema_unsupported' using errcode='22023';
  end if;
  v_revision := 0;
  if coalesce(v_estimate.outputs,'{}'::jsonb) ? 'studio_authored' then
    if v_current->>'schemaVersion' is distinct from 'studio_authored.v1'
      or jsonb_typeof(v_current) is distinct from 'object'
      or (select count(*) from jsonb_object_keys(v_current))<>8
      or not (v_current ?& array['schemaVersion','designId','revision','spatialOutputKey','site','objectOptions','legacyCommercialAssociations','provenance'])
      or coalesce(v_current->>'revision','') !~ '^[1-9][0-9]*$' then
      raise exception 'studio_schema_unsupported' using errcode='22023';
    end if;
    v_revision := (v_current->>'revision')::bigint;
    if v_current->'designId' is distinct from p_authored->'designId'
      or v_current->'provenance' is distinct from p_authored->'provenance'
      or v_current->'legacyCommercialAssociations' is distinct from p_authored->'legacyCommercialAssociations' then
      raise exception 'studio_identity_changed' using errcode='23514';
    end if;
  end if;
  if v_revision<>p_expected_revision then raise exception 'studio_stale' using errcode='PT409'; end if;
  v_next := v_revision;
  v_saved_at := v_estimate.updated_at;
  if v_current is distinct from p_authored or v_estimate.outputs->'drawing_object_first' is distinct from p_spatial then
    v_next := v_revision+1;
    if v_next>9007199254740991 then raise exception 'studio_revision_limit' using errcode='22023'; end if;
    v_previous_context := current_setting('sanctuary.studio_command',true);
    perform set_config('sanctuary.studio_command','save',true);
    update public.estimates e set outputs=coalesce(e.outputs,'{}'::jsonb)||jsonb_build_object(
      'studio_authored',p_authored||jsonb_build_object('revision',v_next),'drawing_object_first',p_spatial),
      updated_at=clock_timestamp()
      where e.id=p_estimate_id returning e.updated_at into v_saved_at;
    perform set_config('sanctuary.studio_command',coalesce(v_previous_context,''),true);
  end if;
  insert into private.studio_authored_save_receipts(estimate_id,request_id,actor_user_id,request_payload,revision,saved_at)
    values(p_estimate_id,p_request_id,p_actor_user_id,v_request,v_next,v_saved_at);
  return query select v_next,v_saved_at,false;
end;
$$;
revoke all on function public.studio_authored_save(uuid,uuid,uuid,uuid,timestamptz,bigint,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.studio_authored_save(uuid,uuid,uuid,uuid,timestamptz,bigint,jsonb,jsonb,jsonb,jsonb) to service_role;
