import { describe, expect, it, vi } from 'vitest';
import { readFinanceSummary } from './financeSummary';
import { completedWeek, financeSummaryPeriod } from './financeSummaryContract';
import type { SummarySource } from './financeSummaryProvider';

const period = { from: '2026-09-10', to: '2026-09-16' };
const id = (n: number) => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;
const invoice = (n: number, changes = {}) => ({ InvoiceID: id(n), Type: 'ACCREC', Status: 'AUTHORISED', DateString: '2026-09-10T00:00:00',
  CurrencyCode: 'NZD', SubTotal: 100, TotalTax: 15, Total: 115, AmountDue: 45, ...changes });
const payment = (n: number, changes = {}) => ({ PaymentID: id(n), PaymentType: 'ACCRECPAYMENT', Status: 'AUTHORISED',
  Date: '/Date(1788998400000+0000)/', DateString: '2026-09-10T00:00:00', Amount: 40, IsReconciled: true,
  Invoice: { InvoiceID: id(1), Type: 'ACCREC', CurrencyCode: 'NZD' }, ...changes });
function readData(data: Partial<Record<SummarySource, unknown[]>>) {
  return { read: vi.fn(async (source: SummarySource) => data[source] ?? []), now: () => new Date('2026-09-17T00:00:00Z') };
}
describe('Xero summary meaning', () => {
  it('separates gross invoicing, receipts and credit-aware current balances, including old invoices', async () => {
    const result = await readFinanceSummary(period, readData({ invoiced: [invoice(1)], receipts: [payment(2), payment(3, { Amount: 20, IsReconciled: false }), payment(4, { Amount: 5, IsReconciled: null })],
      outstanding: [invoice(1, { DateString: '2020-01-01', AmountPaid: 40, AmountCredited: 30 })] }));
    expect(result.currencies).toEqual([{ currency: 'NZD', invoiced: { count: 1, excludingTaxCents: 10000, taxCents: 1500, includingTaxCents: 11500 },
      receipts: { count: 3, reconciledCents: 4000, unreconciledCents: 2000, unknownReconciliationCents: 500 }, outstanding: { count: 1, amountDueCents: 4500 } }]);
  });
  it('does not combine currencies or apply a blanket GST percentage', async () => {
    const result = await readFinanceSummary(period, readData({ invoiced: [invoice(1, { CurrencyCode: 'AUD', SubTotal: 100, TotalTax: 0, Total: 100 }), invoice(2)] }));
    expect(result.currencies.map(row => [row.currency, row.invoiced.taxCents])).toEqual([['AUD', 0], ['NZD', 1500]]);
  });
  it('reads every page and requires a terminal page, including a fully filled first page', async () => {
    const read = vi.fn(async (source: SummarySource, _period: unknown, page: number) => source !== 'invoiced' ? [] : page === 1 ? Array.from({ length: 250 }, (_, i) => invoice(i)) : [invoice(251)]);
    const result = await readFinanceSummary(period, { read, now: () => new Date() });
    expect(result.currencies[0].invoiced.count).toBe(251);
    expect(read).toHaveBeenCalledTimes(4);
  });
  it('never returns a misleading partial total when the page budget is exhausted', async () => {
    const read = vi.fn(async (_source: SummarySource, _period: unknown, page: number) => Array.from({ length: 250 }, (_, i) => invoice(page * 250 + i)));
    await expect(readFinanceSummary(period, { read, now: () => new Date() })).rejects.toThrow('SUMMARY_LIMIT');
    expect(read).toHaveBeenCalledTimes(10);
  });
  it('refuses repeated IDs across pages instead of double counting or concealing page drift', async () => {
    const read = vi.fn(async (_source: SummarySource, _period: unknown, page: number) => page === 1 ? Array.from({ length: 250 }, (_, i) => invoice(i)) : [invoice(1)]);
    await expect(readFinanceSummary(period, { read, now: () => new Date() })).rejects.toThrow('SUMMARY_CHANGED_DURING_READ');
  });
  it.each(['DRAFT', 'SUBMITTED', 'VOIDED', 'DELETED'])('rejects provider records with excluded status %s', async Status => {
    await expect(readFinanceSummary(period, readData({ invoiced: [invoice(1, { Status })] }))).rejects.toThrow();
  });
  it.each(['2026-09-09', '2026-09-17', '2026-02-30', 'not a date'])('rejects invalid/out-of-period date %s', async DateString => {
    await expect(readFinanceSummary(period, readData({ invoiced: [invoice(1, { DateString })] }))).rejects.toThrow();
  });
  it('accepts both inclusive date edges and valid legacy Xero dates', async () => {
    const Date = `/Date(${globalThis.Date.parse('2026-09-16T00:00:00Z')}+0000)/`;
    const result = await readFinanceSummary(period, readData({ invoiced: [invoice(1), invoice(2, { DateString: undefined, Date })] }));
    expect(result.currencies[0].invoiced.count).toBe(2);
  });
  it.each([{ Total: 114 }, { Total: Infinity }, { SubTotal: 100.001 }, { CurrencyCode: '' }, { AmountDue: -1 }])('rejects malformed money or currency', async patch => {
    await expect(readFinanceSummary(period, readData({ invoiced: [invoice(1, patch)] }))).rejects.toThrow();
  });
  it('rejects invalid receipts and impossible outstanding state', async () => {
    await expect(readFinanceSummary(period, readData({ receipts: [payment(1, { Status: 'DELETED' })] }))).rejects.toThrow();
    await expect(readFinanceSummary(period, readData({ outstanding: [invoice(1, { Status: 'PAID' })] }))).rejects.toThrow();
  });
  it('fails if any dataset fails and reports empty complete reads explicitly', async () => {
    const deps = readData({}); deps.read.mockRejectedValueOnce(new Error('provider private body'));
    await expect(readFinanceSummary(period, deps)).rejects.toThrow();
    expect((await readFinanceSummary(period, readData({}))).currencies).toEqual([]);
  });
  it('defaults to completed Auckland dates even when UTC is still the prior day', () => {
    expect(completedWeek(new Date('2026-09-16T13:00:00Z'))).toEqual(period);
    expect(financeSummaryPeriod.safeParse({ from: '2026-02-30', to: '2026-03-01' }).success).toBe(false);
    expect(financeSummaryPeriod.safeParse({ from: '2026-09-17', to: '2026-09-16' }).success).toBe(false);
    expect(financeSummaryPeriod.safeParse({ from: '2026-01-01', to: '2026-09-16' }).success).toBe(false);
  });
  it('rejects unsupported currency precision and future periods before provider reads', async () => {
    await expect(readFinanceSummary(period, readData({ invoiced: [invoice(1, { CurrencyCode: 'JPY' })] }))).rejects.toThrow();
    const deps = readData({});
    await expect(readFinanceSummary({ from: '2026-09-17', to: '2026-09-18' }, deps)).rejects.toThrow('SUMMARY_FUTURE_PERIOD');
    expect(deps.read).not.toHaveBeenCalled();
  });
});
