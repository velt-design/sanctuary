-- Extend the existing quote billing owner to issue an existing draft row.
-- The legacy insertion path remains for automatic quote acceptance.
begin;

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
  v_draft_id uuid := nullif(current_setting('sanctuary.invoice_draft_id', true), '')::uuid;
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
        and invoice.payment_term_id = v_term_id and invoice.status in ('OPEN','PAID')
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
  if v_draft_id is not null then
    update public.deposit_invoices set
      invoice_ref = public.next_deposit_invoice_ref(), status = 'OPEN', issue_date = current_date,
      payment_term_id = v_term_id, payment_term_label = v_label,
      payment_term_position = v_position, payment_term_count = v_item_count,
      payment_term_calculation = 'fixed', payment_term_percentage = null,
      total_inc_gst_cents = v_amount, total_ex_gst_cents = v_amount_ex, gst_cents = v_amount - v_amount_ex,
      deposit_percent = round(v_amount * 100.0 / greatest(v_version.total_inc_gst_cents, 1), 2),
      payment_instructions = p_payment_instructions, creation_mode = p_mode,
      creation_override_reason = case when v_amount > v_remaining then trim(p_override_reason) else null end,
      invoice_plan_item_id = v_plan_item_id
    where id = v_draft_id and project_id = p_project_id and quote_version_id = p_quote_version_id and status = 'DRAFT'
    returning id into v_invoice_id;
    if not found then raise exception 'Draft is no longer available for issue' using errcode = '40001'; end if;
  else
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
  end if;

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

create or replace function public.commercial_invoice_issue_draft(
  p_invoice_id uuid, p_expected_revision bigint, p_command_id uuid, p_payment_instructions text
) returns public.deposit_invoices language plpgsql security definer
set search_path = pg_catalog, pg_temp as $$
declare
  v_invoice public.deposit_invoices%rowtype; v_options jsonb; v_total integer;
  v_previous text := current_setting('sanctuary.invoice_draft_id', true);
begin
  if auth.uid() is null or not public.has_portal_access() or not public.is_portal_admin() then
    raise exception 'Admin authentication is required' using errcode = '42501';
  end if;
  if p_command_id is null or p_expected_revision is null then
    raise exception 'Issue command and expected revision are required' using errcode = '22023';
  end if;
  select * into strict v_invoice from public.deposit_invoices where id = p_invoice_id;
  perform pg_advisory_xact_lock(hashtextextended('commercial-project-invoice:' || v_invoice.project_id::text, 0));
  select * into strict v_invoice from public.deposit_invoices where id = p_invoice_id for update;
  if v_invoice.issue_command_id = p_command_id and v_invoice.issued_from_revision = p_expected_revision then
    return v_invoice;
  end if;
  if v_invoice.status <> 'DRAFT' or v_invoice.draft_revision <> p_expected_revision then
    raise exception 'Draft changed; reload before issuing' using errcode = '40001';
  end if;
  if exists (select 1 from public.projects where id = v_invoice.project_id and archived_at is not null)
    or exists (select 1 from public.project_operational_states where project_id = v_invoice.project_id and state = 'CLOSED') then
    raise exception 'Reopen or restore the project before issuing an invoice' using errcode = '55000';
  end if;
  v_total := public.commercial_invoice_validate_content(v_invoice.invoice_kind, v_invoice.content_snapshot,
    case when v_invoice.invoice_kind = 'QUOTE_LINKED' then public.commercial_invoice_quote_items(v_invoice.quote_version_id) else null end);
  v_options := v_invoice.draft_options;
  perform set_config('sanctuary.invoice_draft_id',p_invoice_id::text,true);
  if v_invoice.invoice_kind = 'QUOTE_LINKED' then
    perform public.commercial_create_admin_invoice_idempotent(
      v_invoice.project_id,v_invoice.quote_version_id,v_options->>'mode',v_options->>'paymentTermId',
      (v_options->>'amountIncGstCents')::integer,(v_options->>'splitCount')::integer,
      v_options->>'label',v_invoice.due_date,v_invoice.reference,p_payment_instructions,
      coalesce((v_options->>'allowOverInvoice')::boolean,false),v_options->>'overrideReason',
      auth.uid()::text,p_command_id::text
    );
  else
    update public.deposit_invoices set status = 'OPEN', invoice_ref = public.next_deposit_invoice_ref(),
      issue_date = current_date, total_inc_gst_cents = v_total,
      total_ex_gst_cents = round(v_total / 1.15)::integer, gst_cents = v_total - round(v_total / 1.15)::integer,
      payment_instructions = p_payment_instructions, payment_term_label = v_options->>'label'
    where id = p_invoice_id;
  end if;
  update public.deposit_invoices set issue_command_id = p_command_id,
    issued_from_revision = p_expected_revision, draft_revision = draft_revision + 1,
    draft_options = null where id = p_invoice_id returning * into v_invoice;
  insert into public.audit_events(project_id,type,idempotency_key,payload) values (
    v_invoice.project_id,'invoice.issued','invoice.issued:' || p_invoice_id::text,
    jsonb_build_object('invoiceId',p_invoice_id,'commandId',p_command_id,'revision',p_expected_revision,
      'kind',v_invoice.invoice_kind,'amountIncGstCents',v_invoice.total_inc_gst_cents,'actor',auth.uid()));
  perform set_config('sanctuary.invoice_draft_id',coalesce(v_previous,''),true);
  return v_invoice;
