-- Forward-only extension: preserve the pilot API and historical bank receipts.
begin;
alter table public.xero_deposit_matches
  add column source_kind text not null default 'BANK_TRANSACTION',
  add column provider_invoice_id uuid,
  add constraint xero_match_source_binding check (
    (source_kind='BANK_TRANSACTION' and provider_invoice_id is null)
    or (source_kind='INVOICE_PAYMENT' and provider_invoice_id is not null));

create function private.xero_commit_payment_match(
  p_approval_id uuid,p_actor uuid,p_tenant_id uuid,p_receipt_id uuid,p_contact_id uuid,
  p_project_id uuid,p_invoice_id uuid,p_amount_cents integer,p_receipt_date date,
  p_invoice_fingerprint text,p_ledger_fingerprint text,p_evidence_fingerprint text,p_reference text,
  p_source_kind text,p_provider_invoice_id uuid
)
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare
  v_invoice public.deposit_invoices%rowtype;
  v_existing public.xero_deposit_matches%rowtype;
  v_context jsonb; v_payment uuid; v_total bigint; v_match record;
begin
  perform public.xero_require_payment_approver(p_actor);
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
    if v_existing.source_kind is distinct from p_source_kind or v_existing.provider_invoice_id is distinct from p_provider_invoice_id
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
    'Approved Xero receipt '||p_receipt_id::text,null,p_actor::text,'xero-match:'||p_approval_id::text);
  insert into public.xero_deposit_matches(id,tenant_id,receipt_id,contact_id,project_id,invoice_id,payment_entry_id,
    amount_inc_gst_cents,receipt_date,evidence_fingerprint,approved_by,source_kind,provider_invoice_id)
  values(p_approval_id,p_tenant_id,p_receipt_id,p_contact_id,p_project_id,p_invoice_id,v_payment,
    p_amount_cents,p_receipt_date,p_evidence_fingerprint,p_actor,p_source_kind,p_provider_invoice_id);

  -- Partial receipts remain canonical unallocated money. At full coverage we
  -- settle and allocate those same entries, never create another whole receipt.
  if v_total=v_invoice.total_inc_gst_cents then
    update public.deposit_invoices set status='PAID',paid_at=(select max(receipt_date)::timestamp at time zone 'UTC'
      from public.xero_deposit_matches where invoice_id=p_invoice_id and reversed_at is null),paid_by=p_actor::text,
      payment_reference=nullif(trim(p_reference),''),payment_method='Xero receipts',payment_note='Settled from approved Xero deposit matches'
    where id=p_invoice_id;
    for v_match in select * from public.xero_deposit_matches where invoice_id=p_invoice_id and reversed_at is null order by id loop
      if v_invoice.invoice_kind='STANDALONE' then
        insert into public.project_payment_allocations(project_id,payment_entry_id,standalone_invoice_id,
          amount_inc_gst_cents,change_reason,created_by)
        values(p_project_id,v_match.payment_entry_id,v_invoice.id,v_match.amount_inc_gst_cents,
          'Invoice fully covered by approved Xero payments',p_actor::text);
      else
      perform public.commercial_replace_payment_allocations_with_project_lock(v_match.payment_entry_id,
        jsonb_build_array(jsonb_build_object('quote_version_id',v_invoice.quote_version_id,'payment_term_id',v_invoice.payment_term_id,
          'amount_inc_gst_cents',v_match.amount_inc_gst_cents)), 'Deposit fully covered by approved Xero receipts',p_actor::text);
      end if;
    end loop;
    insert into public.audit_events(project_id,type,idempotency_key,payload) values(p_project_id,'invoice.paid',
      'xero.invoice.paid:'||p_approval_id::text,jsonb_build_object('invoiceId',p_invoice_id,'actor',p_actor,'matchId',p_approval_id));
  end if;
  insert into public.audit_events(project_id,type,idempotency_key,payload) values(p_project_id,'payment.xero_match_approved',
    'xero.match.approved:'||p_approval_id::text,jsonb_build_object('matchId',p_approval_id,'paymentEntryId',v_payment,
      'invoiceId',p_invoice_id,'receiptId',p_receipt_id,'tenantId',p_tenant_id,'amountIncGstCents',p_amount_cents,
      'evidenceFingerprint',p_evidence_fingerprint,'actor',p_actor,'sourceKind',p_source_kind,'providerInvoiceId',p_provider_invoice_id));
  return jsonb_build_object('matchId',p_approval_id,'paymentEntryId',v_payment,'replayed',false);
end;
$$;
revoke all on function private.xero_commit_payment_match(uuid,uuid,uuid,uuid,uuid,uuid,uuid,integer,date,text,text,text,text,text,uuid) from public,anon,authenticated,service_role;

create or replace function public.xero_approve_deposit_match(p_approval_id uuid,p_actor uuid,p_tenant_id uuid,p_receipt_id uuid,p_contact_id uuid,
  p_project_id uuid,p_invoice_id uuid,p_amount_cents integer,p_receipt_date date,
  p_invoice_fingerprint text,p_ledger_fingerprint text,p_evidence_fingerprint text,p_reference text)
