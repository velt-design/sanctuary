import { describe, expect, it } from 'vitest';
import {
  calculateCustomerPriceFromCostEx,
  calculateSiteCostV1,
  loadCostingConfigV1,
  snapshotCostingControlConfigV1,
} from '@sp/costing';
import {
  hashCostingControlConfigV1,
  resolvePublishedCostingConfigurationRecordV1,
} from '@sp/costing/server';
import { makeDefaultCalculatorInputs, makeDefaultModule } from '../apps/portal/app/staff/calculator/calculatorInputs';
import { makeDefaultFlashings } from '../apps/portal/app/staff/calculator/calculatorFlashings';
import { buildSiteInputsFromCalculatorInputs } from '../apps/portal/lib/estimates/costingPayload';
import {
  buildSimpleCoverSiteInputs,
  simpleCoverPostCount,
  type SimpleCoverInput,
} from '../apps/marketing/lib/simpleCoverCalculator';

function portalSiteInputs(input: SimpleCoverInput) {
  const values = makeDefaultCalculatorInputs();
  const module = {
    ...makeDefaultModule('pergola-1'),
    lengthM: String(input.widthMm / 1_000),
    projectionM: String(input.projectionMm / 1_000),
    postCount: String(simpleCoverPostCount(input.widthMm)),
    houseConnectionType: input.connection,
  };
  module.flashings = makeDefaultFlashings(module);
  values.height = input.level === 'ground' ? 'single_storey' : 'two_storey';
  values.modules = [module];
  return buildSiteInputsFromCalculatorInputs(values);
}

describe('Simple cover portal pricing parity', () => {
  it.each([
    { widthMm: 1_000, projectionMm: 1_000, level: 'ground' as const, connection: 'fascia' as const },
    { widthMm: 6_000, projectionMm: 3_000, level: 'ground' as const, connection: 'facade' as const },
    { widthMm: 5_000, projectionMm: 4_000, level: 'elevated' as const, connection: 'soffit' as const },
    { widthMm: 10_000, projectionMm: 3_000, level: 'ground' as const, connection: 'fascia' as const },
  ])('reproduces portal cost and customer price for $connection at $widthMm x $projectionMm', (input) => {
    const base = loadCostingConfigV1();
    const control = snapshotCostingControlConfigV1(base);
    control.labour.crewHourRateExGst = 97;
    const published = resolvePublishedCostingConfigurationRecordV1({
      id: 'published-parity-fixture',
      versionNumber: 21,
      status: 'published',
      config: control,
      contentHash: hashCostingControlConfigV1(control),
      baseManifestVersion: control.baseManifestVersion,
    });

    const publicOutput = calculateSiteCostV1(buildSimpleCoverSiteInputs(input), published.config);
    const portalOutput = calculateSiteCostV1(portalSiteInputs(input), published.config);

    expect(publicOutput.totals).toEqual(portalOutput.totals);
    expect(publicOutput.pergolas[0]?.modules[0]?.inputs_normalized)
      .toEqual(portalOutput.pergolas[0]?.modules[0]?.inputs_normalized);
    expect(calculateCustomerPriceFromCostEx(publicOutput.totals.cost_ex_gst, 0))
      .toEqual(calculateCustomerPriceFromCostEx(portalOutput.totals.cost_ex_gst, 0));

    const packageDefaultOutput = calculateSiteCostV1(buildSimpleCoverSiteInputs(input), base);
    expect(publicOutput.totals.cost_ex_gst).not.toBe(packageDefaultOutput.totals.cost_ex_gst);
  });
});
