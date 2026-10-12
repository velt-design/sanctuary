import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), restore: vi.fn() }));
vi.mock('@/lib/api/adminApi', async () => ({
  ...(await vi.importActual<typeof import('@/lib/api/adminApi')>('@/lib/api/adminApi')),
  requireAdminSession: mocks.auth,
}));
vi.mock('@/lib/invoices/restoreInvoice', () => ({ restoreInvoice: mocks.restore }));
import { POST } from './route';
const invoiceId = 'inv_40000000-0000-4000-8000-000000000001';
const input = {
  reason: 'Voided by mistake',
  commandId: '50000000-0000-4000-8000-000000000001',
  expectedVoidedAt: '2026-10-12T00:00:00.123456+00:00',
};
const post = (body: unknown = input) =>
  POST(new Request('http://localhost', { method: 'POST', body: JSON.stringify(body) }), {
    params: Promise.resolve({ invoiceId }),
  });
describe('restore invoice admin boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ ok: true, session: { user: { id: 'admin' } } });
    mocks.restore.mockResolvedValue({ id: invoiceId, status: 'OPEN' });
  });
  it.each([401, 403])('denies caller with status %s without financial calls', async (status) => {
    mocks.auth.mockResolvedValue({ ok: false, response: new Response(null, { status }) });
    expect((await post()).status).toBe(status);
    expect(mocks.restore).not.toHaveBeenCalled();
  });
  it.each([
    { ...input, reason: '' },
    { ...input, expectedVoidedAt: null },
    { ...input, commandId: 'new' },
    { ...input, actor: 'other' },
  ])('rejects invalid or spoofed request', async (body) => {
    expect((await post(body)).status).toBe(400);
    expect(mocks.restore).not.toHaveBeenCalled();
  });
  it('preserves exact episode and command, attributing authenticated admin', async () => {
    const response = await post();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(mocks.restore).toHaveBeenCalledWith({ ...input, invoiceId, actor: 'admin' });
  });
  it('returns actionable financial conflict without success', async () => {
    mocks.restore.mockRejectedValue(new Error('Another active invoice covers this payment stage'));
    const response = await post();
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'Another active invoice covers this payment stage' });
  });
});
