-- Requires the actual historical commercial schema plus finance migrations05-21.
-- Synthetic identities/provider evidence only; invoke inside an explicit rollback harness.
do $$
declare
  v_actor uuid; v_project uuid:=gen_random_uuid(); v_quote uuid:=gen_random_uuid(); v_version uuid:=gen_random_uuid(); v_invoice uuid:=gen_random_uuid();
  v_tenant uuid:=gen_random_uuid(); v_contact uuid:=gen_random_uuid(); v_source uuid:=gen_random_uuid(); v_source2 uuid:=gen_random_uuid();
  v_provider uuid:=gen_random_uuid(); v_body text; v_transfer uuid; v_truth record; v_history jsonb;
  v_approval uuid:=gen_random_uuid(); v_approval2 uuid:=gen_random_uuid(); v_context jsonb; v_first jsonb; v_second jsonb; v_net bigint;
begin
  if current_setting('sanctuary.finance_rehearsal',true) is distinct from 'rollback_only' then raise exception 'Run only inside the finance rollback harness'; end if;
  select id into strict v_actor from auth.users where lower(email)='jordan@sanctuarypergolas.co.nz' and email_confirmed_at is not null;
  perform public.xero_require_payment_approver(v_actor);
  update private.xero_invoice_transfer_control set enabled=true,tenant_id=v_tenant,account_code='475',tax_type='TAX001',effective_tax_rate=15,mapping_verified_at=now();
  insert into public.contacts(id,name) values(v_contact,'Synthetic finance customer');
  insert into public.projects(id,name,contact_id) values(v_project,'XERO FINANCE FULL SCHEMA - ROLLBACK ONLY',v_contact);
  insert into public.quotes(id,project_id,quote_ref) values(v_quote,v_project,'Q-XERO-QA-'||substr(v_quote::text,1,8));
  insert into public.quote_versions(id,quote_id,version_number,status,accepted_at,pricing_source,total_inc_gst_cents,total_ex_gst_cents,gst_cents,payment_terms)
    values(v_version,v_quote,1,'ACCEPTED',now(),'manual',20000,17391,2609,'[{"id":"deposit","resolvedAmountIncGstCents":10000}]');
  insert into public.deposit_invoices(id,project_id,quote_id,quote_version_id,quote_ref,quote_version_number,invoice_ref,status,issue_date,due_date,deposit_percent,
    quote_total_inc_gst_cents,total_inc_gst_cents,total_ex_gst_cents,gst_cents,payment_term_id,payment_term_label,payment_term_position,payment_term_count,payment_term_calculation,
    customer_name,project_name,currency)
    values(v_invoice,v_project,v_quote,v_version,'Q-XERO-QA-'||substr(v_quote::text,1,8),1,'INV-XERO-QA-'||substr(v_invoice::text,1,8),'OPEN',current_date,current_date+7,50,
      20000,10000,8696,1304,'deposit','Initial deposit',1,2,'percentage','Synthetic Customer','XERO PILOT QA - ROLLBACK ONLY','NZD');
  set constraints all immediate;
  select id into strict v_transfer from private.xero_invoice_transfers where invoice_id=v_invoice;
  v_body:=jsonb_build_object('Contacts',jsonb_build_array(jsonb_build_object('Name','Synthetic finance customer','ContactNumber','SP-'||v_contact::text)))::text;
  perform public.xero_customer_creation_command(v_actor,v_invoice,v_tenant,v_contact,'prepare',v_body);
  perform public.xero_customer_creation_command(v_actor,v_invoice,v_tenant,v_contact,'dispatch',v_body);
  -- Synthetic provider evidence only; no accounting API is called by this rollback contract.
  perform public.xero_customer_creation_command(v_actor,v_invoice,v_tenant,v_contact,'finalise',v_body,v_contact);
  v_body:=jsonb_build_object('Invoices',jsonb_build_array(jsonb_build_object('Type','ACCREC','Status','DRAFT','CurrencyCode','NZD',
    'InvoiceNumber','INV-XERO-QA-'||substr(v_invoice::text,1,8),'Reference','Sanctuary portal '||v_invoice::text,
    'Date',current_date,'DueDate',current_date+7,'LineAmountTypes','Inclusive','Contact',jsonb_build_object('ContactID',v_contact),
    'LineItems',jsonb_build_array(jsonb_build_object('Description','Synthetic deposit','Quantity',1,'UnitAmount',100,'LineAmount',100,
      'TaxAmount',13.04,'AccountCode','475','TaxType','TAX001')))))::text;
  insert into private.xero_invoice_requests(transfer_id,body,body_hash,dispatch_started_at,provider_invoice_id,finalised_at)
    values(v_transfer,v_body,encode(sha256(convert_to(v_body,'UTF8')),'hex'),now(),v_provider,now());
  update private.xero_invoice_transfers set provider_invoice_id=v_provider,last_verified_at=now() where id=v_transfer;
  v_context:=public.xero_deposit_review_context(v_invoice);
  v_first:=public.xero_approve_invoice_payment(v_approval,v_actor,v_tenant,v_source,v_contact,v_project,v_invoice,4000,current_date,
    v_context->>'invoiceFingerprint',v_context->>'ledgerFingerprint',repeat('a',64),'Synthetic receipt',v_provider);
  if (select status from public.deposit_invoices where id=v_invoice)<>'OPEN' or not (public.xero_deposit_review_context(v_invoice)->>'customerWon')::boolean then
    raise exception 'Partial deposit outcome failed';
  end if;
  select * into v_truth from public.commercial_project_financial_truth(v_project);
  if v_truth.paid_inc_gst_cents<>4000 or v_truth.open_invoice_inc_gst_cents<>6000 or v_truth.remaining_to_invoice_inc_gst_cents<>10000 then
    raise exception 'Partial payment financial truth mismatch'; end if;
  v_history:=public.xero_invoice_payment_history(v_actor,v_invoice,v_tenant,0);
  if (v_history->>'recordedCents')::int<>4000 or v_history->'matches'->0->>'sourceKind'<>'INVOICE_PAYMENT' then raise exception 'Invoice payment history mismatch'; end if;
  begin
    perform public.commercial_replace_payment_allocations_with_project_lock((v_first->>'paymentEntryId')::uuid,'[]'::jsonb,'Synthetic attempted release',v_actor::text);
    raise exception 'Reserved invoice payment was released as spare credit';
  exception when sqlstate '55000' then null; end;
  begin
    perform public.xero_approve_deposit_match(gen_random_uuid(),v_actor,v_tenant,gen_random_uuid(),v_contact,v_project,v_invoice,1,current_date,
      v_context->>'invoiceFingerprint',v_context->>'ledgerFingerprint',repeat('c',64),'Synthetic mixed source');
    raise exception 'Mixed source accepted';
  exception when others then if sqlerrm not like '%another Xero source%' then raise; end if; end;
  if not (public.xero_approve_invoice_payment(v_approval,v_actor,v_tenant,v_source,v_contact,v_project,v_invoice,4000,current_date,
    v_context->>'invoiceFingerprint',v_context->>'ledgerFingerprint',repeat('a',64),'Synthetic receipt',v_provider)->>'replayed')::boolean then raise exception 'Retry failed'; end if;
  begin
    perform public.xero_approve_invoice_payment(gen_random_uuid(),v_actor,v_tenant,v_source,v_contact,v_project,v_invoice,4000,current_date,
      v_context->>'invoiceFingerprint',v_context->>'ledgerFingerprint',repeat('a',64),'Synthetic receipt',v_provider);
    raise exception 'Duplicate accepted';
  exception when sqlstate '55000' then null; end;
  v_context:=public.xero_deposit_review_context(v_invoice);
  v_second:=public.xero_approve_invoice_payment(v_approval2,v_actor,v_tenant,v_source2,v_contact,v_project,v_invoice,6000,current_date,
    v_context->>'invoiceFingerprint',v_context->>'ledgerFingerprint',repeat('b',64),'Synthetic receipt two',v_provider);
  select sum(amount_inc_gst_cents) into v_net from public.project_payment_entries where project_id=v_project;
  if v_net<>10000 or (select count(*) from public.project_payment_entries where project_id=v_project)<>2
    or (select status from public.deposit_invoices where id=v_invoice)<>'PAID'
    or (select sum(amount_inc_gst_cents) from public.project_payment_allocations where project_id=v_project and reversed_at is null)<>10000 then
    raise exception 'Full settlement or allocation failed';
  end if;
  perform public.commercial_reverse_payment_entry_with_project_lock((v_second->>'paymentEntryId')::uuid,'Synthetic correction',v_actor::text);
  if (select status from public.deposit_invoices where id=v_invoice)<>'OPEN'
    or exists(select 1 from public.project_payment_allocations where project_id=v_project and reversed_at is null) then raise exception 'Partial reversal failed'; end if;
  select * into v_truth from public.commercial_project_financial_truth(v_project);
  if v_truth.paid_inc_gst_cents<>4000 or v_truth.open_invoice_inc_gst_cents<>6000 then raise exception 'Reversal financial truth mismatch'; end if;
  perform public.commercial_reverse_payment_entry_with_project_lock((v_first->>'paymentEntryId')::uuid,'Synthetic correction',v_actor::text);
  if (public.xero_deposit_review_context(v_invoice)->>'customerWon')::boolean then raise exception 'Full reversal left customer won'; end if;
  perform public.xero_record_deposit_review_note(gen_random_uuid(),v_actor,v_tenant,v_source,v_invoice,'INVESTIGATE','Synthetic investigation note');
  v_history:=public.xero_invoice_payment_history(v_actor,v_invoice,v_tenant,0);
  if (v_history->>'recordedCents')::int<>0 or jsonb_array_length(v_history->'matches')<>2 then raise exception 'Reversed payment history lost'; end if;
  if (select count(*) from public.audit_events where project_id=v_project and type='payment.xero_match_approved')<>2 then raise exception 'Approval audit missing'; end if;
end;
$$;
