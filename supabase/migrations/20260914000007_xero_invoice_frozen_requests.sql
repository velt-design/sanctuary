create table private.xero_invoice_requests (
  transfer_id uuid primary key references private.xero_invoice_transfers(id) on delete restrict,
  body text not null check (octet_length(body) between 1 and 65536),
  body_hash text not null check (body_hash=encode(sha256(convert_to(body,'UTF8')),'hex')),
  idempotency_key text not null unique default ('sp-xero:' || gen_random_uuid()::text),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '5 minutes',
  dispatch_started_at timestamptz,
  provider_invoice_id uuid,
  finalised_at timestamptz,
  check (expires_at > created_at and expires_at <= created_at+interval '5 minutes'),
  check (finalised_at is null or (dispatch_started_at is not null and provider_invoice_id is not null))
);
alter table private.xero_invoice_requests enable row level security;
revoke all on private.xero_invoice_requests from public, anon, authenticated, service_role;

create function private.xero_invoice_request_immutable()
returns trigger language plpgsql set search_path=pg_catalog,pg_temp as $$
begin
  if tg_op='DELETE' then raise exception 'XERO_REQUEST_IMMUTABLE'; end if;
  if new.transfer_id is distinct from old.transfer_id or new.body is distinct from old.body or new.body_hash is distinct from old.body_hash
    or new.idempotency_key is distinct from old.idempotency_key or new.created_at is distinct from old.created_at
    or new.expires_at is distinct from old.expires_at
    or (old.dispatch_started_at is not null and new.dispatch_started_at is distinct from old.dispatch_started_at)
    or (old.provider_invoice_id is not null and new.provider_invoice_id is distinct from old.provider_invoice_id)
    or (old.finalised_at is not null and new.finalised_at is distinct from old.finalised_at) then
    raise exception 'XERO_REQUEST_IMMUTABLE';
  end if;
  return new;
end;
$$;
revoke all on function private.xero_invoice_request_immutable() from public, anon, authenticated, service_role;
create trigger xero_invoice_request_immutable before update or delete on private.xero_invoice_requests
for each row execute function private.xero_invoice_request_immutable();

create function private.xero_invoice_request_result(p_transfer_id uuid)
returns jsonb language sql stable security definer set search_path=pg_catalog,pg_temp as $$
  select jsonb_build_object('tenantId',t.tenant_id,'body',r.body,'bodyHash',r.body_hash,
    'idempotencyKey',r.idempotency_key,'expiresAt',(extract(epoch from r.expires_at)*1000)::bigint,
    'dispatchStarted',r.dispatch_started_at is not null,'providerInvoiceId',r.provider_invoice_id,
    'finalised',r.finalised_at is not null)
  from private.xero_invoice_requests r join private.xero_invoice_transfers t on t.id=r.transfer_id
  where r.transfer_id=p_transfer_id;
$$;
revoke all on function private.xero_invoice_request_result(uuid) from public, anon, authenticated, service_role;

create function public.xero_invoice_prepare_request(p_job_id uuid,p_lease_token uuid,p_tenant_id uuid,p_body text)
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
    or v_invoice->>'Status' is distinct from 'DRAFT' or v_invoice->>'Type' is distinct from 'ACCREC'
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
