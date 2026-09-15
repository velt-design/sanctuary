import 'server-only';
import { loadInvoicePaymentContext, commitInvoicePayment } from '../invoices/invoicePaymentRepository';
import { activeReceiptMatches, findPilotMatch } from '../invoices/xeroMatchRepository';
import { invoicePaymentProvider } from './invoicePaymentProvider';
import { invoiceTransferProvider } from './invoiceTransferProvider';
import { assertApprovalEvidenceUnchanged, prepareDepositApproval, readDepositApproval } from './paymentApproval';
import { config } from './security';
import { invoiceEvidence, inspect, evidence } from './invoicePaymentAssessment';

export async function reviewInvoicePayments(invoiceId: string, actor: string) {
  const cfg = config(); const context = await loadInvoicePaymentContext(actor, invoiceId, cfg.tenantId);
  const [rawInvoice, result] = await Promise.all([invoiceTransferProvider.readInvoice(cfg.tenantId, context.providerInvoiceId),
    invoicePaymentProvider.list(cfg.tenantId, context.providerInvoiceId)]);
  const invoice = invoiceEvidence(context, rawInvoice);
  const active = await activeReceiptMatches(cfg.tenantId, result.payments.map(payment => payment.id));
  const suggestions = result.payments.map(payment => {
    const activeMatch = active.find(match => match.receiptId === payment.id);
    const alreadyRecorded = Boolean(activeMatch && activeMatch.invoiceId === context.invoice.id);
    const checked = inspect(context, payment, invoice, alreadyRecorded ? activeMatch!.amountCents : undefined);
    if (activeMatch) checked.blockers.push(alreadyRecorded ? 'This payment is already recorded in the portal.' : 'This payment is recorded against another portal invoice. Finance must investigate the match.');
    if (result.limited) checked.blockers.push('The payment list is incomplete. Finance must check the remaining payments.');
    const approvalToken = checked.blockers.length ? null : prepareDepositApproval(evidence(context, payment, invoice, cfg.tenantId), actor, cfg.key);
    const approvalId = approvalToken ? readDepositApproval(approvalToken, actor, cfg.tenantId, cfg.key).approvalId : null;
    return { payment, alreadyRecorded, ...checked, remainingIfApprovedCents: checked.blockers.length ? null : checked.remainingIfApprovedCents, approvalToken, approvalId };
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
