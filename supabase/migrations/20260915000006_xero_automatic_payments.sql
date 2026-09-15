-- Automatic recording has an explicit machine actor. Existing manual commands retain their grant checks.
begin;
alter table private.xero_invoice_transfer_control add column auto_record_payments_enabled boolean not null default false;
alter table public.xero_deposit_matches alter column approved_by drop not null,
  add column recording_method text not null default 'MANUAL',
  add constraint xero_match_recording_actor check (
    (recording_method='MANUAL' and approved_by is not null)
    or (recording_method='AUTOMATIC' and approved_by is null and source_kind='INVOICE_PAYMENT'));

create function private.xero_commit_payment_match(
  p_approval_id uuid,p_actor uuid,p_tenant_id uuid,p_receipt_id uuid,p_contact_id uuid,
  p_project_id uuid,p_invoice_id uuid,p_amount_cents integer,p_receipt_date date,
  p_invoice_fingerprint text,p_ledger_fingerprint text,p_evidence_fingerprint text,p_reference text,
  p_source_kind text,p_provider_invoice_id uuid,p_automatic boolean
)
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare
  v_invoice public.deposit_invoices%rowtype;
  v_existing public.xero_deposit_matches%rowtype;
  v_recorded_by text := case when p_automatic then 'xero-automatic' else p_actor::text end;
  v_context jsonb; v_payment uuid; v_total bigint; v_match record;
