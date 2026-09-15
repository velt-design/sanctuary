import 'server-only';
import { validateFrozen, type FrozenInvoiceTransfer, type InvoiceTransferProvider } from './invoiceTransfer';
import { reconcileXeroDraft } from './invoiceDraftReconciliation';
export type InvoiceRecoveryRepository = {
  load(): Promise<FrozenInvoiceTransfer>;
  finalise(request: FrozenInvoiceTransfer, invoiceId: string, evidence: unknown): Promise<void>;
};

/** No create/dispatch method is available to this recovery path. Expiry never enables a new request. */
export async function recoverInvoiceTransfer(repository: InvoiceRecoveryRepository,
  provider: Pick<InvoiceTransferProvider, 'findInvoice' | 'readInvoice'>): Promise<{ state: 'recovered' | 'already_verified' }> {
  const request = await repository.load();
  validateFrozen(request);
  if (!request.dispatchStarted) throw new Error('XERO_NO_DISPATCH_TO_RECOVER');
  if (request.finalised) return { state: 'already_verified' };
  const candidates = request.providerInvoiceId ? [await provider.readInvoice(request.tenantId, request.providerInvoiceId)]
    : await provider.findInvoice(request.tenantId, request.draft.InvoiceNumber);
  if (candidates.length !== 1) throw new Error(candidates.length ? 'XERO_INVOICE_CONFLICT' : 'XERO_RECOVERY_NOT_FOUND');
  const match = reconcileXeroDraft(request.draft, candidates[0]);
  if (match.outcome !== 'MATCHED_DRAFT' || (request.providerInvoiceId && request.providerInvoiceId !== match.invoiceId)) throw new Error('XERO_INVOICE_CONFLICT');
  await repository.finalise(request, match.invoiceId, candidates[0]);
  return { state: 'recovered' };
}
