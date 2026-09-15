import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ next: vi.fn(), status: vi.fn() }));
vi.mock('./automaticInvoicePayment', () => ({ recordNextInvoicePayment: mocks.next }));
vi.mock('../invoices/automaticInvoicePaymentRepository', () => ({ recordPaymentSyncStatus: mocks.status }));
import { synchronizeInvoicePayment } from './synchronizeInvoicePayment';
beforeEach(() => { vi.resetAllMocks(); mocks.status.mockResolvedValue(undefined); });
it('retains an actionable conflict without reporting a successful payment', async () => {
  mocks.next.mockResolvedValue({ state: 'review', reason: 'PAYMENT_EVIDENCE_CONFLICT' });
  expect((await synchronizeInvoicePayment('invoice', 'tenant')).state).toBe('review');
  expect(mocks.status).toHaveBeenCalledWith('invoice', 'tenant', 'review', 'PAYMENT_EVIDENCE_CONFLICT');
});
it('retains read/write failures without copying private errors into status', async () => {
  mocks.next.mockRejectedValue(new Error('private provider detail'));
  await expect(synchronizeInvoicePayment('invoice', 'tenant')).rejects.toThrow('PAYMENT_CHECK_FAILED');
  expect(mocks.status).toHaveBeenCalledWith('invoice', 'tenant', 'unavailable', 'PAYMENT_CHECK_FAILED');
});
it('does not claim success if status could not be saved', async () => {
  mocks.next.mockResolvedValue({ state: 'recorded' }); mocks.status.mockRejectedValue(new Error('status unavailable'));
  await expect(synchronizeInvoicePayment('invoice', 'tenant')).rejects.toThrow('status unavailable');
});
