-- Separate customer-link and company-default commands; preserve the legacy command for older clients.
create function public.xero_finance_save_setup(p_command_id uuid,p_actor uuid,p_invoice_id uuid,p_tenant_id uuid,p_source_contact_id uuid,p_kind text,p_proof jsonb)
returns void language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare v_context jsonb; v_control private.xero_invoice_transfer_control%rowtype; v_previous private.xero_finance_mapping_events%rowtype; v_evidence jsonb;
begin
 if p_kind is null or p_kind not in ('customer','defaults') then raise exception 'INVALID_SETUP_KIND'; end if;
 v_context:=public.xero_finance_mapping_context(p_actor,p_invoice_id);
 select * into strict v_control from private.xero_invoice_transfer_control where singleton for update;
 if p_tenant_id is null or v_control.tenant_id is distinct from p_tenant_id then raise exception 'XERO_TENANT_MISMATCH'; end if;
 if p_source_contact_id is distinct from (v_context->>'sourceContactId')::uuid then raise exception 'XERO_MAPPING_CHANGED'; end if;
 v_evidence:=jsonb_build_object('operation',p_kind,'proof',p_proof);
 select * into v_previous from private.xero_finance_mapping_events where id=p_command_id;
 if found then
  if v_previous.actor=p_actor and v_previous.invoice_id=p_invoice_id and v_previous.tenant_id=p_tenant_id
   and v_previous.portal_contact_id=p_source_contact_id and v_previous.proof=v_evidence then return; end if;
  raise exception 'XERO_MAPPING_COMMAND_CONFLICT';
 end if;
 if jsonb_typeof(p_proof) is distinct from 'object' then raise exception 'INVALID_SETUP_PROOF'; end if;
 if p_kind='customer' then
  if p_proof->>'id' is null or coalesce(p_proof->>'name','')='' then raise exception 'INVALID_CUSTOMER_PROOF'; end if;
  insert into private.xero_customer_mappings(tenant_id,portal_contact_id,xero_contact_id,verified_at,verified_by)
   values(p_tenant_id,p_source_contact_id,(p_proof->>'id')::uuid,clock_timestamp(),p_actor)
   on conflict(tenant_id,portal_contact_id) do update set xero_contact_id=excluded.xero_contact_id,verified_at=excluded.verified_at,verified_by=excluded.verified_by,revoked_at=null;
 else
  if coalesce(p_proof->'account'->>'code','')='' or coalesce(p_proof->'tax'->>'type','')=''
   or jsonb_typeof(p_proof->'tax'->'effectiveRate') is distinct from 'number'
   or (p_proof->'tax'->>'effectiveRate')::numeric not between 0 and 100
   or abs(round((v_context->>'subtotalCents')::numeric*(p_proof->'tax'->>'effectiveRate')::numeric/100)-(v_context->>'taxCents')::numeric)>1 then raise exception 'XERO_TAX_MAPPING_REVIEW_REQUIRED'; end if;
  update private.xero_invoice_transfer_control set account_code=p_proof->'account'->>'code',tax_type=p_proof->'tax'->>'type',
   effective_tax_rate=(p_proof->'tax'->>'effectiveRate')::numeric,mapping_verified_at=clock_timestamp() where singleton;
 end if;
 insert into private.xero_finance_mapping_events(id,actor,invoice_id,tenant_id,portal_contact_id,proof)
  values(p_command_id,p_actor,p_invoice_id,p_tenant_id,p_source_contact_id,v_evidence);
end; $$;
revoke all on function public.xero_finance_save_setup(uuid,uuid,uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.xero_finance_save_setup(uuid,uuid,uuid,uuid,uuid,text,jsonb) to service_role;

create or replace function public.xero_finance_mapping_status(p_actor uuid,p_invoice_id uuid,p_tenant_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare v_context jsonb; v_control private.xero_invoice_transfer_control%rowtype; v_link jsonb;
begin
 v_context:=public.xero_finance_mapping_context(p_actor,p_invoice_id);
 select * into strict v_control from private.xero_invoice_transfer_control where singleton;
 if p_tenant_id is null or v_control.tenant_id is distinct from p_tenant_id then raise exception 'XERO_TENANT_MISMATCH'; end if;
 select jsonb_build_object('contactId',xero_contact_id,'verifiedAt',verified_at) into v_link from private.xero_customer_mappings
  where tenant_id=p_tenant_id and portal_contact_id=(v_context->>'sourceContactId')::uuid and revoked_at is null;
 return jsonb_build_object('sourceContactId',v_context->>'sourceContactId','link',v_link,
  'defaults',case when v_control.mapping_verified_at is not null then jsonb_build_object('accountCode',v_control.account_code,'taxType',v_control.tax_type,'effectiveRate',v_control.effective_tax_rate) else null end);
end; $$;
notify pgrst, 'reload schema';
