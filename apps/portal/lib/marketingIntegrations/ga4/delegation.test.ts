// @vitest-environment node
import { createHash, createHmac } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { ga4Delegation } from './delegation';
afterEach(() => vi.unstubAllEnvs());
it('binds the explicit v3 version into the signed delegation and rejects an old-version proof', async () => {
  const key = 'synthetic'.repeat(8); vi.stubEnv('SANCTUARY_GA4_VELT_AUTHORITY_KEY', key);
  const query = { period: { start: '2026-10-01', end: '2026-10-02' }, comparison: null };
  const request = (v3: boolean) => {
    const value = { operation: '10000000-0000-4000-8000-000000000001', binding: 'a'.repeat(64), query: createHash('sha256').update(JSON.stringify({ kind: 'marketing/ga4', action: 'refresh', query, retain: true, ...(v3 ? { reportVersion: 'sanctuary-ga4-v3' } : {}) })).digest('hex') };
    return new Request('https://portal.test', { headers: { 'x-velt-ga4-operation': value.operation, 'x-velt-ga4-binding': value.binding, 'x-velt-ga4-query': value.query,
      'x-velt-ga4-proof': createHmac('sha256', key).update(JSON.stringify(value)).digest('hex') } });
  };
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
  expect(() => ga4Delegation(request(false), query, new AbortController().signal, fetcher, 'sanctuary-ga4-v3')).toThrow('Delegation unavailable');
  await ga4Delegation(request(true), query, new AbortController().signal, fetcher, 'sanctuary-ga4-v3')();
  expect(fetcher).toHaveBeenCalledTimes(1);
});
