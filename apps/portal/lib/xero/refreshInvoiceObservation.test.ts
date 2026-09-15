import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ context: vi.fn(), save: vi.fn(), read: vi.fn(), observe: vi.fn() }));
vi.mock('../invoices/invoiceObservationRepository', () => ({ invoiceObservationContext: mocks.context, recordInvoiceObservation: mocks.save }));
vi.mock('./invoiceTransferProvider', () => ({ invoiceTransferProvider: { readInvoice: mocks.read } }));
vi.mock('./invoiceObservation', () => ({ observeXeroInvoice: mocks.observe }));
import { refreshInvoiceObservation } from './refreshInvoiceObservation';
beforeEach(() => { vi.resetAllMocks(); mocks.context.mockResolvedValue({ invoiceId: 'invoice', tenantId: 'tenant', providerInvoiceId: 'bound', generation: 2, portalStatus: 'VOID', body: '{"Invoices":[{"Status":"DRAFT"}]}' }); });
it('checks only the persisted invoice identity and records the exact context generation', async () => {
  const evidence = { InvoiceID: 'bound' }; mocks.read.mockResolvedValue(evidence);
  mocks.observe.mockReturnValue({ state: 'correction_pending', reason: 'PORTAL_VOID_REQUIRES_XERO_REVIEW', amountPaidCents: 0 });
  await refreshInvoiceObservation('invoice', 'tenant');
  expect(mocks.read).toHaveBeenCalledWith('tenant', 'bound');
  expect(mocks.observe).toHaveBeenCalledWith({ Status: 'DRAFT' }, 'bound', true, evidence);
  expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ generation: 2 }), expect.objectContaining({ state: 'correction_pending' }));
});
it('records provider failure as unavailable, never a fresh successful check', async () => {
  mocks.read.mockRejectedValue(new Error('private diagnostic'));
  expect(await refreshInvoiceObservation('invoice', 'tenant')).toEqual({ state: 'unavailable', reason: 'XERO_READ_FAILED', amountPaidCents: null });
  expect(JSON.stringify(mocks.save.mock.calls)).not.toContain('private diagnostic');
});
