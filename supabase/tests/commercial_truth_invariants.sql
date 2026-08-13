-- Transactional contract for commercial truth. Runs only in disposable PGlite.

create or replace function public.commercial_truth_assert(p_ok boolean, p_message text)
returns void
language plpgsql
as $$
begin
  if not coalesce(p_ok, false) then
    raise exception 'commercial truth assertion failed: %', p_message;
  end if;
end;
$$;

-- Current accepted versions and project-wide financial totals.
insert into public.projects (id, name, pipeline_stage) values
  ('10000000-0000-4000-8000-000000000001', 'Truth totals', 'COMPLETED');
insert into public.quotes (id, project_id, quote_ref, commercial_scope_id) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Q-CT1', null),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Q-CT2', '21000000-0000-4000-8000-000000000002');
insert into public.quote_versions (
  id, quote_id, version_number, status, customer_name,
  total_inc_gst_cents, total_ex_gst_cents, gst_cents, accepted_at, created_at
) values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 1, 'ACCEPTED', 'A', 10000, 8696, 1304, '2026-01-01', '2026-01-01'),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 2, 'ACCEPTED', 'A', 12000, 10435, 1565, '2026-02-01', '2026-02-01'),
  ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', 1, 'ACCEPTED', 'A', 3000, 2609, 391, '2026-02-02', '2026-02-02');
insert into public.deposit_invoices (
  id, project_id, quote_id, quote_version_id, quote_ref, quote_version_number,
  invoice_ref, status, quote_total_inc_gst_cents, total_inc_gst_cents,
  total_ex_gst_cents, gst_cents, payment_term_id, payment_term_label
) values (
  '40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002',
  'Q-CT1', 2, 'INV-CT-TOTAL', 'OPEN', 12000, 4000, 3478, 522, 'payment-1', 'Initial payment'
);
insert into public.project_payment_entries (
  id, project_id, entry_type, amount_inc_gst_cents, occurred_at
) values (
  '50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
  'PAYMENT', 3000, '2026-02-03'
);

do $$
declare v_truth record; v_count integer;
begin
  select count(*) into v_count
  from public.commercial_current_accepted_quote_versions('10000000-0000-4000-8000-000000000001');
  perform public.commercial_truth_assert(v_count = 2, 'one current version per base/add-on family');
  select * into strict v_truth
  from public.commercial_project_financial_truth('10000000-0000-4000-8000-000000000001');
  perform public.commercial_truth_assert(v_truth.accepted_total_inc_gst_cents = 15000, 'accepted total');
  perform public.commercial_truth_assert(v_truth.paid_inc_gst_cents = 3000, 'paid ledger total');
  perform public.commercial_truth_assert(v_truth.open_invoice_inc_gst_cents = 4000, 'whole open invoices');
  perform public.commercial_truth_assert(v_truth.remaining_to_invoice_inc_gst_cents = 8000, 'remaining balance');
  perform public.commercial_truth_assert(v_truth.over_committed_inc_gst_cents = 0, 'no over-commitment');
end;
$$;

-- Selected-scope invoices cannot exceed the lower project-wide balance, and
-- the client intent replays the exact invoice.
insert into public.projects (id, name) values
  ('10000000-0000-4000-8000-000000000002', 'Invoice cap');
insert into public.quotes (id, project_id, quote_ref, commercial_scope_id) values
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', 'Q-CT3', null),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', 'Q-CT4', '21000000-0000-4000-8000-000000000004');
insert into public.quote_versions (
  id, quote_id, version_number, status, customer_name,
  total_inc_gst_cents, total_ex_gst_cents, gst_cents, accepted_at
) values
  ('30000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000003', 1, 'ACCEPTED', 'B', 10000, 8696, 1304, now()),
  ('30000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000004', 1, 'ACCEPTED', 'B', 10000, 8696, 1304, now());
insert into public.project_payment_entries (project_id, entry_type, amount_inc_gst_cents, occurred_at)
values ('10000000-0000-4000-8000-000000000002', 'PAYMENT', 15000, now());

