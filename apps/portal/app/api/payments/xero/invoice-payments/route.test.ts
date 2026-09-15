import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ session: vi.fn(), origin: vi.fn(), review: vi.fn(), approve: vi.fn(), match: vi.fn(), history: vi.fn(), reverse: vi.fn() }));
vi.mock('@/lib/xero/pilotAccess', () => ({ getPaymentPilotSession: mocks.session }));
vi.mock('@/lib/xero/http', () => ({ sameOrigin: mocks.origin, json: (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } }) }));
vi.mock('@/lib/xero/invoicePaymentReview', () => ({ reviewInvoicePayments: mocks.review, approveInvoicePayment: mocks.approve }));
vi.mock('@/lib/invoices/xeroMatchRepository', () => ({ findPilotMatch: mocks.match, reversePilotMatch: mocks.reverse }));
vi.mock('@/lib/invoices/invoicePaymentHistory', () => ({ loadInvoicePaymentHistory: mocks.history }));
vi.mock('@/lib/xero/security', () => ({ config: () => ({ tenantId: '11111111-1111-4111-8111-111111111111' }) }));
import { POST } from './route';
const id = '11111111-1111-4111-8111-111111111111';
const request = (body: unknown) => new Request('https://portal.test/api/payments/xero/invoice-payments', { method: 'POST', body: JSON.stringify(body) });
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv('XERO_INVOICE_PAYMENTS_ENABLED', 'true'); mocks.session.mockResolvedValue({ user: { id } }); mocks.origin.mockReturnValue(true); mocks.review.mockResolvedValue({ suggestions: [] }); mocks.approve.mockResolvedValue({ matchId: id }); });
afterEach(() => vi.unstubAllEnvs());
it('stays dark before activation', async () => {
  vi.stubEnv('XERO_INVOICE_PAYMENTS_ENABLED', 'false'); expect((await POST(request({ action: 'review', invoiceId: id }))).status).toBe(404);
  expect(mocks.session).not.toHaveBeenCalled();
});
it('requires finance access and same origin before reading or writing', async () => {
  mocks.session.mockResolvedValue(null); expect((await POST(request({ action: 'review', invoiceId: id }))).status).toBe(403);
  mocks.session.mockResolvedValue({ user: { id } }); mocks.origin.mockReturnValue(false);
  expect((await POST(request({ action: 'approve', confirmed: true, approvalToken: 'token' }))).status).toBe(403);
  expect(mocks.review).not.toHaveBeenCalled(); expect(mocks.approve).not.toHaveBeenCalled();
});
it.each([{ action: 'approve', approvalToken: 'token' }, { action: 'review', invoiceId: id, actor: id }, { action: 'approve', confirmed: true, approvalToken: 'token', amountCents: 1 }])('refuses incomplete or browser-overridden commands %j', async body => {
  expect((await POST(request(body))).status).toBe(400); expect(mocks.approve).not.toHaveBeenCalled(); expect(mocks.review).not.toHaveBeenCalled();
});
it('passes only the session actor and reviewed envelope to approval', async () => {
  const response = await POST(request({ action: 'approve', confirmed: true, approvalToken: 'token' }));
  expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toContain('no-store');
  expect(mocks.approve).toHaveBeenCalledWith('token', id);
});
it('does not reveal another approver result or private failures', async () => {
  mocks.match.mockResolvedValue({ approvedBy: 'other', sourceKind: 'INVOICE_PAYMENT' });
  expect(await (await POST(request({ action: 'status', approvalId: id }))).json()).toEqual({ match: null });
  mocks.approve.mockRejectedValue(new Error('private credentials'));
  const response = await POST(request({ action: 'approve', confirmed: true, approvalToken: 'token' }));
  expect(response.status).toBe(409); expect(await response.text()).not.toContain('private credentials');
});
it('reads history without asking Xero for payment evidence', async () => {
  mocks.history.mockResolvedValue({ matches: [] });
  expect((await POST(request({ action: 'history', invoiceId: id }))).status).toBe(200);
  expect(mocks.history).toHaveBeenCalledWith(id, id, id, 0); expect(mocks.review).not.toHaveBeenCalled();
});
it('requires an explicit correction with a reason and exact invoice ownership', async () => {
  const body = { action: 'reverse', invoiceId: id, matchId: id, confirmed: true, reason: 'Wrong invoice match' };
  expect((await POST(request({ ...body, confirmed: false }))).status).toBe(400);
  mocks.match.mockResolvedValue({ invoiceId: 'other', tenantId: id });
  expect((await POST(request(body))).status).toBe(409); expect(mocks.reverse).not.toHaveBeenCalled();
  mocks.match.mockResolvedValue({ invoiceId: id, tenantId: id });
  expect((await POST(request(body))).status).toBe(200); expect(mocks.reverse).toHaveBeenCalledWith(id, 'Wrong invoice match', id);
});
