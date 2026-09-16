-- Reporting only: expose exact, unreversed Xero matches without accounting writes
-- or credentials. Base tables remain inaccessible to the reporting LOGIN.
begin;
create view praxis_reporting.verified_receipts_v1
with (security_barrier = true) as
select match.id, match.project_id, match.invoice_id, match.payment_entry_id,
  match.receipt_id, match.tenant_id, match.amount_inc_gst_cents,
  match.receipt_date, match.approved_at, match.source_kind, match.recording_method,
  match.evidence_fingerprint, invoice.currency
from public.xero_deposit_matches match
join public.project_payment_entries entry
  on entry.id = match.payment_entry_id and entry.project_id = match.project_id
  and entry.source_invoice_id = match.invoice_id
join public.deposit_invoices invoice
  on invoice.id = match.invoice_id and invoice.project_id = match.project_id
where match.reversed_at is null
  and entry.entry_type = 'PAYMENT'
  and entry.amount_inc_gst_cents = match.amount_inc_gst_cents
  and match.amount_inc_gst_cents > 0
  and not exists (
    select 1 from public.project_payment_entries reversal
    where reversal.reverses_entry_id = entry.id and reversal.entry_type = 'REVERSAL'
  );
revoke all on praxis_reporting.verified_receipts_v1 from public, anon, authenticated, service_role;
grant select on praxis_reporting.verified_receipts_v1 to sanctuary_praxis_reader;
comment on view praxis_reporting.verified_receipts_v1 is
  'Portal-recorded Xero verification at approved_at; not a fresh Xero bank read. Reversed or inconsistent ledger evidence is excluded.';
commit;
