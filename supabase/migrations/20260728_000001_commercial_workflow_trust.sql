-- Commercial workflow trust slice:
-- - idempotent estimate/quote creation
-- - one authoritative draft per quote
-- - atomic quote header/line persistence
-- - atomic accepted-quote/deposit-invoice creation
-- - private, replayable email delivery intents with stable provider identity

alter table if exists public.estimates
  add column if not exists client_intent_id text;

create unique index if not exists estimates_project_client_intent_unique
  on public.estimates (project_id, client_intent_id)
  where client_intent_id is not null;

alter table if exists public.quote_versions
  add column if not exists client_intent_id text,
  add column if not exists is_current_draft boolean not null default false,
  add column if not exists commercial_revision bigint not null default 1,
  add column if not exists delivery_prepared_at timestamptz;

with ranked_drafts as (
  select
    id,
    row_number() over (
      partition by quote_id
      order by version_number desc, created_at desc, id desc
    ) as draft_rank
  from public.quote_versions
  where status = 'DRAFT'
)
update public.quote_versions version
set is_current_draft = ranked.draft_rank = 1
from ranked_drafts ranked
where version.id = ranked.id;

update public.quote_versions
set is_current_draft = false
where status <> 'DRAFT' and is_current_draft;

create unique index if not exists quote_versions_quote_client_intent_unique
  on public.quote_versions (quote_id, client_intent_id)
  where client_intent_id is not null;

create unique index if not exists quote_versions_one_current_draft
  on public.quote_versions (quote_id)
  where status = 'DRAFT' and is_current_draft;

alter table if exists public.quote_send_logs
  add column if not exists delivery_intent_id uuid;

alter table if exists public.deposit_invoice_send_logs
  add column if not exists delivery_intent_id uuid;

create unique index if not exists quote_send_logs_delivery_intent_unique
  on public.quote_send_logs (delivery_intent_id)
  where delivery_intent_id is not null;

create unique index if not exists deposit_invoice_send_logs_delivery_intent_unique
  on public.deposit_invoice_send_logs (delivery_intent_id)
  where delivery_intent_id is not null;

-- No durable scheduler owned the legacy retry timestamp, so do not continue
-- presenting it as an automatic retry promise.
update public.deposit_invoice_send_logs
set next_retry_at = null
where next_retry_at is not null;

drop index if exists public.deposit_invoices_quote_open_unique;

create unique index if not exists deposit_invoices_quote_version_open_unique
  on public.deposit_invoices (quote_version_id)
  where status = 'OPEN';

create schema if not exists private;

create table if not exists private.commercial_email_intents (
  id uuid primary key default gen_random_uuid(),
  intent_key text not null unique,
  kind text not null
    check (kind in ('quote_send', 'quote_resend', 'deposit_invoice_send')),
  subject_id uuid not null,
  project_id uuid references public.projects(id) on delete cascade,
  payload_hash text not null
    check (payload_hash ~ '^[0-9a-f]{64}$'),
  protected_payload jsonb not null
    check (jsonb_typeof(protected_payload) = 'object'),
  status text not null default 'prepared'
    check (status in (
      'prepared',
      'dispatching',
      'provider_accepted',
      'finalised',
      'failed',
      'needs_attention'
    )),
  provider_name text not null default 'resend',
  provider_idempotency_key text not null unique,
  provider_idempotency_expires_at timestamptz not null,
  provider_message_id text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  provider_accepted_at timestamptz,
  finalised_at timestamptz
);

create index if not exists commercial_email_intents_subject_idx
  on private.commercial_email_intents (kind, subject_id, created_at desc);

create index if not exists commercial_email_intents_recovery_idx
  on private.commercial_email_intents (status, provider_idempotency_expires_at)
  where status in ('prepared', 'dispatching', 'provider_accepted', 'failed');

create unique index if not exists commercial_email_intents_one_unfinished_subject
  on private.commercial_email_intents (kind, subject_id)
  where status <> 'finalised';

create unique index if not exists commercial_email_intents_provider_message_unique
  on private.commercial_email_intents (provider_name, provider_message_id)
  where provider_message_id is not null;

drop trigger if exists commercial_email_intents_set_updated_at
  on private.commercial_email_intents;
