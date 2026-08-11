alter table public.estimates
  add column if not exists commercial_scope_id uuid;

alter table public.quotes
  add column if not exists commercial_scope_id uuid;

alter table public.quotes
  drop constraint if exists quotes_project_id_key;

create unique index if not exists quotes_one_base_family_per_project
  on public.quotes (project_id)
  where commercial_scope_id is null;

create unique index if not exists quotes_one_family_per_commercial_scope
  on public.quotes (project_id, commercial_scope_id)
  where commercial_scope_id is not null;

create index if not exists estimates_by_project_commercial_scope
  on public.estimates (project_id, commercial_scope_id, created_at desc);

comment on column public.estimates.commercial_scope_id is
  'Null for the original/base contract. A stable UUID groups estimate revisions for one independent project add-on.';

comment on column public.quotes.commercial_scope_id is
  'Null for the original/base quote family. A stable UUID links an add-on quote family to its estimate revisions.';

-- Invoice availability is quote-scoped. Job-level paid/open totals are still
-- aggregated by the read model, but one invoice can belong to only one
-- accepted base or add-on quote.
create or replace function public.commercial_create_admin_invoice(
  p_project_id uuid,
  p_quote_version_id uuid,
  p_mode text,
  p_payment_term_id text,
  p_amount_inc_gst_cents integer,
  p_split_count integer,
  p_label text,
  p_due_date date,
  p_reference text,
  p_payment_instructions text,
  p_allow_over_invoice boolean,
  p_override_reason text,
  p_actor text
)
returns table (
  invoice_id uuid,
  planned_item_count integer,
  remaining_before_inc_gst_cents integer,
  remaining_after_inc_gst_cents integer
)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_version public.quote_versions%rowtype;
  v_quote public.quotes%rowtype;
  v_project public.projects%rowtype;
  v_term jsonb;
  v_plan public.project_invoice_plan_items%rowtype;
  v_term_id text;
  v_label text;
  v_amount integer;
  v_paid integer;
  v_open integer;
  v_remaining integer;
  v_amount_ex integer;
  v_invoice_id uuid;
  v_plan_group_id uuid;
  v_plan_item_id uuid;
  v_plan_count integer := 0;
  v_position integer := 1;
  v_item_count integer := 1;
  v_split_base integer;
  v_split_remainder integer;
  v_piece integer;
  i integer;
