import { z } from 'zod';

export const accountingDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
});
export const financeSummaryPeriod = z.object({ from: accountingDate, to: accountingDate }).strict().refine(
  ({ from, to }) => from <= to && (Date.parse(to) - Date.parse(from)) / 86400000 < 90,
);
export type FinanceSummaryPeriod = z.infer<typeof financeSummaryPeriod>;
export type CurrencySummary = {
  currency: string;
  invoiced: { count: number; excludingTaxCents: number; taxCents: number; includingTaxCents: number };
  receipts: { count: number; reconciledCents: number; unreconciledCents: number; unknownReconciliationCents: number };
  outstanding: { count: number; amountDueCents: number };
};
export type FinanceSummary = {
  period: FinanceSummaryPeriod;
  startedAt: string;
  checkedAt: string;
  complete: true;
  currencies: CurrencySummary[];
};
const count = z.number().int().nonnegative().max(2500);
const cents = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const financeSummaryResponse = z.object({
  period: financeSummaryPeriod, startedAt: z.string().datetime(), checkedAt: z.string().datetime(), complete: z.literal(true),
  currencies: z.array(z.object({ currency: z.enum(['NZD', 'AUD', 'USD', 'GBP', 'EUR', 'CAD', 'SGD']),
    invoiced: z.object({ count, excludingTaxCents: cents, taxCents: cents, includingTaxCents: cents }),
    receipts: z.object({ count, reconciledCents: cents, unreconciledCents: cents, unknownReconciliationCents: cents }),
    outstanding: z.object({ count, amountDueCents: cents }),
  })).max(7),
});
export function completedWeek(now = new Date()): FinanceSummaryPeriod {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const day = Date.parse(`${today}T00:00:00Z`);
  return { from: new Date(day - 7 * 86400000).toISOString().slice(0, 10), to: new Date(day - 86400000).toISOString().slice(0, 10) };
}
