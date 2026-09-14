import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACCESSORY_REVIEW_RATES, applyCostingControlConfigV1, getDefaultInstalledSellingRates, loadCostingConfigV1, snapshotCostingControlConfigV1 } from '@sp/costing';
import { hashCostingControlConfigV1, type ResolvedPublishedCostingConfigurationV1 } from '@sp/costing/server';
import { calculateFrozenConfiguratorPrice } from './configuratorPricing.server';
import { issueConfiguratorCalculationRef, readConfiguratorCalculationRef } from './configuratorCalculationRef.server';
import { readSimpleCoverCalculationRef } from './simpleCoverCalculationRef.server';
import { buildPublishedEnquiryPricingSnapshot } from './publishedEnquiryPricingSnapshot.server';
import { buildEnquiryDraftEstimateRow, type EnquiryPricingParams } from './enquiryPricingSnapshot';
import { POST } from '../app/api/configurator-price/route';
import { POST as reviewPOST } from '../app/api/configurator-review-price/route';
import type { PreviewDraft } from '../components/configurator-prototype/previewDraft.types';
import { defaultBlind } from '../components/configurator-prototype/blindCatalog';
import { previewBlindOpenings } from '../components/configurator-prototype/blindSelection';

const mocks = vi.hoisted(() => ({ current: vi.fn(), historical: vi.fn() }));
vi.mock('./publishedCostingConfiguration.server', () => ({ getPublishedCostingConfiguration: mocks.current, getPublishedCostingConfigurationByProvenance: mocks.historical }));
const versionId = '11111111-1111-4111-8111-111111111111';
const draft = (): PreviewDraft => ({ version: 1, input: { widthMm: 5000, projectionMm: 3000, connection: 'facade', level: 'ground' }, roof: { family: 'mono', orientation: 'parallel', infills: false } });
function resolved(): ResolvedPublishedCostingConfigurationV1 {
  const base = loadCostingConfigV1(), control = snapshotCostingControlConfigV1(base);
  control.accessoryRates = structuredClone(ACCESSORY_REVIEW_RATES);
  control.installedSellingRates = getDefaultInstalledSellingRates();
  return { config: applyCostingControlConfigV1(base, control), provenance: { schemaVersion: 'costing-provenance.v1', source: 'published',
    versionId, versionNumber: 12, contentHash: hashCostingControlConfigV1(control), baseManifestVersion: control.baseManifestVersion } };
}
function request(body: unknown) { return new Request('http://localhost:3062/api/configurator-price', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3062' }, body: JSON.stringify(body) }); }
const params: EnquiryPricingParams = { enquiryType: 'residential', name: 'Test', suburb: 'Auckland', widthM: 5, depthM: 3, heightM: null, style: 'pitched', roofMaterials: ['acrylic'], addOns: {} };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('WEBSITE_CONFIGURATOR_APPROVED_VERSION_ID', versionId);
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-only-calculation-secret');
  mocks.current.mockResolvedValue(resolved()); mocks.historical.mockResolvedValue(resolved());
});
afterEach(() => vi.unstubAllEnvs());

describe('approved configurator pricing endpoint', () => {
  it('does not expose draft review prices in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const response = await reviewPOST(request(draft()));
    expect(response.status).toBe(404);
    expect(await response.text()).toBe('');
    expect(mocks.current).not.toHaveBeenCalled();
  });
  it('rejects foreign origins, non-JSON and oversized requests before reading the pricebook', async () => {
    const foreign = request(draft()); foreign.headers.set('Origin', 'https://untrusted.example');
    expect((await POST(foreign)).status).toBe(403);
    const text = request(draft()); text.headers.set('Content-Type', 'text/plain');
    expect((await POST(text)).status).toBe(415);
    expect((await POST(request({ ...draft(), extra: 'x'.repeat(16000) }))).status).toBe(422);
    expect(mocks.current).not.toHaveBeenCalled();
  });
  it('is dark by default and does not query a pricebook', async () => {
    vi.stubEnv('WEBSITE_CONFIGURATOR_APPROVED_VERSION_ID', '');
    expect(await (await POST(request(draft()))).json()).toEqual({ status: 'disabled' });
    expect(mocks.current).not.toHaveBeenCalled();
  });
  it.each(['mono', 'gable', 'box'] as const)('returns only a complete customer selling projection for %s', async family => {
    const design = draft(); design.roof.family = family;
    const response = await POST(request(design)), body = await response.json();
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body.status).toBe('priced'); expect(body.includesGst).toBe(true);
    expect(body.amountIncGst).toBe(body.breakdown.reduce((n: number, line: { amountIncGst: number }) => n + line.amountIncGst, 0));
    expect(Object.keys(body).sort()).toEqual(['amountIncGst','breakdown','calculationRef','currency','includesGst','status','versionNumber'].sort());
    expect(JSON.stringify(body)).not.toMatch(/costExGst|installerTopUp|costingConfiguration|provisional|supply|multiplier|detail/);
    expect(readConfiguratorCalculationRef(body.calculationRef)).not.toBeNull();
    expect(readSimpleCoverCalculationRef(body.calculationRef)).toBeNull();
  });
  it.each([['ground', 7500, 4000], ['elevated', 5000, 4000]] as const)('prices the exact %s area limit and withholds larger designs', async (level, widthMm, projectionMm) => {
    const design = draft(); design.input = { ...design.input, level, widthMm, projectionMm };
    expect((await (await POST(request(design))).json()).status).toBe('priced');
    design.input.widthMm += 100;
    const body = await (await POST(request(design))).json();
    expect(body.status).toBe('custom'); expect(body).not.toHaveProperty('amountIncGst');
  });
  it('never substitutes another version or review rates when publication is unavailable', async () => {
    const other = resolved(); other.provenance.versionId = 'other-version'; mocks.current.mockResolvedValue(other);
    expect((await POST(request(draft()))).status).toBe(503);
    mocks.current.mockRejectedValue(new Error('private database detail'));
    const body = await (await POST(request(draft()))).json();
    expect(body).toEqual({ status: 'unavailable' });
  });
  it('withholds the whole estimate for absent schedules, specialty fabrics or an unsupported steel rate', async () => {
    const missing = resolved(); delete missing.config.accessoryRates; mocks.current.mockResolvedValue(missing);
    expect((await (await POST(request(draft()))).json()).status).toBe('custom');
    mocks.current.mockResolvedValue(resolved());
    const design = draft(), opening = previewBlindOpenings(design.input, design.roof)[0];
    design.roof.blinds = [{ ...defaultBlind(opening.id), fabric: 'horizon', colour: 'Pepper' }];
    const specialty = await (await POST(request(design))).json();
    expect(specialty.status).toBe('custom'); expect(specialty).not.toHaveProperty('breakdown');
    design.roof.blinds = [];
    design.roof.finish = { material: 'solid', layout: 'central', acrylicBays: 2, profile: 'trapezoidal', trayWidth: 400, ceiling: 'thermopine-150' };
    expect((await (await POST(request(design))).json()).status).toBe('custom');
  });
});

