import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { applyCostingControlConfigV1, COSTING_CONTROL_PREVIEW_SCENARIOS_V1, previewCostingControlImpactV1, snapshotCostingControlConfigV1 } from '../controlConfig';
import { calculateSiteCostV1 } from '../engine/calculate';
import { normalizeAndDeriveV1 } from '../engine/derive';
import { loadCostingConfigV1 } from '../engine/config';
import type { CostInputsV1, SiteInputsV1 } from '../engine/types';
import { calculateConfiguredCustomerPriceV1 } from '../configuredCustomerPrice';
import { buildCommercialOverheadV5 } from './simpleRangePricing';

function site(): SiteInputsV1 {
  const inputs = structuredClone(COSTING_CONTROL_PREVIEW_SCENARIOS_V1[0].inputs);
  inputs.pergolas[0].modules[0].projection_m = 2.8;
  return inputs;
}

function historicalConfig(version = 'v2.10') {
  const config = loadCostingConfigV1();
  return applyCostingControlConfigV1(config, { ...snapshotCostingControlConfigV1(config), baseManifestVersion: version });
}

function withModule(overrides: Partial<CostInputsV1>): SiteInputsV1 {
  const inputs = site();
  Object.assign(inputs.pergolas[0].modules[0], overrides);
  return inputs;
}

