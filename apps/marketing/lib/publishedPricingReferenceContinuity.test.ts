import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACCESSORY_REVIEW_RATES, applyCostingControlConfigV1, calculateSiteCostV1, getDefaultInstalledSellingRates,
  loadCostingConfigV1, snapshotCostingControlConfigV1 } from '@sp/costing';
import { hashCostingControlConfigV1 } from '@sp/costing/server';
import { calculateFrozenConfiguratorPrice } from './configuratorPricing.server';
import { calculateFrozenSimpleCoverPricingWithConfiguration } from './simpleCoverPricing.server';
import { hashConfiguratorDesign, issueConfiguratorCalculationRef } from './configuratorCalculationRef.server';
import { issueSimpleCoverCalculationRef } from './simpleCoverCalculationRef.server';
import { hashCalculationValue, sealCalculationRef } from './calculationRefCodec.server';
import { buildPublishedEnquiryPricingSnapshot } from './publishedEnquiryPricingSnapshot.server';
import type { PreviewDraft } from '../components/configurator-prototype/previewDraft.types';
const lookup = vi.hoisted(() => ({ historical: vi.fn(), current: vi.fn() }));
vi.mock('./publishedCostingConfiguration.server', () => ({
  getPublishedCostingConfigurationByProvenance: lookup.historical,
  getPublishedCostingConfiguration: lookup.current,
}));

