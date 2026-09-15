import 'server-only';
import { z } from 'zod';
import { supabaseServiceRole } from '../supabaseClient';
import { invoicePaymentContextSchema } from './invoicePaymentRepository';
import type { DepositEvidence } from '../xero/paymentApproval';

export async function automaticPaymentContext(invoiceId: string, tenantId: string) {
  const result = await supabaseServiceRole.rpc('xero_automatic_payment_context', { p_invoice_id: invoiceId, p_tenant_id: tenantId });
  const parsed = invoicePaymentContextSchema.safeParse(result.data);
  if (result.error || !parsed.success || parsed.data.invoice.id !== invoiceId) throw new Error('AUTOMATIC_PAYMENT_UNAVAILABLE');
  return parsed.data;
}

export async function recordAutomaticPayment(id: string, evidence: DepositEvidence, reference: string) {
  if (!evidence.invoicePayment) throw new Error('AUTOMATIC_PAYMENT_BINDING_REQUIRED');
  const result = await supabaseServiceRole.rpc('xero_record_invoice_payment', {
    p_approval_id: id, p_tenant_id: evidence.tenantId, p_receipt_id: evidence.receiptId,
    p_contact_id: evidence.contactId, p_project_id: evidence.projectId, p_invoice_id: evidence.invoiceId,
    p_amount_cents: evidence.amountCents, p_receipt_date: evidence.receiptDate,
    p_invoice_fingerprint: evidence.invoiceFingerprint, p_ledger_fingerprint: evidence.ledgerFingerprint,
    p_evidence_fingerprint: evidence.receiptFingerprint, p_reference: reference,
    p_provider_invoice_id: evidence.invoicePayment.providerInvoiceId,
  });
  const parsed = z.object({ matchId: z.string().uuid(), paymentEntryId: z.string().uuid(), replayed: z.boolean() }).safeParse(result.data);
  if (result.error || !parsed.success) throw new Error('AUTOMATIC_PAYMENT_REVIEW_REQUIRED');
  return parsed.data;
}

export async function recordPaymentSyncStatus(invoiceId: string, tenantId: string, state: 'current' | 'recorded' | 'review' | 'unavailable', reason: string) {
  const result = await supabaseServiceRole.rpc('xero_record_payment_sync_status', {
    p_invoice_id: invoiceId, p_tenant_id: tenantId, p_state: state, p_reason: reason,
  });
  if (result.error) throw new Error('PAYMENT_SYNC_STATUS_UNAVAILABLE');
}
