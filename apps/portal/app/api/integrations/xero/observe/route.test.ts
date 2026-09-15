import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ targets: vi.fn(), observation: vi.fn(), sync: vi.fn() }));
vi.mock('@/lib/xero/security', () => ({ config: () => ({ tenantId: 'tenant' }), equalSecret: (a: string, b: string) => a === b }));
vi.mock('@/lib/invoices/invoiceObservationRepository', () => ({ invoiceObservationTargets: mocks.targets }));
vi.mock('@/lib/xero/refreshInvoiceObservation', () => ({ refreshInvoiceObservation: mocks.observation }));
vi.mock('@/lib/xero/synchronizeInvoicePayment', () => ({ synchronizeInvoicePayment: mocks.sync }));
import { GET } from './route';
const secret = 'a'.repeat(32);
const request = () => new Request('https://portal.test', { headers: { authorization: `Bearer ${secret}` } });
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv('CRON_SECRET', secret); vi.stubEnv('XERO_ENABLED', 'true');
  vi.stubEnv('XERO_INVOICE_OBSERVATION_ENABLED', 'true'); vi.stubEnv('XERO_AUTOMATIC_PAYMENTS_ENABLED', 'false');
  mocks.targets.mockResolvedValue(['invoice']); mocks.observation.mockResolvedValue({ state: 'payment_recorded' });
});
afterEach(() => vi.unstubAllEnvs());
it('does not run automatic recording before rollout is enabled', async () => {
  expect((await GET(request())).status).toBe(200); expect(mocks.sync).not.toHaveBeenCalled();
});
it('runs the bounded payment check after observation when enabled', async () => {
  vi.stubEnv('XERO_AUTOMATIC_PAYMENTS_ENABLED', 'true');
  expect((await GET(request())).status).toBe(200); expect(mocks.sync).toHaveBeenCalledWith('invoice', 'tenant');
});
it('returns failure for an unavailable payment check', async () => {
  vi.stubEnv('XERO_AUTOMATIC_PAYMENTS_ENABLED', 'true'); mocks.sync.mockRejectedValue(new Error('unavailable'));
  expect((await GET(request())).status).toBe(503);
});
it('rejects unauthenticated calls before reading or writing', async () => {
  expect((await GET(new Request('https://portal.test'))).status).toBe(401); expect(mocks.targets).not.toHaveBeenCalled();
});
