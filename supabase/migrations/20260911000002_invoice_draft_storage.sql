-- Expand storage first. Creation remains disabled until compatible readers and
-- the draft command migration are deployed. Existing issued content is untouched.
begin;

alter table public.deposit_invoices
  drop constraint deposit_invoices_status_check,
  alter column quote_id drop not null,
  alter column quote_version_id drop not null,
  alter column quote_ref drop not null,
  alter column quote_version_number drop not null,
  alter column invoice_ref drop not null,
  alter column issue_date drop not null,
  add column invoice_kind text not null default 'QUOTE_LINKED',
  add column content_snapshot jsonb,
  add column draft_revision bigint not null default 0,
  add column draft_options jsonb,
  add column issue_command_id uuid,
  add column issued_from_revision bigint,
  add constraint deposit_invoices_status_check check (status in ('DRAFT','OPEN','PAID','VOID')),
  add constraint deposit_invoices_kind_check check (invoice_kind in ('QUOTE_LINKED','STANDALONE')),
  add constraint deposit_invoices_source_check check (
    (invoice_kind = 'QUOTE_LINKED' and quote_id is not null and quote_version_id is not null
      and quote_ref is not null and quote_version_number is not null)
    or (invoice_kind = 'STANDALONE' and quote_id is null and quote_version_id is null
      and quote_ref is null and quote_version_number is null)
  ),
  add constraint deposit_invoices_draft_exposure_check check (
    (status = 'DRAFT' and invoice_ref is null and issue_date is null
      and portal_token_hash is null and portal_token_expires_at is null
      and pdf_file_id is null and sent_at is null and paid_at is null)
    or (status <> 'DRAFT' and invoice_ref is not null and issue_date is not null)
  ),
  add constraint deposit_invoices_snapshot_check check (
    content_snapshot is null or (jsonb_typeof(content_snapshot) = 'object'
      and content_snapshot->>'version' = '1'
      and jsonb_typeof(content_snapshot->'items') = 'array')
  );

drop index public.deposit_invoices_quote_version_term_active_unique;
create unique index deposit_invoices_quote_version_term_active_unique
  on public.deposit_invoices(quote_version_id, payment_term_id) where status in ('OPEN','PAID');
create unique index deposit_invoices_issue_command_unique
  on public.deposit_invoices(issue_command_id) where issue_command_id is not null;

-- Payment targets retain their existing quote identity, or identify a standalone
-- invoice explicitly. A standalone payment can never become a quote allocation.
alter table public.project_payment_allocations
  alter column quote_version_id drop not null,
  alter column payment_term_id drop not null,
  add column standalone_invoice_id uuid references public.deposit_invoices(id) on delete restrict,
  add constraint project_payment_allocations_target_check check (
    (quote_version_id is not null and payment_term_id is not null and standalone_invoice_id is null)
    or (quote_version_id is null and payment_term_id is null and standalone_invoice_id is not null)
  );
create unique index project_payment_allocations_standalone_active_unique
  on public.project_payment_allocations(payment_entry_id, standalone_invoice_id)
  where reversed_at is null and standalone_invoice_id is not null;

notify pgrst, 'reload schema';
commit;