create trigger commercial_email_intents_set_updated_at
before update on private.commercial_email_intents
for each row execute function public.set_updated_at();

create or replace function public.commercial_quote_create_draft(
  p_quote_id uuid,
  p_source_estimate_version_id uuid,
  p_revised_from_quote_version_id uuid,
  p_client_intent_id text,
  p_actor text,
  p_customer_name text,
  p_reference text,
  p_intro_text text,
  p_terms_text text,
  p_deposit_percent numeric,
  p_expires_at date,
  p_total_inc_gst_cents integer,
  p_total_ex_gst_cents integer,
  p_gst_cents integer,
  p_pricing_source text,
  p_pricing_source_metadata jsonb,
  p_line_items jsonb
)
returns public.quote_versions
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_existing public.quote_versions%rowtype;
  v_created public.quote_versions%rowtype;
  v_version_number integer;
begin
  if p_client_intent_id is null
     or length(trim(p_client_intent_id)) < 8
     or length(trim(p_client_intent_id)) > 128 then
    raise exception 'client intent ID is invalid' using errcode = '22023';
  end if;
  if jsonb_typeof(p_line_items) is distinct from 'array'
     or jsonb_array_length(p_line_items) = 0 then
    raise exception 'quote line items are required' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('commercial-quote:' || p_quote_id::text, 0));

  select version.*
  into v_existing
  from public.quote_versions version
  where version.quote_id = p_quote_id
    and version.client_intent_id = trim(p_client_intent_id)
  for update;

  if found then
    if v_existing.source_estimate_version_id <> p_source_estimate_version_id then
      raise exception 'client intent already belongs to a different estimate'
        using errcode = '23505';
    end if;
    return v_existing;
  end if;

  update public.quote_versions
  set is_current_draft = false
  where quote_id = p_quote_id
    and status = 'DRAFT'
    and is_current_draft;

  select coalesce(max(version_number), 0) + 1
  into v_version_number
  from public.quote_versions
  where quote_id = p_quote_id;

  insert into public.quote_versions (
    quote_id,
    version_number,
    status,
    source_estimate_version_id,
    revised_from_quote_version_id,
    created_by,
    customer_name,
    reference,
    intro_text,
    terms_text,
    deposit_percent,
    expires_at,
    total_inc_gst_cents,
    total_ex_gst_cents,
    gst_cents,
    pricing_source,
    pricing_source_metadata,
    client_intent_id,
    is_current_draft
  )
  values (
    p_quote_id,
    v_version_number,
    'DRAFT',
    p_source_estimate_version_id,
    p_revised_from_quote_version_id,
    p_actor,
    p_customer_name,
    p_reference,
    p_intro_text,
    p_terms_text,
    p_deposit_percent,
    p_expires_at,
    p_total_inc_gst_cents,
    p_total_ex_gst_cents,
    p_gst_cents,
    p_pricing_source,
    coalesce(p_pricing_source_metadata, '{}'::jsonb),
    trim(p_client_intent_id),
    true
  )
  returning * into v_created;

  insert into public.quote_line_items (
    quote_version_id,
    sort_order,
    description,
    qty,
    unit_price_inc_gst_cents,
    line_total_inc_gst_cents
  )
  select
    v_created.id,
    item.sort_order,
    item.description,
    item.qty,
    item.unit_price_inc_gst_cents,
    item.line_total_inc_gst_cents
  from jsonb_to_recordset(p_line_items) as item(
    sort_order integer,
    description text,
    qty numeric,
    unit_price_inc_gst_cents integer,
    line_total_inc_gst_cents integer
  );

  return v_created;
end;
$$;

create or replace function public.commercial_quote_update_draft(
  p_quote_version_id uuid,
  p_expected_commercial_revision bigint,
  p_reference text,
  p_intro_text text,
  p_terms_text text,
  p_deposit_percent numeric,
  p_expires_at date,
  p_source_estimate_version_id uuid,
  p_total_inc_gst_cents integer,
  p_total_ex_gst_cents integer,
  p_gst_cents integer,
  p_pricing_source text,
  p_pricing_source_metadata jsonb,
  p_line_items jsonb
)
returns public.quote_versions
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_current public.quote_versions%rowtype;
  v_updated public.quote_versions%rowtype;
