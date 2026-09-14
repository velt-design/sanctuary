import 'server-only';
import { config } from './security';
import { access } from './store';
import { XeroError, type Tokens } from './provider';
import type { InvoiceTransferProvider, FrozenInvoiceTransfer } from './invoiceTransfer';

const API = 'https://api.xero.com/api.xro/2.0/Invoices';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function authorised(tenantId: string, write: boolean): Promise<Tokens> {
  if (!uuid.test(tenantId) || tenantId !== config().tenantId) throw new XeroError('XERO_TENANT_MISMATCH');
  if (write && process.env.XERO_INVOICE_TRANSFERS_ENABLED !== 'true') throw new XeroError('XERO_INVOICE_TRANSFERS_DISABLED');
  const tokens = await access();
  if (write && !tokens.scopes?.includes('accounting.invoices')) throw new XeroError('INSUFFICIENT_SCOPE');
  return tokens;
}

async function invoiceResponse(response: Response): Promise<Record<string, unknown>[]> {
  if (!response.ok) throw new XeroError(response.status === 401 ? 'RECONNECT_REQUIRED' : 'XERO_INVOICE_REQUEST_FAILED');
  const body: unknown = await response.json();
  const rows = body && typeof body === 'object' ? (body as { Invoices?: unknown }).Invoices : null;
  if (!Array.isArray(rows) || rows.length > 2 || rows.some(row => !row || typeof row !== 'object' || Array.isArray(row))) {
    throw new XeroError('INVALID_PROVIDER_RESPONSE');
  }
  return rows;
}

async function get(tenantId: string, url: URL): Promise<Record<string, unknown>[]> {
  const tokens = await authorised(tenantId, false);
  return invoiceResponse(await fetch(url, {
    cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${tokens.accessToken}`, 'Xero-tenant-id': tenantId, Accept: 'application/json' },
  }));
}

export const invoiceTransferProvider: InvoiceTransferProvider = {
  async findInvoice(tenantId, invoiceNumber) {
    if (!invoiceNumber.trim() || invoiceNumber.length > 255 || /[\u0000-\u001f]/.test(invoiceNumber)) throw new XeroError('INVALID_INVOICE_NUMBER');
    const url = new URL(API);
    url.searchParams.set('where', `Type=="ACCREC"&&InvoiceNumber=="${invoiceNumber.replaceAll('"', '""')}"`);
    url.searchParams.set('page', '1'); url.searchParams.set('pageSize', '2');
    return get(tenantId, url);
  },
  async readInvoice(tenantId, invoiceId) {
    if (!uuid.test(invoiceId)) throw new XeroError('INVALID_RECORD_ID');
    const rows = await get(tenantId, new URL(`${API}/${invoiceId}`));
    if (rows.length !== 1 || rows[0].InvoiceID !== invoiceId) throw new XeroError('INVALID_PROVIDER_RESPONSE');
    return rows[0];
  },
  async createDraft(request: FrozenInvoiceTransfer) {
    const tokens = await authorised(request.tenantId, true);
    if (!request.dispatchStarted || Date.now() + 15000 >= request.expiresAt
      || request.draft.Status !== 'DRAFT' || request.draft.Type !== 'ACCREC'
      || request.body !== JSON.stringify({ Invoices: [request.draft] })) throw new XeroError('INVALID_FROZEN_REQUEST');
    const response = await fetch(API, {
      method: 'PUT', body: request.body, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${tokens.accessToken}`, 'Xero-tenant-id': request.tenantId,
        Accept: 'application/json', 'Content-Type': 'application/json', 'Idempotency-Key': request.idempotencyKey },
    });
    const rows = await invoiceResponse(response);
    const id = rows[0]?.InvoiceID;
    if (rows.length !== 1 || typeof id !== 'string' || !uuid.test(id) || rows[0].HasErrors === true) throw new XeroError('INVALID_PROVIDER_RESPONSE');
    return { invoiceId: id };
  },
};
