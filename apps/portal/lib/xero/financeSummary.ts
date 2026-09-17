import 'server-only';
import { z } from 'zod';
import { accountingDate, financeSummaryPeriod, type CurrencySummary, type FinanceSummary, type FinanceSummaryPeriod } from './financeSummaryContract';
import { readSummaryPage, SUMMARY_PAGE_SIZE } from './financeSummaryProvider';

const money = z.number().finite().nonnegative().refine(value => Number.isSafeInteger(Math.round(value * 100)) && Math.abs(value * 100 - Math.round(value * 100)) < 0.00001).transform(value => Math.round(value * 100));
// These supported currencies all use two minor-unit decimals. Fail closed for others.
const currency = z.enum(['NZD', 'AUD', 'USD', 'GBP', 'EUR', 'CAD', 'SGD']);
const invoice = z.object({ InvoiceID: z.string().uuid(), Type: z.literal('ACCREC'), Status: z.enum(['AUTHORISED', 'PAID']),
  DateString: z.string().optional(), Date: z.string().optional(), CurrencyCode: currency,
  SubTotal: money, TotalTax: money, Total: money, AmountDue: money });
const payment = z.object({ PaymentID: z.string().uuid(), PaymentType: z.literal('ACCRECPAYMENT'), Status: z.literal('AUTHORISED'),
  DateString: z.string().optional(), Date: z.string().optional(), Amount: money,
  IsReconciled: z.boolean().nullable().optional(), Invoice: z.object({ InvoiceID: z.string().uuid(), Type: z.literal('ACCREC'), CurrencyCode: currency }) });
function dateOnly(row: { DateString?: string; Date?: string }): string {
  const source = row.DateString ?? row.Date ?? '';
  if (/^\d{4}-\d{2}-\d{2}(T00:00:00(?:\.000)?Z?)?$/.test(source)) return accountingDate.parse(source.slice(0, 10));
  // Xero's legacy date-only JSON wrapper is midnight UTC, not an instant to shift into local time.
  const match = /^\/Date\((\d+)(?:[+-]\d{4})?\)\/$/.exec(source);
  if (!match) throw new Error('SUMMARY_UNAVAILABLE');
  const date = new Date(Number(match[1]));
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(11) !== '00:00:00.000Z') throw new Error('SUMMARY_UNAVAILABLE');
  return date.toISOString().slice(0, 10);
}
function add(left: number, right: number) {
  const result = left + right;
  if (!Number.isSafeInteger(result)) throw new Error('SUMMARY_UNAVAILABLE');
  return result;
}
const dependencies = { read: readSummaryPage, now: () => new Date() };
export async function readFinanceSummary(rawPeriod: FinanceSummaryPeriod, deps = dependencies): Promise<FinanceSummary> {
  const period = financeSummaryPeriod.parse(rawPeriod);
  const startedAt = deps.now().toISOString();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit' }).format(deps.now());
  if (period.to > today) throw new Error('SUMMARY_FUTURE_PERIOD');
  const deadline = AbortSignal.timeout(75000);
  const buckets = new Map<string, CurrencySummary>();
  const bucket = (code: string) => {
    if (!buckets.has(code)) buckets.set(code, { currency: code,
      invoiced: { count: 0, excludingTaxCents: 0, taxCents: 0, includingTaxCents: 0 },
      receipts: { count: 0, reconciledCents: 0, unreconciledCents: 0, unknownReconciliationCents: 0 },
      outstanding: { count: 0, amountDueCents: 0 } });
    return buckets.get(code)!;
  };
  for (const source of ['invoiced', 'receipts', 'outstanding'] as const) {
    const seen = new Set<string>();
    let finished = false;
    for (let page = 1; page <= 10; page++) {
      deadline.throwIfAborted();
      const rows = await deps.read(source, period, page, deadline);
      if (rows.length > SUMMARY_PAGE_SIZE) throw new Error('SUMMARY_UNAVAILABLE');
      for (const raw of rows) {
        const row = source === 'receipts' ? payment.parse(raw) : invoice.parse(raw);
        const id = ('PaymentID' in row ? row.PaymentID : row.InvoiceID).toLowerCase();
        // Even identical duplicates can indicate pagination drift/omitted rows. Never show a partial total.
        if (seen.has(id)) throw new Error('SUMMARY_CHANGED_DURING_READ');
        seen.add(id);
        if (source !== 'outstanding') {
          const day = dateOnly(row);
          if (day < period.from || day > period.to) throw new Error('SUMMARY_UNAVAILABLE');
        }
        if ('PaymentID' in row) {
          const target = bucket(row.Invoice.CurrencyCode).receipts;
          target.count++;
          const key = row.IsReconciled === true ? 'reconciledCents' : row.IsReconciled === false ? 'unreconciledCents' : 'unknownReconciliationCents';
          target[key] = add(target[key], row.Amount);
        } else if (source === 'invoiced') {
          if (add(row.SubTotal, row.TotalTax) !== row.Total) throw new Error('SUMMARY_UNAVAILABLE');
          const target = bucket(row.CurrencyCode).invoiced;
          target.count++;
          target.excludingTaxCents = add(target.excludingTaxCents, row.SubTotal);
          target.taxCents = add(target.taxCents, row.TotalTax);
          target.includingTaxCents = add(target.includingTaxCents, row.Total);
        } else {
          if (row.Status !== 'AUTHORISED' || row.AmountDue <= 0) throw new Error('SUMMARY_UNAVAILABLE');
          const target = bucket(row.CurrencyCode).outstanding;
          target.count++;
          target.amountDueCents = add(target.amountDueCents, row.AmountDue);
        }
      }
      if (rows.length < SUMMARY_PAGE_SIZE) { finished = true; break; }
    }
    if (!finished) throw new Error('SUMMARY_LIMIT');
  }
  return { period, startedAt, checkedAt: deps.now().toISOString(), complete: true,
    currencies: [...buckets.values()].sort((a, b) => a.currency.localeCompare(b.currency)) };
}
