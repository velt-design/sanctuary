import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ session: vi.fn(), origin: vi.fn(), context: vi.fn(), repository: vi.fn(), execute: vi.fn(), access: vi.fn() }));
vi.mock('./pilotAccess', () => ({ getPaymentPilotSession: mocks.session }));
vi.mock('./http', () => ({ sameOrigin: mocks.origin, json: (body: unknown, status = 200) => Response.json(body, { status }) }));
vi.mock('./security', () => ({ config: () => ({ tenantId: '11111111-1111-4111-8111-111111111111' }) }));
vi.mock('../invoices/financeMappingRepository', () => ({ financeMappingContext: mocks.context, customerCreationRepository: mocks.repository }));
vi.mock('./customerCreation', () => ({ executeCustomerCreation: mocks.execute }));
vi.mock('./customerCreationProvider', () => ({ customerCreationProvider: {}, requireCustomerCreationAccess: mocks.access }));
import { POST } from '../../app/api/payments/xero/customers/route';
const id = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const body = { invoiceId: id, sourceContactId: id, name: 'Example', confirmed: true };
const request = (data = body) => new Request('https://portal.example.test/api/payments/xero/customers', { method: 'POST', body: JSON.stringify(data) });
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv('XERO_CUSTOMER_CREATION_ENABLED', 'true');
  mocks.session.mockResolvedValue({ user: { id } }); mocks.origin.mockReturnValue(true);
  mocks.context.mockResolvedValue({ sourceContactId: id }); mocks.repository.mockReturnValue({ marker: 'server-bound' });
  mocks.execute.mockResolvedValue({ contactId: other });
});
afterEach(() => vi.unstubAllEnvs());
it('denies unauthorised, cross-origin, unconfirmed and forged commands before preparing a request', async () => {
  mocks.session.mockResolvedValueOnce(null); expect((await POST(request())).status).toBe(403);
  mocks.origin.mockReturnValueOnce(false); expect((await POST(request())).status).toBe(403);
  expect((await POST(request({ ...body, confirmed: false }))).status).toBe(400);
  expect((await POST(request({ ...body, ...{ actor: other } }))).status).toBe(400);
  expect(mocks.execute).not.toHaveBeenCalled(); expect(mocks.repository).not.toHaveBeenCalled();
});
it('keeps creation dark and rejects a changed portal identity', async () => {
  vi.stubEnv('XERO_CUSTOMER_CREATION_ENABLED', 'false'); expect((await POST(request())).status).toBe(409);
  vi.stubEnv('XERO_CUSTOMER_CREATION_ENABLED', 'true'); mocks.context.mockResolvedValue({ sourceContactId: other });
  expect((await POST(request())).status).toBe(409); expect(mocks.execute).not.toHaveBeenCalled();
});
it('requires expanded consent before preparing the timed creation request', async () => {
  mocks.access.mockRejectedValue(new Error('INSUFFICIENT_SCOPE'));
  expect((await POST(request())).status).toBe(409);
  expect(mocks.repository).not.toHaveBeenCalled(); expect(mocks.execute).not.toHaveBeenCalled();
});
it('binds the actor, invoice and tenant on the server and returns only the verified customer', async () => {
  const response = await POST(request()); expect(response.status).toBe(200);
  expect(mocks.repository).toHaveBeenCalledExactlyOnceWith(id, id);
  expect(mocks.execute).toHaveBeenCalledExactlyOnceWith({ tenantId: id, sourceContactId: id, name: 'Example' }, { marker: 'server-bound' }, {});
  expect(await response.json()).toEqual({ contact: { id: other, name: 'Example', email: '' } });
});
it('keeps uncertain outcomes retryable without exposing provider messages', async () => {
  mocks.execute.mockRejectedValue(new Error('private provider payload'));
  const response = await POST(request()); expect(response.status).toBe(503);
  expect(await response.text()).not.toContain('private provider payload');
  mocks.execute.mockRejectedValue(new Error('XERO_CUSTOMER_INTENT_CONFLICT'));
  expect((await POST(request())).status).toBe(409);
});
