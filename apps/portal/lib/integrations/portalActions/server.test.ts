// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), conversion: vi.fn(), admin: vi.fn() }));
vi.mock('@/lib/supabaseClient', () => ({ getSupabaseServiceRole: () => ({ rpc: mocks.rpc }) }));
vi.mock('@/lib/projects/workItems/lostConversion', () => ({ recordProjectLostConversion: mocks.conversion }));
vi.mock('@/lib/api/adminApi', () => ({ requireAdminContext: mocks.admin }));
import { handlePortalAction, actionSameOrigin } from './server';
import { issuePortalActionToken } from './token';
import { POST as issue, GET as list } from '@/app/api/admin/portal-actions/grants/route';
import { POST as revoke } from '@/app/api/admin/portal-actions/grants/revoke/route';
import { POST as preview } from '@/app/api/admin/portal-actions/grants/preview/route';

const token = issuePortalActionToken();
const commandId = '11111111-1111-4111-8111-111111111111';
const projectId = '22222222-2222-4222-8222-222222222222';
const committed = { project_id: projectId, commandId, command: 'CLOSE', outcome: 'LOST_BUDGET_PRICE', row_version: 2, replayed: false };
function request(body?: unknown, headers: Record<string, string> = {}) {
  return new Request('https://portal.example.test/api/action', {
    method: body === undefined ? 'GET' : 'POST',
    headers: { authorization: `Bearer ${token.token}`, 'content-type': 'application/json', origin: 'https://portal.example.test', ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('PORTAL_ACTIONS_ENABLED', '1'); vi.stubEnv('PORTAL_ACTIONS_ENVIRONMENT', 'staging');
  vi.stubEnv('PORTAL_ACTIONS_ORIGIN', 'https://portal.example.test');
  mocks.conversion.mockResolvedValue(undefined);
  mocks.admin.mockResolvedValue({ ok: true, supabase: { rpc: mocks.rpc } });
});

describe('Portal action HTTP boundary', () => {
  it('stays dark and refuses malformed credentials before any privileged call', async () => {
    vi.stubEnv('PORTAL_ACTIONS_ENABLED', '0');
    expect((await handlePortalAction(request(), 'connection')).status).toBe(503);
    vi.stubEnv('PORTAL_ACTIONS_ENABLED', '1');
    expect((await handlePortalAction(request(undefined, { authorization: 'invalid' }), 'connection')).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('forwards only hash and server environment for identity', async () => {
    mocks.rpc.mockResolvedValue({ data: { environment: 'staging' }, error: null });
    const response = await handlePortalAction(request(), 'connection');
    expect(mocks.rpc).toHaveBeenCalledWith('portal_action_connection', { p_token_hash: token.tokenHash, p_environment: 'staging' });
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(await response.text()).not.toContain(token.token);
  });
  it.each([{ commandId, projectId }, { commandId, actor: 'admin' }, { commandId, payload: {} }, {}])('rejects overrides before dispatch', async body => {
    expect((await handlePortalAction(request(body), 'commands')).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('bounds body even without content length', async () => {
    expect((await handlePortalAction(request({ commandId, extra: 'x'.repeat(1100) }), 'commands')).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each([['42501',403], ['PT409',409], ['40001',409], ['22023',400], ['XX000',503]])('sanitizes database error %s without retry', async (code, status) => {
    mocks.rpc.mockResolvedValue({ error: { code, message: token.token }, data: null });
    const response = await handlePortalAction(request({ commandId }), 'commands');
    expect(response.status).toBe(status);
    expect(await response.text()).not.toContain(token.token);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it('uses saved command only and returns committed receipt with independent read-back', async () => {
    const project = { projectId, state: 'CLOSED', rowVersion: 2, stage: 'SENT' };
    mocks.rpc.mockResolvedValueOnce({ data: committed, error: null }).mockResolvedValueOnce({ data: { projects: [project] }, error: null });
    const response = await handlePortalAction(request({ commandId }), 'commands');
    expect(mocks.rpc.mock.calls[0]).toEqual(['portal_action_execute', { p_token_hash: token.tokenHash, p_environment: 'staging', p_command_id: commandId }]);
    expect(await response.json()).toMatchObject({ committed: true, project, readBackRequired: false, conversionStatus: 'attempted' });
    expect(mocks.conversion).toHaveBeenCalledWith(expect.objectContaining({ projectId, commandId, outcome: committed.outcome, replayed: false }));
  });
  it('does not turn failed post-commit operations into a failed write', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: committed, error: null }).mockRejectedValueOnce(new Error('private detail'));
    mocks.conversion.mockRejectedValueOnce(new Error('private detail'));
    const response = await handlePortalAction(request({ commandId }), 'commands');
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ committed: true, readBackRequired: true, conversionStatus: 'retry_required' });
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });
  it('preserves replay flag for existing conversion repair policy', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { ...committed, replayed: true }, error: null }).mockResolvedValueOnce({ data: null, error: {} });
    await handlePortalAction(request({ commandId }), 'commands');
    expect(mocks.conversion).toHaveBeenCalledWith(expect.objectContaining({ replayed: true }));
  });
});

describe('Admin grant HTTP boundary', () => {
  it('pins origin independently of proxy rewriting and rejects unsafe configuration', () => {
    expect(actionSameOrigin(new Request('http://internal:3000/api/test', { headers: { origin: 'https://portal.example.test' } }))).toBe(true);
    for (const origin of ['', 'https://user:secret@portal.example.test', 'https://portal.example.test/path', 'http://portal.example.test']) {
      vi.stubEnv('PORTAL_ACTIONS_ORIGIN', origin); expect(actionSameOrigin(request())).toBe(false);
    }
    vi.stubEnv('PORTAL_ACTIONS_ORIGIN', 'http://127.0.0.1:3107');
    expect(actionSameOrigin(request(undefined, { origin: 'http://127.0.0.1:3107' }))).toBe(true);
    vi.stubEnv('PORTAL_ACTIONS_ENVIRONMENT', 'production');
    expect(actionSameOrigin(request(undefined, { origin: 'http://127.0.0.1:3107' }))).toBe(false);
  });
  it('previews while disabled but never claims the connection is enabled', async () => {
    vi.stubEnv('PORTAL_ACTIONS_ENABLED', '0');
    mocks.rpc.mockResolvedValue({ data: { environment: 'staging', enabled: true, projects: [], actions: [] }, error: null });
    const grant = { version: 'portal_actions_v1', environment: 'staging', taskReference: 'preview', label: 'preview',
      expiresAt: new Date(Date.now() + 3600000).toISOString(), projectIds: [projectId], actions: [] };
    const response = await preview(request(grant));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ enabled: false });
    expect(mocks.rpc.mock.calls[0][0]).toBe('portal_action_grant_preview');
  });
  it('allows authenticated grant inventory while disabled for recovery', async () => {
    vi.stubEnv('PORTAL_ACTIONS_ENABLED', '0');
    mocks.rpc.mockResolvedValue({ data: { grants: [] }, error: null });
    const response = await list();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ grants: [] });
    expect(mocks.rpc).toHaveBeenCalledWith('portal_action_grants_list');
  });
  it('rejects cross-origin credential issuance and revocation before authentication', async () => {
    expect((await issue(request({}, { origin: 'https://other.example.test' }))).status).toBe(403);
    expect((await revoke(request({}, { origin: 'https://other.example.test' }))).status).toBe(403);
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it('preserves admin denial', async () => {
    mocks.admin.mockResolvedValue({ ok: false, response: new Response('', { status: 403 }) });
    expect((await issue(request({}))).status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('issues raw token once while sending only its hash to the database', async () => {
    const grant = { version: 'portal_actions_v1', environment: 'staging', taskReference: 'synthetic task', label: 'test',
      expiresAt: new Date(Date.now() + 3600000).toISOString(), projectIds: [projectId], actions: [] };
    mocks.rpc.mockResolvedValue({ data: { grantId: commandId }, error: null });
    const response = await issue(request(grant));
    const body = await response.json();
    expect(response.status).toBe(201); expect(body.token).toMatch(/^spa1_[0-9a-f]{64}$/);
    expect(mocks.rpc.mock.calls[0][1].p_token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(mocks.rpc.mock.calls)).not.toContain(body.token);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
  it('rejects mismatched environment', async () => {
    expect((await issue(request({ version: 'portal_actions_v1', environment: 'production', taskReference: 'test', label: 'test',
      expiresAt: new Date(Date.now() + 3600000).toISOString(), projectIds: [projectId], actions: [] }))).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('keeps revocation available with kill switch disabled', async () => {
    vi.stubEnv('PORTAL_ACTIONS_ENABLED', '0');
    mocks.rpc.mockResolvedValue({ data: { revoked: true }, error: null });
    expect((await revoke(request({ grantId: commandId }))).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('portal_action_grant_revoke', { p_grant_id: commandId });
  });
});
