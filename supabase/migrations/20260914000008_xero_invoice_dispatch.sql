alter table private.xero_invoice_transfers
  add column provider_invoice_id uuid,
  add column last_verified_at timestamptz;
create unique index xero_invoice_binding_unique on private.xero_invoice_transfers(tenant_id,provider_invoice_id)
where provider_invoice_id is not null;

alter table public.background_job_effects add constraint xero_invoice_effect_window_bounded check (
  provider_name is distinct from 'xero' or provider_idempotency_expires_at is null
  or provider_idempotency_expires_at <= created_at+interval '5 minutes'
);

create function public.xero_invoice_begin_dispatch(p_job_id uuid,p_lease_token uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare
  v_context jsonb;
  v_transfer private.xero_invoice_transfers%rowtype;
  v_request private.xero_invoice_requests%rowtype;
  v_job public.background_jobs%rowtype;
  v_line jsonb;
begin
  v_context := public.xero_invoice_transfer_context(p_job_id,p_lease_token);
  select * into strict v_job from public.background_jobs where id=p_job_id;
  select * into strict v_transfer from private.xero_invoice_transfers where job_id=p_job_id;
  select * into strict v_request from private.xero_invoice_requests where transfer_id=v_transfer.id for update;
  if v_request.finalised_at is not null or v_request.provider_invoice_id is not null then
    raise exception 'XERO_REQUEST_ALREADY_ACCEPTED' using errcode='55000';
  end if;
  if v_request.expires_at <= clock_timestamp()+interval '15 seconds' then
    raise exception 'XERO_IDEMPOTENCY_EXPIRED' using errcode='55000';
  end if;
  if v_request.body::jsonb->'Invoices'->0->'Contact'->>'ContactID' is distinct from v_context->'mapping'->>'contactId' then
    raise exception 'XERO_MAPPING_CHANGED' using errcode='55000';
  end if;
  for v_line in select value from jsonb_array_elements(v_request.body::jsonb->'Invoices'->0->'LineItems') loop
    if v_line->>'AccountCode' is distinct from v_context->'mapping'->>'accountCode'
      or v_line->>'TaxType' is distinct from v_context->'mapping'->>'taxType' then
      raise exception 'XERO_MAPPING_CHANGED' using errcode='55000';
    end if;
  end loop;
  if not exists(select 1 from public.background_job_effects where job_id=p_job_id and effect_kind='xero_invoice_draft') then
    perform public.background_job_record_effect_checkpoint(p_job_id,v_job.lease_owner,p_lease_token,
      'xero-invoice:'||v_transfer.id::text,'xero_invoice_draft','prepared',v_request.body_hash,'xero',
      v_request.idempotency_key,v_request.expires_at,null,'{}'::jsonb);
  end if;
  perform public.background_job_record_effect_checkpoint(p_job_id,v_job.lease_owner,p_lease_token,
    'xero-invoice:'||v_transfer.id::text,'xero_invoice_draft','dispatch_started',v_request.body_hash,'xero',
    v_request.idempotency_key,v_request.expires_at,null,'{}'::jsonb);
  update private.xero_invoice_requests set dispatch_started_at=coalesce(dispatch_started_at,clock_timestamp())
    where transfer_id=v_transfer.id;
  return private.xero_invoice_request_result(v_transfer.id);
end;
$$;
revoke all on function public.xero_invoice_begin_dispatch(uuid,uuid) from public, anon, authenticated;
grant execute on function public.xero_invoice_begin_dispatch(uuid,uuid) to service_role;

-- The portal constructs this proof only after an independent Xero GET has passed
-- the strict identity/line/tax/total comparison. This narrow owner records evidence;
-- it never authorises another provider write or extends the idempotency window.
create function public.xero_invoice_finalise(p_job_id uuid,p_lease_token uuid,p_body_hash text,p_proof jsonb)
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
  v_invoice := private.xero_invoice_lock_context(p_job_id,p_lease_token);
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
revoke all on function public.xero_invoice_finalise(uuid,uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.xero_invoice_finalise(uuid,uuid,text,jsonb) to service_role;
