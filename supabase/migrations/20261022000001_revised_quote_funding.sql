-- Invoice identity and issued content stay immutable. These explicit economic
-- relationships reconcile legacy billing without rewriting customer documents.
begin;

create table public.commercial_invoice_scope_assignments (
  invoice_id uuid primary key references public.deposit_invoices(id) on delete restrict,
  project_id uuid not null references public.projects(id) on delete restrict,
  treatment text not null check (treatment in ('NATIVE','QUOTE_PAYMENT','SEPARATE_CHARGE')),
  quote_id uuid references public.quotes(id) on delete restrict,
  revision integer not null check (revision > 0),
  command_id uuid not null unique,
  reason text not null,
  actor text not null,
  updated_at timestamptz not null default clock_timestamp(),
  check ((treatment = 'QUOTE_PAYMENT') = (quote_id is not null))
);
alter table public.commercial_invoice_scope_assignments enable row level security;
revoke all on public.commercial_invoice_scope_assignments from public, anon, authenticated, service_role;
grant select on public.commercial_invoice_scope_assignments to authenticated, service_role;
create policy commercial_invoice_scope_staff_read on public.commercial_invoice_scope_assignments
for select using (public.has_portal_access() or auth.role() = 'service_role');

-- Persist the acceptance decision, including its business time, independently
-- of invoice creation. Replays must not change manual billing into a new send.
create table private.commercial_quote_acceptance_billing (
  quote_version_id uuid primary key references public.quote_versions(id) on delete restrict,
  billing_mode text not null check (billing_mode in ('scheduled','manual')),
  accepted_at timestamptz not null
);
revoke all on private.commercial_quote_acceptance_billing from public, anon, authenticated, service_role;

create or replace function public.commercial_invoice_effective_quote(p_invoice_id uuid)
returns uuid language sql stable security definer set search_path = pg_catalog, pg_temp as $$
  select case a.treatment when 'QUOTE_PAYMENT' then a.quote_id
    when 'SEPARATE_CHARGE' then null else i.quote_id end
  from public.deposit_invoices i left join public.commercial_invoice_scope_assignments a on a.invoice_id=i.id
  where i.id=p_invoice_id;
$$;

create or replace function public.commercial_quote_scope_funding(p_quote_version_id uuid)
returns table(paid_inc_gst_cents integer, open_inc_gst_cents integer, carried_paid_inc_gst_cents integer)
language plpgsql stable security definer set search_path = pg_catalog, pg_temp as $$
declare v_quote_id uuid; v_project_id uuid; v_paid integer; v_open integer; v_current integer;
begin
  if coalesce(auth.role(),'') <> 'service_role' and not public.has_portal_access() then
    raise exception 'Staff access required' using errcode='42501';
  end if;
  select v.quote_id,q.project_id into strict v_quote_id,v_project_id
    from public.quote_versions v join public.quotes q on q.id=v.quote_id where v.id=p_quote_version_id;
  with ownership as (
    select e.*, coalesce(e.source_invoice_id,original.source_invoice_id,m.invoice_id) as owned_invoice
    from public.project_payment_entries e
    left join public.project_payment_entries original on original.id=e.reverses_entry_id
    left join lateral (select x.invoice_id from public.xero_deposit_matches x
      where x.payment_entry_id=coalesce(e.reverses_entry_id,e.id) order by x.approved_at desc limit 1) m on true
    where e.project_id=v_project_id
  ), funding as (
    -- Source ownership reserves unallocated receipts for their original family.
    -- Explicit quoted allocations may divide that money between families, so
    -- count them once and leave only their residual with the source family.
    select e.amount_inc_gst_cents - case when e.amount_inc_gst_cents > 0 then coalesce((
      select sum(a.amount_inc_gst_cents) from public.project_payment_allocations a
      where a.payment_entry_id=e.id and a.reversed_at is null and a.quote_version_id is not null
    ),0) else 0 end as amount from ownership e
      where e.owned_invoice is not null and public.commercial_invoice_effective_quote(e.owned_invoice)=v_quote_id
    union all
    select a.amount_inc_gst_cents from ownership e
      join public.project_payment_allocations a on a.payment_entry_id=e.id and a.reversed_at is null
      join public.quote_versions v on v.id=a.quote_version_id
      left join public.commercial_invoice_scope_assignments assigned on assigned.invoice_id=e.owned_invoice
      where v.quote_id=v_quote_id and coalesce(assigned.treatment,'NATIVE') <> 'SEPARATE_CHARGE'
  ) select coalesce(sum(amount),0)::integer into v_paid from funding;
  select coalesce(sum(greatest(0,i.total_inc_gst_cents-coalesce((select sum(x.amount_inc_gst_cents)
    from public.xero_deposit_matches x where x.invoice_id=i.id and x.reversed_at is null),0))),0)::integer into v_open
    from public.deposit_invoices i where i.project_id=v_project_id and i.status='OPEN'
      and public.commercial_invoice_effective_quote(i.id)=v_quote_id;
  select coalesce(sum(a.amount_inc_gst_cents),0)::integer into v_current
    from public.project_payment_allocations a where a.quote_version_id=p_quote_version_id and a.reversed_at is null;
  return query select v_paid,v_open,greatest(0,v_paid-v_current);
