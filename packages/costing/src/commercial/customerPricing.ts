import { GST_RATE } from '../blinds';

export const CUSTOMER_PRICE_MULTIPLIER = 1.25;
export const MAX_CUSTOMER_PRICE_DISCOUNT_PCT = 80;

export type CustomerPrice = {
  exGst: number;
  incGst: number;
};

export function roundCustomerMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export function normalizeCustomerPriceDiscountPct(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(MAX_CUSTOMER_PRICE_DISCOUNT_PCT, Math.max(0, parsed));
}

/**
 * Canonical customer-price sequence for a true cost that excludes GST:
 * markup, ex-GST cents, discount, ex-GST cents, GST, inc-GST cents.
 */
export function calculateCustomerPriceFromCostEx(
  trueCostExGst: number | null | undefined,
  discountPct: number | string | null | undefined = 0,
): CustomerPrice | null {
  if (typeof trueCostExGst !== 'number' || !Number.isFinite(trueCostExGst)) return null;

  const undiscountedExGst = roundCustomerMoney(trueCostExGst * CUSTOMER_PRICE_MULTIPLIER);
  const discountMultiplier = 1 - normalizeCustomerPriceDiscountPct(discountPct) / 100;
  const exGst = roundCustomerMoney(undiscountedExGst * discountMultiplier);
  const incGst = roundCustomerMoney(exGst * (1 + GST_RATE));
  return { exGst, incGst };
}
