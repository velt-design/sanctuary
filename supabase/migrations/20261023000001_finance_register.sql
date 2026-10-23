-- Read-only cross-project register. Existing commercial commands and evidence
-- remain authoritative. No provider reads, lifecycle writes or new ledger.
begin;
create function public.finance_register_v1(p_actor uuid,p_tab text,p_view text,p_search text,p_sent text,p_offset integer)
-- VOLATILE matches the canonical Finance RPC: the permission check takes a
-- grant-row share lock. PostgREST must not put this RPC in a read-only transaction.
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog,pg_temp as $$
declare v_admin boolean; v_result jsonb;
begin
  perform public.xero_require_payment_approver(p_actor);
  select exists(select 1 from public.portal_users where user_id=p_actor and role='admin') into v_admin;
  if p_tab is null or p_tab not in ('invoices','quotes') or p_view is null
    or (p_tab='invoices' and p_view not in ('outstanding','overdue','drafts','paid','all'))
    or (p_tab='quotes' and p_view not in ('awaiting','accepted','drafts','declined','expired','history','all'))
    or p_search is null or length(p_search)>120 or p_sent is null or p_sent not in ('all','sent','needs','pending')
    or p_offset is null or p_offset<0 or p_offset>1000000 then
    raise exception 'Invalid finance register query' using errcode='22023';
  end if;
  if p_tab='invoices' then
    with eligible as materialized (
      select i.* from public.deposit_invoices i
      where (i.status<>'DRAFT' or v_admin)
        and (p_search='' or strpos(lower(coalesce(i.invoice_ref,'')||' '||coalesce(i.customer_name,'')||' '||coalesce(i.project_name,'')||' '||coalesce(i.payment_term_label,'')),lower(p_search))>0)
    ), active_entries as materialized (
      select e.* from public.project_payment_entries e
      where exists(select 1 from eligible i where i.project_id=e.project_id)
        and e.entry_type<>'REVERSAL'
        and not exists(select 1 from public.project_payment_entries r where r.reverses_entry_id=e.id)
    ), owned_evidence as (
      -- Whole-invoice receipts survive reassignment of their scope funding.
      select e.source_invoice_id invoice_id,e.id entry_id,e.amount_inc_gst_cents amount
        from active_entries e where e.source_invoice_id is not null and e.amount_inc_gst_cents>0
      union all
      select m.invoice_id,e.id,m.amount_inc_gst_cents from public.xero_deposit_matches m
        join active_entries e on e.id=m.payment_entry_id and e.project_id=m.project_id
        where m.reversed_at is null
    ), owned as (
      -- A settled Xero receipt may also be the canonical whole-invoice receipt.
      select invoice_id,sum(amount)::bigint amount from (
        select invoice_id,entry_id,max(amount) amount from owned_evidence group by invoice_id,entry_id
      ) once_only group by invoice_id
    ), allocated as (
      select i.id,sum(a.amount_inc_gst_cents)::bigint amount from eligible i
      join public.project_payment_allocations a on a.project_id=i.project_id and a.reversed_at is null
        and (a.standalone_invoice_id=i.id or (a.quote_version_id=i.quote_version_id and a.payment_term_id=i.payment_term_id))
      join active_entries e on e.id=a.payment_entry_id group by i.id
    ), credit_projects as (
      select distinct e.project_id from active_entries e
      where e.amount_inc_gst_cents<0 or (e.amount_inc_gst_cents>0 and e.source_invoice_id is null
        and not exists(select 1 from public.xero_deposit_matches m where m.payment_entry_id=e.id and m.reversed_at is null)
        and e.amount_inc_gst_cents>coalesce((select sum(a.amount_inc_gst_cents) from public.project_payment_allocations a
          where a.payment_entry_id=e.id and a.reversed_at is null),0))
    ), facts as (
      select i.*,coalesce(o.amount,0) recorded,coalesce(a.amount,0) allocated,
        case
          when coalesce(o.amount,0)>i.total_inc_gst_cents then 'Recorded payments exceed this invoice. Check the project payment history.'
          when i.status='PAID' and coalesce(o.amount,0)<>i.total_inc_gst_cents then 'Paid status and receipt evidence differ. Check the project payment history.'
          when i.status='VOID' and coalesce(o.amount,0)>0 then 'Voided invoice retains payments. Check their ownership in the project.'
          when i.status='OPEN' and coalesce(o.amount,0)>=i.total_inc_gst_cents then 'Recorded payments cover this open invoice. Check its settlement status.'
          when i.status='OPEN' and coalesce(a.amount,0)>coalesce(o.amount,0) then 'Allocated project credit needs checking against this issued invoice.'
          when i.status='OPEN' and cp.project_id is not null then 'Project credit or adjustments need checking before chasing this balance.'
        end check_reason,
        t.provider_invoice_id,obs.checked_at provider_checked_at,
        case when t.provider_invoice_id is not null then case
          when sync.state in ('review','unavailable') then 'Xero payment check needs attention. Portal amounts are shown.'
          when obs.result->>'state' in ('conflict','unavailable') then 'Xero could not confirm the portal position.'
          when obs.checked_at is null then 'Xero has not confirmed this invoice yet.'
          when obs.checked_at<now()-interval '24 hours' or sync.checked_at<now()-interval '24 hours' then 'Xero payment check is out of date.'
          when (obs.result->>'amountPaidCents')::bigint is distinct from coalesce(o.amount,0) then 'Xero and portal payment amounts differ.'
        end end provider_note,
        greatest(case when i.restore_command_id is null then i.sent_at end,sent.sent_at) current_sent_at,
        latest.status latest_send_status,greatest(latest.created_at,intent.updated_at) last_attempt_at,latest.next_retry_at,
        intent.status intent_status
      from eligible i left join owned o on o.invoice_id=i.id left join allocated a on a.id=i.id
      left join credit_projects cp on cp.project_id=i.project_id
      left join private.xero_invoice_transfers t on t.invoice_id=i.id
      left join private.xero_payment_sync_status sync on sync.invoice_id=i.id and sync.tenant_id=t.tenant_id
      left join lateral (select obs.result,obs.checked_at from private.xero_invoice_observations obs
        where obs.transfer_id=t.id and obs.portal_status=i.status order by obs.generation desc limit 1) obs on true
      left join private.commercial_email_intents intent on intent.intent_key='deposit-invoice-send:'||i.id::text
        ||case when i.restore_command_id is not null then ':restore:'||i.restore_command_id::text else '' end
      left join lateral (select max(coalesce(l.sent_at,l.created_at)) sent_at from public.deposit_invoice_send_logs l
        where l.deposit_invoice_id=i.id and l.status='SENT' and (i.restore_command_id is null or l.delivery_intent_id=intent.id)) sent on true
      left join lateral (select l.status,l.created_at,l.next_retry_at from public.deposit_invoice_send_logs l
        where l.deposit_invoice_id=i.id and (i.restore_command_id is null or l.delivery_intent_id=intent.id)
        order by l.created_at desc,l.id desc limit 1) latest on true
    ), rows as materialized (
      select id,project_id as "projectId",coalesce(invoice_ref,'Unissued draft') reference,coalesce(customer_name,'Customer not recorded') customer,
        coalesce(project_name,'Untitled project') project,status,false as expired,currency,total_inc_gst_cents as "totalCents",
        case when status='DRAFT' or check_reason is not null then null else recorded end as "paidCents",
        case when status in ('VOID','DRAFT') or check_reason is not null then null else greatest(0,total_inc_gst_cents-recorded) end as "balanceCents",
        issue_date::text as "issueDate",due_date::text as "dueDate",current_sent_at as "sentAt",
        case when current_sent_at is not null then 'sent' when intent_status in ('dispatching','provider_accepted') then 'pending'
          when intent_status='prepared' then 'prepared' when intent_status='needs_attention' then 'review'
          when latest_send_status='FAILED' or intent_status='failed' then 'failed' else 'needs' end as "sendState",
        case when intent_status in ('dispatching','provider_accepted') then 'Delivery is being confirmed. Do not send again yet.'
          when intent_status='prepared' then 'Delivery is prepared. Open job invoices to continue the existing delivery.'
          when intent_status='needs_attention' then 'Delivery needs attention. Check the existing delivery in job invoices before sending again.'
          when intent_status='failed' then 'Delivery failed. Open job invoices to recover the existing delivery.'
          when latest_send_status='FAILED' then 'Latest send attempt failed.' end as "sendNote",
        case when intent_status in ('prepared','dispatching','provider_accepted','failed','needs_attention') then intent_status end as "deliveryState",
        last_attempt_at as "lastAttemptAt",next_retry_at as "nextRetryAt",check_reason as "checkReason",provider_note as "providerNote",
        provider_checked_at as "providerCheckedAt",quote_id as "quoteId",quote_version_number as version,
        null::integer as "pendingDraftVersion",null::integer as "acceptedVersion",0 as "historyCount",'[]'::jsonb history
      from facts
    ), matching as materialized (
      select * from rows where
        (p_view='all' or (p_view='outstanding' and status='OPEN')
        or (p_view='overdue' and status='OPEN' and "dueDate"::date<(now() at time zone 'Pacific/Auckland')::date)
        or (p_view='drafts' and status='DRAFT') or (p_view='paid' and status='PAID'))
        and (p_sent='all' or (p_sent='sent' and "sendState"='sent')
          or (p_sent='pending' and "deliveryState" in ('dispatching','provider_accepted'))
          or (p_sent='needs' and status<>'DRAFT' and ((status<>'VOID' and "sendState" in ('needs','failed','prepared','review')) or "deliveryState" in ('prepared','failed','needs_attention'))))
    ), page as (select * from matching order by "dueDate" nulls last,reference,id limit 50 offset p_offset),
    totals as (select currency,sum("totalCents") as "totalCents",coalesce(sum("paidCents"),0) as "paidCents",
        coalesce(sum("balanceCents"),0) as "balanceCents",count(*) filter(where "checkReason" is not null) as "unconfirmedCount"
      from matching group by currency)
    select jsonb_build_object('checkedAt',now(),'count',(select count(*) from matching),'draftsAllowed',v_admin,
      'rows',coalesce((select jsonb_agg(to_jsonb(page) order by "dueDate" nulls last,reference,id) from page),'[]'::jsonb),
      'hasMore',(select count(*) from matching)>p_offset+50,
      'totals',coalesce((select jsonb_agg(to_jsonb(totals) order by currency) from totals),'[]'::jsonb)) into v_result;
  else
    with unfinished as materialized (
      -- Same priority as quoteDeliveryReadiness: initial send before resend.
      -- Only recovery metadata is projected, never frozen payload/recipients.
      select distinct on (e.subject_id) e.subject_id,e.kind,e.status,e.updated_at
      from private.commercial_email_intents e
      where e.kind in ('quote_send','quote_resend') and e.status not in ('finalised','cancelled')
      order by e.subject_id,case when e.kind='quote_send' then 0 else 1 end,e.created_at desc,e.id desc
    ), delivery_source as (
      select v.id,greatest(v.sent_at,sent.sent_at) sent_at,latest.status latest_status,
        delivery.kind,delivery.status intent_status,greatest(latest.created_at,delivery.updated_at) activity_at
      from public.quote_versions v
      left join (select l.quote_version_id,max(coalesce(l.sent_at,l.created_at)) sent_at from public.quote_send_logs l
        where l.status='SENT' group by l.quote_version_id) sent on sent.quote_version_id=v.id
      left join (select distinct on (l.quote_version_id) l.quote_version_id,l.status,l.created_at from public.quote_send_logs l
        order by l.quote_version_id,l.created_at desc,l.id desc) latest on latest.quote_version_id=v.id
      left join unfinished delivery on delivery.subject_id=v.id
    ), delivery_facts as materialized (
      select source.*,
        case when sent_at is not null then 'sent' when intent_status in ('dispatching','provider_accepted') then 'pending'
          when intent_status='prepared' then 'prepared' when intent_status='needs_attention' then 'review'
          when intent_status='failed' or latest_status='FAILED' then 'failed' else 'needs' end send_state,
        case when intent_status='prepared' then case when kind='quote_resend' then 'Resend' else 'Delivery' end||' is prepared. Open the quote to continue the existing delivery.'
          when intent_status in ('dispatching','provider_accepted') then case when kind='quote_resend' then 'Resend' else 'Delivery' end||' is being confirmed. Do not send again yet.'
          when intent_status='failed' then case when kind='quote_resend' then 'Resend' else 'Delivery' end||' failed. Open the quote to recover the existing delivery.'
          when intent_status='needs_attention' then case when kind='quote_resend' then 'Resend' else 'Delivery' end||' needs attention. Check the existing delivery in the quote before sending again.'
          when latest_status='FAILED' then 'Latest send attempt failed.' end send_note
      from delivery_source source
    ), families as (
      select q.id,q.project_id,q.quote_ref,q.internal_name,p.name project_name,c.name customer_name from public.quotes q
      join public.projects p on p.id=q.project_id left join public.contacts c on c.id=p.contact_id
    ), family_state as materialized (
      select q.id,q.project_id,q.quote_ref,q.internal_name,q.project_name,q.customer_name,
        draft.version_number draft_version,accepted.id accepted_id,accepted.status accepted_status,
        case when accepted.status='ACCEPTED' then accepted.version_number end accepted_version
      from families q
      -- Current accepted selection honours terminal accepted-lifecycle tombstones.
      left join lateral (select v.* from public.quote_versions v where v.quote_id=q.id
        and (v.status='ACCEPTED' or v.accepted_at is not null)
        order by v.version_number desc,v.created_at desc,v.id desc limit 1) accepted on true
      left join lateral (select v.version_number from public.quote_versions v where v.quote_id=q.id and v.status='DRAFT'
        and (v.is_current_draft or v.delivery_prepared_at is not null) order by v.version_number desc,v.id desc limit 1) draft on true
    ), chosen as (
      -- Qualify versions once, then choose one per family. A per-family scan of
      -- the materialized delivery set would repeat the entire global read.
      select distinct on (q.id) q.id,q.project_id,q.quote_ref,q.internal_name,q.project_name,q.customer_name,
        v.id version_id,v.version_number,v.status,v.total_inc_gst_cents,v.sent_at,v.expires_at,v.created_at version_created_at,v.customer_name version_customer,
        q.draft_version,q.accepted_version
      from family_state q join public.quote_versions v on v.quote_id=q.id join delivery_facts d on d.id=v.id
      where (
        (p_view='awaiting' and v.status='SENT' and (v.expires_at is null or v.expires_at>=(now() at time zone 'Pacific/Auckland')::date))
        or (p_view='accepted' and v.id=q.accepted_id and q.accepted_status='ACCEPTED')
        or (p_view='drafts' and v.status='DRAFT' and (v.is_current_draft or v.delivery_prepared_at is not null))
        or (p_view='expired' and v.status='SENT' and v.expires_at<(now() at time zone 'Pacific/Auckland')::date)
        or (p_view='declined' and v.status='DECLINED')
        or (p_view='history' and v.status in ('DECLINED','SUPERSEDED'))
        or p_view='all') and (p_sent='all' or (p_sent='sent' and d.send_state='sent')
          or (p_sent='pending' and d.intent_status in ('dispatching','provider_accepted'))
          or (p_sent='needs' and (d.intent_status in ('prepared','failed','needs_attention')
            or (d.send_state in ('needs','failed') and v.status not in ('DECLINED','SUPERSEDED')
              and (v.status<>'DRAFT' or v.is_current_draft or v.delivery_prepared_at is not null)))))
      and (p_search='' or strpos(lower(coalesce(q.quote_ref,'')||' '||coalesce(q.internal_name,'')||' '||coalesce(v.customer_name,q.customer_name,'')||' '||coalesce(q.project_name,'')),lower(p_search))>0)
      order by q.id,case when p_view='all' and v.status='DRAFT' then 1 else 0 end,v.version_number desc,v.created_at desc,v.id desc
    ), rows as materialized (
      select v.version_id id,v.project_id as "projectId",v.quote_ref reference,coalesce(v.version_customer,v.customer_name,'Customer not recorded') customer,
        coalesce(v.project_name,'Untitled project') project,v.status,coalesce(v.status='SENT' and v.expires_at<(now() at time zone 'Pacific/Auckland')::date,false) expired,
        'NZD'::text currency,v.total_inc_gst_cents as "totalCents",
        null::bigint as "paidCents",null::bigint as "balanceCents",(v.version_created_at at time zone 'Pacific/Auckland')::date::text as "issueDate",v.expires_at::text as "dueDate",
        d.sent_at as "sentAt",d.send_state as "sendState",d.send_note as "sendNote",
        d.intent_status as "deliveryState",d.activity_at as "lastAttemptAt",null::timestamptz as "nextRetryAt",
        null::text as "checkReason",null::text as "providerNote",null::timestamptz as "providerCheckedAt",
        v.id as "quoteId",v.version_number version,v.draft_version as "pendingDraftVersion",v.accepted_version as "acceptedVersion",
        (select count(*) from public.quote_versions h where h.quote_id=v.id) as "historyCount"
      from chosen v
      join delivery_facts d on d.id=v.version_id
    ), matching as materialized (select * from rows),
    page as (select * from matching order by "issueDate" desc,reference,id limit 50 offset p_offset),
    detailed as (select page.*,coalesce((select jsonb_agg(to_jsonb(h) order by h.version desc,h.id) from (
      select h.id,h.version_number version,h.status,coalesce(h.status='SENT' and h.expires_at<(now() at time zone 'Pacific/Auckland')::date,false) expired,h.total_inc_gst_cents as "totalCents" from public.quote_versions h
      where h.quote_id=page."quoteId" order by h.version_number desc,h.id limit 5) h),'[]'::jsonb) history from page),
    totals as (select currency,sum("totalCents") as "totalCents",0::bigint as "paidCents",0::bigint as "balanceCents",0::bigint as "unconfirmedCount" from matching group by currency)
    select jsonb_build_object('checkedAt',now(),'count',(select count(*) from matching),'draftsAllowed',v_admin,
      'rows',coalesce((select jsonb_agg(to_jsonb(detailed) order by "issueDate" desc,reference,id) from detailed),'[]'::jsonb),
      'hasMore',(select count(*) from matching)>p_offset+50,
      'totals',coalesce((select jsonb_agg(to_jsonb(totals) order by currency) from totals),'[]'::jsonb)) into v_result;
  end if;
  return v_result;
end;
$$;
revoke all on function public.finance_register_v1(uuid,text,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.finance_register_v1(uuid,text,text,text,text,integer) to service_role;
comment on function public.finance_register_v1(uuid,text,text,text,text,integer) is 'Bounded grant-rechecked Finance register. Read-only; invoice drafts remain admin-only; totals cover the full matching set by currency.';
notify pgrst,'reload schema';
commit;
