// @vitest-environment node
import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import { z } from 'zod';
vi.mock('server-only', () => ({}));
import { readCampaignHealth } from './reader';
import { scopeSchema, registeredCreativeAdSchema, steadyAdSchema } from './contract';

const fixturePath = process.env.SANCTUARY_NATIVE_STEADY_FIXTURE;
afterEach(() => vi.unstubAllEnvs());
it.skipIf(!fixturePath)('actual PG inventory survives paused, active, restored and superseded reader composition, with unknown extras and wrong creative denied', async () => {
  const fixture = JSON.parse(readFileSync(fixturePath!, 'utf8'));
  const scope = scopeSchema.parse(fixture.scope);
  vi.stubEnv('SANCTUARY_CAMPAIGN_MONITOR_SCOPE', JSON.stringify(scope));
  const config = { actor: '10000000-0000-4000-8000-000000000001', account: scope.account, binding: 'a'.repeat(64), app: '1', principal: '2', business: '3', token: 'synthetic-token', appSecret: 'synthetic-secret' };
  for (const stage of fixture.stages.filter((v: {registry?:unknown}) => v.registry)) {
    const registry = z.object({ version: z.literal(2), experimental: z.array(registeredCreativeAdSchema), steady: z.array(steadyAdSchema) }).strict().parse(stage.registry);
    const now = new Date(Math.max(...registry.steady.map(row => Date.parse(row.observedAt))) + 1);
    const ids = [...scope.ads.map(row => row.id), ...registry.experimental.map(row => row.id), ...registry.steady.map(row => row.id)];
    let calls = 0, extra = false, wrongCreative = false;
    const fetcher: typeof fetch = async (_url, init) => {
      const batch = JSON.parse(new URLSearchParams(String(init?.body)).get('batch')!);
      expect(batch).toHaveLength(1); expect(batch[0].method).toBe('GET'); calls++;
      const url = new URL(`https://graph.invalid/${batch[0].relative_url}`), period = JSON.parse(url.searchParams.get('time_range') ?? '{}');
      const rows = extra ? [...ids, '999999999'] : ids;
      const data = url.pathname.endsWith('/ads') ? rows.map(id => ({ id, account_id: scope.account, campaign_id: scope.campaign, adset_id: scope.adset,
        creative: { id: wrongCreative ? '888888' : registry.steady.find(row => row.id === id)?.creative ?? '777777' },
        effective_status: registry.steady.find(row => row.id === id)?.state === 'active' ? 'ACTIVE' : 'PAUSED',
        campaign: { id: scope.campaign, effective_status: 'ACTIVE', daily_budget: '40000' }, adset: { id: scope.adset, effective_status: 'ACTIVE' } }))
        : rows.map(id => ({ account_id: scope.account, campaign_id: scope.campaign, adset_id: scope.adset, ad_id: id, date_start: period.since, date_stop: period.until, spend: '1.25' }));
      return Response.json([{ code: 200, body: JSON.stringify({ data }) }]);
    };
    const read = () => readCampaignHealth(config, { currency: 'NZD', timezone: 'Pacific/Auckland' }, async (_step, run) => run(), fetcher, now, registry.experimental, registry.steady);
    const health = await read();
    expect(calls).toBe(3); expect(health.ads).toHaveLength(4); expect(health.creativeAds).toHaveLength(registry.experimental.length);
    expect(health.steadyAds?.map(row => row.id)).toEqual(registry.steady.map(row => row.id));
    expect(health.steadyAds?.every(row => row.week.spend === 1.25 && !('arm' in row))).toBe(true);
    extra = true; await expect(read()).rejects.toThrow('coverage'); expect(calls).toBe(4);
    extra = false; wrongCreative = true; await expect(read()).rejects.toThrow('creative'); expect(calls).toBe(5);
  }
});
