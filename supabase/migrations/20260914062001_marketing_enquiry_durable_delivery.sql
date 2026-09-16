-- Install-only boundary. The website producer and worker rollout remain separate.
-- Large frozen emails stay private; the queue carries only their durable identity.
create table private.marketing_enquiry_deliveries (
  enquiry_request_id uuid primary key references public.enquiry_requests(id) on delete cascade,
  outbox_id uuid not null unique references public.email_outbox(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id),
  draft_estimate jsonb not null check (jsonb_typeof(draft_estimate) = 'object'),
  job_id uuid unique references public.background_jobs(id),
  message jsonb not null check (jsonb_typeof(message) = 'object'),
  created_at timestamptz not null default now(),
  check (octet_length(message::text) <= 16777216)
);
revoke all on private.marketing_enquiry_deliveries from public, anon, authenticated, service_role;

create function public.marketing_enquiry_intake_with_delivery(
  p_submission_id uuid, p_upload_token_hash text, p_payload jsonb, p_delivery jsonb
)
returns table (contact_id uuid, project_id uuid, enquiry_request_id uuid, already_existed boolean, estimate_id uuid)
language plpgsql security definer set search_path = pg_catalog, pg_temp
as $$
declare
  v_intake record;
  v_existing private.marketing_enquiry_deliveries%rowtype;
  v_job public.background_jobs%rowtype;
  v_outbox_id uuid;
  v_email text;
  v_intent text;
  v_estimate public.estimates%rowtype;
  v_estimate_id uuid;
begin
  -- The intake's submission lock covers this entire transaction, including replay.
  select * into strict v_intake from public.marketing_enquiry_intake(
    p_submission_id, p_upload_token_hash, p_payload
  );
  select * into v_existing from private.marketing_enquiry_deliveries d
    where d.enquiry_request_id = v_intake.enquiry_request_id;
  if found then
    -- Never replace frozen content with a newly rendered retry.
    if v_existing.job_id is null then
      raise exception 'enquiry_delivery_incomplete' using errcode = '55000';
    end if;
    v_estimate_id := v_existing.estimate_id;
  else
    if v_intake.already_existed then
      -- Legacy sends have no durable provider checkpoint: do not blindly resend.
      raise exception 'legacy_enquiry_delivery_requires_reconciliation' using errcode = '55000';
    end if;
    v_email := lower(btrim(p_payload->>'email'));
    if jsonb_typeof(p_delivery) is distinct from 'object'
       or jsonb_typeof(p_delivery->'message') is distinct from 'object'
       or jsonb_typeof(p_delivery->'variables') is distinct from 'object'
       or jsonb_typeof(p_delivery->'draftEstimate') is distinct from 'object'
       or jsonb_typeof(p_delivery->'draftEstimate'->'inputs') is distinct from 'object'
       or jsonb_typeof(p_delivery->'draftEstimate'->'outputs') is distinct from 'object'
       or nullif(btrim(p_delivery->>'templateId'), '') is null
       or nullif(btrim(p_delivery->>'emailType'), '') is null
       or lower(btrim(p_delivery->'message'->>'to')) is distinct from v_email
       or nullif(btrim(p_delivery->'message'->>'subject'), '') is null
       or nullif(p_delivery->'message'->>'html', '') is null then
      raise exception 'invalid_enquiry_delivery' using errcode = '22023';
    end if;
    v_intent := 'website:autoresponder:' || v_intake.enquiry_request_id::text;
    v_estimate := jsonb_populate_record(null::public.estimates, p_delivery->'draftEstimate');
    insert into public.estimates(project_id, status, created_by, summary_json, inputs, outputs,
      warnings, costing_manifest, costing_rules, costing_config_version_id,
      crew_hours, duration_days, materials_ex_gst, install_payout_ex_gst, overhead_ex_gst,
      total_true_cost_ex_gst, total_true_cost_inc_gst)
      values(v_intake.project_id, 'draft', 'marketing_enquiry', v_estimate.summary_json,
        v_estimate.inputs, v_estimate.outputs, coalesce(v_estimate.warnings, '[]'::jsonb),
        v_estimate.costing_manifest, v_estimate.costing_rules, v_estimate.costing_config_version_id,
        v_estimate.crew_hours, v_estimate.duration_days, v_estimate.materials_ex_gst,
        v_estimate.install_payout_ex_gst, v_estimate.overhead_ex_gst,
        v_estimate.total_true_cost_ex_gst, v_estimate.total_true_cost_inc_gst)
      returning id into v_estimate_id;
    insert into public.email_templates(id, subject, body_html, body_text, variables)
      values (p_delivery->>'templateId', p_delivery->'message'->>'subject',
        '<p>(Rendered in app code)</p>', null, '[]'::jsonb)
      on conflict (id) do nothing;
    insert into public.email_outbox(project_id, contact_id, email_type, to_email,
      subject, template_id, variables, status, idempotency_key)
      values (v_intake.project_id, v_intake.contact_id, p_delivery->>'emailType',
        v_email, p_delivery->'message'->>'subject', p_delivery->>'templateId',
        p_delivery->'variables', 'QUEUED', v_intent)
      returning id into v_outbox_id;
    insert into private.marketing_enquiry_deliveries(enquiry_request_id, outbox_id, message, estimate_id, draft_estimate)
      values (v_intake.enquiry_request_id, v_outbox_id, p_delivery->'message', v_estimate_id, p_delivery->'draftEstimate');
    v_job := private.background_job_enqueue_core(
      'email_outbox_deliver', 1, 'email_outbox', v_outbox_id::text,
      v_intake.project_id, null, 'system', 0::smallint, v_intent,
      jsonb_build_object('workflow', 'website_enquiry', 'outboxId', v_outbox_id),
      now(), 'worker_cohort', 'worker', 'website_enquiry'
    );
    update private.marketing_enquiry_deliveries set job_id = v_job.id
      where marketing_enquiry_deliveries.enquiry_request_id = v_intake.enquiry_request_id;
  end if;
  return query select v_intake.contact_id, v_intake.project_id,
    v_intake.enquiry_request_id, v_intake.already_existed, v_estimate_id;
