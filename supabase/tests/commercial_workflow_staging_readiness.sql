-- Read-only staging preflight/postflight for the commercial workflow migration.
-- Returns schema readiness and aggregate collision counts only; no customer
-- values or record identifiers are selected.

with required_columns(table_name, column_name) as (
  values
    ('estimates', 'id'),
    ('estimates', 'project_id'),
    ('projects', 'id'),
    ('projects', 'name'),
    ('projects', 'site_address'),
    ('quotes', 'id'),
    ('quotes', 'project_id'),
    ('quotes', 'quote_ref'),
    ('quote_versions', 'id'),
    ('quote_versions', 'quote_id'),
    ('quote_versions', 'version_number'),
    ('quote_versions', 'status'),
    ('quote_versions', 'source_estimate_version_id'),
    ('quote_versions', 'revised_from_quote_version_id'),
    ('quote_versions', 'created_by'),
    ('quote_versions', 'customer_name'),
    ('quote_versions', 'reference'),
    ('quote_versions', 'intro_text'),
    ('quote_versions', 'terms_text'),
    ('quote_versions', 'deposit_percent'),
    ('quote_versions', 'expires_at'),
    ('quote_versions', 'total_inc_gst_cents'),
    ('quote_versions', 'total_ex_gst_cents'),
    ('quote_versions', 'gst_cents'),
    ('quote_versions', 'pricing_source'),
    ('quote_versions', 'pricing_source_metadata'),
    ('quote_versions', 'pdf_file_id'),
    ('quote_versions', 'render_hash'),
    ('quote_versions', 'preview_base_payload'),
    ('quote_versions', 'preview_rendered_at'),
    ('quote_versions', 'accepted_at'),
    ('quote_versions', 'created_at'),
    ('quote_line_items', 'quote_version_id'),
    ('quote_line_items', 'sort_order'),
    ('quote_line_items', 'description'),
    ('quote_line_items', 'qty'),
    ('quote_line_items', 'unit_price_inc_gst_cents'),
    ('quote_line_items', 'line_total_inc_gst_cents'),
    ('deposit_invoices', 'id'),
    ('deposit_invoices', 'project_id'),
    ('deposit_invoices', 'quote_id'),
    ('deposit_invoices', 'quote_version_id'),
    ('deposit_invoices', 'quote_ref'),
    ('deposit_invoices', 'quote_version_number'),
    ('deposit_invoices', 'invoice_ref'),
    ('deposit_invoices', 'status'),
    ('deposit_invoices', 'issue_date'),
    ('deposit_invoices', 'due_date'),
    ('deposit_invoices', 'reference'),
    ('deposit_invoices', 'customer_name'),
    ('deposit_invoices', 'project_name'),
    ('deposit_invoices', 'project_address'),
    ('deposit_invoices', 'currency'),
    ('deposit_invoices', 'deposit_percent'),
    ('deposit_invoices', 'quote_total_inc_gst_cents'),
    ('deposit_invoices', 'total_inc_gst_cents'),
    ('deposit_invoices', 'total_ex_gst_cents'),
    ('deposit_invoices', 'gst_cents'),
    ('deposit_invoices', 'payment_instructions'),
    ('deposit_invoices', 'created_by'),
    ('deposit_invoices', 'created_at'),
    ('deposit_invoices', 'voided_at'),
    ('deposit_invoices', 'voided_by'),
    ('deposit_invoices', 'void_reason'),
    ('deposit_invoices', 'portal_token_hash'),
    ('deposit_invoices', 'portal_token_expires_at'),
    ('quote_send_logs', 'id'),
    ('deposit_invoice_send_logs', 'id'),
    ('deposit_invoice_send_logs', 'next_retry_at'),
    ('job_pack_generations', 'quote_version_id')
),
missing as (
  select required.table_name || '.' || required.column_name as name
  from required_columns required
  left join information_schema.columns actual
    on actual.table_schema = 'public'
   and actual.table_name = required.table_name
   and actual.column_name = required.column_name
  where actual.column_name is null
)
select
  current_setting('server_version') as postgres_version,
  coalesce(
    (select jsonb_agg(name order by name) from missing),
    '[]'::jsonb
  ) as missing_prerequisites,
  to_regprocedure('public.set_updated_at()') is not null
    as has_updated_at_trigger_function,
  to_regprocedure('public.next_deposit_invoice_ref()') is not null
    as has_invoice_ref_function,
  to_regprocedure('public.commercial_email_read_unfinished(text,uuid)') is not null
    as migration_present,
  coalesce(
    position(
      'P0001' in pg_get_functiondef(
        to_regprocedure(
          'public.commercial_quote_update_draft(uuid,bigint,text,text,text,numeric,date,uuid,integer,integer,integer,text,jsonb,jsonb)'
        )
      )
    ) > 0,
    false
  ) as application_conflict_ready,
  coalesce(
    position(
      '40001' in pg_get_functiondef(
        to_regprocedure(
          'public.commercial_quote_update_draft(uuid,bigint,text,text,text,numeric,date,uuid,integer,integer,integer,text,jsonb,jsonb)'
        )
      )
    ) = 0,
    false
  ) as serialization_retry_removed,
  to_regclass('private.commercial_email_intents') is not null
    as intent_table_present,
  (
    select count(*)
    from public.quote_versions
    where status = 'DRAFT'
  ) as draft_rows,
  (
    select count(*)
    from (
      select quote_id
      from public.quote_versions
      where status = 'DRAFT'
      group by quote_id
      having count(*) > 1
    ) duplicate_drafts
  ) as quotes_with_multiple_drafts,
  (
    select count(*)
    from (
      select quote_version_id
      from public.deposit_invoices
      where status = 'OPEN'
      group by quote_version_id
      having count(*) > 1
    ) duplicate_open_invoice_versions
  ) as duplicate_open_invoice_versions,
  (
    select count(*)
    from public.deposit_invoice_send_logs
    where next_retry_at is not null
  ) as retry_timestamps_to_clear;
