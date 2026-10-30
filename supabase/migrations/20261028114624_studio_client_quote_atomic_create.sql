-- One admitted Studio Create action. Existing Save, snapshot, financial and
-- address owners remain authoritative; this wrapper only removes remote hops.
create function private.studio_client_quote_created_result(p_quote_version_id uuid)
returns jsonb language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 select jsonb_build_object('versionRow',to_jsonb(q)||jsonb_build_object('quotes',to_jsonb(f)),
  'lineItems',coalesce((select jsonb_agg(to_jsonb(l) order by l.sort_order) from public.quote_line_items l where l.quote_version_id=q.id),'[]'::jsonb),
  'sendLogs',coalesce((select jsonb_agg(to_jsonb(l) order by l.created_at desc) from public.quote_send_logs l where l.quote_version_id=q.id),'[]'::jsonb),
  'studioDesign',s.customer_view,'estimateVersionLabel',d.drawing_source->>'designVersionLabel',
  'saveReceipt',s.private_evidence->'atomicSaveReceipt','savedView',s.handoff->'source',
  'sourceUpdatedAt',(select updated_at from public.estimates where id=s.estimate_id),
  'contact',jsonb_build_object('name',coalesce(c.name,''),'email',coalesce(c.email,''),'phone',c.phone),
  'project',jsonb_build_object('name',p.name,'siteAddress',s.customer_view#>>'{travelContext,destinationCanonical}','region',p.region,'quoteRef',p.quote_ref))
 from public.quote_versions q join public.quotes f on f.id=q.quote_id
 join public.projects p on p.id=f.project_id left join public.contacts c on c.id=p.contact_id
 join private.studio_website_quote_bindings b on b.quote_version_id=q.id
 join private.studio_website_quote_snapshots s on s.id=b.snapshot_id
 join private.studio_client_document_sources d on d.snapshot_id=s.id
 where q.id=p_quote_version_id
$$;
revoke all on function private.studio_client_quote_created_result(uuid) from public,anon,authenticated,service_role;

-- Recognise an exact completed request before attempting to merge an old base.
-- A replay still requires current staff role and the project's local admission.
create function public.studio_client_quote_create_replay(p_project_id uuid,p_estimate_id uuid,p_actor_user_id uuid,p_request_id uuid,p_client_request jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare s private.studio_website_quote_snapshots%rowtype; q public.quote_versions%rowtype;
begin
 if not exists(select 1 from public.portal_users where user_id=p_actor_user_id and role in ('staff','admin')) then raise exception 'studio_staff_required' using errcode='42501'; end if;
 if not exists(select 1 from private.studio_client_document_control where singleton and enabled and p_project_id=any(project_ids)) then raise exception 'studio_client_documents_disabled'; end if;
 select * into s from private.studio_website_quote_snapshots where id=p_request_id;
 if not found then return null; end if;
 if s.project_id is distinct from p_project_id or s.estimate_id is distinct from p_estimate_id or s.actor_user_id is distinct from p_actor_user_id
  or s.private_evidence->'atomicCreateRequest' is distinct from p_client_request then raise exception 'studio_quote_intent_conflict' using errcode='23505'; end if;
 select v.* into q from public.quote_versions v join private.studio_website_quote_bindings b on b.quote_version_id=v.id
  where b.snapshot_id=s.id and v.client_intent_id='studio:'||p_request_id::text;
 if not found then return null; end if;
 return private.studio_client_quote_created_result(q.id);
end $$;
revoke all on function public.studio_client_quote_create_replay(uuid,uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.studio_client_quote_create_replay(uuid,uuid,uuid,uuid,jsonb) to service_role;

create function public.studio_client_quote_create(p_project_id uuid,p_estimate_id uuid,p_actor_user_id uuid,p_request_id uuid,
 p_client_request jsonb,p_save jsonb,p_preparation jsonb,p_command jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare replay jsonb; e public.estimates%rowtype; f public.quotes%rowtype; q public.quote_versions%rowtype;
 r record; evidence jsonb; command jsonb; customer text; ref text;
begin
 replay:=public.studio_client_quote_create_replay(p_project_id,p_estimate_id,p_actor_user_id,p_request_id,p_client_request);
 if replay is not null then return replay; end if;
 if p_request_id is null or jsonb_typeof(p_client_request) is distinct from 'object' or octet_length(p_client_request::text)>2097152
  or jsonb_typeof(p_save) is distinct from 'object' or jsonb_typeof(p_preparation) is distinct from 'object' or jsonb_typeof(p_command) is distinct from 'object'
  or p_save->>'requestId' is distinct from p_request_id::text
  or p_preparation->>'p_snapshot_id' is distinct from p_request_id::text
  or p_preparation->>'p_project_id' is distinct from p_project_id::text
  or p_preparation->>'p_estimate_id' is distinct from p_estimate_id::text
  or p_preparation->>'p_actor_user_id' is distinct from p_actor_user_id::text
  or p_command->>'p_source_estimate_version_id' is distinct from p_estimate_id::text
  or p_command->>'p_client_intent_id' is distinct from 'studio:'||p_request_id::text then raise exception 'studio_quote_command_invalid'; end if;
 -- Same ordering as the existing document/commercial owners: project advisory,
 -- quote advisory/current draft rows, then the source estimate Save lock.
 perform pg_advisory_xact_lock(hashtextextended('studio-client-quote-project:'||p_project_id::text,0));
 replay:=public.studio_client_quote_create_replay(p_project_id,p_estimate_id,p_actor_user_id,p_request_id,p_client_request);
 if replay is not null then return replay; end if;
 select * into e from public.estimates where id=p_estimate_id and project_id=p_project_id;
 if not found then raise exception 'studio_estimate_unavailable'; end if;
 select * into f from public.quotes where project_id=p_project_id and commercial_scope_id is not distinct from e.commercial_scope_id;
 if not found then
  ref:=public.next_quote_ref();
  insert into public.quotes(project_id,quote_ref,commercial_scope_id,created_by)
   values(p_project_id,ref,e.commercial_scope_id,p_command->>'p_actor') on conflict do nothing returning * into f;
  if not found then select * into strict f from public.quotes where project_id=p_project_id and commercial_scope_id is not distinct from e.commercial_scope_id; end if;
  if e.commercial_scope_id is null then update public.projects set quote_ref=f.quote_ref where id=p_project_id and quote_ref is null; end if;
 end if;
 perform pg_advisory_xact_lock(hashtextextended('commercial-quote:'||f.id::text,0));
 perform 1 from public.quote_versions where quote_id=f.id and status='DRAFT' and is_current_draft order by id for update;
 select * into strict r from public.studio_authored_save(p_project_id,p_estimate_id,p_actor_user_id,p_request_id,
  (p_save->>'expectedUpdatedAt')::timestamptz,(p_save->>'expectedRevision')::bigint,p_save->'authored',p_save->'spatial',p_save->'validatedStoredAuthored',p_client_request);
 select * into strict e from public.estimates where id=p_estimate_id and project_id=p_project_id for update;
 if e.outputs->'studio_authored' is distinct from p_preparation->'p_authored' or e.outputs->'drawing_object_first' is distinct from p_preparation->'p_spatial' then raise exception 'studio_stale' using errcode='PT409'; end if;
 evidence:=(p_preparation->'p_private_evidence')||jsonb_build_object('atomicCreateRequest',p_client_request,
  'atomicSaveReceipt',jsonb_build_object('revision',r.revision,'savedAt',r.saved_at,'alreadyExisted',r.already_existed));
 perform public.studio_client_quote_prepare(p_project_id,p_estimate_id,p_actor_user_id,p_request_id,e.updated_at,
  e.outputs->'studio_authored',e.outputs->'drawing_object_first',(p_preparation->>'p_publication_id')::uuid,
  p_preparation->>'p_content_hash',p_preparation->'p_handoff',evidence,p_preparation->'p_customer_view',p_preparation->'p_drawing_source');
 select c.name into customer from public.projects p left join public.contacts c on c.id=p.contact_id where p.id=p_project_id;
 command:=p_command||jsonb_build_object('p_quote_id',f.id,'p_customer_name',customer);
 q:=public.studio_client_quote_commit('create',p_request_id,p_preparation->>'p_content_hash',command);
 return private.studio_client_quote_created_result(q.id);
end $$;
revoke all on function public.studio_client_quote_create(uuid,uuid,uuid,uuid,jsonb,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.studio_client_quote_create(uuid,uuid,uuid,uuid,jsonb,jsonb,jsonb,jsonb) to service_role;

-- PDF bytes are produced only after commit. File insertion and cache publication
-- are one revision-fenced operation, with exact retry returning the same file.
create function public.studio_client_quote_store_pdf(p_quote_version_id uuid,p_actor_user_id uuid,p_snapshot_id uuid,
 p_content_hash text,p_commercial_revision bigint,p_render_hash text,p_preview_payload jsonb,p_filename text,p_content_base64 text)
returns uuid language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare q public.quote_versions%rowtype; s private.studio_website_quote_snapshots%rowtype; file_id uuid; bytes bytea;
begin
 if not exists(select 1 from public.portal_users where user_id=p_actor_user_id and role in ('staff','admin')) then raise exception 'studio_staff_required' using errcode='42501'; end if;
 select * into strict q from public.quote_versions where id=p_quote_version_id for update;
 select snapshot.* into s from private.studio_website_quote_bindings b join private.studio_website_quote_snapshots snapshot on snapshot.id=b.snapshot_id where b.quote_version_id=q.id;
 if s.id is distinct from p_snapshot_id or s.content_hash is distinct from p_content_hash or q.commercial_revision is distinct from p_commercial_revision
  or not exists(select 1 from private.studio_client_document_control where singleton and enabled and s.project_id=any(project_ids))
  then raise exception 'studio_quote_artifact_stale' using errcode='PT409'; end if;
 if p_render_hash is null or p_render_hash !~ '^[a-f0-9]{64}$' or jsonb_typeof(p_preview_payload) is distinct from 'object'
  or p_filename is null or length(p_filename)>200 or p_content_base64 is null or length(p_content_base64)>11184812 then raise exception 'studio_quote_artifact_invalid'; end if;
 if q.render_hash=p_render_hash and q.pdf_file_id is not null then return q.pdf_file_id; end if;
 bytes:=decode(p_content_base64,'base64');
 if octet_length(bytes) not between 5 and 8388608 or substring(bytes from 1 for 5)<>convert_to('%PDF-','UTF8') then raise exception 'studio_quote_artifact_invalid'; end if;
 insert into public.file_artifacts(project_id,filename,content_type,size_bytes,content_base64,created_by)
  values(s.project_id,p_filename,'application/pdf',octet_length(bytes),p_content_base64,'studio:client-quote') returning id into file_id;
 update public.quote_versions set render_hash=p_render_hash,preview_base_payload=p_preview_payload,preview_rendered_at=clock_timestamp(),pdf_file_id=file_id where id=q.id;
 return file_id;
end $$;
revoke all on function public.studio_client_quote_store_pdf(uuid,uuid,uuid,text,bigint,text,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.studio_client_quote_store_pdf(uuid,uuid,uuid,text,bigint,text,jsonb,text,text) to service_role;
notify pgrst,'reload schema';
