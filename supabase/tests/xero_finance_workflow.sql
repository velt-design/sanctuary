begin;
do $$
declare v_id uuid:=gen_random_uuid(); v_job uuid; v_claim record; v_context jsonb; v_proof jsonb; v_message bigint; v_draft jsonb; v_request jsonb;
begin
  insert into auth.users(id) values(v_id);
  insert into public.contacts(id) values(v_id);
  insert into public.projects(id,contact_id) values(v_id,v_id);
  insert into public.xero_payment_approvers(user_id,granted_by) values(v_id,'Synthetic finance rehearsal');
  update private.xero_invoice_transfer_control set enabled=true,tenant_id=v_id;
  insert into public.deposit_invoices(id,project_id,status,invoice_ref,customer_name) values(v_id,v_id,'OPEN','INV-FINANCE-SQL','Synthetic customer');
  set constraints all immediate;
  select job_id into strict v_job from private.xero_invoice_transfers where invoice_id=v_id;
  select * into v_claim from public.background_jobs_claim('finance-sql-worker',1,120);
  if v_claim.job_id is distinct from v_job then raise exception 'wrong finance job claimed'; end if;
  perform public.background_job_mark_needs_attention(v_job,'finance-sql-worker',v_claim.lease_token,'XERO_MAPPING_REQUIRED','Finance mapping required');
  v_context:=public.xero_finance_mapping_context(v_id,v_id);
  if v_context->>'sourceContactId' is distinct from v_id::text then raise exception 'mapping context changed customer'; end if;
  v_proof:=jsonb_build_object('contact',jsonb_build_object('id',v_id,'name','Synthetic customer','email',''),
    'account',jsonb_build_object('id',v_id,'code','475','name','Synthetic revenue','defaultTaxType','TAX001'),
    'tax',jsonb_build_object('type','TAX001','name','Synthetic GST','effectiveRate',15));
  perform public.xero_finance_save_mapping(v_id,v_id,v_id,v_id,v_id,v_proof);
  perform public.xero_finance_save_mapping(v_id,v_id,v_id,v_id,v_id,v_proof);
  if (select count(*) from private.xero_finance_mapping_events where id=v_id)<>1 then raise exception 'duplicate mapping audit'; end if;
  if public.xero_finance_resume(v_id,v_id,v_id)->>'state'<>'queued' then raise exception 'finance resume did not queue'; end if;
  select queue_message_id into v_message from public.background_jobs where id=v_job;
  if public.xero_finance_resume(v_id,v_id,v_id)->>'state'<>'already_running' then raise exception 'finance replay not recognised'; end if;
  if (select queue_message_id from public.background_jobs where id=v_job) is distinct from v_message then raise exception 'duplicate retry message'; end if;
  insert into public.xero_deposit_matches values(v_id,v_id,40,null);
  insert into public.project_payment_allocations(payment_entry_id,project_id,standalone_invoice_id,amount_inc_gst_cents) values(v_id,v_id,v_id,40);
  if (public.xero_finance_review(v_id)->'rows'->0->>'recordedCents')::int<>40 then raise exception 'finance balance counted receipt twice'; end if;
  select * into v_claim from public.background_jobs_claim('finance-sql-resumed',1,120);
  perform public.background_job_record_progress(v_job,'finance-sql-resumed',v_claim.lease_token,'running','mapping','{}');
  v_draft:=jsonb_build_object('Type','ACCREC','Status','DRAFT','CurrencyCode','NZD','LineAmountTypes','Inclusive',
    'InvoiceNumber','INV-FINANCE-SQL','Reference','Sanctuary portal '||v_id::text,'Date','2026-09-14','DueDate','2026-09-21',
    'Contact',jsonb_build_object('ContactID',v_id),'LineItems',jsonb_build_array(jsonb_build_object('Description','Synthetic deposit',
      'Quantity',1,'UnitAmount',1.15,'LineAmount',1.15,'TaxAmount',0.15,'AccountCode','475','TaxType','TAX001')));
  v_request:=public.xero_invoice_prepare_request(v_job,v_claim.lease_token,v_id,jsonb_build_object('Invoices',jsonb_build_array(v_draft))::text);
  perform public.xero_invoice_begin_dispatch(v_job,v_claim.lease_token);
  perform public.xero_invoice_finalise(v_job,v_claim.lease_token,v_request->>'bodyHash',
    jsonb_build_object('invoiceId',v_id,'draft',v_draft,'totalCents',115,'taxCents',15,'subtotalCents',100));
  v_context:=public.xero_invoice_observation_context(v_id,v_id);
  perform public.xero_invoice_record_observation(v_id,v_id,(v_context->>'generation')::bigint,'OPEN',
    '{"state":"posted","reason":"INVOICE_CONTENT_UNCHANGED","amountPaidCents":0}'::jsonb);
  if public.xero_finance_observations(v_id,array[v_id])->0->>'state'<>'posted' then raise exception 'finance observation not visible'; end if;
  if public.xero_invoice_observation_targets(v_id)<>'[]'::jsonb then raise exception 'fresh invoice targeted again'; end if;
  update public.xero_payment_approvers set revoked_at=clock_timestamp() where user_id=v_id;
  begin
    perform public.xero_finance_resume(v_id,v_id,v_id);
    raise exception 'revoked finance grant accepted' using errcode='22023';
  exception when insufficient_privilege then null;
  end;
end;
$$;
rollback;
