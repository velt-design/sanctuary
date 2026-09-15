import 'server-only';
import type { XeroDraftInvoice } from './invoiceDraftMapping';
import { reconcileXeroDraft } from './invoiceDraftReconciliation';
export type InvoiceObservation = {
  state: 'draft' | 'awaiting_approval' | 'posted' | 'payment_recorded' | 'conflict' | 'correction_pending' | 'correction_complete';
  reason: string; amountPaidCents: number | null;
};
const cents = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  const result = Math.round(value * 100);
  return Number.isSafeInteger(result) && Math.abs(result - value * 100) < 0.000001 ? result : null;
};
/** Observation of an already-bound invoice only; never adopts a search result,
 * changes a portal receipt, or relaxes the DRAFT-only creation finaliser. */
export function observeXeroInvoice(expected: XeroDraftInvoice, providerInvoiceId: string, portalVoided: boolean, evidence: unknown): InvoiceObservation {
  const conflict = (reason: string): InvoiceObservation => ({ state: 'conflict', reason, amountPaidCents: null });
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) return conflict('INVALID_PROVIDER_RESPONSE');
  const row = evidence as Record<string, unknown>;
  if (row.InvoiceID !== providerInvoiceId) return conflict('INVOICE_ID_CHANGED');
  const status = row.Status;
  if (!['DRAFT', 'SUBMITTED', 'AUTHORISED', 'PAID', 'VOIDED', 'DELETED'].includes(String(status))) return conflict('UNKNOWN_XERO_STATUS');
  const paid = cents(row.AmountPaid); const total = cents(row.Total); const credited = row.AmountCredited === undefined ? 0 : cents(row.AmountCredited);
  if (paid === null || total === null || paid > total || credited !== 0) return conflict('ACCOUNTING_ADJUSTMENT_REVIEW');
  const comparison = reconcileXeroDraft({ ...expected, Status: 'DRAFT' }, { ...row, Status: 'DRAFT', AmountPaid: 0 });
  if (comparison.outcome !== 'MATCHED_DRAFT') return conflict(comparison.reason);
  if (portalVoided) {
    if (['VOIDED', 'DELETED'].includes(String(status)) && paid === 0) return { state: 'correction_complete', reason: 'BOTH_SYSTEMS_VOIDED', amountPaidCents: 0 };
    return { state: 'correction_pending', reason: 'PORTAL_VOID_REQUIRES_XERO_REVIEW', amountPaidCents: paid };
  }
  if (['VOIDED', 'DELETED'].includes(String(status))) return conflict('XERO_VOIDED_INDEPENDENTLY');
  if ((status === 'DRAFT' || status === 'SUBMITTED') && paid !== 0) return conflict('UNPOSTED_PAYMENT_REVIEW');
  if (status === 'PAID' && paid !== total) return conflict('PAYMENT_TOTAL_REVIEW');
  return { state: paid > 0 ? 'payment_recorded' : status === 'DRAFT' ? 'draft' : status === 'SUBMITTED' ? 'awaiting_approval' : 'posted',
    reason: paid > 0 ? 'REVIEW_PAYMENT_MATCH_IN_PORTAL' : 'INVOICE_CONTENT_UNCHANGED', amountPaidCents: paid };
}
