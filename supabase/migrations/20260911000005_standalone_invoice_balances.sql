-- Extend the existing commercial ledger; drafts have no value or exposure.
begin;

create or replace function public.commercial_project_financial_truth(
  p_project_id uuid
)
returns table (
  accepted_total_inc_gst_cents integer,
  paid_inc_gst_cents integer,
  open_invoice_inc_gst_cents integer,
  remaining_to_invoice_inc_gst_cents integer,
  over_committed_inc_gst_cents integer,
  latest_payment_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_accepted integer;
  v_paid integer;
  v_open integer;
  v_latest_payment_at timestamptz;
begin
  if auth.role() <> 'service_role' and not public.has_portal_access() then
    raise exception 'staff access required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.projects project where project.id = p_project_id) then
    raise exception 'Project not found' using errcode = 'P0002';
  end if;

  select coalesce(sum(current_version.total_inc_gst_cents), 0)::integer
  into v_accepted
  from public.commercial_current_accepted_quote_versions(p_project_id) current_version;

  select coalesce(sum(entry.amount_inc_gst_cents), 0)::integer,
    max(entry.occurred_at)
  into v_paid, v_latest_payment_at
  from public.project_payment_entries entry
  where entry.project_id = p_project_id;

  select coalesce(sum(invoice.total_inc_gst_cents), 0)::integer
  into v_open
  from public.deposit_invoices invoice
  where invoice.project_id = p_project_id and invoice.status = 'OPEN';

  -- The existing total is the settlement denominator for legacy readers.
  -- New presentation uses commercial_project_value_breakdown for its components.
  select v_accepted + coalesce(sum(i.total_inc_gst_cents),0)::integer into v_accepted
  from public.deposit_invoices i where i.project_id = p_project_id
    and i.invoice_kind = 'STANDALONE' and i.status in ('OPEN','PAID');

  return query select
    v_accepted,
    v_paid,
    v_open,
    greatest(0, v_accepted - v_paid - v_open),
    greatest(0, v_paid + v_open - v_accepted),
    v_latest_payment_at;
end;
$$;

create or replace function public.commercial_mark_invoice_paid_and_record_payment(
  p_invoice_id uuid,
  p_actor text,
  p_paid_at timestamptz,
  p_reference text,
  p_method text,
  p_note text
)
returns table (invoice_id uuid, payment_entry_id uuid)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_invoice public.deposit_invoices%rowtype;
  v_payment public.project_payment_entries%rowtype;
  v_target_amount integer;
  v_allocated_amount integer;
  v_allocation_amount integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('commercial-payment-invoice:' || p_invoice_id::text, 0));
  select invoice.* into strict v_invoice
  from public.deposit_invoices invoice where invoice.id = p_invoice_id for update;
  perform pg_advisory_xact_lock(hashtextextended('commercial-project-invoice:' || v_invoice.project_id::text, 0));

  if v_invoice.status not in ('OPEN','PAID') then
    raise exception 'Only open invoices can be marked paid' using errcode = '55000';
  end if;

  if v_invoice.status = 'OPEN' then
    update public.deposit_invoices set
      status = 'PAID',
      paid_at = coalesce(p_paid_at, now()),
      paid_by = p_actor,
      payment_reference = nullif(trim(p_reference), ''),
      payment_method = nullif(trim(p_method), ''),
      payment_note = nullif(trim(p_note), '')
    where id = p_invoice_id
    returning * into v_invoice;
    insert into public.audit_events (project_id, type, idempotency_key, payload)
    values (
      v_invoice.project_id,
      'invoice.paid',
      'invoice.paid:' || v_invoice.id::text,
      jsonb_build_object('invoiceId', v_invoice.id, 'paidAt', v_invoice.paid_at, 'actor', p_actor)
    ) on conflict (idempotency_key) do nothing;
  end if;

  select entry.* into v_payment
  from public.project_payment_entries entry
  where entry.source_invoice_id = p_invoice_id and entry.entry_type = 'PAYMENT'
  for update;

  if not found then
    insert into public.project_payment_entries (
      project_id, source_invoice_id, entry_type, amount_inc_gst_cents,
      occurred_at, payment_method, reference, note, created_by
    ) values (
      v_invoice.project_id, v_invoice.id, 'PAYMENT', v_invoice.total_inc_gst_cents,
      coalesce(v_invoice.paid_at, p_paid_at, now()), v_invoice.payment_method,
      v_invoice.payment_reference, v_invoice.payment_note, p_actor
    ) returning * into v_payment;

    if v_invoice.invoice_kind = 'STANDALONE' then
      insert into public.project_payment_allocations (
        project_id,payment_entry_id,standalone_invoice_id,amount_inc_gst_cents,change_reason,created_by
      ) values (v_invoice.project_id,v_payment.id,v_invoice.id,v_invoice.total_inc_gst_cents,
        'Applied when standalone invoice was marked paid',p_actor);
      return query select v_invoice.id,v_payment.id;
      return;
    end if;

    perform pg_advisory_xact_lock(hashtextextended(
      'commercial-payment-target:' || v_invoice.quote_version_id::text || ':' || v_invoice.payment_term_id,
      0
    ));

    select coalesce(
      (
        select (term->>'resolvedAmountIncGstCents')::integer
        from public.quote_versions version,
          lateral jsonb_array_elements(version.payment_terms) term
        where version.id = v_invoice.quote_version_id
          and term->>'id' = v_invoice.payment_term_id
        limit 1
      ),
      (
        select plan.amount_inc_gst_cents from public.project_invoice_plan_items plan
        where plan.quote_version_id = v_invoice.quote_version_id
          and plan.payment_term_id = v_invoice.payment_term_id
          and plan.cancelled_at is null limit 1
      ),
      v_invoice.total_inc_gst_cents
    ) into v_target_amount;
    select coalesce(sum(allocation.amount_inc_gst_cents), 0)::integer into v_allocated_amount
    from public.project_payment_allocations allocation
    where allocation.quote_version_id = v_invoice.quote_version_id
      and allocation.payment_term_id = v_invoice.payment_term_id
      and allocation.reversed_at is null;
    v_allocation_amount := least(v_invoice.total_inc_gst_cents, greatest(0, v_target_amount - v_allocated_amount));
    if v_allocation_amount > 0 then
      insert into public.project_payment_allocations (
        project_id, payment_entry_id, quote_version_id, payment_term_id,
        amount_inc_gst_cents, change_reason, created_by
      ) values (
        v_invoice.project_id, v_payment.id, v_invoice.quote_version_id,
        v_invoice.payment_term_id, v_allocation_amount,
        'Applied when invoice was marked paid', p_actor
      );
    end if;
  end if;

  return query select v_invoice.id, v_payment.id;
