import { describe, expect, it } from 'vitest';
import { ACCESSORY_REVIEW_RATES, applyCostingControlConfigV1, getDefaultInstalledSellingRates, loadCostingConfigV1, snapshotCostingControlConfigV1 } from '@sp/costing';
import { hashCostingControlConfigV1 } from '@sp/costing/server';
import { hashCalculationValue } from './calculationRefCodec.server';
import { calculateFrozenConfiguratorPrice } from './configuratorPricing.server';
import { calculateConfiguratorPricing } from './configuratorReviewPrice';
import { configuratorAccessoryReview } from './configuratorAccessoryReview';
import type { PreviewDraft } from '../components/configurator-prototype/previewDraft.types';

function configuration(version: 'v2.8' | 'v2.9' | 'v2.10') {
  const base = loadCostingConfigV1(), control = snapshotCostingControlConfigV1(base);
  control.baseManifestVersion = version;
  control.accessoryRates = structuredClone(ACCESSORY_REVIEW_RATES);
  control.installedSellingRates = getDefaultInstalledSellingRates();
  return { config: applyCostingControlConfigV1(base, control), provenance: {
    schemaVersion: 'costing-provenance.v1' as const, source: 'published' as const,
    versionId: '11111111-1111-4111-8111-111111111111', versionNumber: 12,
    contentHash: hashCostingControlConfigV1(control), baseManifestVersion: version,
  } };
}
function design(family: 'mono' | 'gable' | 'box', material: 'acrylic' | 'solid' | 'combination' = 'acrylic'): PreviewDraft {
  return { version: 1, input: { widthMm: 6000, projectionMm: 3000, connection: 'facade', level: 'ground' },
    roof: { family, orientation: 'parallel', infills: true,
      finish: { material, layout: 'central', acrylicBays: 2, profile: 'corrugated', trayWidth: 400, ceiling: 'thermopine-100' } } };
}
describe('versioned website Standard policy', () => {
  it.each(['v2.8', 'v2.9'] as const)('reproduces the complete pre-correction frozen %s result', version => {
    const hashes = (['mono', 'gable', 'box'] as const).map(family => {
      const frozen = calculateFrozenConfiguratorPrice(design(family), configuration(version));
      expect(frozen).not.toBeNull();
      return hashCalculationValue(frozen);
    });
    expect(hashes).toMatchSnapshot();
  });
  it.each(['mono', 'gable', 'box'] as const)('uses Standard while retaining actual materials and selected accessories for %s', family => {
    for (const material of ['acrylic', 'solid', 'combination'] as const) {
      const input = design(family, material);
      const historical = calculateFrozenConfiguratorPrice(input, configuration('v2.9'))!;
      const current = calculateFrozenConfiguratorPrice(input, configuration('v2.10'))!;
      expect(current).not.toBeNull();
      expect(current.siteInputs.pricing_classification).toBe('simple');
      expect(current.base.siteOutput.pricing_policy?.resolved_classification).toBe('simple');
      expect(current.siteInputs.pergolas).toEqual(historical.siteInputs.pergolas);
      expect(current.base.siteOutput.materials).toEqual(historical.base.siteOutput.materials);
      expect(current.customerPrice.breakdown.slice(1).map(line => line.label)).toEqual(historical.customerPrice.breakdown.slice(1).map(line => line.label));
      const accessories = configuratorAccessoryReview(current.design, current.siteInputs, configuration('v2.10').config);
      expect(current.customerPrice.breakdown.slice(1)).toEqual(accessories.lines.map(line => ({ label: line.label, amountIncGst: line.amount })));
      if (family === 'gable') expect(current.customerPrice.breakdown[1].amountIncGst).toBeGreaterThan(0);
      expect(current.base.protectedInstallationExGst).toBeGreaterThanOrEqual(current.base.siteOutput.install.totals.install_ex_gst);
    }
  });
  it.each([['ground', 6000, 5000], ['elevated', 5000, 4000]] as const)('includes the exact %s boundary and withholds prices above it', (level, widthMm, projectionMm) => {
    for (const family of ['mono', 'gable', 'box'] as const) {
      const input = design(family);
      input.input = { ...input.input, level, widthMm, projectionMm };
      const result = calculateConfiguratorPricing(input, configuration('v2.10').config);
      expect(result.estimate.status).toBe('priced');
      expect(result.siteInputs?.pricing_classification).toBe('simple');
      input.input.widthMm++;
      expect(calculateConfiguratorPricing(input, configuration('v2.10').config).estimate.status).toBe('custom');
    }
  });
});
