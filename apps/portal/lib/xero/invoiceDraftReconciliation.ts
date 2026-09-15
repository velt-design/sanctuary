import 'server-only';
import type { XeroDraftInvoice } from './invoiceDraftMapping';

type Reconciliation =
  | { outcome: 'MATCHED_DRAFT'; invoiceId: string }
  | { outcome: 'REVIEW_REQUIRED'; reason: 'INVALID_RESPONSE' | 'NOT_A_DRAFT' | 'INVOICE_CHANGED' | 'TOTAL_MISMATCH' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;

function moneyCents(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const result = Math.round(value * 100);
  return Number.isSafeInteger(result) && Math.abs(value * 100 - result) < 0.000001 ? result : null;
}

function dateOnly(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4}-\d{2}-\d{2})(?:T00:00:00(?:\.000)?Z?)?$/.exec(value);
  if (match) return match[1];
  const legacy = /^\/Date\((-?\d+)(?:\+0000)?\)\/$/.exec(value);
  if (!legacy) return null;
  const timestamp = Number(legacy[1]);
  if (!Number.isSafeInteger(timestamp) || timestamp % 86400000 !== 0) return null;
  const date = new Date(timestamp);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : null;
}

/** Compare provider evidence with the frozen request before adopting or finalising it. */
export function reconcileXeroDraft(expected: XeroDraftInvoice, evidence: unknown): Reconciliation {
  const row = record(evidence);
  if (!row || typeof row.InvoiceID !== 'string' || !UUID.test(row.InvoiceID)
    || row.HasErrors === true || (Array.isArray(row.ValidationErrors) && row.ValidationErrors.length > 0)) {
    return { outcome: 'REVIEW_REQUIRED', reason: 'INVALID_RESPONSE' };
  }
  if (!['DRAFT', 'AUTHORISED'].includes(expected.Status) || row.Status !== expected.Status) return { outcome: 'REVIEW_REQUIRED', reason: 'NOT_A_DRAFT' };
  const contact = record(row.Contact);
  if (row.Type !== expected.Type || row.InvoiceNumber !== expected.InvoiceNumber
    || row.Reference !== expected.Reference || contact?.ContactID !== expected.Contact.ContactID
    || row.CurrencyCode !== expected.CurrencyCode || row.LineAmountTypes !== expected.LineAmountTypes
    || dateOnly(row.DateString ?? row.Date) !== expected.Date
    || dateOnly(row.DueDateString ?? row.DueDate) !== expected.DueDate
    || !Array.isArray(row.LineItems) || row.LineItems.length !== expected.LineItems.length) {
    return { outcome: 'REVIEW_REQUIRED', reason: 'INVOICE_CHANGED' };
  }
  let total = 0;
  let tax = 0;
  for (let index = 0; index < expected.LineItems.length; index++) {
    const line = record(row.LineItems[index]);
    const target = expected.LineItems[index];
    if (!line || line.Description !== target.Description || line.Quantity !== target.Quantity
      || line.AccountCode !== target.AccountCode || line.TaxType !== target.TaxType
      || moneyCents(line.UnitAmount) !== moneyCents(target.UnitAmount)
      || moneyCents(line.LineAmount) !== moneyCents(target.LineAmount)
      || moneyCents(line.TaxAmount) !== moneyCents(target.TaxAmount)
      || (line.DiscountRate !== undefined && line.DiscountRate !== 0)
      || (line.DiscountAmount !== undefined && line.DiscountAmount !== 0)
      || (line.Tracking !== undefined && (!Array.isArray(line.Tracking) || line.Tracking.length > 0))) {
      return { outcome: 'REVIEW_REQUIRED', reason: 'INVOICE_CHANGED' };
    }
    total += moneyCents(target.LineAmount)!;
    tax += moneyCents(target.TaxAmount)!;
  }
  if (moneyCents(row.Total) !== total || moneyCents(row.TotalTax) !== tax
    || moneyCents(row.SubTotal) !== total - tax || moneyCents(row.AmountPaid) !== 0
    || (row.AmountCredited !== undefined && moneyCents(row.AmountCredited) !== 0)) {
    return { outcome: 'REVIEW_REQUIRED', reason: 'TOTAL_MISMATCH' };
  }
  return { outcome: 'MATCHED_DRAFT', invoiceId: row.InvoiceID };
}
