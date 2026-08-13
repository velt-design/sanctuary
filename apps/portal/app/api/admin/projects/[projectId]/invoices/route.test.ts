import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  getProjectInvoiceSchedule: vi.fn(),
  createAdminInvoice: vi.fn(),
}));

vi.mock('@/lib/api/adminApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/adminApi')>('@/lib/api/adminApi');
  return { ...actual, requireAdminSession: mocks.requireAdminSession };
});
vi.mock('@/lib/invoices/adminPayments', () => ({
  getProjectInvoiceSchedule: mocks.getProjectInvoiceSchedule,
  createAdminInvoice: mocks.createAdminInvoice,
}));

import { GET, POST } from './route';

const context = { params: Promise.resolve({ projectId: 'proj_11111111-1111-4111-8111-111111111111' }) };

describe('admin project invoices route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdminSession.mockResolvedValue({ ok: true, session: { user: { id: 'admin-1' } } });
  });

  it('fails closed when admin authentication is rejected', async () => {
    mocks.requireAdminSession.mockResolvedValue({ ok: false, response: new Response(null, { status: 403 }) });
    expect((await GET(new Request('http://localhost'), context)).status).toBe(403);
    expect(mocks.getProjectInvoiceSchedule).not.toHaveBeenCalled();
  });

  it('creates the selected whole scheduled invoice as the admin actor', async () => {
    mocks.createAdminInvoice.mockResolvedValue({ created: true, invoice: { invoiceRef: 'INV-1' } });
    const response = await POST(new Request('http://localhost', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ quoteVersionId: 'qv_1', mode: 'next_stage', paymentTermId: 'payment-2', label: 'Final payment', clientIntentId: 'admin-invoice:test-1' }),
    }), context);
    expect(response.status).toBe(201);
    expect(mocks.createAdminInvoice).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'proj_11111111-1111-4111-8111-111111111111',
      quoteVersionId: 'qv_1', mode: 'next_stage', paymentTermId: 'payment-2', label: 'Final payment', clientIntentId: 'admin-invoice:test-1', actor: 'admin-1',
    }));
  });
});
