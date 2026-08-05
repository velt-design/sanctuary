import { describe, expect, it } from 'vitest';
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
        expect.objectContaining({ deltaExGst: 0, deltaPercent: 0 }),
      ]),
    );
  });

  it('keeps v1.7 published action minutes compatible with the latest package base', () => {
    const base = loadCostingConfigV1();
    const historical = snapshotCostingControlConfigV1(base);
    historical.baseManifestVersion = 'v1.7';
    historical.labour.actionBaseMinutes['infill.setup_setout_each'] = 16.8;

    const validation = validateCostingControlConfigV1(historical, base);
    expect(validation.ok).toBe(true);

    const applied = applyCostingControlConfigV1(base, historical);
    expect(applied.manifest.version).toBe('v2.0');
    expect(applied.appliedControlManifestVersion).toBe('v1.7');
    expect(
      applied.installActions.actions.find((action) => action.id === 'infill.setup_setout_each')?.base_minutes,
    ).toBe(16.8);
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