end;
$$;

create or replace function public.commercial_quote_acceptance_billing_mode(p_quote_version_id uuid)
returns text language sql stable security definer set search_path=pg_catalog,pg_temp as $$
  select billing_mode from private.commercial_quote_acceptance_billing where quote_version_id=p_quote_version_id;
$$;

create or replace function public.commercial_project_additional_invoice_value(p_project_id uuid)
returns integer language sql stable security definer set search_path = pg_catalog, pg_temp as $$
  select coalesce(sum(i.total_inc_gst_cents),0)::integer from public.deposit_invoices i
    left join public.commercial_invoice_scope_assignments a on a.invoice_id=i.id
    where i.project_id=p_project_id and i.status in ('OPEN','PAID') and (
      (i.invoice_kind='STANDALONE' and coalesce(a.treatment,'NATIVE') <> 'QUOTE_PAYMENT')
      or (a.treatment='SEPARATE_CHARGE' and not exists (
        select 1 from public.commercial_current_accepted_quote_versions(p_project_id) c where c.quote_version_id=i.quote_version_id
      ))
    );
$$;

create or replace function public.commercial_invoice_scope_fingerprint(p_invoice_id uuid)
returns text language sql stable security definer set search_path=pg_catalog,pg_temp as $$
  select md5(jsonb_build_object('invoice',to_jsonb(i),
    'payments',(select coalesce(jsonb_agg(to_jsonb(e) order by e.id),'[]') from public.project_payment_entries e where e.project_id=i.project_id),
    'allocations',(select coalesce(jsonb_agg(to_jsonb(a) order by a.id),'[]') from public.project_payment_allocations a where a.project_id=i.project_id),
    'matches',(select coalesce(jsonb_agg(to_jsonb(m) order by m.id),'[]') from public.xero_deposit_matches m where m.project_id=i.project_id)
  )::text) from public.deposit_invoices i where i.id=p_invoice_id;
$$;

create or replace function public.commercial_reconciled_allocation_guard()
returns trigger language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
begin
  if new.quote_version_id is not null and exists(
    select 1 from public.project_payment_entries e
      join public.commercial_invoice_scope_assignments a on a.invoice_id=e.source_invoice_id
    where e.id=new.payment_entry_id and a.treatment='SEPARATE_CHARGE'
  ) then raise exception 'Separate charge receipts cannot settle quoted work' using errcode='55000'; end if;
  return new;
end;
$$;
create trigger project_payment_allocations_reconciled_scope before insert on public.project_payment_allocations
for each row execute function public.commercial_reconciled_allocation_guard();

create or replace function public.commercial_reconcile_invoice_scope(
  p_invoice_id uuid, p_treatment text, p_quote_id uuid,
  p_expected_total_inc_gst_cents integer, p_expected_status text,
  p_expected_revision integer, p_expected_ledger_fingerprint text, p_command_id uuid, p_reason text, p_actor text
)
returns jsonb language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
declare v_invoice public.deposit_invoices%rowtype; v_before public.commercial_invoice_scope_assignments%rowtype;
  v_after public.commercial_invoice_scope_assignments%rowtype; v_request jsonb; v_receipt jsonb; v_result jsonb;