begin
  if p_automatic is null then raise exception 'Recording method is required'; end if;
  if p_automatic then
    if p_actor is not null or p_source_kind is distinct from 'INVOICE_PAYMENT' then
      raise exception 'Invalid automatic payment actor or source' using errcode='22023';
    end if;
    perform 1 from private.xero_invoice_transfer_control
      where singleton and tenant_id=p_tenant_id and auto_record_payments_enabled for share;
    if not found then raise exception 'Automatic payment recording is disabled' using errcode='55000'; end if;
  else
    perform public.xero_require_payment_approver(p_actor);
  end if;
  if p_source_kind is null or p_source_kind not in ('BANK_TRANSACTION','INVOICE_PAYMENT')
    or (p_source_kind='INVOICE_PAYMENT') is distinct from (p_provider_invoice_id is not null) then
    raise exception 'Invalid payment source binding' using errcode='22023';
  end if;
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
    if v_existing.recording_method is distinct from (case when p_automatic then 'AUTOMATIC' else 'MANUAL' end)
      or v_existing.source_kind is distinct from p_source_kind or v_existing.provider_invoice_id is distinct from p_provider_invoice_id
      or v_existing.tenant_id is distinct from p_tenant_id or v_existing.receipt_id is distinct from p_receipt_id
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
  if p_automatic and (
    exists(select 1 from public.xero_deposit_matches where tenant_id=p_tenant_id and receipt_id=p_receipt_id and reversed_at is not null)
    or exists(select 1 from public.xero_deposit_review_notes where tenant_id=p_tenant_id and receipt_id=p_receipt_id)
  ) then raise exception 'Payment has a finance decision; manual review required' using errcode='55000'; end if;
  select * into strict v_invoice from public.deposit_invoices where id=p_invoice_id for update;
  if v_invoice.project_id is distinct from p_project_id or v_invoice.status<>'OPEN'
    or v_invoice.currency<>'NZD' or v_invoice.invoice_kind not in ('QUOTE_LINKED','STANDALONE')
    or (p_source_kind='BANK_TRANSACTION' and (v_invoice.payment_term_position<>1 or v_invoice.invoice_kind<>'QUOTE_LINKED')) then
    raise exception 'Invoice is not an open NZD deposit for this project' using errcode='55000';
  end if;
  if p_source_kind='INVOICE_PAYMENT' and not exists (
    select 1 from private.xero_invoice_transfers t
      join private.xero_invoice_requests r on r.transfer_id=t.id
      join private.xero_invoice_transfer_control c on c.singleton and c.tenant_id=t.tenant_id
    where t.invoice_id=p_invoice_id and t.project_id=p_project_id and t.tenant_id=p_tenant_id
      and t.provider_invoice_id=p_provider_invoice_id
      and r.body::jsonb #>> '{Invoices,0,Contact,ContactID}'=p_contact_id::text
  ) then raise exception 'Payment invoice binding changed; review again' using errcode='55000'; end if;
  -- Different endpoints can represent money already imported as a bank receipt.
  -- Mixed-source project history requires reconciliation before another import.
  if exists(select 1 from public.xero_deposit_matches where project_id=p_project_id
      and reversed_at is null and source_kind<>p_source_kind) then
    raise exception 'Existing payment history uses another Xero source; reconcile before importing' using errcode='55000';
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
    (case when p_automatic then 'Automatically verified Xero receipt ' else 'Approved Xero receipt ' end)||p_receipt_id::text,null,v_recorded_by,'xero-match:'||p_approval_id::text);
  insert into public.xero_deposit_matches(id,tenant_id,receipt_id,contact_id,project_id,invoice_id,payment_entry_id,
    amount_inc_gst_cents,receipt_date,evidence_fingerprint,approved_by,source_kind,provider_invoice_id,recording_method)
  values(p_approval_id,p_tenant_id,p_receipt_id,p_contact_id,p_project_id,p_invoice_id,v_payment,
    p_amount_cents,p_receipt_date,p_evidence_fingerprint,p_actor,p_source_kind,p_provider_invoice_id,case when p_automatic then 'AUTOMATIC' else 'MANUAL' end);

  -- Partial receipts remain canonical unallocated money. At full coverage we
  -- settle and allocate those same entries, never create another whole receipt.
  if v_total=v_invoice.total_inc_gst_cents then
    update public.deposit_invoices set status='PAID',paid_at=(select max(receipt_date)::timestamp at time zone 'UTC'
      from public.xero_deposit_matches where invoice_id=p_invoice_id and reversed_at is null),paid_by=v_recorded_by,
      payment_reference=nullif(trim(p_reference),''),payment_method='Xero receipts',payment_note='Settled from approved Xero deposit matches'
    where id=p_invoice_id;
    for v_match in select * from public.xero_deposit_matches where invoice_id=p_invoice_id and reversed_at is null order by id loop
      if v_invoice.invoice_kind='STANDALONE' then
        insert into public.project_payment_allocations(project_id,payment_entry_id,standalone_invoice_id,
          amount_inc_gst_cents,change_reason,created_by)
        values(p_project_id,v_match.payment_entry_id,v_invoice.id,v_match.amount_inc_gst_cents,
          'Invoice fully covered by approved Xero payments',v_recorded_by);
      else
      perform public.commercial_replace_payment_allocations_with_project_lock(v_match.payment_entry_id,
        jsonb_build_array(jsonb_build_object('quote_version_id',v_invoice.quote_version_id,'payment_term_id',v_invoice.payment_term_id,
          'amount_inc_gst_cents',v_match.amount_inc_gst_cents)), 'Deposit fully covered by approved Xero receipts',v_recorded_by);
      end if;
    end loop;
    insert into public.audit_events(project_id,type,idempotency_key,payload) values(p_project_id,'invoice.paid',
      'xero.invoice.paid:'||p_approval_id::text,jsonb_build_object('invoiceId',p_invoice_id,'actor',v_recorded_by,'recordingMethod',case when p_automatic then 'AUTOMATIC' else 'MANUAL' end,'matchId',p_approval_id));
  end if;
  insert into public.audit_events(project_id,type,idempotency_key,payload) values(p_project_id,case when p_automatic then 'payment.xero_match_recorded' else 'payment.xero_match_approved' end,
    'xero.match.approved:'||p_approval_id::text,jsonb_build_object('matchId',p_approval_id,'paymentEntryId',v_payment,
      'invoiceId',p_invoice_id,'receiptId',p_receipt_id,'tenantId',p_tenant_id,'amountIncGstCents',p_amount_cents,
      'evidenceFingerprint',p_evidence_fingerprint,'actor',v_recorded_by,'recordingMethod',case when p_automatic then 'AUTOMATIC' else 'MANUAL' end,'sourceKind',p_source_kind,'providerInvoiceId',p_provider_invoice_id));
  return jsonb_build_object('matchId',p_approval_id,'paymentEntryId',v_payment,'replayed',false);
