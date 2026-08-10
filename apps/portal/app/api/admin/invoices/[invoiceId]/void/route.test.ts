import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ requireAdminSession: vi.fn(), voidInvoice: vi.fn() }));
vi.mock('@/lib/api/adminApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/adminApi')>('@/lib/api/adminApi');
  return { ...actual, requireAdminSession: mocks.requireAdminSession };
});
vi.mock('@/lib/invoices/adminPayments', () => ({ voidInvoice: mocks.voidInvoice }));

import { POST } from './route';

describe('admin void invoice route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminSession.mockResolvedValue({ ok: true, session: { user: { id: 'admin-1' } } });
    mocks.voidInvoice.mockResolvedValue({ id: 'inv_1', status: 'VOID' });
  });

  it('voids a whole open invoice with an audit reason', async () => {
    const response = await POST(new Request('http://localhost', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reason: 'Created in error' }),
    }), { params: Promise.resolve({ invoiceId: 'inv_1' }) });
    expect(response.status).toBe(200);
    expect(mocks.voidInvoice).toHaveBeenCalledWith({ invoiceId: 'inv_1', actor: 'admin-1', reason: 'Created in error' });
  });

  it('rejects a missing reason before calling the domain owner', async () => {
    const response = await POST(new Request('http://localhost', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reason: ' ' }),
    }), { params: Promise.resolve({ invoiceId: 'inv_1' }) });
    expect(response.status).toBe(400);
    expect(mocks.voidInvoice).not.toHaveBeenCalled();
  });
});
