import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ requireStaffSession: vi.fn(), getProjectInvoiceSchedule: vi.fn() }));
vi.mock('@/lib/api/staffApi', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/staffApi')>('@/lib/api/staffApi');
  return { ...actual, requireStaffSession: mocks.requireStaffSession };
});
vi.mock('@/lib/invoices/adminPayments', () => ({ getProjectInvoiceSchedule: mocks.getProjectInvoiceSchedule }));

import { GET } from './route';

const context = { params: Promise.resolve({ projectId: 'proj_11111111-1111-4111-8111-111111111111' }) };

describe('staff project invoice schedule route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getProjectInvoiceSchedule.mockResolvedValue({ paidIncGstCents: 100 });
  });

  it('shows totals to staff without exposing ledger entries', async () => {
    mocks.requireStaffSession.mockResolvedValue({ user: { id: 'staff-1' }, role: 'staff' });
    expect((await GET(new Request('http://localhost'), context)).status).toBe(200);
    expect(mocks.getProjectInvoiceSchedule).toHaveBeenCalledWith(expect.any(String), { includePaymentEntries: false });
  });

  it('includes reconciliation entries only for admins', async () => {
    mocks.requireStaffSession.mockResolvedValue({ user: { id: 'admin-1' }, role: 'admin' });
    await GET(new Request('http://localhost'), context);
    expect(mocks.getProjectInvoiceSchedule).toHaveBeenCalledWith(expect.any(String), { includePaymentEntries: true });
  });
});
