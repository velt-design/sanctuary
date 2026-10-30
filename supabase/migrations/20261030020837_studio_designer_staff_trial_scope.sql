-- Forward-only trial admission. Existing explicit-project workers remain the default.
-- Install the complete Studio chain atomically: its v1 metrics projection protects older workers.
alter table private.studio_client_document_control
 add column project_scope text not null default 'explicit_projects' check(project_scope in ('explicit_projects','staff_trial')),
 add column customer_send_enabled boolean not null default false;
alter table private.studio_client_document_control drop constraint studio_client_document_control_check;
alter table private.studio_client_document_control add constraint studio_client_document_control_admission_check
 check(not enabled or project_scope='staff_trial' or cardinality(project_ids)>0);

create function private.studio_client_document_project_enabled(p_project_id uuid) returns boolean
language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 select p_project_id is not null and exists(select 1 from public.projects where id=p_project_id)
 and exists(select 1 from private.studio_client_document_control where singleton and enabled
  and (project_scope='staff_trial' or p_project_id=any(project_ids)));
$$;
revoke all on function private.studio_client_document_project_enabled(uuid) from public,anon,authenticated,service_role;

-- Replace only the final definitions' original admission predicate. Any drift aborts the batch.
do $patch$
declare target record; definition text; anchor text;
begin
 for target in select * from (values
  ('public.studio_client_document_capability(uuid,uuid)','p_project_id'),
  ('public.studio_client_quote_prepare(uuid,uuid,uuid,uuid,timestamp with time zone,jsonb,jsonb,uuid,text,jsonb,jsonb,jsonb,jsonb)','p_project_id'),
  ('private.studio_client_document_enqueue(uuid)','d.project_id'),
  ('public.studio_client_quote_commit(text,uuid,text,jsonb)','s.project_id'),
  ('private.studio_client_document_owned(uuid,text,uuid)','d.project_id'),
  ('public.studio_client_quote_create_replay(uuid,uuid,uuid,uuid,jsonb)','p_project_id'),
  ('public.studio_client_quote_store_pdf(uuid,uuid,uuid,text,bigint,text,jsonb,text,text)','s.project_id'),
  ('public.studio_client_document_variant_retry(uuid,uuid,uuid)','d.project_id'),
  ('public.studio_client_document_variant_prepare(uuid,uuid,uuid[])','bound_project'),
  ('private.studio_package_assert(uuid,uuid)','project')
 ) as targets(signature,project_expression) loop
  if to_regprocedure(target.signature) is null then raise exception 'Studio admission owner missing: %',target.signature; end if;
  definition:=pg_get_functiondef(to_regprocedure(target.signature));
  anchor:='exists(select 1 from private.studio_client_document_control where singleton and enabled and '||target.project_expression||'=any(project_ids))';
  if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'Studio admission owner changed: %',target.signature; end if;
  execute replace(definition,anchor,'private.studio_client_document_project_enabled('||target.project_expression||')');
 end loop;
end $patch$;

-- Read-only eligibility is shared by bounded project selection and the final pre-visibility reader.
-- It does not lease jobs, increment read_ct or hide unsupported queue messages.
create function private.studio_client_document_trial_job_eligible(p_job_id uuid,p_versions jsonb) returns boolean
language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 select exists(
  select 1 from public.background_jobs j
  join pgmq.q_portal_background_jobs q on q.msg_id=j.queue_message_id
  join private.studio_client_documents doc on doc.job_id=j.id and doc.document_id::text=j.subject_id and doc.project_id=j.project_id
  join private.studio_client_document_sources source on source.snapshot_id=doc.snapshot_id
  where j.id=p_job_id and j.kind='studio_design_booklet_v1' and j.contract_version=1
   and j.subject_type=case when doc.variant_manifest is null then 'studio_snapshot' else 'studio_document' end
   and j.execution_owner='worker' and j.rollout_mode='worker_enabled'
   and j.status not in ('succeeded','cancelled','needs_attention','permanent_failed')
   and (j.next_attempt_at is null or j.next_attempt_at<=clock_timestamp())
   and (j.lease_expires_at is null or j.lease_expires_at<=clock_timestamp())
   and q.vt<=clock_timestamp() and jsonb_typeof(q.message)='object'
   and q.message->>'jobId'=j.id::text and q.message->'contractVersion'='1'::jsonb
   and q.message-'jobId'-'contractVersion'='{}'::jsonb
   and p_versions ? (case when doc.variant_manifest is not null then 'studio-booklet-renders.v1'
    when not(source.drawing_source ? 'layoutVersion') then 'legacy'
    when jsonb_typeof(source.drawing_source->'layoutVersion')='string'
     and source.drawing_source->>'layoutVersion' in ('studio-booklet-layout.v2','studio-booklet-layout.v3','studio-booklet-layout.v4')
    then source.drawing_source->>'layoutVersion' else '' end)
   and exists(select 1 from private.studio_client_document_control where singleton and enabled and project_scope='staff_trial')
 );
