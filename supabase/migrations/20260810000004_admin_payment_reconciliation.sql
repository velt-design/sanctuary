create table if not exists public.project_payment_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  source_invoice_id uuid references public.deposit_invoices(id) on delete restrict,
  entry_type text not null check (entry_type in ('PAYMENT', 'ADJUSTMENT', 'REVERSAL')),
  amount_inc_gst_cents integer not null check (amount_inc_gst_cents <> 0),
  occurred_at timestamptz not null,
  payment_method text,
  reference text,
  note text,
  reason text,
  reverses_entry_id uuid references public.project_payment_entries(id) on delete restrict,
  created_at timestamptz not null default now(),
  created_by text,
  constraint project_payment_entries_shape_check check (
    (entry_type = 'PAYMENT' and amount_inc_gst_cents > 0 and reverses_entry_id is null)
    or (entry_type = 'ADJUSTMENT' and reverses_entry_id is null and coalesce(length(trim(reason)), 0) >= 3)
    or (entry_type = 'REVERSAL' and reverses_entry_id is not null and coalesce(length(trim(reason)), 0) >= 3)
  )
);

create unique index if not exists project_payment_entries_source_invoice_unique
  on public.project_payment_entries (source_invoice_id)
  where source_invoice_id is not null and entry_type = 'PAYMENT';
create unique index if not exists project_payment_entries_reversal_unique
  on public.project_payment_entries (reverses_entry_id)
  where reverses_entry_id is not null;
create index if not exists project_payment_entries_project_occurred_idx
  on public.project_payment_entries (project_id, occurred_at desc, created_at desc);

create table if not exists public.project_invoice_plan_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  quote_version_id uuid not null references public.quote_versions(id) on delete restrict,
  plan_group_id uuid not null,
  payment_term_id text not null,
  label text not null,
  position integer not null check (position >= 1),
  item_count integer not null check (item_count >= position),
  amount_inc_gst_cents integer not null check (amount_inc_gst_cents > 0),
  invoice_id uuid references public.deposit_invoices(id) on delete restrict,
  created_at timestamptz not null default now(),
  created_by text,
  cancelled_at timestamptz,
  cancelled_by text,
  cancellation_reason text,
  unique (quote_version_id, payment_term_id)
);

create index if not exists project_invoice_plan_items_quote_idx
  on public.project_invoice_plan_items (quote_version_id, created_at, position)
  where cancelled_at is null;

create table if not exists public.project_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  payment_entry_id uuid not null references public.project_payment_entries(id) on delete restrict,
  quote_version_id uuid not null references public.quote_versions(id) on delete restrict,
  payment_term_id text not null,
  amount_inc_gst_cents integer not null check (amount_inc_gst_cents > 0),
  change_reason text not null check (length(trim(change_reason)) >= 3),
  created_at timestamptz not null default now(),
  created_by text,
  reversed_at timestamptz,
  reversed_by text,
  reversal_reason text
);

create unique index if not exists project_payment_allocations_active_target_unique
  on public.project_payment_allocations (payment_entry_id, quote_version_id, payment_term_id)
  where reversed_at is null;
create index if not exists project_payment_allocations_project_idx
  on public.project_payment_allocations (project_id, created_at desc);
create index if not exists project_payment_allocations_target_idx
  on public.project_payment_allocations (quote_version_id, payment_term_id)
  where reversed_at is null;

alter table public.deposit_invoices
  add column if not exists creation_mode text not null default 'scheduled',
  add column if not exists creation_override_reason text,
  add column if not exists invoice_plan_item_id uuid references public.project_invoice_plan_items(id) on delete restrict;

alter table public.deposit_invoices
  drop constraint if exists deposit_invoices_creation_mode_check;
alter table public.deposit_invoices
  add constraint deposit_invoices_creation_mode_check
  check (creation_mode in ('scheduled', 'next_stage', 'full_remaining', 'custom', 'split'));

drop index if exists public.deposit_invoices_plan_item_unique;
create unique index deposit_invoices_plan_item_unique
  on public.deposit_invoices (invoice_plan_item_id)
  where invoice_plan_item_id is not null and status <> 'VOID';

