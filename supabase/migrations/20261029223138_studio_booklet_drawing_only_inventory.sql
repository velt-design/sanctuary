-- New drawing-only v4 jobs begin with the first annotated pergola plan.
-- Preserve frozen legacy/v2/v3 sources, checkpoints, 193-page storage capacity,
-- default old-worker capability and pre-claim scope filtering. No data rewrite.
create or replace function private.studio_document_manifest_valid(v jsonb) returns boolean
language plpgsql immutable set search_path=pg_catalog,pg_temp as $$
declare manifest jsonb; product jsonb; page jsonb; cursor_index integer:=1; expected_kind text; expected_code text; drawing_only boolean;
begin
 if jsonb_typeof(v) is distinct from 'object' then return false; end if;
 if not(v ? 'layoutVersion') then return not(v ? 'pageManifest'); end if;
 if jsonb_typeof(v->'layoutVersion') is distinct from 'string' then return false; end if;
 if v->>'layoutVersion'='studio-booklet-layout.v2' then return not(v ? 'pageManifest'); end if;
 if v->>'layoutVersion' not in ('studio-booklet-layout.v3','studio-booklet-layout.v4') then return false; end if;
 drawing_only:=v->>'layoutVersion'='studio-booklet-layout.v4';
 if drawing_only then cursor_index:=0; end if;
 manifest:=v->'pageManifest';
 if jsonb_typeof(manifest) is distinct from 'array' or jsonb_array_length(manifest) not between (case when drawing_only then 0 else 1 end) and (case when drawing_only then 192 else 193 end)
  or jsonb_typeof(v->'products') is distinct from 'array' or jsonb_array_length(v->'products')>32
  or (select count(distinct value->>'id') from jsonb_array_elements(v->'products'))<>jsonb_array_length(v->'products')
  or (not drawing_only and manifest->0 is distinct from '{"index":0,"key":"cover","kind":"cover","label":"Design overview and drawing register","code":"A00"}'::jsonb) then return false; end if;
 for product in select value from jsonb_array_elements(v->'products') loop
  foreach expected_kind in array array['plan','iso','elevation','lighting','blind-plan','blind-elevation'] loop
   page:=manifest->cursor_index;
   if expected_kind='lighting' and page->>'kind' is distinct from 'lighting' then continue; end if;
   if expected_kind='blind-plan' and page->>'kind' is distinct from 'blind-plan' then continue; end if;
   if expected_kind='blind-elevation' and manifest->(cursor_index-1)->>'kind' is distinct from 'blind-plan' then continue; end if;
   expected_code:='A'||(cursor_index+(case when drawing_only then 1 else 0 end))::text;
   if cursor_index+(case when drawing_only then 1 else 0 end)<10 then expected_code:='A0'||(cursor_index+(case when drawing_only then 1 else 0 end))::text; end if;
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

create or replace function private.studio_document_total_pages(v jsonb) returns integer
language plpgsql immutable set search_path=pg_catalog,pg_temp as $$
begin
 if not private.studio_document_manifest_valid(v) then raise exception 'studio_document_inventory_invalid'; end if;
 if v->>'layoutVersion' in ('studio-booklet-layout.v3','studio-booklet-layout.v4') then return jsonb_array_length(v->'pageManifest'); end if;
 return 1+2*jsonb_array_length(v->'products');
end $$;
revoke all on function private.studio_document_total_pages(jsonb) from public,anon,authenticated,service_role;

create or replace function private.studio_drawing_archive_valid(v jsonb) returns boolean
language plpgsql immutable set search_path=pg_catalog,pg_temp as $$
begin
 if v->>'layoutVersion' in ('studio-booklet-layout.v3','studio-booklet-layout.v4') then
  return (select count(*) from jsonb_object_keys(v))=14
   and private.studio_document_manifest_valid(v)
   and private.studio_drawing_archive_valid_pre_v3(v-'layoutVersion'-'pageManifest');
 end if;
 return private.studio_document_manifest_valid(v) and private.studio_drawing_archive_valid_pre_v3(v);
