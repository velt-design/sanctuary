-- Read-only saved customer-link context. No grants on private tables.
create function public.xero_finance_mapping_status(p_actor uuid,p_invoice_id uuid,p_tenant_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare v_context jsonb; v_tenant uuid; v_link jsonb;
begin
  v_context:=public.xero_finance_mapping_context(p_actor,p_invoice_id);
  select tenant_id into v_tenant from private.xero_invoice_transfer_control where singleton;
  if p_tenant_id is null or v_tenant is distinct from p_tenant_id then raise exception 'XERO_TENANT_MISMATCH'; end if;
  select jsonb_build_object('contactId',xero_contact_id,'verifiedAt',verified_at) into v_link
    from private.xero_customer_mappings where tenant_id=p_tenant_id
      and portal_contact_id=(v_context->>'sourceContactId')::uuid and revoked_at is null;
  return jsonb_build_object('sourceContactId',v_context->>'sourceContactId','link',v_link);
end; $$;
revoke all on function public.xero_finance_mapping_status(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.xero_finance_mapping_status(uuid,uuid,uuid) to service_role;
notify pgrst, 'reload schema';
