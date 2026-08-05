import { describe, expect, it } from 'vitest';
import { applyCostingControlConfigV1, snapshotCostingControlConfigV1 } from '../controlConfig';
import { calculateSiteCostV1 } from '../engine/calculate';
import { loadCostingConfigV1 } from '../engine/config';
import type { CostInputsV1, SiteInputsV1 } from '../engine/types';
import { calculateCustomerPriceFromCostEx } from './customerPricing';
import {
  calculateApprovalCustomerAllowanceV2,
  buildSimpleRangeOverheadV2,
  evaluateSimpleRangeEligibilityV2,
} from './simpleRangePricing';

function module(overrides: Partial<CostInputsV1> = {}): CostInputsV1 {
  return {
    length_m: 6,
    projection_m: 3,
    post_cut_height_m: 2.4,
    post_count: 3,
    pergola_style: 'pitched',
    roof_material: 'acrylic',
    extrusion_colour: 'Black',
    house_connection_type: 'fascia',
    post_connection_type: 'deck_bracket',
    access: 'normal',
    height: 'single_storey',
    ground: 'easy',
    ...overrides,
  };
}

function site(overrides: Partial<SiteInputsV1> = {}): SiteInputsV1 {
  return {
    pergolas: [{ id: 'p1', modules: [module()] }],
    pricing_classification: 'simple',
    approval_requirement: 'neither',
    ...overrides,
  };
}

