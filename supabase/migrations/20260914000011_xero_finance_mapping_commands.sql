alter table private.xero_invoice_transfer_control add column effective_tax_rate numeric;
create table private.xero_finance_mapping_events (
  id uuid primary key, actor uuid not null references auth.users(id),
  invoice_id uuid not null references public.deposit_invoices(id), tenant_id uuid not null,
  portal_contact_id uuid not null references public.contacts(id), proof jsonb not null,
  recorded_at timestamptz not null default clock_timestamp()
);
alter table private.xero_finance_mapping_events enable row level security;
revoke all on private.xero_finance_mapping_events from public,anon,authenticated,service_role;
create function private.xero_mapping_event_immutable() returns trigger language plpgsql as $$
begin raise exception 'Finance mapping history is append-only'; end; $$;
revoke all on function private.xero_mapping_event_immutable() from public,anon,authenticated,service_role;
create trigger xero_mapping_event_immutable before update or delete on private.xero_finance_mapping_events
for each row execute function private.xero_mapping_event_immutable();

create function public.xero_finance_mapping_context(p_actor uuid,p_invoice_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare v_result jsonb;
begin
  perform public.xero_require_payment_approver(p_actor);
  perform 1 from public.deposit_invoices i join public.projects p on p.id=i.project_id where i.id=p_invoice_id for share of i,p;
  select jsonb_build_object('invoiceId',i.id,'invoiceRef',i.invoice_ref,'customerName',coalesce(i.customer_name,''),
    'sourceContactId',case when t.id is null then p.contact_id else t.source_contact_id end,'subtotalCents',i.total_ex_gst_cents,'taxCents',i.gst_cents)
    into v_result from public.deposit_invoices i join public.projects p on p.id=i.project_id
    left join private.xero_invoice_transfers t on t.invoice_id=i.id
    where i.id=p_invoice_id and i.status in ('OPEN','PAID') and i.currency='NZD';
  if v_result is null or v_result->>'sourceContactId' is null then raise exception 'XERO_MAPPING_CONTEXT_UNAVAILABLE'; end if;
  return v_result;
end; $$;
revoke all on function public.xero_finance_mapping_context(uuid,uuid) from public,anon,authenticated;
grant execute on function public.xero_finance_mapping_context(uuid,uuid) to service_role;

-- Called only after fresh provider verification. No Xero writes or job dispatch.
create function public.xero_finance_save_mapping(p_command_id uuid,p_actor uuid,p_invoice_id uuid,p_tenant_id uuid,p_source_contact_id uuid,p_proof jsonb)
returns void language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare v_context jsonb; v_control private.xero_invoice_transfer_control%rowtype; v_previous private.xero_finance_mapping_events%rowtype;
begin
  v_context := public.xero_finance_mapping_context(p_actor,p_invoice_id);
  select * into strict v_control from private.xero_invoice_transfer_control where singleton for update;
  if v_control.tenant_id is not null and v_control.tenant_id<>p_tenant_id then raise exception 'XERO_TENANT_MISMATCH'; end if;
  if p_tenant_id is null or p_source_contact_id is distinct from (v_context->>'sourceContactId')::uuid then raise exception 'XERO_MAPPING_CHANGED'; end if;
  select * into v_previous from private.xero_finance_mapping_events where id=p_command_id;
  if found then
    if v_previous.actor=p_actor and v_previous.invoice_id=p_invoice_id and v_previous.tenant_id=p_tenant_id
      and v_previous.portal_contact_id=p_source_contact_id and v_previous.proof=p_proof then return; end if;
    raise exception 'XERO_MAPPING_COMMAND_CONFLICT';
  end if;
  if jsonb_typeof(p_proof) is distinct from 'object'
    or p_proof->'contact'->>'id' is null or p_proof->'account'->>'code' is null or p_proof->'tax'->>'type' is null
    or jsonb_typeof(p_proof->'tax'->'effectiveRate') is distinct from 'number'
    or (p_proof->'tax'->>'effectiveRate')::numeric not between 0 and 100
    or abs(round((v_context->>'subtotalCents')::numeric*(p_proof->'tax'->>'effectiveRate')::numeric/100)-(v_context->>'taxCents')::numeric)>1
    then raise exception 'XERO_TAX_MAPPING_REVIEW_REQUIRED'; end if;
  insert into private.xero_customer_mappings(tenant_id,portal_contact_id,xero_contact_id,verified_at,verified_by)
    values(p_tenant_id,p_source_contact_id,(p_proof->'contact'->>'id')::uuid,clock_timestamp(),p_actor)
    on conflict(tenant_id,portal_contact_id) do update set xero_contact_id=excluded.xero_contact_id,verified_at=excluded.verified_at,verified_by=excluded.verified_by,revoked_at=null;
  update private.xero_invoice_transfer_control set tenant_id=p_tenant_id,account_code=p_proof->'account'->>'code',
    tax_type=p_proof->'tax'->>'type',effective_tax_rate=(p_proof->'tax'->>'effectiveRate')::numeric,mapping_verified_at=clock_timestamp() where singleton;
  insert into private.xero_finance_mapping_events(id,actor,invoice_id,tenant_id,portal_contact_id,proof)
    values(p_command_id,p_actor,p_invoice_id,p_tenant_id,p_source_contact_id,p_proof);
end; $$;
revoke all on function public.xero_finance_save_mapping(uuid,uuid,uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.xero_finance_save_mapping(uuid,uuid,uuid,uuid,uuid,jsonb) to service_role;

-- The selected default must fit each future invoice, not just the setup example.
create function private.xero_invoice_tax_mapping_guard() returns trigger language plpgsql
set search_path=pg_catalog,pg_temp as $$
declare v_rate numeric; v_invoice public.deposit_invoices%rowtype;
begin
  select effective_tax_rate into v_rate from private.xero_invoice_transfer_control where singleton for share;
  select i.* into strict v_invoice from public.deposit_invoices i join private.xero_invoice_transfers t on t.invoice_id=i.id where t.id=new.transfer_id;
  if v_rate is null or abs(round(v_invoice.total_ex_gst_cents::numeric*v_rate/100)-v_invoice.gst_cents)>1 then
    raise exception 'XERO_TAX_MAPPING_REVIEW_REQUIRED';
  end if;
  return new;
end; $$;
revoke all on function private.xero_invoice_tax_mapping_guard() from public,anon,authenticated,service_role;
create trigger xero_invoice_tax_mapping_guard before insert on private.xero_invoice_requests
for each row execute function private.xero_invoice_tax_mapping_guard();
