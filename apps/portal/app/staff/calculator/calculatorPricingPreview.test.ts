import { describe, expect, it } from 'vitest';
import { calculateCustomerPriceFromCostEx, calculateSiteCostV1, priceAllBlinds } from '@sp/costing';
import { makeDefaultCalculatorInputs, makeEmptyAddOnCalculatorInputs } from './calculatorInputs';
import { buildSiteInputsFromCalculatorInputs } from '@/lib/estimates/costingPayload';
import { buildCalculatorPricingPreview } from './calculatorPricingPreview';

describe('Version 2 calculator pricing preview', () => {
  it('shows customer pricing for a blind-only add-on with no pergola', () => {
    const inputs = {
      ...makeEmptyAddOnCalculatorInputs(),
      blinds: {
        items: [{
          id: 'blind-only',
          label: 'Existing pergola blind',
          system: 'ZIPTRAK' as const,
          widthMm: '2000',
          coverLengthMm: '2400',
          fabric: 'MESH' as const,
          motorised: 'NONE' as const,
          rollCover: 'NONE' as const,
        }],
      },
    };
    const blindPricing = priceAllBlinds([{
      id: 'blind-only',
      label: 'Existing pergola blind',
      system: 'ZIPTRAK',
      widthMm: 2000,
      coverLengthMm: 2400,
      fabric: 'MESH',
      motorised: false,
      rollCover: 'NONE',
    }]);
    const result = calculateSiteCostV1(buildSiteInputsFromCalculatorInputs(inputs));
    const preview = buildCalculatorPricingPreview({ result, inputs, blindPricing });

    expect(result.pergolas).toEqual([]);
    expect(preview.rows.map((row) => row.kind)).toEqual(['blind']);
    expect(preview.totalIncGstCents).toBeGreaterThan(0);
    expect(preview.hasCorePricing).toBe(true);
  });

  it('shows site costs for an allowance-only add-on with no pergola', () => {
    const inputs = {
      ...makeEmptyAddOnCalculatorInputs(),
      travelExGst: '100',
    };
    const result = calculateSiteCostV1(buildSiteInputsFromCalculatorInputs(inputs));
    const preview = buildCalculatorPricingPreview({
      result,
      inputs,
      blindPricing: priceAllBlinds([]),
    });

    expect(preview.rows).toEqual([
      expect.objectContaining({
        id: 'add-on-site-costs',
        kind: 'shared',
        status: 'priced',
        label: 'Site costs',
      }),
    ]);
    expect(preview.totalIncGstCents).toBeGreaterThan(0);
  });

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

  it('applies the frozen customer-price multiplier to the core price', () => {
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
      result.pricing_policy?.customer_price_multiplier,
    );

    expect(result.pricing_policy?.customer_price_multiplier).toBe(1.3);
    expect(result.pricing_policy?.customer_price_uplift_pct).toBe(0);
    expect(preview.totalIncGstCents).toBe(Math.round((expected?.incGst ?? 0) * 100));
  });
});