begin
  -- This is an operator reconciliation, never a customer/public mutation.
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Service authority required' using errcode='42501'; end if;
  if p_command_id is null or length(trim(coalesce(p_reason,''))) < 3 or length(trim(coalesce(p_actor,''))) < 3
    or p_expected_revision is null or p_expected_revision < 0
    or coalesce(p_expected_ledger_fingerprint,'') !~ '^[a-f0-9]{32}$'
    or p_treatment not in ('NATIVE','QUOTE_PAYMENT','SEPARATE_CHARGE') or p_treatment is null
    or ((p_treatment='QUOTE_PAYMENT') <> (p_quote_id is not null)) then
    raise exception 'Explicit scope, expected revision, command, actor and reason required' using errcode='22023';
  end if;
  select * into strict v_invoice from public.deposit_invoices where id=p_invoice_id;
  perform pg_advisory_xact_lock(hashtextextended('commercial-project-invoice:'||v_invoice.project_id::text,0));
  select * into strict v_invoice from public.deposit_invoices where id=p_invoice_id for update;
  v_request:=jsonb_build_object('invoiceId',p_invoice_id,'treatment',p_treatment,'quoteId',p_quote_id,
    'expectedTotal',p_expected_total_inc_gst_cents,'expectedStatus',p_expected_status,'expectedRevision',p_expected_revision,
    'ledgerFingerprint',p_expected_ledger_fingerprint,
    'reason',trim(p_reason),'actor',trim(p_actor));
  select payload into v_receipt from public.audit_events where idempotency_key='invoice.scope_reconciled:'||p_command_id::text;
  if found then
    if v_receipt->'request' is distinct from v_request then raise exception 'Reconciliation command reused with different input' using errcode='22023'; end if;
    return v_receipt->'result';
  end if;
  if v_invoice.total_inc_gst_cents is distinct from p_expected_total_inc_gst_cents
    or v_invoice.status is distinct from p_expected_status or v_invoice.status not in ('OPEN','PAID') then
    raise exception 'Invoice changed; refresh reconciliation evidence' using errcode='55000';
  end if;
  if public.commercial_invoice_scope_fingerprint(p_invoice_id) is distinct from p_expected_ledger_fingerprint then
    raise exception 'Payment evidence changed; refresh before reconciling' using errcode='55000';
  end if;
  select * into v_before from public.commercial_invoice_scope_assignments where invoice_id=p_invoice_id for update;
  if coalesce(v_before.revision,0) <> p_expected_revision then raise exception 'Scope assignment changed; refresh before reconciling' using errcode='55000'; end if;
  if p_treatment='QUOTE_PAYMENT' and (v_invoice.invoice_kind <> 'STANDALONE' or not exists (
    select 1 from public.quotes q where q.id=p_quote_id and q.project_id=v_invoice.project_id
  )) then raise exception 'Deposit relationship must identify a quote in the same project' using errcode='22023'; end if;
  if p_treatment='SEPARATE_CHARGE' and (v_invoice.invoice_kind <> 'QUOTE_LINKED' or exists (
    select 1 from public.commercial_current_accepted_quote_versions(v_invoice.project_id) c where c.quote_version_id=v_invoice.quote_version_id
  )) then raise exception 'Separate charge must be a historical quote-linked invoice' using errcode='22023'; end if;
  if p_treatment='SEPARATE_CHARGE' and exists(
    select 1 from public.project_payment_entries e join public.project_payment_allocations a on a.payment_entry_id=e.id
    where e.source_invoice_id=v_invoice.id and a.reversed_at is null and a.quote_version_id is distinct from v_invoice.quote_version_id
  ) then raise exception 'Reconcile explicit payment allocations before separating this charge' using errcode='55000'; end if;
  insert into public.commercial_invoice_scope_assignments(invoice_id,project_id,treatment,quote_id,revision,command_id,reason,actor)
    values(p_invoice_id,v_invoice.project_id,p_treatment,p_quote_id,p_expected_revision+1,p_command_id,trim(p_reason),trim(p_actor))
    on conflict(invoice_id) do update set treatment=excluded.treatment,quote_id=excluded.quote_id,revision=excluded.revision,
      command_id=excluded.command_id,reason=excluded.reason,actor=excluded.actor,updated_at=clock_timestamp()
    returning * into v_after;
  v_result:=jsonb_build_object('invoiceId',p_invoice_id,'revision',v_after.revision,'treatment',v_after.treatment,'quoteId',v_after.quote_id);
  insert into public.audit_events(project_id,type,idempotency_key,payload)
    values(v_invoice.project_id,'invoice.scope_reconciled','invoice.scope_reconciled:'||p_command_id::text,
      jsonb_build_object('request',v_request,'before',to_jsonb(v_before),'after',to_jsonb(v_after),'result',v_result));
  perform public.commercial_reopen_paid_project_if_unsettled(v_invoice.project_id,'invoice scope reconciled');
  return v_result;
