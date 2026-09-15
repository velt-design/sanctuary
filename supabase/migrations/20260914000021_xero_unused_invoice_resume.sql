-- Renew only an UNUSED dispatch window; the exact body, key and original creation time remain immutable.
alter table private.xero_invoice_requests add column window_started_at timestamptz;
update private.xero_invoice_requests set window_started_at=created_at;
alter table private.xero_invoice_requests alter column window_started_at set not null;
alter table private.xero_invoice_requests alter column window_started_at set default now();
do $$
declare v_constraint text;
begin
  select conname into strict v_constraint from pg_constraint where conrelid='private.xero_invoice_requests'::regclass and contype='c'
    and pg_get_constraintdef(oid) like '%expires_at%' and pg_get_constraintdef(oid) like '%created_at%';
  execute format('alter table private.xero_invoice_requests drop constraint %I',v_constraint);
end; $$;
alter table private.xero_invoice_requests add constraint xero_unused_request_window_bounded
  check(window_started_at>=created_at and expires_at>window_started_at and expires_at<=window_started_at+interval '5 minutes');
create table private.xero_unused_window_renewals (
  id uuid primary key default gen_random_uuid(),transfer_id uuid not null references private.xero_invoice_transfers(id),
  actor uuid not null references auth.users(id),body_hash text not null,
  previous_started_at timestamptz not null,previous_expires_at timestamptz not null,
  renewed_at timestamptz not null,new_expires_at timestamptz not null,
  unique(transfer_id,renewed_at)
);
alter table private.xero_unused_window_renewals enable row level security;
revoke all on private.xero_unused_window_renewals from public,anon,authenticated,service_role;
create trigger xero_unused_window_renewal_immutable before update or delete on private.xero_unused_window_renewals
for each row execute function private.xero_mapping_event_immutable();

create or replace function private.xero_invoice_request_immutable()
returns trigger language plpgsql set search_path=pg_catalog,pg_temp as $$
begin
  if tg_op='DELETE' then raise exception 'XERO_REQUEST_IMMUTABLE'; end if;
  if new.transfer_id is distinct from old.transfer_id or new.body is distinct from old.body or new.body_hash is distinct from old.body_hash
    or new.idempotency_key is distinct from old.idempotency_key or new.created_at is distinct from old.created_at
    or (old.dispatch_started_at is not null and new.dispatch_started_at is distinct from old.dispatch_started_at)
    or (old.provider_invoice_id is not null and new.provider_invoice_id is distinct from old.provider_invoice_id)
    or (old.finalised_at is not null and new.finalised_at is distinct from old.finalised_at) then raise exception 'XERO_REQUEST_IMMUTABLE'; end if;
  if new.expires_at is distinct from old.expires_at or new.window_started_at is distinct from old.window_started_at then
    if old.dispatch_started_at is not null or new.dispatch_started_at is not null
      or old.provider_invoice_id is not null or new.provider_invoice_id is not null or old.finalised_at is not null or new.finalised_at is not null
      or not exists(select 1 from private.xero_invoice_transfers t join public.background_jobs j on j.id=t.job_id
        where t.id=old.transfer_id and j.status in ('needs_attention','permanent_failed') and j.lease_token is null
          and t.provider_invoice_id is null and not exists(select 1 from public.background_job_effects e where e.job_id=j.id))
      or not exists(select 1 from private.xero_unused_window_renewals r where r.transfer_id=old.transfer_id and r.body_hash=old.body_hash
        and r.previous_started_at=old.window_started_at and r.previous_expires_at=old.expires_at
        and r.renewed_at=new.window_started_at and r.new_expires_at=new.expires_at) then raise exception 'XERO_REQUEST_IMMUTABLE'; end if;
  end if;
  return new;
end; $$;

create or replace function public.xero_finance_resume(p_actor uuid,p_invoice_id uuid,p_tenant_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare v_transfer private.xero_invoice_transfers%rowtype; v_job public.background_jobs%rowtype;
  v_control private.xero_invoice_transfer_control%rowtype; v_request private.xero_invoice_requests%rowtype; v_now timestamptz;
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
  select * into v_request from private.xero_invoice_requests where transfer_id=v_transfer.id for update;
  if v_transfer.provider_invoice_id is not null or v_request.dispatch_started_at is not null
    or v_request.provider_invoice_id is not null or v_request.finalised_at is not null
    or exists(select 1 from public.background_job_effects where job_id=v_job.id) then raise exception 'XERO_RECONCILIATION_REQUIRED'; end if;
  if v_control.mapping_verified_at is null or v_control.effective_tax_rate is null
    or not exists(select 1 from private.xero_customer_mappings where tenant_id=p_tenant_id and portal_contact_id=v_transfer.source_contact_id and revoked_at is null) then
    raise exception 'XERO_MAPPING_REQUIRED'; end if;
  if v_job.status in ('queued','claimed','preparing','running','retrying') then return jsonb_build_object('state','already_running'); end if;
  if v_job.status not in ('needs_attention','permanent_failed') then raise exception 'XERO_RECONCILIATION_REQUIRED'; end if;
  if v_job.lease_token is not null or v_job.cancellation_requested_at is not null then raise exception 'XERO_RECONCILIATION_REQUIRED'; end if;
  if v_request.transfer_id is not null and v_request.expires_at<=clock_timestamp()+interval '15 seconds' then
    -- Match the canonical effect ledger's transaction timestamp; never extend past its bound.
    v_now:=now();
    insert into private.xero_unused_window_renewals(transfer_id,actor,body_hash,previous_started_at,previous_expires_at,renewed_at,new_expires_at)
      values(v_request.transfer_id,p_actor,v_request.body_hash,v_request.window_started_at,v_request.expires_at,v_now,v_now+interval '5 minutes');
    update private.xero_invoice_requests set window_started_at=v_now,expires_at=v_now+interval '5 minutes' where transfer_id=v_request.transfer_id;
  end if;
  perform public.background_job_manual_retry(v_job.id,p_actor);
  return jsonb_build_object('state','queued');
end; $$;
revoke all on function public.xero_finance_resume(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.xero_finance_resume(uuid,uuid,uuid) to service_role;
