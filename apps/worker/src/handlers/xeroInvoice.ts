import { parseXeroInvoiceJobPayloadV1 } from '@sp/jobs';
import type { XeroInvoiceGatewayConfig } from '../config';
import { BackgroundJobHandlerError } from '../runtime/errors';
import type { BackgroundJobHandler } from '../runtime/contracts';

// Preserve only known, non-private causes from our authenticated gateway.
// Arbitrary provider messages and response bodies must never enter job history.
const reviewCodes = new Set(['XERO_MAPPING_REQUIRED', 'XERO_MAPPING_CHANGED', 'XERO_TAX_MAPPING_REVIEW_REQUIRED',
  'XERO_INVOICE_CHANGED', 'XERO_IDEMPOTENCY_EXPIRED', 'IDEMPOTENCY_WINDOW_EXPIRED',
  'EXISTING_INVOICE_REVIEW', 'XERO_INVOICE_CONFLICT', 'INSUFFICIENT_SCOPE']);

export function createXeroInvoiceHandler(config: XeroInvoiceGatewayConfig, fetcher: typeof fetch = fetch): BackgroundJobHandler {
  return async ({ claim, payload, signal, rpc }) => {
    if (signal.aborted) throw signal.reason;
    try { parseXeroInvoiceJobPayloadV1(payload.payload); } catch {
      throw new BackgroundJobHandlerError({ code: 'XERO_JOB_PAYLOAD_INVALID', disposition: 'needs_attention' });
    }
    if (!['provider_accepted', 'finalising'].includes(claim.status)) {
      await rpc.progress({ status: 'running', phase: 'xero_invoice_transfer',
        safeProgress: { phase: 'xero_invoice_transfer', progressCode: 'checking_invoice' } });
    }
    let response: Response;
    try {
      response = await fetcher(`${config.origin}/api/integrations/xero/worker`, {
        method: 'POST', redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(50000)]),
        headers: { Authorization: `Bearer ${config.secret}`, 'Content-Type': 'application/json',
          ...(config.protectionBypassSecret ? { 'x-vercel-protection-bypass': config.protectionBypassSecret } : {}) },
        body: JSON.stringify({ jobId: claim.jobId, leaseToken: claim.leaseToken }),
      });
    } catch {
      if (signal.aborted) throw signal.reason;
      throw new BackgroundJobHandlerError({ code: 'XERO_GATEWAY_UNAVAILABLE', disposition: 'retry' });
    }
    if (!response.ok) {
      let code = 'XERO_TRANSFER_REVIEW_REQUIRED';
      if (response.status === 409) {
        try {
          const error: unknown = await response.json();
          if (error && typeof error === 'object' && 'code' in error
            && typeof error.code === 'string' && reviewCodes.has(error.code)) code = error.code;
        } catch { /* Keep the safe fallback for non-JSON gateway failures. */ }
      }
      throw new BackgroundJobHandlerError({ code,
        disposition: response.status >= 500 || response.status === 429 ? 'retry' : 'needs_attention' });
    }
    const result: unknown = await response.json();
    if (!result || typeof result !== 'object' || !('resultCode' in result) || result.resultCode !== 'XERO_DRAFT_VERIFIED'
      || !('processedCount' in result) || result.processedCount !== 1) {
      throw new BackgroundJobHandlerError({ code: 'XERO_GATEWAY_INVALID_RESULT', disposition: 'retry' });
    }
    await rpc.refreshEffects();
    return { safeResult: { resultCode: 'XERO_DRAFT_VERIFIED', processedCount: 1 } };
  };
}
