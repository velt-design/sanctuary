import { describe, expect, it } from 'vitest';
import { applyCostingControlConfigV1, snapshotCostingControlConfigV1 } from '../controlConfig';
import { calculateSiteCostV1 } from '../engine/calculate';
import { loadCostingConfigV1 } from '../engine/config';
import type { CostInputsV1, SiteInputsV1 } from '../engine/types';
import {
  calculateApprovalCustomerAllowanceV2,
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

  it('removes the 3m overhead cliff and scales only after three crew-days', () => {
    const at29 = calculateSiteCostV1(site({ pergolas: [{ modules: [module({ projection_m: 2.9 })] }] }));
    const at30 = calculateSiteCostV1(site({ pergolas: [{ modules: [module({ projection_m: 3 })] }] }));
    expect(at29.overhead.method).toBe('simple_progressive');
    expect(at30.overhead.method).toBe('simple_progressive');
    expect(at29.overhead.total_ex_gst).toBeGreaterThanOrEqual(2000);
    expect(Math.abs(at30.overhead.total_ex_gst - at29.overhead.total_ex_gst)).toBeLessThan(200);
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
});
