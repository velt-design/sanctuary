-- Restore an accidental void without reissuing, resending, or changing money.
begin;
alter table public.deposit_invoices add column restored_at timestamptz, add column restore_command_id uuid;
alter table private.commercial_email_intents drop constraint commercial_email_intents_status_check;
alter table private.commercial_email_intents add constraint commercial_email_intents_status_check
  check(status in ('prepared','dispatching','provider_accepted','finalised','failed','needs_attention','cancelled'));
drop index private.commercial_email_intents_one_unfinished_subject;
create unique index commercial_email_intents_one_unfinished_subject
  on private.commercial_email_intents(kind,subject_id) where status not in ('finalised','cancelled');

-- Serialize preparation/dispatch with restore. A sender may have loaded OPEN
-- before PDF rendering; that old snapshot is not authority for a later send.
create or replace function private.invoice_email_generation_guard()
returns trigger language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare v_invoice public.deposit_invoices%rowtype; v_project_id uuid; v_key text;
begin
  if new.status='cancelled' and new.kind<>'deposit_invoice_send' then
    raise exception 'Only invoice restoration may cancel an unsent invoice delivery' using errcode='55000';
  end if;
  if tg_op='UPDATE' and old.status='cancelled' and new.status<>'cancelled' then
    raise exception 'Cancelled delivery cannot be resumed' using errcode='55000';
  end if;
  if new.kind<>'deposit_invoice_send' then return new; end if;
  if tg_op='UPDATE' and new.status<>'dispatching' then return new; end if;
  select project_id into strict v_project_id from public.deposit_invoices where id=new.subject_id;
  perform pg_advisory_xact_lock(hashtextextended('commercial-project-invoice:'||v_project_id::text,0));
  select * into strict v_invoice from public.deposit_invoices where id=new.subject_id for share;
  v_key:='deposit-invoice-send:'||v_invoice.id::text||case when v_invoice.restore_command_id is null then ''
    else ':restore:'||v_invoice.restore_command_id::text end;
  if v_invoice.status<>'OPEN' or new.project_id is distinct from v_project_id or new.intent_key<>v_key then
    raise exception 'Invoice changed before sending; refresh the invoice before trying again' using errcode='55000';
  end if;
  return new;
end;
$$;
revoke all on function private.invoice_email_generation_guard() from public,anon,authenticated,service_role;
create trigger invoice_email_generation_guard before insert or update of status on private.commercial_email_intents
for each row execute function private.invoice_email_generation_guard();
create or replace function public.commercial_restore_invoice_context(p_invoice_id uuid)
returns jsonb language sql security definer set search_path=pg_catalog,pg_temp as $$
  select jsonb_build_object('tenantId', t.tenant_id)
  from private.xero_invoice_transfers t
  where t.invoice_id=p_invoice_id and t.provider_invoice_id is not null;
$$;
revoke all on function public.commercial_restore_invoice_context(uuid) from public,anon,authenticated;
grant execute on function public.commercial_restore_invoice_context(uuid) to service_role;

create or replace function public.commercial_restore_invoice(
  p_invoice_id uuid, p_expected_voided_at timestamptz, p_command_id uuid, p_reason text, p_actor text
)
returns uuid language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare
  v_invoice public.deposit_invoices%rowtype;
  v_project_id uuid;
  v_transfer private.xero_invoice_transfers%rowtype;
  v_observation private.xero_invoice_observations%rowtype;
  v_previous jsonb;
  v_payload jsonb;
  v_matched bigint;
  v_available bigint;
  v_scope_available bigint;
  v_delivery private.commercial_email_intents%rowtype;
