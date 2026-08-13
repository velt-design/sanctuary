-- Commercial truth is version-bound and project-wide. Accepted lifecycle
-- tombstones prevent an older accepted version from becoming current again.
create or replace function public.commercial_current_accepted_quote_versions(
  p_project_id uuid
)
returns table (
  quote_version_id uuid,
  quote_id uuid,
  total_inc_gst_cents integer
)
language sql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
  with ranked as (
    select
      version.id as quote_version_id,
      quote.id as quote_id,
      version.total_inc_gst_cents,
      version.status,
      row_number() over (
        partition by quote.id
        order by version.version_number desc, version.created_at desc, version.id desc
      ) as lifecycle_rank
    from public.quotes quote
    join public.quote_versions version on version.quote_id = quote.id
    where quote.project_id = p_project_id
      and (version.status = 'ACCEPTED' or version.accepted_at is not null)
  )
  select ranked.quote_version_id, ranked.quote_id, ranked.total_inc_gst_cents
  from ranked
  where ranked.lifecycle_rank = 1 and ranked.status = 'ACCEPTED';
$$;

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

  return query select
    v_accepted,
    v_paid,
    v_open,
    greatest(0, v_accepted - v_paid - v_open),
    greatest(0, v_paid + v_open - v_accepted),
    v_latest_payment_at;
end;
$$;

