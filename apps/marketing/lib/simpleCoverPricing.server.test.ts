import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  calculateCustomerPriceFromCostEx,
  loadCostingConfigV1,
} from '@sp/costing';
import { hashCostingControlConfigV1 } from '@sp/costing/server';
import { snapshotCostingControlConfigV1 } from '@sp/costing';

const h = vi.hoisted(() => ({
  getPublishedCostingConfiguration: vi.fn(),
}));

vi.mock('./publishedCostingConfiguration.server', () => ({
  getPublishedCostingConfiguration: h.getPublishedCostingConfiguration,
}));

describe('frozen Simple cover pricing', () => {
  beforeEach(() => {
    h.getPublishedCostingConfiguration.mockReset();
    const config = loadCostingConfigV1();
    const control = snapshotCostingControlConfigV1(config);
    h.getPublishedCostingConfiguration.mockResolvedValue({
      config,
      provenance: {
        schemaVersion: 'costing-provenance.v1',
        source: 'published',
        versionId: 'version-17',
        versionNumber: 17,
        contentHash: hashCostingControlConfigV1(control),
        baseManifestVersion: control.baseManifestVersion,
      },
    });
  });

  it('freezes inputs, engine output, exact price and configuration together', async () => {
    const { calculateFrozenSimpleCoverPricing } = await import('./simpleCoverPricing.server');
    const result = await calculateFrozenSimpleCoverPricing({ widthMm: 6_000, projectionMm: 3_000, level: 'ground' });
    const expectedPrice = calculateCustomerPriceFromCostEx(result.siteOutput.totals.cost_ex_gst, 0);

    expect(result.schemaVersion).toBe('simple-cover-pricing.v1');
    expect(result.customerPrice.exactIncGst).toBe(expectedPrice?.incGst);
    expect(result.customerPrice.displayedFromIncGst % 250).toBe(0);
    expect(result.costingConfiguration).toMatchObject({ versionId: 'version-17', versionNumber: 17 });
    expect(result.publicResult.configuration).toEqual({ versionNumber: 17 });
    expect(result.publicResult).not.toHaveProperty('siteOutput');
    expect(result.publicResult).not.toHaveProperty('customerPrice.exactIncGst');
  });

  it('returns a custom route without reading costing configuration', async () => {
    const { calculateSimpleCoverPublicResult } = await import('./simpleCoverPricing.server');
    const result = await calculateSimpleCoverPublicResult({ widthMm: 10_000, projectionMm: 3_100, level: 'ground' });

    expect(result.status).toBe('custom');
    expect(h.getPublishedCostingConfiguration).not.toHaveBeenCalled();
  });
});
