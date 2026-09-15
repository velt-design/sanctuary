import 'server-only';
import { z } from 'zod';
import { supabaseServiceRole } from '../supabaseClient';
import type { DepositApproval } from '../xero/paymentApproval';
const cents = z.number().int().nonnegative().max(2147483647);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const invoicePaymentContextSchema = z.object({
  invoice: z.object({ id: z.string().uuid(), projectId: z.string().uuid(), invoiceRef: z.string(),
    status: z.enum(['OPEN', 'PAID', 'VOID', 'DRAFT']), invoiceKind: z.enum(['QUOTE_LINKED', 'STANDALONE']),
    paymentTermPosition: z.number().int().nullable(), totalIncGstCents: cents, currency: z.string(),
    customerName: z.string().nullable(), projectName: z.string().nullable() }),
  invoiceFingerprint: hash, ledgerFingerprint: hash, matchedCents: cents,
  customerWon: z.boolean(), hasUnmatchedPaymentHistory: z.boolean(), hasOtherSourceHistory: z.boolean(),
  providerInvoiceId: z.string().uuid(), expectedBody: z.string().max(1000000),
});
export type InvoicePaymentContext = z.infer<typeof invoicePaymentContextSchema>;
export async function loadInvoicePaymentContext(actor: string, invoiceId: string, tenantId: string): Promise<InvoicePaymentContext> {
  const result = await supabaseServiceRole.rpc('xero_invoice_payment_review_context', { p_actor: actor, p_invoice_id: invoiceId, p_tenant_id: tenantId });
  const parsed = invoicePaymentContextSchema.safeParse(result.data);
  if (result.error || !parsed.success || parsed.data.invoice.id !== invoiceId) throw new Error('PAYMENT_REVIEW_UNAVAILABLE');
  return parsed.data;
}
export async function commitInvoicePayment(approval: DepositApproval, reference: string) {
  const e = approval.evidence;
  if (!e.invoicePayment) throw new Error('APPROVAL_REVIEW_REQUIRED');
  const result = await supabaseServiceRole.rpc('xero_approve_invoice_payment', {
    p_approval_id: approval.approvalId, p_actor: approval.approverId, p_tenant_id: e.tenantId,
    p_receipt_id: e.receiptId, p_contact_id: e.contactId, p_project_id: e.projectId, p_invoice_id: e.invoiceId,
    p_amount_cents: e.amountCents, p_receipt_date: e.receiptDate, p_invoice_fingerprint: e.invoiceFingerprint,
    p_ledger_fingerprint: e.ledgerFingerprint, p_evidence_fingerprint: e.receiptFingerprint, p_reference: reference,
    p_provider_invoice_id: e.invoicePayment.providerInvoiceId,
  });
  const parsed = z.object({ matchId: z.string().uuid(), paymentEntryId: z.string().uuid(), replayed: z.boolean() }).safeParse(result.data);
  if (result.error || !parsed.success) throw new Error('PAYMENT_REVIEW_REQUIRED');
  return parsed.data;
}
