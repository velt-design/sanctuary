import { describe, expect, it } from 'vitest';
import {
  calculateCustomerPriceFromCostEx,
  normalizeCustomerPriceDiscountPct,
  roundCustomerMoney,
} from './customerPricing';

describe('customer pricing', () => {
  it('keeps the portal customer-price rounding sequence', () => {
    expect(calculateCustomerPriceFromCostEx(10_000.019, 0)).toEqual({
      exGst: 12_500.02,
      incGst: 14_375.02,
    });
    expect(calculateCustomerPriceFromCostEx(10_000.019, 7.5)).toEqual({
      exGst: 11_562.52,
      incGst: 13_296.9,
    });
  });

  it('normalizes invalid inputs and protects discount limits', () => {
    expect(calculateCustomerPriceFromCostEx(Number.NaN)).toBeNull();
    expect(normalizeCustomerPriceDiscountPct('-2')).toBe(0);
    expect(normalizeCustomerPriceDiscountPct('90')).toBe(80);
    expect(roundCustomerMoney(Number.NaN)).toBe(0);
  });
});
