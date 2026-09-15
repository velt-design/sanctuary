// Shared disposable fixture: actual commercial command owners, minimal transfer identities.
// Never run against a shared database. Full historical schema proof is separate.
function command(source,name) {
  const start=source.search(new RegExp(`create (?:or replace )?function public\\.${name}\\(`));
  if(start<0) throw new Error(`Missing actual SQL owner ${name}`);
  return source.slice(start,source.indexOf('\n$$;',start)+4).replace('create function','create or replace function');
}

export async function prepareXeroPaymentDatabase(execute, read) {
    await execute(read('tests/commercial_truth_invariants_bootstrap.sql'));
    await execute(`create table auth.users(id uuid primary key);
      alter table public.deposit_invoices add column invoice_kind text not null default 'QUOTE_LINKED';
      create unique index project_payment_entries_client_intent_unique on public.project_payment_entries(project_id,client_intent_id) where client_intent_id is not null;`);
    const reconciliation=read('migrations/20260810000004_admin_payment_reconciliation.sql');
    for(const name of ['commercial_replace_payment_allocations','commercial_reverse_payment_entry','commercial_audit_payment_entry','commercial_audit_payment_allocation','commercial_guard_payment_allocation_update']) await execute(command(reconciliation,name));
    await execute(`create trigger project_payment_entries_audit_insert after insert on public.project_payment_entries for each row execute function public.commercial_audit_payment_entry();
      create trigger project_payment_allocations_audit_write after insert or update of reversed_at on public.project_payment_allocations for each row execute function public.commercial_audit_payment_allocation();
      create trigger project_payment_allocations_guard_update before update on public.project_payment_allocations for each row execute function public.commercial_guard_payment_allocation_update();`);
    await execute(command(read('migrations/20260813000002_commercial_admin_action_idempotency.sql'),'commercial_record_project_payment_entry'));
    await execute(read('migrations/20260813000003_commercial_truth_invariants.sql'));
    // Real whole-invoice owner, including the unreversed receipt correction.
    await execute(command(read('migrations/20260911000005_standalone_invoice_balances.sql'),'commercial_mark_invoice_paid_and_record_payment'));
    await execute(read('migrations/20260911000007_invoice_payment_reapplication.sql'));
    await execute(read('migrations/20260914000002_xero_deposit_matching.sql'));
    await execute(read('migrations/20260914000003_xero_deposit_commands.sql'));
    await execute(read('migrations/20260914000004_xero_deposit_review_notes.sql'));
    await execute(`alter table public.project_payment_allocations alter column quote_version_id drop not null,
      alter column payment_term_id drop not null,add column standalone_invoice_id uuid references public.deposit_invoices(id);
      alter table public.deposit_invoices alter column quote_id drop not null,alter column quote_version_id drop not null,
      alter column quote_ref drop not null,alter column quote_version_number drop not null;`);
    await execute(command(read('migrations/20260911000005_standalone_invoice_balances.sql'),'commercial_guard_payment_allocation_update'));
    await execute(command(read('migrations/20260911000005_standalone_invoice_balances.sql'),'commercial_standalone_allocation_guard'));
    await execute(`create trigger project_payment_allocations_standalone_guard before insert on public.project_payment_allocations
      for each row execute function public.commercial_standalone_allocation_guard();`);
    // Transfer identity fixtures only; canonical ledger/approval functions above
    // are real SQL owners. This does not exercise invoice dispatch or PGMQ.
    await execute(`create schema if not exists private;
      create table private.xero_invoice_transfer_control(singleton boolean,tenant_id uuid);
      create table private.xero_invoice_transfers(id uuid primary key,invoice_id uuid,project_id uuid,tenant_id uuid,provider_invoice_id uuid);
      create table private.xero_invoice_requests(transfer_id uuid,body text);`);
    await execute(read('migrations/20260914000014_xero_invoice_payment_commands.sql'));
    await execute(read('migrations/20260914000015_xero_invoice_payment_review.sql'));
    await execute('alter table auth.users add column email text');
    await execute(read('migrations/20260914000016_xero_payment_history.sql'));
    await execute(read('migrations/20260914000017_xero_partial_payment_balances.sql'));
}
