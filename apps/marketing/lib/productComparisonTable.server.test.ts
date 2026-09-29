import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const owners = vi.hoisted(() => ({ resolve: vi.fn(), calculate: vi.fn() }));
vi.mock('./publishedCostingConfiguration.server', () => ({ getPublishedCostingConfiguration: owners.resolve }));
vi.mock('./configuratorPricing.server', () => ({ calculateFrozenConfiguratorPrice: owners.calculate }));
const published = (versionId = 'approved', versionNumber = 15, contentHash = 'hash-15') => ({
  provenance: { versionId, versionNumber, contentHash, baseManifestVersion: 'base' }, config: { privateRates: 'never-public' },
});
let read: typeof import('./productComparisonTable.server')['getProductComparisonTable'];
beforeEach(async () => {
  vi.resetModules(); vi.clearAllMocks();
  vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('WEBSITE_CONFIGURATOR_APPROVED_VERSION_ID', 'approved');
  owners.resolve.mockResolvedValue(published());
  owners.calculate.mockImplementation(draft => ({ customerPrice: { amountIncGst: draft.input.widthMm + draft.input.projectionMm + 10000 }, base: 'private-base', siteInputs: 'private-site' }));
  read = (await import('./productComparisonTable.server')).getProductComparisonTable;
});
afterEach(() => vi.unstubAllEnvs());
describe('overview approved comparison snapshot', () => {
  it('calculates all18 once from one publication and exposes only public totals/version', async () => {
    const result = await read();
    expect(result.status).toBe('priced'); if (result.status !== 'priced') return;
    expect(Object.keys(result).sort()).toEqual(['amounts', 'status', 'versionNumber']);
    expect(Object.keys(result.amounts)).toEqual(['2000-3000','4000-3000','6000-3000','8000-3000','6000-4000','6000-5000']);
    expect(Object.values(result.amounts).every(row => Object.keys(row).length === 3)).toBe(true);
    expect(owners.resolve).toHaveBeenCalledTimes(1); expect(owners.calculate).toHaveBeenCalledTimes(18);
    expect(owners.calculate.mock.calls.every(([, config]) => config === owners.calculate.mock.calls[0][1])).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/private|config|base|siteInputs|calculationRef|contentHash|versionId/);
    expect(await read()).toEqual(result); expect(owners.resolve).toHaveBeenCalledTimes(2); expect(owners.calculate).toHaveBeenCalledTimes(18);
  });
  it('checks publication before a cache hit and never falls back after mismatch or failure', async () => {
    await read(); owners.resolve.mockResolvedValue(published('new',16));
    expect(await read()).toEqual({status:'unavailable'});
    owners.resolve.mockRejectedValue(new Error('private database error'));
    expect(await read()).toEqual({status:'unavailable'});
    expect(owners.calculate).toHaveBeenCalledTimes(18);
  });
  it('recalculates the complete table after an approved publication or provenance change', async () => {
    await read(); vi.stubEnv('WEBSITE_CONFIGURATOR_APPROVED_VERSION_ID','new'); owners.resolve.mockResolvedValue(published('new',16));
    owners.calculate.mockReturnValue({customerPrice:{amountIncGst:22222}});
    const next=await read(); expect(next.status).toBe('priced');
    if(next.status==='priced') {expect(next.versionNumber).toBe(16); expect(Object.values(next.amounts).flatMap(Object.values).every(amount=>amount===22222)).toBe(true);}
    expect(owners.calculate).toHaveBeenCalledTimes(36);
    owners.resolve.mockResolvedValue(published('new',16,'different-hash')); await read(); expect(owners.calculate).toHaveBeenCalledTimes(54);
  });
  it.each([null, {customerPrice:{amountIncGst:NaN}}, {customerPrice:{amountIncGst:0}}])('withholds the entire partial/invalid table and retries without caching it', async invalid => {
    owners.calculate.mockReturnValueOnce(invalid); expect(await read()).toEqual({status:'unavailable'});
    expect((await read()).status).toBe('priced'); expect(owners.calculate).toHaveBeenCalledTimes(19);
  });
  it('matches the public API missing-approval denial even with a previously cached table', async () => {
    await read(); vi.stubEnv('WEBSITE_CONFIGURATOR_APPROVED_VERSION_ID',''); expect(await read()).toEqual({status:'disabled'});
  });
  it.each(['v2.8','v2.9'])('matches the public API local-candidate denial for%s', async candidate => {
    vi.stubEnv('NODE_ENV','development'); vi.stubEnv('CONFIGURATOR_LOCAL_PRICING_CANDIDATE',candidate);
    expect(await read()).toEqual({status:'disabled'}); expect(owners.resolve).not.toHaveBeenCalled();
  });
});