begin
  if p_mode not in ('next_stage', 'full_remaining', 'custom', 'split') then
    raise exception 'Invoice creation mode is invalid' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_label, ''))) < 2 then
    raise exception 'Invoice label is required' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('commercial-project-invoice:' || p_project_id::text, 0));
  select version.* into strict v_version
  from public.quote_versions version where version.id = p_quote_version_id for update;
  if v_version.status <> 'ACCEPTED' then
    raise exception 'Only accepted quotes can be invoiced' using errcode = '55000';
  end if;
  select quote.* into strict v_quote from public.quotes quote where quote.id = v_version.quote_id;
  if v_quote.project_id <> p_project_id then
    raise exception 'Quote does not belong to this project' using errcode = '22023';
  end if;
  select project.* into strict v_project from public.projects project where project.id = p_project_id;

  select coalesce(sum(allocation.amount_inc_gst_cents), 0)::integer into v_paid
  from public.project_payment_allocations allocation
  where allocation.quote_version_id = v_version.id
    and allocation.reversed_at is null;
  select coalesce(sum(invoice.total_inc_gst_cents), 0)::integer into v_open
  from public.deposit_invoices invoice
  where invoice.quote_version_id = v_version.id and invoice.status = 'OPEN';
  v_remaining := greatest(0, v_version.total_inc_gst_cents - v_paid - v_open);

  if p_mode = 'next_stage' then
    if nullif(trim(coalesce(p_payment_term_id, '')), '') is null then
      raise exception 'Payment stage is required' using errcode = '22023';
    end if;
    v_term_id := trim(p_payment_term_id);
    perform pg_advisory_xact_lock(hashtextextended(
      'commercial-payment-target:' || v_version.id::text || ':' || v_term_id,
      0
    ));
    select term into v_term
    from jsonb_array_elements(v_version.payment_terms) term
    where term->>'id' = v_term_id limit 1;
    if v_term is not null then
      v_label := coalesce(nullif(trim(p_label), ''), v_term->>'label');
      v_amount := (v_term->>'resolvedAmountIncGstCents')::integer;
      select ordinality::integer into v_position
      from jsonb_array_elements(v_version.payment_terms) with ordinality item(term, ordinality)
      where item.term->>'id' = v_term_id;
      v_item_count := jsonb_array_length(v_version.payment_terms);
    else
      select plan.* into v_plan
      from public.project_invoice_plan_items plan
      where plan.quote_version_id = v_version.id
        and plan.payment_term_id = v_term_id and plan.cancelled_at is null
      for update;
      if not found then raise exception 'Payment stage was not found' using errcode = '22023'; end if;
      v_label := coalesce(nullif(trim(p_label), ''), v_plan.label);
      v_amount := v_plan.amount_inc_gst_cents;
      v_position := v_plan.position;
      v_item_count := v_plan.item_count;
      v_plan_item_id := v_plan.id;
    end if;
    select v_amount - coalesce(sum(allocation.amount_inc_gst_cents), 0)::integer into v_amount
    from public.project_payment_allocations allocation
    where allocation.quote_version_id = v_version.id
      and allocation.payment_term_id = v_term_id
      and allocation.reversed_at is null;
    if v_amount <= 0 then raise exception 'This payment stage is already fully paid' using errcode = '55000'; end if;
    if exists (
      select 1 from public.deposit_invoices invoice
      where invoice.quote_version_id = v_version.id
        and invoice.payment_term_id = v_term_id and invoice.status <> 'VOID'
    ) then raise exception 'An active invoice already exists for this payment stage' using errcode = '55000'; end if;
  elsif p_mode = 'full_remaining' then
    v_term_id := 'admin-' || gen_random_uuid()::text;
    v_label := trim(p_label);
    v_amount := v_remaining;
  elsif p_mode = 'custom' then
    v_term_id := 'admin-' || gen_random_uuid()::text;
    v_label := trim(p_label);
    v_amount := p_amount_inc_gst_cents;
  else
    if p_split_count is null or p_split_count not between 2 and 10 then
      raise exception 'Split count must be between 2 and 10' using errcode = '22023';
    end if;
    if v_remaining <= 0 then raise exception 'There is no remaining quote balance to split' using errcode = '55000'; end if;
    if exists (
      select 1 from public.project_invoice_plan_items plan
      where plan.quote_version_id = v_version.id and plan.cancelled_at is null
    ) then raise exception 'An active installment plan already exists' using errcode = '55000'; end if;
    v_plan_group_id := gen_random_uuid();
    v_split_base := v_remaining / p_split_count;
    v_split_remainder := v_remaining - (v_split_base * p_split_count);
    for i in 1..p_split_count loop
      v_piece := v_split_base + case when i = p_split_count then v_split_remainder else 0 end;
      insert into public.project_invoice_plan_items (
        project_id, quote_version_id, plan_group_id, payment_term_id,
        label, position, item_count, amount_inc_gst_cents, created_by
      ) values (
        p_project_id, v_version.id, v_plan_group_id,
        'plan-' || gen_random_uuid()::text,
        case when i = 1 then trim(p_label) else 'Instalment ' || i::text end,
        i, p_split_count, v_piece, p_actor
      ) returning id, payment_term_id into v_plan_item_id, v_term_id;
      if i = 1 then
        v_amount := v_piece;
        v_label := trim(p_label);
        v_position := 1;
        v_item_count := p_split_count;
      end if;
      v_plan_count := v_plan_count + 1;
    end loop;
    select plan.id, plan.payment_term_id into v_plan_item_id, v_term_id
    from public.project_invoice_plan_items plan
    where plan.plan_group_id = v_plan_group_id and plan.position = 1;
  end if;

  if v_amount is null or v_amount <= 0 then
    raise exception 'Invoice amount must be greater than zero' using errcode = '22023';
  end if;
  if v_amount > v_remaining and not coalesce(p_allow_over_invoice, false) then
    raise exception 'Invoice amount exceeds the remaining quote balance' using errcode = '55000';
  end if;
  if v_amount > v_remaining and length(trim(coalesce(p_override_reason, ''))) < 3 then
    raise exception 'An over-invoice override reason is required' using errcode = '22023';
  end if;

  v_amount_ex := round(v_amount / 1.15)::integer;
  insert into public.deposit_invoices (
    project_id, quote_id, quote_version_id, quote_ref, quote_version_number,
    invoice_ref, status, issue_date, due_date, reference, customer_name,
    project_name, project_address, currency, deposit_percent,
    quote_total_inc_gst_cents, total_inc_gst_cents, total_ex_gst_cents,
    gst_cents, payment_instructions, created_by, payment_term_id,
    payment_term_label, payment_term_position, payment_term_count,
    payment_term_calculation, payment_term_percentage, creation_mode,
    creation_override_reason, invoice_plan_item_id
  ) values (
    p_project_id, v_quote.id, v_version.id, v_quote.quote_ref,
    v_version.version_number, public.next_deposit_invoice_ref(), 'OPEN',
    current_date, coalesce(p_due_date, current_date + 7),
    coalesce(nullif(trim(p_reference), ''), v_label || ' for Quote ' || v_quote.quote_ref),
    v_version.customer_name, v_project.name, v_project.site_address, 'NZD',
    round(v_amount * 100.0 / greatest(v_version.total_inc_gst_cents, 1), 2),
    v_version.total_inc_gst_cents, v_amount, v_amount_ex, v_amount - v_amount_ex,
    p_payment_instructions, p_actor, v_term_id, v_label, v_position,
    v_item_count, 'fixed', null, p_mode,
    case when v_amount > v_remaining then trim(p_override_reason) else null end,
    v_plan_item_id
  ) returning id into v_invoice_id;

  insert into public.audit_events (project_id, type, idempotency_key, payload)
  values (
    p_project_id,
    'invoice.created',
    'invoice.created:' || v_invoice_id::text,
    jsonb_build_object(
      'invoiceId', v_invoice_id,
      'quoteVersionId', v_version.id,
      'mode', p_mode,
      'amountIncGstCents', v_amount,
      'overInvoiceOverride', v_amount > v_remaining,
      'overrideReason', case when v_amount > v_remaining then trim(p_override_reason) else null end,
      'actor', p_actor
    )
  ) on conflict (idempotency_key) do nothing;

  if v_plan_item_id is not null then
    update public.project_invoice_plan_items set invoice_id = v_invoice_id
    where id = v_plan_item_id;
  end if;

  return query select v_invoice_id, v_plan_count, v_remaining,
    greatest(0, v_remaining - v_amount);
end;
$$;

revoke all on function public.commercial_create_admin_invoice(
  uuid, uuid, text, text, integer, integer, text, date, text, text, boolean, text, text
) from public, anon, authenticated;
grant execute on function public.commercial_create_admin_invoice(
  uuid, uuid, text, text, integer, integer, text, date, text, text, boolean, text, text
) to service_role;

notify pgrst, 'reload schema';