end;
$$;

-- Freeze the customer content before the first issued write, including automatic
-- invoices. Never reconstruct an historical invoice that has no snapshot.
create or replace function public.commercial_invoice_content_guard()
returns trigger language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
begin
  if tg_op = 'UPDATE' and old.status <> 'DRAFT' then
    if new.invoice_kind is distinct from old.invoice_kind
      or new.project_id is distinct from old.project_id or new.currency is distinct from old.currency
      or new.quote_ref is distinct from old.quote_ref or new.quote_version_number is distinct from old.quote_version_number
      or new.quote_id is distinct from old.quote_id or new.quote_version_id is distinct from old.quote_version_id
      or new.content_snapshot is distinct from old.content_snapshot
      or new.invoice_ref is distinct from old.invoice_ref or new.customer_name is distinct from old.customer_name
      or new.project_name is distinct from old.project_name or new.project_address is distinct from old.project_address
      or new.reference is distinct from old.reference or new.due_date is distinct from old.due_date
      or new.issue_date is distinct from old.issue_date or new.total_inc_gst_cents is distinct from old.total_inc_gst_cents
      or new.total_ex_gst_cents is distinct from old.total_ex_gst_cents or new.gst_cents is distinct from old.gst_cents
      or new.quote_total_inc_gst_cents is distinct from old.quote_total_inc_gst_cents
      or new.payment_instructions is distinct from old.payment_instructions or new.status = 'DRAFT' then
      raise exception 'Issued invoice content is immutable; void and recreate' using errcode = '55000';
    end if;
    if old.created_at <> transaction_timestamp()
      and nullif(current_setting('sanctuary.invoice_draft_id',true),'')::uuid is distinct from new.id
      and (new.payment_term_label is distinct from old.payment_term_label or new.payment_term_id is distinct from old.payment_term_id
        or new.payment_term_calculation is distinct from old.payment_term_calculation or new.payment_term_percentage is distinct from old.payment_term_percentage
        or new.payment_term_position is distinct from old.payment_term_position or new.payment_term_count is distinct from old.payment_term_count
        or new.deposit_percent is distinct from old.deposit_percent) then
      raise exception 'Issued invoice payment content is immutable; void and recreate' using errcode = '55000';
    end if;
  elsif tg_op = 'UPDATE' and new.status <> 'DRAFT' then
    if new.status <> 'OPEN' or nullif(current_setting('sanctuary.invoice_draft_id',true),'')::uuid is distinct from new.id then
      raise exception 'Use the invoice issue command' using errcode = '42501';
    end if;
  elsif tg_op = 'INSERT' and new.status <> 'DRAFT' and new.content_snapshot is null then
    new.content_snapshot := jsonb_build_object('version',1,
      'items',public.commercial_invoice_quote_items(new.quote_version_id),
      'billingName',coalesce(new.customer_name,''),'billingEmail','','billingAddress','','notes','');
  end if;
  return new;
end;
$$;
create trigger deposit_invoices_content_guard before insert or update on public.deposit_invoices
for each row execute function public.commercial_invoice_content_guard();

revoke all on function public.commercial_invoice_issue_draft(uuid,bigint,uuid,text) from public, anon;
grant execute on function public.commercial_invoice_issue_draft(uuid,bigint,uuid,text) to authenticated;
revoke all on function public.commercial_invoice_content_guard() from public, anon, authenticated;
notify pgrst, 'reload schema';
commit;
