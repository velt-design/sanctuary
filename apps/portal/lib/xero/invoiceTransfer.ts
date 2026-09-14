import 'server-only';
import { createHash } from 'node:crypto';
import { mapIssuedInvoiceToXeroDraft, type IssuedInvoiceForXero, type XeroDraftInvoice, type XeroInvoiceMapping } from './invoiceDraftMapping';
import { reconcileXeroDraft } from './invoiceDraftReconciliation';

export type InvoiceTransferLease = { jobId: string; leaseToken: string };
export type FrozenInvoiceTransfer = {
  tenantId: string;
  draft: XeroDraftInvoice;
  body: string;
  bodyHash: string;
  idempotencyKey: string;
  expiresAt: number;
  dispatchStarted: boolean;
  providerInvoiceId: string | null;
  finalised: boolean;
};

export type InvoiceTransferRepository = {
  /** Validates job/lease, active tenant, issued state and verified finance mapping. */
  context(lease: InvoiceTransferLease): Promise<{ invoice: IssuedInvoiceForXero; mapping: XeroInvoiceMapping }>;
  /** Atomically freezes or returns the original exact request. Never overwrites it. */
  prepare(lease: InvoiceTransferLease, request: { tenantId: string; draft: XeroDraftInvoice; body: string; bodyHash: string }): Promise<FrozenInvoiceTransfer>;
  /** Rechecks current lease, invoice/tenant gate and expiry before committing dispatch. */
  beginDispatch(lease: InvoiceTransferLease): Promise<FrozenInvoiceTransfer>;
  /** Records accepted provider identity and finalises the canonical job effect atomically. */
  finalise(lease: InvoiceTransferLease, providerInvoiceId: string, bodyHash: string): Promise<void>;
};

export type InvoiceTransferProvider = {
  findInvoice(tenantId: string, invoiceNumber: string): Promise<readonly unknown[]>;
  readInvoice(tenantId: string, invoiceId: string): Promise<unknown>;
  createDraft(request: FrozenInvoiceTransfer): Promise<{ invoiceId: string }>;
};

export class InvoiceTransferError extends Error {
  constructor(readonly code: 'INVALID_FROZEN_REQUEST' | 'EXISTING_INVOICE_REVIEW' | 'XERO_INVOICE_CONFLICT'
    | 'IDEMPOTENCY_WINDOW_EXPIRED' | 'PROVIDER_OUTCOME_UNCERTAIN') { super(code); }
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
function validateFrozen(request: FrozenInvoiceTransfer): void {
  if (request.draft.Status !== 'DRAFT' || request.draft.Type !== 'ACCREC'
    || request.body !== JSON.stringify({ Invoices: [request.draft] })
    || sha256(request.body) !== request.bodyHash
    || !/^[a-zA-Z0-9._:-]{16,128}$/.test(request.idempotencyKey)
    || !Number.isFinite(request.expiresAt)) {
    throw new InvoiceTransferError('INVALID_FROZEN_REQUEST');
  }
}

/** All provider writes pass one durable dispatch checkpoint; a retry uses stored bytes. */
export async function executeInvoiceTransfer(
  lease: InvoiceTransferLease,
  repository: InvoiceTransferRepository,
  provider: InvoiceTransferProvider,
  now: () => number = Date.now,
): Promise<{ resultCode: 'XERO_DRAFT_VERIFIED'; processedCount: 1 }> {
  const context = await repository.context(lease);
  const draft = mapIssuedInvoiceToXeroDraft(context.invoice, context.mapping);
  const body = JSON.stringify({ Invoices: [draft] });
  let frozen = await repository.prepare(lease, { tenantId: context.mapping.tenantId, draft, body, bodyHash: sha256(body) });
  validateFrozen(frozen);
  if (frozen.tenantId !== context.mapping.tenantId || frozen.body !== body) {
    throw new InvoiceTransferError('INVALID_FROZEN_REQUEST');
  }
  if (frozen.finalised) return { resultCode: 'XERO_DRAFT_VERIFIED', processedCount: 1 };

  const candidates = frozen.providerInvoiceId
    ? [await provider.readInvoice(frozen.tenantId, frozen.providerInvoiceId)]
    : await provider.findInvoice(frozen.tenantId, frozen.draft.InvoiceNumber);
  if (candidates.length > 0) {
    // A matching number does not authorize adopting a pre-existing accounting
    // record. Recovery requires evidence that this transfer previously dispatched.
    if (!frozen.dispatchStarted || candidates.length !== 1) throw new InvoiceTransferError('EXISTING_INVOICE_REVIEW');
    const match = reconcileXeroDraft(frozen.draft, candidates[0]);
    if (match.outcome !== 'MATCHED_DRAFT') throw new InvoiceTransferError('XERO_INVOICE_CONFLICT');
    if (frozen.providerInvoiceId && frozen.providerInvoiceId !== match.invoiceId) throw new InvoiceTransferError('XERO_INVOICE_CONFLICT');
    await repository.finalise(lease, match.invoiceId, frozen.bodyHash);
    return { resultCode: 'XERO_DRAFT_VERIFIED', processedCount: 1 };
  }
  if (frozen.providerInvoiceId) throw new InvoiceTransferError('XERO_INVOICE_CONFLICT');
  if (now() >= frozen.expiresAt) throw new InvoiceTransferError('IDEMPOTENCY_WINDOW_EXPIRED');
  const prepared = frozen;
  frozen = await repository.beginDispatch(lease);
  validateFrozen(frozen);
  if (frozen.body !== prepared.body || frozen.tenantId !== prepared.tenantId
    || frozen.idempotencyKey !== prepared.idempotencyKey || frozen.expiresAt !== prepared.expiresAt
    || !frozen.dispatchStarted) throw new InvoiceTransferError('INVALID_FROZEN_REQUEST');
  // Leave at least the provider request timeout before the conservative expiry.
  if (now() + 15_000 >= frozen.expiresAt) throw new InvoiceTransferError('IDEMPOTENCY_WINDOW_EXPIRED');
  let created: { invoiceId: string };
  try {
    created = await provider.createDraft(frozen);
  } catch {
    // A timeout cannot establish whether Xero committed. The next attempt starts
    // with a read and never creates a fresh idempotency key for this intent.
    throw new InvoiceTransferError('PROVIDER_OUTCOME_UNCERTAIN');
  }
  const evidence = await provider.readInvoice(frozen.tenantId, created.invoiceId);
  const match = reconcileXeroDraft(frozen.draft, evidence);
  if (match.outcome !== 'MATCHED_DRAFT' || match.invoiceId !== created.invoiceId) throw new InvoiceTransferError('XERO_INVOICE_CONFLICT');
  await repository.finalise(lease, match.invoiceId, frozen.bodyHash);
  return { resultCode: 'XERO_DRAFT_VERIFIED', processedCount: 1 };
}
