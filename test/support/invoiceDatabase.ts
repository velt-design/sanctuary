import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const read = (name: string) => readFileSync(`supabase/${name}`, 'utf8').replace(/\r/g, '');
function command(source: string, name: string) {
  const start = source.indexOf(`create or replace function public.${name}(`);
  if (start < 0) throw new Error(`Missing production command ${name}`);
  return source.slice(start, source.indexOf('\n$$;', start) + 4);
}

export async function createInvoiceDatabase() {
  return initialiseInvoiceDatabase(new PGlite());
}

async function initialiseInvoiceDatabase<T extends { exec(sql: string): Promise<unknown> }>(db: T) {
  await db.exec(read('tests/commercial_truth_invariants_bootstrap.sql'));
  // Complete only missing schema prerequisites in the existing commercial test
  // harness; execute the actual billing commands rather than stub their logic.
  await db.exec(`
      create function public.is_portal_admin() returns boolean language sql as $$ select coalesce(current_setting('test.admin',true),'yes') = 'yes' $$;
      alter table public.projects add column archived_at timestamptz;
      alter table public.projects add column contact_id uuid;
      create table public.contacts(id uuid primary key,name text,email text);
      create table public.project_operational_states(project_id uuid primary key, state text, row_version bigint default 1,
        waiting_until timestamptz, waiting_reason text, closed_outcome text, closed_note text, updated_by uuid);
      create table public.project_state_events(project_id uuid,command_id uuid,event_sequence int,event_type text,before_state jsonb,after_state jsonb,reason text,actor_user_id uuid,actor_kind text);
      create table public.project_command_receipts(command_id uuid primary key,project_id uuid,command_type text,intent_hash text,actor_user_id uuid,actor_kind text,committed_result jsonb);
      create table public.scheduled_jobs(id uuid primary key default gen_random_uuid(),job_id uuid,status text,actual_finish date);
      create table public.project_confirmation_events(id uuid primary key default gen_random_uuid(),project_id uuid,command_id uuid,event_kind text,
        confirmation_type text constraint project_confirmation_events_confirmation_type_check check(confirmation_type='SITE_VISIT_COMPLETED'),
        subject_kind text,subject_id uuid,occurred_at timestamptz,recorded_by uuid,actor_kind text,retracts_event_id uuid);
      create function public.project_work_items_assert_v2(uuid,boolean) returns void language sql as $$ select $$;
      create function public.project_work_items_refresh_projection(uuid) returns void language sql as $$ select $$;
      create function public.project_work_items_cancel_active(uuid,uuid,text,uuid,text) returns integer language sql as $$ select 0 $$;
      alter table public.deposit_invoices add column pdf_file_id uuid, add column sent_at timestamptz;
      grant select,insert,update,delete on public.deposit_invoices to authenticated;
      create policy portal_access_all on public.deposit_invoices for all using (public.has_portal_access()) with check (public.has_portal_access());
      alter index public.deposit_invoices_active_term_unique rename to deposit_invoices_quote_version_term_active_unique;
      create table public.quote_line_items(id uuid primary key,quote_version_id uuid,sort_order integer,description text,qty numeric,unit_price_inc_gst_cents integer,line_total_inc_gst_cents integer);
    `);
  const reconciliation = read('migrations/20260810000004_admin_payment_reconciliation.sql');
  for (const name of ['commercial_replace_payment_allocations', 'commercial_reverse_payment_entry'])
    await db.exec(command(reconciliation, name));
  await db.exec(read('migrations/20260813000003_commercial_truth_invariants.sql'));
  const work = read('migrations/20260729_000002_project_work_items_v2.sql');
  for (const name of [
    'project_work_items_intent_hash',
    'project_work_items_receipt_replay',
    'project_work_items_store_receipt',
    'project_operational_state_command',
  ]) {
    await db.exec(command(work, name));
  }
  for (const name of [
    '20260911000001_project_delivery_completion.sql',
    '20260911000002_invoice_draft_storage.sql',
    '20260911000003_invoice_draft_commands.sql',
    '20260911000004_invoice_draft_issuance.sql',
    '20260911000005_standalone_invoice_balances.sql',
    '20260911000006_financial_followup_reopening.sql',
    '20260911000007_invoice_payment_reapplication.sql',
    '20260911000008_invoice_command_access.sql',
  ]) {
    // Exercise Windows checkouts too: textual owner patches must normalize
    // their anchors as well as PostgreSQL's stored function definitions.
    await db.exec(read(`migrations/${name}`).replace(/\n/g, '\r\n'));
  }
  // Run the Xero forward extension against the current standalone owners too,
  // so existing manual issuance/payment/reversal behaviour remains covered.
  await db.exec(`create table auth.users(id uuid primary key);
      create schema if not exists private;
      create table private.xero_invoice_transfer_control(singleton boolean,tenant_id uuid);
      create table private.xero_invoice_transfers(id uuid primary key,invoice_id uuid,project_id uuid,tenant_id uuid,provider_invoice_id uuid);
      create table private.xero_invoice_requests(transfer_id uuid,body text);`);
  for (const name of [
    '20260914000002_xero_deposit_matching.sql',
    '20260914000003_xero_deposit_commands.sql',
    '20260914000014_xero_invoice_payment_commands.sql',
  ])
    await db.exec(read(`migrations/${name}`).replace(/\n/g, '\r\n'));
  return db;
}

export async function createInvoiceRestoreDatabase() {
  return initialiseInvoiceRestoreDatabase(new PGlite());
}

/** Shared synthetic prerequisites; all billing transitions use production SQL. */
export async function initialiseInvoiceRestoreDatabase<T extends { exec(sql: string): Promise<unknown> }>(db: T) {
  await initialiseInvoiceDatabase(db);
  const email = read('migrations/20260728_000001_commercial_workflow_trust.sql');
  await db.exec(
    email.slice(
      email.indexOf('create table if not exists private.commercial_email_intents'),
      email.indexOf('drop trigger if exists commercial_email_intents_set_updated_at'),
    ),
  );
  for (const name of [
    'commercial_email_prepare',
    'commercial_email_mark_dispatching',
    'commercial_email_read_unfinished',
  ]) {
    await db.exec(command(email, name));
  }
  await db.exec(
    `create table private.xero_invoice_observations(transfer_id uuid,generation bigint,portal_status text,result jsonb,checked_at timestamptz default clock_timestamp());`,
  );
  await db.exec(read('migrations/20260914000017_xero_partial_payment_balances.sql'));
  await db.exec(read('migrations/20261012000001_invoice_restore.sql'));
  return db;
}
