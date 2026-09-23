import { expect, it, vi } from 'vitest';
vi.mock('../xero/financePositionAuthority', () => ({ financePositionBinding: vi.fn() }));
import { financePositionResponse } from './finance-position';
const id = '10000000-0000-4000-8000-000000000001';
const config = { databaseUrl: 'postgres://unused', databaseSsl: false as const, token: 't'.repeat(32), sourceKey: 'synthetic', connectionId: id, environment: 'test' };
function fixture() {
  const env = { PRAXIS_XERO_FINANCE_POSITION_ENABLED: 'true', XERO_PAYMENT_MATCHING_ENABLED: 'true', PRAXIS_XERO_FINANCE_ACTOR_ID: id, XERO_TENANT_ID: id };
  const binding = vi.fn(async () => ({ tenantId: id, scope: 'organisation' as const }));
  const read = vi.fn(async () => [] as unknown[]);
  const deps = { connector: () => config, env: () => env, binding, read, now: () => new Date('2026-09-23T00:00:00Z') };
  const request = (patch: Record<string, string> = {}, query = 'from=2026-09-01&to=2026-09-23&basis=accrual') => new Request(`https://portal.example.test/api/integrations/praxis/v1/finance-position?${query}`, { headers: {
    authorization: `Bearer ${config.token}`, 'x-praxis-source-key': config.sourceKey, 'x-praxis-connection-id': id, 'x-praxis-environment': 'test', ...patch } });
  return { deps, env, binding, read, request };
}
it('denies bearer and source mismatch before grant lookup or provider access', async () => {
  const f = fixture();
  expect((await financePositionResponse(f.request({ authorization: 'Bearer wrong' }), f.deps)).status).toBe(401);
  expect((await financePositionResponse(f.request({ 'x-praxis-environment': 'other' }), f.deps)).status).toBe(403);
  expect(f.binding).not.toHaveBeenCalled(); expect(f.read).not.toHaveBeenCalled();
});
it.each(['PRAXIS_XERO_FINANCE_POSITION_ENABLED', 'XERO_PAYMENT_MATCHING_ENABLED', 'PRAXIS_XERO_FINANCE_ACTOR_ID'] as const)('denies missing %s before broker', async key => {
  const f = fixture(); f.env[key] = '';
  expect((await financePositionResponse(f.request(), f.deps)).status).toBe(403); expect(f.read).not.toHaveBeenCalled();
});
it('uses configured actor and fails revoked grant without exposing details', async () => {
  const f = fixture(); f.binding.mockRejectedValue(new Error('private database detail'));
  const response = await financePositionResponse(f.request(), f.deps);
  expect(response.status).toBe(503); expect(await response.text()).not.toContain('private database detail'); expect(f.read).not.toHaveBeenCalled();
});
it('rejects caller actor, tenant, duplicate dates and future dates', async () => {
  const f = fixture();
  for (const query of [`from=2026-09-01&to=2026-09-23&basis=accrual&actor=${id}`, 'from=2026-09-01&from=2026-09-02&to=2026-09-23&basis=cash', 'from=2026-09-24&to=2026-09-24&basis=cash']) {
    expect((await financePositionResponse(f.request({}, query), f.deps)).status).toBe(400);
  }
  expect(f.read).not.toHaveBeenCalled();
});
it('returns source-bound partial evidence with no credentials and no-store', async () => {
  const f = fixture(); const response = await financePositionResponse(f.request(), f.deps);
  expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toContain('no-store');
  const body = await response.json(); expect(body.source.connectionId).toBe(id); expect(body.identity.scope).toBe('organisation');
  expect(body.bankSummary).toMatchObject({ status: 'unavailable' }); expect(body.receivables).toMatchObject({ status: 'available', data: { count: 0 } });
  expect(JSON.stringify(body)).not.toContain(config.token); expect(f.binding).toHaveBeenCalledWith(id, id, config, expect.any(AbortSignal));
});
it('stops when the configured finance gate is disabled mid-read', async () => {
  const f = fixture(); f.read.mockImplementation(async () => { f.env.PRAXIS_XERO_FINANCE_POSITION_ENABLED = 'false'; return []; });
  expect((await financePositionResponse(f.request(), f.deps)).status).toBe(503); expect(f.read).toHaveBeenCalledTimes(1);
});
it('rejects final authority failure instead of publishing earlier partial data', async () => {
  const f = fixture(); let count = 0;
  f.binding.mockImplementation(async () => { if (++count === 5) throw new Error('revoked'); return { tenantId: id, scope: 'organisation' }; });
  expect((await financePositionResponse(f.request(), f.deps)).status).toBe(503);
});
