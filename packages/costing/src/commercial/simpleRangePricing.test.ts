import { describe, expect, it } from 'vitest';
import { applyCostingControlConfigV1, snapshotCostingControlConfigV1 } from '../controlConfig';
import { calculateSiteCostV1 } from '../engine/calculate';
import { loadCostingConfigV1 } from '../engine/config';
import type { CostInputsV1, SiteInputsV1 } from '../engine/types';
import { calculateCustomerPriceFromCostEx } from './customerPricing';
import {
  calculateApprovalCustomerAllowanceV2,
  buildCommercialOverheadV5,
  evaluateSimpleRangeEligibilityV2,
  resolveSitePricingPolicyV2,
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

function historicalEligibility(inputs: SiteInputsV1) {
  return evaluateSimpleRangeEligibilityV2(inputs, {
    ...loadCostingConfigV1(), appliedControlManifestVersion: 'v2.9',
  });
}
describe('Version 2 commercial policy', () => {
  it.each([
    ['large', { length_m: 10, projection_m: 5 }],
    ['timber roof', { roof_material: 'timber' }],
    ['hip roof', { pergola_style: 'hip' }],
    ['freestanding', { house_connection_type: 'none', post_connection_type: 'pile_1m' }],
    ['difficult site', { access: 'hard', ground: 'hard', height: 'two_storey' }],
    ['custom finish', { extrusion_colour: 'White', powdercoat_is_custom: true }],
  ] as const)('allows Standard for %s without approvals and preserves historical restrictions', (_name, overrides) => {
    const inputs = site({ pergolas: [{ modules: [module(overrides)] }] });
    const current = loadCostingConfigV1();
    expect(evaluateSimpleRangeEligibilityV2(inputs).eligible).toBe(true);
    expect(resolveSitePricingPolicyV2(inputs, current).resolved_classification).toBe('simple');
    expect(historicalEligibility(inputs).eligible).toBe(false);
    for (const approval_requirement of ['engineering_required', 'full_building_consent'] as const) {
      expect(resolveSitePricingPolicyV2({ ...inputs, approval_requirement }, current)).toMatchObject({
        resolved_classification: 'bespoke', reason_codes: ['APPROVAL_REQUIRED'],
      });
    }
  });

  it('prices commercial multi-pergola/module jobs as Standard while retaining actual labour costs', () => {
    const inputs = site({ job_type: 'commercial', pergolas: [{ modules: [module(), module()] }, { modules: [module()] }] });
    const result = calculateSiteCostV1(inputs);
    expect(result.pricing_policy?.resolved_classification).toBe('simple');
    expect(result.overhead.sales_ex_gst).toBe(0);
    expect(result.install.actions.some((action) => action.applied_multipliers.bespoke_productive_time)).toBe(false);
    expect(result.totals.cost_ex_gst).toBeGreaterThan(calculateSiteCostV1(site()).totals.cost_ex_gst);
    expect(calculateSiteCostV1(site({ pergolas: [{ modules: [module({ access: 'hard' })] }] })).install.totals.install_ex_gst)
      .toBeGreaterThan(calculateSiteCostV1(site()).install.totals.install_ex_gst);
    expect(resolveSitePricingPolicyV2({ ...inputs, pricing_classification: 'bespoke' }, loadCostingConfigV1()).resolved_classification).toBe('bespoke');
  });
  it.each(['v2.5', 'v2.6', 'v2.7', 'v2.8', 'v2.9'])('preserves published %s bespoke pricing when the package advances', (version) => {
    const base = loadCostingConfigV1();
    const control = { ...snapshotCostingControlConfigV1(base), baseManifestVersion: version };
    const historical = applyCostingControlConfigV1(base, control);
    const inputs = site({ pricing_classification: 'bespoke' });
    const before = calculateSiteCostV1(inputs, historical);
    const after = calculateSiteCostV1(inputs, base);
    expect(before.overhead.sales_ex_gst).toBe(1200);
    expect(after.overhead.sales_ex_gst).toBe(600);
    const beforeAction = before.install.actions.find((action) => action.id.includes('rafters.install_rafter_pitched'))!;
    const afterAction = after.install.actions.find((action) => action.id.includes('rafters.install_rafter_pitched'))!;
    expect(beforeAction.applied_multipliers.bespoke_productive_time).toBe(1.2);
    expect(afterAction.applied_multipliers.bespoke_productive_time).toBe(1.1);
    expect(after.totals.cost_ex_gst).toBeLessThan(before.totals.cost_ex_gst);
    for (const approval_requirement of ['engineering_required', 'full_building_consent'] as const) {
      expect(calculateApprovalCustomerAllowanceV2({ ...inputs, approval_requirement }, base))
        .toEqual(calculateApprovalCustomerAllowanceV2({ ...inputs, approval_requirement }, historical));
    }
  });

  it('keeps v2.9 Standard pricing unchanged and adds actual extras once before markup', () => {
    const base = loadCostingConfigV1();
    const old = applyCostingControlConfigV1(base, { ...snapshotCostingControlConfigV1(base), baseManifestVersion: 'v2.9' });
    expect(calculateSiteCostV1(site(), base)).toEqual(calculateSiteCostV1(site(), old));
    const withoutExtras = calculateSiteCostV1(site({ pricing_classification: 'bespoke' }), base);
    const withExtras = calculateSiteCostV1(site({ pricing_classification: 'bespoke', extras_allowance_ex_gst: 200, travel_ex_gst: 100 }), base);
    expect(withExtras.totals.cost_ex_gst - withoutExtras.totals.cost_ex_gst).toBeCloseTo(300, 2);
    expect(withExtras.overhead).toEqual(withoutExtras.overhead);
    expect(calculateCustomerPriceFromCostEx(600, 0, 0, 1.3)).toMatchObject({ exGst: 780, incGst: 897 });
  });
  it('enforces the ground and elevated area boundaries', () => {
    expect(historicalEligibility(site({ pergolas: [{ modules: [module({ length_m: 10, projection_m: 3 })] }] })).eligible).toBe(true);
    expect(historicalEligibility(site({ pergolas: [{ modules: [module({ length_m: 10, projection_m: 3.1 })] }] })).reason_codes).toContain('AREA_LIMIT_EXCEEDED');
    expect(historicalEligibility(site({ pergolas: [{ modules: [module({ length_m: 5, projection_m: 4, height: 'two_storey' })] }] })).eligible).toBe(true);
    expect(historicalEligibility(site({ pergolas: [{ modules: [module({ length_m: 5, projection_m: 4.1, height: 'two_storey' })] }] })).reason_codes).toContain('AREA_LIMIT_EXCEEDED');
  });

  it('steps non-standard or multi-structure jobs out of Simple', () => {
    expect(historicalEligibility(site({ pergolas: [{ modules: [module({ access: 'hard' })] }] })).reason_codes).toContain('NON_STANDARD_ACCESS');
    expect(historicalEligibility(site({ pergolas: [{ modules: [module(), module()] }] })).reason_codes).toContain('MULTIPLE_MODULES');
    expect(historicalEligibility(site({ pergolas: [{ modules: [module()] }, { modules: [module()] }] })).reason_codes).toContain('MULTIPLE_PERGOLAS');
  });

  it('allows an open pergola through the same Simple eligibility rules', () => {
    const openSite = site({ pergolas: [{ modules: [module({ roof_material: 'none' })] }] });
    expect(historicalEligibility(openSite)).toEqual({ eligible: true, reason_codes: [] });

    const hardAccess = site({ pergolas: [{ modules: [module({ roof_material: 'none', access: 'hard' })] }] });
    expect(historicalEligibility(hardAccess).reason_codes).toContain('NON_STANDARD_ACCESS');
    expect(historicalEligibility(
      site({ pergolas: [{ modules: [module({ roof_material: 'timber' })] }] }),
    ).reason_codes).toContain('NON_PITCHED_ACRYLIC');
  });

  it('allows standard acrylic gable and box-perimeter structures in Simple', () => {
    expect(historicalEligibility(
      site({ pergolas: [{ modules: [module({ pergola_style: 'gable' })] }] }),
    )).toEqual({ eligible: true, reason_codes: [] });
    expect(historicalEligibility(
      site({ pergolas: [{ modules: [module({ box_perimeter_enabled: true })] }] }),
    )).toEqual({ eligible: true, reason_codes: [] });
    expect(historicalEligibility(
      site({ pergolas: [{ modules: [module({ pergola_style: 'hip' })] }] }),
    ).reason_codes).toContain('NON_PITCHED_ACRYLIC');
  });

  it('uses the unified overhead and 1.3x policy for open pergolas', () => {
    const result = calculateSiteCostV1(
      site({ pergolas: [{ modules: [module({ roof_material: 'none' })] }] }),
    );

    expect(result.pricing_policy?.resolved_classification).toBe('simple');
    expect(result.pricing_policy?.customer_price_multiplier).toBe(1.3);
    expect(result.pricing_policy?.customer_price_uplift_pct).toBe(0);
    expect(result.overhead.method).toBe('unified_commercial_v5');
  });

  it('keeps approvals Bespoke for open pergolas', () => {
    const result = calculateSiteCostV1(site({
      approval_requirement: 'engineering_required',
      pergolas: [{ modules: [module({ roof_material: 'none' })] }],
    }));

    expect(result.pricing_policy?.resolved_classification).toBe('bespoke');
    expect(result.pricing_policy?.customer_price_uplift_pct).toBe(0);
  });

  it('uses one $1000 startup and $500 per pro-rated productive crew-day', () => {
    const config = loadCostingConfigV1();
    expect(buildCommercialOverheadV5(config, site(), 8, 'simple').total_ex_gst).toBe(1500);
    expect(buildCommercialOverheadV5(config, site(), 12, 'simple').total_ex_gst).toBe(1750);
    expect(buildCommercialOverheadV5(config, site(), 16, 'simple').total_ex_gst).toBe(2000);

    const at29 = calculateSiteCostV1(site({ pergolas: [{ modules: [module({ projection_m: 2.9 })] }] }));
    const at30 = calculateSiteCostV1(site({ pergolas: [{ modules: [module({ projection_m: 3 })] }] }));
    expect(at29.overhead.method).toBe('unified_commercial_v5');
    expect(at30.overhead.method).toBe('unified_commercial_v5');
    expect(at29.overhead.total_ex_gst).toBeGreaterThanOrEqual(500);
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
    expect(result.overhead.total_ex_gst).toBe(1466.88);
    expect(result.pricing_policy?.customer_price_multiplier).toBe(1.3);
    expect(result.pricing_policy?.customer_price_uplift_pct).toBe(0);
  });

  it.each([
    [1, 1, 600],
    [1, 2, 900],
    [2, 2, 1400],
    [2, 3, 1700],
  ])('prices Bespoke design for %i pergolas / %i modules', (pergolaCount, moduleCount, expectedDesign) => {
    const pergolas = Array.from({ length: pergolaCount }, (_, pergolaIndex) => ({
      modules: Array.from(
        { length: pergolaIndex === 0 ? moduleCount - (pergolaCount - 1) : 1 },
        () => module(),
      ),
    }));
    const config = loadCostingConfigV1();
    expect(buildCommercialOverheadV5(config, site({ pergolas }), 8, 'bespoke').sales_ex_gst).toBe(expectedDesign);
  });

  it('adds 10% to Bespoke productive installation actions but not mobilisation', () => {
    const simple = calculateSiteCostV1(site());
    const bespoke = calculateSiteCostV1(site({ pricing_classification: 'bespoke' }));
    const simpleProductive = simple.install.actions.find((action) => action.id.includes('rafters.install_rafter_pitched'));
    const bespokeProductive = bespoke.install.actions.find((action) => action.id.includes('rafters.install_rafter_pitched'));
    const simpleMobilisation = simple.install.actions.find((action) => action.id.includes('mob.site_survey'));
    const bespokeMobilisation = bespoke.install.actions.find((action) => action.id.includes('mob.site_survey'));

    expect(bespokeProductive?.minutes).toBeCloseTo((simpleProductive?.minutes ?? 0) * 1.1, 2);
    expect(bespokeMobilisation?.minutes).toBe(simpleMobilisation?.minutes);
  });

  it('calculates the agreed 6m x 3m customer-price anchors', () => {
    const standard = module({ post_count: 4, house_connection_type: 'soffit', roof_pitch_deg: 5 });
    const scenarios = [
      [site({ pergolas: [{ modules: [standard] }] }), 12_324.24],
      [site({ pricing_classification: 'bespoke', pergolas: [{ modules: [standard] }] }), 13_630.86],
      [site({ pergolas: [{ modules: [{ ...standard, pergola_style: 'gable' }] }] }), 13_207.24],
      [site({ pergolas: [{ modules: [{ ...standard, box_perimeter_enabled: true }] }] }), 15_374.52],
    ] as const;

    for (const [inputs, expectedIncGst] of scenarios) {
      const result = calculateSiteCostV1(inputs);
      const customerPrice = calculateCustomerPriceFromCostEx(
        result.totals.cost_ex_gst,
        0,
        result.pricing_policy?.customer_price_uplift_pct,
        result.pricing_policy?.customer_price_multiplier,
      );
      expect(customerPrice?.incGst).toBe(expectedIncGst);
    }
  });

  it('keeps the 6m x 3m fascia / three-post Simple reference near $11,500 inc GST', () => {
    const result = calculateSiteCostV1(site({
      pergolas: [{ modules: [module({ roof_pitch_deg: 5 })] }],
    }));
    const customerPrice = calculateCustomerPriceFromCostEx(
      result.totals.cost_ex_gst,
      0,
      result.pricing_policy?.customer_price_uplift_pct,
      result.pricing_policy?.customer_price_multiplier,
    );

    expect(customerPrice?.incGst).toBe(11_484.03);
  });

  it('preserves the $500 startup for published v2.4 configurations', () => {
    const base = loadCostingConfigV1();
    const control = snapshotCostingControlConfigV1(base);
    control.baseManifestVersion = 'v2.4';
    const publishedV24 = applyCostingControlConfigV1(base, control);

    expect(buildCommercialOverheadV5(publishedV24, site(), 8, 'simple').total_ex_gst).toBe(1000);
  });

  it('calculates and allocates the Bespoke design fee once per site', () => {
    const inputs = site({
      pricing_classification: 'bespoke',
      pergolas: [
        { id: 'p1', modules: [module(), module()] },
        { id: 'p2', modules: [module()] },
      ],
    });
    const result = calculateSiteCostV1(inputs);
    const allocatedSales = result.pergolas.reduce((sum, pergola) => sum + pergola.overhead.sales_ex_gst, 0);

    expect(result.overhead.sales_ex_gst).toBe(1700);
    expect(allocatedSales).toBe(1700);
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

  it('keeps published v2.3 on the Version 5 uplift and 1.25x multiplier', () => {
    const current = loadCostingConfigV1();
    const historicalControl = snapshotCostingControlConfigV1(current);
    historicalControl.baseManifestVersion = 'v2.3';
    const historical = applyCostingControlConfigV1(current, historicalControl);
    const result = calculateSiteCostV1(site(), historical);
    const historicalGable = calculateSiteCostV1(
      site({ pergolas: [{ modules: [module({ pergola_style: 'gable' })] }] }),
      historical,
    );
    const price = calculateCustomerPriceFromCostEx(
      result.totals.cost_ex_gst,
      0,
      result.pricing_policy?.customer_price_uplift_pct,
      result.pricing_policy?.customer_price_multiplier,
    );

    expect(result.overhead.method).toBe('simple_progressive');
    expect(result.pricing_policy?.customer_price_multiplier).toBe(1.25);
    expect(result.pricing_policy?.customer_price_uplift_pct).toBe(21);
    expect(historicalGable.pricing_policy?.resolved_classification).toBe('bespoke');
    expect(price?.incGst).toBeGreaterThan(0);
  });
});
