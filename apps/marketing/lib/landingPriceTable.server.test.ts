import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ACCESSORY_REVIEW_RATES, applyCostingControlConfigV1, getDefaultInstalledSellingRates, loadCostingConfigV1, snapshotCostingControlConfigV1 } from '@sp/costing';
import { hashCostingControlConfigV1, type ResolvedPublishedCostingConfigurationV1 } from '@sp/costing/server';
import { productSelectionDraft } from '../components/products/productSelection';
import { INITIAL_PRODUCT_SELECTION } from '../components/products/productSelectionValues';
import { calculateFrozenConfiguratorPrice } from './configuratorPricing.server';
import { generateLandingPriceTable } from './landingPriceTableGenerator.server';
import { LANDING_PRICE_CELLS, LANDING_PRICE_LEASE_MS, LANDING_PRICE_MATERIALS, LANDING_PRICE_TYPES, lookupLandingPrice, type LandingPriceTable } from './landingPriceTable';
import { landingPricePublicationKey } from './landingPriceTableArtifact.server';
import { POST } from '../app/api/landing-price-table/route';

const mocks = vi.hoisted(() => ({ current: vi.fn(), artifact: vi.fn() }));
vi.mock('./publishedCostingConfiguration.server', () => ({ getPublishedCostingConfiguration: mocks.current }));
vi.mock('./landingPriceTableArtifact.server', async original => ({ ...await original<typeof import('./landingPriceTableArtifact.server')>(), readLandingPriceTableArtifact: mocks.artifact }));
const versionId = '11111111-1111-4111-8111-111111111111';
function resolved(): ResolvedPublishedCostingConfigurationV1 {
  const base = loadCostingConfigV1(), control = snapshotCostingControlConfigV1(base);
  control.accessoryRates = structuredClone(ACCESSORY_REVIEW_RATES); control.installedSellingRates = getDefaultInstalledSellingRates();
  return { config: applyCostingControlConfigV1(base, control), provenance: { schemaVersion: 'costing-provenance.v1', source: 'published',
    versionId, versionNumber: 12, contentHash: hashCostingControlConfigV1(control), baseManifestVersion: control.baseManifestVersion } };
}
const publication = resolved();
const fixture: LandingPriceTable = { schema: 'landing-price-table.v1', id: 'a'.repeat(64), publicationKey: landingPricePublicationKey(publication.provenance),
  versionId, versionNumber: 12, currency: 'NZD', includesGst: true, amounts: Array(LANDING_PRICE_CELLS).fill(12345) as number[] };
function request(body: unknown = {}) { return new Request('http://localhost:3013/api/landing-price-table', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3013' }, body: JSON.stringify(body) }); }
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('WEBSITE_CONFIGURATOR_APPROVED_VERSION_ID', versionId); mocks.current.mockResolvedValue(publication); mocks.artifact.mockResolvedValue(fixture); });
afterEach(() => vi.unstubAllEnvs());

it('generates all 35,604 exact cells with canonical parity, including material limits and area boundaries', () => {
  // Synthetic complete published fixture, not evidence of an approved live pricebook.
  const table = generateLandingPriceTable(publication);
  expect(table.amounts).toHaveLength(LANDING_PRICE_CELLS);
  for (const type of LANDING_PRICE_TYPES) for (const material of LANDING_PRICE_MATERIALS)
    for (let widthMm = 1500; widthMm <= 10000; widthMm += 100) for (let projectionMm = 1500; projectionMm <= 6000; projectionMm += 100) {
      const selection = { ...INITIAL_PRODUCT_SELECTION, material, widthMm, projectionMm };
      const { draft, issue } = productSelectionDraft(selection, type);
      const canonical = issue ? null : calculateFrozenConfiguratorPrice(draft, publication);
      const expected = issue ? { status: 'issue' } : canonical ? { status: 'priced', amountIncGst: canonical.customerPrice.amountIncGst } : { status: 'custom' };
      expect(lookupLandingPrice(table, type, selection), `${type}/${material}/${widthMm}/${projectionMm}`).toEqual(expected);
    }
  expect(Object.keys(table).sort()).toEqual(['schema', 'id', 'publicationKey', 'versionId', 'versionNumber', 'currency', 'includesGst', 'amounts'].sort());
  expect(JSON.stringify(table)).not.toMatch(/costExGst|costingConfiguration|supply|multiplier|rates|secret|calculationRef/);
}, 240_000);

it('serves only public totals; conditional refresh still checks current approval without regenerating', async () => {
  const response = await POST(request());
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(await response.json()).toEqual({ status: 'ready', table: fixture, leaseMs: LANDING_PRICE_LEASE_MS });
  expect(await (await POST(request({ knownId: fixture.id }))).json()).toEqual({ status: 'current', id: fixture.id, leaseMs: LANDING_PRICE_LEASE_MS });
  expect(mocks.current).toHaveBeenCalledTimes(2);
});
it('is disabled without a pin and for local candidates, without reading config or artifact', async () => {
  vi.stubEnv('WEBSITE_CONFIGURATOR_APPROVED_VERSION_ID', '');
  expect(await (await POST(request())).json()).toEqual({ status: 'disabled' });
  vi.stubEnv('WEBSITE_CONFIGURATOR_APPROVED_VERSION_ID', versionId); vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('CONFIGURATOR_LOCAL_PRICING_CANDIDATE', 'v2.9');
  expect(await (await POST(request())).json()).toEqual({ status: 'disabled' });
  expect(mocks.current).not.toHaveBeenCalled(); expect(mocks.artifact).not.toHaveBeenCalled();
});
it('rejects changed/revoked/unavailable publication, mismatched artifact or identity and never serves an old table', async () => {
  mocks.current.mockResolvedValueOnce({ ...publication, provenance: { ...publication.provenance, versionId: 'other' } });
  expect((await POST(request({ knownId: fixture.id }))).status).toBe(503);
  mocks.current.mockRejectedValueOnce(new Error('Unavailable'));
  expect((await POST(request())).status).toBe(503);
  for (const table of [null, { ...fixture, versionNumber: 13 }, { ...fixture, publicationKey: 'c'.repeat(64) }]) {
    mocks.artifact.mockResolvedValueOnce(table); expect((await POST(request())).status).toBe(503);
  }
});
it('rejects invalid requests before a published config read', async () => {
  const foreign = request(); foreign.headers.set('Origin', 'https://foreign.example'); expect((await POST(foreign)).status).toBe(403);
  const text = request(); text.headers.set('Content-Type', 'text/plain'); expect((await POST(text)).status).toBe(415);
  for (const body of [null, [], { knownId: 'bad' }, { extra: true }, { knownId: 'a'.repeat(300) }]) expect((await POST(request(body))).status).toBe(422);
  expect(mocks.current).not.toHaveBeenCalled();
});
