import 'server-only';
import { createHash } from 'node:crypto';
import { automaticPaymentContext, recordAutomaticPayment } from '../invoices/automaticInvoicePaymentRepository';
import { activeReceiptMatches } from '../invoices/xeroMatchRepository';
import { invoicePaymentProvider } from './invoicePaymentProvider';
import { invoiceTransferProvider } from './invoiceTransferProvider';
import { evidence, inspect, invoiceEvidence } from './invoicePaymentAssessment';

const dependencies = {
  context: automaticPaymentContext, record: recordAutomaticPayment, matches: activeReceiptMatches,
  readInvoice: invoiceTransferProvider.readInvoice, list: invoicePaymentProvider.list, payment: invoicePaymentProvider.payment,
};

function recordingId(tenantId: string, receiptId: string) {
  const hash = createHash('sha256').update(`sanctuary.xero.automatic-payment.v1:${tenantId.toLowerCase()}:${receiptId.toLowerCase()}`).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-8${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

/** One receipt per call bounds provider work; subsequent polls continue instalments. */
export async function recordNextInvoicePayment(invoiceId: string, tenantId: string, deps = dependencies) {
  const context = await deps.context(invoiceId, tenantId);
  // The cron checks three invoices concurrently. Keep each invoice's provider
  // calls sequential so this phase cannot exceed Xero's five-call tenant limit.
  const raw = await deps.readInvoice(tenantId, context.providerInvoiceId);
  const result = await deps.list(tenantId, context.providerInvoiceId);
  if (result.limited) return { state: 'review' as const, reason: 'PAYMENT_LIST_INCOMPLETE' };
  const invoice = invoiceEvidence(context, raw);
  if (['conflict', 'correction_pending', 'correction_complete'].includes(invoice.observation.state)) {
    return { state: 'review' as const, reason: 'INVOICE_REQUIRES_REVIEW' };
  }
  const matches = await deps.matches(tenantId, result.payments.map(payment => payment.id));
  const candidates = [];
  for (const payment of result.payments) {
    const match = matches.find(existing => existing.receiptId === payment.id);
    if (match && (match.invoiceId !== invoiceId || match.sourceKind !== 'INVOICE_PAYMENT')) {
      return { state: 'review' as const, reason: 'PAYMENT_ALREADY_BOUND_ELSEWHERE' };
    }
    const checked = inspect(context, payment, invoice, match?.amountCents);
    if (checked.blockers.length) {
      // Only describe this as a reconciliation wait when every other identity,
      // status and balance check passes. Never hide a second conflict behind it.
      const reconciliationOnly = payment.reconciled === false
        && inspect(context, { ...payment, reconciled: true }, invoice, match?.amountCents).blockers.length === 0;
      return { state: 'review' as const, reason: reconciliationOnly
        ? (match ? 'RECORDED_PAYMENT_NO_LONGER_RECONCILED' : 'PAYMENT_AWAITING_RECONCILIATION')
        : 'PAYMENT_EVIDENCE_CONFLICT' };
    }
    if (!match) candidates.push(payment);
  }
  if (!candidates.length) {
    if (invoice.observation.amountPaidCents !== context.matchedCents) return { state: 'review' as const, reason: 'PAYMENT_TOTAL_NOT_ACCOUNTED_FOR' };
    return { state: 'current' as const };
  }
  const candidate = candidates.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))[0];
  // Re-read the exact receipt before writing. The SQL owner checks the portal
  // fingerprints under locks; it also refuses reversed or finance-flagged receipts.
  const fresh = await deps.payment(tenantId, context.providerInvoiceId, candidate.id);
  if (inspect(context, fresh, invoice).blockers.length
    || evidence(context, fresh, invoice, tenantId).receiptFingerprint !== evidence(context, candidate, invoice, tenantId).receiptFingerprint) {
    return { state: 'review' as const, reason: 'PAYMENT_CHANGED_DURING_CHECK' };
  }
  const recorded = await deps.record(recordingId(tenantId, fresh.id), evidence(context, fresh, invoice, tenantId), fresh.reference);
  return { state: 'recorded' as const, ...recorded, more: candidates.length > 1 };
}