end;
$$;

create or replace function public.commercial_guard_payment_allocation_update()
returns trigger
language plpgsql
set search_path = pg_catalog, pg_temp
as $$
begin
  if new.id is distinct from old.id
    or new.project_id is distinct from old.project_id
    or new.payment_entry_id is distinct from old.payment_entry_id
    or new.standalone_invoice_id is distinct from old.standalone_invoice_id
    or new.quote_version_id is distinct from old.quote_version_id
    or new.payment_term_id is distinct from old.payment_term_id
    or new.amount_inc_gst_cents is distinct from old.amount_inc_gst_cents
    or new.change_reason is distinct from old.change_reason
    or new.created_at is distinct from old.created_at
    or new.created_by is distinct from old.created_by then
    raise exception 'Payment allocations are immutable; reverse and replace them' using errcode = '55000';
  end if;
  if old.reversed_at is not null then
    raise exception 'A reversed payment allocation is immutable' using errcode = '55000';
  end if;
  if new.reversed_at is not null and (
    coalesce(length(trim(new.reversal_reason)), 0) < 3
    or nullif(trim(coalesce(new.reversed_by, '')), '') is null
  ) then
    raise exception 'Allocation reversal evidence is required' using errcode = '22023';
  end if;
  return new;
end;
$$;

