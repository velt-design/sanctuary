-- Resume the existing pre-dispatch intent only. Uncertain provider work needs
-- reconciliation; this command never resets a request or creates a new job.
create function public.xero_finance_resume(p_actor uuid,p_invoice_id uuid,p_tenant_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare v_transfer private.xero_invoice_transfers%rowtype; v_job public.background_jobs%rowtype;
  v_control private.xero_invoice_transfer_control%rowtype;
begin
  perform public.xero_require_payment_approver(p_actor);
  select * into v_transfer from private.xero_invoice_transfers where invoice_id=p_invoice_id;
  if not found or v_transfer.tenant_id is distinct from p_tenant_id then raise exception 'XERO_TRANSFER_NOT_FOUND'; end if;
  select * into strict v_job from public.background_jobs where id=v_transfer.job_id for update;
  select * into strict v_control from private.xero_invoice_transfer_control where singleton for share;
  if not v_control.enabled or v_control.tenant_id is distinct from p_tenant_id then raise exception 'XERO_TRANSFER_DISABLED'; end if;
  if v_job.kind<>'xero_invoice_draft_v1' or v_job.execution_owner<>'worker'
    or v_job.subject_id is distinct from p_invoice_id::text
    or not exists(select 1 from public.deposit_invoices where id=p_invoice_id and status in ('OPEN','PAID')) then raise exception 'XERO_INVOICE_CHANGED'; end if;
  if v_transfer.provider_invoice_id is not null or exists(select 1 from private.xero_invoice_requests where transfer_id=v_transfer.id)
    or exists(select 1 from public.background_job_effects where job_id=v_job.id) then raise exception 'XERO_RECONCILIATION_REQUIRED'; end if;
  if v_control.mapping_verified_at is null or v_control.effective_tax_rate is null
    or not exists(select 1 from private.xero_customer_mappings where tenant_id=p_tenant_id and portal_contact_id=v_transfer.source_contact_id and revoked_at is null) then
    raise exception 'XERO_MAPPING_REQUIRED'; end if;
  if v_job.status in ('queued','claimed','preparing','running','retrying') then return jsonb_build_object('state','already_running'); end if;
  if v_job.status not in ('needs_attention','permanent_failed') then raise exception 'XERO_RECONCILIATION_REQUIRED'; end if;
  perform public.background_job_manual_retry(v_job.id,p_actor);
  return jsonb_build_object('state','queued');
end; $$;
revoke all on function public.xero_finance_resume(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.xero_finance_resume(uuid,uuid,uuid) to service_role;