-- PAID is a projection of commercial settlement, not an irreversible manual
-- label. Any durable mutation that makes settlement false reopens the project
-- to COMPLETED and clears the compatibility completion date.
create or replace function public.commercial_reopen_paid_project_if_unsettled(
  p_project_id uuid,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_project public.projects%rowtype;
  v_truth record;
begin
  perform pg_advisory_xact_lock(hashtextextended('commercial-project-invoice:' || p_project_id::text, 0));
  select project.* into strict v_project
  from public.projects project where project.id = p_project_id for update;
  if v_project.pipeline_stage <> 'PAID' then return false; end if;
  select * into strict v_truth from public.commercial_project_financial_truth(p_project_id);
  if v_truth.accepted_total_inc_gst_cents > 0
    and v_truth.open_invoice_inc_gst_cents = 0
    and v_truth.paid_inc_gst_cents >= v_truth.accepted_total_inc_gst_cents then
    return false;
  end if;
  update public.projects set pipeline_stage = 'COMPLETED', final_payment_date = null
  where id = p_project_id;
  insert into public.audit_events (project_id, type, idempotency_key, payload)
  values (
    p_project_id,
    'pipeline.stage_changed',
    'pipeline.stage_changed:commercial-reopened:' || p_project_id::text || ':' || gen_random_uuid()::text,
    jsonb_build_object(
      'fromStage', 'PAID', 'toStage', 'COMPLETED',
      'reason', p_reason,
      'acceptedTotalIncGstCents', v_truth.accepted_total_inc_gst_cents,
      'paidIncGstCents', v_truth.paid_inc_gst_cents,
      'openInvoiceIncGstCents', v_truth.open_invoice_inc_gst_cents
    )
  );
  return true;
end;
$$;

create or replace function public.commercial_reconcile_paid_stage_trigger()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_project_id uuid;
begin
  if tg_table_name = 'quote_versions' then
    select quote.project_id into strict v_project_id
    from public.quotes quote where quote.id = new.quote_id;
  else
    v_project_id := (to_jsonb(new)->>'project_id')::uuid;
  end if;
  perform public.commercial_reopen_paid_project_if_unsettled(
    v_project_id,
    tg_table_name || '.' || tg_op
  );
  return new;
end;
$$;

drop trigger if exists project_payment_entries_reconcile_paid_stage on public.project_payment_entries;
create trigger project_payment_entries_reconcile_paid_stage
after insert on public.project_payment_entries
for each row when (new.amount_inc_gst_cents < 0)
execute function public.commercial_reconcile_paid_stage_trigger();

drop trigger if exists deposit_invoices_insert_reconcile_paid_stage on public.deposit_invoices;
create trigger deposit_invoices_insert_reconcile_paid_stage
after insert on public.deposit_invoices
for each row when (new.status = 'OPEN')
execute function public.commercial_reconcile_paid_stage_trigger();

drop trigger if exists deposit_invoices_reopen_reconcile_paid_stage on public.deposit_invoices;
create trigger deposit_invoices_reopen_reconcile_paid_stage
after update of status on public.deposit_invoices
for each row when (new.status = 'OPEN' and old.status is distinct from new.status)
execute function public.commercial_reconcile_paid_stage_trigger();

drop trigger if exists quote_versions_insert_reconcile_paid_stage on public.quote_versions;
create trigger quote_versions_insert_reconcile_paid_stage
after insert on public.quote_versions
for each row when (new.status = 'ACCEPTED')
execute function public.commercial_reconcile_paid_stage_trigger();

drop trigger if exists quote_versions_lifecycle_reconcile_paid_stage on public.quote_versions;
create trigger quote_versions_lifecycle_reconcile_paid_stage
after update of status, accepted_at on public.quote_versions
for each row when (
  old.status is distinct from new.status
  or old.accepted_at is distinct from new.accepted_at
)
execute function public.commercial_reconcile_paid_stage_trigger();

create or replace function public.commercial_reject_open_invoice_allocation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  if exists (
    select 1 from public.deposit_invoices invoice
    where invoice.quote_version_id = new.quote_version_id
      and invoice.payment_term_id = new.payment_term_id
      and invoice.status = 'OPEN'
  ) then
    raise exception 'Mark the whole invoice paid or leave this payment unallocated' using errcode = '55000';
  end if;
  return new;
end;
$$;

drop trigger if exists project_payment_allocations_no_open_invoice_partial on public.project_payment_allocations;
create trigger project_payment_allocations_no_open_invoice_partial
before insert or update of quote_version_id, payment_term_id, amount_inc_gst_cents
on public.project_payment_allocations
for each row execute function public.commercial_reject_open_invoice_allocation();

create or replace function public.commercial_accept_quote_with_project_lock(
  p_quote_version_id uuid,
  p_actor text
)
returns table (
  quote_version_id uuid,
  invoice_id uuid,
  invoice_ref text,
  invoice_project_id uuid,
  invoice_quote_id uuid,
  invoice_quote_total_inc_gst_cents integer,
  invoice_created_at timestamptz,
  invoice_created boolean,
  already_accepted boolean
)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_project_id uuid;
  v_result record;
  v_invoice record;
  v_truth record;
  v_available_before_invoice integer;
begin
  select quote.project_id into strict v_project_id
  from public.quote_versions version
  join public.quotes quote on quote.id = version.quote_id
  where version.id = p_quote_version_id;
  perform pg_advisory_xact_lock(hashtextextended('commercial-project-invoice:' || v_project_id::text, 0));
  select * into strict v_result
  from public.commercial_accept_quote_and_ensure_invoice(p_quote_version_id, p_actor);
  select
    invoice.id,
    invoice.invoice_ref,
    invoice.project_id,
    invoice.quote_id,
    invoice.quote_total_inc_gst_cents,
    invoice.total_inc_gst_cents,
    invoice.created_at
  into strict v_invoice
  from public.deposit_invoices invoice
  where invoice.id = v_result.invoice_id;
  if not exists (
    select 1
    from public.commercial_current_accepted_quote_versions(v_project_id) current_version
    where current_version.quote_version_id = p_quote_version_id
  ) then
    raise exception 'Quote version is no longer the current accepted lifecycle version' using errcode = '55000';
  end if;
  if v_result.invoice_created then
    select * into strict v_truth
    from public.commercial_project_financial_truth(v_project_id);
    v_available_before_invoice := greatest(
      0,
      v_truth.accepted_total_inc_gst_cents
        - v_truth.paid_inc_gst_cents
        - greatest(0, v_truth.open_invoice_inc_gst_cents - v_invoice.total_inc_gst_cents)
    );
    if v_invoice.total_inc_gst_cents > v_available_before_invoice then
      raise exception 'Quote acceptance invoice exceeds the remaining job balance' using errcode = '55000';
    end if;
  end if;
  insert into public.audit_events (project_id, type, idempotency_key, payload)
  values (
    v_project_id, 'quote.accepted', 'quote.accepted:' || p_quote_version_id::text,
    jsonb_build_object('quoteVersionId', p_quote_version_id, 'actor', p_actor)
  ) on conflict (idempotency_key) do nothing;
  return query select
    v_result.quote_version_id,
    v_invoice.id,
    v_invoice.invoice_ref,
    v_invoice.project_id,
    v_invoice.quote_id,
    v_invoice.quote_total_inc_gst_cents,
    v_invoice.created_at,
    v_result.invoice_created,
    v_result.already_accepted;
end;
$$;

create or replace function public.commercial_mark_invoice_paid_with_project_lock(
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
  v_project_id uuid;
begin
  select invoice.project_id into strict v_project_id
  from public.deposit_invoices invoice where invoice.id = p_invoice_id;
  perform pg_advisory_xact_lock(hashtextextended('commercial-project-invoice:' || v_project_id::text, 0));
  return query select * from public.commercial_mark_invoice_paid_and_record_payment(
    p_invoice_id, p_actor, p_paid_at, p_reference, p_method, p_note
  );
end;
$$;

create or replace function public.commercial_void_open_invoice(
  p_invoice_id uuid,
  p_actor text,
  p_reason text
)
returns table (invoice_id uuid, project_id uuid)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_invoice public.deposit_invoices%rowtype;
  v_project_id uuid;
begin
  if length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'A void reason is required' using errcode = '22023';
  end if;
  select invoice.project_id into strict v_project_id
  from public.deposit_invoices invoice where invoice.id = p_invoice_id;
  perform pg_advisory_xact_lock(hashtextextended('commercial-project-invoice:' || v_project_id::text, 0));
  select invoice.* into strict v_invoice
  from public.deposit_invoices invoice where invoice.id = p_invoice_id for update;
  if v_invoice.status <> 'OPEN' then
    raise exception 'Only open invoices can be voided' using errcode = '55000';
  end if;

  update public.deposit_invoices set
    status = 'VOID', voided_at = clock_timestamp(), voided_by = p_actor,
    void_reason = trim(p_reason), portal_token_hash = null, portal_token_expires_at = null
  where id = p_invoice_id;
  insert into public.audit_events (project_id, type, idempotency_key, payload)
  values (
    v_project_id, 'invoice.voided', 'invoice.voided:' || p_invoice_id::text,
    jsonb_build_object(
      'invoiceId', p_invoice_id, 'invoiceRef', v_invoice.invoice_ref,
      'quoteVersionId', v_invoice.quote_version_id, 'reason', trim(p_reason), 'actor', p_actor
    )
  ) on conflict (idempotency_key) do nothing;
  return query select p_invoice_id, v_project_id;
end;
$$;

create or replace function public.commercial_replace_payment_allocations_with_project_lock(
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
  v_project_id uuid;
begin
  select entry.project_id into strict v_project_id
  from public.project_payment_entries entry where entry.id = p_payment_entry_id;
  perform pg_advisory_xact_lock(hashtextextended('commercial-project-invoice:' || v_project_id::text, 0));
  return public.commercial_replace_payment_allocations(
    p_payment_entry_id, p_allocations, p_reason, p_actor
  );
end;
$$;

create or replace function public.commercial_reverse_payment_entry_with_project_lock(
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
  v_project_id uuid;
  v_source_invoice_id uuid;
  v_reversal_id uuid;
begin
  select entry.project_id, entry.source_invoice_id into strict v_project_id, v_source_invoice_id
  from public.project_payment_entries entry where entry.id = p_payment_entry_id;
  perform pg_advisory_xact_lock(hashtextextended('commercial-project-invoice:' || v_project_id::text, 0));
  v_reversal_id := public.commercial_reverse_payment_entry(p_payment_entry_id, p_reason, p_actor);
  if v_source_invoice_id is not null then
    update public.deposit_invoices set
      status = 'OPEN', paid_at = null, paid_by = null,
      payment_reference = null, payment_method = null, payment_note = null
    where id = v_source_invoice_id and status = 'PAID';
    insert into public.audit_events (project_id, type, idempotency_key, payload)
    values (
      v_project_id, 'invoice.payment_reversed',
      'invoice.payment_reversed:' || v_source_invoice_id::text || ':' || v_reversal_id::text,
      jsonb_build_object(
        'invoiceId', v_source_invoice_id, 'paymentEntryId', p_payment_entry_id,
        'reversalEntryId', v_reversal_id, 'reason', trim(p_reason), 'actor', p_actor
      )
    ) on conflict (idempotency_key) do nothing;
  end if;
  return v_reversal_id;
end;
$$;

create or replace function public.commercial_mark_project_deposit_received(
  p_project_id uuid,
  p_expected_paid_date date
)
returns table (
  changed boolean,
  previous_stage text,
  paid_date date,
  occurred_at timestamptz,
  invoice_id uuid,
  quote_version_id uuid,
  quote_total_inc_gst_cents integer
)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_project public.projects%rowtype;
  v_invoice public.deposit_invoices%rowtype;
  v_paid_date date;
begin
  if not public.has_portal_access() then
    raise exception 'staff access required' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('commercial-project-invoice:' || p_project_id::text, 0));
  select project.* into strict v_project
  from public.projects project where project.id = p_project_id for update;
  if v_project.pipeline_stage not in ('SENT', 'DEPOSIT') then
    raise exception 'Invalid stage transition (expected SENT)' using errcode = '55000';
  end if;
  select invoice.* into v_invoice
  from public.deposit_invoices invoice
  join public.commercial_current_accepted_quote_versions(p_project_id) current_version
    on current_version.quote_version_id = invoice.quote_version_id
  where invoice.project_id = p_project_id
    and invoice.status = 'PAID'
    and invoice.payment_term_position = 1
  order by invoice.created_at desc
  limit 1 for update of invoice;
  if not found then
    raise exception 'Mark the whole deposit invoice paid from the project Invoices tab first' using errcode = '55000';
  end if;
  v_paid_date := v_invoice.paid_at::date;
  if v_paid_date is null then
    raise exception 'The deposit payment date is unavailable' using errcode = '55000';
  end if;
  if p_expected_paid_date is null or p_expected_paid_date is distinct from v_paid_date then
    raise exception 'Deposit paid date must match the paid invoice date' using errcode = '55000';
  end if;

  if v_project.pipeline_stage = 'SENT' then
    update public.projects set pipeline_stage = 'DEPOSIT', deposit_paid_date = v_paid_date
    where id = p_project_id returning * into v_project;
    return query select true, 'SENT'::text, v_paid_date, v_project.deposit_received_at,
      v_invoice.id, v_invoice.quote_version_id, v_invoice.quote_total_inc_gst_cents;
  else
    if v_project.deposit_paid_date is distinct from v_paid_date then
      raise exception 'Deposit stage payment date does not match the paid invoice' using errcode = '55000';
    end if;
    return query select false, 'DEPOSIT'::text, v_paid_date, v_project.deposit_received_at,
      v_invoice.id, v_invoice.quote_version_id, v_invoice.quote_total_inc_gst_cents;
  end if;
end;
$$;

create or replace function public.commercial_mark_project_paid(
  p_project_id uuid
)
returns table (changed boolean, paid_date date)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_project public.projects%rowtype;
  v_truth record;
  v_paid_date date;
begin
  if not public.has_portal_access() then
    raise exception 'staff access required' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('commercial-project-invoice:' || p_project_id::text, 0));
  select project.* into strict v_project
  from public.projects project where project.id = p_project_id for update;
  if v_project.pipeline_stage not in ('COMPLETED', 'PAID') then
    raise exception 'Invalid stage transition (expected COMPLETED)' using errcode = '55000';
  end if;
  select * into strict v_truth from public.commercial_project_financial_truth(p_project_id);
  if v_truth.accepted_total_inc_gst_cents <= 0 then
    raise exception 'A current accepted quote is required before the project can be marked paid' using errcode = '55000';
  end if;
  if v_truth.open_invoice_inc_gst_cents > 0
    or v_truth.paid_inc_gst_cents < v_truth.accepted_total_inc_gst_cents then
    raise exception 'The accepted job balance is not fully paid or open invoices remain' using errcode = '55000';
  end if;
  v_paid_date := v_truth.latest_payment_at::date;
  if v_project.pipeline_stage = 'COMPLETED' then
    update public.projects set pipeline_stage = 'PAID', final_payment_date = v_paid_date
    where id = p_project_id;
    return query select true, v_paid_date;
    return;
  end if;
  return query select false, coalesce(v_project.final_payment_date, v_paid_date);
end;
$$;

-- Quote lifecycle changes share the invoice lock. Once superseding commits,
-- no concurrent invoice command can still treat that version as accepted.
create or replace function public.commercial_mark_quote_superseded(
  p_quote_version_id uuid,
  p_actor text
)
returns table (changed boolean, previous_status text)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_version public.quote_versions%rowtype;
  v_project_id uuid;
  v_previous text;
  v_now timestamptz := clock_timestamp();
  v_invoice record;
begin
  select quote.project_id into strict v_project_id
  from public.quote_versions version
  join public.quotes quote on quote.id = version.quote_id
  where version.id = p_quote_version_id;
  perform pg_advisory_xact_lock(hashtextextended('commercial-project-invoice:' || v_project_id::text, 0));
  select version.* into strict v_version
  from public.quote_versions version where version.id = p_quote_version_id for update;
  v_previous := v_version.status;
  if v_previous = 'SUPERSEDED' then
    if v_version.accepted_at is not null then
      for v_invoice in
        update public.deposit_invoices invoice set
          status = 'VOID', voided_at = coalesce(invoice.voided_at, v_now),
          voided_by = p_actor, void_reason = coalesce(invoice.void_reason, 'quote_superseded'),
          portal_token_hash = null, portal_token_expires_at = null
        where invoice.quote_version_id = v_version.id and invoice.status = 'OPEN'
        returning invoice.id, invoice.invoice_ref, invoice.quote_version_id
      loop
        insert into public.audit_events (project_id, type, idempotency_key, payload)
        values (
          v_project_id, 'invoice.voided', 'invoice.voided:quote-superseded:' || v_invoice.id::text,
          jsonb_build_object(
            'depositInvoiceId', v_invoice.id, 'invoiceRef', v_invoice.invoice_ref,
            'quoteVersionId', v_invoice.quote_version_id, 'reason', 'quote_superseded', 'actor', p_actor
          )
        ) on conflict (idempotency_key) do nothing;
      end loop;
    end if;
    return query select false, v_previous;
    return;
  end if;
  if v_previous not in ('SENT', 'ACCEPTED') then
    raise exception 'Only sent or accepted quotes can be marked superseded' using errcode = '55000';
  end if;

  update public.quote_versions set
    status = 'SUPERSEDED',
    accepted_at = case when v_previous = 'ACCEPTED' then coalesce(accepted_at, v_now) else accepted_at end,
    superseded_at = v_now,
    superseded_by = p_actor,
    is_current_draft = false,
    accept_token_hash = null,
    accept_token_expires_at = null
  where id = p_quote_version_id;

  insert into public.audit_events (project_id, type, idempotency_key, payload)
  values (
    v_project_id, 'quote.superseded', 'quote.superseded:' || p_quote_version_id::text,
    jsonb_build_object(
      'quoteVersionId', p_quote_version_id,
      'previousStatus', v_previous,
      'supersededAt', v_now,
      'actor', p_actor
    )
  ) on conflict (idempotency_key) do nothing;

  if v_previous = 'ACCEPTED' or v_version.accepted_at is not null then
    for v_invoice in
      update public.deposit_invoices invoice set
        status = 'VOID', voided_at = coalesce(invoice.voided_at, v_now),
        voided_by = p_actor, void_reason = coalesce(invoice.void_reason, 'quote_superseded'),
        portal_token_hash = null, portal_token_expires_at = null
      where invoice.quote_version_id = v_version.id and invoice.status = 'OPEN'
      returning invoice.id, invoice.invoice_ref, invoice.quote_version_id
    loop
      insert into public.audit_events (project_id, type, idempotency_key, payload)
      values (
        v_project_id, 'invoice.voided', 'invoice.voided:quote-superseded:' || v_invoice.id::text,
        jsonb_build_object(
          'depositInvoiceId', v_invoice.id, 'invoiceRef', v_invoice.invoice_ref,
          'quoteVersionId', v_invoice.quote_version_id, 'reason', 'quote_superseded', 'actor', p_actor
        )
      ) on conflict (idempotency_key) do nothing;
    end loop;
  end if;

  return query select true, v_previous;
end;
$$;

create or replace function public.commercial_mark_quote_declined(
  p_quote_version_id uuid,
  p_actor text
)
returns table (changed boolean, previous_status text, project_id uuid)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_version public.quote_versions%rowtype;
  v_project_id uuid;
  v_previous text;
  v_now timestamptz := clock_timestamp();
  v_invoice record;
begin
  select quote.project_id into strict v_project_id
  from public.quote_versions version
  join public.quotes quote on quote.id = version.quote_id
  where version.id = p_quote_version_id;
  perform pg_advisory_xact_lock(hashtextextended('commercial-project-invoice:' || v_project_id::text, 0));
  select version.* into strict v_version
  from public.quote_versions version where version.id = p_quote_version_id for update;
  v_previous := v_version.status;
  if v_previous not in ('SENT', 'ACCEPTED', 'DECLINED') then
    raise exception 'Only sent or accepted quotes can be declined' using errcode = '55000';
  end if;

  if v_previous <> 'DECLINED' then
    update public.quote_versions set
      status = 'DECLINED',
      accepted_at = case when v_previous = 'ACCEPTED' then coalesce(accepted_at, v_now) else accepted_at end
    where id = p_quote_version_id;
    insert into public.audit_events (project_id, type, idempotency_key, payload)
    values (
      v_project_id, 'quote.declined', 'quote.declined:' || p_quote_version_id::text,
      jsonb_build_object('quoteVersionId', p_quote_version_id, 'previousStatus', v_previous, 'actor', p_actor)
    ) on conflict (idempotency_key) do nothing;
  end if;

  if v_previous = 'ACCEPTED' or v_version.accepted_at is not null then
    for v_invoice in
      update public.deposit_invoices invoice set
        status = 'VOID', voided_at = coalesce(invoice.voided_at, v_now),
        voided_by = p_actor, void_reason = coalesce(invoice.void_reason, 'quote_declined'),
        portal_token_hash = null, portal_token_expires_at = null
      where invoice.quote_version_id = v_version.id and invoice.status = 'OPEN'
      returning invoice.id, invoice.invoice_ref, invoice.quote_version_id
    loop
      insert into public.audit_events (project_id, type, idempotency_key, payload)
      values (
        v_project_id, 'invoice.voided', 'invoice.voided:quote-declined:' || v_invoice.id::text,
        jsonb_build_object(
          'depositInvoiceId', v_invoice.id, 'invoiceRef', v_invoice.invoice_ref,
          'quoteVersionId', v_invoice.quote_version_id, 'reason', 'quote_declined', 'actor', p_actor
        )
      ) on conflict (idempotency_key) do nothing;
    end loop;
  end if;

  return query select v_previous <> 'DECLINED', v_previous, v_project_id;
end;
$$;

-- Compatibility wrapper for the operational state machine. Commercial
-- settlement is proved by the ledger and whole-invoice state, then projected
-- to the legacy date used by the older close command.
create or replace function public.commercial_complete_project_operational_state_command(
  p_project_id uuid,
  p_command_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_truth record;
  v_paid_date date;
begin
  if not public.has_portal_access() then
    raise exception 'staff access required' using errcode = '42501';
  end if;
  if p_payload->>'outcome' <> 'COMPLETE' then
    raise exception 'This command is reserved for completed projects' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('commercial-project-invoice:' || p_project_id::text, 0));
  select * into strict v_truth from public.commercial_project_financial_truth(p_project_id);
  if v_truth.accepted_total_inc_gst_cents <= 0 then
    raise exception 'PROJECT_NOT_COMPLETE: no current accepted commercial scope' using errcode = '22023';
  end if;
  if v_truth.open_invoice_inc_gst_cents > 0 then
    raise exception 'PROJECT_NOT_COMPLETE: open invoices remain unpaid or unvoided' using errcode = '22023';
  end if;
  if v_truth.paid_inc_gst_cents < v_truth.accepted_total_inc_gst_cents then
    raise exception 'PROJECT_NOT_COMPLETE: accepted commercial balance is not fully paid' using errcode = '22023';
  end if;
  select max(entry.occurred_at)::date into v_paid_date
  from public.project_payment_entries entry where entry.project_id = p_project_id;
  update public.projects set final_payment_date = coalesce(final_payment_date, v_paid_date)
  where id = p_project_id;
  return public.project_operational_state_command(p_project_id, p_command_id, 'CLOSE', p_payload);
end;
$$;

-- Keep the idempotency owner, but validate the selected scope and the lower
-- project-wide balance before exposing the created invoice.
create or replace function public.commercial_create_admin_invoice_idempotent(
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
  p_actor text,
  p_client_intent_id text
)
returns table (
  invoice_id uuid,
  planned_item_count integer,
  remaining_before_inc_gst_cents integer,
  remaining_after_inc_gst_cents integer,
  replayed boolean
)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_existing public.deposit_invoices%rowtype;
  v_created record;
  v_created_invoice public.deposit_invoices%rowtype;
  v_truth record;
  v_scope_paid integer;
  v_scope_open integer;
  v_scope_remaining integer;
  v_effective_before integer;
  v_effective_after integer;
  v_call_mode text;
  v_call_amount integer;
  v_plan_group_id uuid;
  v_plan_item_id uuid;
  v_plan_term_id text;
  v_split_base integer;
  v_split_remainder integer;
  v_piece integer;
  i integer;
begin
  if p_client_intent_id is null or length(trim(p_client_intent_id)) < 8
    or length(trim(p_client_intent_id)) > 128 then
    raise exception 'Invoice client intent is invalid' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('commercial-project-invoice:' || p_project_id::text, 0));
  select invoice.* into v_existing
  from public.deposit_invoices invoice
  where invoice.project_id = p_project_id
    and invoice.admin_client_intent_id = trim(p_client_intent_id);
  if found then
    return query select v_existing.id,
      coalesce(v_existing.admin_creation_planned_item_count, 0),
      coalesce(v_existing.admin_creation_remaining_before_inc_gst_cents, 0),
      coalesce(v_existing.admin_creation_remaining_after_inc_gst_cents, 0),
      true;
    return;
  end if;

  if not exists (
    select 1 from public.commercial_current_accepted_quote_versions(p_project_id) current_version
    where current_version.quote_version_id = p_quote_version_id
  ) then
    raise exception 'Only the current accepted quote version can be invoiced' using errcode = '55000';
  end if;
  select * into strict v_truth from public.commercial_project_financial_truth(p_project_id);
  select coalesce(sum(allocation.amount_inc_gst_cents), 0)::integer into v_scope_paid
  from public.project_payment_allocations allocation
  where allocation.quote_version_id = p_quote_version_id and allocation.reversed_at is null;
  select coalesce(sum(invoice.total_inc_gst_cents), 0)::integer into v_scope_open
  from public.deposit_invoices invoice
  where invoice.quote_version_id = p_quote_version_id and invoice.status = 'OPEN';
  select greatest(0, version.total_inc_gst_cents - v_scope_paid - v_scope_open)
  into strict v_scope_remaining
  from public.quote_versions version where version.id = p_quote_version_id;
  v_effective_before := least(v_truth.remaining_to_invoice_inc_gst_cents, v_scope_remaining);
  v_call_mode := p_mode;
  v_call_amount := p_amount_inc_gst_cents;

  if p_mode = 'full_remaining' and v_effective_before < v_scope_remaining
    and not coalesce(p_allow_over_invoice, false) then
    v_call_mode := 'custom';
    v_call_amount := v_effective_before;
  elsif p_mode = 'split' then
    if p_split_count is null or p_split_count not between 2 and 10 then
      raise exception 'Split count must be between 2 and 10' using errcode = '22023';
    end if;
    if v_effective_before <= 0 then
      raise exception 'There is no remaining job balance to split' using errcode = '55000';
    end if;
    if exists (
      select 1 from public.project_invoice_plan_items plan
      where plan.quote_version_id = p_quote_version_id and plan.cancelled_at is null
    ) then
      raise exception 'An active installment plan already exists' using errcode = '55000';
    end if;
    v_call_mode := 'custom';
    v_split_base := v_effective_before / p_split_count;
    v_split_remainder := v_effective_before - (v_split_base * p_split_count);
    v_call_amount := v_split_base;
  end if;

  select * into v_created from public.commercial_create_admin_invoice(
    p_project_id, p_quote_version_id, v_call_mode, p_payment_term_id,
    v_call_amount, p_split_count, p_label, p_due_date, p_reference,
    p_payment_instructions, p_allow_over_invoice, p_override_reason, p_actor
  );
  select invoice.* into strict v_created_invoice
  from public.deposit_invoices invoice where invoice.id = v_created.invoice_id;

  if v_created_invoice.total_inc_gst_cents > v_effective_before
    and not coalesce(p_allow_over_invoice, false) then
    raise exception 'Invoice amount exceeds the remaining job balance' using errcode = '55000';
  end if;
  if v_created_invoice.total_inc_gst_cents > v_effective_before
    and length(trim(coalesce(p_override_reason, ''))) < 3 then
    raise exception 'An over-invoice override reason is required' using errcode = '22023';
  end if;

  v_effective_after := greatest(0, v_effective_before - v_created_invoice.total_inc_gst_cents);

  if p_mode = 'split' then
    v_plan_group_id := gen_random_uuid();
    for i in 1..p_split_count loop
      v_piece := v_split_base + case when i = p_split_count then v_split_remainder else 0 end;
      v_plan_term_id := case
        when i = 1 then v_created_invoice.payment_term_id
        else 'plan-' || gen_random_uuid()::text
      end;
      insert into public.project_invoice_plan_items (
        project_id, quote_version_id, plan_group_id, payment_term_id,
        label, position, item_count, amount_inc_gst_cents, invoice_id, created_by
      ) values (
        p_project_id, p_quote_version_id, v_plan_group_id, v_plan_term_id,
        case when i = 1 then trim(p_label) else 'Instalment ' || i::text end,
        i, p_split_count, v_piece,
        case when i = 1 then v_created.invoice_id else null end,
        p_actor
      ) returning id into v_plan_item_id;
      if i = 1 then
        update public.deposit_invoices set
          payment_term_position = 1,
          payment_term_count = p_split_count,
          creation_mode = 'split',
          invoice_plan_item_id = v_plan_item_id
        where id = v_created.invoice_id;
      end if;
    end loop;
    v_created.planned_item_count := p_split_count;
  elsif p_mode = 'full_remaining' then
    update public.deposit_invoices set creation_mode = 'full_remaining'
    where id = v_created.invoice_id;
  end if;

  update public.deposit_invoices
  set admin_client_intent_id = trim(p_client_intent_id),
      admin_creation_planned_item_count = v_created.planned_item_count,
      admin_creation_remaining_before_inc_gst_cents = v_effective_before,
      admin_creation_remaining_after_inc_gst_cents = v_effective_after,
      creation_override_reason = case
        when v_created_invoice.total_inc_gst_cents > v_effective_before then trim(p_override_reason)
        else creation_override_reason
      end
  where id = v_created.invoice_id;

  if v_created_invoice.total_inc_gst_cents > v_effective_before then
    update public.audit_events event set payload = event.payload || jsonb_build_object(
      'overInvoiceOverride', true,
      'overrideReason', trim(p_override_reason),
      'jobRemainingBeforeIncGstCents', v_effective_before
    )
    where event.idempotency_key = 'invoice.created:' || v_created.invoice_id::text;
  end if;
  update public.audit_events event set payload = event.payload || jsonb_build_object(
    'mode', p_mode,
    'jobRemainingBeforeIncGstCents', v_effective_before
  )
  where event.idempotency_key = 'invoice.created:' || v_created.invoice_id::text;

  return query select v_created.invoice_id, v_created.planned_item_count,
    v_effective_before, v_effective_after, false;
end;
$$;

revoke all on function public.commercial_current_accepted_quote_versions(uuid) from public, anon, authenticated;
grant execute on function public.commercial_current_accepted_quote_versions(uuid) to service_role;
revoke all on function public.commercial_project_financial_truth(uuid) from public, anon, authenticated;
grant execute on function public.commercial_project_financial_truth(uuid) to authenticated, service_role;
revoke all on function public.commercial_reopen_paid_project_if_unsettled(uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.commercial_reconcile_paid_stage_trigger() from public, anon, authenticated, service_role;
revoke all on function public.commercial_mark_quote_superseded(uuid, text) from public, anon, authenticated;
grant execute on function public.commercial_mark_quote_superseded(uuid, text) to service_role;
revoke all on function public.commercial_mark_quote_declined(uuid, text) from public, anon, authenticated;
grant execute on function public.commercial_mark_quote_declined(uuid, text) to service_role;
revoke all on function public.commercial_complete_project_operational_state_command(uuid, uuid, jsonb) from public, anon;
grant execute on function public.commercial_complete_project_operational_state_command(uuid, uuid, jsonb) to authenticated, service_role;
revoke all on function public.commercial_reject_open_invoice_allocation() from public, anon, authenticated, service_role;
revoke execute on function public.commercial_accept_quote_and_ensure_invoice(uuid, text) from service_role;
revoke all on function public.commercial_accept_quote_with_project_lock(uuid, text) from public, anon, authenticated;
grant execute on function public.commercial_accept_quote_with_project_lock(uuid, text) to service_role;
revoke execute on function public.commercial_mark_invoice_paid_and_record_payment(uuid, text, timestamptz, text, text, text) from service_role;
revoke all on function public.commercial_mark_invoice_paid_with_project_lock(uuid, text, timestamptz, text, text, text) from public, anon, authenticated;
grant execute on function public.commercial_mark_invoice_paid_with_project_lock(uuid, text, timestamptz, text, text, text) to service_role;
revoke all on function public.commercial_void_open_invoice(uuid, text, text) from public, anon, authenticated;
grant execute on function public.commercial_void_open_invoice(uuid, text, text) to service_role;
revoke execute on function public.commercial_replace_payment_allocations(uuid, jsonb, text, text) from service_role;
revoke all on function public.commercial_replace_payment_allocations_with_project_lock(uuid, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.commercial_replace_payment_allocations_with_project_lock(uuid, jsonb, text, text) to service_role;
revoke execute on function public.commercial_reverse_payment_entry(uuid, text, text) from service_role;
revoke all on function public.commercial_reverse_payment_entry_with_project_lock(uuid, text, text) from public, anon, authenticated;
grant execute on function public.commercial_reverse_payment_entry_with_project_lock(uuid, text, text) to service_role;
revoke all on function public.commercial_mark_project_deposit_received(uuid, date) from public, anon;
grant execute on function public.commercial_mark_project_deposit_received(uuid, date) to authenticated, service_role;
revoke all on function public.commercial_mark_project_paid(uuid) from public, anon;
grant execute on function public.commercial_mark_project_paid(uuid) to authenticated, service_role;
revoke execute on function public.commercial_create_admin_invoice(
  uuid, uuid, text, text, integer, integer, text, date, text, text, boolean, text, text
) from service_role;
revoke all on function public.commercial_create_admin_invoice_idempotent(
  uuid, uuid, text, text, integer, integer, text, date, text, text, boolean, text, text, text
) from public, anon, authenticated;
grant execute on function public.commercial_create_admin_invoice_idempotent(
  uuid, uuid, text, text, integer, integer, text, date, text, text, boolean, text, text, text
) to service_role;

notify pgrst, 'reload schema';