do $$
declare v_first record; v_replay record;
begin
  begin
    perform public.commercial_create_admin_invoice_idempotent(
      '10000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000005',
      'custom', null, 6000, null, 'Add-on balance', null, null, null,
      false, null, 'contract', 'intent-cap-blocked'
    );
    raise exception 'expected job-wide cap';
  exception when sqlstate '55000' then
    null;
  end;
  select * into strict v_first from public.commercial_create_admin_invoice_idempotent(
    '10000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000005',
    'custom', null, 5000, null, 'Add-on balance', null, null, null,
    false, null, 'contract', 'intent-cap-valid'
  );
  select * into strict v_replay from public.commercial_create_admin_invoice_idempotent(
    '10000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000005',
    'custom', null, 5000, null, 'Add-on balance', null, null, null,
    false, null, 'contract', 'intent-cap-valid'
  );
  perform public.commercial_truth_assert(v_first.remaining_before_inc_gst_cents = 5000, 'job-wide remaining cap');
  perform public.commercial_truth_assert(v_first.remaining_after_inc_gst_cents = 0, 'job-wide remaining after invoice');
  perform public.commercial_truth_assert(v_replay.replayed and v_replay.invoice_id = v_first.invoice_id, 'invoice intent replay');
end;
$$;

-- Reversing an invoice-owned payment reopens the whole invoice. Manual
-- allocation cannot make an OPEN invoice look partly paid.
insert into public.projects (id, name) values
  ('10000000-0000-4000-8000-000000000003', 'Whole invoice reversal');
insert into public.quotes (id, project_id, quote_ref) values
  ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000003', 'Q-CT5');
insert into public.quote_versions (
  id, quote_id, version_number, status, customer_name,
  total_inc_gst_cents, total_ex_gst_cents, gst_cents, accepted_at
) values (
  '30000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000005',
  1, 'ACCEPTED', 'C', 10000, 8696, 1304, now()
);
insert into public.deposit_invoices (
  id, project_id, quote_id, quote_version_id, quote_ref, quote_version_number,
  invoice_ref, status, quote_total_inc_gst_cents, total_inc_gst_cents,
  total_ex_gst_cents, gst_cents, payment_term_id, payment_term_label, paid_at
) values (
  '40000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003',
  '20000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000006',
  'Q-CT5', 1, 'INV-CT-REV', 'PAID', 10000, 5000, 4348, 652,
  'payment-1', 'Initial payment', now()
);
insert into public.project_payment_entries (
  id, project_id, source_invoice_id, entry_type, amount_inc_gst_cents, occurred_at
) values (
  '50000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003',
  '40000000-0000-4000-8000-000000000002', 'PAYMENT', 5000, now()
);
insert into public.project_payment_allocations (
  project_id, payment_entry_id, quote_version_id, payment_term_id,
  amount_inc_gst_cents, change_reason
) values (
  '10000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000002',
  '30000000-0000-4000-8000-000000000006', 'payment-1', 5000, 'Initial allocation'
);

do $$
declare v_status text; v_active integer;
begin
  perform public.commercial_reverse_payment_entry_with_project_lock(
    '50000000-0000-4000-8000-000000000002', 'Payment reversed by bank', 'contract'
  );
  select status into v_status from public.deposit_invoices
  where id = '40000000-0000-4000-8000-000000000002';
  select count(*) into v_active from public.project_payment_allocations
  where payment_entry_id = '50000000-0000-4000-8000-000000000002' and reversed_at is null;
  perform public.commercial_truth_assert(v_status = 'OPEN', 'reversal reopens whole invoice');
  perform public.commercial_truth_assert(v_active = 0, 'reversal retires allocations');
  begin
    insert into public.project_payment_allocations (
      project_id, payment_entry_id, quote_version_id, payment_term_id,
      amount_inc_gst_cents, change_reason
    ) values (
      '10000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000002',
      '30000000-0000-4000-8000-000000000006', 'payment-1', 1000, 'Forbidden partial allocation'
    );
    raise exception 'expected OPEN invoice allocation rejection';
  exception when sqlstate '55000' then
    null;
  end;
end;
$$;

-- Accepted lifecycle tombstones prevent an older accepted version reviving.
insert into public.projects (id, name) values
  ('10000000-0000-4000-8000-000000000004', 'Lifecycle tombstone');
