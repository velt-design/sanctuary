create schema if not exists praxis_reporting;
revoke all on schema praxis_reporting from public, anon, authenticated, service_role;

create table if not exists praxis_reporting.source_identity_v1 (
  singleton boolean primary key default true check (singleton),
  source_key text not null check (source_key ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$'),
  connection_id uuid not null,
  environment text not null check (environment ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$'),
  projection_version text not null
    check (projection_version = 'sanctuary.praxis.core.v1'),
  configured_at timestamptz not null default now(),
  configured_by text not null
    check (length(trim(configured_by)) between 1 and 200)
);
revoke all on table praxis_reporting.source_identity_v1
  from public, anon, authenticated, service_role;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'sanctuary_praxis_reader') then
    create role sanctuary_praxis_reader
      nologin
      nosuperuser
      nocreatedb
      nocreaterole
      noinherit
      noreplication
      nobypassrls;
  end if;
end
$$;

alter role sanctuary_praxis_reader
  nologin
  nosuperuser
  nocreatedb
  nocreaterole
  noinherit
  noreplication
  nobypassrls;

-- The group role starts dark. The eventual LOGIN is created out of band, is
-- granted only this role, and has default_transaction_read_only enabled.
do $$
declare
  schema_name text;
begin
  foreach schema_name in array array['public', 'private', 'auth', 'storage'] loop
    if exists (select 1 from pg_namespace where nspname = schema_name) then
      execute format('revoke all on schema %I from sanctuary_praxis_reader', schema_name);
      execute format('revoke all on all tables in schema %I from sanctuary_praxis_reader', schema_name);
      execute format('revoke all on all sequences in schema %I from sanctuary_praxis_reader', schema_name);
      execute format('revoke all on all functions in schema %I from sanctuary_praxis_reader', schema_name);
    end if;
  end loop;
end
$$;

-- Quote-family metadata is mutable. Add a source-owned freshness marker so a
-- changedAfter read cannot miss a renamed family.
alter table public.quotes add column if not exists updated_at timestamptz;
update public.quotes set updated_at = created_at where updated_at is null;
alter table public.quotes
  alter column updated_at set default now(),
  alter column updated_at set not null;
drop trigger if exists quotes_set_updated_at on public.quotes;
create trigger quotes_set_updated_at
before update on public.quotes
for each row execute function public.set_updated_at();

-- Invoice-plan assignment and cancellation can happen after creation. Track
-- every mutation so changedAfter cannot miss a later invoice_id assignment.
alter table public.project_invoice_plan_items add column if not exists updated_at timestamptz;
update public.project_invoice_plan_items set updated_at = greatest(
  created_at,
  coalesce(cancelled_at, created_at)
) where updated_at is null;
alter table public.project_invoice_plan_items
  alter column updated_at set default now(),
  alter column updated_at set not null;
drop trigger if exists project_invoice_plan_items_set_updated_at on public.project_invoice_plan_items;
create trigger project_invoice_plan_items_set_updated_at
before update on public.project_invoice_plan_items
for each row execute function public.set_updated_at();

-- The existing function remains the sole owner of accepted, paid, open, and
-- remaining totals. Permit only the dedicated reporting group through its
-- existing internal authorization boundary; do not grant the function itself.
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
  if auth.role() <> 'service_role'
     and not public.has_portal_access()
     and not pg_has_role(session_user, 'sanctuary_praxis_reader', 'member') then
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

create or replace function praxis_reporting.version_v1(p_payload jsonb)
returns text
language sql
immutable
strict
security definer
set search_path = pg_catalog, pg_temp
as $$
  select encode(
    extensions.digest(convert_to(p_payload::text, 'UTF8'), 'sha256'),
    'hex'
  );
$$;

create or replace function praxis_reporting.forbidden_nested_key_v1(p_key text)
returns boolean
language sql
immutable
strict
security invoker
set search_path = pg_catalog, pg_temp
as $$
  with normalized as (
    select lower(regexp_replace(p_key, '[^a-zA-Z0-9]', '', 'g')) as value
  )
  select value = any (array[
      'rawpayload', 'commercialdesigninput', 'protectedpayload',
      'privatepayload', 'executionpayload', 'auditjson',
      'file', 'files', 'fileid', 'filepath', 'storagepath', 'pathtokens',
      'contentbase64', 'pdfbody', 'pdfdata',
      'emailbody', 'emailhtml', 'emailtext', 'recipient', 'recipients',
      'to', 'cc', 'bcc', 'providerid', 'providermessageid', 'providererror'
    ])
    or value ~ '^(raw|privateexecution)'
    or value ~ '(secret|credential|password|passphrase|token|cookie|authorization|privatekey|apikey|accesskey)'
    or (value ~ 'hash$' and value <> 'commercialinputhash')
  from normalized;
$$;

create or replace function praxis_reporting.sanitize_json_internal_v1(
  p_value jsonb,
  p_depth integer,
  p_remaining_entries integer
)
returns table (
  sanitized jsonb,
  child_entries integer,
  redaction_count integer,
  omission_count integer,
  categories text[]
)
language plpgsql
immutable
strict
security invoker
set search_path = pg_catalog, pg_temp
as $$
declare
  result jsonb;
  item record;
  child record;
  used_entries integer := 0;
  redactions integer := 0;
  omissions integer := 0;
  found_categories text[] := array[]::text[];
  marker constant jsonb := '{"_praxisOmitted":"source_bounds_v1"}'::jsonb;
begin
  if p_depth > 8
     or p_remaining_entries < 0
     or octet_length(convert_to(p_value::text, 'UTF8')) > 65536 then
    return query select marker, 1, 0, 1, array['source_bounds']::text[];
    return;
  end if;

  case jsonb_typeof(p_value)
    when 'object' then
      if p_depth >= 8 and p_value <> '{}'::jsonb then
        return query select marker, 1, 0, 1, array['source_bounds']::text[];
        return;
      end if;
      result := '{}'::jsonb;
      for item in select entry.key, entry.value from jsonb_each(p_value) entry order by entry.key loop
        if praxis_reporting.forbidden_nested_key_v1(item.key)
           or (
             lower(regexp_replace(item.key, '[^a-zA-Z0-9]', '', 'g')) = 'commercialinputhash'
             and (
               jsonb_typeof(item.value) <> 'string'
               or (item.value #>> '{}') !~ '^[0-9a-f]{64}$'
             )
           ) then
          redactions := redactions + 1;
          found_categories := array_append(found_categories, 'credential_key');
          continue;
        end if;
        if used_entries + 1 > p_remaining_entries then
          return query select marker, 1, 0, 1, array['source_bounds']::text[];
          return;
        end if;
        select * into child from praxis_reporting.sanitize_json_internal_v1(
          item.value,
          p_depth + 1,
          p_remaining_entries - used_entries - 1
        );
        if used_entries + 1 + child.child_entries > p_remaining_entries then
          return query select marker, 1, 0, 1, array['source_bounds']::text[];
          return;
        end if;
        result := result || jsonb_build_object(item.key, child.sanitized);
        used_entries := used_entries + 1 + child.child_entries;
        redactions := redactions + child.redaction_count;
        omissions := omissions + child.omission_count;
        found_categories := found_categories || child.categories;
      end loop;
    when 'array' then
      if (p_depth >= 8 and p_value <> '[]'::jsonb)
         or jsonb_array_length(p_value) > p_remaining_entries then
        return query select marker, 1, 0, 1, array['source_bounds']::text[];
        return;
      end if;
      result := '[]'::jsonb;
      for item in select entry.value from jsonb_array_elements(p_value) with ordinality entry(value, ordinality) order by entry.ordinality loop
        select * into child from praxis_reporting.sanitize_json_internal_v1(
          item.value,
          p_depth + 1,
          p_remaining_entries - used_entries - 1
        );
        if used_entries + 1 + child.child_entries > p_remaining_entries then
          return query select marker, 1, 0, 1, array['source_bounds']::text[];
          return;
        end if;
        result := result || jsonb_build_array(child.sanitized);
        used_entries := used_entries + 1 + child.child_entries;
        redactions := redactions + child.redaction_count;
        omissions := omissions + child.omission_count;
        found_categories := found_categories || child.categories;
      end loop;
    when 'string' then
      if (p_value #>> '{}') ~* '(bearer[[:space:]]+[a-z0-9._~+/-]{16,}|-----begin [a-z ]*private key-----|sk-[a-z0-9_-]{16,})' then
        return query select to_jsonb('[redacted]'::text), 0, 1, 0, array['credential_value']::text[];
        return;
      end if;
      result := p_value;
    else
      result := p_value;
  end case;
  return query select result, used_entries, redactions, omissions, (
    select coalesce(array_agg(distinct category order by category), array[]::text[])
    from unnest(found_categories) category
  );
end;
$$;

create or replace function praxis_reporting.safe_payload_v1(p_payload jsonb)
returns table (
  payload jsonb,
  policy_version text,
  redaction_count integer,
  omission_count integer,
  categories text[]
)
language plpgsql
immutable
strict
security invoker
set search_path = pg_catalog, pg_temp
as $$
declare
  result jsonb := '{}'::jsonb;
  item record;
  child record;
  largest record;
  evidence jsonb := '{}'::jsonb;
  root_redactions integer := 0;
  used_entries integer := 0;
  redactions integer := 0;
  omissions integer := 0;
  found_categories text[] := array[]::text[];
  marker constant jsonb := '{"_praxisOmitted":"source_bounds_v1"}'::jsonb;
begin
  if jsonb_typeof(p_payload) <> 'object'
     or (select count(*) from jsonb_each(p_payload)) > 256 then
    raise exception 'Praxis payload root exceeds the v1 schema bounds' using errcode = '54000';
  end if;

  for item in select entry.key, entry.value from jsonb_each(p_payload) entry order by entry.key loop
    if praxis_reporting.forbidden_nested_key_v1(item.key) then
      root_redactions := root_redactions + 1;
      continue;
    end if;
    select * into child from praxis_reporting.sanitize_json_internal_v1(
      item.value,
      1,
      256 - used_entries - 1
    );
    if used_entries + 1 + child.child_entries > 256 then
      child.sanitized := marker;
      child.child_entries := 1;
      child.redaction_count := 0;
      child.omission_count := 1;
      child.categories := array['source_bounds']::text[];
    end if;
    result := result || jsonb_build_object(item.key, child.sanitized);
    evidence := evidence || jsonb_build_object(item.key, jsonb_build_object(
      'redactionCount', child.redaction_count,
      'omissionCount', child.omission_count,
      'categories', to_jsonb(child.categories)
    ));
    used_entries := used_entries + 1 + child.child_entries;
  end loop;

  while octet_length(convert_to(result::text, 'UTF8')) > 65536 loop
    select entry.key, entry.value into largest
    from jsonb_each(result) entry
    where entry.value <> marker
    order by octet_length(convert_to(entry.value::text, 'UTF8')) desc, entry.key
    limit 1;
    if largest.key is null then
      raise exception 'Praxis payload cannot fit the v1 byte bound' using errcode = '54000';
    end if;
    result := jsonb_set(result, array[largest.key], marker, false);
    evidence := jsonb_set(evidence, array[largest.key], jsonb_build_object(
      'redactionCount', 0,
      'omissionCount', 1,
      'categories', jsonb_build_array('source_bounds')
    ), false);
  end loop;

  redactions := root_redactions;
  omissions := 0;
  found_categories := case
    when root_redactions > 0 then array['credential_key']::text[]
    else array[]::text[]
  end;
  for item in select entry.value from jsonb_each(evidence) entry loop
    redactions := redactions + (item.value ->> 'redactionCount')::integer;
    omissions := omissions + (item.value ->> 'omissionCount')::integer;
    found_categories := found_categories || array(
      select jsonb_array_elements_text(item.value -> 'categories')
    );
  end loop;

  return query select
    result,
    'sanctuary.praxis.sanitizer.v1'::text,
    redactions,
    omissions,
    (select coalesce(array_agg(distinct category order by category), array[]::text[])
     from unnest(found_categories) category);
end;
$$;

create or replace view praxis_reporting.enquiry_requests_v1
with (security_barrier = true)
as
select
  'enquiry_request'::text as resource,
  enquiry.id,
  enquiry.project_id,
  coalesce(enquiry.project_id, enquiry.contact_id) as parent_id,
  enquiry.updated_at as recorded_at,
  praxis_reporting.version_v1(payload.payload) as record_version,
  payload.payload,
  payload.policy_version,
  payload.redaction_count,
  payload.omission_count,
  payload.categories as redaction_categories
from public.enquiry_requests enquiry
cross join lateral (values (jsonb_build_object(
  'contactId', enquiry.contact_id,
  'projectId', enquiry.project_id,
  'enquiryType', enquiry.enquiry_type,
  'suburb', enquiry.suburb,
  'message', enquiry.message,
  'widthM', enquiry.width_m,
  'depthM', enquiry.depth_m,
  'heightM', enquiry.height_m,
  'style', enquiry.style,
  'roofMaterials', enquiry.roof_materials,
  'addOns', enquiry.add_ons,
  'baseBudgetLowIncGst', enquiry.base_budget_low_inc_gst,
  'baseBudgetHighIncGst', enquiry.base_budget_high_inc_gst,
  'blindsBudgetLowIncGst', enquiry.blinds_budget_low_inc_gst,
  'blindsBudgetHighIncGst', enquiry.blinds_budget_high_inc_gst,
  'budgetBasis', enquiry.budget_basis,
  'company', enquiry.company,
  'source', enquiry.source,
  'page', enquiry.page,
  'utm', enquiry.utm,
  'createdAt', enquiry.created_at,
  'updatedAt', enquiry.updated_at
))) assembled(value)
cross join lateral praxis_reporting.safe_payload_v1(assembled.value) payload;

create or replace view praxis_reporting.contacts_v1
with (security_barrier = true)
as
select
  'contact'::text as resource,
  contact.id,
  null::uuid as project_id,
  null::uuid as parent_id,
  contact.updated_at as recorded_at,
  praxis_reporting.version_v1(payload.payload) as record_version,
  payload.payload,
  payload.policy_version,
  payload.redaction_count,
  payload.omission_count,
  payload.categories as redaction_categories
from public.contacts contact
cross join lateral (values (jsonb_build_object(
  'name', contact.name,
  'email', contact.email,
  'phone', contact.phone,
  'address', contact.address,
  'createdAt', contact.created_at,
  'updatedAt', contact.updated_at
))) assembled(value)
cross join lateral praxis_reporting.safe_payload_v1(assembled.value) payload;

create or replace view praxis_reporting.projects_v1
with (security_barrier = true)
as
select
  'project'::text as resource,
  project.id,
  project.id as project_id,
  project.contact_id as parent_id,
  project.updated_at as recorded_at,
  praxis_reporting.version_v1(payload.payload) as record_version,
  payload.payload,
  payload.policy_version,
  payload.redaction_count,
  payload.omission_count,
  payload.categories as redaction_categories
from public.projects project
cross join lateral (values (jsonb_build_object(
  'contactId', project.contact_id,
  'name', project.name,
  'quoteRef', project.quote_ref,
  'region', project.region,
  'siteAddress', project.site_address,
  'pipelineStage', project.pipeline_stage,
  'siteVisitPriorityTier', project.site_visit_priority_tier,
  'followUpDate', project.follow_up_date,
  'archivedAt', project.archived_at,
  'notes', project.notes,
  'depositAmountCents', project.deposit_amount_cents,
  'depositPaidDate', project.deposit_paid_date,
  'depositReceivedAt', project.deposit_received_at,
  'finalPaymentDate', project.final_payment_date,
  'nextActionAt', project.next_action_at,
  'nextActionType', project.next_action_type,
  'nextAction', project.next_action,
  'nextActionDate', project.next_action_date,
  'version', project.version,
  'createdAt', project.created_at,
  'updatedAt', project.updated_at
))) assembled(value)
cross join lateral praxis_reporting.safe_payload_v1(assembled.value) payload;

create or replace view praxis_reporting.estimates_v1
with (security_barrier = true)
as
select
  'estimate'::text as resource,
  estimate.id,
  estimate.project_id,
  estimate.project_id as parent_id,
  estimate.updated_at as recorded_at,
  praxis_reporting.version_v1(payload.payload) as record_version,
  payload.payload,
  payload.policy_version,
  payload.redaction_count,
  payload.omission_count,
  payload.categories as redaction_categories
from public.estimates estimate
cross join lateral (values (jsonb_build_object(
  'projectId', estimate.project_id,
  'commercialScopeId', estimate.commercial_scope_id,
  'internalName', estimate.internal_name,
  'status', estimate.status,
  'version', estimate.version,
  'createdBy', estimate.created_by,
  'summaryJson', estimate.summary_json,
  'internalNotes', estimate.internal_notes,
  'summary', estimate.summary,
  'crewHours', estimate.crew_hours,
  'durationDays', estimate.duration_days,
  'materialsExGst', estimate.materials_ex_gst,
  'installPayoutExGst', estimate.install_payout_ex_gst,
  'overheadExGst', estimate.overhead_ex_gst,
  'totalTrueCostExGst', estimate.total_true_cost_ex_gst,
  'totalTrueCostIncGst', estimate.total_true_cost_inc_gst,
  'inputs', estimate.inputs,
  'outputs', estimate.outputs,
  'warnings', estimate.warnings,
  'costingManifest', estimate.costing_manifest,
  'costingRules', estimate.costing_rules,
  'costingConfigVersionId', estimate.costing_config_version_id,
  'pricingSource', estimate.pricing_source,
  'pricingSourceMetadata', estimate.pricing_source_metadata,
  'createdAt', estimate.created_at,
  'updatedAt', estimate.updated_at
))) assembled(value)
cross join lateral praxis_reporting.safe_payload_v1(assembled.value) payload;

create or replace view praxis_reporting.quotes_v1
with (security_barrier = true)
as
select
  'quote'::text as resource,
  quote.id,
  quote.project_id,
  quote.project_id as parent_id,
  quote.updated_at as recorded_at,
  praxis_reporting.version_v1(payload.payload) as record_version,
  payload.payload,
  payload.policy_version,
  payload.redaction_count,
  payload.omission_count,
  payload.categories as redaction_categories
from public.quotes quote
cross join lateral (values (jsonb_build_object(
  'projectId', quote.project_id,
  'commercialScopeId', quote.commercial_scope_id,
  'quoteRef', quote.quote_ref,
  'internalName', quote.internal_name,
  'createdBy', quote.created_by,
  'createdAt', quote.created_at,
  'updatedAt', quote.updated_at
))) assembled(value)
cross join lateral praxis_reporting.safe_payload_v1(assembled.value) payload;

create or replace view praxis_reporting.quote_versions_v1
with (security_barrier = true)
as
select
  'quote_version'::text as resource,
  version.id,
  quote.project_id,
  version.quote_id as parent_id,
  version.updated_at as recorded_at,
  praxis_reporting.version_v1(payload.payload) as record_version,
  payload.payload,
  payload.policy_version,
  payload.redaction_count,
  payload.omission_count,
  payload.categories as redaction_categories
from public.quote_versions version
join public.quotes quote on quote.id = version.quote_id
cross join lateral (values (jsonb_build_object(
  'quoteId', version.quote_id,
  'versionNumber', version.version_number,
  'status', version.status,
  'sourceEstimateVersionId', version.source_estimate_version_id,
  'revisedFromQuoteVersionId', version.revised_from_quote_version_id,
  'createdBy', version.created_by,
  'sentAt', version.sent_at,
  'sentBy', version.sent_by,
  'acceptedAt', version.accepted_at,
  'supersededAt', version.superseded_at,
  'supersededBy', version.superseded_by,
  'expiresAt', version.expires_at,
  'reference', version.reference,
  'customerName', version.customer_name,
  'introText', version.intro_text,
  'termsText', version.terms_text,
  'totalIncGstCents', version.total_inc_gst_cents,
  'totalExGstCents', version.total_ex_gst_cents,
  'gstCents', version.gst_cents,
  'hasPdf', version.pdf_file_id is not null,
  'depositPercent', version.deposit_percent,
  'paymentTerms', version.payment_terms,
  'pricingSource', version.pricing_source,
  'pricingSourceMetadata', version.pricing_source_metadata,
  'commercialRevision', version.commercial_revision,
  'isCurrentDraft', version.is_current_draft,
  'deliveryPreparedAt', version.delivery_prepared_at,
  'createdAt', version.created_at,
  'updatedAt', version.updated_at
))) assembled(value)
cross join lateral praxis_reporting.safe_payload_v1(assembled.value) payload;

create or replace view praxis_reporting.quote_line_items_v1
with (security_barrier = true)
as
select
  'quote_line_item'::text as resource,
  item.id,
  quote.project_id,
  item.quote_version_id as parent_id,
  item.updated_at as recorded_at,
  praxis_reporting.version_v1(payload.payload) as record_version,
  payload.payload,
  payload.policy_version,
  payload.redaction_count,
  payload.omission_count,
  payload.categories as redaction_categories
from public.quote_line_items item
join public.quote_versions version on version.id = item.quote_version_id
join public.quotes quote on quote.id = version.quote_id
cross join lateral (values (jsonb_build_object(
  'quoteVersionId', item.quote_version_id,
  'sortOrder', item.sort_order,
  'description', item.description,
  'quantity', item.qty,
  'unitPriceIncGstCents', item.unit_price_inc_gst_cents,
  'lineTotalIncGstCents', item.line_total_inc_gst_cents,
  'createdAt', item.created_at,
  'updatedAt', item.updated_at
))) assembled(value)
cross join lateral praxis_reporting.safe_payload_v1(assembled.value) payload;

create or replace view praxis_reporting.invoices_v1
with (security_barrier = true)
as
select
  'invoice'::text as resource,
  invoice.id,
  invoice.project_id,
  invoice.quote_version_id as parent_id,
  invoice.updated_at as recorded_at,
  praxis_reporting.version_v1(payload.payload) as record_version,
  payload.payload,
  payload.policy_version,
  payload.redaction_count,
  payload.omission_count,
  payload.categories as redaction_categories
from public.deposit_invoices invoice
cross join lateral (values (jsonb_build_object(
  'projectId', invoice.project_id,
  'quoteId', invoice.quote_id,
  'quoteVersionId', invoice.quote_version_id,
  'quoteRef', invoice.quote_ref,
  'quoteVersionNumber', invoice.quote_version_number,
  'invoiceRef', invoice.invoice_ref,
  'status', invoice.status,
  'issueDate', invoice.issue_date,
  'dueDate', invoice.due_date,
  'reference', invoice.reference,
  'customerName', invoice.customer_name,
  'projectName', invoice.project_name,
  'projectAddress', invoice.project_address,
  'currency', invoice.currency,
  'depositPercent', invoice.deposit_percent,
  'quoteTotalIncGstCents', invoice.quote_total_inc_gst_cents,
  'totalIncGstCents', invoice.total_inc_gst_cents,
  'totalExGstCents', invoice.total_ex_gst_cents,
  'gstCents', invoice.gst_cents,
  'paymentInstructions', invoice.payment_instructions,
  'hasPdf', invoice.pdf_file_id is not null,
  'sentAt', invoice.sent_at,
  'sentBy', invoice.sent_by,
  'createdBy', invoice.created_by,
  'voidedAt', invoice.voided_at,
  'voidedBy', invoice.voided_by,
  'voidReason', invoice.void_reason,
  'replacedByInvoiceId', invoice.replaced_by_invoice_id,
  'paymentTermId', invoice.payment_term_id,
  'paymentTermLabel', invoice.payment_term_label,
  'paymentTermPosition', invoice.payment_term_position,
  'paymentTermCount', invoice.payment_term_count,
  'paymentTermCalculation', invoice.payment_term_calculation,
  'paymentTermPercentage', invoice.payment_term_percentage,
  'creationMode', invoice.creation_mode,
  'creationOverrideReason', invoice.creation_override_reason,
  'invoicePlanItemId', invoice.invoice_plan_item_id,
  'paidAt', invoice.paid_at,
  'paidBy', invoice.paid_by,
  'paymentMethod', invoice.payment_method,
  'paymentReference', invoice.payment_reference,
  'paymentNote', invoice.payment_note,
  'createdAt', invoice.created_at,
  'updatedAt', invoice.updated_at
))) assembled(value)
cross join lateral praxis_reporting.safe_payload_v1(assembled.value) payload;

create or replace view praxis_reporting.invoice_plan_items_v1
with (security_barrier = true)
as
select
  'invoice_plan_item'::text as resource,
  item.id,
  item.project_id,
  item.quote_version_id as parent_id,
  item.updated_at as recorded_at,
  praxis_reporting.version_v1(payload.payload) as record_version,
  payload.payload,
  payload.policy_version,
  payload.redaction_count,
  payload.omission_count,
  payload.categories as redaction_categories
from public.project_invoice_plan_items item
cross join lateral (values (jsonb_build_object(
  'projectId', item.project_id,
  'quoteVersionId', item.quote_version_id,
  'planGroupId', item.plan_group_id,
  'paymentTermId', item.payment_term_id,
  'label', item.label,
  'position', item.position,
  'itemCount', item.item_count,
  'amountIncGstCents', item.amount_inc_gst_cents,
  'invoiceId', item.invoice_id,
  'createdBy', item.created_by,
  'cancelledAt', item.cancelled_at,
  'cancelledBy', item.cancelled_by,
  'cancellationReason', item.cancellation_reason,
  'createdAt', item.created_at,
  'updatedAt', item.updated_at
))) assembled(value)
cross join lateral praxis_reporting.safe_payload_v1(assembled.value) payload;

create or replace view praxis_reporting.payments_v1
with (security_barrier = true)
as
select
  'payment'::text as resource,
  entry.id,
  entry.project_id,
  entry.project_id as parent_id,
  greatest(entry.created_at, entry.occurred_at) as recorded_at,
  praxis_reporting.version_v1(payload.payload) as record_version,
  payload.payload,
  payload.policy_version,
  payload.redaction_count,
  payload.omission_count,
  payload.categories as redaction_categories
from public.project_payment_entries entry
cross join lateral (values (jsonb_build_object(
  'projectId', entry.project_id,
  'sourceInvoiceId', entry.source_invoice_id,
  'entryType', entry.entry_type,
  'amountIncGstCents', entry.amount_inc_gst_cents,
  'occurredAt', entry.occurred_at,
  'paymentMethod', entry.payment_method,
  'reference', entry.reference,
  'note', entry.note,
  'reason', entry.reason,
  'reversesEntryId', entry.reverses_entry_id,
  'createdBy', entry.created_by,
  'createdAt', entry.created_at
))) assembled(value)
cross join lateral praxis_reporting.safe_payload_v1(assembled.value) payload;

create or replace view praxis_reporting.payment_allocations_v1
with (security_barrier = true)
as
select
  'payment_allocation'::text as resource,
  allocation.id,
  allocation.project_id,
  allocation.payment_entry_id as parent_id,
  greatest(allocation.created_at, coalesce(allocation.reversed_at, allocation.created_at)) as recorded_at,
  praxis_reporting.version_v1(payload.payload) as record_version,
  payload.payload,
  payload.policy_version,
  payload.redaction_count,
  payload.omission_count,
  payload.categories as redaction_categories
from public.project_payment_allocations allocation
cross join lateral (values (jsonb_build_object(
  'projectId', allocation.project_id,
  'paymentEntryId', allocation.payment_entry_id,
  'quoteVersionId', allocation.quote_version_id,
  'paymentTermId', allocation.payment_term_id,
  'amountIncGstCents', allocation.amount_inc_gst_cents,
  'changeReason', allocation.change_reason,
  'createdBy', allocation.created_by,
  'reversedAt', allocation.reversed_at,
  'reversedBy', allocation.reversed_by,
  'reversalReason', allocation.reversal_reason,
  'createdAt', allocation.created_at
))) assembled(value)
cross join lateral praxis_reporting.safe_payload_v1(assembled.value) payload;

create or replace function praxis_reporting.project_financial_truth_for_v1(
  p_project_id uuid
)
returns table (
  accepted_quote_versions jsonb,
  accepted_total_inc_gst_cents integer,
  paid_inc_gst_cents integer,
  open_invoice_inc_gst_cents integer,
  remaining_to_invoice_inc_gst_cents integer,
  over_committed_inc_gst_cents integer,
  latest_payment_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
  select
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'quoteVersionId', accepted.quote_version_id,
        'quoteId', accepted.quote_id,
        'totalIncGstCents', accepted.total_inc_gst_cents
      ) order by accepted.quote_id, accepted.quote_version_id)
      from public.commercial_current_accepted_quote_versions(p_project_id) accepted
    ), '[]'::jsonb),
    truth.accepted_total_inc_gst_cents,
    truth.paid_inc_gst_cents,
    truth.open_invoice_inc_gst_cents,
    truth.remaining_to_invoice_inc_gst_cents,
    truth.over_committed_inc_gst_cents,
    truth.latest_payment_at
  from public.commercial_project_financial_truth(p_project_id) truth;
