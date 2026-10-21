// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { metaCredentialSession } from '../metaCredentials/lifecycle';
import { fingerprint, type MetaCredentialConfig } from '../metaCredentials/config';
import { campaignHealthResponse } from './http';
import { loadPraxisConnectorConfig } from '../../praxis/server';
import { metaConfig, metaControlConfig } from '../meta/config';
import { metaStore } from '../meta/store';
import { scopedMetaDelegation } from '../meta/delegation';
import { openMetaReportCredential } from '../metaCredentials/runtime';
import { verifyMeta } from '../meta/verify';
import { readCampaignHealth } from './reader';
import { supabaseServiceRole } from '../../supabaseClient';

vi.mock('../../praxis/server', async original => ({ ...await original<typeof import('../../praxis/server')>(), loadPraxisConnectorConfig: vi.fn() }));
vi.mock('../meta/config', () => ({ metaControlConfig: vi.fn(), metaConfig: vi.fn() }));
vi.mock('../meta/store', () => ({ metaStore: vi.fn() }));
vi.mock('../meta/delegation', () => ({ scopedMetaDelegation: vi.fn() }));
vi.mock('../metaCredentials/runtime', () => ({ openMetaReportCredential: vi.fn() }));
vi.mock('../meta/verify', () => ({ verifyMeta: vi.fn() }));
vi.mock('./reader', () => ({ readCampaignHealth: vi.fn() }));
vi.mock('../../supabaseClient', () => ({ supabaseServiceRole: { rpc: vi.fn() } }));

const id = '10000000-0000-4000-8000-000000000001', binding = 'a'.repeat(64);
const scope = { account: '99100', campaign: '99200', adset: '99300', ads: ['Riverhead photo', 'Riverhead video', 'Acrylic video', 'Acrylic photo'].map((label, index) => ({ id: `9940${index + 1}`, label })),
  launchDay: '2026-01-01', dailyAverage: 100, maximumDay: 175, weeklyAllowance: 700, weekStartsOn: 0, weeklyWindowVerified: true };
const source = { databaseUrl: 'postgres://unused', databaseSsl: false as const, token: 't'.repeat(32), sourceKey: 'synthetic', connectionId: id, environment: 'test' };
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv('SANCTUARY_CAMPAIGN_MONITOR_ENABLED', 'true'); vi.stubEnv('SANCTUARY_CAMPAIGN_MONITOR_SCOPE', JSON.stringify(scope)); });
afterEach(() => vi.unstubAllEnvs());

function fixture() {
  const trace: string[] = []; let revoked = false; let credentialRevoked = false;
  const token = 'synthetic_token', config: MetaCredentialConfig = { binding, renewalEnabled: false, vaultToken: 'synthetic', appSecret: 'synthetic',
    identity: { capability: 'reports', actorId: id, appId: '123', principalId: '456', businessId: '789', targetId: scope.account, scopes: ['ads_read', 'public_profile'], vaultId: 'a'.repeat(26), itemId: 'b'.repeat(26) } };
  const control = { actor: id, account: scope.account, binding };
  vi.mocked(loadPraxisConnectorConfig).mockReturnValue(source);
  vi.mocked(metaControlConfig).mockReturnValue(control);
  vi.mocked(metaConfig).mockReturnValue({ ...control, app: '123', principal: '456', business: '789', token, appSecret: 'synthetic', expiresAt: new Date(Date.now() + 86400000).toISOString() });
  const authority = vi.fn(async () => {
    trace.push('authority');
    // A regression must fail promptly instead of waiting for the source deadline.
    if (authority.mock.calls.length > 40 || revoked) throw new Error('Authority unavailable');
  });
  vi.mocked(scopedMetaDelegation).mockReturnValue(authority);
  const credentialCommand = vi.fn(async (action: string) => {
    trace.push(`credential:${action}`);
    if (action === 'check' && credentialRevoked) throw new Error('Credential revoked');
    return action === 'begin' ? { operation: id, state: 'READY', tokenHash: fingerprint(token), vaultVersion: 1, expiresAt: null,
      dataAccessExpiresAt: null, candidateHash: null, candidateExpiresAt: null, candidateDataAccessExpiresAt: null, candidateVaultVersion: null } : {};
  });
  // Compose the route's actual callback with the real returned lifecycle check.
  // Only external vault, provider and persistence are synthetic.
  vi.mocked(openMetaReportCredential).mockImplementation(async (signal, authorize) => {
    const lease = await metaCredentialSession({ config, signal, authorize, command: credentialCommand,
      vault: { read: async () => ({ version: 1, credential: { version: 1, binding, accessToken: token, expiresAt: null, dataAccessExpiresAt: null } }), write: vi.fn() },
      provider: { verify: async (_token, check) => { await check(); await check(); return { expiresAt: null, dataAccessExpiresAt: null }; }, refresh: vi.fn() },
    }, 'use');
    return { ...lease, config, reportConfig: { ...control, app: '123', principal: '456', business: '789', token, appSecret: 'synthetic', expiresAt: null } };
  });
  const command = vi.fn(async (action: string) => { trace.push(`report:${action}`); return action === 'claim' ? { operation: id, generation: 1 } : {}; });
  vi.mocked(metaStore).mockReturnValue(command);
  const provider = vi.fn(async () => { trace.push('provider'); });
  vi.mocked(verifyMeta).mockImplementation(async (_config, boundary) => {
    await boundary('identity_check', provider); await boundary('account_read', provider);
    return { currency: 'NZD', timezone: 'Pacific/Auckland' };
  });
  vi.mocked(readCampaignHealth).mockImplementation(async (_config, _account, boundary) => {
    for (let n = 0; n < 3; n++) await boundary('report_read', provider);
    return { synthetic: true } as unknown as Awaited<ReturnType<typeof readCampaignHealth>>;
  });
  vi.mocked(supabaseServiceRole.rpc).mockReturnValue({ abortSignal: async () => ({ error: { message: 'Synthetic partial outcome coverage' }, data: null }) } as never);
  const request = (token = source.token) => new Request('https://portal.test/api/integrations/praxis/v1/marketing/campaign-health', {
    headers: { authorization: `Bearer ${token}`, 'x-praxis-source-key': source.sourceKey, 'x-praxis-connection-id': id, 'x-praxis-environment': source.environment },
  });
  return { trace, command, credentialCommand, authority, provider, request, revoke: () => { revoked = true; }, revokeCredential: () => { credentialRevoked = true; } };
}

