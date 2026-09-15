-- A single immutable creation request per portal customer and Xero organisation.
-- No provider call, capability grant or transfer activation occurs in this migration.
create table private.xero_customer_creation_intents (
  tenant_id uuid not null, source_contact_id uuid not null references public.contacts(id),
  invoice_id uuid not null references public.deposit_invoices(id),
  prepared_by uuid not null references auth.users(id), request jsonb not null,
  dispatch_started boolean not null default false, provider_contact_id uuid,
  finalised_at timestamptz, primary key(tenant_id,source_contact_id)
);
create table private.xero_customer_creation_events (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, source_contact_id uuid not null,
  actor uuid not null references auth.users(id), event text not null check(event in ('prepared','dispatch_started','verified')),
  provider_contact_id uuid, recorded_at timestamptz not null default clock_timestamp(),
  foreign key(tenant_id,source_contact_id) references private.xero_customer_creation_intents(tenant_id,source_contact_id)
);
alter table private.xero_customer_creation_intents enable row level security;
alter table private.xero_customer_creation_events enable row level security;
revoke all on private.xero_customer_creation_intents,private.xero_customer_creation_events from public,anon,authenticated,service_role;
create function private.xero_customer_intent_immutable() returns trigger language plpgsql as $$
begin
  if tg_op='DELETE' then raise exception 'Customer creation requests cannot be deleted'; end if;
  if new.tenant_id<>old.tenant_id or new.source_contact_id<>old.source_contact_id
    or new.invoice_id<>old.invoice_id or new.prepared_by<>old.prepared_by or new.request<>old.request
    or (old.dispatch_started and not new.dispatch_started)
    or (old.provider_contact_id is not null and new.provider_contact_id is distinct from old.provider_contact_id)
    or (old.finalised_at is not null and new.finalised_at is distinct from old.finalised_at) then
    raise exception 'Customer creation requests are immutable'; end if;
  return new;
end; $$;
revoke all on function private.xero_customer_intent_immutable() from public,anon,authenticated,service_role;
create trigger xero_customer_intent_immutable before update or delete on private.xero_customer_creation_intents
for each row execute function private.xero_customer_intent_immutable();
create trigger xero_customer_creation_event_immutable before update or delete on private.xero_customer_creation_events
for each row execute function private.xero_mapping_event_immutable();

