import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { GET, POST } from './route';

// Secrets and API replies are synthetic; fixed nonsecret target IDs match the route.
// No SDK, database or hosting call occurs.
const token = 'SYNTHETIC-PRIVATE-SOURCE-BEARER-CANARY';
const platformToken = 'SYNTHETIC-PRIVATE-PLATFORM-TOKEN-CANARY';
const nonce = 'a'.repeat(64), origin = 'https://portal.sanctuarypergolas.co.nz';
const path = '/api/integrations/praxis/portal-service-transfer';
const owner = 'rGPHGaegAnst8s6Zl1VZswuH', team = 'team_yTur5DT5THIdiLGLK1OVLA2V';
const source = 'prj_nrpZyDHk8RqDXHGax7gnvDlnO5t8', target = 'prj_OC02Z3DAPPxlnGAZwgnlOFJ0rGyo';
const key = 'VELT_PORTAL_SERVICE_TOKEN', admissionKey = 'PRAXIS_PORTAL_SERVICE_TRANSFER_ADMISSION';
const entry = { id: 'synthetic-destination-id', key, type: 'sensitive', target: ['production'] };
const sourceEntry = { id: 'tEbVThmpe5owqeHN', key: 'PRAXIS_SANCTUARY_READ_TOKEN', type: 'sensitive', target: ['production'] };
const issued = '2026-10-22T00:30:00.000Z', expires = '2026-10-22T00:45:00.000Z';
let destination: unknown[], fetcher: ReturnType<typeof vi.fn<typeof fetch>>;
const req = (body: unknown = { nonce, platformToken }, suffix = '', headers: Record<string, string> = {}) => new Request(`${origin}${path}${suffix}`, {
  method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
const creates = () => fetcher.mock.calls.filter(([, init]) => init?.method === 'POST');
function admission(extra = {}) { return JSON.stringify({ nonceSha256: createHash('sha256').update(nonce).digest('hex'), issuedAt: issued, expiresAt: expires, ...extra }); }
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-22T00:31:00Z')); destination = [];
  for (const [name, value] of Object.entries({ VERCEL_ENV: 'production', VERCEL_PROJECT_ID: source,
    [admissionKey]: admission(), PRAXIS_SANCTUARY_READ_TOKEN: token, PRAXIS_SANCTUARY_SOURCE_KEY: 'sanctuary',
    PRAXIS_SANCTUARY_CONNECTION_ID: '9200594e-1f1c-4d8e-b6d8-128a1ccdbdea', PRAXIS_SANCTUARY_ENVIRONMENT: 'production',
    PRAXIS_SANCTUARY_DATABASE_URL: 'postgresql://synthetic:synthetic@database.example.test/synthetic?sslmode=verify-full' })) vi.stubEnv(name, value);
  fetcher = vi.fn<typeof fetch>(async (url, init) => {
    const parsed = new URL(String(url));
    expect(parsed.origin).toBe('https://api.vercel.com');
    expect(init).toMatchObject({ redirect: 'error', cache: 'no-store', headers: { authorization: `Bearer ${platformToken}` } });
    if (parsed.pathname === '/v2/user') return Response.json({ user: { id: owner } });
    expect(parsed.searchParams.get('teamId')).toBe(team);
    if (parsed.pathname.startsWith('/v9/projects/')) return Response.json({ id: parsed.pathname.split('/').at(-1), accountId: team });
    if (parsed.pathname === `/v10/projects/${source}/env`) return Response.json({ envs: [sourceEntry] });
    expect(parsed.pathname).toBe(`/v10/projects/${target}/env`);
    if (init?.method === 'POST') { expect(destination).toEqual([]); destination = [entry]; return Response.json({ ...entry, value: token }); }
    return Response.json({ envs: destination });
  });
  vi.stubGlobal('fetch', fetcher);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('transfers the existing runtime bearer once, using only the fixed production sensitive target', async () => {
  const response = await POST(req()); expect(response.status).toBe(201); expect(await response.json()).toEqual({ state: 'installed' });
  expect(response.headers.get('cache-control')).toContain('no-store'); expect(creates()).toHaveLength(1);
  expect(creates()[0]?.[0]).toBe(`https://api.vercel.com/v10/projects/${target}/env?teamId=${team}`);
  expect(JSON.parse(String(creates()[0]?.[1]?.body))).toEqual({ key, value: token, type: 'sensitive', target: ['production'] });
  expect(fetcher).toHaveBeenCalledTimes(7);
  expect(await (await POST(req())).json()).toEqual({ state: 'existing' }); expect(creates()).toHaveLength(1);
});
it.each(['preview', 'production', 'development'])('never overwrites an existing key in %s', async targetName => {
  destination = [{ ...entry, target: [targetName] }]; expect(await (await POST(req())).json()).toEqual({ state: 'existing' }); expect(creates()).toHaveLength(0);
});
it.each(['missing', 'expired', 'future', 'too_long', 'wrong_nonce', 'preview', 'wrong_project', 'wrong_source', 'wrong_connection', 'wrong_environment'])('denies before API access: %s', async mode => {
  if (mode === 'missing') vi.stubEnv(admissionKey, undefined);
  if (mode === 'expired') vi.stubEnv(admissionKey, admission({ expiresAt: issued }));
  if (mode === 'future') vi.stubEnv(admissionKey, admission({ issuedAt: '2026-10-22T00:32:00.000Z' }));
  if (mode === 'too_long') vi.stubEnv(admissionKey, admission({ expiresAt: '2026-10-22T00:45:00.001Z' }));
  if (mode === 'preview') vi.stubEnv('VERCEL_ENV', 'preview');
  if (mode === 'wrong_project') vi.stubEnv('VERCEL_PROJECT_ID', target);
  if (mode === 'wrong_source') vi.stubEnv('PRAXIS_SANCTUARY_SOURCE_KEY', 'other');
  if (mode === 'wrong_connection') vi.stubEnv('PRAXIS_SANCTUARY_CONNECTION_ID', '10000000-0000-4000-8000-000000000001');
  if (mode === 'wrong_environment') vi.stubEnv('PRAXIS_SANCTUARY_ENVIRONMENT', 'staging');
  expect((await POST(req({ nonce: mode === 'wrong_nonce' ? 'b'.repeat(64) : nonce, platformToken }))).status).toBeGreaterThanOrEqual(400);
  expect(fetcher).not.toHaveBeenCalled();
});
it.each(['owner', 'team', 'project', 'source_secret_id', 'source_secret_type', 'source_secret_target'])('refuses a platform identity/metadata mismatch: %s', async mode => {
  const normal = fetcher.getMockImplementation()!;
  fetcher.mockImplementation(async (url, init) => {
    const value = String(url);
    if (mode === 'owner' && value.endsWith('/v2/user')) return Response.json({ user: { id: 'other' } });
    if (['team', 'project'].includes(mode) && value.includes('/v9/')) return Response.json({ id: mode === 'project' ? 'other' : value.includes(source) ? source : target, accountId: mode === 'team' ? 'other' : team });
    if (mode.startsWith('source_secret') && value.includes(`/v10/projects/${source}/env`)) return Response.json({ envs: [{ ...sourceEntry,
      ...(mode === 'source_secret_id' ? { id: 'other' } : mode === 'source_secret_type' ? { type: 'plain' } : { target: ['preview'] }) }] });
    return normal(url, init);
  });
  expect((await POST(req())).status).toBe(403); expect(creates()).toHaveLength(0);
});
it.each(['admission', 'source', 'expiry'])('rechecks authority immediately before the create: %s', async mode => {
  const normal = fetcher.getMockImplementation()!;
  fetcher.mockImplementation(async (url, init) => {
    const response = await normal(url, init);
    if (String(url).includes(`/v10/projects/${target}/env`)) {
      if (mode === 'admission') vi.stubEnv(admissionKey, undefined);
      if (mode === 'source') vi.stubEnv('PRAXIS_SANCTUARY_READ_TOKEN', `${token}-changed`);
      if (mode === 'expiry') vi.setSystemTime(new Date(expires));
    }
    return response;
  });
  expect((await POST(req())).status).toBe(503); expect(creates()).toHaveLength(0);
});
it.each([false, true])('reconciles an uncertain POST through metadata only (present=%s)', async present => {
  const normal = fetcher.getMockImplementation()!;
  fetcher.mockImplementation(async (url, init) => {
    if (init?.method === 'POST') { if (present) destination = [entry]; throw new Error(`${token} ${platformToken}`); }
    return normal(url, init);
  });
  expect(await (await POST(req())).json()).toEqual({ state: present ? 'present_unconfirmed' : 'unconfirmed' });
  expect(creates()).toHaveLength(1); expect(fetcher).toHaveBeenCalledTimes(7);
  if (present) { expect(await (await POST(req())).json()).toEqual({ state: 'existing' }); expect(creates()).toHaveLength(1); }
});
it('does not call metadata presence proof of value equality when Vercel reports failures', async () => {
  const normal = fetcher.getMockImplementation()!;
  fetcher.mockImplementation(async (url, init) => init?.method === 'POST'
    ? (destination = [entry], Response.json({ created: [entry], failed: [{ error: token }] })) : normal(url, init));
  expect(await (await POST(req())).json()).toEqual({ state: 'present_unconfirmed' }); expect(creates()).toHaveLength(1);
});
it('handles the documented batch create reply and requires matching final production metadata', async () => {
  const normal = fetcher.getMockImplementation()!;
  fetcher.mockImplementation(async (url, init) => init?.method === 'POST'
    ? (destination = [entry], Response.json({ created: [entry], failed: [] })) : normal(url, init));
  expect(await (await POST(req())).json()).toEqual({ state: 'installed' }); expect(creates()).toHaveLength(1);
});
it('does not retry a concurrent no-upsert conflict or expose its raw error', async () => {
  const normal = fetcher.getMockImplementation()!;
  fetcher.mockImplementation(async (url, init) => init?.method === 'POST'
    ? (destination = [entry], new Response(`${token} ${platformToken}`, { status: 409 })) : normal(url, init));
  expect(await (await POST(req())).json()).toEqual({ state: 'present_unconfirmed' }); expect(creates()).toHaveLength(1);
});
it.each(['extra', 'query', 'cross_origin', 'oversize'])('rejects caller-controlled destinations and invalid requests: %s', async mode => {
  const request = mode === 'oversize' ? req({ nonce, platformToken: 'x'.repeat(5000) })
    : req({ nonce, platformToken, ...(mode === 'extra' ? { url: 'https://other.example.test', value: token } : {}) }, mode === 'query' ? '?token=synthetic' : '', mode === 'cross_origin' ? { origin: 'https://other.example.test' } : {});
  expect((await POST(request)).status).toBeGreaterThanOrEqual(400); expect(fetcher).not.toHaveBeenCalled();
});
it('never logs or returns either secret, nonce, or raw platform failure', async () => {
  const logs = [vi.spyOn(console, 'log'), vi.spyOn(console, 'warn'), vi.spyOn(console, 'error')];
  fetcher.mockRejectedValue(new Error(`${token} ${platformToken} ${nonce}`));
  const body = await (await POST(req())).text();
  for (const secret of [token, platformToken, nonce]) expect(body).not.toContain(secret);
  for (const log of logs) expect(log).not.toHaveBeenCalled(); expect(creates()).toHaveLength(0);
});
it('keeps the approved platform-auth API outside staff document/session middleware', () => {
  const sourceText = readFileSync('apps/portal/middleware.ts', 'utf8');
  const matcher = sourceText.match(/matcher:\s*(\[[^\n]+\])/u)?.[1];
  expect(matcher).toBe("['/((?!_next|api).*)']");
  expect(unstable_doesMiddlewareMatch({ config: { matcher: ['/((?!_next|api).*)'] }, nextConfig: {}, url: `${origin}${path}` })).toBe(false);
});
it('lets the operator confirm the exact deployed SHA before sending any secret', async () => {
  const releaseSha = 'd'.repeat(40); vi.stubEnv('VERCEL_GIT_COMMIT_SHA', releaseSha);
  vi.stubEnv(admissionKey, undefined); vi.stubEnv('PRAXIS_SANCTUARY_READ_TOKEN', undefined);
  const response = GET(new Request(`${origin}${path}`));
  expect(response.status).toBe(200); expect(await response.json()).toEqual({ releaseSha });
  expect(response.headers.get('cache-control')).toContain('no-store'); expect(fetcher).not.toHaveBeenCalled();
});
it.each(['missing', 'invalid', 'preview', 'project', 'origin', 'query'])('version GET fails closed: %s', async mode => {
  vi.stubEnv('VERCEL_GIT_COMMIT_SHA', mode === 'missing' ? undefined : mode === 'invalid' ? token : 'd'.repeat(40));
  if (mode === 'preview') vi.stubEnv('VERCEL_ENV', 'preview');
  if (mode === 'project') vi.stubEnv('VERCEL_PROJECT_ID', target);
  const response = GET(new Request(`${mode === 'origin' ? 'https://other.example.test' : origin}${path}${mode === 'query' ? '?extra=1' : ''}`));
  expect(response.status).toBe(403); expect(await response.json()).toEqual({ state: 'denied' }); expect(fetcher).not.toHaveBeenCalled();
});
