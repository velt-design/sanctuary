import { describe, expect, it, vi } from 'vitest';
import { readCustomerHistory, type HistoryDependencies } from './customerHistory';
import { historyReadUrl, type HistoryRead } from './customerHistoryProvider';

const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const query = { projectId: id(1), from: '2026-09-01', to: '2026-09-22' };
const mapping = { projectId: id(1), portalContactId: id(2), tenantId: id(3), xeroContactId: id(4), mappingVerifiedAt: '2026-09-01T00:00:00.000Z' };
const contact = { ContactID: id(4), Name: 'Synthetic Contact', ContactStatus: 'ACTIVE' };
const dated = { DateString: '2026-09-10T00:00:00', UpdatedDateUTC: '/Date(1788998400000+0000)/' };
const inv = { ...dated, InvoiceID: id(5), InvoiceNumber: 'SYN-001', Contact: contact, Type: 'ACCREC', Status: 'PAID',
  DateString: '2020-01-01', CurrencyCode: 'NZD', CurrencyRate: 1, SubTotal: 100, TotalTax: 15, Total: 115, AmountPaid: 100, AmountDue: 0, AmountCredited: 15 };
const pay = { ...dated, PaymentID: id(6), Invoice: { InvoiceID: id(5), Type: 'ACCREC', CurrencyCode: 'NZD' },
  PaymentType: 'ACCRECPAYMENT', Status: 'AUTHORISED', Amount: 100, CurrencyRate: 1, IsReconciled: true };
