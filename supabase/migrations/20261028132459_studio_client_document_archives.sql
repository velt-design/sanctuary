-- Lossless private transport only. Logical source/render versions and all
-- canonical role, Save/CAS, publication, financial and address guards remain.
create function private.studio_json_archive_valid(v jsonb,expected_kind text)
returns boolean language plpgsql immutable set search_path=pg_catalog,pg_temp as $$
declare encoded text; compressed bytea; raw_count numeric; zipped_count numeric;
begin
 if jsonb_typeof(v) is distinct from 'object' or (select count(*) from jsonb_object_keys(v))<>8
  or not(v ?& array['schemaVersion','kind','encoding','decodedBytes','compressedBytes','sha256','compressedSha256','contentBase64'])
  or v->>'schemaVersion' is distinct from 'studio_json_gzip.v1' or v->>'kind' is distinct from expected_kind or v->>'encoding' is distinct from 'gzip-base64'
  or jsonb_typeof(v->'decodedBytes') is distinct from 'number' or jsonb_typeof(v->'compressedBytes') is distinct from 'number'
  or coalesce(v->>'sha256','') !~ '^[a-f0-9]{64}$' or coalesce(v->>'compressedSha256','') !~ '^[a-f0-9]{64}$'
  or jsonb_typeof(v->'contentBase64') is distinct from 'string' or octet_length(v::text)>16777216 then return false; end if;
 raw_count:=(v->>'decodedBytes')::numeric; zipped_count:=(v->>'compressedBytes')::numeric;
 if raw_count<1 or raw_count>16777216 or raw_count<>trunc(raw_count) or zipped_count<20 or zipped_count>16777216 or zipped_count<>trunc(zipped_count) then return false; end if;
 encoded:=v->>'contentBase64';
 if length(encoded)>16773120 or encoded !~ '^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$' then return false; end if;
 compressed:=decode(encoded,'base64');
 if octet_length(compressed)<>zipped_count or replace(encode(compressed,'base64'),chr(10),'') is distinct from encoded or get_byte(compressed,0)<>31 or get_byte(compressed,1)<>139
  or encode(sha256(compressed),'hex') is distinct from v->>'compressedSha256' then return false; end if;
 return true;
exception when others then return false;
end $$;
revoke all on function private.studio_json_archive_valid(jsonb,text) from public,anon,authenticated,service_role;

create function private.studio_drawing_archive_valid(v jsonb)
returns boolean language plpgsql immutable set search_path=pg_catalog,pg_temp as $$
declare product jsonb; logical_count numeric;
begin
 if jsonb_typeof(v) is distinct from 'object' or (select count(*) from jsonb_object_keys(v))<>12
  or not(v ?& array['schemaVersion','sourceSchemaVersion','rendererVersion','snapshotId','contentHash','designVersionLabel','products','issuedAt','issuedDate','logicalBytes','logicalSha256','archive'])
  or v->>'schemaVersion' is distinct from 'studio_client_document_archive.v1' or v->>'sourceSchemaVersion' is distinct from 'studio_client_document.v1'
  or v->>'rendererVersion' is distinct from 'studio-booklet.v1' or coalesce(v->>'logicalSha256','') !~ '^[a-f0-9]{64}$'
  or jsonb_typeof(v->'logicalBytes') is distinct from 'number' or jsonb_typeof(v->'products') is distinct from 'array'
  or jsonb_typeof(v->'snapshotId') is distinct from 'string' or jsonb_typeof(v->'contentHash') is distinct from 'string'
  or coalesce(v->>'designVersionLabel','') !~ '^V[1-9][0-9]*(\.[0-9]+)?$' or length(v->>'designVersionLabel')>32
  or jsonb_typeof(v->'issuedAt') is distinct from 'string' or length(v->>'issuedAt')>64
  or jsonb_typeof(v->'issuedDate') is distinct from 'string' or length(v->>'issuedDate')>64
  or jsonb_array_length(v->'products')>32 or octet_length(v::text)>16777216
  or not private.studio_json_archive_valid(v->'archive','studio-drawing-core.v1') then return false; end if;
 logical_count:=(v->>'logicalBytes')::numeric;
 if logical_count<1 or logical_count>16777216 or logical_count<>trunc(logical_count) then return false; end if;
 for product in select value from jsonb_array_elements(v->'products') loop
  if jsonb_typeof(product) is distinct from 'object' or (select count(*) from jsonb_object_keys(product))<>3
   or not(product ?& array['id','code','label']) or jsonb_typeof(product->'id') is distinct from 'string'
   or jsonb_typeof(product->'code') is distinct from 'string' or jsonb_typeof(product->'label') is distinct from 'string'
   or length(product->>'id') not between 1 and 200 or length(product->>'code') not between 1 and 200 or length(product->>'label') not between 1 and 200 then return false; end if;
 end loop;
 return true;
