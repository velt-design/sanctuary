import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../supabaseClient', () => ({ supabaseServiceRole: { from: mocks.from } }));
import { loadInvoiceForPaymentReview } from './paymentMatchReview';
const id = '11111111-1111-4111-8111-111111111111';
const row = { id, project_id: id, invoice_ref: 'INV-0001', status: 'OPEN', invoice_kind: 'QUOTE_LINKED', payment_term_position: 1, customer_name: 'Example Customer', project_name: 'Example project', total_inc_gst_cents: 10000, reference: null };
function query(data: unknown, error: unknown = null) {
  const builder = { select: vi.fn(), eq: vi.fn(), limit: vi.fn().mockResolvedValue({ data, error }) };
  builder.select.mockReturnValue(builder); builder.eq.mockReturnValue(builder); return builder;
}
beforeEach(() => vi.resetAllMocks());
describe('invoice payment review read owner', () => {
  it('uses a bounded exact invoice lookup and checks its project payment history', async () => {
    const invoices = query([row]), payments = query([{ id: 'payment' }]);
    mocks.from.mockReturnValueOnce(invoices).mockReturnValueOnce(payments);
    const result = await loadInvoiceForPaymentReview('INV-0001');
    expect(invoices.eq).toHaveBeenCalledWith('invoice_ref', 'INV-0001');
    expect(invoices.limit).toHaveBeenCalledWith(2);
    expect(payments.eq).toHaveBeenCalledWith('project_id', id);
    expect(payments.limit).toHaveBeenCalledWith(1);
    expect(result.invoice.projectId).toBe(`proj_${id}`);
    expect(result.entries).toHaveLength(1);
  });
  it.each([[[], null, 'INVOICE_NOT_FOUND'], [[row, row], null, 'AMBIGUOUS_INVOICE'], [null, { message: 'private' }, 'REVIEW_UNAVAILABLE']])('fails closed for missing, duplicate or failed lookup', async (data, error, code) => {
    mocks.from.mockReturnValue(query(data, error));
    await expect(loadInvoiceForPaymentReview('INV-0001')).rejects.toThrow(String(code));
    expect(mocks.from).toHaveBeenCalledTimes(1);
  });
  it('does not treat failed ledger reads as zero payments', async () => {
    mocks.from.mockReturnValueOnce(query([row])).mockReturnValueOnce(query(null, { message: 'private' }));
    await expect(loadInvoiceForPaymentReview('INV-0001')).rejects.toThrow('REVIEW_UNAVAILABLE');
  });
});
