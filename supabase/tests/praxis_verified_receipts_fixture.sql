-- Synthetic schema extension for the reporting test only. Existing finance
-- migration tests own the Xero write lifecycle; this suite owns its read view.
create table public.xero_deposit_matches (
  id uuid primary key, project_id uuid, invoice_id uuid, payment_entry_id uuid,
  receipt_id uuid, tenant_id uuid, amount_inc_gst_cents integer, receipt_date date,
  approved_at timestamptz, source_kind text, recording_method text,
  evidence_fingerprint text, reversed_at timestamptz
);
insert into public.xero_deposit_matches values (
  'b0000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  '70000000-0000-4000-8000-000000000001',
  '90000000-0000-4000-8000-000000000001',
  'b1000000-0000-4000-8000-000000000001',
  'b2000000-0000-4000-8000-000000000001',
  5750, current_date, now(), 'BANK_TRANSACTION', 'MANUAL', repeat('a',64), null
);
