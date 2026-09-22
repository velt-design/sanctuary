import { expect, it, vi } from 'vitest';
vi.mock('../invoices/financeMappingRepository', () => ({ financeCustomerHistoryBinding: vi.fn() }));
vi.mock('../xero/customerHistoryProvider', () => ({ HISTORY_PAGE_SIZE: 100, readHistoryPage: vi.fn() }));
import { financeHistoryResponse } from './finance-history';
const id = '10000000-0000-4000-8000-000000000001';
const config = { databaseUrl: 'postgres://unused', databaseSsl: false as const, token: 't'.repeat(32), sourceKey: 'synthetic', connectionId: id, environment: 'test' };
function fixture() {
  const env = { PRAXIS_XERO_FINANCE_READ_ENABLED: 'true', XERO_PAYMENT_MATCHING_ENABLED: 'true', PRAXIS_XERO_FINANCE_ACTOR_ID: id, XERO_TENANT_ID: id };
  const binding = vi.fn(async () => ({ projectId: id, portalContactId: id, tenantId: id, xeroContactId: id, mappingVerifiedAt: '2026-09-01T00:00:00.000Z' }));
  const read = vi.fn(async (q: { resource: string }) => q.resource === 'Contacts' ? [{ ContactID: id, Name: 'Synthetic', ContactStatus: 'ACTIVE' }] : []);
  const deps = { connector: () => config, env: () => env, binding, read, now: () => new Date('2026-09-22T00:00:00Z') };
  const request = (patch: Record<string, string> = {}, query = `projectId=${id}&from=2026-09-01&to=2026-09-22`) => new Request(`https://portal.example.test/api/integrations/praxis/v1/finance-history?${query}`, { headers: {
    authorization: `Bearer ${config.token}`, 'x-praxis-source-key': config.sourceKey, 'x-praxis-connection-id': id, 'x-praxis-environment': 'test', ...patch } });
  return { deps, env, binding, read, request };
}
it('denies bearer and source mismatch before grant lookup or provider access', async () => {
  const f = fixture();
  expect((await financeHistoryResponse(f.request({ authorization: 'Bearer wrong' }), f.deps)).status).toBe(401);
  expect((await financeHistoryResponse(f.request({ 'x-praxis-environment': 'other' }), f.deps)).status).toBe(403);
  expect(f.binding).not.toHaveBeenCalled(); expect(f.read).not.toHaveBeenCalled();
});
it.each(['PRAXIS_XERO_FINANCE_READ_ENABLED', 'XERO_PAYMENT_MATCHING_ENABLED', 'PRAXIS_XERO_FINANCE_ACTOR_ID'] as const)('denies missing %s before broker', async key => {
  const f = fixture(); f.env[key] = '';
  expect((await financeHistoryResponse(f.request(), f.deps)).status).toBe(403); expect(f.read).not.toHaveBeenCalled();
});
it('uses configured actor and fails revoked grant without exposing details', async () => {
  const f = fixture(); f.binding.mockRejectedValue(new Error('private database detail token-example'));
  const response = await financeHistoryResponse(f.request(), f.deps);
  expect(response.status).toBe(503); expect(await response.text()).not.toContain('token-example'); expect(f.read).not.toHaveBeenCalled();
});
it('rejects caller actor, tenant and duplicate query values', async () => {
  const f = fixture();
  for (const query of [`projectId=${id}&from=2026-09-01&to=2026-09-22&actor=${id}`, `projectId=${id}&projectId=${id}&from=2026-09-01&to=2026-09-22`]) {
    expect((await financeHistoryResponse(f.request({}, query), f.deps)).status).toBe(400);
  }
  expect(f.read).not.toHaveBeenCalled();
});
it('returns source-bound read window with no credentials and no-store', async () => {
  const f = fixture(); const response = await financeHistoryResponse(f.request(), f.deps);
  expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toContain('no-store');
  const body = await response.json(); expect(body.source.connectionId).toBe(id); expect(body.identity.scope).toBe('contact_wide');
  expect(JSON.stringify(body)).not.toContain(config.token); expect(body).not.toHaveProperty('total');
  expect(f.binding).toHaveBeenCalledWith(id, id, id, { sourceKey: config.sourceKey, connectionId: id, environment: 'test' }, expect.any(AbortSignal));
});
it('stops when the configured finance gate is disabled mid-read', async () => {
  const f = fixture(); f.read.mockImplementation(async () => { f.env.PRAXIS_XERO_FINANCE_READ_ENABLED = 'false'; return [{ ContactID: id, Name: 'Synthetic', ContactStatus: 'ACTIVE' }]; });
  expect((await financeHistoryResponse(f.request(), f.deps)).status).toBe(503); expect(f.read).toHaveBeenCalledTimes(1);
});
it('compares the final mapping fence instead of merely checking lookup success', async () => {
  const f = fixture(); const original = f.binding.getMockImplementation()!; let checks = 0;
  f.binding.mockImplementation(async () => ({ ...await original(), xeroContactId: ++checks >= 7 ? '20000000-0000-4000-8000-000000000001' : id }));
  expect((await financeHistoryResponse(f.request(), f.deps)).status).toBe(503);
});