create or replace function public.commercial_audit_payment_entry()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  insert into public.audit_events (project_id, type, idempotency_key, payload)
  values (
    new.project_id,
    case new.entry_type
      when 'PAYMENT' then 'payment.recorded'
      when 'ADJUSTMENT' then 'payment.adjusted'
      else 'payment.reversed'
    end,
    'project_payment_entry:' || new.id::text,
    jsonb_build_object(
      'paymentEntryId', new.id,
      'sourceInvoiceId', new.source_invoice_id,
      'amountIncGstCents', new.amount_inc_gst_cents,
      'reason', new.reason,
      'actor', new.created_by
    )
  ) on conflict (idempotency_key) do nothing;
  return new;
end;
$$;

drop trigger if exists project_payment_entries_audit_insert on public.project_payment_entries;
create trigger project_payment_entries_audit_insert
after insert on public.project_payment_entries
for each row execute function public.commercial_audit_payment_entry();

create or replace function public.commercial_audit_payment_allocation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_events (project_id, type, idempotency_key, payload)
    values (
      new.project_id,
      'payment.allocation_created',
      'project_payment_allocation:' || new.id::text,
      jsonb_build_object(
        'allocationId', new.id,
        'paymentEntryId', new.payment_entry_id,
        'quoteVersionId', new.quote_version_id,
        'paymentTermId', new.payment_term_id,
        'amountIncGstCents', new.amount_inc_gst_cents,
        'reason', new.change_reason,
        'actor', new.created_by
      )
    ) on conflict (idempotency_key) do nothing;
  elsif old.reversed_at is null and new.reversed_at is not null then
    insert into public.audit_events (project_id, type, idempotency_key, payload)
    values (
      new.project_id,
      'payment.allocation_reversed',
      'project_payment_allocation_reversed:' || new.id::text,
      jsonb_build_object(
        'allocationId', new.id,
        'paymentEntryId', new.payment_entry_id,
        'reason', new.reversal_reason,
        'actor', new.reversed_by
      )
    ) on conflict (idempotency_key) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists project_payment_allocations_audit_write on public.project_payment_allocations;
create trigger project_payment_allocations_audit_write
after insert or update of reversed_at on public.project_payment_allocations
for each row execute function public.commercial_audit_payment_allocation();

create or replace function public.commercial_guard_payment_allocation_update()
returns trigger
language plpgsql
set search_path = pg_catalog, pg_temp
as $$
begin
  if new.id is distinct from old.id
    or new.project_id is distinct from old.project_id
    or new.payment_entry_id is distinct from old.payment_entry_id
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

drop trigger if exists project_payment_allocations_guard_update on public.project_payment_allocations;
create trigger project_payment_allocations_guard_update
before update on public.project_payment_allocations
for each row execute function public.commercial_guard_payment_allocation_update();

insert into public.project_payment_entries (
  project_id,
  source_invoice_id,
  entry_type,
  amount_inc_gst_cents,
  occurred_at,
  payment_method,
  reference,
  note,
  created_by
)
select
  invoice.project_id,
  invoice.id,
  'PAYMENT',
  invoice.total_inc_gst_cents,
  coalesce(invoice.paid_at, invoice.updated_at, invoice.created_at),
  invoice.payment_method,
  invoice.payment_reference,
  invoice.payment_note,
  invoice.paid_by
from public.deposit_invoices invoice
where invoice.status = 'PAID'
on conflict (source_invoice_id) where source_invoice_id is not null and entry_type = 'PAYMENT'
do nothing;

