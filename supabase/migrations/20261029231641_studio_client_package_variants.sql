-- Generalise the existing immutable Studio document pipeline. No source or PDF is overwritten.
-- Service-only RPCs below are reached only after caller-RLS quote/project admission.
alter table private.studio_client_documents add column document_id uuid;
update private.studio_client_documents set document_id=snapshot_id;
alter table private.studio_client_documents alter column document_id set not null;
alter table private.studio_client_document_pages drop constraint studio_client_document_pages_snapshot_id_fkey;
alter table private.studio_client_documents drop constraint studio_client_documents_pkey;
alter table private.studio_client_documents add primary key(document_id);
alter table private.studio_client_documents add column variant_manifest jsonb, add column render_assets jsonb not null default '[]', add column variant_hash text;
create unique index studio_client_documents_base on private.studio_client_documents(snapshot_id) where variant_manifest is null;
create unique index studio_client_documents_variant on private.studio_client_documents(snapshot_id,variant_hash) where variant_manifest is not null;
alter table private.studio_client_document_pages rename column snapshot_id to document_id;
alter table private.studio_client_document_pages add foreign key(document_id) references private.studio_client_documents(document_id);
alter table private.studio_client_documents drop constraint studio_client_documents_total_pages_check;
alter table private.studio_client_documents add check(total_pages between 1 and 200);
alter table private.studio_client_document_pages drop constraint studio_client_document_pages_page_index_check;
alter table private.studio_client_document_pages add check(page_index between 0 and 199);

