import 'server-only';
import { config, XERO_SCOPES } from './security';
import { access } from './store';
import type { FinancePositionQuery } from './financePositionContract';

export type PositionRead = { family: 'organisation' | 'bankSummary' | 'profitAndLoss' | 'receivables' | 'payables'; tenantId: string; query: FinancePositionQuery; page: number };
export const POSITION_SCOPES = {
  organisation: ['accounting.settings.read', 'accounting.settings'],
  bankSummary: ['accounting.reports.banksummary.read'],
  profitAndLoss: ['accounting.reports.profitandloss.read'],
  receivables: ['accounting.invoices.read', 'accounting.invoices'],
  payables: ['accounting.invoices.read', 'accounting.invoices'],
} as const;
export class PositionReadError extends Error {
  constructor(readonly reason: 'missing_scope' | 'provider_denied' | 'provider_unavailable' | 'invalid_response' | 'limit_exceeded') { super(reason); }
}
const dependencies = { config, access, fetch: globalThis.fetch };
export async function readPositionPage(input: PositionRead, signal: AbortSignal, deps = dependencies): Promise<unknown[]> {
  signal.throwIfAborted();
  if (input.tenantId !== deps.config().tenantId || !Number.isInteger(input.page) || input.page < 1 || input.page > 51) throw new PositionReadError('invalid_response');
  const tokens = await deps.access();
  signal.throwIfAborted();
  const scopes: readonly string[] = POSITION_SCOPES[input.family];
  if (!scopes.some(scope => (tokens.scopes ?? XERO_SCOPES.split(' ')).includes(scope))) throw new PositionReadError('missing_scope');
  const resource = input.family === 'organisation' ? 'Organisation' : input.family === 'bankSummary' ? 'Reports/BankSummary'
    : input.family === 'profitAndLoss' ? 'Reports/ProfitAndLoss' : 'Invoices';
  const url = new URL(`https://api.xero.com/api.xro/2.0/${resource}`);
  if (resource === 'Invoices') {
    url.searchParams.set('where', `Type=="${input.family === 'receivables' ? 'ACCREC' : 'ACCPAY'}"&&Status=="AUTHORISED"&&AmountDue>0`);
    url.searchParams.set('order', 'InvoiceID ASC'); url.searchParams.set('page', String(input.page)); url.searchParams.set('pageSize', '100');
  } else if (resource.startsWith('Reports/')) {
    url.searchParams.set('fromDate', input.query.from); url.searchParams.set('toDate', input.query.to);
    if (input.family === 'profitAndLoss') {
      url.searchParams.set('standardLayout', 'true'); url.searchParams.set('paymentsOnly', String(input.query.basis === 'cash'));
    }
  }
  let response: Response;
  try { response = await deps.fetch(url, { method: 'GET', redirect: 'error', cache: 'no-store', signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]),
    headers: { Authorization: `Bearer ${tokens.accessToken}`, 'Xero-tenant-id': input.tenantId, Accept: 'application/json' } }); }
  catch { signal.throwIfAborted(); throw new PositionReadError('provider_unavailable'); }
  if (!response.ok) throw new PositionReadError(response.status === 401 || response.status === 403 ? 'provider_denied' : 'provider_unavailable');
  if (!response.body) throw new PositionReadError('invalid_response');
  const reader = response.body.getReader(); const parts: Uint8Array[] = []; let bytes = 0;
  try {
    while (true) {
      signal.throwIfAborted(); const part = await reader.read(); if (part.done) break;
      bytes += part.value.byteLength; if (bytes > 2 * 1024 * 1024) throw new PositionReadError('limit_exceeded'); parts.push(part.value);
    }
  } finally { await reader.cancel().catch(() => {}); }
  let body: Record<string, unknown>;
  try { body = JSON.parse(Buffer.concat(parts).toString('utf8')); } catch { throw new PositionReadError('invalid_response'); }
  const rows = body[resource === 'Organisation' ? 'Organisations' : resource === 'Invoices' ? 'Invoices' : 'Reports'];
  if (!Array.isArray(rows) || rows.length > (resource === 'Invoices' ? 100 : 1)) throw new PositionReadError('invalid_response');
  return rows;
}
