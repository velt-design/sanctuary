import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ session: vi.fn(), origin: vi.fn(), targets: vi.fn(), refresh: vi.fn() }));
vi.mock('./pilotAccess', () => ({ getPaymentPilotSession: mocks.session }));
vi.mock('./http', () => ({ sameOrigin: mocks.origin, json: (body: unknown, status = 200) => Response.json(body, { status }) }));
vi.mock('./security', async original => ({ ...await original<typeof import('./security')>(), config: () => ({ tenantId: 'tenant' }) }));
vi.mock('../invoices/invoiceObservationRepository', () => ({ invoiceObservationTargets: mocks.targets }));
vi.mock('./refreshInvoiceObservation', () => ({ refreshInvoiceObservation: mocks.refresh }));
import { POST } from '../../app/api/payments/xero/observe/route';
import { GET } from '../../app/api/integrations/xero/observe/route';
const id = '11111111-1111-4111-8111-111111111111';
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv('XERO_ENABLED', 'true'); vi.stubEnv('XERO_INVOICE_OBSERVATION_ENABLED', 'true'); vi.stubEnv('CRON_SECRET', 'x'.repeat(32)); mocks.session.mockResolvedValue({ user: { id } }); mocks.origin.mockReturnValue(true); });
afterEach(() => vi.unstubAllEnvs());
it('keeps scheduled checks dark and denies missing scheduler authentication', async () => {
  expect((await GET(new Request('https://portal.test'))).status).toBe(401);
  vi.stubEnv('XERO_INVOICE_OBSERVATION_ENABLED', 'false');
  expect(await (await GET(new Request('https://portal.test', { headers: { authorization: `Bearer ${'x'.repeat(32)}` } }))).json()).toEqual({ enabled: false });
  expect(mocks.targets).not.toHaveBeenCalled();
});
it('reports partial scheduler failure without leaking provider details', async () => {
  mocks.targets.mockResolvedValue([id, 'second']); mocks.refresh.mockResolvedValueOnce({ state: 'posted' }).mockRejectedValueOnce(new Error('private-token'));
  const response = await GET(new Request('https://portal.test', { headers: { authorization: `Bearer ${'x'.repeat(32)}` } }));
  expect(response.status).toBe(503); expect(await response.json()).toEqual({ checked: 1, unavailable: 1 });
});
it('denies missing finance permission and forged observation fields before reads', async () => {
  const request = (body: unknown) => new Request('https://portal.test', { method: 'POST', body: JSON.stringify(body) });
  mocks.session.mockResolvedValueOnce(null);
  expect((await POST(request({ invoiceId: id }))).status).toBe(403);
  expect((await POST(request({ invoiceId: id, state: 'posted' }))).status).toBe(400);
  expect(mocks.refresh).not.toHaveBeenCalled();
});
