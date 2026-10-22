// @vitest-environment node
import { createHash } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { RateLimitExceededError } from '@1password/sdk';
import { ga4CredentialTransfer } from './credential-transfer';
import { GA4_TRANSFER_KEY, GA4_TRANSFER_PROJECT } from './credential-transfer-platform';
import { observeGa4Vault } from './vault-failure';
afterEach(() => vi.restoreAllMocks());
const secret = 'SYNTHETIC-REFRESH-SECRET', platform = 'SYNTHETIC-PLATFORM-TOKEN', nonce = 'a'.repeat(64), sha = 'b'.repeat(40);
function setup() {
  const env = { VERCEL_ENV: 'production', VERCEL_PROJECT_ID: GA4_TRANSFER_PROJECT, VERCEL_URL: 'fixed-deployment.vercel.app', VERCEL_GIT_COMMIT_SHA: sha,
    SANCTUARY_GA4_TRANSFER_ADMISSION: JSON.stringify({ nonceSha256: createHash('sha256').update(nonce).digest('hex'), releaseSha: sha,
      issuedAt: new Date(Date.now() - 1000).toISOString(), expiresAt: new Date(Date.now() + 600000).toISOString() }) };
  const config = { credentialStore: 'vault' as const, actor: '10000000-0000-4000-8000-000000000001', propertyId: '123', binding: 'c'.repeat(64),
    clientId: 'synthetic-client', clientSecret: 'synthetic-client-secret', vaultId: 'a'.repeat(26), itemId: 'b'.repeat(26), vaultToken: 'synthetic-vault' };
  const source = { sourceKey: 'sanctuary', connectionId: '9200594e-1f1c-4d8e-b6d8-128a1ccdbdea', environment: 'production', token: 'synthetic', databaseUrl: 'unused', databaseSsl: false as const };
  const vault = { authenticate: vi.fn(async () => {}), read: vi.fn(async () => ({ refreshToken: secret, version: 7 })), write: vi.fn(async () => ({ version: 8 })) };
  let state = 'admitted', created = false;
  const entry = { id: 'synthetic-env-id', key: GA4_TRANSFER_KEY, type: 'sensitive', target: ['production'] };
  const command = vi.fn(async (_config: unknown, _source: unknown, _nonce: string, action: string, _signal: AbortSignal, _receipt?: unknown) => {
    if (action === 'begin') { if (state !== 'admitted') throw Error('Already attempted'); state = 'working'; }
    else { if (!['working','installing'].includes(state)) throw Error('Not working'); if (action !== 'check') state = action === 'install_begin' ? 'installing' : action; }
  });
  const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/v2/user')) return Response.json({ user: { id: 'rGPHGaegAnst8s6Zl1VZswuH' } });
    if (url.includes('/v9/projects/')) return Response.json({ id: GA4_TRANSFER_PROJECT, accountId: 'team_yTur5DT5THIdiLGLK1OVLA2V' });
    if (init?.method === 'POST') { created = true; return Response.json(entry); }
    return Response.json({ envs: created ? [entry] : [] });
  });
  const deps = { env: () => env, config: () => config, source: () => source, vault: () => vault, command, fetcher: fetcher as typeof fetch };
  const request = (patch: object = {}, origin = 'https://fixed-deployment.vercel.app') => new Request(origin + '/api/integrations/praxis/ga4-credential-transfer',
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nonce, platformToken: platform, ...patch }) });
  return { deps, env, config, vault, command, fetcher, request, state: () => state };
}
it('transfers once to exactly the production sensitive key with cloud-only token handling', async () => {
  const f = setup(), log = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const result = await ga4CredentialTransfer(f.request(), f.deps);
  expect(result.status).toBe(201); expect(await result.json()).toEqual({ state: 'installed' });
  expect(f.vault.read).toHaveBeenCalledOnce(); expect(f.vault.write).not.toHaveBeenCalled();
  const writes = f.fetcher.mock.calls.filter(([, init]) => init?.method === 'POST'); expect(writes).toHaveLength(1);
  expect(JSON.parse(String(writes[0]?.[1]?.body))).toEqual({ key: GA4_TRANSFER_KEY, value: secret, type: 'sensitive', target: ['production'] });
  expect(f.fetcher.mock.calls.every(([url]) => String(url).startsWith('https://api.vercel.com/'))).toBe(true);
  expect(JSON.stringify(f.command.mock.calls)).not.toContain(secret); expect(log).not.toHaveBeenCalled();
  expect((await ga4CredentialTransfer(f.request(), f.deps)).status).toBe(503); expect(f.vault.read).toHaveBeenCalledOnce();
});
it.each(['nonce', 'origin', 'sha', 'preview', 'expired', 'extra'])('denies %s before SDK or external writes', async defect => {
  const f = setup();
  if (defect === 'sha') f.env.VERCEL_GIT_COMMIT_SHA = 'd'.repeat(40);
  if (defect === 'preview') f.env.VERCEL_ENV = 'preview';
  if (defect === 'expired') f.env.SANCTUARY_GA4_TRANSFER_ADMISSION = JSON.stringify({ ...JSON.parse(f.env.SANCTUARY_GA4_TRANSFER_ADMISSION), expiresAt: new Date(Date.now() - 1).toISOString() });
  const result = await ga4CredentialTransfer(f.request(defect === 'nonce' ? { nonce: 'd'.repeat(64) } : defect === 'extra' ? { destination: 'other' } : {},
    defect === 'origin' ? 'https://portal.sanctuarypergolas.co.nz' : undefined), f.deps);
  expect(result.status).toBeGreaterThanOrEqual(400); expect(f.vault.read).not.toHaveBeenCalled(); expect(f.fetcher).not.toHaveBeenCalled();
});
it('classifies a pre-effect vault error without exposing SDK text or consuming any Google call', async () => {
  const f = setup(), log = vi.spyOn(console, 'warn').mockImplementation(() => {});
  f.vault.read.mockImplementation(() => observeGa4Vault('vault_read', async () => { throw new RateLimitExceededError(secret); }));
  const response = await ga4CredentialTransfer(f.request(), f.deps);
  expect(await response.json()).toEqual({ state: 'vault_unavailable', stage: 'vault_read', code: 'rate_limited', settlement: 'failed_before_install' });
  expect(f.state()).toBe('failed_before_install'); expect(f.fetcher.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  expect(JSON.stringify(log.mock.calls)).not.toContain(secret);
});
it('never repeats an uncertain create and retains reconciliation state', async () => {
  const f = setup(), original = f.fetcher.getMockImplementation()!;
  f.fetcher.mockImplementation(async (url, init) => { if (init?.method === 'POST') throw new Error(secret); return original(url, init); });
  const response = await ga4CredentialTransfer(f.request(), f.deps);
  expect(await response.json()).toEqual({ state: 'unconfirmed', settlement: 'unconfirmed' }); expect(f.state()).toBe('unconfirmed');
  await ga4CredentialTransfer(f.request(), f.deps);
  expect(f.fetcher.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
});
it('stops on control change after reading the vault and before creating the destination', async () => {
  const f = setup(); f.vault.read.mockImplementation(async () => { f.env.VERCEL_GIT_COMMIT_SHA = 'd'.repeat(40); return { refreshToken: secret, version: 7 }; });
  expect((await ga4CredentialTransfer(f.request(), f.deps)).status).toBe(503);
  expect(f.fetcher.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(0);
});