exception when others then return false;
end $$;
revoke all on function private.studio_drawing_archive_valid(jsonb) from public,anon,authenticated,service_role;

-- Capability filtering happens before queue visibility/read count mutation.
create or replace function private.background_job_read_claim_queue(p_visibility_timeout_seconds integer,p_batch_size integer)
returns table(msg_id bigint,message jsonb)
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare kinds jsonb; projects jsonb; versions jsonb;
begin
 versions:=coalesce(nullif(current_setting('sanctuary.studio_document_manifest_versions',true),'')::jsonb,'["legacy","studio-booklet-layout.v2"]'::jsonb);
 if jsonb_typeof(versions) is distinct from 'array' or jsonb_array_length(versions) not between 1 and 4 then raise exception 'invalid_document_manifest_capability'; end if;
 kinds:=nullif(current_setting('sanctuary.background_job_claim_kinds',true),'')::jsonb;
 projects:=nullif(current_setting('sanctuary.background_job_claim_projects',true),'')::jsonb;
 if (kinds is not null or projects is not null) and (jsonb_typeof(kinds) is distinct from 'array' or jsonb_array_length(kinds) not between 1 and 16
  or jsonb_typeof(projects) is distinct from 'array' or jsonb_array_length(projects) not between 1 and 42
 ) then raise exception 'invalid_background_job_claim_scope' using errcode='22023'; end if;
 return query
 with candidates as (
  select q.msg_id from pgmq.q_portal_background_jobs q
  left join public.background_jobs j on j.id::text=q.message->>'jobId'
  left join private.studio_client_document_sources d on d.snapshot_id::text=j.subject_id and j.subject_type='studio_snapshot'
  where q.vt<=clock_timestamp() and (
   (kinds is null and projects is null and j.kind is distinct from 'studio_design_booklet_v1')
   or (kinds ? j.kind and projects ? j.project_id::text and j.queue_message_id=q.msg_id))
  and (j.kind is distinct from 'studio_design_booklet_v1' or (d.snapshot_id is not null and versions ? (case when not(d.drawing_source ? 'layoutVersion') then 'legacy' when jsonb_typeof(d.drawing_source->'layoutVersion')='string' and d.drawing_source->>'layoutVersion' in ('studio-booklet-layout.v2','studio-booklet-layout.v3','studio-booklet-layout.v4') then d.drawing_source->>'layoutVersion' else '' end)))
  order by q.msg_id limit p_batch_size for update of q skip locked
 ), touched as (
  update pgmq.q_portal_background_jobs q set vt=clock_timestamp()+make_interval(secs=>p_visibility_timeout_seconds),read_ct=q.read_ct+1
  from candidates c where q.msg_id=c.msg_id returning q.msg_id,q.message
 ) select t.msg_id,t.message from touched t order by t.msg_id;
end $$;
revoke all on function private.background_job_read_claim_queue(integer,integer) from public,anon,authenticated,service_role;

create or replace function public.background_jobs_claim_documents(p_worker_id text,p_batch_size integer,p_visibility_timeout_seconds integer,p_kinds text[],p_project_ids uuid[],p_manifest_versions text[])
returns table(job_id uuid,kind text,contract_version integer,status public.background_job_status,current_phase text,attempt_number integer,max_attempts integer,queue_message_id bigint,lease_token uuid,lease_expires_at timestamptz,cancellation_requested_at timestamptz,rollout_mode public.background_job_rollout_mode,execution_owner public.background_job_execution_owner)
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare previous_versions text:=current_setting('sanctuary.studio_document_manifest_versions',true);
begin
 if p_kinds is distinct from array['studio_design_booklet_v1']::text[]
  or p_manifest_versions is null or cardinality(p_manifest_versions) not between 1 and 4
  or array_position(p_manifest_versions,null) is not null
  or exists(select 1 from unnest(p_manifest_versions) version where version not in ('legacy','studio-booklet-layout.v2','studio-booklet-layout.v3','studio-booklet-layout.v4'))
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

