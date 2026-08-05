import { describe, expect, it } from 'vitest';
import {
  applyCostingControlConfigV1,
  calculateCostV1,
  loadCostingConfigV1,
  snapshotCostingControlConfigV1,
} from '@sp/costing';
import { buildEnquiryPricingSnapshot } from './enquiryPricingSnapshot';

const params = {
  enquiryType: 'residential',
  name: 'Test Customer',
  suburb: 'Auckland',
  widthM: 6,
  depthM: 3,
  heightM: 2.4,
  style: 'pitched',
  roofMaterials: ['acrylic'],
  addOns: {},
};

function resolvedFor(baseManifestVersion: 'v1.8' | 'v1.9') {
  const base = loadCostingConfigV1();
  const control = snapshotCostingControlConfigV1(base);
  control.baseManifestVersion = baseManifestVersion;
  return {
    config: applyCostingControlConfigV1(base, control),
    provenance: {
      schemaVersion: 'costing-provenance.v1' as const,
      source: 'published' as const,
      versionId: 'version-1',
      versionNumber: 1,
      contentHash: 'a'.repeat(64),
      baseManifestVersion,
    },
  };
}

describe('enquiry pricing version rollout', () => {
  it('keeps the live v1.8 autoresponder calculation byte-for-byte on module costing', () => {
    const resolved = resolvedFor('v1.8');
    const snapshot = buildEnquiryPricingSnapshot(params, resolved);
    const module = snapshot.costInputs?.pergolas[0]?.modules[0];
    expect(module).toBeDefined();
    expect(snapshot.costResult).toEqual(calculateCostV1(module!, resolved.config));
    expect(snapshot.calculatorInputs).toMatchObject({
      pricingClassification: 'simple',
      approvalRequirement: 'neither',
    });
  });

  it('uses the shared site policy after v1.9 is published', () => {
    const snapshot = buildEnquiryPricingSnapshot(params, resolvedFor('v1.9'));
    expect(snapshot.costResult).toMatchObject({
      pricing_policy: { requested_classification: 'simple', resolved_classification: 'simple' },
    });
  });
});
