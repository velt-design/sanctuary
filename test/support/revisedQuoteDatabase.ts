import { readFileSync } from 'node:fs';
import { createInvoiceRestoreDatabase } from './invoiceDatabase';

export async function createRevisedQuoteDatabase() {
  const db = await createInvoiceRestoreDatabase();
  await db.exec('alter table public.quote_versions add column expires_at date');
  await db.exec(readFileSync('supabase/migrations/20261022000001_revised_quote_funding.sql', 'utf8'));
  return db;
}
