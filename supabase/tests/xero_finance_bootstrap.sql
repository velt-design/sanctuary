-- Commercial read shapes only; job/lease/retry/effect owners remain real.
alter table public.deposit_invoices add column customer_name text,add column project_name text,
  add column quote_version_id uuid,add column payment_term_id text;
create table public.project_payment_entries(id uuid primary key,project_id uuid,amount_inc_gst_cents int,entry_type text,reverses_entry_id uuid);
create table public.project_payment_allocations(payment_entry_id uuid,project_id uuid,standalone_invoice_id uuid,
  quote_version_id uuid,payment_term_id text,amount_inc_gst_cents int,reversed_at timestamptz);
create table public.xero_deposit_matches(payment_entry_id uuid,invoice_id uuid,amount_inc_gst_cents int,reversed_at timestamptz);
