import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ requireAdminSession: vi.fn(), recordProjectPaymentEntry: vi.fn() }));

vi.mock('@/lib/api/adminApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/adminApi')>('@/lib/api/adminApi');
  return { ...actual, requireAdminSession: mocks.requireAdminSession };
});
vi.mock('@/lib/invoices/paymentLedger', () => ({ recordProjectPaymentEntry: mocks.recordProjectPaymentEntry }));

import { POST } from './route';

const context = { params: Promise.resolve({ projectId: 'proj_11111111-1111-4111-8111-111111111111' }) };

describe('admin project payments route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminSession.mockResolvedValue({ ok: true, session: { user: { id: 'admin-1' } } });
    mocks.recordProjectPaymentEntry.mockResolvedValue('pmt-1');
  });

  it('fails closed for non-admin users', async () => {
    mocks.requireAdminSession.mockResolvedValue({ ok: false, response: new Response(null, { status: 403 }) });
    const response = await POST(new Request('http://localhost', { method: 'POST' }), context);
    expect(response.status).toBe(403);
    expect(mocks.recordProjectPaymentEntry).not.toHaveBeenCalled();
  });

  it('records an actual payment as the admin actor', async () => {
    const response = await POST(new Request('http://localhost', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ entryType: 'PAYMENT', amountIncGstCents: 50000, reference: 'BANK-123' }),
    }), context);
    expect(response.status).toBe(201);
    expect(mocks.recordProjectPaymentEntry).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'proj_11111111-1111-4111-8111-111111111111',
      entryType: 'PAYMENT', amountIncGstCents: 50000, reference: 'BANK-123', actor: 'admin-1',
    }));
  });
});
