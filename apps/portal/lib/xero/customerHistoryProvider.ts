import 'server-only';
import { access } from './store';
import { config } from './security';
import type { CustomerHistoryQuery } from './customerHistoryContract';
import { financeSummaryPeriod } from './financeSummaryContract';

export const HISTORY_PAGE_SIZE = 100;
export type HistoryResource = 'Contacts' | 'Invoices' | 'Payments' | 'BankTransactions';
export type HistoryRead = { resource: HistoryResource; tenantId: string; contactId: string; invoiceId?: string;
  period: Pick<CustomerHistoryQuery, 'from' | 'to'>; page: number };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function historyReadUrl(input: HistoryRead): URL {
  financeSummaryPeriod.parse({ from: input.period.from, to: input.period.to });
  if (![input.tenantId, input.contactId, ...(input.invoiceId ? [input.invoiceId] : [])].every(id => uuid.test(id))
    || !Number.isInteger(input.page) || input.page < 1 || input.page > 10) throw new Error('HISTORY_INVALID_QUERY');
  const date = (value: string) => `DateTime(${value.split('-').map(Number).join(',')})`;
  const next = new Date(Date.parse(input.period.to) + 86400000).toISOString().slice(0, 10);
  const range = `Date>=${date(input.period.from)}&&Date<${date(next)}`;
  const url = new URL(`https://api.xero.com/api.xro/2.0/${input.resource}${input.resource === 'Contacts' ? `/${input.contactId}` : ''}`);
  if (input.resource === 'Contacts') return url;
  if (input.resource === 'Invoices') {
    url.searchParams.set('ContactIDs', input.contactId); url.searchParams.set('where', 'Type=="ACCREC"');
    url.searchParams.set('order', 'InvoiceID ASC');
  } else if (input.resource === 'Payments') {
    if (!input.invoiceId) throw new Error('HISTORY_INVALID_QUERY');
    url.searchParams.set('where', `Invoice.InvoiceID==guid("${input.invoiceId}")&&PaymentType=="ACCRECPAYMENT"&&${range}`);
    url.searchParams.set('order', 'PaymentID ASC');
  } else {
    url.searchParams.set('where', `Type=="RECEIVE"&&Contact.ContactID==guid("${input.contactId}")&&${range}`);
    url.searchParams.set('order', 'BankTransactionID ASC');
  }
  url.searchParams.set('page', String(input.page)); url.searchParams.set('pageSize', String(HISTORY_PAGE_SIZE));
  return url;
}

/** GET-only, tenant-pinned existing broker; never invokes import/observation commands. */
export async function readHistoryPage(input: HistoryRead, signal: AbortSignal): Promise<unknown[]> {
  const url = historyReadUrl(input);
  if (input.tenantId !== config().tenantId) throw new Error('HISTORY_IDENTITY_CHANGED');
  signal.throwIfAborted();
  const tokens = await access();
  const scopes: Record<HistoryResource, string[]> = { Contacts: ['accounting.contacts.read', 'accounting.contacts'],
    Invoices: ['accounting.invoices.read', 'accounting.invoices'], Payments: ['accounting.payments.read'], BankTransactions: ['accounting.banktransactions.read'] };
  if (!scopes[input.resource].some(scope => tokens.scopes?.includes(scope))) throw new Error('HISTORY_UNAVAILABLE');
  const response = await fetch(url, { method: 'GET', redirect: 'error', cache: 'no-store',
    signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]),
    headers: { Authorization: `Bearer ${tokens.accessToken}`, 'Xero-tenant-id': input.tenantId, Accept: 'application/json' } });
  if (!response.ok || !response.body) throw new Error('HISTORY_UNAVAILABLE');
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let bytes = 0;
  try {
    while (true) { const part = await reader.read(); if (part.done) break; bytes += part.value.length;
      if (bytes > 2_000_000) throw new Error('HISTORY_LIMIT'); chunks.push(part.value); }
  } finally { await reader.cancel(); }
  const body: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  const rows = body && typeof body === 'object' ? (body as Record<string, unknown>)[input.resource] : null;
  if (!Array.isArray(rows) || rows.length > HISTORY_PAGE_SIZE) throw new Error('HISTORY_UNAVAILABLE');
  return rows;
}
