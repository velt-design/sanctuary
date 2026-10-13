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
    const response = await GET(new Request('http://localhost'), context);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(await response.json()).toEqual({ schedule: { paidIncGstCents: 100 } });
    expect(mocks.getProjectInvoiceSchedule).toHaveBeenCalledWith(expect.any(String), { includePaymentEntries: false });
  });

  it('includes reconciliation entries only for admins', async () => {
    mocks.requireStaffSession.mockResolvedValue({ user: { id: 'admin-1' }, role: 'admin' });
    const response = await GET(new Request('http://localhost'), context);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(await response.json()).toEqual({ schedule: { paidIncGstCents: 100 } });
    expect(mocks.getProjectInvoiceSchedule).toHaveBeenCalledWith(expect.any(String), { includePaymentEntries: true });
  });

  it('keeps unauthorized responses private without reading financial data', async () => {
    mocks.requireStaffSession.mockResolvedValue(null);
    const response = await GET(new Request('http://localhost'), context);
    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
    expect(mocks.getProjectInvoiceSchedule).not.toHaveBeenCalled();
  });

  it('keeps invalid-project responses private without reading financial data', async () => {
    mocks.requireStaffSession.mockResolvedValue({ user: { id: 'staff-1' }, role: 'staff' });
    const response = await GET(new Request('http://localhost'), { params: Promise.resolve({ projectId: '  ' }) });
    expect(response.status).toBe(400);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(await response.json()).toEqual({ error: 'Invalid projectId' });
    expect(mocks.getProjectInvoiceSchedule).not.toHaveBeenCalled();
  });

  it('preserves a failed read as a private server error', async () => {
    mocks.requireStaffSession.mockResolvedValue({ user: { id: 'admin-1' }, role: 'admin' });
    mocks.getProjectInvoiceSchedule.mockRejectedValue(new Error('Schedule unavailable'));
    const response = await GET(new Request('http://localhost'), context);
    expect(response.status).toBe(500);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(await response.json()).toEqual({ error: 'Schedule unavailable' });
    expect(mocks.getProjectInvoiceSchedule).toHaveBeenCalledTimes(1);
    expect(mocks.getProjectInvoiceSchedule).toHaveBeenCalledWith(expect.any(String), { includePaymentEntries: true });
  });
});