const direct = { ...dated, BankTransactionID: id(7), Contact: contact, Type: 'RECEIVE', Status: 'AUTHORISED', CurrencyCode: 'NZD', Total: 50, IsReconciled: true };
function fixture(overrides: Partial<Record<HistoryRead['resource'], readonly unknown[]>> = {}) {
  const rows = { Contacts: [contact], Invoices: [inv], Payments: [pay], BankTransactions: [direct], ...overrides };
  const read = vi.fn(async (input: HistoryRead) => [...rows[input.resource]]);
  return { read, binding: vi.fn(async () => ({ ...mapping })), now: () => new Date('2026-09-22T08:00:00Z') } satisfies HistoryDependencies;
}
describe('bounded customer accounting history', () => {
  it('keeps old invoice population, period payments, credits and direct receipts distinct without cash totals', async () => {
    const deps = fixture(), result = await readCustomerHistory(query, deps);
    expect(result.invoices.items[0]).toMatchObject({ date: '2020-01-01', creditedCents: 1500, paidCents: 10000 });
    expect(result.payments.items[0]).toMatchObject({ amountInvoiceCurrencyCents: 10000, invoiceCurrency: 'NZD' });
    expect(result.directReceipts.items[0]?.totalCents).toBe(5000);
    expect(result.identity.projectAttribution).toBe('not_established'); expect(result).not.toHaveProperty('total');
    expect(deps.binding.mock.calls.length).toBeGreaterThan(deps.read.mock.calls.length);
  });
  it('uses supported contact ID, invoice ID, date and stable page parameters, never names/numbers', () => {
    const base = { tenantId: id(3), contactId: id(4), period: query, page: 2 };
    const invoiceUrl = historyReadUrl({ ...base, resource: 'Invoices' });
    expect(invoiceUrl.searchParams.get('ContactIDs')).toBe(id(4)); expect(invoiceUrl.searchParams.get('where')).toBe('Type=="ACCREC"');
    expect(invoiceUrl.searchParams.get('pageSize')).toBe('100');
    expect(historyReadUrl({ ...base, resource: 'Payments', invoiceId: id(5) }).searchParams.get('where')).toContain(`Invoice.InvoiceID==guid("${id(5)}")`);
    expect(historyReadUrl({ ...base, resource: 'BankTransactions' }).searchParams.get('where')).toContain('Date<DateTime(2026,9,23)');
  });
  it('retrieves more than 250 direct receipts and checks an exact-full last page', async () => {
    const deps = fixture({ Payments: [] });
    deps.read.mockImplementation(async input => input.resource === 'Contacts' ? [contact] : input.resource === 'Invoices' ? [inv] : input.resource === 'Payments' ? []
      : input.page <= 3 ? Array.from({ length: 100 }, (_, n) => ({ ...direct, BankTransactionID: id(100 + (input.page - 1) * 100 + n) })) : []);
    const result = await readCustomerHistory(query, deps); expect(result.directReceipts.items).toHaveLength(300);
    expect(deps.read.mock.calls.some(([q]) => q.resource === 'BankTransactions' && q.page === 4)).toBe(true);
  });
  it('denies first-page truncation and duplicate IDs across pages', async () => {
    const deps = fixture({ BankTransactions: Array.from({ length: 100 }, (_, n) => ({ ...direct, BankTransactionID: id(100 + n) })) });
    await expect(readCustomerHistory(query, deps)).rejects.toThrow('HISTORY_CHANGED_DURING_READ');
  });
  it('fails complete coverage at ten full pages', async () => {
    const deps = fixture(); deps.read.mockImplementation(async q => q.resource === 'Contacts' ? [contact] : q.resource === 'Invoices' ? [] :
      Array.from({ length: 100 }, (_, n) => ({ ...direct, BankTransactionID: id(q.page * 100 + n) })));
    await expect(readCustomerHistory(query, deps)).rejects.toThrow('HISTORY_LIMIT');
  });
  it('reads all partial payments beyond20 and preserves each provider ID only once', async () => {
    const deps = fixture({ Payments: Array.from({ length: 30 }, (_, n) => ({ ...pay, PaymentID: id(200 + n), Amount: 1 })) });
    expect((await readCustomerHistory(query, deps)).payments.items).toHaveLength(30);
  });
  it('stops a large contact at the whole-read request cap without returning partial families', async () => {
    const deps = fixture({ Invoices: Array.from({ length: 59 }, (_, n) => ({ ...inv, InvoiceID: id(200 + n) })), Payments: [] });
    await expect(readCustomerHistory(query, deps)).rejects.toThrow('HISTORY_LIMIT'); expect(deps.read).toHaveBeenCalledTimes(60);
  });
  it('withholds publication on the final authority check after all provider responses', async () => {
    const deps = fixture(); let reads = 0; const original = deps.read.getMockImplementation()!;
    deps.read.mockImplementation(async q => { reads++; return original(q); });
    deps.binding.mockImplementation(async () => { if (reads >= 5) throw new Error('revoked'); return mapping; });
    await expect(readCustomerHistory(query, deps)).rejects.toThrow('revoked');
  });
  it.each([
    ['contact mismatch', { Contacts: [{ ...contact, ContactID: id(99) }] }],
    ['archived contact', { Contacts: [{ ...contact, ContactStatus: 'ARCHIVED' }] }],
    ['merged contact', { Contacts: [{ ...contact, MergedToContactID: id(99) }] }],
    ['same invoice number on another contact', { Invoices: [{ ...inv, Contact: { ...contact, ContactID: id(99) } }] }],
    ['wrong linked payment', { Payments: [{ ...pay, Invoice: { ...pay.Invoice, InvoiceID: id(99) } }] }],
    ['wrong payment currency', { Payments: [{ ...pay, Invoice: { ...pay.Invoice, CurrencyCode: 'AUD' } }] }],
    ['fractional money', { Payments: [{ ...pay, Amount: 1.001 }] }],
    ['nonperiod payment', { Payments: [{ ...pay, DateString: '2020-01-01' }] }],
    ['wrong direct receipt contact', { BankTransactions: [{ ...direct, Contact: { ...contact, ContactID: id(99) } }] }],
    ['prepayment disguised as direct receipt', { BankTransactions: [{ ...direct, PrepaymentID: id(99) }] }],
    ['unsupported currency', { Invoices: [{ ...inv, CurrencyCode: 'JPY' }] }],
  ] as const)('withholds complete output for %s', async (_name, changes) => {
    await expect(readCustomerHistory(query, fixture(changes))).rejects.toThrow();
  });
  it('keeps deleted payment evidence and currency rate without converting invoice amount into bank cash', async () => {
    const result = await readCustomerHistory(query, fixture({ Payments: [{ ...pay, Status: 'DELETED', CurrencyRate: 0.61, BankAmount: 61 }] }));
    expect(result.payments.items[0]).toMatchObject({ status: 'DELETED', currencyRate: 0.61, amountInvoiceCurrencyCents: 10000 });
    expect(result.payments.items[0]).not.toHaveProperty('BankAmount');
  });
  it('stops on revoked authority before any broker read', async () => {
    const deps = fixture(); deps.binding.mockRejectedValue(new Error('revoked'));
    await expect(readCustomerHistory(query, deps)).rejects.toThrow(); expect(deps.read).not.toHaveBeenCalled();
  });
  it('withholds result when mapping changes during reads', async () => {
    const deps = fixture(); let call = 0;
    deps.binding.mockImplementation(async () => ({ ...mapping, xeroContactId: ++call > 3 ? id(99) : id(4) }));
    await expect(readCustomerHistory(query, deps)).rejects.toThrow('HISTORY_IDENTITY_CHANGED');
  });
  it('withholds a result when provider identity changes during the read', async () => {
    const deps = fixture(); let contacts = 0; const original = deps.read.getMockImplementation()!;
    deps.read.mockImplementation(async q => q.resource === 'Contacts' && ++contacts > 1 ? [{ ...contact, Name: 'Changed' }] : original(q));
    await expect(readCustomerHistory(query, deps)).rejects.toThrow('HISTORY_IDENTITY_CHANGED');
  });
  it('fails future/overlong periods and cancellation without provider reads', async () => {
    const deps = fixture(); await expect(readCustomerHistory({ ...query, to: '2027-01-01' }, deps)).rejects.toThrow();
    const abort = new AbortController(); abort.abort(); await expect(readCustomerHistory(query, deps, abort.signal)).rejects.toThrow();
    expect(deps.read).not.toHaveBeenCalled();
  });
  it('passes cancellation to an in-flight authority lookup before any provider dispatch', async () => {
    const abort = new AbortController(), deps = fixture();
    const pending = readCustomerHistory(query, { ...deps, binding: async signal => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true }); abort.abort();
    }) }, abort.signal);
    await expect(pending).rejects.toThrow(); expect(deps.read).not.toHaveBeenCalled();
  });
});