create function public.xero_customer_creation_command(p_actor uuid,p_invoice_id uuid,p_tenant_id uuid,p_source_contact_id uuid,
  p_action text,p_body text,p_provider_contact_id uuid default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare v_context jsonb; v_tenant uuid; v_intent private.xero_customer_creation_intents%rowtype;
  v_customer jsonb; v_name text; v_now bigint; v_request jsonb; v_mapping uuid;
begin
  v_context := public.xero_finance_mapping_context(p_actor,p_invoice_id);
  select tenant_id into v_tenant from private.xero_invoice_transfer_control where singleton for share;
  if p_tenant_id is null or v_tenant is distinct from p_tenant_id then raise exception 'XERO_TENANT_MISMATCH'; end if;
  if p_source_contact_id is distinct from (v_context->>'sourceContactId')::uuid then raise exception 'XERO_MAPPING_CHANGED'; end if;
  if p_action is null or p_action not in ('prepare','dispatch','finalise') then raise exception 'INVALID_CUSTOMER_COMMAND'; end if;
  if p_body is null or octet_length(p_body)>2048 then raise exception 'INVALID_FROZEN_CUSTOMER_REQUEST'; end if;
  v_customer := p_body::jsonb->'Contacts'->0;
  v_name := v_customer->>'Name';
  if jsonb_typeof(v_customer->'Name') is distinct from 'string' or char_length(v_name) not between 1 and 255
    or v_name<>btrim(v_name) or v_name ~ '[<>[:cntrl:]]' or v_name ~ '  '
    or v_customer is distinct from jsonb_build_object('Name',v_name,'ContactNumber','SP-'||p_source_contact_id::text)
    or p_body::jsonb is distinct from jsonb_build_object('Contacts',jsonb_build_array(v_customer))
    then raise exception 'INVALID_FROZEN_CUSTOMER_REQUEST'; end if;
  v_now := floor(extract(epoch from clock_timestamp())*1000)::bigint;
  if p_action='prepare' then
    if p_provider_contact_id is not null then raise exception 'INVALID_CUSTOMER_COMMAND'; end if;
    v_request := jsonb_build_object('tenantId',p_tenant_id,'sourceContactId',p_source_contact_id,'customer',v_customer,
      'body',p_body,'bodyHash',encode(sha256(convert_to(p_body,'UTF8')),'hex'),
      'idempotencyKey','sp-customer-'||gen_random_uuid()::text,'preparedAt',v_now,'expiresAt',v_now+300000);
    insert into private.xero_customer_creation_intents(tenant_id,source_contact_id,invoice_id,prepared_by,request)
      values(p_tenant_id,p_source_contact_id,p_invoice_id,p_actor,v_request) on conflict do nothing;
    if found then
      insert into private.xero_customer_creation_events(tenant_id,source_contact_id,actor,event)
        values(p_tenant_id,p_source_contact_id,p_actor,'prepared');
    end if;
  end if;
  select * into v_intent from private.xero_customer_creation_intents
    where tenant_id=p_tenant_id and source_contact_id=p_source_contact_id for update;
  if not found then raise exception 'XERO_CUSTOMER_INTENT_NOT_FOUND'; end if;
  if v_intent.invoice_id<>p_invoice_id or v_intent.request->>'body' is distinct from p_body then
    raise exception 'XERO_CUSTOMER_INTENT_CONFLICT'; end if;
  select xero_contact_id into v_mapping from private.xero_customer_mappings
    where tenant_id=p_tenant_id and portal_contact_id=p_source_contact_id and revoked_at is null;
  if v_mapping is not null and (v_intent.provider_contact_id is null or v_mapping<>v_intent.provider_contact_id) then
    raise exception 'XERO_EXISTING_CUSTOMER_REVIEW'; end if;
  if p_action='dispatch' then
    if p_provider_contact_id is not null or v_intent.provider_contact_id is not null then raise exception 'INVALID_CUSTOMER_COMMAND'; end if;
    if v_now+15000 >= (v_intent.request->>'expiresAt')::bigint then raise exception 'CUSTOMER_IDEMPOTENCY_WINDOW_EXPIRED'; end if;
    if not v_intent.dispatch_started then
      update private.xero_customer_creation_intents set dispatch_started=true where tenant_id=p_tenant_id and source_contact_id=p_source_contact_id;
      v_intent.dispatch_started := true;
      insert into private.xero_customer_creation_events(tenant_id,source_contact_id,actor,event)
        values(p_tenant_id,p_source_contact_id,p_actor,'dispatch_started');
    end if;
  elsif p_action='finalise' then
    if not v_intent.dispatch_started or p_provider_contact_id is null then raise exception 'INVALID_CUSTOMER_COMMAND'; end if;
    if v_intent.provider_contact_id is not null and v_intent.provider_contact_id<>p_provider_contact_id then
      raise exception 'XERO_CUSTOMER_INTENT_CONFLICT'; end if;
    if v_intent.provider_contact_id is null then
      -- Keep a concurrent explicit mapping; never silently replace it with a creation result.
      insert into private.xero_customer_mappings(tenant_id,portal_contact_id,xero_contact_id,verified_at,verified_by)
        values(p_tenant_id,p_source_contact_id,p_provider_contact_id,clock_timestamp(),p_actor) on conflict do nothing;
      select xero_contact_id into v_mapping from private.xero_customer_mappings
        where tenant_id=p_tenant_id and portal_contact_id=p_source_contact_id and revoked_at is null for update;
      if v_mapping is distinct from p_provider_contact_id then raise exception 'XERO_EXISTING_CUSTOMER_REVIEW'; end if;
      update private.xero_customer_creation_intents set provider_contact_id=p_provider_contact_id,finalised_at=clock_timestamp()
        where tenant_id=p_tenant_id and source_contact_id=p_source_contact_id;
      v_intent.provider_contact_id := p_provider_contact_id;
      insert into private.xero_customer_creation_events(tenant_id,source_contact_id,actor,event,provider_contact_id)
        values(p_tenant_id,p_source_contact_id,p_actor,'verified',p_provider_contact_id);
    end if;
  end if;
  return v_intent.request||jsonb_build_object('dispatchStarted',v_intent.dispatch_started,'providerContactId',v_intent.provider_contact_id);
end; $$;
revoke all on function public.xero_customer_creation_command(uuid,uuid,uuid,uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.xero_customer_creation_command(uuid,uuid,uuid,uuid,text,text,uuid) to service_role;