begin
  if p_command_id is null or p_expected_voided_at is null or nullif(trim(p_actor),'') is null
    or length(trim(coalesce(p_reason,''))) not between 3 and 1000 then
    raise exception 'A restore reason and current void identity are required' using errcode='22023';
  end if;
  select project_id into v_project_id from public.deposit_invoices where id=p_invoice_id;
  if not found then raise exception 'Invoice not found' using errcode='P0002'; end if;
  perform pg_advisory_xact_lock(hashtextextended('commercial-project-invoice:'||v_project_id::text,0));
  -- Match the observation owner's transfer-before-invoice row lock order.
  select * into v_transfer from private.xero_invoice_transfers where invoice_id=p_invoice_id for update;
  select * into strict v_invoice from public.deposit_invoices where id=p_invoice_id for update;
  v_payload:=jsonb_build_object('invoiceId',p_invoice_id,'voidedAt',p_expected_voided_at,'reason',trim(p_reason),'actor',p_actor);
  select payload into v_previous from public.audit_events where idempotency_key='invoice.restored:'||p_command_id::text;
  if found then
    if v_previous->'request' is distinct from v_payload then
      raise exception 'Restore request changed; refresh the invoice and try again' using errcode='22023';
    end if;
    return p_invoice_id;
  end if;
  if v_invoice.status<>'VOID' or v_invoice.voided_at is distinct from p_expected_voided_at then
    raise exception 'Invoice changed; refresh before restoring' using errcode='55000';
  end if;
  select * into v_delivery from private.commercial_email_intents
    where intent_key=case when v_invoice.restore_command_id is null then 'deposit-invoice-send:'||p_invoice_id::text
      else 'deposit-invoice-send:'||p_invoice_id::text||':restore:'||v_invoice.restore_command_id::text end
      and status not in ('finalised','cancelled') for update;
  if found then
    if v_delivery.provider_message_id is null and v_delivery.provider_accepted_at is null and (
      (v_delivery.status='prepared' and v_delivery.attempt_count=0)
      or (v_delivery.attempt_count=1 and v_delivery.status in ('failed','needs_attention')
        and v_delivery.last_error_code in ('RESEND_AUTH_REJECTED','RESEND_VALIDATION_REJECTED','RESEND_QUOTA_REJECTED',
          'RESEND_REQUEST_REJECTED','RESEND_ABORTED_BEFORE_DISPATCH','RESEND_RATE_LIMITED'))
    ) then
      update private.commercial_email_intents set status='cancelled',last_error_code='INVOICE_RESTORED_UNSENT_DELIVERY'
        where id=v_delivery.id;
    else
      raise exception 'An earlier invoice email still needs delivery reconciliation; resolve that attempt before restoring' using errcode='55000';
    end if;
  end if;
  if exists(select 1 from public.projects where id=v_project_id and archived_at is not null)
    or exists(select 1 from public.project_operational_states where project_id=v_project_id and state='CLOSED' and closed_outcome<>'COMPLETE') then
    raise exception 'Reopen the archived or cancelled project before restoring this invoice' using errcode='55000';
  end if;
  select coalesce(sum(amount_inc_gst_cents),0) into v_matched from public.xero_deposit_matches
    where invoice_id=p_invoice_id and reversed_at is null;
  if v_matched>=v_invoice.total_inc_gst_cents or v_invoice.paid_at is not null then
    raise exception 'Payment history already covers this invoice; reconcile its payment status before restoring' using errcode='55000';
  end if;
  if v_transfer.provider_invoice_id is not null then
    select * into v_observation from private.xero_invoice_observations
      where transfer_id=v_transfer.id order by generation desc limit 1;
    if v_observation.result->>'reason'='BOTH_SYSTEMS_VOIDED' then
      raise exception 'This invoice is also voided or deleted in Xero; create a replacement invoice instead' using errcode='55000';
    end if;
    if v_observation.portal_status is distinct from 'VOID'
      or v_observation.checked_at<clock_timestamp()-interval '1 minute'
      or v_observation.result->>'state' is distinct from 'correction_pending'
      or (v_observation.result->>'amountPaidCents')::bigint is distinct from v_matched then
      raise exception 'Xero could not confirm matching invoice and payment details; review this invoice in Finance before restoring' using errcode='55000';
    end if;
  end if;
  if v_invoice.invoice_kind='QUOTE_LINKED' then
    if not exists(select 1 from public.commercial_current_accepted_quote_versions(v_project_id) where quote_version_id=v_invoice.quote_version_id) then
      raise exception 'The source quote is no longer the current accepted quote; use its current invoice instead' using errcode='55000';
    end if;
    if exists(select 1 from public.deposit_invoices where quote_version_id=v_invoice.quote_version_id
      and payment_term_id=v_invoice.payment_term_id and status in ('OPEN','PAID')) then
      raise exception 'Another active invoice covers this payment stage; resolve that replacement before restoring' using errcode='55000';
    end if;
    select remaining_to_invoice_inc_gst_cents into v_available from public.commercial_project_financial_truth(v_project_id);
    select q.total_inc_gst_cents
      -coalesce((select sum(a.amount_inc_gst_cents) from public.project_payment_allocations a where a.quote_version_id=q.id and a.reversed_at is null),0)
      -coalesce((select sum(greatest(0,i.total_inc_gst_cents-coalesce((select sum(m.amount_inc_gst_cents) from public.xero_deposit_matches m where m.invoice_id=i.id and m.reversed_at is null),0))) from public.deposit_invoices i where i.quote_version_id=q.id and i.status='OPEN'),0)
      -v_matched into v_scope_available from public.quote_versions q where q.id=v_invoice.quote_version_id;
    if v_invoice.total_inc_gst_cents-v_matched>least(v_available,v_scope_available) then
      raise exception 'Restoring would exceed the remaining agreed balance; review replacement invoices and payments first' using errcode='55000';
    end if;
    if exists(select 1 from public.project_invoice_plan_items where quote_version_id=v_invoice.quote_version_id
      and payment_term_id=v_invoice.payment_term_id and cancelled_at is not null) then
      raise exception 'This instalment plan was replaced; review the current schedule before restoring' using errcode='55000';
    end if;
  end if;
  update public.deposit_invoices set status='OPEN',voided_at=null,voided_by=null,void_reason=null,
    restored_at=clock_timestamp(),restore_command_id=p_command_id,
    portal_token_hash=null,portal_token_expires_at=null
    where id=p_invoice_id;
  insert into public.audit_events(project_id,type,idempotency_key,payload) values(v_project_id,'invoice.restored',
    'invoice.restored:'||p_command_id::text,jsonb_build_object('request',v_payload,'invoiceId',p_invoice_id,
      'invoiceRef',v_invoice.invoice_ref,'previousVoidReason',v_invoice.void_reason,'previousVoidedBy',v_invoice.voided_by,
      'cancelledDeliveryIntentId',case when v_delivery.id is not null then v_delivery.id else null end));
  perform public.commercial_reopen_paid_project_if_unsettled(v_project_id,'Invoice restored');
  return p_invoice_id;