$$;

create or replace view praxis_reporting.project_financial_truth_v1
with (security_barrier = true)
as
select
  'project_financial_truth'::text as resource,
  project.id,
  project.id as project_id,
  project.id as parent_id,
  freshness.recorded_at,
  praxis_reporting.version_v1(payload.payload) as record_version,
  payload.payload,
  payload.policy_version,
  payload.redaction_count,
  payload.omission_count,
  payload.categories as redaction_categories
from public.projects project
cross join lateral praxis_reporting.project_financial_truth_for_v1(project.id) truth
cross join lateral (
  select greatest(
    project.updated_at,
    coalesce((select max(version.updated_at) from public.quote_versions version join public.quotes quote on quote.id = version.quote_id where quote.project_id = project.id), project.updated_at),
    coalesce((select max(invoice.updated_at) from public.deposit_invoices invoice where invoice.project_id = project.id), project.updated_at),
    coalesce((select max(greatest(entry.created_at, entry.occurred_at)) from public.project_payment_entries entry where entry.project_id = project.id), project.updated_at),
    coalesce((select max(item.updated_at) from public.project_invoice_plan_items item where item.project_id = project.id), project.updated_at),
    coalesce((select max(greatest(allocation.created_at, coalesce(allocation.reversed_at, allocation.created_at))) from public.project_payment_allocations allocation where allocation.project_id = project.id), project.updated_at)
  ) as recorded_at
) freshness
cross join lateral (values (jsonb_build_object(
  'projectId', project.id,
  'acceptedQuoteVersions', truth.accepted_quote_versions,
  'acceptedTotalIncGstCents', truth.accepted_total_inc_gst_cents,
  'paidIncGstCents', truth.paid_inc_gst_cents,
  'openInvoiceIncGstCents', truth.open_invoice_inc_gst_cents,
  'remainingToInvoiceIncGstCents', truth.remaining_to_invoice_inc_gst_cents,
  'overCommittedIncGstCents', truth.over_committed_inc_gst_cents,
  'latestPaymentAt', truth.latest_payment_at
))) assembled(value)
cross join lateral praxis_reporting.safe_payload_v1(assembled.value) payload;

