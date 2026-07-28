-- Executable contract for 20260728_000001_commercial_workflow_trust.sql.
-- Runs only in the disposable PGlite harness.

set client_min_messages = warning;

create or replace function pg_temp.assert_true(
  p_condition boolean,
  p_message text
)
returns void
language plpgsql
as $$
begin
  if p_condition is distinct from true then
    raise exception 'commercial workflow assertion failed: %', p_message;
  end if;
end;
$$;

select pg_temp.assert_true(
  (
    select count(*) = 1
    from public.quote_versions
    where quote_id = '30000000-0000-4000-8000-000000000001'
      and status = 'DRAFT'
      and is_current_draft
      and id = '40000000-0000-4000-8000-000000000002'
  ),
  'the latest historical draft should be authoritative after backfill'
);

select pg_temp.assert_true(
  not (
    select is_current_draft
    from public.quote_versions
    where id = '40000000-0000-4000-8000-000000000003'
  ),
  'historical sent versions must not be current drafts'
);

select pg_temp.assert_true(
  (
    select next_retry_at is null
    from public.deposit_invoice_send_logs
    limit 1
  ),
  'legacy automatic-retry timestamps should be cleared'
);

select pg_temp.assert_true(
  to_regclass('public.deposit_invoices_quote_open_unique') is null
    and to_regclass('public.deposit_invoices_quote_version_open_unique') is not null,
  'the open-invoice identity should move from quote to exact quote version'
);

update public.estimates
set client_intent_id = 'estimate-intent-0001'
where id = '20000000-0000-4000-8000-000000000001';

do $estimate_intent_unique$
begin
  begin
    insert into public.estimates (id, project_id, client_intent_id)
    values (
      '20000000-0000-4000-8000-000000000003',
      '10000000-0000-4000-8000-000000000001',
      'estimate-intent-0001'
    );
    raise exception 'expected duplicate estimate intent rejection';
  exception
    when unique_violation then null;
  end;
end;
$estimate_intent_unique$;

select public.commercial_quote_create_draft(
  '30000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  '40000000-0000-4000-8000-000000000003',
  'quote-intent-0001',
  'migration-contract',
  'Test Customer',
  'Created draft',
  'Test introduction',
  'Test terms',
  20,
  '2099-12-31',
  126500,
  110000,
  16500,
  'saved_estimate',
  '{"configuration":"test-only"}'::jsonb,
  '[{"sort_order":0,"description":"Created line","qty":1,"unit_price_inc_gst_cents":126500,"line_total_inc_gst_cents":126500}]'::jsonb
);

select public.commercial_quote_create_draft(
  '30000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000002',
  '40000000-0000-4000-8000-000000000003',
  'quote-intent-0001',
  'migration-contract',
  'Test Customer',
  'Created draft',
  'Test introduction',
  'Test terms',
  20,
  '2099-12-31',
  126500,
  110000,
  16500,
  'saved_estimate',
  '{"configuration":"test-only"}'::jsonb,
  '[{"sort_order":0,"description":"Created line","qty":1,"unit_price_inc_gst_cents":126500,"line_total_inc_gst_cents":126500}]'::jsonb
);

select pg_temp.assert_true(
  (
    select count(*) = 1
    from public.quote_versions
    where quote_id = '30000000-0000-4000-8000-000000000001'
      and client_intent_id = 'quote-intent-0001'
      and version_number = 4
      and status = 'DRAFT'
      and is_current_draft
      and commercial_revision = 1
  ),
  'duplicate draft intent should return one authoritative version'
);

select pg_temp.assert_true(
  (
    select count(*) = 1
    from public.quote_line_items item
    join public.quote_versions version on version.id = item.quote_version_id
    where version.client_intent_id = 'quote-intent-0001'
      and item.description = 'Created line'
  ),
  'duplicate draft intent should not duplicate line items'
);

do $quote_intent_conflict$
begin
  begin
    perform public.commercial_quote_create_draft(
      '30000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      '40000000-0000-4000-8000-000000000003',
      'quote-intent-0001',
      'migration-contract',
      'Test Customer',
      'Conflicting draft',
      'Test introduction',
      'Test terms',
      20,
      '2099-12-31',
      126500,
      110000,
      16500,
      'saved_estimate',
      '{}'::jsonb,
      '[{"sort_order":0,"description":"Conflict","qty":1,"unit_price_inc_gst_cents":126500,"line_total_inc_gst_cents":126500}]'::jsonb
    );
    raise exception 'expected conflicting quote intent rejection';
  exception
    when unique_violation then null;
  end;
