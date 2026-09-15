begin;
create function public.xero_invoice_payment_review_context(p_actor uuid,p_invoice_id uuid,p_tenant_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare v_context jsonb; v_transfer private.xero_invoice_transfers%rowtype; v_body text;
begin
  perform public.xero_require_payment_approver(p_actor);
  v_context:=public.xero_deposit_review_context(p_invoice_id);
  select * into v_transfer from private.xero_invoice_transfers where invoice_id=p_invoice_id;
  if not found or v_transfer.provider_invoice_id is null or v_transfer.tenant_id is distinct from p_tenant_id
    or not exists(select 1 from private.xero_invoice_transfer_control where singleton and tenant_id=p_tenant_id) then
    raise exception 'XERO_PAYMENT_REVIEW_UNAVAILABLE';
  end if;
  select body into strict v_body from private.xero_invoice_requests where transfer_id=v_transfer.id;
  return v_context || jsonb_build_object('providerInvoiceId',v_transfer.provider_invoice_id,'expectedBody',v_body,
    'hasOtherSourceHistory',exists(select 1 from public.xero_deposit_matches m where m.project_id=v_transfer.project_id
      and m.reversed_at is null and m.source_kind<>'INVOICE_PAYMENT'));
end; $$;
revoke all on function public.xero_invoice_payment_review_context(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.xero_invoice_payment_review_context(uuid,uuid,uuid) to service_role;
notify pgrst,'reload schema';
commit;
