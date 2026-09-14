-- Disposable PGMQ harness only. No provider calls; every fixture rolls back.
begin;
create function pg_temp.reject_test_enquiry_job() returns trigger language plpgsql as $$
begin
  if current_setting('test.reject_enquiry_job', true) = 'yes' then
    raise exception 'test queue write rejected' using errcode = '55000';
  end if;
  return new;
end $$;
create trigger reject_test_enquiry_job before insert on public.background_jobs
  for each row execute function pg_temp.reject_test_enquiry_job();

do $$
declare
  v_submission uuid := gen_random_uuid();
  v_first record;
  v_retry record;
  v_job uuid;
  v_claim record;
  v_effect_state text;
  v_expiry timestamptz := now() + interval '23 hours';
  v_outbox uuid;
  v_payload jsonb := '{"enquiryType":"residential","name":"Contract fixture","email":"enquiry-contract@example.test","phone":"+64000000001","files":[],"rawPayload":{"requestType":"site-measure"}}';
  v_delivery jsonb := '{"templateId":"CONTRACT_ENQUIRY","emailType":"WEBSITE_ESTIMATE_AUTORESPONDER","variables":{},"message":{"from":"sender@example.test","to":"enquiry-contract@example.test","subject":"Original receipt","html":"<p>Original receipt</p>"},"draftEstimate":{"inputs":{"width":6},"outputs":{"snapshot":{"submittedPrice":{"baseRange":{"lowIncGst":12000,"highIncGst":12000},"includesGst":true},"customerBrief":{"summary":"Original design"}}}}}';
  v_receipt jsonb;
  v_user uuid := gen_random_uuid();
  v_upload_hash text := repeat('a', 64);
  v_path text;
  v_files jsonb;
