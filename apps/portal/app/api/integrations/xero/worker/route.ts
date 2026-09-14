import { equalSecret } from '@/lib/xero/security';
import { executeInvoiceTransfer } from '@/lib/xero/invoiceTransfer';
import { invoiceTransferProvider } from '@/lib/xero/invoiceTransferProvider';
import { xeroInvoiceTransferRepository } from '@/lib/invoices/xeroInvoiceTransferRepository';

export const runtime = 'nodejs';
export const maxDuration = 60;
const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reviewErrors = new Set(['XERO_TAX_MAPPING_REVIEW_REQUIRED', 'XERO_MAPPING_REQUIRED', 'XERO_MAPPING_CHANGED', 'XERO_INVOICE_CHANGED',
  'XERO_TRANSFER_DISABLED', 'XERO_LEASE_LOST', 'XERO_JOB_NOT_AUTHORISED', 'XERO_REQUEST_CHANGED',
  'XERO_REQUEST_ALREADY_ACCEPTED', 'XERO_IDEMPOTENCY_EXPIRED', 'XERO_VERIFICATION_MISMATCH',
  'XERO_INVOICE_ID_CONFLICT', 'XERO_EFFECT_IDENTITY_MISMATCH', 'EXISTING_INVOICE_REVIEW',
  'XERO_INVOICE_CONFLICT', 'IDEMPOTENCY_WINDOW_EXPIRED', 'INVALID_FROZEN_REQUEST',
  'INSUFFICIENT_SCOPE', 'XERO_INVOICE_TRANSFERS_DISABLED', 'MISSING_MAPPING', 'MISSING_CONTENT',
  'NOT_ISSUED', 'INVALID_INVOICE', 'TOTAL_MISMATCH']);

export async function POST(request: Request) {
  const secret = process.env.XERO_INVOICE_GATEWAY_SECRET;
  if (!secret || secret.length < 32 || !equalSecret(request.headers.get('authorization') ?? '', `Bearer ${secret}`)) {
    return Response.json({ code: 'FORBIDDEN' }, { status: 403, headers });
  }
  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > 2048) throw new Error();
    body = JSON.parse(text);
  } catch { return Response.json({ code: 'INVALID_REQUEST' }, { status: 400, headers }); }
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || Object.keys(body).sort().join(',') !== 'jobId,leaseToken'
    || !('jobId' in body) || typeof body.jobId !== 'string' || !uuid.test(body.jobId)
    || !('leaseToken' in body) || typeof body.leaseToken !== 'string' || !uuid.test(body.leaseToken)) {
    return Response.json({ code: 'INVALID_REQUEST' }, { status: 400, headers });
  }
  try {
    const result = await executeInvoiceTransfer({ jobId: body.jobId, leaseToken: body.leaseToken },
      xeroInvoiceTransferRepository, invoiceTransferProvider);
    return Response.json(result, { headers });
  } catch (error) {
    const code = error instanceof Error && reviewErrors.has(error.message) ? error.message : 'XERO_TRANSFER_UNAVAILABLE';
    return Response.json({ code }, { status: code === 'XERO_TRANSFER_UNAVAILABLE' ? 503 : 409, headers });
  }
}
