import { describe, expect, it } from 'vitest';
import { calculateCustomerPriceFromCostEx, calculateSiteCostV1, priceAllBlinds } from '@sp/costing';
import { makeDefaultCalculatorInputs } from './calculatorInputs';
import { buildSiteInputsFromCalculatorInputs } from '@/lib/estimates/costingPayload';
import { buildCalculatorPricingPreview } from './calculatorPricingPreview';

describe('Version 2 calculator pricing preview', () => {
  it('adds engineering at its direct sell price without markup or discount', () => {
    const inputs = {
      ...makeDefaultCalculatorInputs(),
      approvalRequirement: 'engineering_required' as const,
      pricingClassification: 'bespoke' as const,
      quoteDiscountPct: '20',
    };
    const result = calculateSiteCostV1(buildSiteInputsFromCalculatorInputs(inputs));
    const preview = buildCalculatorPricingPreview({
      result,
      inputs,
      blindPricing: priceAllBlinds([]),
    });
    const approval = preview.rows.find((row) => row.kind === 'approval');
    expect(approval?.priceIncGstCents).toBe(575_000);
    expect(approval?.detail).toContain('Not discountable');
    expect(preview.totalIncGstCents - (preview.undiscountedTotalIncGstCents ?? 0)).not.toBe(0);
  });

  it('applies the frozen Simple customer-price uplift to the core price', () => {
    const inputs = {
      ...makeDefaultCalculatorInputs(),
      pricingClassification: 'simple' as const,
      approvalRequirement: 'neither' as const,
      quoteDiscountPct: '0',
    };
    const result = calculateSiteCostV1(buildSiteInputsFromCalculatorInputs(inputs));
    const preview = buildCalculatorPricingPreview({
      result,
      inputs,
      blindPricing: priceAllBlinds([]),
    });
    const expected = calculateCustomerPriceFromCostEx(
      result.totals.cost_ex_gst,
      0,
      result.pricing_policy?.customer_price_uplift_pct,
    );

    expect(result.pricing_policy?.customer_price_uplift_pct).toBe(21);
    expect(preview.totalIncGstCents).toBe(Math.round((expected?.incGst ?? 0) * 100));
  });
});
