import { describe, expect, it } from 'vitest';
import {
  MAX_STAFF_QUOTE_DISCOUNT_PCT,
  STAFF_CUSTOMER_PRICE_MULTIPLIER,
  calculateStaffCustomerPriceFromCostEx,
  normalizeStaffQuoteDiscountPct,
} from './pricing';

describe('calculateStaffCustomerPriceFromCostEx', () => {
  it('applies the staff customer-price multiplier', () => {
    expect(STAFF_CUSTOMER_PRICE_MULTIPLIER).toBe(1.25);
    expect(calculateStaffCustomerPriceFromCostEx(100)).toEqual({
      exGst: 125,
      incGst: 143.75,
    });
  });

  it('rounds the ex-GST price before applying and rounding GST', () => {
    expect(calculateStaffCustomerPriceFromCostEx(123.456)).toEqual({
      exGst: 154.32,
      incGst: 177.47,
    });
  });

  it('keeps zero as a valid price', () => {
    expect(calculateStaffCustomerPriceFromCostEx(0)).toEqual({ exGst: 0, incGst: 0 });
  });

  it('applies the quote discount after markup and before GST', () => {
    expect(calculateStaffCustomerPriceFromCostEx(100, 10)).toEqual({
      exGst: 112.5,
      incGst: 129.38,
    });
  });

  it('normalises quote discounts to the supported commercial range', () => {
    expect(MAX_STAFF_QUOTE_DISCOUNT_PCT).toBe(80);
    expect(normalizeStaffQuoteDiscountPct('-5')).toBe(0);
    expect(normalizeStaffQuoteDiscountPct('5.5')).toBe(5.5);
    expect(normalizeStaffQuoteDiscountPct('not a number')).toBe(0);
    expect(normalizeStaffQuoteDiscountPct('90')).toBe(80);
  });

  it.each([null, undefined, Number.NaN, Number.POSITIVE_INFINITY])(
    'returns null when the true cost is missing or invalid (%s)',
    (value) => {
      expect(calculateStaffCustomerPriceFromCostEx(value)).toBeNull();
    },
  );
});
