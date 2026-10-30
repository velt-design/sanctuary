-- Quote-context drafts are private; no raw client or service table privileges.
create table private.studio_client_package_drafts(
 quote_version_id uuid primary key references public.quote_versions(id),project_id uuid not null references public.projects(id),
 revision integer not null default 0 check(revision>=0),value jsonb not null,
 document_id uuid references private.studio_client_documents(document_id),
 prepared_intent_id uuid references private.commercial_email_intents(id),prepared_revision integer,
 updated_at timestamptz not null default clock_timestamp()
);
alter table private.studio_client_package_drafts enable row level security;
revoke all on private.studio_client_package_drafts from public,anon,authenticated,service_role;

create function private.studio_package_assert(p_quote_version_id uuid,p_actor_user_id uuid) returns uuid
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare project uuid;
begin
 if not exists(select 1 from public.portal_users where user_id=p_actor_user_id and role in ('staff','admin')) then raise exception 'studio_staff_required' using errcode='42501'; end if;
 select q.project_id into project from public.quote_versions v join public.quotes q on q.id=v.quote_id join private.studio_website_quote_bindings b on b.quote_version_id=v.id where v.id=p_quote_version_id;
 if project is null or not exists(select 1 from private.studio_client_document_control where singleton and enabled and project=any(project_ids)) then raise exception 'studio_package_unavailable'; end if;
 return project;
end $$;
revoke all on function private.studio_package_assert(uuid,uuid) from public,anon,authenticated,service_role;

