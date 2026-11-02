-- Forward-only: permit the exact creation-only Studio 6 x 3 m pitched starter.
-- Historical empty creation/replays and all clone/import/security paths remain.
-- CREATE OR REPLACE preserves this existing function's owner, OID and ACL.
create or replace function public.studio_authored_create(
  p_project_id uuid, p_actor_user_id uuid, p_request_id uuid,
  p_source_estimate_id uuid, p_client_request jsonb, p_prepared jsonb, p_source_proof jsonb
) returns table(estimate_id uuid, design_id text, revision bigint, saved_at timestamptz, already_existed boolean)
language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
declare
  v_receipt private.studio_authored_create_receipts%rowtype;
  v_source public.estimates%rowtype;
  v_authored jsonb;
  v_spatial jsonb;
  v_outputs jsonb;
  v_scope uuid;
  v_version integer;
  v_id uuid;
  v_saved_at timestamptz;
  v_mode text;
  -- PostgREST optional JSON arguments can arrive as JSON null rather than SQL NULL.
  v_source_proof jsonb := nullif(p_source_proof,'null'::jsonb);
begin
  if p_project_id is null or p_request_id is null or not exists(
    select 1 from public.portal_users u where u.user_id=p_actor_user_id and u.role in ('staff','admin')
  ) then raise exception 'studio_staff_required' using errcode='42501'; end if;

  -- Same key as configured revisions. UUID identity is authoritative: other
  -- legacy INSERT writers do not share this lock, so display version uniqueness
  -- across all estimate writers is NOT guaranteed by this command.
  perform pg_advisory_xact_lock(hashtextextended('configurator-revision:' || p_project_id::text,0));
  select * into v_receipt from private.studio_authored_create_receipts r
    where r.project_id=p_project_id and r.request_id=p_request_id;
  if found then
    if v_receipt.actor_user_id is distinct from p_actor_user_id
      or v_receipt.source_estimate_id is distinct from p_source_estimate_id
      or v_receipt.client_request is distinct from p_client_request then
      raise exception 'studio_request_conflict' using errcode='23505';
    end if;
    return query select v_receipt.estimate_id,v_receipt.design_id,1::bigint,v_receipt.saved_at,true;
    return;
  end if;

  perform 1 from public.projects p where p.id=p_project_id and p.archived_at is null for update;
  if not found then raise exception 'studio_project_unavailable' using errcode='P0002'; end if;
  if jsonb_typeof(p_client_request) is distinct from 'object' or octet_length(p_client_request::text)>2097152 then
    raise exception 'studio_invalid_creation' using errcode='22023';
  end if;
  v_mode := p_client_request->>'mode';
  if p_client_request->>'schemaVersion' is distinct from 'studio_create.v1'
    or p_client_request->>'requestId' is distinct from p_request_id::text
    or v_mode is null or v_mode not in ('blank','clone','import') then
    raise exception 'studio_invalid_creation' using errcode='22023';
  end if;
  if jsonb_typeof(p_prepared) is distinct from 'object' or octet_length(p_prepared::text)>2097152 then
    raise exception 'studio_invalid_creation' using errcode='22023';
  end if;
  if (select count(*) from jsonb_object_keys(p_prepared))<>(5 + case when p_prepared ? 'internal_name' then 1 else 0 end)
    or not(p_prepared ?& array['project_id','commercial_scope_id','status','inputs','outputs'])
    or p_prepared->>'project_id' is distinct from p_project_id::text
    or p_prepared->>'status' is distinct from 'draft'
    or jsonb_typeof(p_prepared->'inputs') is distinct from 'object'
    or jsonb_typeof(p_prepared->'outputs') is distinct from 'object'
    or not (p_prepared->'commercial_scope_id'='null'::jsonb or jsonb_typeof(p_prepared->'commercial_scope_id')='string') then
    raise exception 'studio_invalid_creation' using errcode='22023';
  end if;
  if p_prepared ? 'internal_name' and p_prepared->'internal_name'<>'null'::jsonb and (
    jsonb_typeof(p_prepared->'internal_name') is distinct from 'string'
    or length(p_prepared->>'internal_name')>120
    or nullif(btrim(p_prepared->>'internal_name'),'') is null
  ) then raise exception 'studio_invalid_creation' using errcode='22023'; end if;
  v_scope := (p_prepared->>'commercial_scope_id')::uuid;
  v_outputs := p_prepared->'outputs';
  v_authored := v_outputs->'studio_authored';
  v_spatial := v_outputs->'drawing_object_first';
  if jsonb_typeof(v_authored) is distinct from 'object' or jsonb_typeof(v_spatial) is distinct from 'object' then
    raise exception 'studio_invalid_creation' using errcode='22023';
  end if;
  if (select count(*) from jsonb_object_keys(v_authored))<>8
    or not(v_authored ?& array['schemaVersion','designId','revision','spatialOutputKey','site','objectOptions','legacyCommercialAssociations','provenance'])
    or v_authored->>'schemaVersion' is distinct from 'studio_authored.v1'
    or v_authored->>'spatialOutputKey' is distinct from 'drawing_object_first'
    or v_authored->'revision' is distinct from '1'::jsonb
    or jsonb_typeof(v_authored->'designId') is distinct from 'string'
    or nullif(btrim(v_authored->>'designId'),'') is null or length(v_authored->>'designId')>200
    or (select count(*) from jsonb_object_keys(v_spatial))<>4
    or not(v_spatial ?& array['houseAssembly','decks','openings','pergolas'])
    or jsonb_typeof(v_spatial->'decks') is distinct from 'array'
    or jsonb_typeof(v_spatial->'openings') is distinct from 'array'
    or jsonb_typeof(v_spatial->'pergolas') is distinct from 'array' then
    raise exception 'studio_invalid_creation' using errcode='22023';
  end if;

  if v_mode='blank' then
    if (select count(*) from jsonb_object_keys(p_client_request))<>(4 + case when p_client_request ? 'internalName' then 1 else 0 end)
      or not(p_client_request ?& array['schemaVersion','requestId','mode','scope'])
      or p_client_request->>'scope' is null or p_client_request->>'scope' not in ('base','add_on')
      or p_source_estimate_id is not null or v_source_proof is not null
      or (p_client_request->>'scope'='base') is distinct from (v_scope is null)
      or p_prepared->'inputs' is distinct from '{}'::jsonb
      or coalesce(p_prepared->'internal_name','null'::jsonb) is distinct from coalesce(p_client_request->'internalName','null'::jsonb)
      or (v_outputs - 'studio_authored' - 'drawing_object_first')<>'{}'::jsonb
      or not (
        (v_spatial is not distinct from '{"houseAssembly":null,"decks":[],"openings":[],"pergolas":[]}'::jsonb
          and (v_authored - 'designId') is not distinct from '{"schemaVersion":"studio_authored.v1","revision":1,"spatialOutputKey":"drawing_object_first","site":{"validation":"preserved_unvalidated","values":{}},"objectOptions":[],"legacyCommercialAssociations":[],"provenance":{"sourceEstimateId":null,"sourceKind":"authored","sourcePayload":null}}'::jsonb)
        or ((p_client_request->>'scope') is not distinct from 'base'
          and v_spatial is not distinct from '{"houseAssembly":null,"decks":[],"openings":[],"pergolas":[{"id":"initial-pergola","label":"Pergola 1","family":"mono","attachmentEdgeId":null,"attachmentZoneId":null,"side":"rear","strategy":null,"position":{"originXMm":"0","originYMm":"0","rotationDeg":"0"}}]}'::jsonb
          and (v_authored - 'designId') is not distinct from '{"schemaVersion":"studio_authored.v1","revision":1,"spatialOutputKey":"drawing_object_first","site":{"validation":"preserved_unvalidated","values":{}},"objectOptions":[{"objectId":"initial-pergola","options":{"validation":"preserved_unvalidated","values":{"websiteDesign":{"schemaVersion":"studio_website_design.v1","objectId":"initial-pergola","selection":{"version":1,"input":{"widthMm":6000,"projectionMm":3000,"level":"ground","connection":"facade"},"roof":{"family":"mono","orientation":"parallel","infills":false,"attachmentIntent":"freestanding"}},"rawDimensions":{"widthMm":"6000","projectionMm":"3000"}}}}}],"legacyCommercialAssociations":[],"provenance":{"sourceEstimateId":null,"sourceKind":"authored","sourcePayload":null}}'::jsonb)
      ) then
      raise exception 'studio_invalid_creation' using errcode='22023';
    end if;
    if v_scope is not null and (exists(select 1 from public.estimates e where e.project_id=p_project_id and e.commercial_scope_id=v_scope)
      or exists(select 1 from public.quotes q where q.project_id=p_project_id and q.commercial_scope_id=v_scope)) then
      raise exception 'studio_scope_conflict' using errcode='PT409';
    end if;
  else
    if (select count(*) from jsonb_object_keys(p_client_request))<>(6 + case when p_client_request ? 'internalName' then 1 else 0 end)
      or not(p_client_request ?& array['schemaVersion','requestId','mode','sourceEstimateId','expectedUpdatedAt','expectedRevision'])
      or p_source_estimate_id is null
      or p_client_request->>'sourceEstimateId' is distinct from ('est_'||p_source_estimate_id::text)
      or jsonb_typeof(p_client_request->'expectedUpdatedAt') is distinct from 'string'
      or coalesce(p_client_request->>'expectedUpdatedAt','') !~ '^\d{4}-\d{2}-\d{2}T'
      or jsonb_typeof(p_client_request->'expectedRevision') is distinct from 'number'
      or (v_mode='clone' and coalesce(p_client_request->>'expectedRevision','') !~ '^[1-9][0-9]*$')
      or (v_mode='import' and p_client_request->'expectedRevision' is distinct from '0'::jsonb)
      or (p_client_request->>'expectedRevision')::numeric>9007199254740991 then
      raise exception 'studio_invalid_creation' using errcode='22023';
    end if;
    select * into v_source from public.estimates e where e.id=p_source_estimate_id and e.project_id=p_project_id for update;
    if not found then raise exception 'studio_source_unavailable' using errcode='P0002'; end if;
    if to_jsonb(v_source) is distinct from v_source_proof
      or v_source.updated_at is distinct from (p_client_request->>'expectedUpdatedAt')::timestamptz
      or (v_mode='clone' and v_source.outputs->'studio_authored'->'revision' is distinct from p_client_request->'expectedRevision') then
      raise exception 'studio_stale' using errcode='PT409';
    end if;
    if v_source.status not in ('draft','archived')
      or jsonb_typeof(v_source.outputs) is distinct from 'object'
      or jsonb_typeof(v_source.inputs) is distinct from 'object'
      or p_prepared->'inputs' is distinct from v_source.inputs
      or coalesce(p_prepared->'internal_name','null'::jsonb) is distinct from
        (case when p_client_request ? 'internalName' then p_client_request->'internalName' else coalesce(to_jsonb(v_source)->'internal_name','null'::jsonb) end)
      or v_scope is distinct from v_source.commercial_scope_id then
      raise exception 'studio_invalid_creation' using errcode='22023';
    end if;
    if v_mode='clone' then
      if v_authored->'designId' is not distinct from v_source.outputs->'studio_authored'->'designId'
        or (v_authored - 'designId' - 'revision') is distinct from ((v_source.outputs->'studio_authored') - 'designId' - 'revision')
        or (v_outputs - 'studio_authored') is distinct from (v_source.outputs - 'studio_authored') then
        raise exception 'studio_invalid_creation' using errcode='22023';
      end if;
    else
      -- Explicit historical import only. The trusted server validates every
      -- supported selection; SQL binds it to the locked original.
      -- No quote/source mutation or inference of missing pergola geometry.
      if v_source.outputs ? 'studio_authored'
        or v_source.inputs->>'schemaVersion' is distinct from 'v2'
        or jsonb_typeof(v_source.inputs->'modules') is distinct from 'array'
        or (v_source.outputs ? 'drawing_object_first' and v_source.outputs->'drawing_object_first' is distinct from v_spatial)
        or (v_outputs - 'studio_authored' - 'drawing_object_first') is distinct from (v_source.outputs - 'drawing_object_first')
        or v_authored->'site' is distinct from jsonb_build_object('validation','preserved_unvalidated','values',v_source.inputs - array['schemaVersion','projectName','quoteRef','modules','pergolas'])
        or v_authored->'provenance' is distinct from jsonb_build_object('sourceEstimateId','est_'||p_source_estimate_id::text,'sourceKind','imported','sourcePayload',to_jsonb(v_source)) then
        raise exception 'studio_invalid_creation' using errcode='22023';
      end if;
      if jsonb_array_length(v_source.inputs->'modules')=0 then
        if (v_source.inputs ? 'pergolas' and v_source.inputs->'pergolas' is distinct from '[]'::jsonb)
          or v_spatial is distinct from '{"houseAssembly":null,"decks":[],"openings":[],"pergolas":[]}'::jsonb
          or v_authored->'objectOptions' is distinct from '[]'::jsonb
          or v_authored->'legacyCommercialAssociations' is distinct from '[]'::jsonb then
          raise exception 'studio_invalid_creation' using errcode='22023';
        end if;
      else
        -- Existing singleton scene/module agreement is checked by the import
        -- owner. This binds the new explicit association to that same scene;
        -- a module index is never accepted as a runtime object identity.
        if jsonb_array_length(v_source.inputs->'modules')<>1
          or jsonb_array_length(v_spatial->'pergolas')<>1
          or v_source.outputs->'drawing_object_first' is distinct from v_spatial
          or v_spatial->'houseAssembly' is distinct from 'null'::jsonb
          or v_spatial->'decks' is distinct from '[]'::jsonb
          or v_spatial->'openings' is distinct from '[]'::jsonb
          or jsonb_typeof(v_authored->'objectOptions') is distinct from 'array'
          or jsonb_typeof(v_authored->'legacyCommercialAssociations') is distinct from 'array' then
          raise exception 'studio_invalid_creation' using errcode='22023';
        end if;
        if jsonb_array_length(v_authored->'objectOptions')<>1
          or v_authored#>'{objectOptions,0,objectId}' is distinct from v_spatial#>'{pergolas,0,id}'
          or v_authored#>>'{objectOptions,0,options,validation}' is distinct from 'preserved_unvalidated'
          or jsonb_typeof(v_authored#>'{objectOptions,0,options,values}') is distinct from 'object' then
          raise exception 'studio_invalid_creation' using errcode='22023';
        end if;
        if exists(select 1 from jsonb_each(v_authored#>'{objectOptions,0,options,values}') as option
          where option.value is distinct from (v_source.inputs#>'{modules,0}')->option.key) then
          raise exception 'studio_invalid_creation' using errcode='22023';
        end if;
        if not(v_source.inputs ? 'pergolas') or v_source.inputs->'pergolas'='[]'::jsonb then
          if v_authored->'legacyCommercialAssociations' is distinct from '[]'::jsonb then
            raise exception 'studio_invalid_creation' using errcode='22023';
          end if;
        else
          if jsonb_typeof(v_source.inputs->'pergolas') is distinct from 'array' then
            raise exception 'studio_invalid_creation' using errcode='22023';
          end if;
          if jsonb_array_length(v_source.inputs->'pergolas')<>1
            or v_source.inputs#>'{modules,0,pergolaId}' is distinct from v_source.inputs#>'{pergolas,0,id}'
            or v_authored->'legacyCommercialAssociations' is distinct from jsonb_build_array(jsonb_build_object(
              'authority','preserved_legacy_only','id',v_source.inputs#>'{pergolas,0,id}',
              'label',v_source.inputs#>'{pergolas,0,label}','objectIds',jsonb_build_array(v_spatial#>'{pergolas,0,id}'),
              'options',jsonb_build_object('validation','preserved_unvalidated','values',(v_source.inputs#>'{pergolas,0}') - array['id','label'])
            )) then raise exception 'studio_invalid_creation' using errcode='22023'; end if;
        end if;
      end if;
    end if;
  end if;

  select coalesce(max(e.version),0)+1 into v_version from public.estimates e where e.project_id=p_project_id;
  if v_outputs ? 'version' then v_outputs := jsonb_set(v_outputs,'{version}',to_jsonb(v_version)); end if;
  -- No copied financial summary, costing configuration, or quote mutation.
  insert into public.estimates(project_id,commercial_scope_id,status,version,created_by,inputs,outputs,internal_name)
    values(p_project_id,v_scope,'draft',v_version,p_actor_user_id::text,p_prepared->'inputs',v_outputs,p_prepared->>'internal_name')
    returning id,updated_at into v_id,v_saved_at;
  insert into private.studio_authored_create_receipts(project_id,request_id,actor_user_id,source_estimate_id,client_request,source_snapshot,estimate_id,design_id,saved_at)
    values(p_project_id,p_request_id,p_actor_user_id,p_source_estimate_id,p_client_request,v_source_proof,v_id,v_authored->>'designId',v_saved_at);
  return query select v_id,v_authored->>'designId',1::bigint,v_saved_at,false;
end;
$$;
