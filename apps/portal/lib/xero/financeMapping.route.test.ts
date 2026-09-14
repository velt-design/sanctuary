import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ session: vi.fn(), origin: vi.fn(), context: vi.fn(), save: vi.fn(), accounting: vi.fn(), contact: vi.fn(), contacts: vi.fn() }));
vi.mock('./pilotAccess', () => ({ getPaymentPilotSession: mocks.session }));
vi.mock('./http', () => ({ sameOrigin: mocks.origin, json: (body: unknown, status = 200) => Response.json(body, { status }) }));
vi.mock('./security', () => ({ config: () => ({ tenantId: '11111111-1111-4111-8111-111111111111' }) }));
vi.mock('../invoices/financeMappingRepository', () => ({ financeMappingContext: mocks.context, saveFinanceMapping: mocks.save }));
vi.mock('./financeMappingProvider', () => ({ financeMappingProvider: { accounting: mocks.accounting, contact: mocks.contact, contacts: mocks.contacts } }));
import { POST } from '../../app/api/payments/xero/mapping/route';
const id = '11111111-1111-4111-8111-111111111111';
const confirmation = { action: 'confirm', commandId: id, invoiceId: id, sourceContactId: id, contactId: id, accountCode: '475', taxType: 'TAX001', confirmed: true };
const request = (body: unknown) => new Request('https://portal.example.test/api/payments/xero/mapping', { method: 'POST', body: JSON.stringify(body) });
beforeEach(() => {
  vi.resetAllMocks(); mocks.session.mockResolvedValue({ user: { id } }); mocks.origin.mockReturnValue(true);
  mocks.context.mockResolvedValue({ invoiceId: id, invoiceRef: 'INV-TEST', customerName: 'Synthetic', sourceContactId: id, subtotalCents: 100, taxCents: 15 });
  mocks.accounting.mockResolvedValue({ accounts: [{ id, code: '475', name: 'Sales' }], taxes: [{ type: 'TAX001', name: 'GST', effectiveRate: 15 }] });
  mocks.contact.mockResolvedValue({ id, name: 'Synthetic', email: '' });
});
it('denies missing finance permission or foreign origin before provider reads', async () => {
  mocks.session.mockResolvedValueOnce(null);
  expect((await POST(request(confirmation))).status).toBe(403);
  mocks.origin.mockReturnValue(false);
  expect((await POST(request(confirmation))).status).toBe(403);
  expect(mocks.accounting).not.toHaveBeenCalled(); expect(mocks.save).not.toHaveBeenCalled();
});
it('rejects forged actor fields and missing explicit confirmation', async () => {
  expect((await POST(request({ ...confirmation, actor: 'other' }))).status).toBe(400);
  expect((await POST(request({ ...confirmation, confirmed: false }))).status).toBe(400);
  expect(mocks.context).not.toHaveBeenCalled();
});
it('verifies fresh account, tax and exact contact before saving server-owned evidence', async () => {
  expect((await POST(request(confirmation))).status).toBe(200);
  expect(mocks.contact).toHaveBeenCalledWith(id, id);
  expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ actor: id, tenantId: id, proof: { contact: { id, name: 'Synthetic', email: '' },
    account: { id, code: '475', name: 'Sales' }, tax: { type: 'TAX001', name: 'GST', effectiveRate: 15 } } }));
});
it('refuses tax mismatch and changed portal identity without saving', async () => {
  mocks.accounting.mockResolvedValue({ accounts: [{ code: '475' }], taxes: [{ type: 'TAX001', effectiveRate: 10 }] });
  expect((await POST(request(confirmation))).status).toBe(409);
  mocks.context.mockResolvedValue({ sourceContactId: 'different' });
  expect((await POST(request(confirmation))).status).toBe(409);
  expect(mocks.save).not.toHaveBeenCalled(); expect(mocks.contact).not.toHaveBeenCalled();
});