describe('Version 2 commercial policy', () => {
  it('enforces the ground and elevated area boundaries', () => {
    expect(evaluateSimpleRangeEligibilityV2(site({ pergolas: [{ modules: [module({ length_m: 10, projection_m: 3 })] }] })).eligible).toBe(true);
    expect(evaluateSimpleRangeEligibilityV2(site({ pergolas: [{ modules: [module({ length_m: 10, projection_m: 3.1 })] }] })).reason_codes).toContain('AREA_LIMIT_EXCEEDED');
    expect(evaluateSimpleRangeEligibilityV2(site({ pergolas: [{ modules: [module({ length_m: 5, projection_m: 4, height: 'two_storey' })] }] })).eligible).toBe(true);
    expect(evaluateSimpleRangeEligibilityV2(site({ pergolas: [{ modules: [module({ length_m: 5, projection_m: 4.1, height: 'two_storey' })] }] })).reason_codes).toContain('AREA_LIMIT_EXCEEDED');
  });

  it('steps non-standard or multi-structure jobs out of Simple', () => {
    expect(evaluateSimpleRangeEligibilityV2(site({ pergolas: [{ modules: [module({ access: 'hard' })] }] })).reason_codes).toContain('NON_STANDARD_ACCESS');
    expect(evaluateSimpleRangeEligibilityV2(site({ pergolas: [{ modules: [module(), module()] }] })).reason_codes).toContain('MULTIPLE_MODULES');
    expect(evaluateSimpleRangeEligibilityV2(site({ pergolas: [{ modules: [module()] }, { modules: [module()] }] })).reason_codes).toContain('MULTIPLE_PERGOLAS');
  });

  it('starts Simple overhead at $750 and scales continuously after one productive crew-day', () => {
    const config = loadCostingConfigV1();
    expect(buildSimpleRangeOverheadV2(config, 8).total_ex_gst).toBe(750);
    expect(buildSimpleRangeOverheadV2(config, 12).total_ex_gst).toBe(1000);
    expect(buildSimpleRangeOverheadV2(config, 16).total_ex_gst).toBe(1250);

    const at29 = calculateSiteCostV1(site({ pergolas: [{ modules: [module({ projection_m: 2.9 })] }] }));
    const at30 = calculateSiteCostV1(site({ pergolas: [{ modules: [module({ projection_m: 3 })] }] }));
    expect(at29.overhead.method).toBe('simple_progressive');
    expect(at30.overhead.method).toBe('simple_progressive');
    expect(at29.overhead.total_ex_gst).toBeGreaterThanOrEqual(750);
    expect(Math.abs(at30.overhead.total_ex_gst - at29.overhead.total_ex_gst)).toBeLessThan(200);
  });

  it('keeps the smallest Simple job to one genuine site day', () => {
    const result = calculateSiteCostV1(site({ pergolas: [{ modules: [module({ length_m: 1, projection_m: 1 })] }] }));
    const outputModule = result.pergolas[0]?.modules[0];
    const dayCycleActions = result.install.actions.filter((action) => action.id.includes('day_cycle.'));
    const fixedMobilisationActions = result.install.actions.filter((action) => (
      ['Mobilisation', 'Demobilisation'].includes(action.category)
      && !action.id.includes('day_cycle.')
    ));

    expect(outputModule?.derived.site_days).toBe(1);
    expect(dayCycleActions).toHaveLength(3);
    expect(dayCycleActions.every((action) => action.qty === 1)).toBe(true);
    expect(fixedMobilisationActions.length).toBeGreaterThan(0);
    expect(fixedMobilisationActions.every((action) => action.qty === 1)).toBe(true);
    expect(result.overhead.total_ex_gst).toBe(750);
    expect(result.pricing_policy?.customer_price_uplift_pct).toBe(21);
  });

  it.each([
    [1, 1, 5000, 10000],
    [1, 2, 6500, 11500],
    [2, 2, 8000, 13000],
    [2, 3, 9500, 14500],
  ])('prices approval allowances for %i pergolas / %i modules', (pergolaCount, moduleCount, engineering, consent) => {
    const pergolas = Array.from({ length: pergolaCount }, (_, pergolaIndex) => ({
      modules: Array.from(
        { length: pergolaIndex === 0 ? moduleCount - (pergolaCount - 1) : 1 },
        () => module(),
      ),
    }));
    const config = loadCostingConfigV1();
    expect(calculateApprovalCustomerAllowanceV2(site({ pergolas, approval_requirement: 'engineering_required' }), config)?.sell_ex_gst).toBe(engineering);
    expect(calculateApprovalCustomerAllowanceV2(site({ pergolas, approval_requirement: 'full_building_consent' }), config)?.sell_ex_gst).toBe(consent);
  });

  it('keeps a published v1.8 control configuration on legacy overhead behavior', () => {
    const base = loadCostingConfigV1();
    const control = snapshotCostingControlConfigV1(base);
    control.baseManifestVersion = 'v1.8';
    const publishedV1 = applyCostingControlConfigV1(base, control);
    const result = calculateSiteCostV1(site(), publishedV1);
    expect(result.pricing_policy).toBeUndefined();
    expect(result.overhead.method).not.toBe('simple_progressive');
  });

  it('keeps published v2.0 mobilisation, overhead and customer pricing semantics', () => {
    const base = loadCostingConfigV1();
    const control = snapshotCostingControlConfigV1(base);
    control.baseManifestVersion = 'v2.0';
    const publishedV3 = applyCostingControlConfigV1(base, control);
    const result = calculateSiteCostV1(
      site({ pergolas: [{ modules: [module({ length_m: 1, projection_m: 1 })] }] }),
      publishedV3,
    );

    expect(result.pergolas[0]?.modules[0]?.derived.site_days).toBe(2);
    expect(result.overhead.total_ex_gst).toBeGreaterThanOrEqual(2000);
    expect(result.pricing_policy?.customer_price_uplift_pct).toBe(0);
  });

  it('keeps published v2.1 Simple customer pricing at the Version 4 uplift', () => {
    const base = loadCostingConfigV1();
    const control = snapshotCostingControlConfigV1(base);
    control.baseManifestVersion = 'v2.1';
    const publishedV4 = applyCostingControlConfigV1(base, control);
    const result = calculateSiteCostV1(site(), publishedV4);

    expect(result.overhead.method).toBe('simple_progressive');
    expect(result.pricing_policy?.customer_price_uplift_pct).toBe(10);
  });

  it('prices Version 5 exactly 10% above Version 4 before final cent rounding', () => {
    const current = loadCostingConfigV1();
    const historicalControl = snapshotCostingControlConfigV1(current);
    historicalControl.baseManifestVersion = 'v2.1';
    const version4 = applyCostingControlConfigV1(current, historicalControl);
    const version4Result = calculateSiteCostV1(site(), version4);
    const version5Result = calculateSiteCostV1(site(), current);
    const version4Price = calculateCustomerPriceFromCostEx(
      version4Result.totals.cost_ex_gst,
      0,
      version4Result.pricing_policy?.customer_price_uplift_pct,
    );
    const version5Price = calculateCustomerPriceFromCostEx(
      version5Result.totals.cost_ex_gst,
      0,
      version5Result.pricing_policy?.customer_price_uplift_pct,
    );

    expect(version5Result.totals.cost_ex_gst).toBe(version4Result.totals.cost_ex_gst);
    expect(version5Result.pricing_policy?.customer_price_uplift_pct).toBe(21);
    expect((version5Price?.incGst ?? 0) / (version4Price?.incGst ?? 1)).toBeCloseTo(1.1, 4);
  });
});