end;
$quote_intent_conflict$;

update public.quote_versions
set
  pdf_file_id = '60000000-0000-4000-8000-000000000001',
  render_hash = 'stale-render',
  preview_base_payload = '{"stale":true}'::jsonb,
  preview_rendered_at = now()
where client_intent_id = 'quote-intent-0001';

select public.commercial_quote_update_draft(
  (select id from public.quote_versions where client_intent_id = 'quote-intent-0001'),
  1,
  'Updated draft',
  'Updated introduction',
  'Updated terms',
  25,
  '2099-12-31',
  '20000000-0000-4000-8000-000000000002',
  138000,
  120000,
  18000,
  'saved_estimate',
  '{"configuration":"updated-test"}'::jsonb,
  '[{"sort_order":0,"description":"Updated line","qty":2,"unit_price_inc_gst_cents":69000,"line_total_inc_gst_cents":138000}]'::jsonb
);

select pg_temp.assert_true(
  (
    select commercial_revision = 2
      and reference = 'Updated draft'
      and pdf_file_id is null
      and render_hash is null
      and preview_base_payload is null
      and preview_rendered_at is null
    from public.quote_versions
    where client_intent_id = 'quote-intent-0001'
  ),
  'draft update should advance revision and invalidate generated artifacts'
);

select pg_temp.assert_true(
  (
    select count(*) = 1
    from public.quote_line_items item
    join public.quote_versions version on version.id = item.quote_version_id
    where version.client_intent_id = 'quote-intent-0001'
      and item.description = 'Updated line'
      and item.qty = 2
  ),
  'draft update should atomically replace line items'
);

do $stale_quote_update$
declare
  v_message text;
begin
  begin
    perform public.commercial_quote_update_draft(
      (select id from public.quote_versions where client_intent_id = 'quote-intent-0001'),
      1,
      'Stale draft',
      'Stale introduction',
      'Stale terms',
      25,
      '2099-12-31',
      '20000000-0000-4000-8000-000000000002',
      138000,
      120000,
      18000,
      'saved_estimate',
      '{}'::jsonb,
      '[{"sort_order":0,"description":"Stale line","qty":1,"unit_price_inc_gst_cents":138000,"line_total_inc_gst_cents":138000}]'::jsonb
    );
    raise exception 'expected stale commercial revision rejection';
  exception
    when sqlstate 'P0001' then
      get stacked diagnostics v_message = message_text;
      perform pg_temp.assert_true(
        v_message = 'QUOTE_STALE',
        'stale quote update should retain its application conflict identity'
      );
  end;
end;
$stale_quote_update$;

select public.commercial_quote_prepare_delivery_email(
  (select id from public.quote_versions where client_intent_id = 'quote-intent-0001'),
  2,
  'quote-delivery-intent-0001',
  'quote_send',
  (select id from public.quote_versions where client_intent_id = 'quote-intent-0001'),
  '10000000-0000-4000-8000-000000000001',
  repeat('a', 64),
  '{"to":["qa@example.invalid"],"subject":"Frozen test quote","attachments":["quote.pdf"]}'::jsonb,
  now() + interval '1 day'
);

select public.commercial_quote_prepare_delivery_email(
  (select id from public.quote_versions where client_intent_id = 'quote-intent-0001'),
  2,
  'quote-delivery-intent-0001',
  'quote_send',
  (select id from public.quote_versions where client_intent_id = 'quote-intent-0001'),
  '10000000-0000-4000-8000-000000000001',
  repeat('a', 64),
  '{"to":["qa@example.invalid"],"subject":"Frozen test quote","attachments":["quote.pdf"]}'::jsonb,
  now() + interval '1 day'
);

select pg_temp.assert_true(
  (
    select count(*) = 1
      and min(status) = 'prepared'
    from private.commercial_email_intents
    where intent_key = 'quote-delivery-intent-0001'
  ),
  'delivery preparation replay should preserve one frozen intent'
);

