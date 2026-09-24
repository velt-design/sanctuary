// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('./store', async original => ({ ...await original<typeof import('./store')>(), ga4Store: vi.fn() }));
import { sanctuaryGa4Response } from './http';
import { GA4_READ_SCOPE } from './lifecycle';
import { reportHash } from './report/ga4';
import type { AnalyticsReport } from './report/report';
const id = '10000000-0000-4000-8000-000000000001';
beforeEach(() => vi.spyOn(console, 'warn').mockImplementation(() => undefined));
afterEach(() => vi.restoreAllMocks());
function fixture() {
  const source = { databaseUrl: 'postgres://unused', databaseSsl: false as const, token: 't'.repeat(32), sourceKey: 'synthetic', connectionId: id, environment: 'test' };
  const control = { actor: id, property: '123', binding: 'a'.repeat(64) };
  const query = { period: { start: '2026-08-01', end: '2026-08-07' }, comparison: null };
  // Deliberately noncanonical insertion order tests normalisation before hashing.
  const report: AnalyticsReport = { warnings: [], fetchedAt: new Date().toISOString(), source: 'ga4', property: '123', timezone: 'Pacific/Auckland', query,
    traffic: [], channels: [], landing: [], events: [], sessions: null, previousSessions: null };
  let payload = JSON.stringify(report);
  const command = vi.fn(async (action: string, _operation: string | null, _signal: AbortSignal, input?: { payload?: string }): Promise<unknown> => {
    if (action === 'claim') return { operation: id, generation: 1 };
    if (action === 'complete') { payload = input!.payload!; return { status: 'completed', operation: id }; }
    if (action === 'delete') return { status: 'deleted' };
    if (action === 'read') return { status: 'available', operation: id, generation: 1, payload,
      resultHash: reportHash(JSON.parse(payload)), expiresAt: new Date(Date.parse(report.fetchedAt) + 7 * 86400000).toISOString() };
    return {};
  });
  const credentials = vi.fn(() => ({ actor: id, propertyId: '123', binding: control.binding, vaultId: 'a'.repeat(26), itemId: 'b'.repeat(26),
    clientId: 'synthetic-client', clientSecret: 'private-secret', vaultToken: 'private-token' }));
  const guard = vi.fn(async () => undefined);
  const vault = { authenticate: vi.fn(async () => undefined), read: vi.fn(async () => ({ refreshToken: 'private-refresh', version: 1 })), write: vi.fn(async () => ({ version: 2 })) };
  const google = { token: vi.fn(async () => ({ accessToken: 'private-access', scope: GA4_READ_SCOPE, expiresIn: 3600 })), property: vi.fn(async () => undefined) };
  const business = vi.fn<Parameters<typeof sanctuaryGa4Response>[1]['business']>().mockRejectedValue(new Error('private source unavailable'));
  const dependencies = { source: () => source, control: () => control, credentials, store: () => command,
    vault: () => vault, google: () => google, read: vi.fn(async () => report), business, delegation: () => guard, fetcher: vi.fn<typeof fetch>() };
  const request = (queryString = 'action=refresh&start=2026-08-01&end=2026-08-07&retain=true', patch: Record<string, string> = {}, method = 'GET') =>
    new Request(`https://portal.test/api/integrations/praxis/v1/marketing/ga4?${queryString}`, { method, headers: {
      authorization: `Bearer ${source.token}`, 'x-praxis-source-key': 'synthetic', 'x-praxis-connection-id': id, 'x-praxis-environment': 'test', ...patch,
    } });
  return { dependencies, request, command, report, vault, google, guard };
}
it('normalizes, stores and delivers exact hashed evidence without exposing secrets', async () => {
  const f = fixture(), response = await sanctuaryGa4Response(f.request(), f.dependencies);
  expect(response.status).toBe(200);
  const wire = await response.json();
  expect(wire.resultHash).toBe(reportHash(wire.report));
  expect(wire.report.business).toEqual({ status: 'unavailable', reason: 'complete_snapshot_unavailable' });
  expect(wire.source.propertyId).toBe('123');
  expect(JSON.stringify(wire)).not.toMatch(/private|refreshToken|clientSecret/);
  expect(f.command.mock.calls.map(call => call[0])).toContain('deliver');
});
it('saved read and deletion do not access credentials or Google', async () => {
  const f = fixture();
  expect((await sanctuaryGa4Response(f.request('action=read'), f.dependencies)).status).toBe(200);
  expect((await sanctuaryGa4Response(f.request('action=delete', {}, 'DELETE'), f.dependencies)).status).toBe(200);
  expect(f.dependencies.credentials).not.toHaveBeenCalled(); expect(f.google.token).not.toHaveBeenCalled();
});
it.each(['auth', 'source', 'duplicate', 'unknown', 'method', 'retain'])('rejects %s before claim', async mode => {
  const f = fixture();
  const request = f.request(mode === 'duplicate' ? 'action=read&action=read' : mode === 'unknown' ? 'action=read&property=999'
    : mode === 'retain' ? 'action=refresh&start=2026-08-01&end=2026-08-07&retain=false' : 'action=read',
  mode === 'auth' ? { authorization: 'bad' } : mode === 'source' ? { 'x-praxis-source-key': 'wrong' } : {}, mode === 'method' ? 'POST' : 'GET');
  expect((await sanctuaryGa4Response(request, f.dependencies)).status).toBeGreaterThanOrEqual(400);
  expect(f.command).not.toHaveBeenCalled();
});
it('revocation before a credential effect prevents collection and delivery', async () => {
  const f = fixture(); f.guard.mockResolvedValueOnce(undefined).mockRejectedValue(new Error('revoked'));
  expect((await sanctuaryGa4Response(f.request(), f.dependencies)).status).toBe(503);
  expect(f.vault.authenticate).not.toHaveBeenCalled();
  expect(f.command.mock.calls.map(call => call[0])).not.toContain('complete');
});
it('deletion or revocation at the final delivery fence withholds the report', async () => {
  const f = fixture(), original = f.command.getMockImplementation()!;
  f.command.mockImplementation(async (...args) => { if (args[0] === 'deliver') throw new Error('deleted'); return original(...args); });
  const response = await sanctuaryGa4Response(f.request(), f.dependencies);
  expect(response.status).toBe(503); expect(await response.text()).not.toContain('fetchedAt');
});
