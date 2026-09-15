-- Share the existing verified binding owner between a worker lease and explicit finance recovery.
create function private.xero_invoice_finalise_verified(p_job_id uuid,p_invoice public.deposit_invoices,p_body_hash text,p_proof jsonb)
returns void language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare
  v_invoice public.deposit_invoices%rowtype;
  v_transfer private.xero_invoice_transfers%rowtype;
  v_request private.xero_invoice_requests%rowtype;
  v_job public.background_jobs%rowtype;
  v_effect public.background_job_effects%rowtype;
  v_provider_id uuid;
  v_provider_identity text;
begin
  v_invoice := p_invoice;
  select * into strict v_job from public.background_jobs where id=p_job_id;
  select * into strict v_transfer from private.xero_invoice_transfers where job_id=p_job_id;
  select * into strict v_request from private.xero_invoice_requests where transfer_id=v_transfer.id for update;
  if p_body_hash is distinct from v_request.body_hash or v_request.dispatch_started_at is null
    or jsonb_typeof(p_proof) is distinct from 'object'
    or p_proof->'draft' is distinct from v_request.body::jsonb->'Invoices'->0
    or p_proof->>'invoiceId' is null
    or (p_proof->>'totalCents')::numeric is distinct from v_invoice.total_inc_gst_cents::numeric
    or (p_proof->>'taxCents')::numeric is distinct from v_invoice.gst_cents::numeric
    or (p_proof->>'subtotalCents')::numeric is distinct from v_invoice.total_ex_gst_cents::numeric then
    raise exception 'XERO_VERIFICATION_MISMATCH' using errcode='22023';
  end if;
  v_provider_id := (p_proof->>'invoiceId')::uuid;
  v_provider_identity := v_transfer.tenant_id::text||':'||v_provider_id::text;
  if v_request.provider_invoice_id is not null and v_request.provider_invoice_id <> v_provider_id then
    raise exception 'XERO_INVOICE_ID_CONFLICT' using errcode='23505';
  end if;
  if v_request.finalised_at is not null then return; end if;
  select * into v_effect from public.background_job_effects
    where job_id=p_job_id and effect_kind='xero_invoice_draft' for update;
  if not found or v_effect.payload_hash is distinct from v_request.body_hash
    or v_effect.provider_name is distinct from 'xero'
    or v_effect.provider_idempotency_key is distinct from v_request.idempotency_key
    or v_effect.provider_idempotency_expires_at is distinct from v_request.expires_at
    or v_effect.state not in ('dispatch_started','uncertain','failed','provider_accepted')
    or (v_effect.provider_message_id is not null and v_effect.provider_message_id <> v_provider_identity) then
    raise exception 'XERO_EFFECT_IDENTITY_MISMATCH' using errcode='55000';
  end if;
  -- The existing provider-evidence transition permits uncertain/failed ->
  -- provider_accepted. A verified GET uses that edge, never a fake redispatch.
  update public.background_job_effects set state='provider_accepted',provider_message_id=v_provider_identity,
    provider_accepted_at=coalesce(provider_accepted_at,clock_timestamp()) where id=v_effect.id;
  update public.background_jobs set status='provider_accepted',current_phase='xero_draft_verified' where id=p_job_id;
  perform private.background_job_insert_event(p_job_id,v_job.queue_message_id,'provider_accepted',v_job.status,
    'provider_accepted','xero_draft_verified',v_job.attempt_count,v_job.lease_owner,null,null,
    jsonb_build_object('effectKind','xero_invoice_draft','checkpoint','provider_accepted'));
  update private.xero_invoice_requests set provider_invoice_id=v_provider_id,finalised_at=clock_timestamp()
    where transfer_id=v_transfer.id;
  update private.xero_invoice_transfers set provider_invoice_id=v_provider_id,last_verified_at=clock_timestamp()
    where id=v_transfer.id;
  update public.background_job_effects set state='finalised',finalised_at=clock_timestamp() where id=v_effect.id;
  update public.background_jobs set status='finalising',current_phase='xero_draft_recorded' where id=p_job_id;
  perform private.background_job_insert_event(p_job_id,v_job.queue_message_id,'finalised','provider_accepted',
    'finalising','xero_draft_recorded',v_job.attempt_count,v_job.lease_owner,null,null,
    jsonb_build_object('effectKind','xero_invoice_draft','checkpoint','finalised'));
end;
$$;
revoke all on function private.xero_invoice_finalise_verified(uuid,public.deposit_invoices,text,jsonb) from public,anon,authenticated,service_role;

create or replace function public.xero_invoice_finalise(p_job_id uuid,p_lease_token uuid,p_body_hash text,p_proof jsonb)
returns void language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare v_invoice public.deposit_invoices%rowtype;
begin
  v_invoice := private.xero_invoice_lock_context(p_job_id,p_lease_token);
  perform private.xero_invoice_finalise_verified(p_job_id,v_invoice,p_body_hash,p_proof);
