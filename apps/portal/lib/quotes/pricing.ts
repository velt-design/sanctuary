import { GST_RATE } from './utils';

export const STAFF_CUSTOMER_PRICE_MULTIPLIER = 1.25;

type StaffCustomerPrice = {
  exGst: number;
  incGst: number;
};

export const MAX_STAFF_QUOTE_DISCOUNT_PCT = 80;

export function roundQuoteMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export function normalizeStaffQuoteDiscountPct(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(MAX_STAFF_QUOTE_DISCOUNT_PCT, Math.max(0, parsed));
}

/**
 * Applies the staff quote pricing sequence to a true cost that excludes GST.
 * The ex-GST sell price is rounded before GST, matching quote line mapping.
 */
export function calculateStaffCustomerPriceFromCostEx(
  trueCostExGst: number | null | undefined,
  quoteDiscountPct: number | string | null | undefined = 0,
): StaffCustomerPrice | null {
  if (typeof trueCostExGst !== 'number' || !Number.isFinite(trueCostExGst)) return null;

  const undiscountedExGst = roundQuoteMoney(trueCostExGst * STAFF_CUSTOMER_PRICE_MULTIPLIER);
  const discountMultiplier = 1 - normalizeStaffQuoteDiscountPct(quoteDiscountPct) / 100;
  const exGst = roundQuoteMoney(undiscountedExGst * discountMultiplier);
  const incGst = roundQuoteMoney(exGst * (1 + GST_RATE));
  return { exGst, incGst };
}
