-- Owner authorised automatic Xero approval for new portal invoice transfers.
-- Existing frozen requests retain their original status and idempotency identity.
alter table private.xero_invoice_transfer_control add column auto_approve_enabled boolean not null default false;

create or replace function public.xero_invoice_transfer_context(p_job_id uuid,p_lease_token uuid)
returns jsonb language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
declare
  v_invoice public.deposit_invoices%rowtype;
  v_transfer private.xero_invoice_transfers%rowtype;
  v_control private.xero_invoice_transfer_control%rowtype;
  v_mapping private.xero_customer_mappings%rowtype;
begin
  v_invoice := private.xero_invoice_lock_context(p_job_id,p_lease_token);
  select * into strict v_transfer from private.xero_invoice_transfers where job_id=p_job_id;
  select * into strict v_control from private.xero_invoice_transfer_control where singleton;
  select * into v_mapping from private.xero_customer_mappings
    where tenant_id=v_transfer.tenant_id and portal_contact_id=v_transfer.source_contact_id and revoked_at is null for share;
  if not found or v_control.account_code is null or v_control.tax_type is null or v_control.mapping_verified_at is null then
    raise exception 'XERO_MAPPING_REQUIRED' using errcode='55000';
  end if;
  return jsonb_build_object(
    'targetStatus',coalesce((select (r.body::jsonb)->'Invoices'->0->>'Status' from private.xero_invoice_requests r where r.transfer_id=v_transfer.id),case when v_control.auto_approve_enabled then 'AUTHORISED' else 'DRAFT' end),
    'invoice',jsonb_build_object('invoiceId',v_invoice.id,'invoiceRef',v_invoice.invoice_ref,
      'status',v_invoice.status,'kind',v_invoice.invoice_kind,'issueDate',v_invoice.issue_date,'dueDate',v_invoice.due_date,
      'quoteRef',v_invoice.quote_ref,'paymentTermLabel',v_invoice.payment_term_label,
      'totalIncGstCents',v_invoice.total_inc_gst_cents,'totalExGstCents',v_invoice.total_ex_gst_cents,
      'gstCents',v_invoice.gst_cents,'content',v_invoice.content_snapshot),
    'mapping',jsonb_build_object('tenantId',v_transfer.tenant_id,'contactId',v_mapping.xero_contact_id,
      'accountCode',v_control.account_code,'taxType',v_control.tax_type)
  );
end;
$$;
revoke all on function public.xero_invoice_transfer_context(uuid,uuid) from public, anon, authenticated;
grant execute on function public.xero_invoice_transfer_context(uuid,uuid) to service_role;

