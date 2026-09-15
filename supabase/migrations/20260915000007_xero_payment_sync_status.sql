begin;
create table private.xero_payment_sync_status (
  invoice_id uuid primary key references public.deposit_invoices(id),
  tenant_id uuid not null,
  state text not null check (state in ('current','recorded','review','unavailable')),
  reason text not null check (length(reason) between 1 and 100),
  checked_at timestamptz not null default clock_timestamp()
);
revoke all on private.xero_payment_sync_status from public,anon,authenticated,service_role;

create function public.xero_record_payment_sync_status(p_invoice_id uuid,p_tenant_id uuid,p_state text,p_reason text)
returns void language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
begin
  if not exists(select 1 from private.xero_invoice_transfers t
    join private.xero_invoice_transfer_control c on c.singleton and c.tenant_id=t.tenant_id
    where t.invoice_id=p_invoice_id and t.tenant_id=p_tenant_id and t.provider_invoice_id is not null) then
    raise exception 'Payment status invoice binding unavailable';
  end if;
  insert into private.xero_payment_sync_status(invoice_id,tenant_id,state,reason)
    values(p_invoice_id,p_tenant_id,p_state,p_reason)
  on conflict(invoice_id) do update set tenant_id=excluded.tenant_id,state=excluded.state,
    reason=excluded.reason,checked_at=clock_timestamp();
end; $$;
revoke all on function public.xero_record_payment_sync_status(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.xero_record_payment_sync_status(uuid,uuid,text,text) to service_role;
notify pgrst,'reload schema';
commit;
