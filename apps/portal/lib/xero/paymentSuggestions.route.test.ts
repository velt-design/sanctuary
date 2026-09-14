import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ developer: vi.fn(), sameOrigin: vi.fn(), read: vi.fn(), load: vi.fn() }));
vi.mock('./http', () => ({ developer: mocks.developer, sameOrigin: mocks.sameOrigin, json: (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } }) }));
vi.mock('./store', () => ({ readAccounting: mocks.read }));
vi.mock('../invoices/paymentMatchReview', () => ({ loadInvoiceForPaymentReview: mocks.load }));
import { POST } from '../../app/api/integrations/xero/payment-suggestions/route';
const request = (body: string) => new Request('https://portal.test/api/integrations/xero/payment-suggestions', { method: 'POST', body });
beforeEach(() => {
  vi.resetAllMocks(); mocks.developer.mockResolvedValue({ user: { id: 'developer' } }); mocks.sameOrigin.mockReturnValue(true);
  mocks.load.mockResolvedValue({ invoice: { status: 'OPEN', paymentTermPosition: 1, customerName: 'Example Customer', totalIncGstCents: 10000, invoiceRef: 'INV-0001' }, entries: [] });
  mocks.read.mockResolvedValue([{ id: 'r', contact: 'Example Customer', date: '2026-09-01', total: 1, currency: 'NZD', reconciled: true, status: 'AUTHORISED', reference: '' }]);
});
describe('deposit suggestion route', () => {
  it('denies non-developers before either source is read', async () => {
    mocks.developer.mockResolvedValue(null);
    expect((await POST(request('{}'))).status).toBe(403);
    expect(mocks.load).not.toHaveBeenCalled(); expect(mocks.read).not.toHaveBeenCalled();
  });
  it('denies a foreign origin before source reads', async () => {
    mocks.sameOrigin.mockReturnValue(false);
    expect((await POST(request('{}'))).status).toBe(403); expect(mocks.load).not.toHaveBeenCalled();
  });
  it.each(['{', 'null', '[]', '{}', '{"invoiceRef":"bad"}', '{"invoiceRef":"INV-1","contactName":1}'])('rejects malformed input %s', async body => {
    expect((await POST(request(body))).status).toBe(400); expect(mocks.load).not.toHaveBeenCalled();
  });
  it('joins the invoice and receipt into a conditional win, without executing any payment command', async () => {
    const result = await POST(request('{"invoiceRef":"INV-0001"}'));
    expect(result.status).toBe(200); expect(result.headers.get('cache-control')).toContain('no-store');
    expect(mocks.read).toHaveBeenCalledWith('BankTransactions', 'Type=="RECEIVE"&&Contact.Name=="Example Customer"');
    expect((await result.json()).suggestions[0]).toMatchObject({ customerWonIfApproved: true, depositRemainingIfApprovedCents: 9900 });
  });
  it('does not turn provider failure into an empty set or expose diagnostics', async () => {
    mocks.read.mockRejectedValue(new Error('private token'));
    const result = await POST(request('{"invoiceRef":"INV-0001"}'));
    expect(result.status).toBe(503); expect(await result.text()).not.toContain('private token');
  });
  it('stops ambiguous invoice identities before querying Xero', async () => {
    mocks.load.mockRejectedValue(new Error('AMBIGUOUS_INVOICE'));
    expect((await POST(request('{"invoiceRef":"INV-0001"}'))).status).toBe(409); expect(mocks.read).not.toHaveBeenCalled();
  });
});