exception when others then return false;
end $$;
revoke all on function private.studio_drawing_archive_valid(jsonb) from public,anon,authenticated,service_role;

create function private.studio_configuration_archive_valid(v jsonb,publication_id uuid,publication_hash text)
returns boolean language plpgsql immutable set search_path=pg_catalog,pg_temp as $$
declare n numeric;
begin
 if jsonb_typeof(v) is distinct from 'object' or (select count(*) from jsonb_object_keys(v))<>5
  or not(v ?& array['schemaVersion','versionId','versionNumber','contentHash','archive'])
  or v->>'schemaVersion' is distinct from 'studio_costing_configuration_archive.v1'
  or v->>'versionId' is distinct from publication_id::text or v->>'contentHash' is distinct from publication_hash
  or coalesce(v->>'contentHash','') !~ '^[a-f0-9]{64}$' or jsonb_typeof(v->'versionNumber') is distinct from 'number'
  or octet_length(v::text)>16777216 or not private.studio_json_archive_valid(v->'archive','studio-costing-configuration.v1') then return false; end if;
 n:=(v->>'versionNumber')::numeric;return n>=1 and n<=9007199254740991 and n=trunc(n);
exception when others then return false;
end $$;
revoke all on function private.studio_configuration_archive_valid(jsonb,uuid,text) from public,anon,authenticated,service_role;

create function private.studio_configuration_stored_valid(v jsonb,publication_id uuid,publication_hash text)
returns boolean language plpgsql immutable set search_path=pg_catalog,pg_temp as $$
declare n numeric;
begin
 if jsonb_typeof(v) is distinct from 'object' then return false; end if;
 if v ? 'archive' or v->>'schemaVersion' like 'studio_costing_configuration_archive.%' then
  return private.studio_configuration_archive_valid(v,publication_id,publication_hash);
 end if;
 -- Historical plain records remain plain. An unknown archive cannot qualify
 -- merely because the outer JSON value happens to be an object.
 if v->>'id' is distinct from publication_id::text or v->>'contentHash' is distinct from publication_hash
  or v->>'status' is distinct from 'published' or jsonb_typeof(v->'config') is distinct from 'object'
  or jsonb_typeof(v->'versionNumber') is distinct from 'number' then return false; end if;
 n:=(v->>'versionNumber')::numeric;return n>=1 and n<=9007199254740991 and n=trunc(n);
exception when others then return false;
end $$;
revoke all on function private.studio_configuration_stored_valid(jsonb,uuid,text) from public,anon,authenticated,service_role;

-- The compressed core excludes these two intentionally reissuable date fields.
-- Whole-logical hash/size are derived from them and must not redefine retry.
create function private.studio_document_retry_value(v jsonb) returns jsonb
language sql immutable set search_path=pg_catalog,pg_temp as $$
 select case when v->>'schemaVersion'='studio_client_document_archive.v1' then
  (v-'issuedAt'-'issuedDate'-'logicalSha256'-'logicalBytes'-'archive')||jsonb_build_object('archive',jsonb_build_object(
    'schemaVersion',v#>'{archive,schemaVersion}','kind',v#>'{archive,kind}','decodedBytes',v#>'{archive,decodedBytes}','sha256',v#>'{archive,sha256}'))
  else v-'issuedAt'-'issuedDate' end
$$;
revoke all on function private.studio_document_retry_value(jsonb) from public,anon,authenticated,service_role;

create function private.studio_evidence_retry_value(v jsonb) returns jsonb
language sql immutable set search_path=pg_catalog,pg_temp as $$
 select case when v#>>'{configuration,schemaVersion}'='studio_costing_configuration_archive.v1' then
  jsonb_set(v,'{configuration}',((v->'configuration')-'archive')||jsonb_build_object('archive',jsonb_build_object(
   'schemaVersion',v#>'{configuration,archive,schemaVersion}','kind',v#>'{configuration,archive,kind}',
   'decodedBytes',v#>'{configuration,archive,decodedBytes}','sha256',v#>'{configuration,archive,sha256}')))
  else v end
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