-- A financial-only quote retains its frozen source but creates no empty PDF/job.
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
 if private.studio_document_total_pages(d.drawing_source)>0 then
 if not exists(select 1 from private.studio_client_documents where snapshot_id=s.id) then
  insert into private.studio_client_documents(snapshot_id,project_id,quote_version_id,renderer_version,total_pages)
  values(s.id,s.project_id,q.id,d.renderer_version,private.studio_document_total_pages(d.drawing_source));
 end if;
 perform private.studio_client_document_enqueue(s.id);
 end if;
 if p_operation='create' and not exists(select 1 from public.audit_events where idempotency_key='studio:quote-created:'||q.id::text) then
  select pipeline_stage into prior_stage from public.projects where id=s.project_id;
  update public.projects set pipeline_stage='QUOTING' where id=s.project_id;
  insert into public.audit_events(project_id,type,idempotency_key,payload) values
   (s.project_id,'pipeline.stage_changed','studio:quote-stage:'||q.id::text,jsonb_build_object('fromStage',prior_stage,'toStage','QUOTING','quoteId',q.id)),
   (s.project_id,'quote.created','studio:quote-created:'||q.id::text,coalesce(p_command->'p_studio_created_audit','{}'::jsonb)||jsonb_build_object('quoteVersionId',q.id));
 end if;
 return q;
end $$;

create or replace function public.studio_client_document_status(p_quote_version_id uuid,p_actor_user_id uuid,p_download boolean default false)
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare d private.studio_client_documents%rowtype; j public.background_jobs%rowtype; completed integer; result jsonb; empty_source private.studio_client_document_sources%rowtype;
begin
 if not exists(select 1 from public.portal_users where user_id=p_actor_user_id and role in ('staff','admin')) then raise exception 'studio_staff_required' using errcode='42501'; end if;
 select g.* into d from private.studio_website_quote_bindings b join private.studio_client_documents g on g.snapshot_id=b.snapshot_id where b.quote_version_id=p_quote_version_id;
 if not found then
  select g.* into empty_source from private.studio_website_quote_bindings b
   join private.studio_client_document_sources g on g.snapshot_id=b.snapshot_id
   where b.quote_version_id=p_quote_version_id and g.drawing_source->>'layoutVersion'='studio-booklet-layout.v4';
  if found and private.studio_document_total_pages(empty_source.drawing_source)=0 then
   return jsonb_build_object('snapshotId',empty_source.snapshot_id,'rendererVersion',empty_source.renderer_version,
    'completedPages',0,'totalPages',0,'state','unavailable','percent',0,'canRetry',false);
  end if;
  return null;
 end if;
 select * into j from public.background_jobs where id=d.job_id;
 select count(*) into completed from private.studio_client_document_pages where snapshot_id=d.snapshot_id;
 result:=jsonb_build_object('snapshotId',d.snapshot_id,'rendererVersion',d.renderer_version,'completedPages',completed,'totalPages',d.total_pages,
  'state',case when d.file_id is not null then 'ready' when d.enqueue_failed or j.status in ('needs_attention','permanent_failed','cancelled') then 'failed' when j.status='queued' then 'queued' else 'running' end,
  'percent',case when d.file_id is not null then 100 else floor(completed*100.0/(d.total_pages+1)) end,
  'canRetry',d.file_id is null and (d.enqueue_failed or (j.status in ('needs_attention','permanent_failed') and j.attempt_count<4)));
 if p_download and d.file_id is not null then result:=result||jsonb_build_object('file',(select jsonb_build_object('filename',filename,'contentBase64',content_base64) from public.file_artifacts where id=d.file_id and project_id=d.project_id)); end if;
 return result;
end $$;
revoke all on function public.studio_client_document_status(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.studio_client_document_status(uuid,uuid,boolean) to service_role;