// Whole frozen-result hashes captured from public625c8501's source graph before
// operational metadata was added. Configurator could not issue offers before
// v2.4; SimpleCover supports every retained compatible manifest. Current is v2.11.
const historical = [
  { version: 'v1.7', cf1: null, sc1: '01ccdc1b7d0d51051808e2010ec72672ef27e9762368b09b762cef0e9e3fcd51' },
  { version: 'v1.8', cf1: null, sc1: 'b8c83ee098c5b41fd6d3c3848690810d466708627760ba8e4d7ed22d86a0c61a' },
  { version: 'v1.9', cf1: null, sc1: 'e06c266cf528a26f6b5e4465280d78a40043051aaed15b86a6194d025bc515a5' },
  { version: 'v2.0', cf1: null, sc1: '6c14fcb49d5a841c84bc18be373529b5f4eccf3b7461cf710ecf23da4af2d555' },
  { version: 'v2.1', cf1: null, sc1: 'a6163763adab52870ba365a8d331b9302c0f46cfc3d18134d5a00714cfea871a' },
  { version: 'v2.2', cf1: null, sc1: 'ba96ae0c7c5e4eb9c0a49b07f7eb8c11cc4196cd24acb8fe0ecd17464f1b0dd6' },
  { version: 'v2.3', cf1: null, sc1: 'bc19c1dbbab9df7a35f788d449f9bf02c3c98faa5fa0620f97ce0cf1f6a6a27f' },
  { version: 'v2.4', cf1: 'ba2c474c37bc183f783fcf69bfc070baf71185c4be664972f23f27a90a63e56e', sc1: '3839af46ffcaae4d4846ba75173aa2159e8ae1a1e1aa35e07bfc60b97d0eb52e' },
  { version: 'v2.5', cf1: 'e851a5283061740ae246f80e94475b35f93e54cca2f033ae5bdfe76c442fdecd', sc1: '7e7607d47ce753f8a1c3a714cfbb1f8f68da26f4d73061f5340985e4e11a1904' },
  { version: 'v2.6', cf1: 'c6e77b24f59c67acf68fe0e167eb19645da4cc537d40d6b1eba32fbbcc1579b3', sc1: '256495f844cdd095103cbcddf90005b9e1ca6fae5c0903e03ab43d3d112482df' },
  { version: 'v2.7', cf1: '74f6d62e48df43df4b07487f70555b3160ce838ddf70f22e01332f26aec5068f', sc1: '92014f9342166d89abb667c7cf089ded1c1be347bd8e1d3c5f2623c1a2ffce9a' },
  { version: 'v2.8', cf1: 'a6ed49f5c639ac97b099871d6fb424b03ec7b7e3bb45ac730ad14a1f49b0e44f', sc1: '1fa29ad9e2453a9eee19e0035f42e4b5e6388bd9eb6c3bff96c73d0dfac2902f' },
  { version: 'v2.9', cf1: '6146e6083212f7d6cba4f25b532bc1ab60cf56287afe49b8d39b303382ba07e8', sc1: '8c776785d2a7595627558349411a8587ea2633cab27fd95bf13513238ad0fdd8' },
  { version: 'v2.10', cf1: 'b1edf81a9f0cd7bb7161348b01187c20116bcbbef5200967a8a515faff33afe4', sc1: 'cdc196e86c7c657b16f1a119678f5e48ef4670d052d273967db798e404095cd4' },
  { version: 'v2.11', cf1: '659449c6ae9bc658e7e60435c1a33a910403c5b06ab5922a3d0b57bef63bb84d', sc1: 'bbeef43c90f6178a378c1855e124f4025482aaf0fbd372b879de94e42a957234' },
] as const;
function configuration(version: string) {
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
function design(): PreviewDraft {
  return { version: 1, input: { widthMm: 6000, projectionMm: 3000, connection: 'facade', level: 'ground' },
    roof: { family: 'mono', orientation: 'parallel', infills: true,
      finish: { material: 'acrylic', layout: 'central', acrylicBays: 2, profile: 'corrugated', trayWidth: 400, ceiling: 'thermopine-100' } } };
}
const simpleInput = { widthMm: 6000, projectionMm: 3000, level: 'elevated', connection: 'soffit' } as const;
const enquiry = { enquiryType: 'residential', name: 'Synthetic Reference Test', suburb: 'Auckland', widthM: 6, depthM: 3,
  heightM: null, style: 'pitched', roofMaterials: ['acrylic'], addOns: {} };
function oldReference(kind: 'cf1' | 'sc1', hash: string, resolved: ReturnType<typeof configuration>) {
  const configurator = kind === 'cf1';
  // Recreate the old issuer's actual signed claim using its pinned old full hash,
  // rather than deriving an alleged historical hash from today's returned shape.
  return sealCalculationRef({ schemaVersion: configurator ? 'configurator-calculation-ref.v1' : 'simple-cover-calculation-ref.v1',
    ...(configurator ? { designHash: hashConfiguratorDesign(design()) } : { input: simpleInput }),
    costingConfiguration: resolved.provenance, frozenResultHash: hash,
    issuedAt: Math.floor((Date.now() - 3 * 24 * 60 * 60 * 1000) / 1000),
  }, { prefix: kind + '.', domain: configurator ? 'sanctuary.configurator-calculation-ref.v1' : 'sanctuary.simple-cover-calculation-ref.v1', localSecret: 'unused-test-fallback' });
}
async function rejected(calculationRef: string, selectedDesign?: PreviewDraft) {
  const value = await buildPublishedEnquiryPricingSnapshot(enquiry, { calculationRef, ...(selectedDesign ? { design: selectedDesign } : {}) });
  expect(value.costResult).toBeNull();expect(value.budgets.baseRange).toBeNull();
  expect(value.verifiedConfigurator).toBeUndefined();expect(value.verifiedSimpleCover).toBeNull();
}
beforeEach(() => {
  vi.resetAllMocks();vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic-reference-continuity-test-only');
  lookup.current.mockRejectedValue(new Error('Never replace an immutable reference with current pricing'));
});
afterEach(() => { expect(lookup.current).not.toHaveBeenCalled();vi.unstubAllEnvs(); });

describe('published frozen-v1 reference continuity', () => {
  it.each(historical.filter(row => row.cf1 !== null))('verifies prior and fresh cf1 for $version against the original whole hash', async row => {
    const resolved = configuration(row.version), frozen = calculateFrozenConfiguratorPrice(design(), resolved)!;
    lookup.historical.mockResolvedValue(resolved);
    expect(hashCalculationValue(frozen)).toBe(row.cf1);
    expect(frozen.base.siteOutput).not.toHaveProperty('site_days');
    for (const calculationRef of [oldReference('cf1', row.cf1!, resolved), issueConfiguratorCalculationRef(frozen)]) {
      const value = await buildPublishedEnquiryPricingSnapshot(enquiry, { calculationRef, design: design() });
      expect(value.pricingSource).toBe('configurator_verified');
      expect(value.verifiedConfigurator).toEqual(frozen);
      expect(value.costResult).toEqual(frozen.base.siteOutput);
    }
    expect(lookup.historical).toHaveBeenCalledWith(resolved.provenance);
  });
  it.each(historical)('verifies prior and fresh sc1 for $version against the original whole hash', async row => {
    const resolved = configuration(row.version), frozen = calculateFrozenSimpleCoverPricingWithConfiguration(simpleInput, resolved);
    lookup.historical.mockResolvedValue(resolved);
    expect(hashCalculationValue(frozen)).toBe(row.sc1);
    expect(frozen.siteOutput).not.toHaveProperty('site_days');
    for (const calculationRef of [oldReference('sc1', row.sc1, resolved), issueSimpleCoverCalculationRef(frozen)]) {
      const value = await buildPublishedEnquiryPricingSnapshot(enquiry, { calculationRef });
      expect(value.pricingSource).toBe('simple_cover_calculator_verified');
      expect(value.costResult).toEqual(frozen.siteOutput);
      expect(value.costingConfiguration).toEqual(resolved.provenance);
      expect(value.verifiedSimpleCover?.displayedEstimateIncGst).toBe(frozen.customerPrice.displayedFromIncGst);
    }
    expect(lookup.historical).toHaveBeenCalledWith(resolved.provenance);
  });
  it.each(historical.filter(row => row.cf1 === null))('keeps unissuable legacy Configurator $version fail closed', async row => {
    const resolved = configuration(row.version);lookup.historical.mockResolvedValue(resolved);
    expect(() => calculateFrozenConfiguratorPrice(design(), resolved)).toThrow('current commercial overhead policy');
    await rejected(oldReference('cf1', 'a'.repeat(64), resolved), design());
  });
  it('retains the full current operational result and historic module days outside the frozen wire shape', () => {
    const resolved = configuration('v2.11'), frozen = calculateFrozenSimpleCoverPricingWithConfiguration(simpleInput, resolved);
    const full = calculateSiteCostV1(frozen.siteInputs, resolved.config);
    expect(full.site_days).toBeGreaterThan(0);
    expect(frozen.siteOutput.pergolas).toEqual(full.pergolas);
    expect(frozen.siteOutput.pergolas[0].modules[0].derived.site_days).toBeGreaterThan(0);
  });
  it('rejects an old cf1 for a same-price but different selected design', async () => {
    const row = historical.at(-1)!, resolved = configuration(row.version);lookup.historical.mockResolvedValue(resolved);
    const changed = design();changed.roof.acrylicTint = 'opal';
    expect(calculateFrozenConfiguratorPrice(changed, resolved)?.customerPrice).toEqual(calculateFrozenConfiguratorPrice(design(), resolved)?.customerPrice);
    await rejected(oldReference('cf1', row.cf1!, resolved), changed);
    expect(lookup.historical).not.toHaveBeenCalled();
  });
  it.each(['cf1', 'sc1'] as const)('rejects tampered signed %s without a current-price fallback', async kind => {
    const row = historical.at(-1)!, resolved = configuration(row.version);
    const token = oldReference(kind, row[kind]!, resolved), index = Math.floor(token.length / 2);
    const tampered = token.slice(0, index) + (token[index] === 'A' ? 'B' : 'A') + token.slice(index + 1);
    await rejected(tampered, kind === 'cf1' ? design() : undefined);
    expect(lookup.historical).not.toHaveBeenCalled();
  });
  it.each(['cf1', 'sc1'] as const)('rejects a signed %s whose non-price frozen result was altered', async kind => {
    const resolved = configuration('v2.11');lookup.historical.mockResolvedValue(resolved);
    if (kind === 'cf1') {
      const frozen = calculateFrozenConfiguratorPrice(design(), resolved)!, changed = structuredClone(frozen);
      changed.base.siteOutput.pergola_count++;
      expect(changed.customerPrice).toEqual(frozen.customerPrice);
      await rejected(issueConfiguratorCalculationRef(changed), design());
    } else {
      const frozen = calculateFrozenSimpleCoverPricingWithConfiguration(simpleInput, resolved), changed = structuredClone(frozen);
      changed.siteOutput.pergola_count++;
      expect(changed.customerPrice).toEqual(frozen.customerPrice);
      await rejected(issueSimpleCoverCalculationRef(changed));
    }
  });
  it.each(['cf1', 'sc1'] as const)('rejects a signed %s whose immutable provenance no longer matches the resolved version', async kind => {
    const resolved = configuration('v2.11');lookup.historical.mockResolvedValue(resolved);
    // Even a permissive test lookup cannot make a wrong frozen provenance hash valid.
    if (kind === 'cf1') {
      const changed = calculateFrozenConfiguratorPrice(design(), resolved)!;
      changed.costingConfiguration = { ...changed.costingConfiguration, contentHash: 'b'.repeat(64) };
      await rejected(issueConfiguratorCalculationRef(changed), design());
    } else {
      const changed = calculateFrozenSimpleCoverPricingWithConfiguration(simpleInput, resolved);
      changed.costingConfiguration = { ...changed.costingConfiguration, contentHash: 'b'.repeat(64) };
      await rejected(issueSimpleCoverCalculationRef(changed));
    }
  });
});