create or replace function public.commercial_record_project_payment_entry(
  p_project_id uuid,
  p_entry_type text,
  p_amount_inc_gst_cents integer,
  p_occurred_at timestamptz,
  p_payment_method text,
  p_reference text,
  p_note text,
  p_reason text,
  p_actor text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_id uuid;
  v_net_paid integer;
  v_allocated integer;
begin
  if p_entry_type not in ('PAYMENT', 'ADJUSTMENT') then
    raise exception 'Payment type is invalid' using errcode = '22023';
  end if;
  if p_amount_inc_gst_cents is null or p_amount_inc_gst_cents = 0
    or (p_entry_type = 'PAYMENT' and p_amount_inc_gst_cents < 0) then
    raise exception 'Payment amount is invalid' using errcode = '22023';
  end if;
  if p_entry_type = 'ADJUSTMENT' and length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'An adjustment reason is required' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('commercial-project-invoice:' || p_project_id::text, 0));
  select coalesce(sum(entry.amount_inc_gst_cents), 0)::integer into v_net_paid
  from public.project_payment_entries entry where entry.project_id = p_project_id;
  select coalesce(sum(allocation.amount_inc_gst_cents), 0)::integer into v_allocated
  from public.project_payment_allocations allocation
  where allocation.project_id = p_project_id and allocation.reversed_at is null;
  if v_net_paid + p_amount_inc_gst_cents < 0 then
    raise exception 'An adjustment cannot make the job paid balance negative' using errcode = '22023';
  end if;
  if v_net_paid + p_amount_inc_gst_cents < v_allocated then
    raise exception 'Reduce payment allocations before lowering the job paid balance' using errcode = '55000';
  end if;
  insert into public.project_payment_entries (
    project_id, entry_type, amount_inc_gst_cents, occurred_at,
    payment_method, reference, note, reason, created_by
  ) values (
    p_project_id, p_entry_type, p_amount_inc_gst_cents, coalesce(p_occurred_at, now()),
    nullif(trim(p_payment_method), ''), nullif(trim(p_reference), ''),
    nullif(trim(p_note), ''), nullif(trim(p_reason), ''), p_actor
  ) returning id into v_id;
  return v_id;
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

  if v_invoice.status = 'VOID' then
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

