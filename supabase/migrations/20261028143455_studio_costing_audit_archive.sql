-- Lossless private costing trace only. Fresh price/source/address/financial
-- authority remains in the existing canonical preparation/commit owners.
create function private.studio_costing_audit_stored_valid(evidence jsonb,publication_id uuid) returns boolean
language plpgsql immutable set search_path=pg_catalog,pg_temp as $$
declare v jsonb;
begin
 if jsonb_typeof(evidence) is distinct from 'object' then return false; end if;
 -- Historical plain evidence retains its original representation and retry.
 if not (evidence ? 'audit') then return true; end if;
 if evidence ? 'siteInputs' or evidence ? 'siteOutput' then return false; end if;
 v:=evidence->'audit';
 if jsonb_typeof(v) is distinct from 'object' or (select count(*) from jsonb_object_keys(v))<>4
  or not (v ?& array['schemaVersion','publicationId','publicationContentHash','archive'])
  or v->>'schemaVersion' is distinct from 'studio_costing_audit_archive.v1'
  or v->>'publicationId' is distinct from publication_id::text
  or jsonb_typeof(v->'publicationId') is distinct from 'string'
  or jsonb_typeof(v->'publicationContentHash') is distinct from 'string'
  or coalesce(v->>'publicationContentHash','') !~ '^[a-f0-9]{64}$'
  or v->>'publicationContentHash' is distinct from evidence#>>'{publication,contentHash}'
  or evidence#>>'{publication,schemaVersion}' is distinct from 'costing-provenance.v1'
  or evidence#>>'{publication,source}' is distinct from 'published'
  or evidence#>>'{publication,versionId}' is distinct from publication_id::text
  or octet_length(v::text)>16777216 then return false; end if;
 -- SQL verifies compressed representation and binding. Full bounded canonical
 -- decode and exact two-key logical audit validation remain in the Node owner.
 return private.studio_json_archive_valid(v->'archive','studio-costing-audit.v1');
exception when others then return false;
end $$;
revoke all on function private.studio_costing_audit_stored_valid(jsonb,uuid) from public,anon,authenticated,service_role;