end;
$$;

create or replace function public.commercial_project_value_breakdown(p_project_id uuid)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog, pg_temp as $$
declare v_quote integer; v_additional integer;
begin
  if coalesce(auth.role(),'') <> 'service_role' and not public.has_portal_access() then raise exception 'Staff access required' using errcode='42501'; end if;
  select coalesce(sum(c.total_inc_gst_cents),0)::integer into v_quote from public.commercial_current_accepted_quote_versions(p_project_id) c;
  v_additional:=public.commercial_project_additional_invoice_value(p_project_id);
  return jsonb_build_object('acceptedQuoteIncGstCents',v_quote,'standaloneIncGstCents',v_additional,'billableIncGstCents',v_quote+v_additional);
end;
$$;

-- Keep the deployed truth owner (including partial Xero receipts and retained
-- reader authority) and change only its additional-value interpretation.
do $patch$
declare d text; anchor text;
begin
  d:=replace(pg_get_functiondef('public.commercial_project_financial_truth(uuid)'::regprocedure),chr(13),'');
  anchor:='  select v_accepted + coalesce(sum(i.total_inc_gst_cents),0)::integer into v_accepted
  from public.deposit_invoices i where i.project_id = p_project_id
    and i.invoice_kind = ''STANDALONE'' and i.status in (''OPEN'',''PAID'');';
  anchor:=replace(anchor,chr(13),'');
  if strpos(d,anchor)=0 then raise exception 'Financial truth owner changed; review funding migration'; end if;
  execute replace(d,anchor,'  v_accepted := v_accepted + public.commercial_project_additional_invoice_value(p_project_id);');
end;
$patch$;


create or replace function public.commercial_accept_quote_invoice_command(
  p_quote_version_id uuid,
  p_actor text,
  p_allow_manual_billing boolean
)
returns table (
  quote_version_id uuid,
  invoice_id uuid,
  invoice_created boolean,
  already_accepted boolean
)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_version public.quote_versions%rowtype;
  v_quote public.quotes%rowtype;
  v_project public.projects%rowtype;
  v_invoice public.deposit_invoices%rowtype;
  v_first_term jsonb;
  v_term_id text;
  v_term_label text;
  v_term_calculation text;
  v_term_percentage numeric;
  v_term_count integer;
  v_invoice_created boolean := false;
  v_already_accepted boolean := false;
  v_issue_date date := current_date;
  v_invoice_inc integer;
  v_invoice_ex integer;
  v_gst integer;
  v_compat_percent numeric;
  v_billing_mode text;
  v_funding record;
