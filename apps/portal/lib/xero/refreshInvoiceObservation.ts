import 'server-only';
import { invoiceObservationContext, recordInvoiceObservation, type ObservationResult } from '../invoices/invoiceObservationRepository';
import { invoiceTransferProvider } from './invoiceTransferProvider';
import { observeXeroInvoice } from './invoiceObservation';
import type { XeroDraftInvoice } from './invoiceDraftMapping';
export async function refreshInvoiceObservation(invoiceId: string, tenantId: string) {
  const context = await invoiceObservationContext(invoiceId, tenantId);
  const document = JSON.parse(context.body) as { Invoices?: XeroDraftInvoice[] };
  if (!Array.isArray(document.Invoices) || document.Invoices.length !== 1) throw new Error('XERO_OBSERVATION_UNAVAILABLE');
  let observation: ObservationResult;
  try {
    const evidence = await invoiceTransferProvider.readInvoice(tenantId, context.providerInvoiceId);
    observation = observeXeroInvoice(document.Invoices[0], context.providerInvoiceId, context.portalStatus === 'VOID', evidence);
  } catch { observation = { state: 'unavailable', reason: 'XERO_READ_FAILED', amountPaidCents: null }; }
  await recordInvoiceObservation(context, observation);
  return observation;
}