-- Semantic retry ignores compression settings/bytes, not the complete decoded
-- audit identity or any other private evidence fields (including atomic intent).
create or replace function private.studio_evidence_retry_value(v jsonb) returns jsonb
language sql immutable set search_path=pg_catalog,pg_temp as $$
 with configuration as (
  select case when v#>>'{configuration,schemaVersion}'='studio_costing_configuration_archive.v1' then
   jsonb_set(v,'{configuration}',((v->'configuration')-'archive')||jsonb_build_object('archive',jsonb_build_object(
    'schemaVersion',v#>'{configuration,archive,schemaVersion}','kind',v#>'{configuration,archive,kind}',
    'decodedBytes',v#>'{configuration,archive,decodedBytes}','sha256',v#>'{configuration,archive,sha256}')))
   else v end as evidence
 )
 select case when evidence#>>'{audit,schemaVersion}'='studio_costing_audit_archive.v1' then
  jsonb_set(evidence,'{audit}',((evidence->'audit')-'archive')||jsonb_build_object('archive',jsonb_build_object(
   'schemaVersion',evidence#>'{audit,archive,schemaVersion}','kind',evidence#>'{audit,archive,kind}',
   'decodedBytes',evidence#>'{audit,archive,decodedBytes}','sha256',evidence#>'{audit,archive,sha256}')))
  else evidence end from configuration
$$;
revoke all on function private.studio_evidence_retry_value(jsonb) from public,anon,authenticated,service_role;

create or replace function public.studio_client_quote_prepare(
 p_project_id uuid,p_estimate_id uuid,p_actor_user_id uuid,p_snapshot_id uuid,
 p_expected_updated_at timestamptz,p_authored jsonb,p_spatial jsonb,p_publication_id uuid,
 p_content_hash text,p_handoff jsonb,p_private_evidence jsonb,p_customer_view jsonb,p_drawing_source jsonb
) returns table(snapshot_id uuid,prepared_at timestamptz)
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare e public.estimates%rowtype; previous text; saved_at timestamptz; replay private.studio_website_quote_snapshots%rowtype; item jsonb; kind text;
begin
 if not exists(select 1 from private.studio_client_document_control where singleton and enabled and p_project_id=any(project_ids)) then raise exception 'studio_client_documents_disabled'; end if;
 if not exists(select 1 from public.portal_users where user_id=p_actor_user_id and role in ('staff','admin')) then
  raise exception 'studio_staff_required' using errcode='42501'; end if;
 select * into e from public.estimates where id=p_estimate_id and project_id=p_project_id for update;
 if not found or e.status<>'draft' then raise exception 'studio_estimate_unavailable'; end if;
 if (p_drawing_source ? 'archive' or p_drawing_source->>'schemaVersion' like 'studio_client_document_archive.%')
  and not private.studio_drawing_archive_valid(p_drawing_source) then raise exception 'studio_client_document_invalid'; end if;
 if not private.studio_configuration_stored_valid(p_private_evidence->'configuration',p_publication_id,p_private_evidence#>>'{publication,contentHash}')
  then raise exception 'studio_client_document_invalid'; end if;
 if not private.studio_costing_audit_stored_valid(p_private_evidence,p_publication_id)
  then raise exception 'studio_costing_audit_invalid'; end if;
 select * into replay from private.studio_website_quote_snapshots where id=p_snapshot_id;
 if found then
  if replay.estimate_id is distinct from e.id or replay.actor_user_id is distinct from p_actor_user_id or replay.content_hash is distinct from p_content_hash or replay.customer_view is distinct from p_customer_view or replay.handoff is distinct from p_handoff or replay.authored is distinct from p_authored or replay.spatial is distinct from p_spatial or replay.publication_id is distinct from p_publication_id or private.studio_evidence_retry_value(replay.private_evidence) is distinct from private.studio_evidence_retry_value(p_private_evidence) then raise exception 'studio_prepare_intent_conflict'; end if;
  if not exists(select 1 from private.studio_client_document_sources d where d.snapshot_id=p_snapshot_id
   and private.studio_document_retry_value(d.drawing_source) is not distinct from private.studio_document_retry_value(p_drawing_source))
   then raise exception 'studio_prepare_intent_conflict'; end if;
  return query select replay.id,replay.created_at; return;
 end if;
 if exists(select 1 from public.quote_versions where source_estimate_version_id=e.id) then raise exception 'studio_estimate_referenced'; end if;
 if e.updated_at is distinct from p_expected_updated_at or e.outputs->'studio_authored' is distinct from p_authored
  or e.outputs->'drawing_object_first' is distinct from p_spatial then raise exception 'studio_stale' using errcode='PT409'; end if;
 perform 1 from public.costing_configuration_publication where singleton and current_version_id=p_publication_id for share;
 if not found then raise exception 'studio_publication_changed' using errcode='PT409'; end if;
 if p_snapshot_id is null or p_publication_id is null or p_content_hash is null or p_content_hash !~ '^[0-9a-f]{64}$'
  or jsonb_typeof(p_authored) is distinct from 'object' or jsonb_typeof(p_spatial) is distinct from 'object'
  or jsonb_typeof(p_private_evidence) is distinct from 'object' or jsonb_typeof(p_customer_view) is distinct from 'object'
  or jsonb_typeof(p_handoff) is distinct from 'object'
  or p_authored->>'schemaVersion' is distinct from 'studio_authored.v1'
  or p_customer_view->>'schemaVersion' is distinct from 'studio_quote_snapshot.v2'
  or p_handoff->>'schemaVersion' is distinct from 'studio_quote_snapshot.v2'
  or p_customer_view->>'snapshotId' is distinct from p_snapshot_id::text
  or p_handoff->>'snapshotId' is distinct from p_snapshot_id::text
  or p_customer_view->>'contentHash' is distinct from p_content_hash
  or p_handoff->>'contentHash' is distinct from p_content_hash
  or jsonb_typeof(p_customer_view->'images') is distinct from 'array'
  or jsonb_typeof(p_customer_view->'selections') is distinct from 'array'
  or jsonb_typeof(p_handoff->'lines') is distinct from 'array'
  or jsonb_typeof(p_handoff->'totalIncGstCents') is distinct from 'number'
  or jsonb_typeof(p_handoff->'source') is distinct from 'object'
  or octet_length(p_customer_view::text)>8388608 then raise exception 'studio_snapshot_invalid'; end if;
 if jsonb_array_length(p_customer_view->'images')<>0 or jsonb_array_length(p_handoff->'lines')<1
  or (p_handoff->>'totalIncGstCents')::bigint<=0
  or jsonb_typeof(p_drawing_source) is distinct from 'object'
  or coalesce(p_drawing_source->>'schemaVersion','') not in ('studio_client_document.v1','studio_client_document_archive.v1')
  or (p_drawing_source->>'schemaVersion'='studio_client_document_archive.v1' and not private.studio_drawing_archive_valid(p_drawing_source))
  or (p_drawing_source->>'schemaVersion'='studio_client_document.v1' and p_drawing_source ? 'archive')
  or p_drawing_source->>'rendererVersion' is distinct from 'studio-booklet.v1'
  or p_drawing_source->>'snapshotId' is distinct from p_snapshot_id::text
  or p_drawing_source->>'contentHash' is distinct from p_content_hash
  or jsonb_typeof(p_drawing_source->'products') is distinct from 'array'
  or jsonb_array_length(p_drawing_source->'products') not between 0 and 32
  or jsonb_typeof(p_private_evidence->'configuration') is distinct from 'object'
  or ((p_private_evidence->'configuration') ? 'archive' and not private.studio_configuration_archive_valid(p_private_evidence->'configuration',p_publication_id,p_private_evidence#>>'{publication,contentHash}'))
  or octet_length(p_drawing_source::text)>16777216
  then raise exception 'studio_client_document_invalid'; end if;
 for item in select value from jsonb_array_elements(p_handoff->'lines') loop
  if jsonb_typeof(item) is distinct from 'object' or coalesce(trim(item->>'description'),'')=''
   or item->'qty' is distinct from '1'::jsonb or jsonb_typeof(item->'sortOrder') is distinct from 'number'
   or jsonb_typeof(item->'unitPriceIncGstCents') is distinct from 'number'
   or item->'lineTotalIncGstCents' is distinct from item->'unitPriceIncGstCents'
   then raise exception 'studio_snapshot_lines_invalid'; end if;
  if (item->>'unitPriceIncGstCents')::numeric<0 or (item->>'unitPriceIncGstCents')::numeric<>trunc((item->>'unitPriceIncGstCents')::numeric)
   then raise exception 'studio_snapshot_lines_invalid'; end if;
 end loop;
 if (select sum((value->>'lineTotalIncGstCents')::bigint) from jsonb_array_elements(p_handoff->'lines')) is distinct from (p_handoff->>'totalIncGstCents')::bigint
  or exists(select 1 from jsonb_array_elements(p_handoff->'lines') with ordinality line(value,n) where (value->>'sortOrder')::numeric<>n-1)
  then raise exception 'studio_snapshot_lines_invalid'; end if;
 insert into private.studio_website_quote_snapshots(id,project_id,estimate_id,commercial_scope_id,actor_user_id,content_hash,
  authored,spatial,publication_id,handoff,private_evidence,customer_view)
 values(p_snapshot_id,e.project_id,e.id,e.commercial_scope_id,p_actor_user_id,p_content_hash,p_authored,p_spatial,p_publication_id,p_handoff,p_private_evidence,p_customer_view);
 insert into private.studio_client_document_sources(snapshot_id,renderer_version,drawing_source)
 values(p_snapshot_id,'studio-booklet.v1',p_drawing_source);
 previous:=current_setting('sanctuary.studio_command',true);
 perform set_config('sanctuary.studio_command','save',true);
 update public.estimates set outputs=outputs||jsonb_build_object('studio_quote_handoff',p_handoff),
  pricing_source='workbench_solved',pricing_source_metadata=jsonb_build_object('studioSnapshotId',p_snapshot_id,'studioSnapshotHash',p_content_hash,'studioDocumentMode','separate_v1'),
  updated_at=clock_timestamp() where id=e.id returning updated_at into saved_at;
 perform set_config('sanctuary.studio_command',coalesce(previous,''),true);
 return query select id,created_at from private.studio_website_quote_snapshots where id=p_snapshot_id;
end $$;
revoke all on function public.studio_client_quote_prepare(uuid,uuid,uuid,uuid,timestamptz,jsonb,jsonb,uuid,text,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.studio_client_quote_prepare(uuid,uuid,uuid,uuid,timestamptz,jsonb,jsonb,uuid,text,jsonb,jsonb,jsonb,jsonb) to service_role;

notify pgrst,'reload schema';
