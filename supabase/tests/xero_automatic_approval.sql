-- Real PGMQ and canonical lease/effect contracts; no Xero network requests.
begin;
do $$
declare
  v_identity uuid := '99999999-1111-4111-8111-111111111111';
  v_invoice uuid := '99999999-2222-4222-8222-222222222222';
  v_provider uuid := '99999999-3333-4333-8333-333333333333';
  v_job public.background_jobs;
  v_claim record;
  v_other record;
  v_draft jsonb;
  v_request jsonb;
  v_proof jsonb;
  v_events bigint;
begin
  if (select enabled from private.xero_invoice_transfer_control) then raise exception 'issuance must default off'; end if;
  if has_function_privilege('authenticated','public.xero_invoice_begin_dispatch(uuid,uuid)','execute')
    or has_table_privilege('service_role','private.xero_invoice_requests','select') then raise exception 'private finance boundary exposed'; end if;
  insert into auth.users(id) values(v_identity);
  insert into public.contacts(id) values(v_identity);
  insert into public.projects(id,contact_id) values(v_identity,v_identity);
  insert into public.deposit_invoices(id,project_id,status,invoice_ref) values(v_invoice,v_identity,'OPEN','INV-DB-SYNTHETIC');
  set constraints all immediate;
  if exists(select 1 from private.xero_invoice_transfers) then raise exception 'disabled producer queued'; end if;
  update private.xero_invoice_transfer_control set enabled=true,auto_approve_enabled=true,tenant_id=v_identity,
    account_code='200',tax_type='OUTPUT2',effective_tax_rate=15,mapping_verified_at=now();
  insert into private.xero_customer_mappings(tenant_id,portal_contact_id,xero_contact_id,verified_at,verified_by)
    values(v_identity,v_identity,v_identity,now(),v_identity);
  -- Historical issued invoice remains untouched. Only new issuance gets a job.
  update public.deposit_invoices set status='PAID' where id=v_invoice;
  if exists(select 1 from private.xero_invoice_transfers) then raise exception 'history queued'; end if;
  v_invoice := gen_random_uuid();
  insert into public.deposit_invoices(id,project_id,status,invoice_ref) values(v_invoice,v_identity,'DRAFT','INV-DB-NEW');
  update public.deposit_invoices set status='OPEN' where id=v_invoice;
  select j.* into strict v_job from public.background_jobs j join private.xero_invoice_transfers t on t.job_id=j.id where t.invoice_id=v_invoice;
  if v_job.status <> 'queued' or v_job.queue_message_id is null then raise exception 'no durable queue message'; end if;
  select * into v_claim from public.background_jobs_claim('xero-sql-worker',1,120);
  if v_claim.job_id is distinct from v_job.id then raise exception 'PGMQ claim wrong job'; end if;
  select * into v_other from public.background_jobs_claim('xero-other-worker',1,120);
  if v_other.job_id is not null then raise exception 'active lease claimed twice'; end if;
  perform public.background_job_record_progress(v_job.id,'xero-sql-worker',v_claim.lease_token,'running','mapping','{}');
  begin
    perform public.xero_invoice_transfer_context(v_job.id,gen_random_uuid());
    raise exception 'bad lease accepted';
  exception when sqlstate '55000' then null;
  end;
  v_draft := jsonb_build_object('Type','ACCREC','Status','AUTHORISED','CurrencyCode','NZD','LineAmountTypes','Inclusive',
    'InvoiceNumber','INV-DB-NEW','Reference','Sanctuary portal '||v_invoice::text,'Date','2026-09-14','DueDate','2026-09-21',
    'Contact',jsonb_build_object('ContactID',v_identity),
    'LineItems',jsonb_build_array(jsonb_build_object('Description','Synthetic deposit','Quantity',1,'UnitAmount',1.15,
      'LineAmount',1.15,'TaxAmount',0.15,'AccountCode','200','TaxType','OUTPUT2')));
  v_request := public.xero_invoice_prepare_request(v_job.id,v_claim.lease_token,v_identity,jsonb_build_object('Invoices',jsonb_build_array(v_draft))::text);
  -- A rollout switch change must never alter an already frozen request.
  update private.xero_invoice_transfer_control set auto_approve_enabled=false;
  if public.xero_invoice_transfer_context(v_job.id,v_claim.lease_token)->>'targetStatus' is distinct from 'AUTHORISED' then
    raise exception 'frozen approval status changed after switch';
  end if;
  if public.xero_invoice_prepare_request(v_job.id,v_claim.lease_token,v_identity,jsonb_build_object('Invoices',jsonb_build_array(v_draft))::text)->>'bodyHash' is distinct from v_request->>'bodyHash' then
    raise exception 'retry changed request';
  end if;
  perform public.xero_invoice_begin_dispatch(v_job.id,v_claim.lease_token);
  if (select state from public.background_job_effects where job_id=v_job.id) <> 'dispatch_started' then raise exception 'dispatch checkpoint missing'; end if;
  v_proof := jsonb_build_object('invoiceId',v_provider,'draft',v_draft,'totalCents',115,'taxCents',15,'subtotalCents',100);
  perform public.xero_invoice_finalise(v_job.id,v_claim.lease_token,v_request->>'bodyHash',v_proof);
  if (select provider_invoice_id from private.xero_invoice_transfers where job_id=v_job.id) is distinct from v_provider
    or (select state from public.background_job_effects where job_id=v_job.id) <> 'finalised' then raise exception 'atomic confirmation failed'; end if;
  select count(*) into v_events from public.background_job_events where job_id=v_job.id;
  perform public.xero_invoice_finalise(v_job.id,v_claim.lease_token,v_request->>'bodyHash',v_proof);
  if (select count(*) from public.background_job_events where job_id=v_job.id) <> v_events then raise exception 'replay duplicated audit'; end if;
  raise notice 'Xero real-PGMQ issuance, exclusive claim, lease denial, frozen dispatch and replay contract passed';
end;
$$;
rollback;
