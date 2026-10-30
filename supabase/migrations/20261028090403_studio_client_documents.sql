-- New image-independent Studio documents only. Applying this migration enables
-- no producer/worker and changes no historical Studio snapshot or customer PDF.
insert into public.background_job_kinds(kind,contract_version,handler_owner,max_attempts,timeout_seconds,concurrency_class,has_external_side_effect,required_effect_kinds,cancellation_allowed,default_rollout_mode,active,allowed_effect_kinds)
values('studio_design_booklet_v1',1,'studio-client-documents',3,600,'documents',false,'{}',true,'disabled',true,'{}');

create table private.studio_client_document_control(
 singleton boolean primary key default true check(singleton),enabled boolean not null default false,
 project_ids uuid[] not null default '{}',check(not enabled or cardinality(project_ids)>0)
);
insert into private.studio_client_document_control(singleton) values(true);
create table private.studio_client_document_sources(
 snapshot_id uuid primary key references private.studio_website_quote_snapshots(id),
 renderer_version text not null check(renderer_version='studio-booklet.v1'),
 drawing_source jsonb not null check(jsonb_typeof(drawing_source)='object' and octet_length(drawing_source::text)<=16777216)
);
create trigger studio_client_source_immutable before update or delete on private.studio_client_document_sources
for each row execute function private.studio_snapshot_immutable();
create table private.studio_client_documents(
 snapshot_id uuid primary key references private.studio_client_document_sources(snapshot_id),
 project_id uuid not null references public.projects(id),quote_version_id uuid not null references public.quote_versions(id),
 renderer_version text not null,job_id uuid unique references public.background_jobs(id),
 total_pages integer not null check(total_pages between 1 and 65),file_id uuid references public.file_artifacts(id),
 enqueue_failed boolean not null default false,created_at timestamptz not null default clock_timestamp(),completed_at timestamptz
);
create table private.studio_client_document_pages(
 snapshot_id uuid not null references private.studio_client_documents(snapshot_id),page_index integer not null check(page_index between 0 and 64),
 content_hash text not null check(content_hash~'^[a-f0-9]{64}$'),content_base64 text not null check(length(content_base64)<=16777216),
 created_at timestamptz not null default clock_timestamp(),primary key(snapshot_id,page_index)
);
alter table private.studio_client_document_control enable row level security;
alter table private.studio_client_document_sources enable row level security;
alter table private.studio_client_documents enable row level security;
alter table private.studio_client_document_pages enable row level security;
revoke all on private.studio_client_document_control,private.studio_client_document_sources,private.studio_client_documents,private.studio_client_document_pages from public,anon,authenticated,service_role;
create function public.studio_client_document_capability(p_project_id uuid,p_actor_user_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 select exists(select 1 from public.portal_users where user_id=p_actor_user_id and role in ('staff','admin'))
  and exists(select 1 from private.studio_client_document_control where singleton and enabled and p_project_id=any(project_ids))
$$;
revoke all on function public.studio_client_document_capability(uuid,uuid) from public,anon,authenticated;
grant execute on function public.studio_client_document_capability(uuid,uuid) to service_role;

-- The v2 preparation below retains the existing snapshot/estimate/publication,
-- replay and exact commercial-line guards. Only its versioned image-free input
-- and frozen drawing source differ; the original v1 entry remains untouched.
create function public.studio_client_quote_prepare(
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
 select * into replay from private.studio_website_quote_snapshots where id=p_snapshot_id;
 if found then
  if replay.estimate_id is distinct from e.id or replay.actor_user_id is distinct from p_actor_user_id or replay.content_hash is distinct from p_content_hash or replay.customer_view is distinct from p_customer_view or replay.handoff is distinct from p_handoff or replay.authored is distinct from p_authored or replay.spatial is distinct from p_spatial or replay.publication_id is distinct from p_publication_id or replay.private_evidence is distinct from p_private_evidence then raise exception 'studio_prepare_intent_conflict'; end if;
  if not exists(select 1 from private.studio_client_document_sources d where d.snapshot_id=p_snapshot_id
   and (d.drawing_source-'issuedAt'-'issuedDate') is not distinct from (p_drawing_source-'issuedAt'-'issuedDate'))
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
  or p_drawing_source->>'schemaVersion' is distinct from 'studio_client_document.v1'
  or p_drawing_source->>'rendererVersion' is distinct from 'studio-booklet.v1'
  or p_drawing_source->>'snapshotId' is distinct from p_snapshot_id::text
  or p_drawing_source->>'contentHash' is distinct from p_content_hash
  or jsonb_typeof(p_drawing_source->'products') is distinct from 'array'
  or jsonb_array_length(p_drawing_source->'products') not between 0 and 32
  or jsonb_typeof(p_private_evidence->'configuration') is distinct from 'object'
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

-- A committed snapshot always has durable intent. Queue unavailability cannot
-- roll back a valid quote; the same intent can be admitted by explicit retry.
create function private.studio_client_document_enqueue(p_snapshot_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare d private.studio_client_documents%rowtype; s private.studio_website_quote_snapshots%rowtype; j public.background_jobs%rowtype;
begin
 select * into d from private.studio_client_documents where snapshot_id=p_snapshot_id for update;
 if d.snapshot_id is null or d.job_id is not null or d.file_id is not null then return; end if;
 if not exists(select 1 from private.studio_client_document_control where singleton and enabled and d.project_id=any(project_ids)) then raise exception 'studio_client_document_unavailable'; end if;
 select * into s from private.studio_website_quote_snapshots where id=d.snapshot_id;
 begin
  j:=private.background_job_enqueue_core('studio_design_booklet_v1',1,'studio_snapshot',s.id::text,s.project_id,s.actor_user_id,'staff',100::smallint,
   'studio-booklet:'||s.id::text||':'||d.renderer_version,jsonb_build_object('contractVersion',1,'snapshotId',s.id,'rendererVersion',d.renderer_version),null,'worker_enabled','worker','studio-client-documents-local');
  update private.studio_client_documents set job_id=j.id,enqueue_failed=false where snapshot_id=d.snapshot_id;
 exception when others then
  update private.studio_client_documents set enqueue_failed=true where snapshot_id=d.snapshot_id;
 end;
end $$;
revoke all on function private.studio_client_document_enqueue(uuid) from public,anon,authenticated,service_role;

create function public.studio_client_quote_commit(p_operation text,p_snapshot_id uuid,p_content_hash text,p_command jsonb)
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
  values(s.id,s.project_id,q.id,d.renderer_version,1+2*jsonb_array_length(d.drawing_source->'products'));
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
revoke all on function public.studio_client_quote_commit(text,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.studio_client_quote_commit(text,uuid,text,jsonb) to service_role;

create function private.studio_client_document_owned(p_job_id uuid,p_worker_id text,p_lease_token uuid)
returns private.studio_client_documents language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare j public.background_jobs%rowtype; d private.studio_client_documents%rowtype;
begin
 j:=private.background_job_lock_owned(p_job_id,p_worker_id,p_lease_token);
 -- Cancellation is checked under the same job lock used by the request owner.
 if j.cancellation_requested_at is not null then raise exception 'studio_document_cancelled' using errcode='55000'; end if;
 select * into d from private.studio_client_documents where job_id=j.id for update;
 if j.kind<>'studio_design_booklet_v1' or d.snapshot_id is null or j.subject_type<>'studio_snapshot'
  or j.subject_id<>d.snapshot_id::text or j.project_id<>d.project_id
  or not exists(select 1 from private.studio_client_document_control where singleton and enabled and d.project_id=any(project_ids))
 then raise exception 'studio_document_job_mismatch' using errcode='42501'; end if;
 return d;
end $$;
revoke all on function private.studio_client_document_owned(uuid,text,uuid) from public,anon,authenticated,service_role;

create function public.studio_client_document_worker_read(p_job_id uuid,p_worker_id text,p_lease_token uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare d private.studio_client_documents%rowtype;
begin
 d:=private.studio_client_document_owned(p_job_id,p_worker_id,p_lease_token);
 return jsonb_build_object('snapshotId',d.snapshot_id,'rendererVersion',d.renderer_version,'totalPages',d.total_pages,'readyFileId',d.file_id,
  'source',(select drawing_source from private.studio_client_document_sources where snapshot_id=d.snapshot_id),
  'pages',coalesce((select jsonb_agg(jsonb_build_object('index',page_index,'sha256',content_hash,'contentBase64',content_base64) order by page_index) from private.studio_client_document_pages where snapshot_id=d.snapshot_id),'[]'::jsonb));
end $$;
revoke all on function public.studio_client_document_worker_read(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.studio_client_document_worker_read(uuid,text,uuid) to service_role;

create function public.studio_client_document_page_stage(p_job_id uuid,p_worker_id text,p_lease_token uuid,p_page_index integer,p_content_base64 text,p_sha256 text)
returns integer language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare d private.studio_client_documents%rowtype; previous text; count_pages integer;
begin
 d:=private.studio_client_document_owned(p_job_id,p_worker_id,p_lease_token);
 if d.file_id is not null or p_page_index is null or p_page_index not between 0 and d.total_pages-1
  or p_content_base64 is null or length(p_content_base64)>16777216 or substring(decode(p_content_base64,'base64') from 1 for 5)<>convert_to('%PDF-','UTF8')
  or p_sha256 is null or encode(sha256(decode(p_content_base64,'base64')),'hex')<>p_sha256
 then raise exception 'studio_document_page_invalid'; end if;
 select content_hash into previous from private.studio_client_document_pages where snapshot_id=d.snapshot_id and page_index=p_page_index;
 if previous is not null and previous<>p_sha256 then raise exception 'studio_document_checkpoint_conflict'; end if;
 insert into private.studio_client_document_pages(snapshot_id,page_index,content_hash,content_base64) values(d.snapshot_id,p_page_index,p_sha256,p_content_base64) on conflict do nothing;
 select count(*) into count_pages from private.studio_client_document_pages where snapshot_id=d.snapshot_id;
 return count_pages;
end $$;
revoke all on function public.studio_client_document_page_stage(uuid,text,uuid,integer,text,text) from public,anon,authenticated;
grant execute on function public.studio_client_document_page_stage(uuid,text,uuid,integer,text,text) to service_role;

create function public.studio_client_document_finish(p_job_id uuid,p_worker_id text,p_lease_token uuid,p_content_base64 text,p_sha256 text)
returns uuid language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare d private.studio_client_documents%rowtype; file_uuid uuid; filename text; previous_hash text;
begin
 d:=private.studio_client_document_owned(p_job_id,p_worker_id,p_lease_token);
 if p_content_base64 is null or length(p_content_base64)>33554432 or substring(decode(p_content_base64,'base64') from 1 for 5)<>convert_to('%PDF-','UTF8')
  or p_sha256 is null or encode(sha256(decode(p_content_base64,'base64')),'hex')<>p_sha256
  or (select count(*) from private.studio_client_document_pages where snapshot_id=d.snapshot_id)<>d.total_pages
 then raise exception 'studio_document_final_invalid'; end if;
 if d.file_id is not null then
  select encode(sha256(decode(content_base64,'base64')),'hex') into previous_hash from public.file_artifacts where id=d.file_id;
  if previous_hash<>p_sha256 then raise exception 'studio_document_final_conflict'; end if;
  return d.file_id;
 end if;
 select 'Sanctuary-Design-'||q.quote_ref||'-v'||v.version_number||'.pdf' into filename from public.quote_versions v join public.quotes q on q.id=v.quote_id where v.id=d.quote_version_id;
 insert into public.file_artifacts(project_id,filename,content_type,size_bytes,content_base64,created_by)
 values(d.project_id,filename,'application/pdf',octet_length(decode(p_content_base64,'base64')),p_content_base64,'background:studio-documents') returning id into file_uuid;
 update private.studio_client_documents set file_id=file_uuid,completed_at=clock_timestamp() where snapshot_id=d.snapshot_id;
 return file_uuid;
end $$;
revoke all on function public.studio_client_document_finish(uuid,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.studio_client_document_finish(uuid,text,uuid,text,text) to service_role;

create function public.studio_client_document_status(p_quote_version_id uuid,p_actor_user_id uuid,p_download boolean default false)
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare d private.studio_client_documents%rowtype; j public.background_jobs%rowtype; completed integer; result jsonb;
begin
 if not exists(select 1 from public.portal_users where user_id=p_actor_user_id and role in ('staff','admin')) then raise exception 'studio_staff_required' using errcode='42501'; end if;
 select g.* into d from private.studio_website_quote_bindings b join private.studio_client_documents g on g.snapshot_id=b.snapshot_id where b.quote_version_id=p_quote_version_id;
 if not found then return null; end if;
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

create function public.studio_client_document_retry(p_quote_version_id uuid,p_snapshot_id uuid,p_actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare d private.studio_client_documents%rowtype; j public.background_jobs%rowtype;
begin
 if not exists(select 1 from public.portal_users where user_id=p_actor_user_id and role in ('staff','admin')) then raise exception 'studio_staff_required' using errcode='42501'; end if;
 select g.* into d from private.studio_website_quote_bindings b join private.studio_client_documents g on g.snapshot_id=b.snapshot_id where b.quote_version_id=p_quote_version_id and b.snapshot_id=p_snapshot_id;
 if not found or d.file_id is not null or not exists(select 1 from private.studio_client_document_control where singleton and enabled and d.project_id=any(project_ids)) then raise exception 'studio_document_retry_unavailable'; end if;
 if d.job_id is null then
  perform private.studio_client_document_enqueue(d.snapshot_id);
  return public.studio_client_document_status(p_quote_version_id,p_actor_user_id,false);
 end if;
 -- Match the lease helper lock order: job, then generation.
 select * into j from public.background_jobs where id=d.job_id for update;
 select g.* into d from private.studio_website_quote_bindings b join private.studio_client_documents g on g.snapshot_id=b.snapshot_id where b.quote_version_id=p_quote_version_id and b.snapshot_id=p_snapshot_id for update of g;
 if not found or d.file_id is not null then raise exception 'studio_document_retry_unavailable'; end if;
 if j.status not in ('needs_attention','permanent_failed') or j.attempt_count>=4 then raise exception 'studio_document_retry_unavailable'; end if;
 perform public.background_job_manual_retry(j.id,p_actor_user_id);
 return public.studio_client_document_status(p_quote_version_id,p_actor_user_id,false);
end $$;
revoke all on function public.studio_client_document_retry(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.studio_client_document_retry(uuid,uuid,uuid) to service_role;