begin
  perform pg_advisory_xact_lock(hashtextextended('commercial-accept:' || p_quote_version_id::text, 0));
  select version.* into strict v_version
  from public.quote_versions version where version.id = p_quote_version_id for update;

  if v_version.status = 'ACCEPTED' then
    v_already_accepted := true;
  elsif v_version.status <> 'SENT' then
    raise exception 'Only sent quotes can be accepted' using errcode = '55000';
  elsif v_version.expires_at is not null and v_version.expires_at < current_date then
    raise exception 'QUOTE_EXPIRED' using errcode = '55000';
  else
    update public.quote_versions set status = 'ACCEPTED',
      accepted_at = coalesce(accepted_at, now()), is_current_draft = false
    where id = p_quote_version_id returning * into v_version;
  end if;

  select * into strict v_quote from public.quotes where id = v_version.quote_id;
  select * into strict v_project from public.projects where id = v_quote.project_id;

  select b.billing_mode into v_billing_mode from private.commercial_quote_acceptance_billing b where b.quote_version_id=v_version.id;
  if found and v_billing_mode='manual' and not p_allow_manual_billing then
    raise exception 'This revised quote uses progress billing; refresh to the current application' using errcode='55000';
  end if;
  if not found then
    select * into strict v_funding from public.commercial_quote_scope_funding(v_version.id);
    v_billing_mode := case when p_allow_manual_billing and v_funding.paid_inc_gst_cents > 0
      then 'manual' else 'scheduled' end;
    insert into private.commercial_quote_acceptance_billing(quote_version_id,billing_mode,accepted_at)
      values(v_version.id,v_billing_mode,v_version.accepted_at);
  end if;

  -- A funded revision retains issued invoices, including partial provider receipts.
  if v_billing_mode='manual' then
    return query select v_version.id,null::uuid,false,v_already_accepted;
    return;
  end if;

  update public.deposit_invoices invoice set
    status = 'VOID', voided_at = coalesce(invoice.voided_at, now()),
    voided_by = p_actor,
    void_reason = coalesce(invoice.void_reason, 'Replaced after acceptance of quote version ' || v_version.version_number::text),
    portal_token_hash = null, portal_token_expires_at = null
  where invoice.quote_id = v_quote.id and invoice.quote_version_id <> v_version.id
    and invoice.status = 'OPEN';

  v_first_term := v_version.payment_terms->0;
  v_term_id := coalesce(nullif(trim(v_first_term->>'id'), ''), 'payment-1');
  v_term_label := coalesce(nullif(trim(v_first_term->>'label'), ''), 'Initial payment');
  v_term_calculation := coalesce(nullif(trim(v_first_term->>'calculationType'), ''), 'percentage');
  v_term_percentage := nullif(v_first_term->>'percentageOfRemainder', '')::numeric;
  v_term_count := jsonb_array_length(v_version.payment_terms);

  select invoice.* into v_invoice from public.deposit_invoices invoice
  where invoice.quote_version_id = v_version.id
    and invoice.payment_term_id = v_term_id and invoice.status <> 'VOID'
  order by invoice.created_at desc limit 1 for update;

  if not found then
    v_invoice_inc := (v_first_term->>'resolvedAmountIncGstCents')::integer;
    v_invoice_ex := round(v_invoice_inc / 1.15)::integer;
    v_gst := v_invoice_inc - v_invoice_ex;
    v_compat_percent := case when v_version.total_inc_gst_cents > 0
      then round(v_invoice_inc * 100.0 / v_version.total_inc_gst_cents, 2)
      else 0 end;

    insert into public.deposit_invoices (
      project_id, quote_id, quote_version_id, quote_ref, quote_version_number,
      invoice_ref, status, issue_date, due_date, reference, customer_name,
      project_name, project_address, currency, deposit_percent,
      quote_total_inc_gst_cents, total_inc_gst_cents, total_ex_gst_cents,
      gst_cents, payment_instructions, created_by, payment_term_id,
      payment_term_label, payment_term_position, payment_term_count,
      payment_term_calculation, payment_term_percentage
    ) values (
      v_project.id, v_quote.id, v_version.id, v_quote.quote_ref,
      v_version.version_number, public.next_deposit_invoice_ref(), 'OPEN',
      v_issue_date, v_issue_date + 7,
      v_term_label || ' for Quote ' || v_quote.quote_ref ||
        case when nullif(trim(v_project.name), '') is not null then ' - ' || trim(v_project.name) else '' end,
      v_version.customer_name, v_project.name, v_project.site_address, 'NZD',
      v_compat_percent, v_version.total_inc_gst_cents, v_invoice_inc,
      v_invoice_ex, v_gst,
      E'Please make payment directly to our bank account:\nSanctuary Pergolas Ltd.\nBank details: 06-0185-0845164-00\nPlease include invoice number',
      p_actor, v_term_id, v_term_label, 1, v_term_count,
      v_term_calculation, v_term_percentage
    ) returning * into v_invoice;
    v_invoice_created := true;
  end if;

  return query select v_version.id, v_invoice.id, v_invoice_created, v_already_accepted;