describe('v2.11 short-projection startup policy', () => {
  it.each([0.1, 2.4, 2.8, 2.999999, 3])('reduces startup once up to and including 3 m (%s m)', (projection_m) => {
    const result = buildCommercialOverheadV5(loadCostingConfigV1(), withModule({ projection_m }), 8, 'simple');
    expect(result).toEqual({ method: 'unified_commercial_v5', ops_ex_gst: 1000, sales_ex_gst: 0, total_ex_gst: 1000 });
  });

  it.each([0, 3, 4.999, 5])('includes effective pitch %s at the exact 3 m boundary', (roof_pitch_deg) => {
    expect(buildCommercialOverheadV5(loadCostingConfigV1(), withModule({ projection_m: 3, roof_pitch_deg }), 8, 'simple').ops_ex_gst).toBe(1000);
  });

  it.each([
    { projection_m: 3.000001 }, { projection_m: 3.001 }, { projection_m: 0 }, { projection_m: -1 },
    { projection_m: NaN }, { projection_m: Infinity }, { projection_m: undefined },
    { projection_m: 2.8, roof_span_m: 3.000001 }, { projection_m: 2.8, roof_span_m: 3.2 },
    { pergola_style: 'gable' }, { pergola_style: 'hip' }, { pergola_style: 'box_perimeter' },
    { box_perimeter_enabled: true },
    { roof_pitch_deg: 5.000001 }, { roof_pitch_deg: 5.001 }, { roof_pitch_deg: 25 },
  ] satisfies Partial<CostInputsV1>[])('retains full startup for a nonqualifying module %j', (overrides) => {
    expect(buildCommercialOverheadV5(loadCostingConfigV1(), withModule(overrides), 8, 'simple').ops_ex_gst).toBe(1500);
  });

  it('uses the same positive span alias precedence as costing, without a missing-input default', () => {
    for (const overrides of [
      { projection_m: 4, roof_span_m: 2.8 }, { projection_m: 4, roof_span_m: 3 }, { projection_m: 2.8, roof_span_m: 0 },
      { projection_m: 2.8, roof_span_m: NaN },
    ]) expect(buildCommercialOverheadV5(loadCostingConfigV1(), withModule(overrides), 8, 'simple').ops_ex_gst).toBe(1000);
  });

  it('requires every module of every pergola and grants only one reduction for a qualifying job', () => {
    const inputs = site();
    const module = inputs.pergolas[0].modules[0];
    inputs.pergolas[0].modules.push({ ...module, projection_m: 2.4, roof_pitch_deg: 0 });
    inputs.pergolas.push({ id: 'p2', modules: [{ ...module, projection_m: 3, roof_pitch_deg: 3 }] });
    expect(buildCommercialOverheadV5(loadCostingConfigV1(), inputs, 8, 'simple').ops_ex_gst).toBe(1000);
    inputs.pergolas[1].modules[0].projection_m = 3.000001;
    expect(buildCommercialOverheadV5(loadCostingConfigV1(), inputs, 8, 'simple').ops_ex_gst).toBe(1500);
    inputs.pergolas[1].modules[0].projection_m = 3;
    inputs.pergolas[0].modules[1].roof_pitch_deg = 5.001;
    expect(buildCommercialOverheadV5(loadCostingConfigV1(), inputs, 8, 'simple').ops_ex_gst).toBe(1500);
    inputs.pergolas[0].modules[1].roof_pitch_deg = 5;
    inputs.pergolas[0].modules[1].pergola_style = 'gable';
    expect(buildCommercialOverheadV5(loadCostingConfigV1(), inputs, 8, 'simple').ops_ex_gst).toBe(1500);
  });

  it('uses the canonical explicit or configured pitch, including open roofs that resolve to zero', () => {
    const config = structuredClone(loadCostingConfigV1());
    config.rules.geometry.roof_pitch_defaults_deg.pitched = 7;
    for (const [overrides, pitchUsed, overhead] of [
      [{ roof_pitch_deg: undefined }, 7, 1500],
      [{ roof_pitch_deg: 5 }, 5, 1000],
      [{ roof_pitch_deg: 4.999 }, 4.999, 1000],
      [{ roof_pitch_deg: 5.001 }, 5.001, 1500],
      [{ roof_material: 'none', roof_pitch_deg: 5 }, 0, 1000],
    ] as const) {
      const inputs = withModule(overrides);
      expect(normalizeAndDeriveV1(inputs.pergolas[0].modules[0], config).derived.roof_pitch_deg_used).toBe(pitchUsed);
      expect(buildCommercialOverheadV5(config, inputs, 8, 'simple').ops_ex_gst).toBe(overhead);
    }
    const defaultInputs = site();
    config.rules.geometry.roof_pitch_defaults_deg.pitched = 3;
    expect(normalizeAndDeriveV1(defaultInputs.pergolas[0].modules[0], config).derived.roof_pitch_deg_used).toBe(3);
    expect(buildCommercialOverheadV5(config, defaultInputs, 8, 'simple').ops_ex_gst).toBe(1000);
    const standardConfig = loadCostingConfigV1();
    expect(normalizeAndDeriveV1(defaultInputs.pergolas[0].modules[0], standardConfig).derived.roof_pitch_deg_used).toBe(5);
    expect(buildCommercialOverheadV5(standardConfig, defaultInputs, 8, 'simple').ops_ex_gst).toBe(1000);
  });

  it.each([{ pergolas: [] }, { pergolas: [{ modules: [] }] }])('does not qualify empty pergola or module scopes', ({ pergolas }) => {
    expect(buildCommercialOverheadV5(loadCostingConfigV1(), { ...site(), pergolas }, 8, 'simple').ops_ex_gst).toBe(1500);
  });

  it('retains the configured base allowance and caps its reduction at zero', () => {
    for (const [startup, expected] of [[1200, 700], [500, 0], [250, 0], [0, 0]]) {
      const config = structuredClone(loadCostingConfigV1());
      config.commercialPolicy.operational_overhead.startup_per_job_ex_gst = startup;
      expect(buildCommercialOverheadV5(config, site(), 0, 'simple').ops_ex_gst).toBe(expected);
    }
  });

  it('keeps actual material, labour, variable overhead, design, approvals and installer floor unchanged', () => {
    const inputs = withModule({ roof_material: 'timber', extrusion_colour: 'White', access: 'hard' });
    inputs.pricing_classification = 'bespoke';
    inputs.approval_requirement = 'engineering_required';
    const before = calculateSiteCostV1(inputs, historicalConfig());
    const after = calculateSiteCostV1(inputs, loadCostingConfigV1());
    expect(after.materials).toEqual(before.materials);
    expect(after.install).toEqual(before.install);
    expect(after.customer_add_ons).toEqual(before.customer_add_ons);
    expect(after.overhead.sales_ex_gst).toBe(before.overhead.sales_ex_gst);
    expect(after.overhead.ops_ex_gst).toBe(before.overhead.ops_ex_gst - 500);
    expect(after.totals.cost_ex_gst).toBeCloseTo(before.totals.cost_ex_gst - 500, 2);

    const request = { site: site(), footprintM2: 16.8, level: 'ground' as const, roofStyle: 'pitched' as const };
    const oldOffer = calculateConfiguredCustomerPriceV1({ ...request, config: historicalConfig() });
    const newOffer = calculateConfiguredCustomerPriceV1({ ...request, config: loadCostingConfigV1() });
    expect(newOffer.installerTopUpExGst).toBe(oldOffer.installerTopUpExGst);
    expect(newOffer.protectedInstallationExGst).toBe(oldOffer.protectedInstallationExGst);
    expect(oldOffer.price.incGst - newOffer.price.incGst).toBeCloseTo(747.5, 2);
  });

  it('shows the short-projection change in the admin publication impact review', () => {
    const impact = previewCostingControlImpactV1(historicalConfig(), loadCostingConfigV1())
      .find((row) => row.id === 'short-projection-pitched-acrylic');
    expect(impact).toMatchObject({ deltaExGst: -500 });
    expect(impact!.afterOverheadExGst - impact!.beforeOverheadExGst).toBe(-500);
    expect(impact!.afterMaterialsExGst).toBe(impact!.beforeMaterialsExGst);
    expect(impact!.afterInstallExGst).toBe(impact!.beforeInstallExGst);
    expect(impact!.afterCustomerPriceIncGst! - impact!.beforeCustomerPriceIncGst!).toBeCloseTo(-747.5, 2);
    const boundary = previewCostingControlImpactV1(historicalConfig(), loadCostingConfigV1())
      .find((row) => row.id === 'standard-pitched-acrylic');
    expect(boundary?.deltaExGst).toBe(-500);
  });

  // Captured against unmodified origin/main 7654633d before the v2.11 change.
  const historicalCases = [
    ['qualifying', site(), '265902ecb0fadbbb2a482bed7564789cbdbbc9614b5757bee8486d4196ac3a6f'],
    ['exact-3m', { ...site(), pergolas: [{ id: 'p1', modules: [{ ...site().pergolas[0].modules[0], projection_m: 3 }] }] }, '24364986841badaf2cb30cc686c0773117bb98a3ce7e1c0cccc0cca627abe93f'],
    ['mixed', { ...site(), pergolas: [site().pergolas[0], { id: 'p2', modules: [{ ...site().pergolas[0].modules[0], projection_m: 3.5 }] }] }, 'e866ac7aba9be34fe68a9a01102f1e59e244de7a1d7642dab0559c25e57ceb09'],
    ['all-qualifying', { ...site(), pergolas: [site().pergolas[0], { id: 'p2', modules: [{ ...site().pergolas[0].modules[0], projection_m: 2.4 }] }] }, 'c52e489bcc1745e71120e907208b8d91d3d699b094eee4ccfe99f47e606eabdb'],
    ['bespoke', { ...site(), pricing_classification: 'bespoke' }, '8be3e994a26e9e695977011c4d9ad073dcdbf6904691842bd3314111aea0e111'],
    ['roof-span-priority', { ...site(), pergolas: [{ id: 'p1', modules: [{ ...site().pergolas[0].modules[0], roof_span_m: 3.2 }] }] }, '8a7ec68789f67ba1bc69299209fb7db5260a8dd44db0e1a7569b587f06c3b800'],
  ] as const;

  it.each(historicalCases)('preserves the complete v2.10 historical output for %s', (_name, inputs, hash) => {
    const output = calculateSiteCostV1(inputs as SiteInputsV1, historicalConfig());
    expect(createHash('sha256').update(JSON.stringify(output)).digest('hex')).toBe(hash);
  });
});
