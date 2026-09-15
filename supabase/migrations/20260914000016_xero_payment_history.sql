begin;
create function public.xero_invoice_payment_history(p_actor uuid,p_invoice_id uuid,p_tenant_id uuid,p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare v_context jsonb; v_rows jsonb;
begin
  perform public.xero_require_payment_approver(p_actor);
  if p_offset is null or p_offset<0 or p_offset>10000 then raise exception 'Invalid history page'; end if;
  if not exists(select 1 from private.xero_invoice_transfer_control where singleton and tenant_id=p_tenant_id) then
    raise exception 'XERO_PAYMENT_HISTORY_UNAVAILABLE';
  end if;
  v_context:=public.xero_deposit_review_context(p_invoice_id);
  select coalesce(jsonb_agg(row.value order by row.approved_at desc,row.id desc),'[]'::jsonb) into v_rows
  from (select m.id,m.approved_at,jsonb_build_object('id',m.id,'sourceKind',m.source_kind,
      'amountCents',m.amount_inc_gst_cents,'receiptDate',m.receipt_date,'approvedAt',m.approved_at,
      'approvedBy',coalesce(u.email,'Former staff member'),'reversedAt',m.reversed_at,
      'reversalReason',r.reason,'reversedBy',coalesce(ru.email,r.created_by),
      'reference',e.reference) value
    from public.xero_deposit_matches m
    join public.project_payment_entries e on e.id=m.payment_entry_id
    left join auth.users u on u.id=m.approved_by
    left join public.project_payment_entries r on r.id=m.reversal_entry_id
    left join auth.users ru on ru.id::text=r.created_by
    where m.invoice_id=p_invoice_id and m.tenant_id=p_tenant_id
    order by m.approved_at desc,m.id desc limit 51 offset p_offset) row;
  return jsonb_build_object('invoice',v_context->'invoice','recordedCents',v_context->'matchedCents',
    'customerWon',v_context->'customerWon','hasUnmatchedPaymentHistory',v_context->'hasUnmatchedPaymentHistory',
    'matches',v_rows,'checkedAt',clock_timestamp());
end; $$;
revoke all on function public.xero_invoice_payment_history(uuid,uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.xero_invoice_payment_history(uuid,uuid,uuid,integer) to service_role;
notify pgrst,'reload schema';
commit;
