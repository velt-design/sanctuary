import { GST_RATE } from '../blinds';

export const CUSTOMER_PRICE_MULTIPLIER = 1.25;
export const MAX_CUSTOMER_PRICE_MULTIPLIER = 10;
export const MAX_CUSTOMER_PRICE_DISCOUNT_PCT = 80;
export const MAX_CUSTOMER_PRICE_UPLIFT_PCT = 100;

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

export function normalizeCustomerPriceUpliftPct(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(MAX_CUSTOMER_PRICE_UPLIFT_PCT, Math.max(0, parsed));
}

export function normalizeCustomerPriceMultiplier(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  if (!Number.isFinite(parsed) || parsed <= 0) return CUSTOMER_PRICE_MULTIPLIER;
  return Math.min(MAX_CUSTOMER_PRICE_MULTIPLIER, parsed);
}

/**
 * Canonical customer-price sequence for a true cost that excludes GST:
 * markup, policy uplift, ex-GST cents, discount, ex-GST cents, GST, inc-GST cents.
 */
export function calculateCustomerPriceFromCostEx(
  trueCostExGst: number | null | undefined,
  discountPct: number | string | null | undefined = 0,
  customerPriceUpliftPct: number | string | null | undefined = 0,
  customerPriceMultiplier: number | string | null | undefined = CUSTOMER_PRICE_MULTIPLIER,
): CustomerPrice | null {
  if (typeof trueCostExGst !== 'number' || !Number.isFinite(trueCostExGst)) return null;

  const upliftMultiplier = 1 + normalizeCustomerPriceUpliftPct(customerPriceUpliftPct) / 100;
  const markupMultiplier = normalizeCustomerPriceMultiplier(customerPriceMultiplier);
  const undiscountedExGst = roundCustomerMoney(trueCostExGst * markupMultiplier * upliftMultiplier);
  const discountMultiplier = 1 - normalizeCustomerPriceDiscountPct(discountPct) / 100;
  const exGst = roundCustomerMoney(undiscountedExGst * discountMultiplier);
  const incGst = roundCustomerMoney(exGst * (1 + GST_RATE));
  return { exGst, incGst };
}