insert into public.quotes (id, project_id, quote_ref) values
  ('20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000004', 'Q-CT6');
insert into public.quote_versions (
  id, quote_id, version_number, status, customer_name,
  total_inc_gst_cents, total_ex_gst_cents, gst_cents, accepted_at, created_at
) values
  ('30000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000006', 1, 'ACCEPTED', 'D', 9000, 7826, 1174, '2026-01-01', '2026-01-01'),
  ('30000000-0000-4000-8000-000000000008', '20000000-0000-4000-8000-000000000006', 2, 'ACCEPTED', 'D', 10000, 8696, 1304, '2026-02-01', '2026-02-01');
insert into public.deposit_invoices (
  project_id, quote_id, quote_version_id, quote_ref, quote_version_number,
  invoice_ref, status, quote_total_inc_gst_cents, total_inc_gst_cents,
  total_ex_gst_cents, gst_cents, payment_term_id, payment_term_label
) values (
  '10000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000006',
  '30000000-0000-4000-8000-000000000008', 'Q-CT6', 2, 'INV-CT-SUP', 'OPEN',
  10000, 5000, 4348, 652, 'payment-1', 'Initial payment'
);

do $$
declare v_count integer; v_status text; v_invoice_status text;
begin
  perform public.commercial_mark_quote_superseded(
    '30000000-0000-4000-8000-000000000008', 'contract'
  );
  select count(*) into v_count
  from public.commercial_current_accepted_quote_versions('10000000-0000-4000-8000-000000000004');
  select status into v_status from public.quote_versions
  where id = '30000000-0000-4000-8000-000000000008';
  select status into v_invoice_status from public.deposit_invoices
  where invoice_ref = 'INV-CT-SUP';
  perform public.commercial_truth_assert(v_count = 0, 'superseded accepted version tombstones family');
  perform public.commercial_truth_assert(v_status = 'SUPERSEDED', 'quote status superseded');
  perform public.commercial_truth_assert(v_invoice_status = 'VOID', 'supersede voids open invoices');
end;
$$;

-- A stale sent version cannot accept and create an invoice behind a newer
-- accepted lifecycle version in the same quote family.
insert into public.projects (id, name) values
  ('10000000-0000-4000-8000-000000000007', 'Stale acceptance');
insert into public.quotes (id, project_id, quote_ref) values
  ('20000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000007', 'Q-CT9');
insert into public.quote_versions (
  id, quote_id, version_number, status, customer_name,
  total_inc_gst_cents, total_ex_gst_cents, gst_cents, accepted_at, created_at
) values
  ('30000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000009', 1, 'SENT', 'E', 8000, 6957, 1043, null, '2026-01-01'),
  ('30000000-0000-4000-8000-000000000012', '20000000-0000-4000-8000-000000000009', 2, 'ACCEPTED', 'E', 9000, 7826, 1174, '2026-02-01', '2026-02-01');

do $$
declare v_status text; v_invoice_count integer;
begin
  begin
    perform public.commercial_accept_quote_with_project_lock(
      '30000000-0000-4000-8000-000000000011', 'contract'
    );
    raise exception 'expected stale acceptance rejection';
  exception when sqlstate '55000' then
    null;
  end;
  select status into v_status from public.quote_versions
  where id = '30000000-0000-4000-8000-000000000011';
  select count(*) into v_invoice_count from public.deposit_invoices
  where quote_version_id = '30000000-0000-4000-8000-000000000011';
  perform public.commercial_truth_assert(v_status = 'SENT', 'stale acceptance rolls quote status back');
  perform public.commercial_truth_assert(v_invoice_count = 0, 'stale acceptance rolls invoice back');
end;
$$;

-- Quote acceptance uses the same project-wide invoice cap. Existing job
-- credit cannot be hidden by an automatically created full first invoice.
insert into public.projects (id, name) values
  ('10000000-0000-4000-8000-000000000008', 'Acceptance invoice cap');
insert into public.quotes (id, project_id, quote_ref) values
  ('20000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000008', 'Q-CT10');
