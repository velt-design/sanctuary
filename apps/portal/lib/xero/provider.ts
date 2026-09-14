import 'server-only';
import { XERO_SCOPES } from './security';

export type Tokens = { accessToken: string; refreshToken: string; expiresAt: number };
export class XeroError extends Error {
  constructor(readonly code: string) { super(code); }
}

export async function tokenRequest(clientId: string, clientSecret: string, body: URLSearchParams): Promise<Tokens> {
  const response = await fetch('https://identity.xero.com/connect/token', {
    method: 'POST', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body,
  });
  if (!response.ok) throw new XeroError(response.status === 400 || response.status === 401 ? 'RECONNECT_REQUIRED' : 'PROVIDER_UNAVAILABLE');
  const data = await response.json();
  if (typeof data.access_token !== 'string' || typeof data.refresh_token !== 'string' || !Number.isFinite(data.expires_in) || data.expires_in <= 0) throw new XeroError('INVALID_PROVIDER_RESPONSE');
  if (typeof data.scope !== 'string' || XERO_SCOPES.split(' ').some(scope => !data.scope.split(' ').includes(scope))) throw new XeroError('INSUFFICIENT_SCOPE');
  const allowed = new Set([...XERO_SCOPES.split(' '), 'openid', 'profile', 'email']);
  if (data.scope.split(' ').some((scope: string) => !allowed.has(scope))) throw new XeroError('EXCESS_SCOPE');
  return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt: Date.now() + data.expires_in * 1000 };
}

export async function connections(accessToken: string): Promise<Array<{ tenantId: string; tenantName: string }>> {
  const response = await fetch('https://api.xero.com/connections', {
    headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new XeroError('PROVIDER_UNAVAILABLE');
  const data: unknown = await response.json();
  if (!Array.isArray(data) || !data.every(item => typeof item.tenantId === 'string' && typeof item.tenantName === 'string')) throw new XeroError('INVALID_PROVIDER_RESPONSE');
  return data;
}

export async function accountingRead(tokens: Tokens, tenantId: string, resource: 'Invoices' | 'BankTransactions', where: string) {
  const url = new URL(`https://api.xero.com/api.xro/2.0/${resource}`);
  url.searchParams.set('where', where); url.searchParams.set('page', '1'); url.searchParams.set('pageSize', '20');
  const response = await fetch(url, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${tokens.accessToken}`, 'Xero-tenant-id': tenantId, Accept: 'application/json' } });
  if (!response.ok) throw new XeroError(response.status === 401 ? 'RECONNECT_REQUIRED' : 'READ_FAILED');
  const data = await response.json();
  if (!Array.isArray(data[resource])) throw new XeroError('INVALID_PROVIDER_RESPONSE');
  // Return only review fields, never bank account details or full accounting payloads.
  const text = (value: unknown) => typeof value === 'string' ? value.slice(0,300) : '';
  const amount = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null;
  return data[resource].slice(0, 20).map((row: Record<string, unknown>) => {
    if (!row || typeof row !== 'object' || typeof (row.InvoiceID ?? row.BankTransactionID) !== 'string') throw new XeroError('INVALID_PROVIDER_RESPONSE');
    return {
      id: text(row.InvoiceID ?? row.BankTransactionID), reference: text(row.InvoiceNumber ?? row.Reference),
      contact: text((row.Contact as { Name?: string } | undefined)?.Name), status: text(row.Status),
      date: text(row.DateString ?? row.Date), total: amount(row.Total), paid: amount(row.AmountPaid),
      currency: text(row.CurrencyCode), reconciled: typeof row.IsReconciled === 'boolean' ? row.IsReconciled : null,
    };
  });
}