select pg_temp.assert_true(
  (
    select delivery_prepared_at is not null and not is_current_draft
    from public.quote_versions
    where client_intent_id = 'quote-intent-0001'
  ),
  'delivery preparation should freeze the exact quote revision'
);

do $delivery_payload_conflict$
begin
  begin
    perform public.commercial_quote_prepare_delivery_email(
      (select id from public.quote_versions where client_intent_id = 'quote-intent-0001'),
      2,
      'quote-delivery-intent-0001',
      'quote_send',
      (select id from public.quote_versions where client_intent_id = 'quote-intent-0001'),
      '10000000-0000-4000-8000-000000000001',
      repeat('b', 64),
      '{"to":["different@example.invalid"]}'::jsonb,
      now() + interval '1 day'
    );
    raise exception 'expected frozen payload identity conflict';
  exception
    when unique_violation then null;
  end;
end;
$delivery_payload_conflict$;

do $prepared_quote_lock$
begin
  begin
    perform public.commercial_quote_update_draft(
      (select id from public.quote_versions where client_intent_id = 'quote-intent-0001'),
      2,
      'Prepared quote edit',
      'Prepared quote edit',
      'Prepared quote edit',
      25,
      '2099-12-31',
      '20000000-0000-4000-8000-000000000002',
      138000,
      120000,
      18000,
      'saved_estimate',
      '{}'::jsonb,
      '[{"sort_order":0,"description":"Locked","qty":1,"unit_price_inc_gst_cents":138000,"line_total_inc_gst_cents":138000}]'::jsonb
    );
    raise exception 'expected prepared quote lock';
  exception
    when object_not_in_prerequisite_state then null;
  end;
end;
$prepared_quote_lock$;

select public.commercial_email_mark_dispatching(
  (select id from private.commercial_email_intents where intent_key = 'quote-delivery-intent-0001')
);
select public.commercial_email_mark_failed(
  (select id from private.commercial_email_intents where intent_key = 'quote-delivery-intent-0001'),
  'TEST_RETRYABLE',
  false
);
select public.commercial_email_mark_dispatching(
  (select id from private.commercial_email_intents where intent_key = 'quote-delivery-intent-0001')
);

select pg_temp.assert_true(
  (
    select status = 'dispatching'
      and attempt_count = 2
      and last_error_code is null
    from private.commercial_email_intents
    where intent_key = 'quote-delivery-intent-0001'
  ),
  'retry should reuse the frozen intent and increment its attempt count'
);

select public.commercial_email_mark_provider_accepted(
  (select id from private.commercial_email_intents where intent_key = 'quote-delivery-intent-0001'),
  'provider-message-quote-1'
);
select public.commercial_email_mark_finalised(
  (select id from private.commercial_email_intents where intent_key = 'quote-delivery-intent-0001')
);
select public.commercial_email_mark_finalised(
  (select id from private.commercial_email_intents where intent_key = 'quote-delivery-intent-0001')
);
select public.commercial_email_mark_failed(
  (select id from private.commercial_email_intents where intent_key = 'quote-delivery-intent-0001'),
  'LATE_FAILURE',
  true
);

select pg_temp.assert_true(
  (
    select status = 'finalised'
      and provider_message_id = 'provider-message-quote-1'
      and finalised_at is not null
      and last_error_code is null
    from private.commercial_email_intents
    where intent_key = 'quote-delivery-intent-0001'
  ),
  'finalised delivery should stay terminal under duplicate or late calls'
);

select pg_temp.assert_true(
  not exists (
    select 1
    from public.commercial_email_read_unfinished(
      'quote_send',
      (select id from public.quote_versions where client_intent_id = 'quote-intent-0001')
    )
  ),
  'finalised delivery should not remain in recovery discovery'
);

select public.commercial_email_prepare(
  'invoice-delivery-intent-0001',
  'deposit_invoice_send',
  '50000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  repeat('b', 64),
  '{"to":["qa@example.invalid"],"subject":"Frozen test invoice"}'::jsonb,
  now() + interval '1 day'
);

do $premature_finalisation$
begin
  begin
    perform public.commercial_email_mark_finalised(
      (select id from private.commercial_email_intents where intent_key = 'invoice-delivery-intent-0001')
    );
    raise exception 'expected provider-acceptance checkpoint requirement';
  exception
    when object_not_in_prerequisite_state then null;
  end;
