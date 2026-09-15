import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ session: vi.fn(), origin: vi.fn(), repository: vi.fn(), recover: vi.fn() }));
vi.mock('./pilotAccess', () => ({ getPaymentPilotSession: mocks.session }));
vi.mock('./http', () => ({ sameOrigin: mocks.origin, json: (body: unknown, status = 200) => Response.json(body, { status }) }));
vi.mock('./security', () => ({ config: () => ({ tenantId: '11111111-1111-4111-8111-111111111111' }) }));
vi.mock('../invoices/xeroInvoiceTransferRepository', () => ({ invoiceRecoveryRepository: mocks.repository }));
vi.mock('./invoiceRecovery', () => ({ recoverInvoiceTransfer: mocks.recover }));
vi.mock('./invoiceTransferProvider', () => ({ invoiceTransferProvider: {} }));
import { POST } from '../../app/api/payments/xero/recover/route';
const id = '11111111-1111-4111-8111-111111111111';
const body = { invoiceId: id, confirmed: true };
const request = (value: unknown = body) => new Request('https://portal.example.test/api/payments/xero/recover', { method: 'POST', body: JSON.stringify(value) });
beforeEach(() => {
  vi.resetAllMocks(); mocks.session.mockResolvedValue({ user: { id } }); mocks.origin.mockReturnValue(true);
  mocks.repository.mockReturnValue({ marker: 'bound' }); mocks.recover.mockResolvedValue({ state: 'recovered' });
});
it('requires finance access, same origin and explicit confirmation without accepting caller proof', async () => {
  mocks.session.mockResolvedValueOnce(null); expect((await POST(request())).status).toBe(403);
  mocks.origin.mockReturnValueOnce(false); expect((await POST(request())).status).toBe(403);
  expect((await POST(request({ ...body, confirmed: false }))).status).toBe(400);
  expect((await POST(request({ ...body, proof: {} }))).status).toBe(400);
  expect(mocks.repository).not.toHaveBeenCalled(); expect(mocks.recover).not.toHaveBeenCalled();
});
it('binds current actor and tenant before the read-only provider recovery', async () => {
  const response = await POST(request()); expect(response.status).toBe(200);
  expect(mocks.repository).toHaveBeenCalledExactlyOnceWith(id, id, id);
  expect(await response.json()).toEqual({ state: 'recovered' });
});
it('shows live ownership and absent/conflicting outcomes as investigations and hides raw failures', async () => {
  for (const message of ['XERO_TRANSFER_STILL_RUNNING', 'XERO_RECOVERY_NOT_FOUND', 'XERO_INVOICE_CONFLICT']) {
    mocks.recover.mockRejectedValue(new Error(message)); expect((await POST(request())).status).toBe(409);
  }
  mocks.recover.mockRejectedValue(new Error('private provider text'));
  const response = await POST(request()); expect(response.status).toBe(503); expect(await response.text()).not.toContain('private provider text');
});
