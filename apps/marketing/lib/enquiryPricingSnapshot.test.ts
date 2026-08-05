import { describe, expect, it } from 'vitest';
import {
  applyCostingControlConfigV1,
  calculateCostV1,
  loadCostingConfigV1,
  snapshotCostingControlConfigV1,
} from '@sp/costing';
import {
  buildEnquiryDraftEstimateRow,
  buildEnquiryPricingSnapshot,
} from './enquiryPricingSnapshot';
import { calculateFrozenSimpleCoverPricingWithConfiguration } from './simpleCoverPricing.server';

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

  it('persists the verified Simple calculation inputs, outputs and provenance exactly', () => {
    const resolved = resolvedFor('v1.9');
    const frozen = calculateFrozenSimpleCoverPricingWithConfiguration({
      widthMm: 6_000,
      projectionMm: 3_000,
      level: 'elevated',
      connection: 'soffit',
    }, resolved);
    const pricing = buildEnquiryPricingSnapshot(
      { ...params, widthM: 1, depthM: 1, heightM: 9, style: 'gable', roofMaterials: ['timber'] },
      resolved,
      { verifiedSimpleCover: frozen },
    );
    const row = buildEnquiryDraftEstimateRow({
      ...params,
      widthM: 1,
      depthM: 1,
      heightM: 9,
      style: 'gable',
      roofMaterials: ['timber'],
      projectId: 'project-1',
      createdBy: 'marketing_enquiry',
      email: 'test@example.test',
      phoneRaw: '0210000000',
      message: '',
      pricing,
    });

    expect(row.inputs).toMatchObject({
      height: 'two_storey',
      modules: [expect.objectContaining({
        lengthM: '6',
        projectionM: '3',
        houseConnectionType: 'soffit',
      })],
      frozenSimpleCoverSiteInputs: frozen.siteInputs,
    });
    expect(row.outputs).toMatchObject({
      totals: frozen.siteOutput.totals,
      pergolas: frozen.siteOutput.pergolas,
      frozenSimpleCoverSiteOutput: frozen.siteOutput,
      configVersions: { costingControl: frozen.costingConfiguration },
      derived: {
        pricingSource: 'simple_cover_calculator_verified',
      },
      snapshot: {
        enquiry: {
          widthM: 6,
          depthM: 3,
          heightM: null,
          style: 'pitched',
          roofMaterials: ['acrylic'],
        },
      },
    });
  });
});
