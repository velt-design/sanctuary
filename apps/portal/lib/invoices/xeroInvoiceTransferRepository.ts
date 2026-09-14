import 'server-only';
import { supabaseServiceRole } from '../supabaseClient';
import type { FrozenInvoiceTransfer, InvoiceTransferLease, InvoiceTransferRepository } from '../xero/invoiceTransfer';
import { reconcileXeroDraft } from '../xero/invoiceDraftReconciliation';

const knownErrors = new Set(['XERO_JOB_NOT_AUTHORISED', 'XERO_TRANSFER_DISABLED', 'XERO_INVOICE_CHANGED',
  'XERO_MAPPING_REQUIRED', 'XERO_MAPPING_CHANGED', 'XERO_REQUEST_INVALID', 'XERO_REQUEST_CHANGED',
  'XERO_REQUEST_TOTAL_MISMATCH', 'XERO_REQUEST_ALREADY_ACCEPTED', 'XERO_IDEMPOTENCY_EXPIRED',
  'XERO_VERIFICATION_MISMATCH', 'XERO_INVOICE_ID_CONFLICT', 'XERO_EFFECT_IDENTITY_MISMATCH', 'XERO_TAX_MAPPING_REVIEW_REQUIRED']);

async function command(name: string, params: Record<string, unknown>): Promise<unknown> {
  const result = await supabaseServiceRole.rpc(name, params);
  if (result.error) {
    const message = result.error.message;
    if (knownErrors.has(message)) throw new Error(message);
    if (message?.includes('lease is no longer owned')) throw new Error('XERO_LEASE_LOST');
    throw new Error('XERO_TRANSFER_UNAVAILABLE');
  }
  return result.data;
}
const leaseParams = (lease: InvoiceTransferLease) => ({ p_job_id: lease.jobId, p_lease_token: lease.leaseToken });

function frozen(value: unknown): FrozenInvoiceTransfer {
  if (!value || typeof value !== 'object') throw new Error('XERO_REQUEST_INVALID');
  const row = value as Record<string, unknown>;
  if (typeof row.body !== 'string' || typeof row.bodyHash !== 'string' || typeof row.tenantId !== 'string'
    || typeof row.idempotencyKey !== 'string' || typeof row.expiresAt !== 'number'
    || !Number.isFinite(row.expiresAt) || typeof row.dispatchStarted !== 'boolean' || typeof row.finalised !== 'boolean'
    || (row.providerInvoiceId !== null && typeof row.providerInvoiceId !== 'string')) throw new Error('XERO_REQUEST_INVALID');
  // Derive the draft from the exact saved bytes, not PostgreSQL jsonb key order.
  let body;
  try { body = JSON.parse(row.body); } catch { throw new Error('XERO_REQUEST_INVALID'); }
  if (!Array.isArray(body?.Invoices) || body.Invoices.length !== 1) throw new Error('XERO_REQUEST_INVALID');
  return { tenantId: row.tenantId, body: row.body, bodyHash: row.bodyHash, idempotencyKey: row.idempotencyKey,
    expiresAt: row.expiresAt, dispatchStarted: row.dispatchStarted, providerInvoiceId: row.providerInvoiceId,
    finalised: row.finalised, draft: body.Invoices[0] };
}

export const xeroInvoiceTransferRepository: InvoiceTransferRepository = {
  async context(lease) {
    const result = await command('xero_invoice_transfer_context', leaseParams(lease));
    if (!result || typeof result !== 'object' || !('invoice' in result) || !('mapping' in result)) throw new Error('XERO_REQUEST_INVALID');
    return result as Awaited<ReturnType<InvoiceTransferRepository['context']>>;
  },
  async prepare(lease, request) {
    return frozen(await command('xero_invoice_prepare_request', { ...leaseParams(lease), p_tenant_id: request.tenantId, p_body: request.body }));
  },
  async beginDispatch(lease) {
    return frozen(await command('xero_invoice_begin_dispatch', leaseParams(lease)));
  },
  async finalise(lease, invoiceId, bodyHash, verification) {
    const match = reconcileXeroDraft(verification.draft, verification.evidence);
    if (match.outcome !== 'MATCHED_DRAFT' || match.invoiceId !== invoiceId) throw new Error('XERO_VERIFICATION_MISMATCH');
    const evidence = verification.evidence as { Total: number; TotalTax: number; SubTotal: number };
    await command('xero_invoice_finalise', { ...leaseParams(lease), p_body_hash: bodyHash,
      p_proof: { invoiceId, draft: verification.draft, totalCents: Math.round(evidence.Total * 100),
        taxCents: Math.round(evidence.TotalTax * 100), subtotalCents: Math.round(evidence.SubTotal * 100) } });
  },
};
