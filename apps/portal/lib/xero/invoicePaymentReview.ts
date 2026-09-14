import 'server-only';
import { loadInvoicePaymentContext, commitInvoicePayment, type InvoicePaymentContext } from '../invoices/invoicePaymentRepository';
import { activeReceiptMatches, findPilotMatch } from '../invoices/xeroMatchRepository';
import { invoicePaymentProvider } from './invoicePaymentProvider';
import { invoiceTransferProvider } from './invoiceTransferProvider';
import { observeXeroInvoice } from './invoiceObservation';
import type { XeroDraftInvoice } from './invoiceDraftMapping';
import { assertApprovalEvidenceUnchanged, evidenceFingerprint, prepareDepositApproval, readDepositApproval, type DepositEvidence } from './paymentApproval';
import { config } from './security';

type Payment = Awaited<ReturnType<typeof invoicePaymentProvider.payment>>;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function invoiceEvidence(context: InvoicePaymentContext, raw: unknown) {
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
function inspect(context: InvoicePaymentContext, payment: Payment, invoice: ReturnType<typeof invoiceEvidence>) {
  const blockers: string[] = [];
  const value = payment.total === null ? NaN : payment.total * 100;
  const amountCents = Number.isSafeInteger(Math.round(value)) && Math.abs(value - Math.round(value)) < 0.000001 ? Math.round(value) : null;
  const remaining = context.invoice.totalIncGstCents - context.matchedCents;
  if (context.invoice.status !== 'OPEN' || context.invoice.currency !== 'NZD' || remaining < 0) blockers.push('The portal invoice or its balance needs review.');
  if (context.hasUnmatchedPaymentHistory || context.hasOtherSourceHistory) blockers.push('Reconcile existing project receipts before importing this payment.');
  if (invoice.observation.state !== 'payment_recorded') blockers.push('Xero invoice details or payment status need investigation.');
  if (payment.providerInvoiceId !== context.providerInvoiceId || !uuid.test(payment.id) || !uuid.test(payment.contactId)
    || payment.contactId !== invoice.contactId || payment.transactionType !== 'ACCRECPAYMENT' || !payment.updatedAt) blockers.push('The payment identity or invoice ownership could not be verified.');
  if (payment.status !== 'AUTHORISED' || payment.reconciled !== true) blockers.push('Xero has not confirmed an authorised, reconciled payment.');
  if (payment.currency !== 'NZD' || payment.currencyRate !== 1) blockers.push('Currency evidence needs separate review.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payment.date)) blockers.push('The payment date could not be verified.');
  if (amountCents === null || amountCents <= 0 || amountCents > remaining || context.matchedCents + amountCents > (invoice.observation.amountPaidCents ?? 0)) blockers.push('The payment amount does not fit the verified invoice balance.');
  return { blockers, amountCents, remainingIfApprovedCents: blockers.length || amountCents === null ? null : remaining - amountCents };
}
function evidence(context: InvoicePaymentContext, payment: Payment, invoice: ReturnType<typeof invoiceEvidence>, tenantId: string): DepositEvidence {
  return { tenantId, receiptId: payment.id, contactId: payment.contactId, projectId: context.invoice.projectId,
    invoiceId: context.invoice.id, amountCents: Math.round(payment.total! * 100), receiptDate: payment.date,
    invoiceTotalCents: context.invoice.totalIncGstCents, invoiceFingerprint: context.invoiceFingerprint,
    ledgerFingerprint: context.ledgerFingerprint,
    receiptFingerprint: evidenceFingerprint({ payment, invoiceEvidenceFingerprint: invoice.fingerprint }),
    invoicePayment: { providerInvoiceId: context.providerInvoiceId, invoiceEvidenceFingerprint: invoice.fingerprint } };
}
export async function reviewInvoicePayments(invoiceId: string, actor: string) {
  const cfg = config(); const context = await loadInvoicePaymentContext(actor, invoiceId, cfg.tenantId);
  const [rawInvoice, result] = await Promise.all([invoiceTransferProvider.readInvoice(cfg.tenantId, context.providerInvoiceId),
    invoicePaymentProvider.list(cfg.tenantId, context.providerInvoiceId)]);
  const invoice = invoiceEvidence(context, rawInvoice);
  const active = await activeReceiptMatches(cfg.tenantId, result.payments.map(payment => payment.id));
  const suggestions = result.payments.map(payment => {
    const checked = inspect(context, payment, invoice);
    if (active.some(match => match.receiptId === payment.id)) checked.blockers.push('This payment is already recorded in the portal.');
    if (result.limited) checked.blockers.push('The payment list is incomplete. Finance must check the remaining payments.');
    const approvalToken = checked.blockers.length ? null : prepareDepositApproval(evidence(context, payment, invoice, cfg.tenantId), actor, cfg.key);
    const approvalId = approvalToken ? readDepositApproval(approvalToken, actor, cfg.tenantId, cfg.key).approvalId : null;
    return { payment, ...checked, remainingIfApprovedCents: checked.blockers.length ? null : checked.remainingIfApprovedCents, approvalToken, approvalId };
  });
  return { invoice: context.invoice, customerWon: context.customerWon, suggestions, limited: result.limited, checkedAt: new Date().toISOString() };
}
export async function approveInvoicePayment(token: string, actor: string) {
  const cfg = config(); const approval = readDepositApproval(token, actor, cfg.tenantId, cfg.key);
  const e = approval.evidence;
  if (!e.invoicePayment) throw new Error('APPROVAL_REVIEW_REQUIRED');
  const previous = await findPilotMatch(approval.approvalId);
  if (previous) {
    if (previous.sourceKind !== 'INVOICE_PAYMENT' || previous.providerInvoiceId !== e.invoicePayment.providerInvoiceId
      || previous.approvedBy !== actor || previous.tenantId !== e.tenantId || previous.receiptId !== e.receiptId
      || previous.invoiceId !== e.invoiceId || previous.projectId !== e.projectId || previous.amountCents !== e.amountCents
      || previous.evidenceFingerprint !== e.receiptFingerprint || previous.reversedAt) throw new Error('APPROVAL_EVIDENCE_CHANGED');
    return { matchId: previous.id, paymentEntryId: previous.paymentEntryId, replayed: true };
  }
  const context = await loadInvoicePaymentContext(actor, e.invoiceId, cfg.tenantId);
  if (context.providerInvoiceId !== e.invoicePayment.providerInvoiceId) throw new Error('APPROVAL_EVIDENCE_CHANGED');
  const [rawInvoice, payment] = await Promise.all([invoiceTransferProvider.readInvoice(cfg.tenantId, context.providerInvoiceId),
    invoicePaymentProvider.payment(cfg.tenantId, context.providerInvoiceId, e.receiptId)]);
  const invoice = invoiceEvidence(context, rawInvoice);
  if (inspect(context, payment, invoice).blockers.length) throw new Error('APPROVAL_EVIDENCE_CHANGED');
  assertApprovalEvidenceUnchanged(approval, evidence(context, payment, invoice, cfg.tenantId));
  return commitInvoicePayment(approval, payment.reference);
}
