import { describe, expect, it } from 'vitest';
import { calculateCostV1 } from './engine/calculate';
import { loadCostingConfigV1 } from './engine/config';
import {
  applyCostingControlConfigV1,
  COSTING_CONTROL_PREVIEW_SCENARIOS_V1,
  diffCostingControlConfigsV1,
  previewCostingControlImpactV1,
  previewCostingControlSiteImpactV1,
  snapshotCostingControlConfigV1,
  validateCostingControlConfigV1,
} from './controlConfig';

describe('costing control configuration', () => {
  it('round-trips the active package configuration without changing costing', () => {
    const base = loadCostingConfigV1();
    const snapshot = snapshotCostingControlConfigV1(base);
    const applied = applyCostingControlConfigV1(base, snapshot);

    expect(snapshotCostingControlConfigV1(applied)).toEqual(snapshot);
    expect(previewCostingControlImpactV1(base, applied)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          deltaExGst: 0,
          deltaPercent: 0,
          customerPriceDeltaPercent: 0,
        }),
      ]),
    );
  });

  it('shows customer-price movement when a manifest changes Simple sell policy', () => {
    const active = loadCostingConfigV1();
    const historicalControl = snapshotCostingControlConfigV1(active);
    historicalControl.baseManifestVersion = 'v2.0';
    const historical = applyCostingControlConfigV1(active, historicalControl);
    const impact = previewCostingControlImpactV1(historical, active)
      .find((row) => row.id === 'standard-pitched-acrylic');

    expect(impact?.beforeCustomerPriceIncGst).toBeGreaterThan(0);
    expect(impact?.afterCustomerPriceIncGst).toBeGreaterThan(0);
    expect(impact?.customerPriceDeltaPercent).not.toBeNull();
  });

  it('keeps v1.7 published action minutes compatible with the latest package base', () => {
    const base = loadCostingConfigV1();
    const historical = snapshotCostingControlConfigV1(base);
    historical.baseManifestVersion = 'v1.7';
    historical.labour.actionBaseMinutes['infill.setup_setout_each'] = 16.8;

    const validation = validateCostingControlConfigV1(historical, base);
    expect(validation.ok).toBe(true);

    const applied = applyCostingControlConfigV1(base, historical);
    expect(applied.manifest.version).toBe('v2.4');
    expect(applied.appliedControlManifestVersion).toBe('v1.7');
    expect(
      applied.installActions.actions.find((action) => action.id === 'infill.setup_setout_each')?.base_minutes,
    ).toBe(16.8);
  });

  it('keeps the published v2.2 rafter curve reproducible after the v2.4 upgrade', () => {
    const base = loadCostingConfigV1();
    const historical = snapshotCostingControlConfigV1(base);
    historical.baseManifestVersion = 'v2.2';
    historical.labour.rafterLengthLoadingCurve = [
      { length_m: 2, minutes_per_m: 0.5 },
      { length_m: 3, minutes_per_m: 1 },
      { length_m: 4, minutes_per_m: 3 },
      { length_m: 5, minutes_per_m: 5 },
      { length_m: 6, minutes_per_m: 6 },
    ];

    const validation = validateCostingControlConfigV1(historical, base);
    expect(validation.ok).toBe(true);
    const historicalConfig = applyCostingControlConfigV1(base, historical);
    expect(snapshotCostingControlConfigV1(base).labour.rafterLengthLoadingCurve).toEqual([
      { length_m: 2, minutes_per_m: 0.5 },
      { length_m: 3, minutes_per_m: 1 },
      { length_m: 4, minutes_per_m: 3.75 },
      { length_m: 5, minutes_per_m: 6.5 },
      { length_m: 6, minutes_per_m: 7.8 },
    ]);
    expect(snapshotCostingControlConfigV1(historicalConfig).labour.rafterLengthLoadingCurve)
      .toEqual(historical.labour.rafterLengthLoadingCurve);

    const inputs = {
      length_m: 6,
      post_cut_height_m: 2.4,
      post_count: 3,
      roof_material: 'acrylic' as const,
      extrusion_colour: 'Black' as const,
      house_connection_type: 'fascia' as const,
      post_connection_type: 'deck_bracket' as const,
      access: 'normal' as const,
      height: 'single_storey' as const,
      ground: 'easy' as const,
      pergola_style: 'pitched' as const,
    };
    const loadingMinutes = (projection_m: number, config: typeof base) =>
      calculateCostV1({ ...inputs, projection_m }, config).install.actions
        .find((action) => action.id === 'rafters.rafter_length_loading_m')?.minutes ?? 0;

    expect(loadingMinutes(3, base)).toBeCloseTo(loadingMinutes(3, historicalConfig), 2);
    expect(loadingMinutes(6, base)).toBeGreaterThan(loadingMinutes(6, historicalConfig) * 1.2);
  });

  it('rejects unknown keys and cross-field rule violations', () => {
    const base = loadCostingConfigV1();
    const snapshot = snapshotCostingControlConfigV1(base);
    const candidate = structuredClone(snapshot) as typeof snapshot & {
      materialRatesExGst: Record<string, number>;
    };
    candidate.materialRatesExGst.unsupported_material = 12;
    candidate.rules.overhangMinM = candidate.rules.overhangMaxM + 1;

    const result = validateCostingControlConfigV1(candidate, base);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'materialRatesExGst.unsupported_material',
          message: 'Unknown configured key is not supported.',
        }),
        expect.objectContaining({ path: 'rules.overhangDefaultM' }),
      ]),
    );
  });

  it('preserves package-owned action shapes', () => {
    const base = loadCostingConfigV1();
    const snapshot = snapshotCostingControlConfigV1(base);
    const byProfileId = Object.entries(snapshot.labour.actionBaseMinutes)
      .find(([, value]) => typeof value !== 'number')?.[0];
    expect(byProfileId).toBeTruthy();
    if (!byProfileId) return;

    const candidate = structuredClone(snapshot);
    candidate.labour.actionBaseMinutes[byProfileId] = 10;
    const result = validateCostingControlConfigV1(candidate, base);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: `labour.actionBaseMinutes.${byProfileId}`,
          message: 'Must preserve the package-owned by-profile action shape.',
        }),
      ]),
    );
  });

  it('reports deterministic diffs and representative-scenario impact', () => {
    const base = loadCostingConfigV1();
    const before = snapshotCostingControlConfigV1(base);
    const after = structuredClone(before);
    after.labour.crewHourRateExGst += 10;

    expect(diffCostingControlConfigsV1(before, after)).toEqual([
      {
        path: 'labour.crewHourRateExGst',
        before: before.labour.crewHourRateExGst,
        after: after.labour.crewHourRateExGst,
      },
    ]);

    const impact = previewCostingControlImpactV1(base, applyCostingControlConfigV1(base, after));
    expect(impact).toHaveLength(4);
    expect(impact.every((row) => row.afterInstallExGst >= row.beforeInstallExGst)).toBe(true);
    expect(impact.some((row) => row.deltaExGst > 0)).toBe(true);
  });

  it('previews caller-supplied site inputs through the package-owned impact calculation', () => {
    const base = loadCostingConfigV1();
    const after = snapshotCostingControlConfigV1(base);
    after.labour.crewHourRateExGst += 10;
    const scenario = COSTING_CONTROL_PREVIEW_SCENARIOS_V1[0]!;

    const impact = previewCostingControlSiteImpactV1(
      'saved-estimate',
      'Saved estimate',
      scenario.inputs,
      base,
      applyCostingControlConfigV1(base, after),
    );

    expect(impact.id).toBe('saved-estimate');
    expect(impact.label).toBe('Saved estimate');
    expect(impact.afterInstallExGst).toBeGreaterThan(impact.beforeInstallExGst);
    expect(impact.deltaExGst).toBeGreaterThan(0);
  });
});
