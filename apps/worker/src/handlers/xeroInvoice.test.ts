import { describe, expect, it, vi } from 'vitest';
import { createXeroInvoiceHandler } from './xeroInvoice';
import { loadXeroInvoiceGatewayConfig } from '../config';
import type { BackgroundJobHandler } from '../runtime/contracts';

const id = '11111111-1111-4111-8111-111111111111';
function context(): Parameters<BackgroundJobHandler>[0] {
  return { claim: { jobId: id, leaseToken: id, status: 'running' }, payload: { payload: { contractVersion: 1,
    transferId: id, invoiceId: id, tenantId: id } }, signal: new AbortController().signal,
    rpc: { progress: vi.fn(), refreshEffects: vi.fn() } } as unknown as Parameters<BackgroundJobHandler>[0];
}
const config = { origin: 'https://portal.example.test', secret: 'synthetic-only-gateway-secret-at-least32' };

describe('Xero worker gateway', () => {
  it('is disabled by default and requires an exact HTTPS origin and secret when enabled', () => {
    expect(loadXeroInvoiceGatewayConfig({})).toBe(null);
    expect(() => loadXeroInvoiceGatewayConfig({ XERO_INVOICE_WORKER_ENABLED: 'true' })).toThrow();
    expect(() => loadXeroInvoiceGatewayConfig({ XERO_INVOICE_WORKER_ENABLED: 'true',
      XERO_INVOICE_GATEWAY_SECRET: config.secret, XERO_INVOICE_PORTAL_ORIGIN: 'http://example.test' })).toThrow();
  });
  it('sends only the job and current secret lease, then refreshes effects before completion', async () => {
    const fetcher = vi.fn(async () => Response.json({ resultCode: 'XERO_DRAFT_VERIFIED', processedCount: 1 }));
    const ctx = context();
    expect(await createXeroInvoiceHandler(config, fetcher)(ctx)).toEqual({ safeResult: { resultCode: 'XERO_DRAFT_VERIFIED', processedCount: 1 } });
    expect(fetcher).toHaveBeenCalledWith(config.origin + '/api/integrations/xero/worker', expect.objectContaining({
      body: JSON.stringify({ jobId: id, leaseToken: id }), redirect: 'error',
      headers: { Authorization: 'Bearer ' + config.secret, 'Content-Type': 'application/json' },
    }));
    expect(ctx.rpc.refreshEffects).toHaveBeenCalledTimes(1);
  });
  it('uses a separate protection header only for an explicitly configured Vercel origin', async () => {
    const protectedConfig = loadXeroInvoiceGatewayConfig({ XERO_INVOICE_WORKER_ENABLED: 'true',
      XERO_INVOICE_GATEWAY_SECRET: config.secret, XERO_INVOICE_PORTAL_ORIGIN: 'https://finance-demo.vercel.app',
      XERO_INVOICE_VERCEL_AUTOMATION_BYPASS_SECRET: 'synthetic-vercel-protection-credential' })!;
    const fetcher = vi.fn(async () => Response.json({ resultCode: 'XERO_DRAFT_VERIFIED', processedCount: 1 }));
    await createXeroInvoiceHandler(protectedConfig, fetcher)(context());
    expect(fetcher).toHaveBeenCalledWith('https://finance-demo.vercel.app/api/integrations/xero/worker', expect.objectContaining({
      redirect: 'error', headers: { Authorization: 'Bearer ' + config.secret, 'Content-Type': 'application/json',
        'x-vercel-protection-bypass': 'synthetic-vercel-protection-credential' },
      body: JSON.stringify({ jobId: id, leaseToken: id }),
    }));
    for (const origin of ['https://portal.example.test', 'https://finance.vercel.app.example.test']) {
      expect(() => loadXeroInvoiceGatewayConfig({ XERO_INVOICE_WORKER_ENABLED: 'true',
        XERO_INVOICE_GATEWAY_SECRET: config.secret, XERO_INVOICE_PORTAL_ORIGIN: origin,
        XERO_INVOICE_VERCEL_AUTOMATION_BYPASS_SECRET: 'synthetic-vercel-protection-credential' }))
        .toThrow('XERO_GATEWAY_INVALID_PROTECTION_CREDENTIAL');
    }
    expect(() => loadXeroInvoiceGatewayConfig({ XERO_INVOICE_WORKER_ENABLED: 'true',
      XERO_INVOICE_GATEWAY_SECRET: config.secret, XERO_INVOICE_PORTAL_ORIGIN: 'https://finance-demo.vercel.app',
      XERO_INVOICE_VERCEL_AUTOMATION_BYPASS_SECRET: 'invalid\r\nheader-value' }))
      .toThrow('XERO_GATEWAY_INVALID_PROTECTION_CREDENTIAL');
  });
  it('does not move a resumed finalisation backwards into running', async () => {
    const ctx = context();
    const resumed = { ...ctx, claim: { ...ctx.claim, status: 'finalising' as const } };
    await createXeroInvoiceHandler(config, async () => Response.json({ resultCode: 'XERO_DRAFT_VERIFIED', processedCount: 1 }))(resumed);
    expect(ctx.rpc.progress).not.toHaveBeenCalled();
  });
  it.each([403,409,503])('classifies %s without exposing the response body', async status => {
    const handler = createXeroInvoiceHandler(config, async () => new Response('private accounting payload', { status }));
    await expect(handler(context())).rejects.toMatchObject({ code: 'XERO_TRANSFER_REVIEW_REQUIRED',
      disposition: status === 503 ? 'retry' : 'needs_attention' });
  });
  it('honours cancellation without dispatching', async () => {
    const fetcher = vi.fn(); const controller = new AbortController(); controller.abort(new Error('Cancelled'));
    await expect(createXeroInvoiceHandler(config, fetcher)({ ...context(), signal: controller.signal })).rejects.toThrow('Cancelled');
    expect(fetcher).not.toHaveBeenCalled();
  });
});