end;
$$;
revoke all on function public.marketing_enquiry_intake_with_delivery(uuid,text,jsonb,jsonb)
  from public, anon, authenticated;
grant execute on function public.marketing_enquiry_intake_with_delivery(uuid,text,jsonb,jsonb) to service_role;

create function public.marketing_enquiry_delivery_read(
  p_job_id uuid, p_worker_id text, p_lease_token uuid
)
returns jsonb language plpgsql security definer set search_path = pg_catalog, pg_temp
as $$
declare
  v_job public.background_jobs%rowtype;
  v_delivery private.marketing_enquiry_deliveries%rowtype;
begin
  v_job := private.background_job_lock_owned(p_job_id, p_worker_id, p_lease_token);
  select * into strict v_delivery from private.marketing_enquiry_deliveries where job_id = p_job_id;
  if v_job.kind <> 'email_outbox_deliver' or v_job.subject_type <> 'email_outbox'
     or v_job.subject_id <> v_delivery.outbox_id::text then
    raise exception 'enquiry_delivery_job_mismatch' using errcode = '55000';
  end if;
  return v_delivery.message;
end;
$$;
revoke all on function public.marketing_enquiry_delivery_read(uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.marketing_enquiry_delivery_read(uuid,text,uuid) to service_role;

create function public.marketing_enquiry_delivery_finalise(
  p_job_id uuid, p_worker_id text, p_lease_token uuid, p_provider_message_id text
)
returns void language plpgsql security definer set search_path = pg_catalog, pg_temp
as $$
declare
  v_job public.background_jobs%rowtype;
  v_delivery private.marketing_enquiry_deliveries%rowtype;
begin
  v_job := private.background_job_lock_owned(p_job_id, p_worker_id, p_lease_token);
  select * into strict v_delivery from private.marketing_enquiry_deliveries where job_id = p_job_id;
  if v_job.kind <> 'email_outbox_deliver' or v_job.subject_type <> 'email_outbox'
     or v_job.subject_id <> v_delivery.outbox_id::text
     or nullif(p_provider_message_id, '') is null
     or not exists (select 1 from public.background_job_effects e where e.job_id = p_job_id
       and e.effect_kind = 'email_dispatch' and e.state in ('provider_accepted', 'finalised')
       and e.provider_message_id = p_provider_message_id) then
    raise exception 'enquiry_delivery_acceptance_required' using errcode = '55000';
  end if;
  update public.email_outbox set status = 'SENT', error = null, sent_at = coalesce(sent_at, now())
    where id = v_delivery.outbox_id;
  insert into public.audit_events(project_id, type, idempotency_key, payload)
    values (v_job.project_id, 'email_sent', 'audit:website:delivery:' || v_delivery.outbox_id::text,
      jsonb_build_object('outboxId', v_delivery.outbox_id, 'providerMessageId', p_provider_message_id))
    on conflict (idempotency_key) do nothing;
end;
$$;
revoke all on function public.marketing_enquiry_delivery_finalise(uuid,text,uuid,text) from public, anon, authenticated;
grant execute on function public.marketing_enquiry_delivery_finalise(uuid,text,uuid,text) to service_role;
