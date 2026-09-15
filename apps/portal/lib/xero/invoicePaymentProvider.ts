import 'server-only';
import { config } from './security';
import { access } from './store';
import { XeroError } from './provider';
import type { VerifiedReceipt } from './pilotTypes';
type VerifiedInvoicePayment = VerifiedReceipt & { sourceKind: 'INVOICE_PAYMENT'; providerInvoiceId: string; currencyRate: number | null };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown, max = 240) => typeof value === 'string' && value.length <= max ? value : '';
function dateOnly(value: unknown): string {
  const source = text(value); const legacy = /^\/Date\((-?\d+)(?:\+0000)?\)\/$/.exec(source);
  if (legacy) {
    const timestamp = Number(legacy[1]);
    if (!Number.isSafeInteger(timestamp) || timestamp % 86400000 !== 0) return '';
    const date = new Date(timestamp); return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : '';
  }
  if (!/^\d{4}-\d{2}-\d{2}(?:T00:00:00(?:\.000)?Z?)?$/.test(source)) return '';
  const day = source.slice(0, 10); const date = new Date(day);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === day ? day : '';
}
function normalize(row: Record<string, unknown>, invoiceId: string): VerifiedInvoicePayment {
  const invoice = object(row.Invoice); const contact = object(invoice.Contact);
  if (!uuid.test(text(row.PaymentID)) || invoice.InvoiceID !== invoiceId || invoice.Type !== 'ACCREC') throw new XeroError('XERO_PAYMENT_BINDING_INVALID');
  if (row.HasValidationErrors === true || (Array.isArray(row.ValidationErrors) && row.ValidationErrors.length)) throw new XeroError('INVALID_PROVIDER_RESPONSE');
  return { sourceKind: 'INVOICE_PAYMENT', providerInvoiceId: invoiceId, id: text(row.PaymentID),
    contactId: text(contact.ContactID), contact: text(contact.Name), reference: text(row.Reference),
    transactionType: text(row.PaymentType), status: text(row.Status), date: dateOnly(row.DateString ?? row.Date),
    total: typeof row.Amount === 'number' && Number.isFinite(row.Amount) ? row.Amount : null,
    currency: text(invoice.CurrencyCode, 3), reconciled: typeof row.IsReconciled === 'boolean' ? row.IsReconciled : null,
    updatedAt: text(row.UpdatedDateUTC), currencyRate: typeof row.CurrencyRate === 'number' && Number.isFinite(row.CurrencyRate) ? row.CurrencyRate : null };
}
async function read(tenantId: string, invoiceId: string, paymentId?: string) {
  if (!uuid.test(tenantId) || tenantId !== config().tenantId) throw new XeroError('XERO_TENANT_MISMATCH');
  if (!uuid.test(invoiceId) || (paymentId !== undefined && !uuid.test(paymentId))) throw new XeroError('INVALID_RECORD_ID');
  const tokens = await access();
  if (!tokens.scopes?.includes('accounting.payments.read')) throw new XeroError('INSUFFICIENT_SCOPE');
  const url = new URL(`https://api.xero.com/api.xro/2.0/Payments${paymentId ? `/${paymentId}` : ''}`);
  if (!paymentId) {
    url.searchParams.set('where', `Invoice.InvoiceID==guid("${invoiceId}")&&PaymentType=="ACCRECPAYMENT"`);
    url.searchParams.set('page', '1'); url.searchParams.set('pageSize', '21');
  }
  const response = await fetch(url, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Bearer ${tokens.accessToken}`, 'Xero-tenant-id': tenantId, Accept: 'application/json' } });
  if (!response.ok) throw new XeroError(response.status === 401 ? 'RECONNECT_REQUIRED' : 'XERO_PAYMENT_READ_FAILED');
  const body: unknown = await response.json(); const rows = object(body).Payments;
  if (!Array.isArray(rows) || rows.length > 21) throw new XeroError('INVALID_PROVIDER_RESPONSE');
  const payments = rows.map(row => normalize(object(row), invoiceId));
  if (new Set(payments.map(payment => payment.id.toLowerCase())).size !== payments.length) throw new XeroError('INVALID_PROVIDER_RESPONSE');
  if (paymentId && (payments.length !== 1 || payments[0].id !== paymentId)) throw new XeroError('XERO_PAYMENT_BINDING_INVALID');
  return payments;
}
export const invoicePaymentProvider = {
  async list(tenantId: string, invoiceId: string) {
    const rows = await read(tenantId, invoiceId); return { payments: rows.slice(0, 20), limited: rows.length > 20 };
  },
  async payment(tenantId: string, invoiceId: string, paymentId: string) { return (await read(tenantId, invoiceId, paymentId))[0]; },
};