insert into public.quote_versions (
  id, quote_id, version_number, status, customer_name,
  total_inc_gst_cents, total_ex_gst_cents, gst_cents
) values (
  '30000000-0000-4000-8000-000000000013', '20000000-0000-4000-8000-000000000010',
  1, 'SENT', 'F', 10000, 8696, 1304
);
insert into public.project_payment_entries (
  project_id, entry_type, amount_inc_gst_cents, occurred_at
) values (
  '10000000-0000-4000-8000-000000000008', 'PAYMENT', 6000, now()
);

do $$
declare v_status text; v_invoice_count integer;
begin
  begin
    perform public.commercial_accept_quote_with_project_lock(
      '30000000-0000-4000-8000-000000000013', 'contract'
    );
    raise exception 'expected acceptance invoice cap rejection';
  exception when sqlstate '55000' then
    null;
  end;
  select status into v_status from public.quote_versions
  where id = '30000000-0000-4000-8000-000000000013';
  select count(*) into v_invoice_count from public.deposit_invoices
  where quote_version_id = '30000000-0000-4000-8000-000000000013';
  perform public.commercial_truth_assert(v_status = 'SENT', 'capped acceptance rolls quote status back');
  perform public.commercial_truth_assert(v_invoice_count = 0, 'capped acceptance rolls invoice back');
end;
$$;

-- Completion and paid transitions are ledger-owned, not manual date-owned.
insert into public.projects (id, name, pipeline_stage) values
  ('10000000-0000-4000-8000-000000000005', 'Settled completion', 'COMPLETED'),
  ('10000000-0000-4000-8000-000000000006', 'Unsettled completion', 'COMPLETED');
insert into public.quotes (id, project_id, quote_ref) values
  ('20000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000005', 'Q-CT7'),
  ('20000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000006', 'Q-CT8');
insert into public.quote_versions (
  id, quote_id, version_number, status, total_inc_gst_cents,
  total_ex_gst_cents, gst_cents, accepted_at
) values
  ('30000000-0000-4000-8000-000000000009', '20000000-0000-4000-8000-000000000007', 1, 'ACCEPTED', 10000, 8696, 1304, now()),
  ('30000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000008', 1, 'ACCEPTED', 10000, 8696, 1304, now());
insert into public.project_payment_entries (project_id, entry_type, amount_inc_gst_cents, occurred_at)
values ('10000000-0000-4000-8000-000000000005', 'PAYMENT', 10000, '2026-08-12');

do $$
declare v_paid record; v_project public.projects%rowtype; v_result jsonb;
begin
  begin
    perform public.commercial_complete_project_operational_state_command(
      '10000000-0000-4000-8000-000000000006', gen_random_uuid(),
      '{"outcome":"COMPLETE"}'::jsonb
    );
    raise exception 'expected unsettled completion rejection';
  exception when sqlstate '22023' then
    null;
  end;
  select public.commercial_complete_project_operational_state_command(
    '10000000-0000-4000-8000-000000000005', gen_random_uuid(),
    '{"outcome":"COMPLETE"}'::jsonb
  ) into v_result;
  select * into strict v_paid
  from public.commercial_mark_project_paid('10000000-0000-4000-8000-000000000005');
  select * into strict v_project from public.projects
  where id = '10000000-0000-4000-8000-000000000005';
  perform public.commercial_truth_assert(v_result->>'state' = 'CLOSED', 'completion delegates after settlement');
  perform public.commercial_truth_assert(v_paid.changed and v_project.pipeline_stage = 'PAID', 'paid transition');
  perform public.commercial_truth_assert(v_project.final_payment_date = '2026-08-12', 'ledger date projection');

  insert into public.project_payment_entries (
    project_id, entry_type, amount_inc_gst_cents, occurred_at, reason
  ) values (
    '10000000-0000-4000-8000-000000000005', 'ADJUSTMENT', -1000, now(), 'Bank correction'
  );
  select * into strict v_project from public.projects
  where id = '10000000-0000-4000-8000-000000000005';
  perform public.commercial_truth_assert(v_project.pipeline_stage = 'COMPLETED', 'negative correction reopens paid project');
  perform public.commercial_truth_assert(v_project.final_payment_date is null, 'reopened project clears paid date projection');
end;
$$;

drop function public.commercial_truth_assert(boolean, text);