end;
$$;

create or replace function public.commercial_accept_quote_with_project_lock_v2(p_quote_version_id uuid,p_actor text)
returns table(quote_version_id uuid,invoice_id uuid,invoice_ref text,invoice_project_id uuid,invoice_quote_id uuid,
  invoice_quote_total_inc_gst_cents integer,invoice_created_at timestamptz,invoice_created boolean,already_accepted boolean)
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare v_project_id uuid; v_result record; v_invoice public.deposit_invoices%rowtype; v_truth record; v_version public.quote_versions%rowtype;
begin
  select q.project_id into strict v_project_id from public.quote_versions v join public.quotes q on q.id=v.quote_id where v.id=p_quote_version_id;
  perform pg_advisory_xact_lock(hashtextextended('commercial-project-invoice:'||v_project_id::text,0));
  select * into strict v_result from public.commercial_accept_quote_invoice_command(p_quote_version_id,p_actor,true);
  select * into strict v_version from public.quote_versions where id=p_quote_version_id;
  if not exists(select 1 from public.commercial_current_accepted_quote_versions(v_project_id) c where c.quote_version_id=p_quote_version_id) then
    raise exception 'Quote version is no longer the current accepted lifecycle version' using errcode='55000';
  end if;
  if v_result.invoice_id is not null then
    select * into strict v_invoice from public.deposit_invoices where id=v_result.invoice_id;
    if v_result.invoice_created then
      select * into strict v_truth from public.commercial_project_financial_truth(v_project_id);
      if v_invoice.total_inc_gst_cents > greatest(0,v_truth.accepted_total_inc_gst_cents-v_truth.paid_inc_gst_cents
        -greatest(0,v_truth.open_invoice_inc_gst_cents-v_invoice.total_inc_gst_cents)) then
        raise exception 'Quote acceptance invoice exceeds the remaining job balance' using errcode='55000';
      end if;
    end if;
  end if;
  insert into public.audit_events(project_id,type,idempotency_key,payload)
    values(v_project_id,'quote.accepted','quote.accepted:'||p_quote_version_id::text,
      jsonb_build_object('quoteVersionId',p_quote_version_id,'actor',p_actor,'billingMode',
        public.commercial_quote_acceptance_billing_mode(p_quote_version_id))) on conflict(idempotency_key) do nothing;
  return query select v_version.id,v_invoice.id,v_invoice.invoice_ref,v_project_id,v_version.quote_id,
    v_version.total_inc_gst_cents,(select b.accepted_at from private.commercial_quote_acceptance_billing b where b.quote_version_id=v_version.id),v_result.invoice_created,v_result.already_accepted;
end;
$$;

create or replace function public.commercial_quote_term_remaining(p_quote_version_id uuid,p_payment_term_id text)
returns integer language plpgsql stable security definer set search_path=pg_catalog,pg_temp as $$
declare v_term jsonb; v_allocated integer; v_carry integer; v_remaining integer; v_result integer;
begin
  select carried_paid_inc_gst_cents into strict v_carry from public.commercial_quote_scope_funding(p_quote_version_id);
  for v_term in select t from public.quote_versions v cross join lateral jsonb_array_elements(v.payment_terms) t where v.id=p_quote_version_id loop
    select coalesce(sum(a.amount_inc_gst_cents),0)::integer into v_allocated from public.project_payment_allocations a
      where a.quote_version_id=p_quote_version_id and a.payment_term_id=v_term->>'id' and a.reversed_at is null;
    v_remaining:=greatest(0,(v_term->>'resolvedAmountIncGstCents')::integer-v_allocated);
    v_result:=greatest(0,v_remaining-v_carry);
    v_carry:=greatest(0,v_carry-v_remaining);
    if v_term->>'id'=p_payment_term_id then return v_result; end if;
  end loop;
  raise exception 'Quote payment stage not found' using errcode='22023';
end;
$$;