create or replace function private.studio_client_document_enqueue(p_snapshot_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare d private.studio_client_documents%rowtype; s private.studio_website_quote_snapshots%rowtype; j public.background_jobs%rowtype;
begin
 select * into d from private.studio_client_documents where document_id=p_snapshot_id for update;
 if d.snapshot_id is null or d.job_id is not null or d.file_id is not null then return; end if;
 if not exists(select 1 from private.studio_client_document_control where singleton and enabled and d.project_id=any(project_ids)) then raise exception 'studio_client_document_unavailable'; end if;
 select * into s from private.studio_website_quote_snapshots where id=d.snapshot_id;
 begin
  j:=private.background_job_enqueue_core('studio_design_booklet_v1',1,case when d.variant_manifest is null then 'studio_snapshot' else 'studio_document' end,d.document_id::text,s.project_id,s.actor_user_id,'staff',100::smallint,
   'studio-booklet:'||d.document_id::text||':'||d.renderer_version,jsonb_build_object('contractVersion',1,'snapshotId',s.id,'rendererVersion',d.renderer_version)||case when d.variant_manifest is null then '{}'::jsonb else jsonb_build_object('documentId',d.document_id,'variantVersion','studio-booklet-renders.v1') end,null,'worker_enabled','worker','studio-client-documents-local');
  update private.studio_client_documents set job_id=j.id,enqueue_failed=false where document_id=d.document_id;
 exception when others then
  update private.studio_client_documents set enqueue_failed=true where document_id=d.document_id;
 end;
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
 if private.studio_document_total_pages(d.drawing_source)>0 then
 if not exists(select 1 from private.studio_client_documents where snapshot_id=s.id and variant_manifest is null) then
  insert into private.studio_client_documents(document_id,snapshot_id,project_id,quote_version_id,renderer_version,total_pages)
  values(s.id,s.id,s.project_id,q.id,d.renderer_version,private.studio_document_total_pages(d.drawing_source));
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

create or replace function private.studio_client_document_owned(p_job_id uuid,p_worker_id text,p_lease_token uuid)
returns private.studio_client_documents language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare j public.background_jobs%rowtype; d private.studio_client_documents%rowtype;
begin
 j:=private.background_job_lock_owned(p_job_id,p_worker_id,p_lease_token);
 -- Cancellation is checked under the same job lock used by the request owner.
 if j.cancellation_requested_at is not null then raise exception 'studio_document_cancelled' using errcode='55000'; end if;
 select * into d from private.studio_client_documents where job_id=j.id for update;
 if j.kind<>'studio_design_booklet_v1' or d.snapshot_id is null or j.subject_type<>(case when d.variant_manifest is null then 'studio_snapshot' else 'studio_document' end)
  or j.subject_id<>d.document_id::text or j.project_id<>d.project_id
  or not exists(select 1 from private.studio_client_document_control where singleton and enabled and d.project_id=any(project_ids))
 then raise exception 'studio_document_job_mismatch' using errcode='42501'; end if;
 return d;
end $$;

create or replace function public.studio_client_document_worker_read(p_job_id uuid,p_worker_id text,p_lease_token uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare d private.studio_client_documents%rowtype;
begin
 d:=private.studio_client_document_owned(p_job_id,p_worker_id,p_lease_token);
 return jsonb_build_object('snapshotId',d.snapshot_id,'rendererVersion',d.renderer_version,'totalPages',d.total_pages,'readyFileId',d.file_id,
  'documentId',d.document_id,'variantVersion',case when d.variant_manifest is null then null else 'studio-booklet-renders.v1' end,'renders',d.render_assets,
  'source',(select drawing_source from private.studio_client_document_sources where snapshot_id=d.snapshot_id),
  'pages',coalesce((select jsonb_agg(jsonb_build_object('index',page_index,'sha256',content_hash,'contentBase64',content_base64) order by page_index) from private.studio_client_document_pages where document_id=d.document_id),'[]'::jsonb));
end $$;

create or replace function public.studio_client_document_page_stage(p_job_id uuid,p_worker_id text,p_lease_token uuid,p_page_index integer,p_content_base64 text,p_sha256 text)
returns integer language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare d private.studio_client_documents%rowtype; previous text; count_pages integer;
begin
 d:=private.studio_client_document_owned(p_job_id,p_worker_id,p_lease_token);
 if d.file_id is not null or p_page_index is null or p_page_index not between 0 and d.total_pages-1
  or p_content_base64 is null or length(p_content_base64)>16777216 or substring(decode(p_content_base64,'base64') from 1 for 5)<>convert_to('%PDF-','UTF8')
  or p_sha256 is null or encode(sha256(decode(p_content_base64,'base64')),'hex')<>p_sha256
 then raise exception 'studio_document_page_invalid'; end if;
 select content_hash into previous from private.studio_client_document_pages where document_id=d.document_id and page_index=p_page_index;
 if previous is not null and previous<>p_sha256 then raise exception 'studio_document_checkpoint_conflict'; end if;
 insert into private.studio_client_document_pages(document_id,page_index,content_hash,content_base64) values(d.document_id,p_page_index,p_sha256,p_content_base64) on conflict do nothing;
 select count(*) into count_pages from private.studio_client_document_pages where document_id=d.document_id;
 return count_pages;
end $$;

create or replace function public.studio_client_document_finish(p_job_id uuid,p_worker_id text,p_lease_token uuid,p_content_base64 text,p_sha256 text)
returns uuid language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare d private.studio_client_documents%rowtype; file_uuid uuid; filename text; previous_hash text;
begin
 d:=private.studio_client_document_owned(p_job_id,p_worker_id,p_lease_token);
 if p_content_base64 is null or length(p_content_base64)>33554432 or substring(decode(p_content_base64,'base64') from 1 for 5)<>convert_to('%PDF-','UTF8')
  or p_sha256 is null or encode(sha256(decode(p_content_base64,'base64')),'hex')<>p_sha256
  or (select count(*) from private.studio_client_document_pages where document_id=d.document_id)<>d.total_pages
 then raise exception 'studio_document_final_invalid'; end if;
 if d.file_id is not null then
  select encode(sha256(decode(content_base64,'base64')),'hex') into previous_hash from public.file_artifacts where id=d.file_id;
  if previous_hash<>p_sha256 then raise exception 'studio_document_final_conflict'; end if;
  return d.file_id;
 end if;
 select 'Sanctuary-Design-'||q.quote_ref||'-v'||v.version_number||case when d.variant_hash is null then '' else '-'||left(d.variant_hash,10) end||'.pdf' into filename from public.quote_versions v join public.quotes q on q.id=v.quote_id where v.id=d.quote_version_id;
 insert into public.file_artifacts(project_id,filename,content_type,size_bytes,content_base64,created_by)
 values(d.project_id,filename,'application/pdf',octet_length(decode(p_content_base64,'base64')),p_content_base64,'background:studio-documents') returning id into file_uuid;
 update private.studio_client_documents set file_id=file_uuid,completed_at=clock_timestamp() where document_id=d.document_id;
 return file_uuid;
end $$;

create or replace function private.background_job_read_claim_queue(p_visibility_timeout_seconds integer,p_batch_size integer)
returns table(msg_id bigint,message jsonb)
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare kinds jsonb; projects jsonb; versions jsonb;
begin
 versions:=coalesce(nullif(current_setting('sanctuary.studio_document_manifest_versions',true),'')::jsonb,'["legacy","studio-booklet-layout.v2"]'::jsonb);
 if jsonb_typeof(versions) is distinct from 'array' or jsonb_array_length(versions) not between 1 and 5 then raise exception 'invalid_document_manifest_capability'; end if;
 kinds:=nullif(current_setting('sanctuary.background_job_claim_kinds',true),'')::jsonb;
 projects:=nullif(current_setting('sanctuary.background_job_claim_projects',true),'')::jsonb;
 if (kinds is not null or projects is not null) and (jsonb_typeof(kinds) is distinct from 'array' or jsonb_array_length(kinds) not between 1 and 16
  or jsonb_typeof(projects) is distinct from 'array' or jsonb_array_length(projects) not between 1 and 52
 ) then raise exception 'invalid_background_job_claim_scope' using errcode='22023'; end if;
 return query
 with candidates as (
  select q.msg_id from pgmq.q_portal_background_jobs q
  left join public.background_jobs j on j.id::text=q.message->>'jobId'
  left join private.studio_client_documents doc on doc.document_id::text=j.subject_id and j.subject_type in ('studio_snapshot','studio_document')
  left join private.studio_client_document_sources d on d.snapshot_id=doc.snapshot_id
  where q.vt<=clock_timestamp() and (
   (kinds is null and projects is null and j.kind is distinct from 'studio_design_booklet_v1')
   or (kinds ? j.kind and projects ? j.project_id::text and j.queue_message_id=q.msg_id))
  and (j.kind is distinct from 'studio_design_booklet_v1' or (d.snapshot_id is not null and versions ? (case when doc.variant_manifest is not null then 'studio-booklet-renders.v1' when not(d.drawing_source ? 'layoutVersion') then 'legacy' when jsonb_typeof(d.drawing_source->'layoutVersion')='string' and d.drawing_source->>'layoutVersion' in ('studio-booklet-layout.v2','studio-booklet-layout.v3','studio-booklet-layout.v4') then d.drawing_source->>'layoutVersion' else '' end)))
  order by q.msg_id limit p_batch_size for update of q skip locked
 ), touched as (
  update pgmq.q_portal_background_jobs q set vt=clock_timestamp()+make_interval(secs=>p_visibility_timeout_seconds),read_ct=q.read_ct+1
  from candidates c where q.msg_id=c.msg_id returning q.msg_id,q.message
 ) select t.msg_id,t.message from touched t order by t.msg_id;
end $$;

create or replace function public.background_jobs_claim_documents(p_worker_id text,p_batch_size integer,p_visibility_timeout_seconds integer,p_kinds text[],p_project_ids uuid[],p_manifest_versions text[])
returns table(job_id uuid,kind text,contract_version integer,status public.background_job_status,current_phase text,attempt_number integer,max_attempts integer,queue_message_id bigint,lease_token uuid,lease_expires_at timestamptz,cancellation_requested_at timestamptz,rollout_mode public.background_job_rollout_mode,execution_owner public.background_job_execution_owner)
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare previous_versions text:=current_setting('sanctuary.studio_document_manifest_versions',true);
begin
 if p_kinds is distinct from array['studio_design_booklet_v1']::text[]
  or p_manifest_versions is null or cardinality(p_manifest_versions) not between 1 and 5
  or array_position(p_manifest_versions,null) is not null
  or exists(select 1 from unnest(p_manifest_versions) version where version not in ('legacy','studio-booklet-layout.v2','studio-booklet-layout.v3','studio-booklet-layout.v4','studio-booklet-renders.v1'))
 then raise exception 'invalid_document_manifest_capability' using errcode='22023'; end if;
 perform set_config('sanctuary.studio_document_manifest_versions',to_jsonb(p_manifest_versions)::text,true);
 return query select * from public.background_jobs_claim_scoped(p_worker_id,p_batch_size,p_visibility_timeout_seconds,p_kinds,p_project_ids);
 perform set_config('sanctuary.studio_document_manifest_versions',coalesce(previous_versions,''),true);
exception when others then
 perform set_config('sanctuary.studio_document_manifest_versions',coalesce(previous_versions,''),true);
 raise;
end $$;

-- Preserve the invoice restoration lock added by its later migration.
do $patch$
declare definition text; anchor text:='  if v_intent.status = ''finalised'' then';
begin
 definition:=pg_get_functiondef('public.commercial_email_mark_dispatching(uuid)'::regprocedure);
 if strpos(definition,anchor)=0 then raise exception 'Email dispatch owner changed'; end if;
 execute replace(definition,anchor,'  if v_intent.status = ''cancelled'' then raise exception ''Delivery was cancelled'' using errcode=''55000''; end if;'||chr(10)||anchor);
end $patch$;


create or replace function public.studio_client_document_status(p_quote_version_id uuid,p_actor_user_id uuid,p_download boolean default false)
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare d private.studio_client_documents%rowtype; j public.background_jobs%rowtype; completed integer; result jsonb; empty_source private.studio_client_document_sources%rowtype;
begin
 if not exists(select 1 from public.portal_users where user_id=p_actor_user_id and role in ('staff','admin')) then raise exception 'studio_staff_required' using errcode='42501'; end if;
 select g.* into d from private.studio_website_quote_bindings b join private.studio_client_documents g on g.snapshot_id=b.snapshot_id where b.quote_version_id=p_quote_version_id and g.variant_manifest is null;
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
 select count(*) into completed from private.studio_client_document_pages where document_id=d.document_id;
 result:=jsonb_build_object('snapshotId',d.snapshot_id,'documentId',d.document_id,'rendererVersion',d.renderer_version,'completedPages',completed,'totalPages',d.total_pages,
  'state',case when d.file_id is not null then 'ready' when d.enqueue_failed or j.status in ('needs_attention','permanent_failed','cancelled') then 'failed' when j.status='queued' then 'queued' else 'running' end,
  'percent',case when d.file_id is not null then 100 else floor(completed*100.0/(d.total_pages+1)) end,
  'canRetry',d.file_id is null and (d.enqueue_failed or (j.status in ('needs_attention','permanent_failed') and j.attempt_count<4)));
 if p_download and d.file_id is not null then result:=result||jsonb_build_object('file',(select jsonb_build_object('filename',filename,'contentBase64',content_base64) from public.file_artifacts where id=d.file_id and project_id=d.project_id)); end if;
 return result;
end $$;

create function private.studio_document_identity_guard() returns trigger
language plpgsql set search_path=pg_catalog,pg_temp as $$
begin
 if (new.document_id,new.snapshot_id,new.project_id,new.quote_version_id,new.renderer_version,new.total_pages,new.variant_manifest,new.render_assets,new.variant_hash)
 is distinct from (old.document_id,old.snapshot_id,old.project_id,old.quote_version_id,old.renderer_version,old.total_pages,old.variant_manifest,old.render_assets,old.variant_hash)
 then raise exception 'studio_document_identity_immutable'; end if;
 return new;
end $$;
create trigger studio_document_identity_immutable before update on private.studio_client_documents for each row execute function private.studio_document_identity_guard();
revoke all on function private.studio_document_identity_guard() from public,anon,authenticated,service_role;

create function public.studio_client_document_variant_status(p_quote_version_id uuid,p_actor_user_id uuid,p_document_id uuid,p_download boolean default false)
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare d private.studio_client_documents%rowtype; j public.background_jobs%rowtype; completed integer; result jsonb;
begin
 if not exists(select 1 from public.portal_users where user_id=p_actor_user_id and role in ('staff','admin')) then raise exception 'studio_staff_required' using errcode='42501'; end if;
 select g.* into d from private.studio_website_quote_bindings b join private.studio_client_documents g on g.snapshot_id=b.snapshot_id
 where b.quote_version_id=p_quote_version_id and g.quote_version_id=p_quote_version_id and g.document_id=p_document_id;
 if not found then return null; end if;
 select * into j from public.background_jobs where id=d.job_id;
 select count(*) into completed from private.studio_client_document_pages where document_id=d.document_id;
 result:=jsonb_build_object('snapshotId',d.snapshot_id,'documentId',d.document_id,'rendererVersion',d.renderer_version,'completedPages',completed,'totalPages',d.total_pages,
 'state',case when d.file_id is not null then 'ready' when d.enqueue_failed or j.status in ('needs_attention','permanent_failed','cancelled') then 'failed' when j.status='queued' then 'queued' else 'running' end,
 'percent',case when d.file_id is not null then 100 else floor(completed*100.0/(d.total_pages+1)) end,
 'canRetry',d.file_id is null and (d.enqueue_failed or (j.status in ('needs_attention','permanent_failed') and j.attempt_count<4)));
 if p_download and d.file_id is not null then result:=result||jsonb_build_object('file',(select jsonb_build_object('id',id,'filename',filename,'contentType',content_type,'sizeBytes',size_bytes,'sha256',encode(sha256(decode(content_base64,'base64')),'hex'),'contentBase64',content_base64) from public.file_artifacts where id=d.file_id and project_id=d.project_id)); end if;
 return result;
end $$;
revoke all on function public.studio_client_document_variant_status(uuid,uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.studio_client_document_variant_status(uuid,uuid,uuid,boolean) to service_role;

create function public.studio_client_document_variant_retry(p_quote_version_id uuid,p_document_id uuid,p_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare d private.studio_client_documents%rowtype; j public.background_jobs%rowtype;
begin
 if not exists(select 1 from public.portal_users where user_id=p_actor_user_id and role in ('staff','admin')) then raise exception 'studio_staff_required' using errcode='42501'; end if;
 select g.* into d from private.studio_website_quote_bindings b join private.studio_client_documents g on g.snapshot_id=b.snapshot_id where b.quote_version_id=p_quote_version_id and g.quote_version_id=p_quote_version_id and g.document_id=p_document_id;
 if not found or d.file_id is not null or not exists(select 1 from private.studio_client_document_control where singleton and enabled and d.project_id=any(project_ids)) then raise exception 'studio_document_retry_unavailable'; end if;
 if d.job_id is null then perform private.studio_client_document_enqueue(d.document_id); return public.studio_client_document_variant_status(p_quote_version_id,p_actor_user_id,p_document_id,false); end if;
 select * into j from public.background_jobs where id=d.job_id for update;
 select * into d from private.studio_client_documents where document_id=p_document_id for update;
 if d.file_id is not null or j.status not in ('needs_attention','permanent_failed') or j.attempt_count>=4 then raise exception 'studio_document_retry_unavailable'; end if;
 perform public.background_job_manual_retry(j.id,p_actor_user_id);
 return public.studio_client_document_variant_status(p_quote_version_id,p_actor_user_id,p_document_id,false);
end $$;
revoke all on function public.studio_client_document_variant_retry(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.studio_client_document_variant_retry(uuid,uuid,uuid) to service_role;

-- Backward three-argument operations always address the original base document.
create or replace function public.studio_client_document_retry(p_quote_version_id uuid,p_snapshot_id uuid,p_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
begin
 if not exists(select 1 from private.studio_website_quote_bindings b join private.studio_client_documents d on d.snapshot_id=b.snapshot_id where b.quote_version_id=p_quote_version_id and b.snapshot_id=p_snapshot_id and d.document_id=p_snapshot_id and d.variant_manifest is null) then raise exception 'studio_document_retry_unavailable'; end if;
 return public.studio_client_document_variant_retry(p_quote_version_id,p_snapshot_id,p_actor_user_id);
end $$;

create function public.studio_client_document_variant_prepare(p_quote_version_id uuid,p_actor_user_id uuid,p_file_ids uuid[])
returns uuid language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare b private.studio_website_quote_bindings%rowtype; source private.studio_client_document_sources%rowtype; base private.studio_client_documents%rowtype; f public.file_artifacts%rowtype; asset jsonb; assets jsonb:='[]'; manifest jsonb; digest text; doc_id uuid; total_bytes integer:=0; fid uuid; bound_project uuid;
begin
 if not exists(select 1 from public.portal_users where user_id=p_actor_user_id and role in ('staff','admin')) then raise exception 'studio_staff_required' using errcode='42501'; end if;
 select * into strict b from private.studio_website_quote_bindings where quote_version_id=p_quote_version_id;
 select * into source from private.studio_client_document_sources where snapshot_id=b.snapshot_id;
 select * into base from private.studio_client_documents where snapshot_id=b.snapshot_id and variant_manifest is null;
 select s.project_id into bound_project from private.studio_website_quote_snapshots s join public.quote_versions v on v.id=p_quote_version_id join public.quotes q on q.id=v.quote_id and q.project_id=s.project_id where s.id=b.snapshot_id;
 if bound_project is null or not exists(select 1 from private.studio_client_document_control where singleton and enabled and bound_project=any(project_ids)) then raise exception 'studio_client_document_unavailable'; end if;
 if p_file_ids is null or cardinality(p_file_ids)>8 or array_position(p_file_ids,null) is not null or (select count(distinct id) from unnest(p_file_ids) id)<>cardinality(p_file_ids) then raise exception 'studio_render_selection_invalid'; end if;
 if cardinality(p_file_ids)=0 then return base.document_id; end if;
 if base.document_id is null or source.drawing_source->>'layoutVersion' is distinct from 'studio-booklet-layout.v4' then raise exception 'studio_variant_unavailable'; end if;
 foreach fid in array p_file_ids loop
  select * into f from public.file_artifacts where id=fid and project_id=base.project_id;
  if not found or f.content_type not in ('image/png','image/jpeg') or f.size_bytes not between 1 and 2097152 or octet_length(decode(f.content_base64,'base64'))<>f.size_bytes then raise exception 'studio_render_unavailable'; end if;
  total_bytes:=total_bytes+f.size_bytes;if total_bytes>4194304 then raise exception 'studio_render_selection_too_large'; end if;
  asset:=jsonb_build_object('fileId',f.id,'label',left(f.filename,120),'contentType',f.content_type,'sha256',encode(sha256(decode(f.content_base64,'base64')),'hex'));
  assets:=assets||jsonb_build_array(asset||jsonb_build_object('contentBase64',f.content_base64));
 end loop;
 manifest:=jsonb_build_object('schemaVersion','studio-booklet-renders.v1','snapshotId',b.snapshot_id,'sourceContentHash',source.drawing_source->>'contentHash','assets',(select jsonb_agg(value-'contentBase64' order by n) from jsonb_array_elements(assets) with ordinality a(value,n)));
 digest:=encode(sha256(convert_to(manifest::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended('studio-booklet-variant:'||b.snapshot_id::text||':'||digest,0));
 select document_id into doc_id from private.studio_client_documents where snapshot_id=b.snapshot_id and variant_hash=digest;
 if doc_id is not null then return doc_id; end if;
 doc_id:=gen_random_uuid();
 insert into private.studio_client_documents(document_id,snapshot_id,project_id,quote_version_id,renderer_version,total_pages,variant_manifest,render_assets,variant_hash)
 values(doc_id,b.snapshot_id,base.project_id,p_quote_version_id,base.renderer_version,base.total_pages+cardinality(p_file_ids),manifest,assets,digest);
 perform private.studio_client_document_enqueue(doc_id);return doc_id;
end $$;
revoke all on function public.studio_client_document_variant_prepare(uuid,uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.studio_client_document_variant_prepare(uuid,uuid,uuid[]) to service_role;
