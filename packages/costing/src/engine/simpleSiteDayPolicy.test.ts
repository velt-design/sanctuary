import { describe, expect, it } from 'vitest';
import { applyCostingControlConfigV1, snapshotCostingControlConfigV1 } from '../controlConfig';
import { loadCostingConfigV1 } from './config';
import {
  isProductiveSimpleSiteDayPolicyEnabled,
  productiveCrewHoursFromInstallActions,
} from './simpleSiteDayPolicy';

describe('Simple site-day policy', () => {
  it('excludes mobilisation when measuring productive installation work', () => {
    expect(productiveCrewHoursFromInstallActions([
      { category: 'Mobilisation', minutes: 180 },
      { category: 'Demobilisation', minutes: 60 },
      { category: 'Structure', minutes: 360 },
      { category: 'Roofing', minutes: 90 },
    ])).toBe(7.5);
  });

  it('activates only for Simple calculations on manifest v2.1 or later', () => {
    const active = loadCostingConfigV1();
    const simplePolicy = {
      requested_classification: 'simple' as const,
      resolved_classification: 'simple' as const,
      simple_eligible: true,
      reason_codes: [],
      customer_price_uplift_pct: 10,
    };
    expect(isProductiveSimpleSiteDayPolicyEnabled(active, simplePolicy)).toBe(true);
    expect(isProductiveSimpleSiteDayPolicyEnabled(active, {
      ...simplePolicy,
      resolved_classification: 'bespoke',
    })).toBe(false);

    const control = snapshotCostingControlConfigV1(active);
    control.baseManifestVersion = 'v2.0';
    const historical = applyCostingControlConfigV1(active, control);
    expect(isProductiveSimpleSiteDayPolicyEnabled(historical, simplePolicy)).toBe(false);
  });
});