create or replace function praxis_reporting.context_page_v1(
  p_resource text,
  p_project_id uuid,
  p_changed_after timestamptz,
  p_as_of timestamptz,
  p_after_recorded_at timestamptz,
  p_after_resource text,
  p_after_id uuid,
  p_limit integer
)
returns table (
  resource text,
  id uuid,
  project_id uuid,
  parent_id uuid,
  recorded_at timestamptz,
  record_version text,
  payload jsonb,
  policy_version text,
  redaction_count integer,
  omission_count integer,
  redaction_categories text[]
)
language plpgsql
stable
security invoker
set search_path = pg_catalog, pg_temp
as $$
begin
  if p_resource not in (
    'all', 'enquiry_request', 'contact', 'project', 'estimate', 'quote',
    'quote_version', 'quote_line_item', 'invoice', 'invoice_plan_item',
    'payment', 'payment_allocation', 'project_financial_truth'
  ) then
    raise exception 'unsupported resource' using errcode = '22023';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 101 then
    raise exception 'limit must be between 1 and 101' using errcode = '22023';
  end if;
  if p_as_of is null then
    raise exception 'as-of timestamp is required' using errcode = '22023';
  end if;
  if num_nonnulls(p_after_recorded_at, p_after_resource, p_after_id) not in (0, 3) then
    raise exception 'cursor components must be supplied together' using errcode = '22023';
  end if;

  return query
  with records as (
    select * from praxis_reporting.enquiry_requests_v1
    union all select * from praxis_reporting.contacts_v1
    union all select * from praxis_reporting.projects_v1
    union all select * from praxis_reporting.estimates_v1
    union all select * from praxis_reporting.quotes_v1
    union all select * from praxis_reporting.quote_versions_v1
    union all select * from praxis_reporting.quote_line_items_v1
    union all select * from praxis_reporting.invoices_v1
    union all select * from praxis_reporting.invoice_plan_items_v1
    union all select * from praxis_reporting.payments_v1
    union all select * from praxis_reporting.payment_allocations_v1
    union all select * from praxis_reporting.project_financial_truth_v1
  )
  select row.resource, row.id, row.project_id, row.parent_id,
    row.recorded_at, row.record_version, row.payload, row.policy_version,
    row.redaction_count, row.omission_count, row.redaction_categories
  from records row
  where (p_resource = 'all' or row.resource = p_resource)
    and row.recorded_at <= p_as_of
    and (p_changed_after is null or row.recorded_at > p_changed_after)
    and (
      p_project_id is null
      or row.project_id = p_project_id
      or (
        row.resource = 'contact'
        and exists (
          select 1 from praxis_reporting.projects_v1 project
          where project.id = p_project_id
            and project.parent_id = row.id
        )
      )
    )
    and (
      p_after_recorded_at is null
      or (row.recorded_at, row.resource, row.id)
        > (p_after_recorded_at, p_after_resource, p_after_id)
    )
  order by row.recorded_at, row.resource, row.id
  limit p_limit;