create function public.studio_client_package_read(p_quote_version_id uuid,p_actor_user_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare project uuid; draft private.studio_client_package_drafts%rowtype;
begin
 project:=private.studio_package_assert(p_quote_version_id,p_actor_user_id);
 select * into draft from private.studio_client_package_drafts where quote_version_id=p_quote_version_id;
 return case when draft.quote_version_id is null then null else jsonb_build_object('revision',draft.revision,'value',draft.value,'documentId',draft.document_id,'preparedIntentId',draft.prepared_intent_id,'preparedRevision',draft.prepared_revision) end;
end $$;
revoke all on function public.studio_client_package_read(uuid,uuid) from public,anon,authenticated;
grant execute on function public.studio_client_package_read(uuid,uuid) to service_role;

create function public.studio_client_package_save(p_quote_version_id uuid,p_actor_user_id uuid,p_expected_revision integer,p_value jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare project uuid; draft private.studio_client_package_drafts%rowtype; doc uuid; item jsonb;
begin
 project:=private.studio_package_assert(p_quote_version_id,p_actor_user_id);
 perform pg_advisory_xact_lock(hashtextextended('studio-package:'||p_quote_version_id::text,0));
 select * into draft from private.studio_client_package_drafts where quote_version_id=p_quote_version_id for update;
 if coalesce(draft.revision,0) is distinct from p_expected_revision then raise exception 'studio_package_stale' using errcode='PT409'; end if;
 if draft.prepared_intent_id is not null then raise exception 'Cancel the prepared email before editing this package' using errcode='PT409'; end if;
 if jsonb_typeof(p_value) is distinct from 'object' or (select count(*) from jsonb_object_keys(p_value))<>6
 or not(p_value ?& array['to','subject','message','includeBooklet','renderFileIds','fileIds'])
 or jsonb_typeof(p_value->'to')<>'string' or length(p_value->>'to')>320
 or jsonb_typeof(p_value->'subject')<>'string' or length(p_value->>'subject')>200
 or jsonb_typeof(p_value->'message')<>'string' or length(p_value->>'message')>10000
 or jsonb_typeof(p_value->'includeBooklet')<>'boolean' or jsonb_typeof(p_value->'renderFileIds')<>'array' or jsonb_array_length(p_value->'renderFileIds')>8
 or jsonb_typeof(p_value->'fileIds')<>'array' or jsonb_array_length(p_value->'fileIds')>9 then raise exception 'studio_package_invalid'; end if;
 if exists(select 1 from jsonb_array_elements_text(p_value->'renderFileIds') a(id) join jsonb_array_elements_text(p_value->'fileIds') b(id) using(id)) then raise exception 'Rendered views belong inside the design booklet'; end if;
 for item in select value from jsonb_array_elements(p_value->'fileIds') loop
  if not exists(select 1 from public.file_artifacts where id=(item#>>'{}')::uuid and project_id=project) then raise exception 'studio_package_file_unavailable'; end if;
 end loop;
 doc:=public.studio_client_document_variant_prepare(p_quote_version_id,p_actor_user_id,array(select value::uuid from jsonb_array_elements_text(p_value->'renderFileIds')));
 insert into private.studio_client_package_drafts(quote_version_id,project_id,revision,value,document_id)
 values(p_quote_version_id,project,1,p_value,doc)
 on conflict(quote_version_id) do update set revision=studio_client_package_drafts.revision+1,value=p_value,document_id=doc,updated_at=clock_timestamp();
 return public.studio_client_package_read(p_quote_version_id,p_actor_user_id);
end $$;
revoke all on function public.studio_client_package_save(uuid,uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.studio_client_package_save(uuid,uuid,integer,jsonb) to service_role;

-- Exact immutable source for optional presentation capture, never the mutable estimate.
create function public.studio_client_package_frozen_source(p_quote_version_id uuid,p_actor_user_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare project uuid;
begin
 project:=private.studio_package_assert(p_quote_version_id,p_actor_user_id);
 return(select s.handoff->'source' from private.studio_website_quote_bindings b join private.studio_website_quote_snapshots s on s.id=b.snapshot_id where b.quote_version_id=p_quote_version_id and s.project_id=project);
end $$;
revoke all on function public.studio_client_package_frozen_source(uuid,uuid) from public,anon,authenticated;
grant execute on function public.studio_client_package_frozen_source(uuid,uuid) to service_role;

-- Only the exact unattempted preparation may be reopened. Attempted delivery is immutable.
create function public.studio_client_package_cancel(p_quote_version_id uuid,p_actor_user_id uuid,p_expected_revision integer,p_intent_id uuid,p_payload_hash text,p_commercial_revision bigint) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare project uuid; q public.quote_versions%rowtype; draft private.studio_client_package_drafts%rowtype; intent private.commercial_email_intents%rowtype; previous text;
begin
 if p_quote_version_id is null or p_actor_user_id is null or p_expected_revision is null or p_expected_revision<1 or p_intent_id is null or p_payload_hash is null or p_payload_hash !~ '^[a-f0-9]{64}$' or p_commercial_revision is null or p_commercial_revision<1 then raise exception 'studio_package_cancel_invalid'; end if;
 project:=private.studio_package_assert(p_quote_version_id,p_actor_user_id);
 select * into strict q from public.quote_versions where id=p_quote_version_id;
 perform pg_advisory_xact_lock(hashtextextended('commercial-quote:'||q.quote_id::text,0));
 select * into strict q from public.quote_versions where id=p_quote_version_id for update;
 select * into strict draft from private.studio_client_package_drafts where quote_version_id=p_quote_version_id for update;
 if draft.revision is distinct from p_expected_revision or draft.prepared_revision is distinct from draft.revision or draft.prepared_intent_id is distinct from p_intent_id or q.commercial_revision is distinct from p_commercial_revision or q.status is distinct from 'DRAFT' then raise exception 'studio_package_stale' using errcode='PT409'; end if;
 select * into strict intent from private.commercial_email_intents where id=p_intent_id for update;
 if intent.kind is distinct from 'quote_send' or intent.subject_id is distinct from q.id or intent.project_id is distinct from project or intent.payload_hash is distinct from p_payload_hash or intent.status is distinct from 'prepared' or intent.attempt_count is distinct from 0 or (intent.protected_payload->>'commercialRevision')::bigint is distinct from p_commercial_revision or intent.provider_message_id is not null or intent.provider_accepted_at is not null then raise exception 'Delivery has already been attempted. Use its existing recovery controls.' using errcode='PT409'; end if;
 previous:=current_setting('sanctuary.studio_package_cancel',true);perform set_config('sanctuary.studio_package_cancel',intent.id::text,true);
 update private.commercial_email_intents set status='cancelled' where id=intent.id;
 perform set_config('sanctuary.studio_package_cancel',coalesce(previous,''),true);
 update private.studio_client_package_drafts set prepared_intent_id=null,prepared_revision=null,revision=revision+1 where quote_version_id=q.id;
 update public.quote_versions set delivery_prepared_at=null,is_current_draft=not exists(select 1 from public.quote_versions newer where newer.quote_id=q.quote_id and newer.id<>q.id and (newer.version_number>q.version_number or newer.is_current_draft)) where id=q.id;
 return public.studio_client_package_read(p_quote_version_id,p_actor_user_id);
end $$;
revoke all on function public.studio_client_package_cancel(uuid,uuid,integer,uuid,text,bigint) from public,anon,authenticated;
grant execute on function public.studio_client_package_cancel(uuid,uuid,integer,uuid,text,bigint) to service_role;

-- Add narrow quote cancellation without changing the invoice-generation guard.
do $patch$
declare definition text; anchor text:='new.status=''cancelled'' and new.kind<>''deposit_invoice_send''';
begin
 definition:=pg_get_functiondef('private.invoice_email_generation_guard()'::regprocedure);
 if strpos(definition,anchor)=0 then raise exception 'Email cancellation guard changed'; end if;
 execute replace(definition,anchor,anchor||' and not((new.kind=''quote_send'' and old.status=''prepared'' and old.attempt_count=0 and old.provider_message_id is null and old.provider_accepted_at is null and current_setting(''sanctuary.studio_package_cancel'',true)=old.id::text) is true)');
end $patch$;
-- Bind canonical preparation atomically to the exact persisted package and ready file identities.
do $patch$
declare definition text; anchor text:='  select prepared.id'; insertion text;
begin
 definition:=pg_get_functiondef('public.commercial_quote_prepare_delivery_email(uuid,bigint,text,text,uuid,uuid,text,jsonb,timestamptz)'::regprocedure);
 if strpos(definition,anchor)=0 then raise exception 'Quote preparation owner changed'; end if;
 insertion:=$body$
  if p_protected_payload ? 'studioPackage' then
    perform private.studio_package_assert(p_quote_version_id,(p_protected_payload#>>'{studioPackage,actorUserId}')::uuid);
    perform 1 from private.studio_client_package_drafts draft
    where draft.quote_version_id=p_quote_version_id and draft.revision=(p_protected_payload#>>'{studioPackage,revision}')::integer
      and draft.value=p_protected_payload#>'{studioPackage,value}'
      and draft.document_id is not distinct from nullif(p_protected_payload#>>'{studioPackage,documentId}','')::uuid
      and draft.prepared_intent_id is null
    for update;
    if not found then raise exception 'studio_package_stale' using errcode='40001'; end if;
    if p_protected_payload#>'{studioPackage,value,includeBooklet}'='true'::jsonb and not exists(
      select 1 from private.studio_client_documents d where d.document_id=(p_protected_payload#>>'{studioPackage,documentId}')::uuid
      and d.quote_version_id=p_quote_version_id and d.file_id is not null
      and p_protected_payload->'attachmentFileIds'->>1=d.file_id::text
    ) then raise exception 'The selected design booklet is not ready'; end if;
    if (p_protected_payload->'attachmentFileIds') is distinct from (
      jsonb_build_array(p_protected_payload->'attachmentFileIds'->0)
      ||(case when p_protected_payload#>'{studioPackage,value,includeBooklet}'='true'::jsonb then jsonb_build_array(p_protected_payload->'attachmentFileIds'->1) else '[]'::jsonb end)
      ||(p_protected_payload#>'{studioPackage,value,fileIds}'))
    then raise exception 'studio_package_attachments_changed'; end if;
  end if;
$body$;
 execute replace(replace(definition,anchor,insertion||chr(10)||anchor),'  return query select v_intent_id;',
 '  if p_protected_payload ? ''studioPackage'' then update private.studio_client_package_drafts set prepared_intent_id=v_intent_id,prepared_revision=revision where quote_version_id=p_quote_version_id; end if;'||chr(10)||'  return query select v_intent_id;');
end $patch$;
notify pgrst,'reload schema';

create function public.studio_client_package_files(p_quote_version_id uuid,p_actor_user_id uuid,p_offset integer default 0) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare project uuid; selected uuid[]; result jsonb; more boolean;
begin
 project:=private.studio_package_assert(p_quote_version_id,p_actor_user_id);
 if p_offset is null or p_offset<0 or p_offset>10000 or p_offset%100<>0 then raise exception 'studio_package_file_page_invalid'; end if;
 select array(select value::uuid from jsonb_array_elements_text(draft.value->'fileIds'))||array(select value::uuid from jsonb_array_elements_text(draft.value->'renderFileIds')) into selected from private.studio_client_package_drafts draft where quote_version_id=p_quote_version_id;
 with recent as (select * from public.file_artifacts where project_id=project and content_type in ('application/pdf','image/png','image/jpeg','image/webp') order by created_at desc,id desc offset p_offset limit 100),
 chosen as (select * from recent union select * from public.file_artifacts where project_id=project and id=any(coalesce(selected,'{}'::uuid[])))
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'filename',filename,'contentType',content_type,'sizeBytes',size_bytes,'sha256',encode(sha256(decode(content_base64,'base64')),'hex'),'renderEligible',content_type in ('image/png','image/jpeg') and size_bytes<=2097152) order by created_at desc,id desc),'[]'::jsonb) into result from chosen;
 select exists(select 1 from public.file_artifacts where project_id=project and content_type in ('application/pdf','image/png','image/jpeg','image/webp') order by created_at desc,id desc offset p_offset+100 limit 1) into more;
 return jsonb_build_object('files',result,'hasMore',more,'offset',p_offset);
end $$;
revoke all on function public.studio_client_package_files(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.studio_client_package_files(uuid,uuid,integer) to service_role;

-- A package preview/download/retry must still name the exact desired immutable document.
create function public.studio_client_package_document(p_quote_version_id uuid,p_actor_user_id uuid,p_expected_revision integer,p_document_id uuid,p_download boolean default false,p_retry boolean default false) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare project uuid; draft private.studio_client_package_drafts%rowtype; base uuid; result jsonb;
begin
 project:=private.studio_package_assert(p_quote_version_id,p_actor_user_id);
 if p_expected_revision is null or p_expected_revision<0 or p_document_id is null or p_download is null or p_retry is null then raise exception 'studio_package_document_invalid'; end if;
 select * into draft from private.studio_client_package_drafts where quote_version_id=p_quote_version_id for share;
 if found then
  if draft.revision is distinct from p_expected_revision or draft.document_id is distinct from p_document_id then raise exception 'studio_package_stale' using errcode='PT409'; end if;
 else
  select d.document_id into base from private.studio_website_quote_bindings b join private.studio_client_documents d on d.snapshot_id=b.snapshot_id and d.variant_manifest is null where b.quote_version_id=p_quote_version_id;
  if p_expected_revision<>0 or base is distinct from p_document_id then raise exception 'studio_package_stale' using errcode='PT409'; end if;
 end if;
 if p_retry then result:=public.studio_client_document_variant_retry(p_quote_version_id,p_document_id,p_actor_user_id);
 else result:=public.studio_client_document_variant_status(p_quote_version_id,p_actor_user_id,p_document_id,p_download); end if;
 if result is null or (p_download and result->>'state' is distinct from 'ready') then raise exception 'The selected design booklet is not ready'; end if;
 return result||jsonb_build_object('packageRevision',p_expected_revision);
end $$;
revoke all on function public.studio_client_package_document(uuid,uuid,integer,uuid,boolean,boolean) from public,anon,authenticated;
grant execute on function public.studio_client_package_document(uuid,uuid,integer,uuid,boolean,boolean) to service_role;