begin
  if p_expected_commercial_revision is null
     or p_expected_commercial_revision < 1 then
    raise exception 'quote commercial revision is required'
      using errcode = '22023';
  end if;
  if jsonb_typeof(p_line_items) is distinct from 'array'
     or jsonb_array_length(p_line_items) = 0 then
    raise exception 'quote line items are required' using errcode = '22023';
  end if;

  select version.*
  into strict v_current
  from public.quote_versions version
  where version.id = p_quote_version_id
  for update;

  if v_current.status <> 'DRAFT' or not v_current.is_current_draft then
    raise exception 'Quote is locked' using errcode = '55000';
  end if;
  if v_current.commercial_revision is distinct from p_expected_commercial_revision then
    raise exception 'QUOTE_STALE' using errcode = '40001';
  end if;
  if exists (
    select 1 from public.deposit_invoices invoice
    where invoice.quote_version_id = p_quote_version_id
  ) or exists (
    select 1 from public.job_pack_generations generation
    where generation.quote_version_id = p_quote_version_id
  ) then
    raise exception 'Quote is locked' using errcode = '55000';
  end if;

  update public.quote_versions
  set
    reference = p_reference,
    intro_text = p_intro_text,
    terms_text = p_terms_text,
    deposit_percent = p_deposit_percent,
    expires_at = p_expires_at,
    source_estimate_version_id = p_source_estimate_version_id,
    total_inc_gst_cents = p_total_inc_gst_cents,
    total_ex_gst_cents = p_total_ex_gst_cents,
    gst_cents = p_gst_cents,
    pricing_source = p_pricing_source,
    pricing_source_metadata = coalesce(p_pricing_source_metadata, '{}'::jsonb),
    commercial_revision = commercial_revision + 1,
    pdf_file_id = null,
    render_hash = null,
    preview_base_payload = null,
    preview_rendered_at = null
  where id = p_quote_version_id
  returning * into v_updated;

  delete from public.quote_line_items
  where quote_version_id = p_quote_version_id;

  insert into public.quote_line_items (
    quote_version_id,
    sort_order,
    description,
    qty,
    unit_price_inc_gst_cents,
    line_total_inc_gst_cents
  )
  select
    p_quote_version_id,
    item.sort_order,
    item.description,
    item.qty,
    item.unit_price_inc_gst_cents,
    item.line_total_inc_gst_cents
  from jsonb_to_recordset(p_line_items) as item(
    sort_order integer,
    description text,
    qty numeric,
    unit_price_inc_gst_cents integer,
    line_total_inc_gst_cents integer
  );

  return v_updated;
end;
$$;

