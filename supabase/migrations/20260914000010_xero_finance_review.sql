-- Bounded finance read model. This does not approve payments or export history.
create function public.xero_finance_review(p_actor uuid,p_search text default '',p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare v_rows jsonb;
begin
  perform public.xero_require_payment_approver(p_actor);
  if p_search is null or length(p_search)>120 or p_offset is null or p_offset<0 or p_offset>10000 then
    raise exception 'Invalid finance search' using errcode='22023';
  end if;
  select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into v_rows from (
    select i.id as "invoiceId",i.invoice_ref as "invoiceRef",i.project_id as "projectId",
      coalesce(i.customer_name,'') as "customerName",coalesce(i.project_name,'') as "projectName",
      i.status,i.currency,i.due_date::text as "dueDate",i.total_inc_gst_cents as "totalCents",
      coalesce(paid.amount,0) as "recordedCents",t.provider_invoice_id as "xeroInvoiceId",
      t.last_verified_at as "lastVerifiedAt",j.status as "transferStatus",j.error_code as "transferError",
      t.id is not null as "captured",i.status='VOID' and t.id is not null as "correctionRequired",
      exists(select 1 from public.project_payment_entries e where e.project_id=i.project_id and e.amount_inc_gst_cents>0
        and e.entry_type in ('PAYMENT','ADJUSTMENT')
        and not exists(select 1 from public.project_payment_entries reversal where reversal.reverses_entry_id=e.id)
        and e.amount_inc_gst_cents > coalesce((select sum(a.amount_inc_gst_cents) from public.project_payment_allocations a
          where a.payment_entry_id=e.id and a.reversed_at is null),0)
          +coalesce((select sum(m.amount_inc_gst_cents) from public.xero_deposit_matches m where m.payment_entry_id=e.id and m.reversed_at is null
            and not exists(select 1 from public.project_payment_allocations a where a.payment_entry_id=e.id and a.reversed_at is null)),0)) as "unassignedReceipts"
    from public.deposit_invoices i
    left join private.xero_invoice_transfers t on t.invoice_id=i.id
    left join public.background_jobs j on j.id=t.job_id
    left join lateral (
      -- Settled pilot entries also have allocations: count those entries once.
      select sum(x.amount) amount from (
        select a.payment_entry_id,sum(a.amount_inc_gst_cents) amount
        from public.project_payment_allocations a
        where a.project_id=i.project_id and a.reversed_at is null and
          (a.standalone_invoice_id=i.id or (a.quote_version_id=i.quote_version_id and a.payment_term_id=i.payment_term_id))
        group by a.payment_entry_id
        union all
        select m.payment_entry_id,m.amount_inc_gst_cents from public.xero_deposit_matches m
        where m.invoice_id=i.id and m.reversed_at is null and not exists(
          select 1 from public.project_payment_allocations a where a.payment_entry_id=m.payment_entry_id and a.reversed_at is null
            and (a.standalone_invoice_id=i.id or (a.quote_version_id=i.quote_version_id and a.payment_term_id=i.payment_term_id)))
      ) x
    ) paid on true
    where i.status in ('OPEN','PAID','VOID') and
      (p_search='' or strpos(lower(coalesce(i.invoice_ref,'')||' '||coalesce(i.customer_name,'')||' '||coalesce(i.project_name,'')),lower(p_search))>0)
    order by case when i.status='VOID' and t.id is not null then 0 when j.status in ('needs_attention','permanent_failed') then 1
      when i.status='OPEN' then 2 else 3 end,i.due_date nulls last,i.id
    limit 51 offset p_offset
  ) r;
  return jsonb_build_object('rows',v_rows,'checkedAt',clock_timestamp());
end;
$$;
revoke all on function public.xero_finance_review(uuid,text,integer) from public,anon,authenticated;
grant execute on function public.xero_finance_review(uuid,text,integer) to service_role;
