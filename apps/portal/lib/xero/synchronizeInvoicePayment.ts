import 'server-only';
import { recordNextInvoicePayment } from './automaticInvoicePayment';
import { recordPaymentSyncStatus } from '../invoices/automaticInvoicePaymentRepository';

export async function synchronizeInvoicePayment(invoiceId: string, tenantId: string) {
  let result;
  try {
    result = await recordNextInvoicePayment(invoiceId, tenantId);
  } catch {
    // Keep private provider/SQL errors out of customer-facing state.
    await recordPaymentSyncStatus(invoiceId, tenantId, 'unavailable', 'PAYMENT_CHECK_FAILED');
    throw new Error('PAYMENT_CHECK_FAILED');
  }
  await recordPaymentSyncStatus(invoiceId, tenantId, result.state, 'reason' in result ? result.reason! : 'PAYMENT_CHECK_COMPLETE');
  return result;
}
