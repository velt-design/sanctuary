import { describe, expect, it } from 'vitest';
import {
  STAFF_CUSTOMER_PRICE_MULTIPLIER,
  calculateStaffCustomerPriceFromCostEx,
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

  it.each([null, undefined, Number.NaN, Number.POSITIVE_INFINITY])(
    'returns null when the true cost is missing or invalid (%s)',
    (value) => {
      expect(calculateStaffCustomerPriceFromCostEx(value)).toBeNull();
    },
  );
});
