-- Isolated commercial prerequisites only. Jobs/PGMQ/leases/effects are real migrations.
-- The combined jobs harness may already have the richer enquiry contact shape.
-- Preserve it; the standalone finance harness only needs the shared identity.
create table if not exists public.contacts(id uuid primary key);
-- Existing pilot capability table shape; no capability is granted by bootstrap.
create table public.xero_payment_approvers(user_id uuid primary key references auth.users(id),
  granted_at timestamptz not null default clock_timestamp(), granted_by text not null, revoked_at timestamptz);
alter table public.projects add column if not exists contact_id uuid references public.contacts(id);
create table public.deposit_invoices(
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id),
  status text not null, invoice_ref text not null, currency text not null default 'NZD',
  invoice_kind text not null default 'QUOTE_LINKED', issue_date date not null default '2026-09-14',
  due_date date not null default '2026-09-21', quote_ref text default 'Q-SYNTHETIC', payment_term_label text default 'Deposit',
  total_inc_gst_cents int not null default 115, total_ex_gst_cents int not null default 100,
  gst_cents int not null default 15, content_snapshot jsonb
);