returns jsonb language sql security definer set search_path=pg_catalog,pg_temp as $$
  select private.xero_commit_payment_match(p_approval_id,p_actor,p_tenant_id,p_receipt_id,p_contact_id,p_project_id,p_invoice_id,p_amount_cents,p_receipt_date,p_invoice_fingerprint,p_ledger_fingerprint,p_evidence_fingerprint,p_reference,'BANK_TRANSACTION',null);
$$;

create function public.xero_approve_invoice_payment(p_approval_id uuid,p_actor uuid,p_tenant_id uuid,p_receipt_id uuid,p_contact_id uuid,
  p_project_id uuid,p_invoice_id uuid,p_amount_cents integer,p_receipt_date date,
  p_invoice_fingerprint text,p_ledger_fingerprint text,p_evidence_fingerprint text,p_reference text,p_provider_invoice_id uuid)
returns jsonb language sql security definer set search_path=pg_catalog,pg_temp as $$
  select private.xero_commit_payment_match(p_approval_id,p_actor,p_tenant_id,p_receipt_id,p_contact_id,p_project_id,p_invoice_id,p_amount_cents,p_receipt_date,p_invoice_fingerprint,p_ledger_fingerprint,p_evidence_fingerprint,p_reference,'INVOICE_PAYMENT',p_provider_invoice_id);
$$;
revoke all on function public.xero_approve_invoice_payment(uuid,uuid,uuid,uuid,uuid,uuid,uuid,integer,date,text,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.xero_approve_invoice_payment(uuid,uuid,uuid,uuid,uuid,uuid,uuid,integer,date,text,text,text,text,uuid) to service_role;
create or replace function public.commercial_standalone_allocation_guard()
returns trigger language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
declare v_source public.deposit_invoices%rowtype; v_target public.deposit_invoices%rowtype;
begin
  -- Instalments retain invoice ownership even without source_invoice_id (which
  -- identifies the older whole-invoice payment and is unique for that source).
  if exists(select 1 from public.xero_deposit_matches m join public.deposit_invoices i on i.id=m.invoice_id
      where m.payment_entry_id=new.payment_entry_id and m.reversed_at is null and i.invoice_kind='STANDALONE') then
    if not exists(select 1 from public.xero_deposit_matches m
        join public.deposit_invoices i on i.id=m.invoice_id
        join public.project_payment_entries e on e.id=m.payment_entry_id
      where m.payment_entry_id=new.payment_entry_id and m.reversed_at is null and m.source_kind='INVOICE_PAYMENT'
        and m.invoice_id=new.standalone_invoice_id and i.invoice_kind='STANDALONE' and i.status='PAID'
        and m.project_id=new.project_id and e.project_id=new.project_id
        and m.amount_inc_gst_cents=new.amount_inc_gst_cents and e.amount_inc_gst_cents=new.amount_inc_gst_cents
        and new.quote_version_id is null and new.payment_term_id is null
        and not exists(select 1 from public.project_payment_entries r where r.reverses_entry_id=e.id)
        and not exists(select 1 from public.project_payment_allocations a where a.payment_entry_id=e.id and a.reversed_at is null)
        and i.total_inc_gst_cents=(select sum(x.amount_inc_gst_cents) from public.xero_deposit_matches x where x.invoice_id=i.id and x.reversed_at is null)
    ) then raise exception 'Standalone instalments must settle their exact fully covered invoice' using errcode='55000'; end if;
    return new;
  end if;
  select i.* into v_source from public.project_payment_entries e
    join public.deposit_invoices i on i.id = e.source_invoice_id where e.id = new.payment_entry_id;
  if v_source.invoice_kind = 'STANDALONE' and new.standalone_invoice_id is distinct from v_source.id then
    raise exception 'Standalone invoice payments cannot settle quoted scope' using errcode = '22023';
  end if;
  if new.standalone_invoice_id is not null then
    select * into strict v_target from public.deposit_invoices where id = new.standalone_invoice_id;
    if v_target.invoice_kind <> 'STANDALONE' or v_target.project_id <> new.project_id
      or v_target.status <> 'PAID' or v_source.id is distinct from v_target.id
      or new.amount_inc_gst_cents <> v_target.total_inc_gst_cents then
      raise exception 'Mark the whole standalone invoice paid using its payment command' using errcode = '55000';
    end if;
  end if;
  return new;
end;
$$;

-- Preserve the general allocation command's prohibition on repurposing
-- standalone money. Reversal remains the supported correction path.
do $patch$
declare v_definition text; v_anchor text := '  if jsonb_typeof(coalesce(p_allocations, ''[]''::jsonb)) <> ''array'' then';
begin
  v_definition:=replace(pg_get_functiondef('public.commercial_replace_payment_allocations(uuid,jsonb,text,text)'::regprocedure),chr(13),'');
  if strpos(v_definition,v_anchor)=0 then raise exception 'Payment allocation owner changed; review migration'; end if;
  v_definition:=replace(v_definition,v_anchor,
    '  if exists(select 1 from public.xero_deposit_matches m join public.deposit_invoices i on i.id=m.invoice_id
      where m.payment_entry_id=p_payment_entry_id and m.reversed_at is null and i.invoice_kind=''STANDALONE'') then
      raise exception ''Reverse the standalone invoice payment to correct its allocation'' using errcode=''55000'';
    end if;
' || v_anchor);
  execute v_definition;
end;
$patch$;

notify pgrst,'reload schema';
commit;
