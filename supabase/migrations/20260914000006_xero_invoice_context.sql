-- Finance mappings and lease-scoped invoice reads. No finance grants or provider
-- writes are activated by this migration.
alter table private.xero_invoice_transfer_control
  add column account_code text,
  add column tax_type text,
  add column mapping_verified_at timestamptz,
  add constraint xero_account_mapping_shape check (
    (account_code is null and tax_type is null and mapping_verified_at is null)
    or (account_code is not null and tax_type is not null and length(account_code) between 1 and 10
      and length(tax_type) between 1 and 50 and mapping_verified_at is not null)
  );

create table private.xero_customer_mappings (
  tenant_id uuid not null,
  portal_contact_id uuid not null references public.contacts(id) on delete restrict,
  xero_contact_id uuid not null,
  verified_at timestamptz not null,
  verified_by uuid not null references auth.users(id) on delete restrict,
  revoked_at timestamptz,
  primary key (tenant_id,portal_contact_id)
);
alter table private.xero_customer_mappings enable row level security;
revoke all on private.xero_customer_mappings from public, anon, authenticated, service_role;

alter table private.xero_invoice_transfers
  add column source_contact_id uuid references public.contacts(id) on delete restrict;

-- Freeze the project contact in the same issuance transaction. Later project
-- contact edits must never silently redirect an already-issued invoice.
create function private.xero_transfer_capture_contact()
returns trigger language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
begin
  select contact_id into new.source_contact_id from public.projects where id=new.project_id;
  return new;
end;
$$;
revoke all on function private.xero_transfer_capture_contact() from public, anon, authenticated, service_role;
create trigger xero_transfer_capture_contact before insert on private.xero_invoice_transfers
for each row execute function private.xero_transfer_capture_contact();

create function private.xero_invoice_lock_context(p_job_id uuid,p_lease_token uuid)
returns public.deposit_invoices language plpgsql security definer
set search_path = pg_catalog, pg_temp as $$
declare
  v_owner text;
  v_job public.background_jobs%rowtype;
  v_transfer private.xero_invoice_transfers%rowtype;
  v_control private.xero_invoice_transfer_control%rowtype;
  v_invoice public.deposit_invoices%rowtype;
begin
  select lease_owner into v_owner from public.background_jobs where id=p_job_id;
  v_job := private.background_job_lock_owned(p_job_id,v_owner,p_lease_token);
  if v_job.kind is distinct from 'xero_invoice_draft_v1' or v_job.contract_version is distinct from 1
    or v_job.execution_owner is distinct from 'worker' or v_job.cancellation_requested_at is not null then
    raise exception 'XERO_JOB_NOT_AUTHORISED' using errcode='42501';
  end if;
  select * into v_transfer from private.xero_invoice_transfers where job_id=p_job_id for update;
  if not found or v_job.subject_id is distinct from v_transfer.invoice_id::text
    or v_job.subject_type is distinct from 'invoice' or v_job.project_id is distinct from v_transfer.project_id then
    raise exception 'XERO_JOB_NOT_AUTHORISED' using errcode='42501';
  end if;
  select * into v_control from private.xero_invoice_transfer_control where singleton for share;
  if not found or not v_control.enabled or v_control.tenant_id is distinct from v_transfer.tenant_id then
    raise exception 'XERO_TRANSFER_DISABLED' using errcode='55000';
  end if;
  select * into v_invoice from public.deposit_invoices where id=v_transfer.invoice_id for share;
  if not found or v_invoice.project_id is distinct from v_transfer.project_id
    or v_invoice.status is null or v_invoice.status not in ('OPEN','PAID') or v_invoice.currency is distinct from 'NZD' then
    raise exception 'XERO_INVOICE_CHANGED' using errcode='55000';
  end if;
  return v_invoice;
end;
$$;
revoke all on function private.xero_invoice_lock_context(uuid,uuid) from public, anon, authenticated, service_role;

create function public.xero_invoice_transfer_context(p_job_id uuid,p_lease_token uuid)
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
