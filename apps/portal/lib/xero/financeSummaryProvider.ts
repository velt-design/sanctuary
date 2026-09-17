import 'server-only';
import { access } from './store';
import { config } from './security';
import { financeSummaryPeriod, type FinanceSummaryPeriod } from './financeSummaryContract';

export type SummarySource = 'invoiced' | 'receipts' | 'outstanding';
export const SUMMARY_PAGE_SIZE = 250;
export function summaryQuery(source: SummarySource, period: FinanceSummaryPeriod) {
  const { from, to } = financeSummaryPeriod.parse(period);
  const next = new Date(Date.parse(to) + 86400000).toISOString().slice(0, 10);
  const date = (value: string) => `DateTime(${value.split('-').map(Number).join(',')})`;
  const range = `Date>=${date(from)}&&Date<${date(next)}`;
  if (source === 'receipts') return { resource: 'Payments', where: `PaymentType=="ACCRECPAYMENT"&&Status=="AUTHORISED"&&${range}`, order: 'PaymentID ASC' };
  if (source === 'outstanding') return { resource: 'Invoices', where: 'Type=="ACCREC"&&Status=="AUTHORISED"&&AmountDue>0', order: 'InvoiceID ASC' };
  return { resource: 'Invoices', where: `Type=="ACCREC"&&(Status=="AUTHORISED"||Status=="PAID")&&${range}`, order: 'InvoiceID ASC' };
}

/** Fixed read-only resources; credentials never leave this server-owned adapter. */
export async function readSummaryPage(source: SummarySource, period: FinanceSummaryPeriod, page: number, signal: AbortSignal): Promise<unknown[]> {
  if (!Number.isInteger(page) || page < 1 || page > 10) throw new Error('SUMMARY_LIMIT');
  const query = summaryQuery(source, period);
  const tenantId = config().tenantId;
  if (!/^[0-9a-f-]{36}$/i.test(tenantId)) throw new Error('SUMMARY_UNAVAILABLE');
  const tokens = await access();
  const required = source === 'receipts' ? ['accounting.payments.read'] : ['accounting.invoices.read', 'accounting.invoices'];
  if (!required.some(scope => tokens.scopes?.includes(scope))) throw new Error('SUMMARY_UNAVAILABLE');
  signal.throwIfAborted();
  const url = new URL(`https://api.xero.com/api.xro/2.0/${query.resource}`);
  url.searchParams.set('where', query.where);
  url.searchParams.set('order', query.order);
  url.searchParams.set('page', String(page));
  url.searchParams.set('pageSize', String(SUMMARY_PAGE_SIZE));
  const response = await fetch(url, { method: 'GET', redirect: 'error', cache: 'no-store',
    signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]),
    headers: { Authorization: `Bearer ${tokens.accessToken}`, 'Xero-tenant-id': tenantId, Accept: 'application/json' } });
  if (!response.ok) throw new Error('SUMMARY_UNAVAILABLE');
  const body: unknown = await response.json();
  const rows = body && typeof body === 'object' ? (body as Record<string, unknown>)[query.resource] : null;
  if (!Array.isArray(rows) || rows.length > SUMMARY_PAGE_SIZE) throw new Error('SUMMARY_UNAVAILABLE');
  return rows;
}
