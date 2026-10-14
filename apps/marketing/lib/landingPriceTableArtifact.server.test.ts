import { beforeEach, expect, it, vi } from 'vitest';
import { LANDING_PRICE_CELLS, type LandingPriceTable } from './landingPriceTable';

const readFile = vi.hoisted(() => vi.fn());
vi.mock('node:fs/promises', () => ({ readFile, default: { readFile } }));
beforeEach(() => { vi.resetModules(); readFile.mockReset(); });
const payload: Omit<LandingPriceTable, 'id'> = { schema: 'landing-price-table.v1', publicationKey: 'b'.repeat(64), versionId: '11111111-1111-4111-8111-111111111111',
  versionNumber: 1, currency: 'NZD', includesGst: true, amounts: Array(LANDING_PRICE_CELLS).fill(12345) as number[] };

it('reads and verifies the generated artifact once per process, deduplicating concurrent callers', async () => {
  const { landingPriceTableId, readLandingPriceTableArtifact } = await import('./landingPriceTableArtifact.server');
  const table = { ...payload, id: landingPriceTableId(payload) }; readFile.mockResolvedValue(JSON.stringify(table));
  const [first, second] = await Promise.all([readLandingPriceTableArtifact(), readLandingPriceTableArtifact()]);
  expect(first).toEqual(table); expect(second).toBe(first); expect(readFile).toHaveBeenCalledTimes(1);
});
it('rejects numeric corruption under a retained old checksum', async () => {
  const { landingPriceTableId, readLandingPriceTableArtifact } = await import('./landingPriceTableArtifact.server');
  const table = { ...payload, id: landingPriceTableId(payload), amounts: [...payload.amounts] }; table.amounts[42]++;
  readFile.mockResolvedValue(JSON.stringify(table)); expect(await readLandingPriceTableArtifact()).toBeNull();
});
it.each(['not json', '{"status":"disabled"}', '{}'])('fails safely for unavailable or malformed build output: %s', async text => {
  const { readLandingPriceTableArtifact } = await import('./landingPriceTableArtifact.server');
  readFile.mockResolvedValue(text); expect(await readLandingPriceTableArtifact()).toBeNull();
});
it('handles missing build output without regenerating a table during a request', async () => {
  const { readLandingPriceTableArtifact } = await import('./landingPriceTableArtifact.server');
  readFile.mockRejectedValue(new Error('ENOENT')); expect(await readLandingPriceTableArtifact()).toBeNull();
});
