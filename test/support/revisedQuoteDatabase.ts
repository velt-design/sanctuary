import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { initialiseInvoiceRestoreDatabase } from './invoiceDatabase';

export async function createRevisedQuoteDatabase() {
  return initialiseRevisedQuoteDatabase(new PGlite());
}

export async function initialiseRevisedQuoteDatabase<T extends { exec(sql: string): Promise<unknown> }>(db: T) {
  await initialiseInvoiceRestoreDatabase(db);
  await db.exec('alter table public.quote_versions add column expires_at date');
  await db.exec(readFileSync('supabase/migrations/20261022000001_revised_quote_funding.sql', 'utf8'));
  return db;
}