end;
$$;

revoke all on function public.commercial_project_financial_truth(uuid)
  from sanctuary_praxis_reader;
revoke all on function public.commercial_current_accepted_quote_versions(uuid)
  from sanctuary_praxis_reader;
revoke all on function praxis_reporting.version_v1(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function praxis_reporting.forbidden_nested_key_v1(text)
  from public, anon, authenticated, service_role;
revoke all on function praxis_reporting.sanitize_json_internal_v1(jsonb, integer, integer)
  from public, anon, authenticated, service_role;
revoke all on function praxis_reporting.safe_payload_v1(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function praxis_reporting.project_financial_truth_for_v1(uuid)
  from public, anon, authenticated, service_role;
revoke all on function praxis_reporting.context_page_v1(
  text, uuid, timestamptz, timestamptz, timestamptz, text, uuid, integer
) from public, anon, authenticated, service_role;

grant usage on schema praxis_reporting to sanctuary_praxis_reader;
grant select on praxis_reporting.source_identity_v1 to sanctuary_praxis_reader;
grant execute on function praxis_reporting.version_v1(jsonb)
  to sanctuary_praxis_reader;
grant execute on function praxis_reporting.forbidden_nested_key_v1(text)
  to sanctuary_praxis_reader;
grant execute on function praxis_reporting.sanitize_json_internal_v1(jsonb, integer, integer)
  to sanctuary_praxis_reader;
grant execute on function praxis_reporting.safe_payload_v1(jsonb)
  to sanctuary_praxis_reader;
grant execute on function praxis_reporting.project_financial_truth_for_v1(uuid)
  to sanctuary_praxis_reader;
grant select on
  praxis_reporting.enquiry_requests_v1,
  praxis_reporting.contacts_v1,
  praxis_reporting.projects_v1,
  praxis_reporting.estimates_v1,
  praxis_reporting.quotes_v1,
  praxis_reporting.quote_versions_v1,
  praxis_reporting.quote_line_items_v1,
  praxis_reporting.invoices_v1,
  praxis_reporting.invoice_plan_items_v1,
  praxis_reporting.payments_v1,
  praxis_reporting.payment_allocations_v1,
  praxis_reporting.project_financial_truth_v1
to sanctuary_praxis_reader;
grant execute on function praxis_reporting.context_page_v1(
  text, uuid, timestamptz, timestamptz, timestamptz, text, uuid, integer
) to sanctuary_praxis_reader;

comment on schema praxis_reporting is
  'Versioned, allowlisted, read-only Sanctuary business projections for Praxis.';
comment on function praxis_reporting.context_page_v1(
  text, uuid, timestamptz, timestamptz, timestamptz, text, uuid, integer
) is
  'Bounded keyset page over Sanctuary Praxis reporting v1. Call in a read-only transaction.';
