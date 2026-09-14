-- Isolated commercial prerequisites only. Jobs/PGMQ/leases/effects are real migrations.
create table public.contacts(id uuid primary key);
alter table public.projects add column contact_id uuid references public.contacts(id);
create table public.deposit_invoices(
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id),
  status text not null, invoice_ref text not null, currency text not null default 'NZD',
  invoice_kind text not null default 'QUOTE_LINKED', issue_date date not null default '2026-09-14',
  due_date date not null default '2026-09-21', quote_ref text default 'Q-SYNTHETIC', payment_term_label text default 'Deposit',
  total_inc_gst_cents int not null default 115, total_ex_gst_cents int not null default 100,
  gst_cents int not null default 15, content_snapshot jsonb
);