begin
  v_path := 'pending/' || v_submission::text || '/0-plan.pdf';
  v_files := jsonb_build_array(jsonb_build_object('name', 'plan.pdf', 'path', v_path,
    'type', 'application/pdf', 'size', 42));
  v_payload := jsonb_set(v_payload, '{files}', v_files);
  insert into public.marketing_enquiry_upload_sessions(submission_id, token_hash, ip_key_hash, expected_files, expires_at)
    values(v_submission, v_upload_hash, repeat('b', 64), v_files, clock_timestamp() + interval '15 minutes');
  begin
    perform public.marketing_enquiry_intake_with_delivery(v_submission, v_upload_hash, v_payload, v_delivery);
    raise exception 'missing storage object did not roll back the intake';
  exception when sqlstate '22023' then
    if sqlerrm <> 'invalid_or_missing_enquiry_attachment' then raise; end if;
  end;
  if exists(select 1 from public.contacts where email='enquiry-contract@example.test')
    or exists(select 1 from public.enquiry_requests where submission_id=v_submission) then
    raise exception 'missing file retained a partial intake';
  end if;
  insert into storage.objects(bucket_id, name) values('enquiry-attachments', v_path);
  perform set_config('test.reject_enquiry_job', 'yes', true);
  begin
    perform public.marketing_enquiry_intake_with_delivery(v_submission, v_upload_hash, v_payload, v_delivery);
    raise exception 'queue failure was not propagated';
  exception when sqlstate '55000' then
    if sqlerrm <> 'test queue write rejected' then raise; end if;
  end;
  if exists(select 1 from public.contacts where email='enquiry-contract@example.test')
    or exists(select 1 from public.enquiry_requests where submission_id=v_submission)
    or exists(select 1 from public.project_enquiry_attachments where submission_id=v_submission)
    or exists(select 1 from public.marketing_enquiry_upload_sessions where submission_id=v_submission and consumed_at is not null) then
    raise exception 'queue failure retained a partial intake';
  end if;
  perform set_config('test.reject_enquiry_job', 'no', true);
  select * into strict v_first from public.marketing_enquiry_intake_with_delivery(v_submission, v_upload_hash, v_payload, v_delivery);
  select * into strict v_retry from public.marketing_enquiry_intake_with_delivery(v_submission, v_upload_hash, v_payload,
    jsonb_set(v_delivery, '{message,html}', '"Changed retry"'));
  if v_retry.already_existed is not true or v_first.estimate_id <> v_retry.estimate_id
     or v_first.enquiry_request_id <> v_retry.enquiry_request_id then
    raise exception 'retry duplicated the original submission';
  end if;
  if (select count(*) from public.estimates where project_id=v_first.project_id) <> 1
    or (select count(*) from public.email_outbox where project_id=v_first.project_id) <> 1 then
    raise exception 'retry duplicated estimate or outbox';
  end if;
  if (select count(*) from public.project_enquiry_attachments where submission_id=v_submission
    and project_id=v_first.project_id and storage_path=v_path) <> 1
    or (select count(*) from public.project_enquiry_attachment_events where enquiry_request_id=v_first.enquiry_request_id and event_type='linked') <> 1
    or not exists(select 1 from public.marketing_enquiry_upload_sessions where submission_id=v_submission and consumed_at is not null) then
    raise exception 'upload consumption or exactly-once project file linking failed';
  end if;
  if exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='enquiry_attachments_staff_signed_read') then
    raise exception 'unaudited direct storage read policy remains';
  end if;
  select job_id into strict v_job from private.marketing_enquiry_deliveries where enquiry_request_id=v_first.enquiry_request_id;
  if (select message->>'html' from private.marketing_enquiry_deliveries where job_id=v_job) is distinct from '<p>Original receipt</p>' then
    raise exception 'retry replaced the original email';
  end if;
  if (select count(*) from pgmq.q_portal_background_jobs where message->>'jobId'=v_job::text) <> 1 then
    raise exception 'real PGMQ message was not enqueued exactly once';
  end if;
  begin
    perform public.marketing_enquiry_delivery_read(v_job, 'unclaimed-worker', gen_random_uuid());
    raise exception 'unclaimed worker read private email';
  exception when sqlstate '55000' then null;
  end;
  update public.estimates set outputs='{}' where id=v_first.estimate_id;
  insert into auth.users(id) values(v_user);
  insert into public.portal_users(user_id, role, is_active) values(v_user, 'staff', true);
  perform set_config('request.jwt.claim.sub', v_user::text, true);
  v_receipt := public.marketing_enquiry_staff_receipts(v_first.project_id);
  if (v_receipt #>> '{0,submittedPrice,baseRange,lowIncGst}') is distinct from '12000'
    or (v_receipt #>> '{0,customerBrief,summary}') is distinct from 'Original design'
    or (v_receipt #>> '{0,deliveryStatus}') is distinct from 'queued' then
    raise exception 'mutable estimate replaced the original staff receipt';
  end if;
  if has_table_privilege('service_role', 'private.marketing_enquiry_deliveries', 'select')
    or has_function_privilege('authenticated', 'public.marketing_enquiry_intake_with_delivery(uuid,text,jsonb,jsonb)', 'execute') then
    raise exception 'private delivery boundary exposed';
  end if;
  -- Exercise the real delivery RPCs and queue lifecycle; no external provider.
  select outbox_id into strict v_outbox from private.marketing_enquiry_deliveries where job_id=v_job;
  select * into strict v_claim from public.background_jobs_claim('enquiry-contract-worker', 1, 60);
  if v_claim.job_id <> v_job then raise exception 'claimed an unrelated fixture'; end if;
  perform public.background_job_record_progress(v_job, 'enquiry-contract-worker', v_claim.lease_token,
    'running', 'outbox_frozen', '{"phase":"outbox_frozen"}'::jsonb);
  if public.marketing_enquiry_delivery_read(v_job, 'enquiry-contract-worker', v_claim.lease_token)->>'html'
     is distinct from '<p>Original receipt</p>' then raise exception 'worker did not read frozen message'; end if;
  begin
    perform public.marketing_enquiry_delivery_finalise(v_job, 'enquiry-contract-worker', v_claim.lease_token, 'unaccepted-message');
    raise exception 'unaccepted email was marked sent';
  exception when sqlstate '55000' then null;
  end;
  if (select status::text from public.email_outbox where id=v_outbox) <> 'QUEUED' then
    raise exception 'rejected finalisation changed outbox';
  end if;
  foreach v_effect_state in array array['prepared','dispatch_started','provider_accepted'] loop
    perform public.background_job_record_effect_checkpoint(
      v_job, 'enquiry-contract-worker', v_claim.lease_token, 'outbox:' || v_outbox::text,
      'email_dispatch', v_effect_state::public.background_job_effect_state, repeat('d',64),
      'resend', 'enquiry-contract/' || v_job::text, v_expiry,
      case when v_effect_state='provider_accepted' then 'enquiry-contract-provider-message' else null end, '{}'::jsonb);
  end loop;
  begin
    perform public.marketing_enquiry_delivery_finalise(v_job, 'enquiry-contract-worker', v_claim.lease_token, 'different-message');
    raise exception 'wrong provider message was accepted';
  exception when sqlstate '55000' then null;
  end;
  perform public.marketing_enquiry_delivery_finalise(v_job, 'enquiry-contract-worker', v_claim.lease_token, 'enquiry-contract-provider-message');
  perform public.marketing_enquiry_delivery_finalise(v_job, 'enquiry-contract-worker', v_claim.lease_token, 'enquiry-contract-provider-message');
  if (select count(*) from public.audit_events where idempotency_key='audit:website:delivery:' || v_outbox::text) <> 1 then
    raise exception 'finalisation replay duplicated audit';
  end if;
  perform public.background_job_record_effect_checkpoint(
    v_job, 'enquiry-contract-worker', v_claim.lease_token, 'outbox:' || v_outbox::text,
    'email_dispatch', 'finalised', repeat('d',64), 'resend', 'enquiry-contract/' || v_job::text,
    v_expiry, 'enquiry-contract-provider-message', '{}'::jsonb);
  perform public.background_job_record_progress(v_job, 'enquiry-contract-worker', v_claim.lease_token,
    'finalising', 'business_finalised', '{"phase":"business_finalised"}'::jsonb);
  perform public.background_job_complete(v_job, 'enquiry-contract-worker', v_claim.lease_token,
    '{"phase":"business_finalised","processedCount":1}'::jsonb);
  v_receipt := public.marketing_enquiry_staff_receipts(v_first.project_id);
  if v_receipt #>> '{0,emailStatus}' is distinct from 'SENT'
    or v_receipt #>> '{0,deliveryStatus}' is distinct from 'succeeded'
    or v_receipt #>> '{0,customerBrief,summary}' is distinct from 'Original design'
    or exists(select 1 from pgmq.q_portal_background_jobs where message->>'jobId'=v_job::text) then
    raise exception 'completed delivery receipt or queue is incorrect';
  end if;
  begin
    perform public.marketing_enquiry_delivery_finalise(v_job, 'enquiry-contract-worker', v_claim.lease_token, 'enquiry-contract-provider-message');
    raise exception 'released lease finalised again';
  exception when sqlstate '55000' then null;
  end;
  perform set_config('request.jwt.claim.sub', '', true);
  begin
    perform public.marketing_enquiry_staff_receipts(v_first.project_id);
    raise exception 'anonymous caller read receipt';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;
