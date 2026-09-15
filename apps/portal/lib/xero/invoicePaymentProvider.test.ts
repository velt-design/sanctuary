import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ access: vi.fn(), config: vi.fn() }));
vi.mock('./store', () => ({ access: mocks.access }));
vi.mock('./security', async original => ({ ...await original<typeof import('./security')>(), config: mocks.config }));
import { invoicePaymentProvider } from './invoicePaymentProvider';
const id = '11111111-1111-4111-8111-111111111111';
const row = { PaymentID: id, Invoice: { InvoiceID: id, Type: 'ACCREC', CurrencyCode: 'NZD', Contact: { ContactID: id, Name: 'Example' } },
  PaymentType: 'ACCRECPAYMENT', Status: 'AUTHORISED', Amount: 40, IsReconciled: true, CurrencyRate: 1,
  Date: '/Date(1789344000000+0000)/', UpdatedDateUTC: '/Date(1789344000000+0000)/', Account: { BankAccountNumber: 'private' } };
beforeEach(() => { vi.resetAllMocks(); mocks.config.mockReturnValue({ tenantId: id }); mocks.access.mockResolvedValue({ accessToken: 'test', scopes: ['accounting.payments.read'] }); });
afterEach(() => vi.unstubAllGlobals());
it('reads payments for only the bound receivable invoice and excludes bank details', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ Payments: [row] })); vi.stubGlobal('fetch', fetcher);
  const result = await invoicePaymentProvider.list(id, id);
  expect(result.payments[0]).toMatchObject({ id, sourceKind: 'INVOICE_PAYMENT', providerInvoiceId: id, total: 40, date: '2026-09-14', reconciled: true });
  expect(JSON.stringify(result)).not.toContain('private');
  expect(fetcher.mock.calls[0][0].searchParams.get('where')).toContain(`Invoice.InvoiceID==guid("${id}")`);
  expect(fetcher.mock.calls[0][1].method).toBeUndefined();
});
it('rechecks exact payment identity and invoice ownership', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ Payments: [{ ...row, Invoice: { ...row.Invoice, InvoiceID: 'other' } }] })); vi.stubGlobal('fetch', fetcher);
  await expect(invoicePaymentProvider.payment(id, id, id)).rejects.toThrow('XERO_PAYMENT_BINDING_INVALID');
  expect(String(fetcher.mock.calls[0][0])).toContain(`/Payments/${id}`);
});
it('refuses wrong tenants before network access and rejects unbounded results', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ Payments: Array(22).fill(row) })); vi.stubGlobal('fetch', fetcher);
  await expect(invoicePaymentProvider.list('other', id)).rejects.toThrow('XERO_TENANT_MISMATCH');
  expect(fetcher).not.toHaveBeenCalled();
  await expect(invoicePaymentProvider.list(id, id)).rejects.toThrow('INVALID_PROVIDER_RESPONSE');
});
it('requires the recorded payment read consent before fetching', async () => {
  mocks.access.mockResolvedValue({ accessToken: 'test', scopes: ['accounting.invoices'] });
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  await expect(invoicePaymentProvider.list(id, id)).rejects.toThrow('INSUFFICIENT_SCOPE');
  expect(fetcher).not.toHaveBeenCalled();
});
it('shows a bounded partial result without implying all payments were retrieved', async () => {
  const rows = Array.from({ length: 21 }, (_, index) => ({ ...row, PaymentID: `11111111-1111-4111-8111-${String(index).padStart(12, '0')}` }));
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ Payments: rows })));
  const result = await invoicePaymentProvider.list(id, id);
  expect(result.limited).toBe(true);
  expect(result.payments).toHaveLength(20);
});
it.each(['2026-13-01', '2026-02-30', '2026-09-14T12:00:00Z'])('does not turn invalid or non-date-only evidence %s into a payment date', async date => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ Payments: [{ ...row, DateString: date }] })));
  expect((await invoicePaymentProvider.payment(id, id, id)).date).toBe('');
});
it('rejects repeated provider identities rather than counting the same payment twice', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ Payments: [row, row] })));
  await expect(invoicePaymentProvider.list(id, id)).rejects.toThrow('INVALID_PROVIDER_RESPONSE');
});
it.each([{ HasValidationErrors: true }, { ValidationErrors: [{ Message: 'invalid' }] }])('rejects provider validation failures', async failure => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ Payments: [{ ...row, ...failure }] })));
  await expect(invoicePaymentProvider.payment(id, id, id)).rejects.toThrow('INVALID_PROVIDER_RESPONSE');
});
it('does not substitute bank-currency amounts for invoice-currency amounts', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ Payments: [{ ...row, Amount: null, BankAmount: 40, CurrencyRate: null }] })));
  expect(await invoicePaymentProvider.payment(id, id, id)).toMatchObject({ total: null, currencyRate: null });
});
it('retains deleted and unreconciled states so they cannot look like confirmed receipts', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ Payments: [{ ...row, Status: 'DELETED', IsReconciled: false }] })));
  expect(await invoicePaymentProvider.payment(id, id, id)).toMatchObject({ status: 'DELETED', reconciled: false });
});
