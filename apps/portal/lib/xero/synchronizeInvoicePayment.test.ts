import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ next: vi.fn(), status: vi.fn(), confirmation: vi.fn() }));
vi.mock('./automaticInvoicePayment', () => ({ recordNextInvoicePayment: mocks.next }));
vi.mock('../invoices/automaticInvoicePaymentRepository', () => ({ recordPaymentSyncStatus: mocks.status }));
vi.mock('./refreshInvoiceObservation', () => ({ refreshInvoiceObservation: mocks.confirmation }));
import { synchronizeInvoicePayment } from './synchronizeInvoicePayment';
beforeEach(() => { vi.resetAllMocks(); mocks.status.mockResolvedValue(undefined); mocks.confirmation.mockResolvedValue({ state: 'payment_recorded' }); });
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
it('refreshes the new portal-status binding after recording a payment', async () => {
  mocks.next.mockResolvedValue({ state: 'recorded' });
  await synchronizeInvoicePayment('invoice', 'tenant');
  expect(mocks.confirmation).toHaveBeenCalledWith('invoice', 'tenant');
  expect(mocks.confirmation.mock.invocationCallOrder[0]).toBeLessThan(mocks.status.mock.invocationCallOrder[0]);
});
it('leaves confirmation failure visible after a committed payment so retry can recover', async () => {
  mocks.next.mockResolvedValue({ state: 'recorded' }); mocks.confirmation.mockResolvedValue({ state: 'unavailable' });
  await expect(synchronizeInvoicePayment('invoice', 'tenant')).rejects.toThrow('PAYMENT_CHECK_FAILED');
  expect(mocks.status).toHaveBeenCalledWith('invoice', 'tenant', 'unavailable', 'PAYMENT_CHECK_FAILED');
});