create or replace function public.commercial_replace_payment_allocations(
  p_payment_entry_id uuid,
  p_allocations jsonb,
  p_reason text,
  p_actor text
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_payment public.project_payment_entries%rowtype;
  v_requested_total integer;
  v_allocation record;
  v_target_amount integer;
  v_existing_other integer;
  v_count integer := 0;
begin
  if jsonb_typeof(coalesce(p_allocations, '[]'::jsonb)) <> 'array' then
    raise exception 'Payment allocations must be an array' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'An allocation reason is required' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('commercial-payment-entry:' || p_payment_entry_id::text, 0));
  select entry.* into strict v_payment
  from public.project_payment_entries entry where entry.id = p_payment_entry_id for update;

  if v_payment.amount_inc_gst_cents <= 0 or v_payment.entry_type = 'REVERSAL' then
    raise exception 'Only positive payment entries can be allocated' using errcode = '55000';
  end if;
  if exists (select 1 from public.project_payment_entries reversal where reversal.reverses_entry_id = v_payment.id) then
    raise exception 'Reversed payment entries cannot be allocated' using errcode = '55000';
  end if;

  select coalesce(sum(item.amount_inc_gst_cents), 0)::integer into v_requested_total
  from jsonb_to_recordset(coalesce(p_allocations, '[]'::jsonb))
    as item(quote_version_id uuid, payment_term_id text, amount_inc_gst_cents integer);
  if v_requested_total > v_payment.amount_inc_gst_cents then
    raise exception 'Allocations exceed the payment amount' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_allocations, '[]'::jsonb))
      as item(quote_version_id uuid, payment_term_id text, amount_inc_gst_cents integer)
    where item.amount_inc_gst_cents <= 0 or nullif(trim(item.payment_term_id), '') is null
  ) then
    raise exception 'Allocation amounts and stages are required' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_allocations, '[]'::jsonb))
      as item(quote_version_id uuid, payment_term_id text, amount_inc_gst_cents integer)
    group by item.quote_version_id, item.payment_term_id
    having count(*) > 1
  ) then
    raise exception 'Each payment stage may appear only once' using errcode = '22023';
  end if;

  for v_allocation in
    select * from jsonb_to_recordset(coalesce(p_allocations, '[]'::jsonb))
      as item(quote_version_id uuid, payment_term_id text, amount_inc_gst_cents integer)
  loop
    perform pg_advisory_xact_lock(hashtextextended(
      'commercial-payment-target:' || v_allocation.quote_version_id::text || ':' || v_allocation.payment_term_id,
      0
    ));
    if not exists (
      select 1 from public.quote_versions version
      join public.quotes quote on quote.id = version.quote_id
      where version.id = v_allocation.quote_version_id
        and quote.project_id = v_payment.project_id
    ) then
      raise exception 'Payment stage does not belong to this project' using errcode = '22023';
    end if;

    select coalesce(
      (
        select (term->>'resolvedAmountIncGstCents')::integer
        from public.quote_versions version,
          lateral jsonb_array_elements(version.payment_terms) term
        where version.id = v_allocation.quote_version_id
          and term->>'id' = v_allocation.payment_term_id
        limit 1
      ),
      (
        select plan.amount_inc_gst_cents
        from public.project_invoice_plan_items plan
        where plan.quote_version_id = v_allocation.quote_version_id
          and plan.payment_term_id = v_allocation.payment_term_id
          and plan.cancelled_at is null
        limit 1
      ),
      (
        select invoice.total_inc_gst_cents
        from public.deposit_invoices invoice
        where invoice.quote_version_id = v_allocation.quote_version_id
          and invoice.payment_term_id = v_allocation.payment_term_id
          and invoice.status <> 'VOID'
        order by invoice.created_at desc
        limit 1
      )
    ) into v_target_amount;
    if v_target_amount is null then
      raise exception 'Payment stage was not found' using errcode = '22023';
    end if;
    if exists (
      select 1 from public.project_invoice_plan_items plan
      where plan.quote_version_id = v_allocation.quote_version_id
        and plan.payment_term_id = v_allocation.payment_term_id
        and plan.cancelled_at is null
        and v_payment.created_at <= plan.created_at
    ) then
      raise exception 'This payment was already included when the installment plan was created' using errcode = '55000';
    end if;

    select coalesce(sum(allocation.amount_inc_gst_cents), 0)::integer into v_existing_other
    from public.project_payment_allocations allocation
    where allocation.quote_version_id = v_allocation.quote_version_id
      and allocation.payment_term_id = v_allocation.payment_term_id
      and allocation.payment_entry_id <> v_payment.id
      and allocation.reversed_at is null;
    if v_existing_other + v_allocation.amount_inc_gst_cents > v_target_amount then
      raise exception 'Allocation exceeds the payment stage amount' using errcode = '22023';
    end if;
  end loop;

  update public.project_payment_allocations set
    reversed_at = now(),
    reversed_by = p_actor,
    reversal_reason = trim(p_reason)
  where payment_entry_id = v_payment.id and reversed_at is null;

  insert into public.project_payment_allocations (
    project_id, payment_entry_id, quote_version_id, payment_term_id,
    amount_inc_gst_cents, change_reason, created_by
  )
  select v_payment.project_id, v_payment.id, item.quote_version_id,
    trim(item.payment_term_id), item.amount_inc_gst_cents, trim(p_reason), p_actor
  from jsonb_to_recordset(coalesce(p_allocations, '[]'::jsonb))
    as item(quote_version_id uuid, payment_term_id text, amount_inc_gst_cents integer);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.commercial_reverse_payment_entry(
  p_payment_entry_id uuid,
  p_reason text,
  p_actor text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_payment public.project_payment_entries%rowtype;
  v_reversal_id uuid;
  v_net_paid integer;
  v_other_allocated integer;
begin
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'A reversal reason is required' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('commercial-payment-entry:' || p_payment_entry_id::text, 0));
  select entry.* into strict v_payment
  from public.project_payment_entries entry where entry.id = p_payment_entry_id for update;
  perform pg_advisory_xact_lock(hashtextextended('commercial-project-invoice:' || v_payment.project_id::text, 0));
  if v_payment.entry_type = 'REVERSAL' then
    raise exception 'A reversal entry cannot be reversed' using errcode = '55000';
  end if;
  select reversal.id into v_reversal_id
  from public.project_payment_entries reversal
  where reversal.reverses_entry_id = v_payment.id;
  if found then return v_reversal_id; end if;

  select coalesce(sum(entry.amount_inc_gst_cents), 0)::integer into v_net_paid
  from public.project_payment_entries entry where entry.project_id = v_payment.project_id;
  select coalesce(sum(allocation.amount_inc_gst_cents), 0)::integer into v_other_allocated
  from public.project_payment_allocations allocation
  where allocation.project_id = v_payment.project_id
    and allocation.payment_entry_id <> v_payment.id
    and allocation.reversed_at is null;
  if v_net_paid - v_payment.amount_inc_gst_cents < 0 then
    raise exception 'This reversal would make the job paid balance negative' using errcode = '55000';
  end if;
  if v_net_paid - v_payment.amount_inc_gst_cents < v_other_allocated then
    raise exception 'Reduce other payment allocations before reversing this entry' using errcode = '55000';
  end if;

  insert into public.project_payment_entries (
    project_id, entry_type, amount_inc_gst_cents, occurred_at,
    reference, note, reason, reverses_entry_id, created_by
  ) values (
    v_payment.project_id, 'REVERSAL', -v_payment.amount_inc_gst_cents, now(),
    v_payment.reference, v_payment.note, trim(p_reason), v_payment.id, p_actor
  ) returning id into v_reversal_id;

  update public.project_payment_allocations set
    reversed_at = now(), reversed_by = p_actor, reversal_reason = trim(p_reason)
  where payment_entry_id = v_payment.id and reversed_at is null;
  return v_reversal_id;
