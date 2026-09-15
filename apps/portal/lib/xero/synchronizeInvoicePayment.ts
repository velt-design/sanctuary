import 'server-only';
import { recordNextInvoicePayment } from './automaticInvoicePayment';
import { recordPaymentSyncStatus } from '../invoices/automaticInvoicePaymentRepository';
import { refreshInvoiceObservation } from './refreshInvoiceObservation';

export async function synchronizeInvoicePayment(invoiceId: string, tenantId: string) {
  let result;
  try {
    result = await recordNextInvoicePayment(invoiceId, tenantId);
    // Settlement can change OPEN to PAID, invalidating the previous observation's
    // portal-status binding. Finish that confirmation without another staff click.
    if (result.state === 'recorded') {
      const confirmation = await refreshInvoiceObservation(invoiceId, tenantId);
      if (confirmation.state === 'unavailable') throw new Error('PAYMENT_CONFIRMATION_UNAVAILABLE');
    }
  } catch {
    // Keep private provider/SQL errors out of customer-facing state.
    await recordPaymentSyncStatus(invoiceId, tenantId, 'unavailable', 'PAYMENT_CHECK_FAILED');
    throw new Error('PAYMENT_CHECK_FAILED');
  }
  await recordPaymentSyncStatus(invoiceId, tenantId, result.state, 'reason' in result ? result.reason! : 'PAYMENT_CHECK_COMPLETE');
  return result;
}
