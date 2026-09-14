begin;
do $$
declare v_id uuid:=gen_random_uuid(); v_job uuid; v_claim record; v_context jsonb; v_proof jsonb; v_message bigint;
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
  update public.xero_payment_approvers set revoked_at=clock_timestamp() where user_id=v_id;
  begin
    perform public.xero_finance_resume(v_id,v_id,v_id);
    raise exception 'revoked finance grant accepted' using errcode='22023';
  exception when insufficient_privilege then null;
  end;
end;
$$;
rollback;
