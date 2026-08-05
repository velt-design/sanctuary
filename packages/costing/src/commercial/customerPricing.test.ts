import { describe, expect, it } from 'vitest';
import {
  calculateCustomerPriceFromCostEx,
  normalizeCustomerPriceDiscountPct,
  normalizeCustomerPriceUpliftPct,
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

  it('applies a policy uplift after markup and before discount and GST', () => {
    expect(calculateCustomerPriceFromCostEx(10_000, 0, 10)).toEqual({
      exGst: 13_750,
      incGst: 15_812.5,
    });
    expect(calculateCustomerPriceFromCostEx(10_000, 10, 10)).toEqual({
      exGst: 12_375,
      incGst: 14_231.25,
    });
  });

  it('normalizes invalid inputs and protects discount limits', () => {
    expect(calculateCustomerPriceFromCostEx(Number.NaN)).toBeNull();
    expect(normalizeCustomerPriceDiscountPct('-2')).toBe(0);
    expect(normalizeCustomerPriceDiscountPct('90')).toBe(80);
    expect(normalizeCustomerPriceUpliftPct('-2')).toBe(0);
    expect(normalizeCustomerPriceUpliftPct('110')).toBe(100);
    expect(roundCustomerMoney(Number.NaN)).toBe(0);
  });
});
