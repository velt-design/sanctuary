begin;

create function public.xero_require_payment_approver(p_actor uuid)
returns void language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
begin
  perform 1 from public.xero_payment_approvers where user_id=p_actor and revoked_at is null for share;
  if not found then raise exception 'Payment approval permission is required' using errcode='42501'; end if;
end;
$$;
revoke all on function public.xero_require_payment_approver(uuid) from public,anon,authenticated;

create function public.xero_approve_deposit_match(
  p_approval_id uuid,p_actor uuid,p_tenant_id uuid,p_receipt_id uuid,p_contact_id uuid,
  p_project_id uuid,p_invoice_id uuid,p_amount_cents integer,p_receipt_date date,
  p_invoice_fingerprint text,p_ledger_fingerprint text,p_evidence_fingerprint text,p_reference text
)
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare
  v_invoice public.deposit_invoices%rowtype;
  v_existing public.xero_deposit_matches%rowtype;
  v_context jsonb; v_payment uuid; v_total bigint; v_match record;
begin
  perform public.xero_require_payment_approver(p_actor);
  if p_approval_id is null or p_tenant_id is null or p_receipt_id is null or p_contact_id is null
    or p_amount_cents is null or p_amount_cents<=0 or p_receipt_date is null
    or p_evidence_fingerprint is null or p_evidence_fingerprint !~ '^[a-f0-9]{64}$'
    or length(coalesce(p_reference,''))>240 then
    raise exception 'Invalid reviewed deposit evidence' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('xero-receipt:'||p_tenant_id::text||':'||p_receipt_id::text,0));
  perform pg_advisory_xact_lock(hashtextextended('commercial-project-invoice:'||p_project_id::text,0));

  select * into v_existing from public.xero_deposit_matches where id=p_approval_id;
  if found then
    if v_existing.tenant_id is distinct from p_tenant_id or v_existing.receipt_id is distinct from p_receipt_id
      or v_existing.invoice_id is distinct from p_invoice_id or v_existing.project_id is distinct from p_project_id
      or v_existing.contact_id is distinct from p_contact_id or v_existing.approved_by is distinct from p_actor
      or v_existing.amount_inc_gst_cents is distinct from p_amount_cents or v_existing.receipt_date is distinct from p_receipt_date
      or v_existing.evidence_fingerprint is distinct from p_evidence_fingerprint then
      raise exception 'Approval identity was reused for different evidence' using errcode='22023';
    end if;
    if v_existing.reversed_at is not null then raise exception 'This match was reversed; review again' using errcode='55000'; end if;
    return jsonb_build_object('matchId',v_existing.id,'paymentEntryId',v_existing.payment_entry_id,'replayed',true);
  end if;
  if exists(select 1 from public.xero_deposit_matches where tenant_id=p_tenant_id and receipt_id=p_receipt_id and reversed_at is null) then
    raise exception 'This Xero receipt is already recorded; inspect its existing match' using errcode='55000';
  end if;
  select * into strict v_invoice from public.deposit_invoices where id=p_invoice_id for update;
  if v_invoice.project_id is distinct from p_project_id or v_invoice.status<>'OPEN'
    or v_invoice.payment_term_position<>1 or v_invoice.invoice_kind<>'QUOTE_LINKED' or v_invoice.currency<>'NZD' then
    raise exception 'Invoice is not an open NZD deposit for this project' using errcode='55000';
  end if;
  v_context:=public.xero_deposit_review_context(p_invoice_id);
  if v_context->>'invoiceFingerprint' is distinct from p_invoice_fingerprint
    or v_context->>'ledgerFingerprint' is distinct from p_ledger_fingerprint then
    raise exception 'Payment evidence changed; review again' using errcode='55000';
  end if;
  if (v_context->>'hasUnmatchedPaymentHistory')::boolean then
    raise exception 'Existing payment history needs reconciliation before importing a receipt' using errcode='55000';
  end if;
  v_total:=(v_context->>'matchedCents')::bigint+p_amount_cents;
  if v_total>v_invoice.total_inc_gst_cents then
    raise exception 'Receipts exceed the remaining deposit; review their allocation' using errcode='55000';
  end if;
  if exists(select 1 from public.project_payment_allocations a join public.xero_deposit_matches m on m.payment_entry_id=a.payment_entry_id
    where m.invoice_id=p_invoice_id and m.reversed_at is null and a.reversed_at is null) then
    raise exception 'Deposit money has already been allocated; review its allocation' using errcode='55000';
  end if;

  v_payment:=public.commercial_record_project_payment_entry(p_project_id,'PAYMENT',p_amount_cents,
    p_receipt_date::timestamp at time zone 'UTC','Xero receipt',nullif(trim(p_reference),''),
    'Approved Xero receipt '||p_receipt_id::text,null,p_actor::text,'xero-match:'||p_approval_id::text);
  insert into public.xero_deposit_matches(id,tenant_id,receipt_id,contact_id,project_id,invoice_id,payment_entry_id,
    amount_inc_gst_cents,receipt_date,evidence_fingerprint,approved_by)
  values(p_approval_id,p_tenant_id,p_receipt_id,p_contact_id,p_project_id,p_invoice_id,v_payment,
    p_amount_cents,p_receipt_date,p_evidence_fingerprint,p_actor);

  -- Partial receipts remain canonical unallocated money. At full coverage we
  -- settle and allocate those same entries, never create another whole receipt.
  if v_total=v_invoice.total_inc_gst_cents then
    update public.deposit_invoices set status='PAID',paid_at=(select max(receipt_date)::timestamp at time zone 'UTC'
      from public.xero_deposit_matches where invoice_id=p_invoice_id and reversed_at is null),paid_by=p_actor::text,
      payment_reference=nullif(trim(p_reference),''),payment_method='Xero receipts',payment_note='Settled from approved Xero deposit matches'
    where id=p_invoice_id;
    for v_match in select * from public.xero_deposit_matches where invoice_id=p_invoice_id and reversed_at is null order by id loop
      perform public.commercial_replace_payment_allocations_with_project_lock(v_match.payment_entry_id,
        jsonb_build_array(jsonb_build_object('quote_version_id',v_invoice.quote_version_id,'payment_term_id',v_invoice.payment_term_id,
          'amount_inc_gst_cents',v_match.amount_inc_gst_cents)), 'Deposit fully covered by approved Xero receipts',p_actor::text);
    end loop;
    insert into public.audit_events(project_id,type,idempotency_key,payload) values(p_project_id,'invoice.paid',
      'xero.invoice.paid:'||p_approval_id::text,jsonb_build_object('invoiceId',p_invoice_id,'actor',p_actor,'matchId',p_approval_id));
  end if;
  insert into public.audit_events(project_id,type,idempotency_key,payload) values(p_project_id,'payment.xero_match_approved',
    'xero.match.approved:'||p_approval_id::text,jsonb_build_object('matchId',p_approval_id,'paymentEntryId',v_payment,
      'invoiceId',p_invoice_id,'receiptId',p_receipt_id,'tenantId',p_tenant_id,'amountIncGstCents',p_amount_cents,
      'evidenceFingerprint',p_evidence_fingerprint,'actor',p_actor));
  return jsonb_build_object('matchId',p_approval_id,'paymentEntryId',v_payment,'replayed',false);