end;
$$;

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

  select coalesce(sum(entry.amount_inc_gst_cents), 0)::integer into v_paid
  from public.project_payment_entries entry where entry.project_id = p_project_id;
  select coalesce(sum(invoice.total_inc_gst_cents), 0)::integer into v_open
  from public.deposit_invoices invoice
  where invoice.project_id = p_project_id and invoice.status = 'OPEN';
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
    if v_remaining <= 0 then raise exception 'There is no remaining balance to split' using errcode = '55000'; end if;
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
    raise exception 'Invoice amount exceeds the remaining job balance' using errcode = '55000';
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

revoke all on function public.commercial_mark_invoice_paid_and_record_payment(uuid, text, timestamptz, text, text, text)
  from public, anon, authenticated;
grant execute on function public.commercial_mark_invoice_paid_and_record_payment(uuid, text, timestamptz, text, text, text)
  to service_role;
revoke all on function public.commercial_record_project_payment_entry(uuid, text, integer, timestamptz, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.commercial_record_project_payment_entry(uuid, text, integer, timestamptz, text, text, text, text, text)
  to service_role;
revoke all on function public.commercial_replace_payment_allocations(uuid, jsonb, text, text)
  from public, anon, authenticated;
grant execute on function public.commercial_replace_payment_allocations(uuid, jsonb, text, text)
  to service_role;
revoke all on function public.commercial_reverse_payment_entry(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.commercial_reverse_payment_entry(uuid, text, text)
  to service_role;
revoke all on function public.commercial_create_admin_invoice(uuid, uuid, text, text, integer, integer, text, date, text, text, boolean, text, text)
  from public, anon, authenticated;
grant execute on function public.commercial_create_admin_invoice(uuid, uuid, text, text, integer, integer, text, date, text, text, boolean, text, text)
  to service_role;

alter table public.project_payment_entries enable row level security;
alter table public.project_payment_allocations enable row level security;
alter table public.project_invoice_plan_items enable row level security;
revoke all on table public.project_payment_entries from public, anon, authenticated;
revoke all on table public.project_payment_allocations from public, anon, authenticated;
revoke all on table public.project_invoice_plan_items from public, anon, authenticated;
grant select, insert on table public.project_payment_entries to service_role;
grant select, insert, update on table public.project_payment_allocations to service_role;
grant select, insert, update on table public.project_invoice_plan_items to service_role;

notify pgrst, 'reload schema';