create or replace function public.commercial_project_value_breakdown(p_project_id uuid)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog, pg_temp as $$
declare v_quote integer; v_standalone integer;
begin
  if auth.role() <> 'service_role' and not public.has_portal_access() then
    raise exception 'Staff access required' using errcode = '42501';
  end if;
  select coalesce(sum(c.total_inc_gst_cents),0)::integer into v_quote
    from public.commercial_current_accepted_quote_versions(p_project_id) c;
  select coalesce(sum(i.total_inc_gst_cents),0)::integer into v_standalone
    from public.deposit_invoices i where i.project_id = p_project_id
      and i.invoice_kind = 'STANDALONE' and i.status in ('OPEN','PAID');
  return jsonb_build_object('acceptedQuoteIncGstCents',v_quote,
    'standaloneIncGstCents',v_standalone,'billableIncGstCents',v_quote + v_standalone);
end;
$$;

create or replace function public.commercial_standalone_allocation_guard()
returns trigger language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
declare v_source public.deposit_invoices%rowtype; v_target public.deposit_invoices%rowtype;
begin
  select i.* into v_source from public.project_payment_entries e
    join public.deposit_invoices i on i.id = e.source_invoice_id where e.id = new.payment_entry_id;
  if v_source.invoice_kind = 'STANDALONE' and new.standalone_invoice_id is distinct from v_source.id then
    raise exception 'Standalone invoice payments cannot settle quoted scope' using errcode = '22023';
  end if;
  if new.standalone_invoice_id is not null then
    select * into strict v_target from public.deposit_invoices where id = new.standalone_invoice_id;
    if v_target.invoice_kind <> 'STANDALONE' or v_target.project_id <> new.project_id
      or v_target.status <> 'PAID' or v_source.id is distinct from v_target.id
      or new.amount_inc_gst_cents <> v_target.total_inc_gst_cents then
      raise exception 'Mark the whole standalone invoice paid using its payment command' using errcode = '55000';
    end if;
  end if;
  return new;
end;
$$;
create trigger project_payment_allocations_standalone_guard before insert on public.project_payment_allocations
for each row execute function public.commercial_standalone_allocation_guard();

-- Source-owned standalone allocations are corrected through payment reversal.
-- Releasing them as general credit would incorrectly settle quoted scope.
do $patch$
declare v_definition text; v_anchor text := '  select coalesce(sum(item.amount_inc_gst_cents), 0)::integer into v_requested_total';
begin
  v_definition := replace(pg_get_functiondef('public.commercial_replace_payment_allocations(uuid,jsonb,text,text)'::regprocedure),chr(13),'');
  if strpos(v_definition,v_anchor) = 0 then raise exception 'Payment allocation owner changed; review migration'; end if;
  v_definition := replace(v_definition,v_anchor,
    '  if exists (select 1 from public.deposit_invoices i where i.id = v_payment.source_invoice_id and i.invoice_kind = ''STANDALONE'') then
    raise exception ''Reverse the standalone invoice payment to correct its allocation'' using errcode = ''55000'';
  end if;

' || v_anchor);
  -- Draft stage metadata never makes an allocation target billable.
  v_definition := replace(v_definition,'invoice.status <> ''VOID''','invoice.status in (''OPEN'',''PAID'')');
  execute v_definition;
end;
$patch$;

revoke all on function public.commercial_project_value_breakdown(uuid) from public, anon;
grant execute on function public.commercial_project_value_breakdown(uuid) to authenticated, service_role;
revoke all on function public.commercial_standalone_allocation_guard() from public, anon, authenticated;
notify pgrst, 'reload schema';
commit;
