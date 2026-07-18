import { GST_RATE } from './utils';

export const STAFF_CUSTOMER_PRICE_MULTIPLIER = 1.25;

type StaffCustomerPrice = {
  exGst: number;
  incGst: number;
};

export function roundQuoteMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

/**
 * Applies the staff quote pricing sequence to a true cost that excludes GST.
 * The ex-GST sell price is rounded before GST, matching quote line mapping.
 */
export function calculateStaffCustomerPriceFromCostEx(
  trueCostExGst: number | null | undefined,
): StaffCustomerPrice | null {
  if (typeof trueCostExGst !== 'number' || !Number.isFinite(trueCostExGst)) return null;

  const exGst = roundQuoteMoney(trueCostExGst * STAFF_CUSTOMER_PRICE_MULTIPLIER);
  const incGst = roundQuoteMoney(exGst * (1 + GST_RATE));
  return { exGst, incGst };
}