create or replace function public.commercial_accept_quote_and_ensure_invoice(
  p_quote_version_id uuid,
  p_actor text
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
  v_invoice_created boolean := false;
  v_already_accepted boolean := false;
  v_issue_date date := current_date;
  v_deposit_inc integer;
  v_deposit_ex integer;
  v_gst integer;
begin
  perform pg_advisory_xact_lock(
    hashtextextended('commercial-accept:' || p_quote_version_id::text, 0)
  );

  select version.*
  into strict v_version
  from public.quote_versions version
  where version.id = p_quote_version_id
  for update;

  if v_version.status = 'ACCEPTED' then
    v_already_accepted := true;
  elsif v_version.status <> 'SENT' then
    raise exception 'Only sent quotes can be accepted' using errcode = '55000';
  elsif v_version.expires_at is not null and v_version.expires_at < current_date then
    raise exception 'QUOTE_EXPIRED' using errcode = '55000';
  else
    update public.quote_versions
    set
      status = 'ACCEPTED',
      accepted_at = coalesce(accepted_at, now()),
      is_current_draft = false
    where id = p_quote_version_id
    returning * into v_version;
  end if;

  select quote_row.*
  into strict v_quote
  from public.quotes quote_row
  where quote_row.id = v_version.quote_id;

  select project.*
  into strict v_project
  from public.projects project
  where project.id = v_quote.project_id;

  update public.deposit_invoices invoice
  set
    status = 'VOID',
    voided_at = coalesce(invoice.voided_at, now()),
    voided_by = p_actor,
    void_reason = coalesce(
      invoice.void_reason,
      'Replaced after acceptance of quote version ' || v_version.version_number::text
    ),
    portal_token_hash = null,
    portal_token_expires_at = null
  where invoice.quote_id = v_quote.id
    and invoice.quote_version_id <> v_version.id
    and invoice.status = 'OPEN';

  select invoice.*
  into v_invoice
  from public.deposit_invoices invoice
  where invoice.quote_version_id = v_version.id
    and invoice.status = 'OPEN'
  order by invoice.created_at desc
  limit 1
  for update;

  if not found then
    v_deposit_inc := round(
      v_version.total_inc_gst_cents * v_version.deposit_percent / 100.0
    )::integer;
    v_deposit_ex := round(v_deposit_inc / 1.15)::integer;
    v_gst := v_deposit_inc - v_deposit_ex;

    insert into public.deposit_invoices (
      project_id,
      quote_id,
      quote_version_id,
      quote_ref,
      quote_version_number,
      invoice_ref,
      status,
      issue_date,
      due_date,
      reference,
      customer_name,
      project_name,
      project_address,
      currency,
      deposit_percent,
      quote_total_inc_gst_cents,
      total_inc_gst_cents,
      total_ex_gst_cents,
      gst_cents,
      payment_instructions,
      created_by
    )
    values (
      v_project.id,
      v_quote.id,
      v_version.id,
      v_quote.quote_ref,
      v_version.version_number,
      public.next_deposit_invoice_ref(),
      'OPEN',
      v_issue_date,
      v_issue_date + 7,
      'Deposit for Quote ' || v_quote.quote_ref ||
        case when nullif(trim(v_project.name), '') is not null
          then ' - ' || trim(v_project.name)
          else ''
        end,
      v_version.customer_name,
      v_project.name,
      v_project.site_address,
      'NZD',
      v_version.deposit_percent,
      v_version.total_inc_gst_cents,
      v_deposit_inc,
      v_deposit_ex,
      v_gst,
      E'Please make payment directly to our bank account:\nSanctuary Pergolas Ltd.\nBank details: 06-0185-0845164-00\nPlease include invoice number',
      p_actor
    )
    returning * into v_invoice;
    v_invoice_created := true;
  end if;

  return query
  select v_version.id, v_invoice.id, v_invoice_created, v_already_accepted;
end;
$$;

create or replace function public.commercial_email_prepare(
  p_intent_key text,
  p_kind text,
  p_subject_id uuid,
  p_project_id uuid,
  p_payload_hash text,
  p_protected_payload jsonb,
  p_provider_idempotency_expires_at timestamptz
)
returns table (
  id uuid,
  intent_key text,
  kind text,
  subject_id uuid,
  project_id uuid,
  payload_hash text,
  status text,
  provider_name text,
  provider_idempotency_key text,
  provider_idempotency_expires_at timestamptz,
  provider_message_id text,
  attempt_count integer,
  last_error_code text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_intent private.commercial_email_intents%rowtype;
begin
  if p_intent_key is null
     or length(trim(p_intent_key)) < 8
     or length(trim(p_intent_key)) > 256 then
    raise exception 'commercial email intent key is invalid' using errcode = '22023';
  end if;
  if p_payload_hash !~ '^[0-9a-f]{64}$'
     or jsonb_typeof(p_protected_payload) is distinct from 'object'
     or octet_length(p_protected_payload::text) > 16777216 then
    raise exception 'commercial email protected payload is invalid' using errcode = '22023';
  end if;
  if p_provider_idempotency_expires_at <= now() then
    raise exception 'commercial email idempotency window must be live' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('commercial-email:' || trim(p_intent_key), 0)
  );

  select intent.*
  into v_intent
  from private.commercial_email_intents intent
  where intent.intent_key = trim(p_intent_key)
  for update;

  if found then
    if v_intent.kind <> p_kind
       or v_intent.subject_id <> p_subject_id
       or v_intent.project_id is distinct from p_project_id
       or v_intent.payload_hash <> p_payload_hash then
      raise exception 'commercial email intent already exists with different frozen input'
        using errcode = '23505';
    end if;
  else
    insert into private.commercial_email_intents (
      intent_key,
      kind,
      subject_id,
      project_id,
      payload_hash,
      protected_payload,
      provider_idempotency_key,
      provider_idempotency_expires_at
    )
    values (
      trim(p_intent_key),
      p_kind,
      p_subject_id,
      p_project_id,
      p_payload_hash,
      p_protected_payload,
      'commercial-email/' || gen_random_uuid()::text,
      p_provider_idempotency_expires_at
    )
    returning * into v_intent;
  end if;

  return query
  select
    v_intent.id,
    v_intent.intent_key,
    v_intent.kind,
    v_intent.subject_id,
    v_intent.project_id,
    v_intent.payload_hash,
    v_intent.status,
    v_intent.provider_name,
    v_intent.provider_idempotency_key,
    v_intent.provider_idempotency_expires_at,
    v_intent.provider_message_id,
    v_intent.attempt_count,
    v_intent.last_error_code,
    v_intent.created_at,
    v_intent.updated_at;
end;
$$;

create or replace function public.commercial_quote_prepare_delivery_email(
  p_quote_version_id uuid,
  p_expected_commercial_revision bigint,
  p_intent_key text,
  p_kind text,
  p_subject_id uuid,
  p_project_id uuid,
  p_payload_hash text,
  p_protected_payload jsonb,
  p_provider_idempotency_expires_at timestamptz
)
returns table (intent_id uuid)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_current public.quote_versions%rowtype;
  v_intent_id uuid;
begin
  if p_expected_commercial_revision is null
     or p_expected_commercial_revision < 1 then
    raise exception 'quote commercial revision is required'
      using errcode = '22023';
  end if;
  if p_kind <> 'quote_send' or p_subject_id <> p_quote_version_id then
    raise exception 'quote delivery intent identity is invalid'
      using errcode = '22023';
  end if;

  select version.*
  into strict v_current
  from public.quote_versions version
  where version.id = p_quote_version_id
  for update;

  if v_current.status <> 'DRAFT' then
    raise exception 'Quote is locked' using errcode = '55000';
  end if;
  if v_current.commercial_revision is distinct from p_expected_commercial_revision then
    raise exception 'QUOTE_STALE' using errcode = '40001';
  end if;
  if not v_current.is_current_draft
     and v_current.delivery_prepared_at is null then
    raise exception 'Quote is locked' using errcode = '55000';
  end if;

  select prepared.id
  into strict v_intent_id
  from public.commercial_email_prepare(
    p_intent_key,
    p_kind,
    p_subject_id,
    p_project_id,
    p_payload_hash,
    p_protected_payload,
    p_provider_idempotency_expires_at
  ) prepared;

  if v_current.delivery_prepared_at is null then
    update public.quote_versions
    set
      is_current_draft = false,
      delivery_prepared_at = now()
    where id = p_quote_version_id;
  end if;

  return query select v_intent_id;
end;
$$;

create or replace function public.commercial_email_read(
  p_intent_id uuid
)
returns table (
  id uuid,
  intent_key text,
  kind text,
  subject_id uuid,
  project_id uuid,
  payload_hash text,
  protected_payload jsonb,
  status text,
  provider_name text,
  provider_idempotency_key text,
  provider_idempotency_expires_at timestamptz,
  provider_message_id text,
  attempt_count integer,
  last_error_code text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
  select
    intent.id,
    intent.intent_key,
    intent.kind,
    intent.subject_id,
    intent.project_id,
    intent.payload_hash,
    intent.protected_payload,
    intent.status,
    intent.provider_name,
    intent.provider_idempotency_key,
    intent.provider_idempotency_expires_at,
    intent.provider_message_id,
    intent.attempt_count,
    intent.last_error_code,
    intent.created_at,
    intent.updated_at
  from private.commercial_email_intents intent
  where intent.id = p_intent_id;
$$;

create or replace function public.commercial_email_read_by_key(
  p_intent_key text
)
returns table (
  id uuid,
  intent_key text,
  kind text,
  subject_id uuid,
  project_id uuid,
  payload_hash text,
  protected_payload jsonb,
  status text,
  provider_name text,
  provider_idempotency_key text,
  provider_idempotency_expires_at timestamptz,
  provider_message_id text,
  attempt_count integer,
  last_error_code text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
  select
    intent.id,
    intent.intent_key,
    intent.kind,
    intent.subject_id,
    intent.project_id,
    intent.payload_hash,
    intent.protected_payload,
    intent.status,
    intent.provider_name,
    intent.provider_idempotency_key,
    intent.provider_idempotency_expires_at,
    intent.provider_message_id,
    intent.attempt_count,
    intent.last_error_code,
    intent.created_at,
    intent.updated_at
  from private.commercial_email_intents intent
  where intent.intent_key = trim(p_intent_key);
$$;

create or replace function public.commercial_email_read_unfinished(
  p_kind text,
  p_subject_id uuid
)
returns table (
  id uuid,
  intent_key text,
  kind text,
  subject_id uuid,
  project_id uuid,
  payload_hash text,
  protected_payload jsonb,
  status text,
  provider_name text,
  provider_idempotency_key text,
  provider_idempotency_expires_at timestamptz,
  provider_message_id text,
  attempt_count integer,
  last_error_code text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
  select
    intent.id,
    intent.intent_key,
    intent.kind,
    intent.subject_id,
    intent.project_id,
    intent.payload_hash,
    intent.protected_payload,
    intent.status,
    intent.provider_name,
    intent.provider_idempotency_key,
    intent.provider_idempotency_expires_at,
    intent.provider_message_id,
    intent.attempt_count,
    intent.last_error_code,
    intent.created_at,
    intent.updated_at
  from private.commercial_email_intents intent
  where intent.kind = p_kind
    and intent.subject_id = p_subject_id
    and intent.status <> 'finalised'
  order by intent.created_at desc
  limit 1;
$$;

create or replace function public.commercial_email_mark_dispatching(
  p_intent_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_intent private.commercial_email_intents%rowtype;
begin
  select intent.*
  into strict v_intent
  from private.commercial_email_intents intent
  where intent.id = p_intent_id
  for update;

  if v_intent.status = 'finalised' then
    return;
  end if;
  if v_intent.status = 'needs_attention'
     or v_intent.provider_idempotency_expires_at <= now() then
    update private.commercial_email_intents
    set status = 'needs_attention',
        last_error_code = coalesce(last_error_code, 'IDEMPOTENCY_WINDOW_EXPIRED')
    where id = p_intent_id;
    return;
  end if;
  if v_intent.status = 'provider_accepted' then
    return;
  end if;

  update private.commercial_email_intents
  set status = 'dispatching',
      attempt_count = attempt_count + 1,
      last_error_code = null
  where id = p_intent_id;
end;
$$;

create or replace function public.commercial_email_mark_provider_accepted(
  p_intent_id uuid,
  p_provider_message_id text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_intent private.commercial_email_intents%rowtype;
begin
  if p_provider_message_id is null or length(trim(p_provider_message_id)) = 0 then
    raise exception 'provider message ID is required' using errcode = '22023';
  end if;

  select intent.*
  into strict v_intent
  from private.commercial_email_intents intent
  where intent.id = p_intent_id
  for update;

  if v_intent.status = 'needs_attention' then
    return;
  end if;
  if v_intent.provider_message_id is not null
     and v_intent.provider_message_id <> trim(p_provider_message_id) then
    update private.commercial_email_intents
    set status = 'needs_attention',
        last_error_code = 'PROVIDER_MESSAGE_ID_CONFLICT'
    where id = p_intent_id;
    return;
  end if;
  if exists (
    select 1
    from private.commercial_email_intents other
    where other.provider_name = v_intent.provider_name
      and other.provider_message_id = trim(p_provider_message_id)
      and other.id <> p_intent_id
  ) then
    update private.commercial_email_intents
    set status = 'needs_attention',
        last_error_code = 'PROVIDER_MESSAGE_ID_CONFLICT'
    where id = p_intent_id;
    return;
  end if;

  update private.commercial_email_intents
  set
    status = case when status = 'finalised' then status else 'provider_accepted' end,
    provider_message_id = trim(p_provider_message_id),
    provider_accepted_at = coalesce(provider_accepted_at, now()),
    last_error_code = null
  where id = p_intent_id;
end;
$$;

create or replace function public.commercial_email_mark_failed(
  p_intent_id uuid,
  p_error_code text,
  p_needs_attention boolean default false
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
  update private.commercial_email_intents
  set
    status = case
      when status in ('provider_accepted', 'finalised', 'needs_attention') then status
      when p_needs_attention then 'needs_attention'
      else 'failed'
    end,
    last_error_code = case
      when status in ('provider_accepted', 'finalised', 'needs_attention') then last_error_code
      else left(coalesce(nullif(trim(p_error_code), ''), 'EMAIL_DELIVERY_FAILED'), 96)
    end
  where id = p_intent_id;
end;
$$;

create or replace function public.commercial_email_mark_finalised(
  p_intent_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_status text;
begin
  select status
  into strict v_status
  from private.commercial_email_intents
  where id = p_intent_id
  for update;

  if v_status = 'finalised' then
    return;
  end if;
  if v_status <> 'provider_accepted' then
    raise exception 'commercial email cannot finalise before provider acceptance'
      using errcode = '55000';
  end if;

  update private.commercial_email_intents
  set
    status = 'finalised',
    finalised_at = coalesce(finalised_at, now()),
    last_error_code = null
  where id = p_intent_id;
end;
$$;

revoke all on table private.commercial_email_intents
  from public, anon, authenticated, service_role;

revoke all on function public.commercial_quote_create_draft(
  uuid, uuid, uuid, text, text, text, text, text, text, numeric, date,
  integer, integer, integer, text, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.commercial_quote_create_draft(
  uuid, uuid, uuid, text, text, text, text, text, text, numeric, date,
  integer, integer, integer, text, jsonb, jsonb
) to service_role;

revoke all on function public.commercial_quote_update_draft(
  uuid, bigint, text, text, text, numeric, date, uuid,
  integer, integer, integer, text, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.commercial_quote_update_draft(
  uuid, bigint, text, text, text, numeric, date, uuid,
  integer, integer, integer, text, jsonb, jsonb
) to service_role;

revoke all on function public.commercial_quote_prepare_delivery_email(
  uuid, bigint, text, text, uuid, uuid, text, jsonb, timestamptz
) from public, anon, authenticated;
grant execute on function public.commercial_quote_prepare_delivery_email(
  uuid, bigint, text, text, uuid, uuid, text, jsonb, timestamptz
) to service_role;

revoke all on function public.commercial_accept_quote_and_ensure_invoice(uuid, text)
  from public, anon, authenticated;
grant execute on function public.commercial_accept_quote_and_ensure_invoice(uuid, text)
  to service_role;

revoke all on function public.commercial_email_prepare(
  text, text, uuid, uuid, text, jsonb, timestamptz
) from public, anon, authenticated;
grant execute on function public.commercial_email_prepare(
  text, text, uuid, uuid, text, jsonb, timestamptz
) to service_role;

revoke all on function public.commercial_email_read(uuid)
  from public, anon, authenticated;
grant execute on function public.commercial_email_read(uuid)
  to service_role;

revoke all on function public.commercial_email_read_by_key(text)
  from public, anon, authenticated;
grant execute on function public.commercial_email_read_by_key(text)
  to service_role;

revoke all on function public.commercial_email_read_unfinished(text, uuid)
  from public, anon, authenticated;
grant execute on function public.commercial_email_read_unfinished(text, uuid)
  to service_role;

revoke all on function public.commercial_email_mark_dispatching(uuid)
  from public, anon, authenticated;
grant execute on function public.commercial_email_mark_dispatching(uuid)
  to service_role;

revoke all on function public.commercial_email_mark_provider_accepted(uuid, text)
  from public, anon, authenticated;
grant execute on function public.commercial_email_mark_provider_accepted(uuid, text)
  to service_role;

revoke all on function public.commercial_email_mark_failed(uuid, text, boolean)
  from public, anon, authenticated;
grant execute on function public.commercial_email_mark_failed(uuid, text, boolean)
  to service_role;

revoke all on function public.commercial_email_mark_finalised(uuid)
  from public, anon, authenticated;
grant execute on function public.commercial_email_mark_finalised(uuid)
  to service_role;

notify pgrst, 'reload schema';
