import 'server-only';
import { supabaseServiceRole } from '../supabaseClient';
import { appIdFromUuid } from '../supabase/mappers';
import type { MatchInvoice } from '../xero/paymentSuggestions';

/** Developer-gated review only. No payment commands, artifacts or delivery side effects. */
export async function loadInvoiceForPaymentReview(invoiceRef: string) {
  const result = await supabaseServiceRole.from('deposit_invoices')
    .select('id,project_id,invoice_ref,status,invoice_kind,payment_term_position,customer_name,project_name,total_inc_gst_cents,reference')
    .eq('invoice_ref', invoiceRef).limit(2);
  if (result.error) throw new Error('REVIEW_UNAVAILABLE');
  if (!result.data?.length) throw new Error('INVOICE_NOT_FOUND');
  if (result.data.length !== 1) throw new Error('AMBIGUOUS_INVOICE');
  const row = result.data[0];
  const payments = await supabaseServiceRole.from('project_payment_entries').select('id').eq('project_id', row.project_id).limit(1);
  if (payments.error) throw new Error('REVIEW_UNAVAILABLE');
  const total = Number(row.total_inc_gst_cents);
  if (!Number.isSafeInteger(total) || total <= 0 || !['OPEN','PAID','VOID','DRAFT'].includes(row.status)) throw new Error('REVIEW_UNAVAILABLE');
  const invoice: MatchInvoice = {
    id: appIdFromUuid('inv', row.id), projectId: appIdFromUuid('proj', row.project_id),
    invoiceRef: row.invoice_ref, status: row.status as MatchInvoice['status'],
    invoiceKind: row.invoice_kind as MatchInvoice['invoiceKind'], paymentTermPosition: row.payment_term_position,
    customerName: row.customer_name, projectName: row.project_name, totalIncGstCents: total, reference: row.reference,
  };
  return { invoice, entries: payments.data ?? [] };
}
