import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ requireAdminSession: vi.fn(), markInvoicePaid: vi.fn() }));
vi.mock('@/lib/api/adminApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/adminApi')>('@/lib/api/adminApi');
  return { ...actual, requireAdminSession: mocks.requireAdminSession };
});
vi.mock('@/lib/invoices/adminPayments', () => ({ markInvoicePaid: mocks.markInvoicePaid }));

import { POST } from './route';

describe('admin mark invoice paid route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminSession.mockResolvedValue({ ok: true, session: { user: { id: 'admin-1' } } });
    mocks.markInvoicePaid.mockResolvedValue({ id: 'inv_1', status: 'PAID' });
  });

  it('records a whole-invoice payment with optional evidence', async () => {
    const response = await POST(new Request('http://localhost', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ paidAt: '2026-08-10T00:00:00.000Z', reference: 'BANK-1', method: 'bank transfer' }),
    }), { params: Promise.resolve({ invoiceId: 'inv_1' }) });
    expect(response.status).toBe(200);
    expect(mocks.markInvoicePaid).toHaveBeenCalledWith({
      invoiceId: 'inv_1', actor: 'admin-1', paidAt: '2026-08-10T00:00:00.000Z',
      reference: 'BANK-1', method: 'bank transfer', note: null,
    });
  });
});
