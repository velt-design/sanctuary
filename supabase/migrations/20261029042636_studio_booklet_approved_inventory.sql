-- Owner-approved Studio drawing inventory. Historical sources and checkpoints
-- retain their original page count; only a frozen v3 manifest expands it.
create function private.studio_document_manifest_valid(v jsonb) returns boolean
language plpgsql immutable set search_path=pg_catalog,pg_temp as $$
declare manifest jsonb; product jsonb; page jsonb; cursor_index integer:=1; expected_kind text; expected_code text;
begin
 if jsonb_typeof(v) is distinct from 'object' then return false; end if;
 if not(v ? 'layoutVersion') then return not(v ? 'pageManifest'); end if;
 if jsonb_typeof(v->'layoutVersion') is distinct from 'string' then return false; end if;
 if v->>'layoutVersion'='studio-booklet-layout.v2' then return not(v ? 'pageManifest'); end if;
 if v->>'layoutVersion'<>'studio-booklet-layout.v3' then return false; end if;
 manifest:=v->'pageManifest';
 if jsonb_typeof(manifest) is distinct from 'array' or jsonb_array_length(manifest) not between 1 and 193
  or jsonb_typeof(v->'products') is distinct from 'array' or jsonb_array_length(v->'products')>32
  or (select count(distinct value->>'id') from jsonb_array_elements(v->'products'))<>jsonb_array_length(v->'products')
  or manifest->0 is distinct from '{"index":0,"key":"cover","kind":"cover","label":"Design overview and drawing register","code":"A00"}'::jsonb then return false; end if;
 for product in select value from jsonb_array_elements(v->'products') loop
  foreach expected_kind in array array['plan','iso','elevation','lighting','blind-plan','blind-elevation'] loop
   page:=manifest->cursor_index;
   if expected_kind='lighting' and page->>'kind' is distinct from 'lighting' then continue; end if;
   if expected_kind='blind-plan' and page->>'kind' is distinct from 'blind-plan' then continue; end if;
   if expected_kind='blind-elevation' and manifest->(cursor_index-1)->>'kind' is distinct from 'blind-plan' then continue; end if;
   expected_code:='A'||cursor_index::text;
   if cursor_index<10 then expected_code:='A0'||cursor_index::text; end if;
   if jsonb_typeof(page) is distinct from 'object' or (select count(*) from jsonb_object_keys(page))<>6
    or not(page ?& array['index','key','kind','objectId','label','code'])
    or page->'index' is distinct from to_jsonb(cursor_index)
    or page->>'kind' is distinct from expected_kind
    or page->>'objectId' is distinct from product->>'id'
    or page->>'key' is distinct from (product->>'id')||':'||expected_kind
    or page->>'code' is distinct from expected_code
    or jsonb_typeof(page->'label') is distinct from 'string' or length(page->>'label') not between 1 and 260 then return false; end if;
   cursor_index:=cursor_index+1;
  end loop;
 end loop;
 return cursor_index=jsonb_array_length(manifest);
exception when others then return false;
end $$;
revoke all on function private.studio_document_manifest_valid(jsonb) from public,anon,authenticated,service_role;

create function private.studio_document_total_pages(v jsonb) returns integer
language plpgsql immutable set search_path=pg_catalog,pg_temp as $$
begin
 if not private.studio_document_manifest_valid(v) then raise exception 'studio_document_inventory_invalid'; end if;
 if v->>'layoutVersion'='studio-booklet-layout.v3' then return jsonb_array_length(v->'pageManifest'); end if;
 return 1+2*jsonb_array_length(v->'products');
end $$;
revoke all on function private.studio_document_total_pages(jsonb) from public,anon,authenticated,service_role;

alter table private.studio_client_documents drop constraint studio_client_documents_total_pages_check;
alter table private.studio_client_documents add constraint studio_client_documents_total_pages_check check(total_pages between 1 and 193);

create function private.studio_drawing_archive_valid_pre_v3(v jsonb)
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
revoke all on function private.studio_drawing_archive_valid_pre_v3(jsonb) from public,anon,authenticated,service_role;