end;
$premature_finalisation$;

select public.commercial_email_mark_provider_accepted(
  (select id from private.commercial_email_intents where intent_key = 'invoice-delivery-intent-0001'),
  'provider-message-invoice-1'
);
select public.commercial_email_mark_finalised(
  (select id from private.commercial_email_intents where intent_key = 'invoice-delivery-intent-0001')
);

select public.commercial_email_prepare(
  'quote-resend-intent-0001',
  'quote_resend',
  '40000000-0000-4000-8000-000000000004',
  '10000000-0000-4000-8000-000000000001',
  repeat('c', 64),
  '{"to":["qa@example.invalid"],"subject":"Provider collision test"}'::jsonb,
  now() + interval '1 day'
);
select public.commercial_email_mark_provider_accepted(
  (select id from private.commercial_email_intents where intent_key = 'quote-resend-intent-0001'),
  'provider-message-invoice-1'
);

select pg_temp.assert_true(
  (
    select status = 'needs_attention'
      and provider_message_id is null
      and last_error_code = 'PROVIDER_MESSAGE_ID_CONFLICT'
    from private.commercial_email_intents
    where intent_key = 'quote-resend-intent-0001'
  ),
  'a provider-message collision should quarantine the losing intent'
);

select pg_temp.assert_true(
  (
    select invoice_created and not already_accepted
    from public.commercial_accept_quote_and_ensure_invoice(
      '40000000-0000-4000-8000-000000000004',
      'migration-contract'
    )
  ),
  'first acceptance should create the exact quote-version invoice'
);

select pg_temp.assert_true(
  (
    select status = 'ACCEPTED' and accepted_at is not null
    from public.quote_versions
    where id = '40000000-0000-4000-8000-000000000004'
  ),
  'acceptance should commit the quote state'
);

select pg_temp.assert_true(
  (
    select count(*) = 1
      and min(total_inc_gst_cents) = 23000
      and min(total_ex_gst_cents) = 20000
      and min(gst_cents) = 3000
    from public.deposit_invoices
    where quote_version_id = '40000000-0000-4000-8000-000000000004'
      and status = 'OPEN'
  ),
  'acceptance should create one correctly calculated deposit invoice'
);

select pg_temp.assert_true(
  (
    select status = 'VOID'
      and voided_at is not null
      and portal_token_hash is null
      and portal_token_expires_at is null
    from public.deposit_invoices
    where id = '50000000-0000-4000-8000-000000000001'
  ),
  'acceptance should void the superseded open quote-version invoice'
);

select pg_temp.assert_true(
  (
    select not invoice_created and already_accepted
    from public.commercial_accept_quote_and_ensure_invoice(
      '40000000-0000-4000-8000-000000000004',
      'migration-contract'
    )
  ),
  'duplicate acceptance should reuse the accepted quote and invoice'
);

do $expired_quote_acceptance$
begin
  begin
    perform public.commercial_accept_quote_and_ensure_invoice(
      '40000000-0000-4000-8000-000000000005',
      'migration-contract'
    );
    raise exception 'expected expired quote rejection';
  exception
    when object_not_in_prerequisite_state then null;
  end;
end;
$expired_quote_acceptance$;

select pg_temp.assert_true(
  (
    select status = 'SENT' and accepted_at is null
    from public.quote_versions
    where id = '40000000-0000-4000-8000-000000000005'
  )
  and not exists (
    select 1
    from public.deposit_invoices
    where quote_version_id = '40000000-0000-4000-8000-000000000005'
  ),
  'expired acceptance should leave quote and invoice state unchanged'
);

select pg_temp.assert_true(
  has_function_privilege(
    'service_role',
    'public.commercial_email_read(uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'public.commercial_email_read(uuid)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.commercial_email_read(uuid)',
    'EXECUTE'
  ),
  'commercial RPC execution should remain service-role only'
);

select pg_temp.assert_true(
  not has_table_privilege(
    'service_role',
    'private.commercial_email_intents',
    'SELECT'
  )
  and not has_table_privilege(
    'authenticated',
    'private.commercial_email_intents',
    'SELECT'
  )
  and not has_table_privilege(
    'anon',
    'private.commercial_email_intents',
    'SELECT'
  ),
  'protected commercial intent rows must not be directly readable'
);