$$;
revoke all on function private.studio_client_document_trial_job_eligible(uuid,jsonb) from public,anon,authenticated,service_role;

-- Keep the proven explicit-project reader, adding the trial-only predicate before VT/read_ct.
do $patch$
declare definition text; anchor text:='  order by q.msg_id limit p_batch_size for update of q skip locked';
begin
 definition:=pg_get_functiondef('private.background_job_read_claim_queue(integer,integer)'::regprocedure);
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1 then raise exception 'Document queue reader changed'; end if;
 execute replace(definition,anchor,
  '  and (current_setting(''sanctuary.studio_document_staff_trial'',true) is distinct from ''true'' or private.studio_client_document_trial_job_eligible(j.id,versions))'||chr(10)||anchor);
end $patch$;

create function public.background_jobs_claim_studio_trial(p_worker_id text,p_batch_size integer,p_visibility_timeout_seconds integer,p_manifest_versions text[])
returns table(job_id uuid,kind text,contract_version integer,status public.background_job_status,current_phase text,attempt_number integer,max_attempts integer,queue_message_id bigint,lease_token uuid,lease_expires_at timestamptz,cancellation_requested_at timestamptz,rollout_mode public.background_job_rollout_mode,execution_owner public.background_job_execution_owner)
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare control private.studio_client_document_control%rowtype; projects uuid[];
 previous_trial text:=current_setting('sanctuary.studio_document_staff_trial',true);
begin
 if p_worker_id is null or p_worker_id !~ '^[A-Za-z0-9._:-]{1,128}$'
  or p_batch_size is null or p_batch_size not between 1 and 100
  or p_visibility_timeout_seconds is null or p_visibility_timeout_seconds not between 15 and 3600
  or p_manifest_versions is null or cardinality(p_manifest_versions) not between 1 and 5
  or array_position(p_manifest_versions,null) is not null
  or exists(select 1 from unnest(p_manifest_versions) version where version not in ('legacy','studio-booklet-layout.v2','studio-booklet-layout.v3','studio-booklet-layout.v4','studio-booklet-renders.v1'))
 then raise exception 'invalid_studio_trial_claim' using errcode='22023'; end if;
 -- Hold admission through the canonical claim. A concurrent kill switch cannot be raced
 -- using an earlier discovery result; after revocation a new call returns no claims.
 select * into control from private.studio_client_document_control where singleton for share;
 if not found or not control.enabled or control.project_scope<>'staff_trial' then return; end if;
 select array_agg(eligible.project_id order by eligible.first_message) into projects from (
  select j.project_id,min(q.msg_id) first_message
  from pgmq.q_portal_background_jobs q join public.background_jobs j on j.queue_message_id=q.msg_id
  where private.studio_client_document_trial_job_eligible(j.id,to_jsonb(p_manifest_versions))
  group by j.project_id order by min(q.msg_id),j.project_id limit 32
 ) eligible;
 -- Empty never becomes the unscoped worker path.
 if coalesce(cardinality(projects),0)=0 then return; end if;
 perform set_config('sanctuary.studio_document_staff_trial','true',true);
 return query select * from public.background_jobs_claim_documents(p_worker_id,p_batch_size,p_visibility_timeout_seconds,array['studio_design_booklet_v1']::text[],projects,p_manifest_versions);
 perform set_config('sanctuary.studio_document_staff_trial',coalesce(previous_trial,''),true);
exception when others then
 perform set_config('sanctuary.studio_document_staff_trial',coalesce(previous_trial,''),true);
 raise;
end $$;
revoke all on function public.background_jobs_claim_studio_trial(text,integer,integer,text[]) from public,anon,authenticated;
grant execute on function public.background_jobs_claim_studio_trial(text,integer,integer,text[]) to service_role;

-- This canonical transport fence also protects Studio intents after an application rollback.
-- Preserve cancellation and invoice-generation checks, and freeze no new send permission.
do $patch$
declare definition text; anchor text:='  if v_intent.status = ''finalised'' then';
begin
 definition:=pg_get_functiondef('public.commercial_email_mark_dispatching(uuid)'::regprocedure);
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1
  or strpos(definition,'if v_intent.status = ''cancelled''')=0 then raise exception 'Canonical dispatch owner changed'; end if;
 execute replace(definition,anchor,
  '  if v_intent.kind in (''quote_send'',''quote_resend'') and ('||chr(10)||
  '    v_intent.protected_payload ? ''studioPackage'' or exists(select 1 from private.studio_website_quote_bindings where quote_version_id=v_intent.subject_id)'||chr(10)||
  '  ) and not exists(select 1 from private.studio_client_document_control where singleton and customer_send_enabled) then'||chr(10)||
  '    raise exception ''Studio customer email sending is disabled'' using errcode=''55000'';'||chr(10)||
  '  end if;'||chr(10)||anchor);
end $patch$;
notify pgrst,'reload schema';