create or replace function private.studio_drawing_archive_valid(v jsonb) returns boolean
language plpgsql immutable set search_path=pg_catalog,pg_temp as $$
begin
 if v->>'layoutVersion'='studio-booklet-layout.v3' then
  return (select count(*) from jsonb_object_keys(v))=14
   and private.studio_document_manifest_valid(v)
   and private.studio_drawing_archive_valid_pre_v3(v-'layoutVersion'-'pageManifest');
 end if;
 return private.studio_document_manifest_valid(v) and private.studio_drawing_archive_valid_pre_v3(v);
exception when others then return false;
end $$;
revoke all on function private.studio_drawing_archive_valid(jsonb) from public,anon,authenticated,service_role;

create or replace function public.studio_client_quote_prepare(
 p_project_id uuid,p_estimate_id uuid,p_actor_user_id uuid,p_snapshot_id uuid,
 p_expected_updated_at timestamptz,p_authored jsonb,p_spatial jsonb,p_publication_id uuid,
 p_content_hash text,p_handoff jsonb,p_private_evidence jsonb,p_customer_view jsonb,p_drawing_source jsonb
) returns table(snapshot_id uuid,prepared_at timestamptz)
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare e public.estimates%rowtype; previous text; saved_at timestamptz; replay private.studio_website_quote_snapshots%rowtype; item jsonb; kind text;
begin
 if not private.studio_document_manifest_valid(p_drawing_source) then raise exception 'studio_document_inventory_invalid'; end if;
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

create or replace function public.studio_client_quote_commit(p_operation text,p_snapshot_id uuid,p_content_hash text,p_command jsonb)
returns public.quote_versions language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare s private.studio_website_quote_snapshots%rowtype; d private.studio_client_document_sources%rowtype; q public.quote_versions%rowtype; j public.background_jobs%rowtype; prior_stage text;
begin
 select * into s from private.studio_website_quote_snapshots where id=p_snapshot_id and content_hash=p_content_hash;
 select * into d from private.studio_client_document_sources where snapshot_id=p_snapshot_id;
 if s.id is null or d.snapshot_id is null or s.customer_view->>'schemaVersion'<>'studio_quote_snapshot.v2'
  or not exists(select 1 from private.studio_client_document_control where singleton and enabled and s.project_id=any(project_ids))
 then raise exception 'studio_client_document_unavailable'; end if;
 -- Serialize only new client-document commands on the same project before
 -- the canonical quote/address locks. Avoid two SHARE-to-UPDATE conversions.
 perform pg_advisory_xact_lock(hashtextextended('studio-client-quote-project:'||s.project_id::text,0));
 q:=public.studio_website_quote_commit_address(p_operation,p_snapshot_id,p_content_hash,p_command);
 if not exists(select 1 from private.studio_client_documents where snapshot_id=s.id) then
  insert into private.studio_client_documents(snapshot_id,project_id,quote_version_id,renderer_version,total_pages)
  values(s.id,s.project_id,q.id,d.renderer_version,private.studio_document_total_pages(d.drawing_source));
 end if;
 perform private.studio_client_document_enqueue(s.id);
 if p_operation='create' and not exists(select 1 from public.audit_events where idempotency_key='studio:quote-created:'||q.id::text) then
  select pipeline_stage into prior_stage from public.projects where id=s.project_id;
  update public.projects set pipeline_stage='QUOTING' where id=s.project_id;
  insert into public.audit_events(project_id,type,idempotency_key,payload) values
   (s.project_id,'pipeline.stage_changed','studio:quote-stage:'||q.id::text,jsonb_build_object('fromStage',prior_stage,'toStage','QUOTING','quoteId',q.id)),
   (s.project_id,'quote.created','studio:quote-created:'||q.id::text,coalesce(p_command->'p_studio_created_audit','{}'::jsonb)||jsonb_build_object('quoteVersionId',q.id));
 end if;
 return q;
end $$;