it('composes the real lease with finite authority checks and all five fenced reads', async () => {
  const f = fixture(); const response = await campaignHealthResponse(f.request());
  expect(response.status).toBe(200); expect(f.provider).toHaveBeenCalledTimes(5);
  // Initial authorization + five credential-acquisition checks + thirteen route checks.
  expect(f.authority).toHaveBeenCalledTimes(19);
  expect(f.credentialCommand.mock.calls.filter(([action]) => action === 'check')).toHaveLength(18);
  for (const [index, item] of f.trace.entries()) if (['report:before', 'report:after', 'report:complete', 'report:deliver'].includes(item)) {
    expect(f.trace.slice(index - 2, index)).toEqual(['authority', 'credential:check']);
  }
  expect(f.trace.at(-1)).toBe('credential:finish');
  expect(JSON.stringify(await response.json())).not.toContain('synthetic_token');
});

it('rejects request authentication before acquiring credentials', async () => {
  const f = fixture(); expect((await campaignHealthResponse(f.request('wrong'))).status).toBe(503);
  expect(openMetaReportCredential).not.toHaveBeenCalled(); expect(f.provider).not.toHaveBeenCalled();
});

it('keeps external authorization at every boundary when the credential lease is disabled', async () => {
  const f = fixture(); vi.mocked(openMetaReportCredential).mockResolvedValue(undefined);
  expect((await campaignHealthResponse(f.request())).status).toBe(200);
  expect(f.authority).toHaveBeenCalledTimes(14); expect(f.provider).toHaveBeenCalledTimes(5);
  expect(f.credentialCommand).not.toHaveBeenCalled();
});

it('does not acquire credentials or read providers after request cancellation', async () => {
  const f = fixture(), controller = new AbortController(); controller.abort();
  expect((await campaignHealthResponse(new Request(f.request(), { signal: controller.signal }))).status).toBe(503);
  expect(openMetaReportCredential).not.toHaveBeenCalled(); expect(f.provider).not.toHaveBeenCalled();
});

it.each(['authority', 'credential', 'switch'] as const)('fences %s revocation before the first report provider read', async reason => {
  const f = fixture(); f.command.mockImplementation(async action => {
    if (action === 'claim') { if (reason === 'authority') f.revoke(); else if (reason === 'credential') f.revokeCredential(); else vi.stubEnv('SANCTUARY_CAMPAIGN_MONITOR_ENABLED', 'false'); return { operation: id, generation: 1 }; }
    return {};
  });
  expect((await campaignHealthResponse(f.request())).status).toBe(503); expect(f.provider).not.toHaveBeenCalled();
  expect(f.command.mock.calls.map(([action]) => action)).toEqual(['claim', 'failed']);
  expect(f.credentialCommand.mock.calls.at(-1)?.[0]).toBe('finish');
});

it('fences authority revoked during provider read before recording or delivering success', async () => {
  const f = fixture(); f.provider.mockImplementationOnce(async () => f.revoke());
  expect((await campaignHealthResponse(f.request())).status).toBe(503); expect(f.provider).toHaveBeenCalledOnce();
  expect(f.command.mock.calls.map(([action]) => action)).toEqual(['claim', 'before', 'failed']);
});

it('fences delivery after outcome retrieval without re-reading any provider', async () => {
  const f = fixture(); vi.mocked(supabaseServiceRole.rpc).mockImplementation(name => ({ abortSignal: async () => { if(name==='meta_creative_reporting_registry')return {data:[],error:null};f.revoke();return {error:true}; } }) as never);
  expect((await campaignHealthResponse(f.request())).status).toBe(503); expect(f.provider).toHaveBeenCalledTimes(5);
  expect(f.command.mock.calls.some(([action]) => action === 'complete')).toBe(true);
  expect(f.command.mock.calls.some(([action]) => action === 'deliver')).toBe(false);
  expect(f.credentialCommand.mock.calls.at(-1)?.[0]).toBe('finish');
});

it('fences authority changed during registry retrieval before any report read', async () => {
 const f=fixture();vi.mocked(supabaseServiceRole.rpc).mockReturnValue({abortSignal:async()=>{f.revoke();return {data:[],error:null};}} as never);
 expect((await campaignHealthResponse(f.request())).status).toBe(503);expect(f.provider).toHaveBeenCalledTimes(2);
 expect(f.command.mock.calls.some(([action])=>action==='complete')).toBe(false);
});