create or replace function public.xero_invoice_prepare_request(p_job_id uuid,p_lease_token uuid,p_tenant_id uuid,p_body text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare
  v_context jsonb;
  v_transfer private.xero_invoice_transfers%rowtype;
  v_existing private.xero_invoice_requests%rowtype;
  v_document jsonb;
  v_invoice jsonb;
  v_line jsonb;
  v_total numeric := 0;
  v_tax numeric := 0;
begin
  v_context := public.xero_invoice_transfer_context(p_job_id,p_lease_token);
  select * into strict v_transfer from private.xero_invoice_transfers where job_id=p_job_id;
  if p_tenant_id is distinct from v_transfer.tenant_id or p_body is null or octet_length(p_body) > 65536 then
    raise exception 'XERO_REQUEST_INVALID' using errcode='22023';
  end if;
  select * into v_existing from private.xero_invoice_requests where transfer_id=v_transfer.id for update;
  if found then
    if v_existing.body is distinct from p_body then raise exception 'XERO_REQUEST_CHANGED' using errcode='55000'; end if;
    return private.xero_invoice_request_result(v_transfer.id);
  end if;
  v_document := p_body::jsonb;
  if jsonb_typeof(v_document) <> 'object' or (select count(*) from jsonb_object_keys(v_document)) <> 1
    or jsonb_typeof(v_document->'Invoices') is distinct from 'array' or jsonb_array_length(v_document->'Invoices') <> 1 then
    raise exception 'XERO_REQUEST_INVALID' using errcode='22023';
  end if;
  v_invoice := v_document->'Invoices'->0;
  if jsonb_typeof(v_invoice) is distinct from 'object' or (select count(*) from jsonb_object_keys(v_invoice)) <> 10
    or v_invoice->>'Status' is distinct from v_context->>'targetStatus' or v_invoice->>'Type' is distinct from 'ACCREC'
    or v_invoice->>'CurrencyCode' is distinct from 'NZD' or v_invoice->>'LineAmountTypes' is distinct from 'Inclusive'
    or v_invoice->>'InvoiceNumber' is distinct from v_context->'invoice'->>'invoiceRef'
    or v_invoice->>'Reference' is distinct from 'Sanctuary portal ' || v_transfer.invoice_id::text
    or v_invoice->>'Date' is distinct from v_context->'invoice'->>'issueDate'
    or v_invoice->>'DueDate' is distinct from v_context->'invoice'->>'dueDate'
    or v_invoice->'Contact' is distinct from jsonb_build_object('ContactID',v_context->'mapping'->>'contactId')
    or jsonb_typeof(v_invoice->'LineItems') is distinct from 'array'
    or jsonb_array_length(v_invoice->'LineItems') not between 1 and 100 then
    raise exception 'XERO_REQUEST_INVALID' using errcode='22023';
  end if;
  for v_line in select value from jsonb_array_elements(v_invoice->'LineItems') loop
    if jsonb_typeof(v_line) <> 'object' or (select count(*) from jsonb_object_keys(v_line)) <> 7
      or v_line->>'AccountCode' is distinct from v_context->'mapping'->>'accountCode'
      or v_line->>'TaxType' is distinct from v_context->'mapping'->>'taxType'
      or jsonb_typeof(v_line->'Description') is distinct from 'string' or length(v_line->>'Description') not between 1 and 4000
      or jsonb_typeof(v_line->'Quantity') is distinct from 'number' or (v_line->>'Quantity')::numeric <= 0
      or jsonb_typeof(v_line->'UnitAmount') is distinct from 'number' or (v_line->>'UnitAmount')::numeric < 0
      or jsonb_typeof(v_line->'LineAmount') is distinct from 'number' or (v_line->>'LineAmount')::numeric < 0
      or jsonb_typeof(v_line->'TaxAmount') is distinct from 'number' or (v_line->>'TaxAmount')::numeric < 0
      or (v_line->>'TaxAmount')::numeric > (v_line->>'LineAmount')::numeric
      or round((v_line->>'Quantity')::numeric*(v_line->>'UnitAmount')::numeric,2) <> (v_line->>'LineAmount')::numeric then
      raise exception 'XERO_REQUEST_INVALID' using errcode='22023';
    end if;
    v_total := v_total+(v_line->>'LineAmount')::numeric*100;
    v_tax := v_tax+(v_line->>'TaxAmount')::numeric*100;
  end loop;
  if v_total <> (v_context->'invoice'->>'totalIncGstCents')::numeric
    or v_tax <> (v_context->'invoice'->>'gstCents')::numeric
    or v_total-v_tax <> (v_context->'invoice'->>'totalExGstCents')::numeric then
    raise exception 'XERO_REQUEST_TOTAL_MISMATCH' using errcode='22023';
  end if;
  insert into private.xero_invoice_requests(transfer_id,body,body_hash)
    values(v_transfer.id,p_body,encode(sha256(convert_to(p_body,'UTF8')),'hex'));
  return private.xero_invoice_request_result(v_transfer.id);
end;
$$;
revoke all on function public.xero_invoice_prepare_request(uuid,uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.xero_invoice_prepare_request(uuid,uuid,uuid,text) to service_role;