describe('submitted configured estimate continuity', () => {
  it('uses the original version and freezes the exact full design, selling breakdown and policy adjustments', async () => {
    const design = draft(); design.roof.family = 'gable';
    design.roof.blinds = [defaultBlind(previewBlindOpenings(design.input, design.roof)[0].id)];
    const original = calculateFrozenConfiguratorPrice(design, resolved())!;
    expect(original).not.toBeNull();
    const calculationRef = issueConfiguratorCalculationRef(original);
    mocks.current.mockRejectedValue(new Error('current publication deliberately unavailable'));
    const pricing = await buildPublishedEnquiryPricingSnapshot(params, { design, calculationRef, suppressGenericPricing: true });
    expect(pricing.pricingSource).toBe('configurator_verified');
    expect(pricing.verifiedConfigurator).toEqual(original);
    expect(pricing.budgets.baseRange).toEqual({ lowIncGst: original.customerPrice.amountIncGst, highIncGst: original.customerPrice.amountIncGst });
    expect(pricing.budgets.blindsRange).toBeNull();
    expect(mocks.current).not.toHaveBeenCalled();
    const row = buildEnquiryDraftEstimateRow({ ...params, widthM: 9, depthM: 6, heightM: 5, roofMaterials: ['timber'], projectId: null, createdBy: 'test', email: 'test@example.com', phoneRaw: '123', message: '', pricing });
    expect(row.outputs).toMatchObject({ warnings: expect.arrayContaining([expect.stringContaining('Review the site before issuing a quote')]),
      snapshot: { enquiry: { widthM: 5, depthM: 3, heightM: null, style: 'gable', roofMaterials: ['acrylic'] } } });
    expect(JSON.stringify(row)).toContain('frozenConfiguratorPrice');
    expect(JSON.stringify(row)).toContain('installerTopUpExGst');
    expect(JSON.stringify(row)).toContain('Ziptrak');
    expect((row.outputs as any).snapshot.configuredQuoteInputs).toEqual(row.inputs);
    const submitted = JSON.stringify(row);
    design.input.widthMm = 7000;
    expect(JSON.stringify(row)).toBe(submitted);
  });
  it('drops unverifiable prices without preventing the enquiry or using a generic estimate', async () => {
    const design = draft(), original = calculateFrozenConfiguratorPrice(design, resolved())!, token = issueConfiguratorCalculationRef(original);
    const altered = structuredClone(design); altered.input.widthMm += 100;
    for (const [candidate, calculationRef] of [[altered, token], [design, token.slice(0,-2)+'xx'], [design, 'cf1.invalid']] as const) {
      const result = await buildPublishedEnquiryPricingSnapshot(params, { design: candidate, calculationRef });
      expect(result.verifiedConfigurator).toBeUndefined(); expect(result.budgets.baseRange).toBeNull();
    }
    const changed = resolved(); changed.config.materials.items.forEach(item => { item.cost_ex_gst *= 1.2; });
    mocks.historical.mockResolvedValue(changed);
    expect((await buildPublishedEnquiryPricingSnapshot(params, { design, calculationRef: token })).budgets.baseRange).toBeNull();
    mocks.historical.mockRejectedValue(new Error('version hash mismatch'));
    expect((await buildPublishedEnquiryPricingSnapshot(params, { design, calculationRef: token })).budgets.baseRange).toBeNull();
  });
});
