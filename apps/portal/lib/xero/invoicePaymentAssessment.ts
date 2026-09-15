import 'server-only';
import type { InvoicePaymentContext } from '../invoices/invoicePaymentRepository';
import type { invoicePaymentProvider } from './invoicePaymentProvider';
import { observeXeroInvoice } from './invoiceObservation';
import type { XeroDraftInvoice } from './invoiceDraftMapping';
import { evidenceFingerprint, type DepositEvidence } from './paymentApproval';

type Payment = Awaited<ReturnType<typeof invoicePaymentProvider.payment>>;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function invoiceEvidence(context: InvoicePaymentContext, raw: unknown) {
  const document = JSON.parse(context.expectedBody) as { Invoices: XeroDraftInvoice[] };
  if (!Array.isArray(document.Invoices) || document.Invoices.length !== 1) throw new Error('PAYMENT_REVIEW_UNAVAILABLE');
  const expected = document.Invoices[0];
  const observation = observeXeroInvoice(expected, context.providerInvoiceId, context.invoice.status === 'VOID', raw);
  const row = raw as Record<string, unknown> | null;
  // Financial content is compared with the frozen request above; mutable
  // payment/status evidence is separately bound to the exact human review.
  return { contactId: expected.Contact.ContactID, observation,
    fingerprint: evidenceFingerprint({ providerInvoiceId: context.providerInvoiceId, expectedBody: context.expectedBody,
      status: row?.Status, amountPaid: row?.AmountPaid, amountCredited: row?.AmountCredited, updatedAt: row?.UpdatedDateUTC }) };
}
export function inspect(context: InvoicePaymentContext, payment: Payment, invoice: ReturnType<typeof invoiceEvidence>, recordedAmountCents?: number) {
  const blockers: string[] = [];
  const value = payment.total === null ? NaN : payment.total * 100;
  const amountCents = Number.isSafeInteger(Math.round(value)) && Math.abs(value - Math.round(value)) < 0.000001 ? Math.round(value) : null;
  const remaining = context.invoice.totalIncGstCents - context.matchedCents;
  if ((context.invoice.status !== 'OPEN' && !(recordedAmountCents !== undefined && context.invoice.status === 'PAID')) || context.invoice.currency !== 'NZD' || remaining < 0) blockers.push('The portal invoice or its balance needs review.');
  if (context.hasUnmatchedPaymentHistory || context.hasOtherSourceHistory) blockers.push('Reconcile existing project receipts before importing this payment.');
  if (invoice.observation.state !== 'payment_recorded') blockers.push('Xero invoice details or payment status need investigation.');
  if (payment.providerInvoiceId !== context.providerInvoiceId || !uuid.test(payment.id) || !uuid.test(payment.contactId)
    || payment.contactId !== invoice.contactId || payment.transactionType !== 'ACCRECPAYMENT' || !payment.updatedAt) blockers.push('The payment identity or invoice ownership could not be verified.');
  if (payment.status !== 'AUTHORISED' || payment.reconciled !== true) blockers.push('Xero has not confirmed an authorised, reconciled payment.');
  if (payment.currency !== 'NZD' || payment.currencyRate !== 1) blockers.push('Currency evidence needs separate review.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payment.date)) blockers.push('The payment date could not be verified.');
  if (amountCents === null || amountCents <= 0 || (recordedAmountCents === undefined
    ? amountCents > remaining || context.matchedCents + amountCents > (invoice.observation.amountPaidCents ?? 0)
    : amountCents !== recordedAmountCents || amountCents > (invoice.observation.amountPaidCents ?? 0))) blockers.push('The payment amount does not fit the verified invoice balance.');
  return { blockers, amountCents, remainingIfApprovedCents: blockers.length || amountCents === null ? null : remaining - amountCents };
}
export function evidence(context: InvoicePaymentContext, payment: Payment, invoice: ReturnType<typeof invoiceEvidence>, tenantId: string): DepositEvidence {
  return { tenantId, receiptId: payment.id, contactId: payment.contactId, projectId: context.invoice.projectId,
    invoiceId: context.invoice.id, amountCents: Math.round(payment.total! * 100), receiptDate: payment.date,
    invoiceTotalCents: context.invoice.totalIncGstCents, invoiceFingerprint: context.invoiceFingerprint,
    ledgerFingerprint: context.ledgerFingerprint,
    receiptFingerprint: evidenceFingerprint({ payment, invoiceEvidenceFingerprint: invoice.fingerprint }),
    invoicePayment: { providerInvoiceId: context.providerInvoiceId, invoiceEvidenceFingerprint: invoice.fingerprint } };
}