end;
$$;
revoke all on function private.xero_commit_payment_match(uuid,uuid,uuid,uuid,uuid,uuid,uuid,integer,date,text,text,text,text,text,uuid,boolean) from public,anon,authenticated,service_role;

create or replace function private.xero_commit_payment_match(
  p_approval_id uuid,p_actor uuid,p_tenant_id uuid,p_receipt_id uuid,p_contact_id uuid,
  p_project_id uuid,p_invoice_id uuid,p_amount_cents integer,p_receipt_date date,
  p_invoice_fingerprint text,p_ledger_fingerprint text,p_evidence_fingerprint text,p_reference text,
  p_source_kind text,p_provider_invoice_id uuid
) returns jsonb language sql security definer set search_path=pg_catalog,pg_temp as $$
  select private.xero_commit_payment_match(p_approval_id,p_actor,p_tenant_id,p_receipt_id,p_contact_id,
    p_project_id,p_invoice_id,p_amount_cents,p_receipt_date,p_invoice_fingerprint,p_ledger_fingerprint,
    p_evidence_fingerprint,p_reference,p_source_kind,p_provider_invoice_id,false);
$$;

create function public.xero_record_invoice_payment(
  p_approval_id uuid,p_tenant_id uuid,p_receipt_id uuid,p_contact_id uuid,
  p_project_id uuid,p_invoice_id uuid,p_amount_cents integer,p_receipt_date date,
  p_invoice_fingerprint text,p_ledger_fingerprint text,p_evidence_fingerprint text,p_reference text,p_provider_invoice_id uuid
) returns jsonb language sql security definer set search_path=pg_catalog,pg_temp as $$
  select private.xero_commit_payment_match(p_approval_id,null,p_tenant_id,p_receipt_id,p_contact_id,
    p_project_id,p_invoice_id,p_amount_cents,p_receipt_date,p_invoice_fingerprint,p_ledger_fingerprint,
    p_evidence_fingerprint,p_reference,'INVOICE_PAYMENT',p_provider_invoice_id,true);
