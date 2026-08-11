export {
  CUSTOMER_PRICE_MULTIPLIER as STAFF_CUSTOMER_PRICE_MULTIPLIER,
  MAX_CUSTOMER_PRICE_DISCOUNT_PCT as MAX_STAFF_QUOTE_DISCOUNT_PCT,
  calculateCustomerPriceFromCostEx as calculateStaffCustomerPriceFromCostEx,
  normalizeCustomerPriceMultiplier as normalizeStaffCustomerPriceMultiplier,
  normalizeCustomerPriceDiscountPct as normalizeStaffQuoteDiscountPct,
  normalizeCustomerPriceUpliftPct as normalizeStaffCustomerPriceUpliftPct,
  roundCustomerMoney as roundQuoteMoney,
} from '@sp/costing';
