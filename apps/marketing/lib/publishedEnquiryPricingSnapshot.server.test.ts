import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyCostingControlConfigV1, loadCostingConfigV1, snapshotCostingControlConfigV1 } from '@sp/costing';
import { hashCostingControlConfigV1 } from '@sp/costing/server';

const h = vi.hoisted(() => ({
  getPublishedCostingConfiguration: vi.fn(),
  getPublishedCostingConfigurationByProvenance: vi.fn(),
}));

vi.mock('./publishedCostingConfiguration.server', () => ({
  getPublishedCostingConfiguration: h.getPublishedCostingConfiguration,
  getPublishedCostingConfigurationByProvenance: h.getPublishedCostingConfigurationByProvenance,
}));

function resolvedConfiguration() {
  const base = loadCostingConfigV1();
  const control = snapshotCostingControlConfigV1(base);
  return {
    config: applyCostingControlConfigV1(base, control),
    provenance: {
      schemaVersion: 'costing-provenance.v1' as const,
      source: 'published' as const,
      versionId: '11111111-1111-4111-8111-111111111111',
      versionNumber: 12,
      contentHash: hashCostingControlConfigV1(control),
      baseManifestVersion: control.baseManifestVersion,
    },
  };
}

const enquiryParams = {
  enquiryType: 'residential',
  name: 'Test Customer',
  suburb: 'Auckland',
  widthM: 1,
  depthM: 1,
  heightM: 9,
  style: 'gable',
  roofMaterials: ['timber'],
  addOns: {},
};

describe('published enquiry pricing continuity', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-calculation-ref-secret');
    h.getPublishedCostingConfiguration.mockReset();
    h.getPublishedCostingConfigurationByProvenance.mockReset();
    h.getPublishedCostingConfiguration.mockResolvedValue(resolvedConfiguration());
    h.getPublishedCostingConfigurationByProvenance.mockResolvedValue(resolvedConfiguration());
  });

  it('recomputes and verifies the exact historical frozen result before making its input authoritative', async () => {
    const resolved = resolvedConfiguration();
    const { calculateFrozenSimpleCoverPricingWithConfiguration } = await import('./simpleCoverPricing.server');
    const { issueSimpleCoverCalculationRef } = await import('./simpleCoverCalculationRef.server');
    const frozen = calculateFrozenSimpleCoverPricingWithConfiguration(
      {
        widthMm: 6_000,
        projectionMm: 3_000,
        level: 'elevated',
        connection: 'soffit',
      },
      resolved,
    );
    const calculationRef = issueSimpleCoverCalculationRef(frozen);
    const { buildPublishedEnquiryPricingSnapshot } = await import('./publishedEnquiryPricingSnapshot.server');

    const snapshot = await buildPublishedEnquiryPricingSnapshot(enquiryParams, {
      calculationRef,
    });

    expect(h.getPublishedCostingConfigurationByProvenance).toHaveBeenCalledWith(frozen.costingConfiguration);
    expect(h.getPublishedCostingConfiguration).not.toHaveBeenCalled();
    expect(snapshot.pricingSource).toBe('simple_cover_calculator_verified');
    expect(snapshot.verifiedSimpleCover).toMatchObject({
      input: frozen.input,
      widthM: 6,
      depthM: 3,
      level: 'elevated',
      connection: 'soffit',
      displayedEstimateIncGst: frozen.customerPrice.displayedFromIncGst,
    });
    expect(snapshot.costInputs).toEqual(frozen.siteInputs);
    expect(snapshot.costResult).toEqual(frozen.siteOutput);
    expect(snapshot.costingConfiguration).toEqual(frozen.costingConfiguration);
    expect(snapshot.budgets.baseRange).toEqual({
      lowIncGst: frozen.customerPrice.displayedFromIncGst,
      highIncGst: frozen.customerPrice.displayedFromIncGst,
    });
    expect(snapshot.calculatorInputs).toMatchObject({
      height: 'two_storey',
      modules: [
        expect.objectContaining({
          lengthM: '6',
          projectionM: '3',
          houseConnectionType: 'soffit',
        }),
      ],
      frozenSimpleCoverSiteInputs: frozen.siteInputs,
    });
  });

  it('fails closed to an unpriced snapshot when historical resolution or hash verification fails', async () => {
    const resolved = resolvedConfiguration();
    const { calculateFrozenSimpleCoverPricingWithConfiguration } = await import('./simpleCoverPricing.server');
    const { issueSimpleCoverCalculationRef } = await import('./simpleCoverCalculationRef.server');
    const frozen = calculateFrozenSimpleCoverPricingWithConfiguration(
      {
        widthMm: 5_000,
        projectionMm: 3_000,
        level: 'ground',
        connection: 'facade',
      },
      resolved,
    );
    const calculationRef = issueSimpleCoverCalculationRef(frozen);
    h.getPublishedCostingConfigurationByProvenance.mockRejectedValueOnce(new Error('mismatch'));
    const { buildPublishedEnquiryPricingSnapshot } = await import('./publishedEnquiryPricingSnapshot.server');

    const snapshot = await buildPublishedEnquiryPricingSnapshot(enquiryParams, {
      calculationRef,
    });

    expect(snapshot.pricingSource).toBe('simple_cover_unpriced');
    expect(snapshot.verifiedSimpleCover).toBeNull();
    expect(snapshot.costResult).toBeNull();
    expect(snapshot.budgets.baseRange).toBeNull();
    expect(h.getPublishedCostingConfiguration).not.toHaveBeenCalled();
  });

  it('suppresses generic pricing for a Simple calculator state without a valid reference', async () => {
    const { buildPublishedEnquiryPricingSnapshot } = await import('./publishedEnquiryPricingSnapshot.server');
    const snapshot = await buildPublishedEnquiryPricingSnapshot(enquiryParams, {
      calculationRef: 'malformed',
      suppressGenericPricing: true,
    });

    expect(snapshot.pricingSource).toBe('simple_cover_unpriced');
    expect(snapshot.budgets).toEqual({
      baseRange: null,
      blindsRange: null,
      budgetBasis: null,
    });
    expect(h.getPublishedCostingConfiguration).not.toHaveBeenCalled();
  });
});
