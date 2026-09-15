alter table private.xero_invoice_transfers add column observation_generation bigint not null default 0;
create table private.xero_invoice_observations (
  transfer_id uuid not null references private.xero_invoice_transfers(id),generation bigint not null,
  portal_status text not null, result jsonb not null, checked_at timestamptz not null default clock_timestamp(),
  primary key(transfer_id,generation)
);
alter table private.xero_invoice_observations enable row level security;
revoke all on private.xero_invoice_observations from public,anon,authenticated,service_role;
create function private.xero_observation_immutable() returns trigger language plpgsql as $$
begin raise exception 'Xero observation history is append-only'; end; $$;
revoke all on function private.xero_observation_immutable() from public,anon,authenticated,service_role;
create trigger xero_observation_immutable before update or delete on private.xero_invoice_observations
for each row execute function private.xero_observation_immutable();

create function public.xero_invoice_observation_context(p_invoice_id uuid,p_tenant_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare v_transfer private.xero_invoice_transfers%rowtype; v_status text; v_body text;
begin
  select * into v_transfer from private.xero_invoice_transfers where invoice_id=p_invoice_id for update;
  if not found or v_transfer.tenant_id is distinct from p_tenant_id or v_transfer.provider_invoice_id is null
    or not exists(select 1 from private.xero_invoice_transfer_control where singleton and tenant_id=p_tenant_id) then raise exception 'XERO_OBSERVATION_UNAVAILABLE'; end if;
  select status into strict v_status from public.deposit_invoices where id=p_invoice_id for share;
  select body into strict v_body from private.xero_invoice_requests where transfer_id=v_transfer.id;
  update private.xero_invoice_transfers set observation_generation=observation_generation+1 where id=v_transfer.id returning * into v_transfer;
  return jsonb_build_object('invoiceId',p_invoice_id,'tenantId',p_tenant_id,'providerInvoiceId',v_transfer.provider_invoice_id,
    'generation',v_transfer.observation_generation,'portalStatus',v_status,'body',v_body);
end; $$;
revoke all on function public.xero_invoice_observation_context(uuid,uuid) from public,anon,authenticated;
grant execute on function public.xero_invoice_observation_context(uuid,uuid) to service_role;

create function public.xero_invoice_record_observation(p_invoice_id uuid,p_tenant_id uuid,p_generation bigint,p_portal_status text,p_result jsonb)
returns void language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare v_transfer private.xero_invoice_transfers%rowtype; v_status text; v_existing jsonb;
begin
  select * into v_transfer from private.xero_invoice_transfers where invoice_id=p_invoice_id for update;
  select status into strict v_status from public.deposit_invoices where id=p_invoice_id for share;
  if not found or v_transfer.provider_invoice_id is null or p_generation<1 or v_transfer.tenant_id is distinct from p_tenant_id or v_transfer.observation_generation is distinct from p_generation
    or v_status is distinct from p_portal_status then raise exception 'XERO_OBSERVATION_CHANGED'; end if;
  if jsonb_typeof(p_result) is distinct from 'object' or (select count(*) from jsonb_object_keys(p_result))<>3
    or p_result->>'state' is null or p_result->>'state' not in ('draft','awaiting_approval','posted','payment_recorded','conflict','correction_pending','correction_complete','unavailable')
    or coalesce(p_result->>'reason','') !~ '^[A-Z_]{1,80}$'
    or not (p_result ? 'amountPaidCents')
    or (p_result->'amountPaidCents'<>'null'::jsonb and (jsonb_typeof(p_result->'amountPaidCents')<>'number'
      or (p_result->>'amountPaidCents')::numeric not between 0 and 2147483647
      or trunc((p_result->>'amountPaidCents')::numeric)<>(p_result->>'amountPaidCents')::numeric)) then raise exception 'XERO_OBSERVATION_INVALID'; end if;
  select result into v_existing from private.xero_invoice_observations where transfer_id=v_transfer.id and generation=p_generation;
  if found then
    if v_existing is distinct from p_result then raise exception 'XERO_OBSERVATION_CHANGED'; end if;
    return;
  end if;
  insert into private.xero_invoice_observations(transfer_id,generation,portal_status,result)
    values(v_transfer.id,p_generation,p_portal_status,p_result) on conflict do nothing;
end; $$;
revoke all on function public.xero_invoice_record_observation(uuid,uuid,bigint,text,jsonb) from public,anon,authenticated;
grant execute on function public.xero_invoice_record_observation(uuid,uuid,bigint,text,jsonb) to service_role;

create function public.xero_finance_observations(p_actor uuid,p_invoice_ids uuid[])
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
begin
  perform public.xero_require_payment_approver(p_actor);
  if cardinality(p_invoice_ids)>50 then raise exception 'Invalid observation batch'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('invoiceId',t.invoice_id,'state',o.result->>'state',
    'reason',o.result->>'reason','amountPaidCents',o.result->'amountPaidCents','checkedAt',o.checked_at)),'[]'::jsonb)
    from private.xero_invoice_transfers t join public.deposit_invoices i on i.id=t.invoice_id
    join lateral(select * from private.xero_invoice_observations x where x.transfer_id=t.id and x.portal_status=i.status
      order by generation desc limit 1) o on true where t.invoice_id=any(p_invoice_ids));
end; $$;
revoke all on function public.xero_finance_observations(uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.xero_finance_observations(uuid,uuid[]) to service_role;

create function public.xero_invoice_observation_targets(p_tenant_id uuid)
returns jsonb language sql security definer set search_path=pg_catalog,pg_temp as $$
  select coalesce(jsonb_agg(invoice_id),'[]'::jsonb) from (
    select t.invoice_id from private.xero_invoice_transfers t join public.deposit_invoices i on i.id=t.invoice_id
    left join lateral(select checked_at from private.xero_invoice_observations o where o.transfer_id=t.id and o.portal_status=i.status
      order by generation desc limit 1) latest on true
    where t.tenant_id=p_tenant_id and t.provider_invoice_id is not null
      and exists(select 1 from private.xero_invoice_transfer_control where singleton and tenant_id=p_tenant_id)
      and (latest.checked_at is null or latest.checked_at<clock_timestamp()-interval '15 minutes')
    order by latest.checked_at nulls first,t.id limit 3
  ) candidates;
$$;
revoke all on function public.xero_invoice_observation_targets(uuid) from public,anon,authenticated;
grant execute on function public.xero_invoice_observation_targets(uuid) to service_role;