$$;
revoke all on function public.xero_record_invoice_payment(uuid,uuid,uuid,uuid,uuid,uuid,integer,date,text,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.xero_record_invoice_payment(uuid,uuid,uuid,uuid,uuid,uuid,integer,date,text,text,text,text,uuid) to service_role;

create function public.xero_automatic_payment_context(p_invoice_id uuid,p_tenant_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare v_context jsonb; v_transfer private.xero_invoice_transfers%rowtype; v_body text;
begin
  perform 1 from private.xero_invoice_transfer_control where singleton and tenant_id=p_tenant_id and auto_record_payments_enabled;
  if not found then raise exception 'Automatic payment recording is disabled' using errcode='55000'; end if;
  v_context:=public.xero_deposit_review_context(p_invoice_id);
  select * into v_transfer from private.xero_invoice_transfers where invoice_id=p_invoice_id;
  if not found or v_transfer.provider_invoice_id is null or v_transfer.tenant_id is distinct from p_tenant_id
    or not exists(select 1 from private.xero_invoice_transfer_control where singleton and tenant_id=p_tenant_id) then
    raise exception 'XERO_PAYMENT_REVIEW_UNAVAILABLE';
  end if;
  select body into strict v_body from private.xero_invoice_requests where transfer_id=v_transfer.id;
  return v_context || jsonb_build_object('providerInvoiceId',v_transfer.provider_invoice_id,'expectedBody',v_body,
    'hasOtherSourceHistory',exists(select 1 from public.xero_deposit_matches m where m.project_id=v_transfer.project_id
      and m.reversed_at is null and m.source_kind<>'INVOICE_PAYMENT'));
end; $$;
revoke all on function public.xero_automatic_payment_context(uuid,uuid) from public,anon,authenticated;
grant execute on function public.xero_automatic_payment_context(uuid,uuid) to service_role;

create or replace function public.xero_invoice_payment_history(p_actor uuid,p_invoice_id uuid,p_tenant_id uuid,p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare v_context jsonb; v_rows jsonb;
begin
  perform public.xero_require_payment_approver(p_actor);
  if p_offset is null or p_offset<0 or p_offset>10000 then raise exception 'Invalid history page'; end if;
  if not exists(select 1 from private.xero_invoice_transfer_control where singleton and tenant_id=p_tenant_id) then
    raise exception 'XERO_PAYMENT_HISTORY_UNAVAILABLE';
  end if;
  v_context:=public.xero_deposit_review_context(p_invoice_id);
  select coalesce(jsonb_agg(row.value order by row.approved_at desc,row.id desc),'[]'::jsonb) into v_rows
  from (select m.id,m.approved_at,jsonb_build_object('id',m.id,'sourceKind',m.source_kind,
      'amountCents',m.amount_inc_gst_cents,'receiptDate',m.receipt_date,'approvedAt',m.approved_at,
      'approvedBy',case when m.recording_method='AUTOMATIC' then 'Automatic Xero sync' else coalesce(u.email,'Former staff member') end,'recordingMethod',m.recording_method,'reversedAt',m.reversed_at,
      'reversalReason',r.reason,'reversedBy',coalesce(ru.email,r.created_by),
      'reference',e.reference) value
    from public.xero_deposit_matches m
    join public.project_payment_entries e on e.id=m.payment_entry_id
    left join auth.users u on u.id=m.approved_by
    left join public.project_payment_entries r on r.id=m.reversal_entry_id
    left join auth.users ru on ru.id::text=r.created_by
    where m.invoice_id=p_invoice_id and m.tenant_id=p_tenant_id
    order by m.approved_at desc,m.id desc limit 51 offset p_offset) row;
  return jsonb_build_object('invoice',v_context->'invoice','recordedCents',v_context->'matchedCents',
    'customerWon',v_context->'customerWon','hasUnmatchedPaymentHistory',v_context->'hasUnmatchedPaymentHistory',
    'matches',v_rows,'checkedAt',clock_timestamp());
end; $$;
create or replace function public.xero_record_deposit_review_note(
  p_id uuid,p_actor uuid,p_tenant_id uuid,p_receipt_id uuid,p_invoice_id uuid,p_disposition text,p_reason text
) returns uuid language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare v_note public.xero_deposit_review_notes%rowtype;
begin
  perform public.xero_require_payment_approver(p_actor);
  perform pg_advisory_xact_lock(hashtextextended('xero-receipt:'||p_tenant_id::text||':'||p_receipt_id::text,0));
  perform pg_advisory_xact_lock(hashtextextended('xero-review-note:'||p_id::text,0));
  select * into v_note from public.xero_deposit_review_notes where id=p_id;
  if found then
    if v_note.recorded_by is distinct from p_actor or v_note.tenant_id is distinct from p_tenant_id
      or v_note.receipt_id is distinct from p_receipt_id or v_note.invoice_id is distinct from p_invoice_id
      or v_note.disposition is distinct from p_disposition or v_note.reason is distinct from btrim(p_reason) then
      raise exception 'Review note identity reused for different evidence' using errcode='22023';
    end if;
    return v_note.id;
  end if;
  insert into public.xero_deposit_review_notes(id,tenant_id,receipt_id,invoice_id,disposition,reason,recorded_by)
    values(p_id,p_tenant_id,p_receipt_id,p_invoice_id,p_disposition,btrim(p_reason),p_actor);
  return p_id;
end;
$$;
notify pgrst,'reload schema';
commit;