end; $$;

-- This command never claims/requeues a worker job and never dispatches a provider request.
create function public.xero_finance_recover_invoice(p_actor uuid,p_invoice_id uuid,p_tenant_id uuid,
  p_body_hash text default null,p_proof jsonb default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare v_job public.background_jobs%rowtype; v_transfer private.xero_invoice_transfers%rowtype;
  v_invoice public.deposit_invoices%rowtype; v_request private.xero_invoice_requests%rowtype; v_tenant uuid;
begin
  perform public.xero_require_payment_approver(p_actor);
  select * into v_transfer from private.xero_invoice_transfers where invoice_id=p_invoice_id;
  if not found or v_transfer.tenant_id is distinct from p_tenant_id then raise exception 'XERO_TRANSFER_NOT_FOUND'; end if;
  select * into strict v_job from public.background_jobs where id=v_transfer.job_id for update;
  select tenant_id into v_tenant from private.xero_invoice_transfer_control where singleton for share;
  if v_tenant is distinct from p_tenant_id then raise exception 'XERO_TENANT_MISMATCH'; end if;
  select * into strict v_transfer from private.xero_invoice_transfers where job_id=v_job.id for update;
  select * into v_invoice from public.deposit_invoices where id=p_invoice_id for share;
  if not found or v_invoice.status not in ('OPEN','PAID') or v_invoice.currency<>'NZD'
    or v_invoice.project_id is distinct from v_transfer.project_id
    or v_job.kind<>'xero_invoice_draft_v1' or v_job.contract_version<>1 or v_job.execution_owner<>'worker'
    or v_job.subject_type<>'invoice' or v_job.subject_id is distinct from p_invoice_id::text
    or v_job.project_id is distinct from v_transfer.project_id
    or v_job.allowed_effect_kinds is distinct from array['xero_invoice_draft']::text[]
    or v_job.required_effect_kinds is distinct from array['xero_invoice_draft']::text[] then raise exception 'XERO_INVOICE_CHANGED'; end if;
  select * into v_request from private.xero_invoice_requests where transfer_id=v_transfer.id for update;
  if not found or v_request.dispatch_started_at is null then raise exception 'XERO_NO_DISPATCH_TO_RECOVER'; end if;
  if v_job.status='succeeded' and v_request.finalised_at is not null and v_transfer.provider_invoice_id=v_request.provider_invoice_id then
    return private.xero_invoice_request_result(v_transfer.id); end if;
  -- Even an expired lease belongs to lease recovery until that owner releases it.
  if v_job.lease_token is not null or v_job.status not in ('needs_attention','permanent_failed') then raise exception 'XERO_TRANSFER_STILL_RUNNING'; end if;
  if v_job.cancellation_requested_at is not null then raise exception 'XERO_CANCELLED_TRANSFER_REVIEW'; end if;
  if p_proof is null then
    if p_body_hash is not null then raise exception 'XERO_VERIFICATION_MISMATCH'; end if;
    return private.xero_invoice_request_result(v_transfer.id);
  end if;
  if v_request.finalised_at is not null then raise exception 'XERO_ALREADY_BOUND_REVIEW'; end if;
  if (select count(*) from public.background_job_effects where job_id=v_job.id)<>1 then raise exception 'XERO_EFFECT_IDENTITY_MISMATCH'; end if;
  perform private.xero_invoice_finalise_verified(v_job.id,v_invoice,p_body_hash,p_proof);
  if exists(select 1 from public.background_job_effects where job_id=v_job.id and (state<>'finalised' or effect_kind<>'xero_invoice_draft')) then
    raise exception 'XERO_EFFECT_IDENTITY_MISMATCH'; end if;
  perform private.background_job_archive_canonical(v_job.id,v_job.queue_message_id);
  update public.background_jobs set status='succeeded',current_phase='succeeded',
    safe_result='{"resultCode":"XERO_DRAFT_VERIFIED","processedCount":1}'::jsonb,
    lease_owner=null,lease_token=null,lease_started_at=null,lease_expires_at=null,last_heartbeat_at=null,error_code=null,error_message=null
    where id=v_job.id;
  perform private.background_job_insert_event(v_job.id,v_job.queue_message_id,'succeeded','finalising','succeeded','succeeded',
    v_job.attempt_count,null,p_actor,null,'{"resultCode":"XERO_DRAFT_VERIFIED","processedCount":1}'::jsonb);
  return private.xero_invoice_request_result(v_transfer.id);
end; $$;
revoke all on function public.xero_finance_recover_invoice(uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.xero_finance_recover_invoice(uuid,uuid,uuid,text,jsonb) to service_role;