-- Preserve the draft/issue owner and exact stage identity while applying the
-- carried deposit to frozen quote terms. New instalments already divide the
-- remaining amount, so they must not subtract historical funding again.
do $patch$
declare d text; anchor text;
begin
  d:=replace(pg_get_functiondef('public.commercial_create_admin_invoice(uuid,uuid,text,text,integer,integer,text,date,text,text,boolean,text,text)'::regprocedure),chr(13),'');
  anchor:='  select coalesce(sum(allocation.amount_inc_gst_cents), 0)::integer into v_paid
  from public.project_payment_allocations allocation
  where allocation.quote_version_id = v_version.id
    and allocation.reversed_at is null;
  select coalesce(sum(invoice.total_inc_gst_cents), 0)::integer into v_open
  from public.deposit_invoices invoice
  where invoice.quote_version_id = v_version.id and invoice.status = ''OPEN'';';
  anchor:=replace(anchor,chr(13),'');
  if strpos(d,anchor)=0 then raise exception 'Invoice issuance funding owner changed; review migration'; end if;
  d:=replace(d,anchor,'  select f.paid_inc_gst_cents,f.open_inc_gst_cents into strict v_paid,v_open
  from public.commercial_quote_scope_funding(v_version.id) f;');
  anchor:='    if v_amount <= 0 then raise exception ''This payment stage is already fully paid'' using errcode = ''55000''; end if;';
  if strpos(d,anchor)=0 then raise exception 'Invoice stage owner changed; review migration'; end if;
  d:=replace(d,anchor,'    if v_term is not null then v_amount:=public.commercial_quote_term_remaining(v_version.id,v_term_id); end if;
' || anchor);
  execute d;
end;
$patch$;

-- Keep the legacy invoice-guaranteed RPC compatible while the two applications
-- roll out independently. Both versions share the same canonical command.
create or replace function public.commercial_accept_quote_and_ensure_invoice(p_quote_version_id uuid,p_actor text)
returns table(quote_version_id uuid,invoice_id uuid,invoice_created boolean,already_accepted boolean)
language sql security definer set search_path=pg_catalog,pg_temp as $$
  select * from public.commercial_accept_quote_invoice_command(p_quote_version_id,p_actor,false);
$$;

-- All custom/split/remaining commands use the effective family funding, rather
-- than losing historical payments when the current version changes.
do $patch$
declare d text; anchor text;
begin
  d:=replace(pg_get_functiondef('public.commercial_create_admin_invoice_idempotent(uuid,uuid,text,text,integer,integer,text,date,text,text,boolean,text,text,text)'::regprocedure),chr(13),'');
  anchor:='  select coalesce(sum(allocation.amount_inc_gst_cents), 0)::integer into v_scope_paid
  from public.project_payment_allocations allocation
  where allocation.quote_version_id = p_quote_version_id and allocation.reversed_at is null;
  select coalesce(sum(invoice.total_inc_gst_cents), 0)::integer into v_scope_open
  from public.deposit_invoices invoice
  where invoice.quote_version_id = p_quote_version_id and invoice.status = ''OPEN'';';
  anchor:=replace(anchor,chr(13),'');
  if strpos(d,anchor)=0 then raise exception 'Invoice scope limit owner changed; review funding migration'; end if;
  execute replace(d,anchor,'  select f.paid_inc_gst_cents,f.open_inc_gst_cents into strict v_scope_paid,v_scope_open
  from public.commercial_quote_scope_funding(p_quote_version_id) f;');
end;
$patch$;

-- Restoration must use the reconciled economic relationship too: a top-up
-- remains within the existing quote cap, while a separate historical charge
-- remains its own issued work rather than reviving an obsolete quote version.
do $patch$
declare d text; anchor text;
begin
  d:=replace(pg_get_functiondef('public.commercial_restore_invoice(uuid,timestamptz,uuid,text,text)'::regprocedure),chr(13),'');
  anchor:='  if v_invoice.invoice_kind=''QUOTE_LINKED'' then';
  if strpos(d,anchor)=0 then raise exception 'Invoice restore scope owner changed; review migration'; end if;
  d:=replace(d,anchor,'  if exists(select 1 from public.commercial_invoice_scope_assignments a where a.invoice_id=v_invoice.id and a.treatment=''QUOTE_PAYMENT'') then
    select remaining_to_invoice_inc_gst_cents into v_available from public.commercial_project_financial_truth(v_project_id);
    select c.total_inc_gst_cents-f.paid_inc_gst_cents-f.open_inc_gst_cents into v_scope_available
      from public.commercial_current_accepted_quote_versions(v_project_id) c
      cross join lateral public.commercial_quote_scope_funding(c.quote_version_id) f
      where c.quote_id=public.commercial_invoice_effective_quote(v_invoice.id);
    if v_scope_available is null then raise exception ''The deposit has no current accepted quote; review the current scope before restoring'' using errcode=''55000''; end if;
    if v_invoice.total_inc_gst_cents-v_matched>least(v_available,v_scope_available) then
      raise exception ''Restoring would exceed the remaining agreed balance; review replacement invoices and payments first'' using errcode=''55000'';
    end if;
  end if;
  if v_invoice.invoice_kind=''QUOTE_LINKED'' and not exists(select 1 from public.commercial_invoice_scope_assignments a where a.invoice_id=v_invoice.id and a.treatment=''SEPARATE_CHARGE'') then');
  anchor:='    select q.total_inc_gst_cents
      -coalesce((select sum(a.amount_inc_gst_cents) from public.project_payment_allocations a where a.quote_version_id=q.id and a.reversed_at is null),0)
      -coalesce((select sum(greatest(0,i.total_inc_gst_cents-coalesce((select sum(m.amount_inc_gst_cents) from public.xero_deposit_matches m where m.invoice_id=i.id and m.reversed_at is null),0))) from public.deposit_invoices i where i.quote_version_id=q.id and i.status=''OPEN''),0)
      -v_matched into v_scope_available from public.quote_versions q where q.id=v_invoice.quote_version_id;';
  anchor:=replace(anchor,chr(13),'');
  if strpos(d,anchor)=0 then raise exception 'Invoice restore funding owner changed; review migration'; end if;
  d:=replace(d,anchor,'    select q.total_inc_gst_cents-f.paid_inc_gst_cents-f.open_inc_gst_cents into v_scope_available
      from public.quote_versions q cross join lateral public.commercial_quote_scope_funding(q.id) f where q.id=v_invoice.quote_version_id;');
  execute d;
end;
$patch$;

revoke all on function public.commercial_reconciled_allocation_guard() from public,anon,authenticated,service_role;
revoke all on function public.commercial_quote_term_remaining(uuid,text) from public,anon,authenticated,service_role;
revoke all on function public.commercial_invoice_scope_fingerprint(uuid) from public,anon,authenticated;
grant execute on function public.commercial_invoice_scope_fingerprint(uuid) to service_role;
revoke all on function public.commercial_invoice_effective_quote(uuid) from public,anon,authenticated,service_role;
revoke all on function public.commercial_project_additional_invoice_value(uuid) from public,anon,authenticated,service_role;
revoke all on function public.commercial_quote_scope_funding(uuid) from public,anon;
grant execute on function public.commercial_quote_scope_funding(uuid) to authenticated,service_role;
revoke all on function public.commercial_quote_acceptance_billing_mode(uuid) from public,anon,authenticated;
grant execute on function public.commercial_quote_acceptance_billing_mode(uuid) to service_role;
revoke all on function public.commercial_reconcile_invoice_scope(uuid,text,uuid,integer,text,integer,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.commercial_reconcile_invoice_scope(uuid,text,uuid,integer,text,integer,text,uuid,text,text) to service_role;
revoke all on function public.commercial_accept_quote_invoice_command(uuid,text,boolean) from public,anon,authenticated,service_role;
revoke all on function public.commercial_accept_quote_and_ensure_invoice(uuid,text) from public,anon,authenticated,service_role;
revoke all on function public.commercial_accept_quote_with_project_lock_v2(uuid,text) from public,anon,authenticated;
grant execute on function public.commercial_accept_quote_with_project_lock_v2(uuid,text) to service_role;
notify pgrst,'reload schema';
commit;