end;
$$;
revoke all on function public.xero_approve_deposit_match(uuid,uuid,uuid,uuid,uuid,uuid,uuid,integer,date,text,text,text,text) from public,anon,authenticated;
grant execute on function public.xero_approve_deposit_match(uuid,uuid,uuid,uuid,uuid,uuid,uuid,integer,date,text,text,text,text) to service_role;

create function public.xero_guard_payment_entry()
returns trigger language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
begin
  if new.entry_type='PAYMENT' and new.source_invoice_id is not null and exists(select 1 from public.xero_deposit_matches
    where invoice_id=new.source_invoice_id and reversed_at is null) then
    raise exception 'This invoice has Xero receipt matches; do not record another whole payment' using errcode='55000';
  end if;
  if new.entry_type='REVERSAL' and exists(select 1 from public.xero_deposit_matches where payment_entry_id=new.reverses_entry_id) then
    perform public.xero_require_payment_approver(new.created_by::uuid);
  end if;
  return new;
end;
$$;
create trigger project_payment_entries_xero_guard before insert on public.project_payment_entries
for each row execute function public.xero_guard_payment_entry();
revoke all on function public.xero_guard_payment_entry() from public,anon,authenticated;

create function public.xero_sync_deposit_reversal()
returns trigger language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare v_match public.xero_deposit_matches%rowtype;
begin
  select * into v_match from public.xero_deposit_matches where payment_entry_id=new.reverses_entry_id and reversed_at is null;
  if not found then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended('commercial-project-invoice:'||v_match.project_id::text,0));
  update public.xero_deposit_matches set reversed_at=clock_timestamp(),reversal_entry_id=new.id where id=v_match.id;
  -- Reopening releases stage allocations for the remaining partial receipts too.
  update public.project_payment_allocations set reversed_at=clock_timestamp(),reversed_by=new.created_by,reversal_reason=new.reason
    where payment_entry_id in(select payment_entry_id from public.xero_deposit_matches where invoice_id=v_match.invoice_id)
      and reversed_at is null;
  update public.deposit_invoices set status='OPEN',paid_at=null,paid_by=null,payment_reference=null,payment_method=null,payment_note=null
    where id=v_match.invoice_id and status='PAID';
  insert into public.audit_events(project_id,type,idempotency_key,payload) values(v_match.project_id,'payment.xero_match_reversed',
    'xero.match.reversed:'||new.id::text,jsonb_build_object('matchId',v_match.id,'invoiceId',v_match.invoice_id,
      'paymentEntryId',v_match.payment_entry_id,'reversalEntryId',new.id,'reason',new.reason,'actor',new.created_by));
  return new;
end;
$$;
create trigger project_payment_entries_xero_reversal after insert on public.project_payment_entries
for each row when(new.entry_type='REVERSAL') execute function public.xero_sync_deposit_reversal();
revoke all on function public.xero_sync_deposit_reversal() from public,anon,authenticated;

create function public.xero_guard_invoice_settlement()
returns trigger language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare v_total bigint;
begin
  select coalesce(sum(amount_inc_gst_cents),0) into v_total from public.xero_deposit_matches where invoice_id=new.id and reversed_at is null;
  if v_total>0 and v_total<new.total_inc_gst_cents then
    raise exception 'Only part of this deposit is recorded; approve the remaining receipt instead of marking the whole invoice paid' using errcode='55000';
  end if;
  return new;
end;
$$;
create trigger deposit_invoices_xero_settlement before update of status on public.deposit_invoices
for each row when(old.status='OPEN' and new.status='PAID') execute function public.xero_guard_invoice_settlement();
revoke all on function public.xero_guard_invoice_settlement() from public,anon,authenticated;

notify pgrst,'reload schema';
commit;