-- Capability filtering happens before queue visibility/read count mutation.
create or replace function private.background_job_read_claim_queue(p_visibility_timeout_seconds integer,p_batch_size integer)
returns table(msg_id bigint,message jsonb)
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare kinds jsonb; projects jsonb; versions jsonb;
begin
 versions:=coalesce(nullif(current_setting('sanctuary.studio_document_manifest_versions',true),'')::jsonb,'["legacy","studio-booklet-layout.v2"]'::jsonb);
 if jsonb_typeof(versions) is distinct from 'array' or jsonb_array_length(versions) not between 1 and 3 then raise exception 'invalid_document_manifest_capability'; end if;
 kinds:=nullif(current_setting('sanctuary.background_job_claim_kinds',true),'')::jsonb;
 projects:=nullif(current_setting('sanctuary.background_job_claim_projects',true),'')::jsonb;
 if (kinds is not null or projects is not null) and (jsonb_typeof(kinds) is distinct from 'array' or jsonb_array_length(kinds) not between 1 and 16
  or jsonb_typeof(projects) is distinct from 'array' or jsonb_array_length(projects) not between 1 and 32
 ) then raise exception 'invalid_background_job_claim_scope' using errcode='22023'; end if;
 return query
 with candidates as (
  select q.msg_id from pgmq.q_portal_background_jobs q
  left join public.background_jobs j on j.id::text=q.message->>'jobId'
  left join private.studio_client_document_sources d on d.snapshot_id::text=j.subject_id and j.subject_type='studio_snapshot'
  where q.vt<=clock_timestamp() and (
   (kinds is null and projects is null and j.kind is distinct from 'studio_design_booklet_v1')
   or (kinds ? j.kind and projects ? j.project_id::text and j.queue_message_id=q.msg_id))
  and (j.kind is distinct from 'studio_design_booklet_v1' or (d.snapshot_id is not null and versions ? (case when not(d.drawing_source ? 'layoutVersion') then 'legacy' when jsonb_typeof(d.drawing_source->'layoutVersion')='string' and d.drawing_source->>'layoutVersion' in ('studio-booklet-layout.v2','studio-booklet-layout.v3') then d.drawing_source->>'layoutVersion' else '' end)))
  order by q.msg_id limit p_batch_size for update of q skip locked
 ), touched as (
  update pgmq.q_portal_background_jobs q set vt=clock_timestamp()+make_interval(secs=>p_visibility_timeout_seconds),read_ct=q.read_ct+1
  from candidates c where q.msg_id=c.msg_id returning q.msg_id,q.message
 ) select t.msg_id,t.message from touched t order by t.msg_id;
end $$;
revoke all on function private.background_job_read_claim_queue(integer,integer) from public,anon,authenticated,service_role;

create function public.background_jobs_claim_documents(p_worker_id text,p_batch_size integer,p_visibility_timeout_seconds integer,p_kinds text[],p_project_ids uuid[],p_manifest_versions text[])
returns table(job_id uuid,kind text,contract_version integer,status public.background_job_status,current_phase text,attempt_number integer,max_attempts integer,queue_message_id bigint,lease_token uuid,lease_expires_at timestamptz,cancellation_requested_at timestamptz,rollout_mode public.background_job_rollout_mode,execution_owner public.background_job_execution_owner)
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare previous_versions text:=current_setting('sanctuary.studio_document_manifest_versions',true);
begin
 if p_kinds is distinct from array['studio_design_booklet_v1']::text[]
  or p_manifest_versions is null or cardinality(p_manifest_versions) not between 1 and 3
  or array_position(p_manifest_versions,null) is not null
  or exists(select 1 from unnest(p_manifest_versions) version where version not in ('legacy','studio-booklet-layout.v2','studio-booklet-layout.v3'))
 then raise exception 'invalid_document_manifest_capability' using errcode='22023'; end if;
 perform set_config('sanctuary.studio_document_manifest_versions',to_jsonb(p_manifest_versions)::text,true);
 return query select * from public.background_jobs_claim_scoped(p_worker_id,p_batch_size,p_visibility_timeout_seconds,p_kinds,p_project_ids);
 perform set_config('sanctuary.studio_document_manifest_versions',coalesce(previous_versions,''),true);
exception when others then
 perform set_config('sanctuary.studio_document_manifest_versions',coalesce(previous_versions,''),true);
 raise;
end $$;
revoke all on function public.background_jobs_claim_documents(text,integer,integer,text[],uuid[],text[]) from public,anon,authenticated;
grant execute on function public.background_jobs_claim_documents(text,integer,integer,text[],uuid[],text[]) to service_role;