end;
$$;
revoke all on function public.commercial_restore_invoice(uuid,timestamptz,uuid,text,text) from public,anon,authenticated;
grant execute on function public.commercial_restore_invoice(uuid,timestamptz,uuid,text,text) to service_role;

-- A second void must retain its own evidence after a restore.
do $patch$
declare v_definition text;
begin
  v_definition:=pg_get_functiondef('public.commercial_void_open_invoice(uuid,text,text)'::regprocedure);
  if strpos(v_definition,'''invoice.voided:'' || p_invoice_id::text,')=0 then raise exception 'Void audit owner changed'; end if;
  v_definition:=replace(v_definition,'''invoice.voided:'' || p_invoice_id::text,',
    '''invoice.voided:'' || p_invoice_id::text || '':'' || gen_random_uuid()::text,');
  if strpos(v_definition,'  update public.deposit_invoices set')=0 then raise exception 'Void command owner changed'; end if;
  execute replace(v_definition,'  update public.deposit_invoices set',
    '  if exists(select 1 from private.commercial_email_intents where kind=''deposit_invoice_send''
      and subject_id=p_invoice_id and status in (''dispatching'',''provider_accepted'')) then
      raise exception ''Invoice email delivery is still being confirmed; try voiding again after it completes'' using errcode=''55000'';
    end if;
  update public.deposit_invoices set');
end;
$patch$;

-- Dispatch must take the project lock before the intent row, like restoration.
-- Cancellation remains historical and is excluded from the unfinished reader.
do $patch$
declare v_definition text; v_anchor text:='  select intent.*';
begin
  v_definition:=pg_get_functiondef('public.commercial_email_mark_dispatching(uuid)'::regprocedure);
  if strpos(v_definition,v_anchor)=0 then raise exception 'Email dispatch owner changed'; end if;
  execute replace(v_definition,v_anchor,
    '  perform pg_advisory_xact_lock(hashtextextended(''commercial-project-invoice:''||project_id::text,0))
      from private.commercial_email_intents where id=p_intent_id and kind=''deposit_invoice_send'';
  select intent.*');
  v_definition:=pg_get_functiondef('public.commercial_email_read_unfinished(text,uuid)'::regprocedure);
  if strpos(v_definition,'intent.status <> ''finalised''')=0 then raise exception 'Unfinished email reader changed'; end if;
  execute replace(v_definition,'intent.status <> ''finalised''','intent.status not in (''finalised'',''cancelled'')');
end;
$patch$;
notify pgrst,'reload schema';
commit;
