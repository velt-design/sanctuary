import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { initialiseInvoiceRestoreDatabase } from './invoiceDatabase';

export async function createRevisedQuoteDatabase() {
  return initialiseRevisedQuoteDatabase(new PGlite());
}

export async function initialiseRevisedQuoteDatabase<T extends { exec(sql: string): Promise<unknown> }>(db: T) {
  await initialiseInvoiceRestoreDatabase(db);
  await db.exec('alter table public.quote_versions add column expires_at date');
  // Include the actual idempotent receipt owner used by both provider sources.
  const payments = readFileSync('supabase/migrations/20260813000002_commercial_admin_action_idempotency.sql', 'utf8').replace(/\r/g, '');
  const start = payments.indexOf('create function public.commercial_record_project_payment_entry(');
  if (start < 0) throw new Error('Missing canonical payment receipt owner');
  await db.exec(payments.slice(start, payments.indexOf('\n$$;', start) + 4));
  await db.exec('create unique index project_payment_entries_client_intent_unique on public.project_payment_entries(project_id,client_intent_id) where client_intent_id is not null');
  await db.exec(readFileSync('supabase/migrations/20261022000001_revised_quote_funding.sql', 'utf8'));
  return db;
}
