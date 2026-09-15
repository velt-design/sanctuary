import { afterEach, describe, expect, it, vi } from 'vitest';
const run = vi.hoisted(() => vi.fn());
vi.mock('@/lib/xero/invoiceTransfer', () => ({ executeInvoiceTransfer: run }));
vi.mock('@/lib/xero/invoiceTransferProvider', () => ({ invoiceTransferProvider: {} }));
vi.mock('@/lib/invoices/xeroInvoiceTransferRepository', () => ({ xeroInvoiceTransferRepository: {} }));
import { POST } from '../../app/api/integrations/xero/worker/route';

const secret = 'synthetic-secret-with-at-least-32-characters';
const body = { jobId: '11111111-1111-4111-8111-111111111111', leaseToken: '22222222-2222-4222-8222-222222222222' };
const request = (value: unknown = body, authenticated = true) => new Request('https://portal.example.test/api/integrations/xero/worker', {
  method: 'POST', headers: authenticated ? { Authorization: `Bearer ${secret}` } : {}, body: JSON.stringify(value),
});
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
describe('Xero worker portal boundary', () => {
  it('denies missing configuration and missing worker authentication before domain access', async () => {
    expect((await POST(request())).status).toBe(403);
    vi.stubEnv('XERO_INVOICE_GATEWAY_SECRET', secret);
    expect((await POST(request(body, false))).status).toBe(403);
    expect(run).not.toHaveBeenCalled();
  });
  it('rejects substituted invoice IDs, amounts or arbitrary parameters', async () => {
    vi.stubEnv('XERO_INVOICE_GATEWAY_SECRET', secret);
    expect((await POST(request({ ...body, invoiceId: body.jobId }))).status).toBe(400);
    expect((await POST(request({ ...body, leaseToken: 'bad' }))).status).toBe(400);
    expect(run).not.toHaveBeenCalled();
  });
  it('passes the lease to the database owner and returns only the business result', async () => {
    vi.stubEnv('XERO_INVOICE_GATEWAY_SECRET', secret);
    run.mockResolvedValue({ resultCode: 'XERO_DRAFT_VERIFIED', processedCount: 1 });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(run).toHaveBeenCalledWith(body, expect.anything(), expect.anything());
  });
  it('returns fixed review or retry errors without leaking raw diagnostics', async () => {
    vi.stubEnv('XERO_INVOICE_GATEWAY_SECRET', secret);
    run.mockRejectedValue(new Error('XERO_MAPPING_REQUIRED'));
    expect((await POST(request())).status).toBe(409);
    run.mockRejectedValue(new Error('private database connection details'));
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('private database');
  });
});
