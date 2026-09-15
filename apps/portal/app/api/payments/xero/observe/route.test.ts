import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ session: vi.fn(), origin: vi.fn(), observation: vi.fn(), sync: vi.fn() }));
vi.mock('@/lib/xero/security', () => ({ config: () => ({ tenantId: 'tenant' }) }));
vi.mock('@/lib/xero/pilotAccess', () => ({ getPaymentPilotSession: mocks.session }));
vi.mock('@/lib/xero/http', () => ({ sameOrigin: mocks.origin, json: (body: unknown, status = 200) => Response.json(body, { status }) }));
vi.mock('@/lib/xero/refreshInvoiceObservation', () => ({ refreshInvoiceObservation: mocks.observation }));
vi.mock('@/lib/xero/synchronizeInvoicePayment', () => ({ synchronizeInvoicePayment: mocks.sync }));
import { POST } from './route';
const id = '33333333-3333-4333-8333-333333333333';
const request = () => new Request('https://portal.test/api/payments/xero/observe', { method: 'POST', body: JSON.stringify({ invoiceId: id }) });
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv('XERO_INVOICE_OBSERVATION_ENABLED', 'true'); vi.stubEnv('XERO_AUTOMATIC_PAYMENTS_ENABLED', 'true');
  mocks.session.mockResolvedValue({ user: { id } }); mocks.origin.mockReturnValue(true);
  mocks.observation.mockResolvedValue({ state: 'payment_recorded' }); mocks.sync.mockResolvedValue({ state: 'recorded' });
});
afterEach(() => vi.unstubAllEnvs());
it('refreshes payment recording through the same automatic owner', async () => {
  expect(await (await POST(request())).json()).toEqual({ checked: true, paymentState: 'recorded' });
  expect(mocks.sync).toHaveBeenCalledWith(id, 'tenant');
});
it.each(['permission', 'origin', 'disabled', 'unavailable'])('does not write payments when %s blocks the check', async reason => {
  if (reason === 'permission') mocks.session.mockResolvedValue(null);
  if (reason === 'origin') mocks.origin.mockReturnValue(false);
  if (reason === 'disabled') vi.stubEnv('XERO_AUTOMATIC_PAYMENTS_ENABLED', 'false');
  if (reason === 'unavailable') mocks.observation.mockResolvedValue({ state: 'unavailable' });
  await POST(request()); expect(mocks.sync).not.toHaveBeenCalled();
});
it('reports a failed automatic check without claiming the balance is current', async () => {
  mocks.sync.mockRejectedValue(new Error('private diagnostic'));
  const response = await POST(request()); expect(response.status).toBe(503);
  expect(await response.text()).not.toContain('private diagnostic');
});
