// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ cookies: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: h.cookies }));
import { projectFileOpenIdentity } from './openIdentity';
const user = { id: '00000000-0000-4000-8000-000000000003', aud: 'authenticated', role: 'authenticated', email: 'synthetic@example.invalid', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const token = (expires: number) => [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: user.id, exp: expires, iat: expires - 3600, aud: 'authenticated', role: 'authenticated' })).toString('base64url'), 'synthetic-signature'].join('.');
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://fixture.supabase.co'); vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'synthetic-anon-key');
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
it('uses the existing SSR refresh/cookie mechanism once and passes the refreshed identity client to its RPC', async () => {
  const now = Math.floor(Date.now() / 1000), access = token(now + 3600);
  const initial = { access_token: token(now - 30), refresh_token: 'synthetic-refresh', expires_at: now - 30, expires_in: 3600, token_type: 'bearer', user };
  const jar = new Map([['sb-fixture-auth-token', 'base64-' + Buffer.from(JSON.stringify(initial)).toString('base64url')]]);
  const set = vi.fn(({ name, value }) => { jar.set(name, value); });
  h.cookies.mockResolvedValue({ getAll: () => [...jar].map(([name, value]) => ({ name, value })), set });
  const calls: { path: string; authorization: string | null }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url, init) => {
    const parsed = new URL(String(url)), headers = new Headers(init?.headers); calls.push({ path: parsed.pathname, authorization: headers.get('authorization') });
    if (parsed.pathname === '/auth/v1/token') return Response.json({ access_token: access, refresh_token: 'synthetic-next-refresh', expires_in: 3600, token_type: 'bearer', user });
    if (parsed.pathname === '/auth/v1/user') { expect(headers.get('authorization')).toBe('Bearer ' + access); return Response.json(user); }
    if (parsed.pathname === '/rest/v1/rpc/project_files_read') { expect(headers.get('authorization')).toBe('Bearer ' + access); return Response.json({ state: 'ready', roots: [] }); }
    throw new Error('Unexpected synthetic auth request');
  }));
  const client = await projectFileOpenIdentity(); expect(client).not.toBeNull();
  expect((await client!.rpc('project_files_read', { p_project_id: '00000000-0000-4000-8000-000000000001' })).error).toBeNull();
  expect(calls.map(call => call.path)).toEqual(['/auth/v1/token', '/auth/v1/user', '/rest/v1/rpc/project_files_read']);
  expect(set).toHaveBeenCalled();
  const stored = JSON.parse(Buffer.from(jar.get('sb-fixture-auth-token')!.slice(7), 'base64url').toString('utf8'));
  expect(stored.access_token).toBe(access); expect(stored.refresh_token).toBe('synthetic-next-refresh');
});
it('fails closed on an unrefreshable session without reading a role or calling the RPC', async () => {
  const now = Math.floor(Date.now() / 1000);
  const initial = { access_token: token(now - 30), refresh_token: 'revoked-synthetic-refresh', expires_at: now - 30, expires_in: 3600, token_type: 'bearer', user };
  const jar = new Map([['sb-fixture-auth-token', 'base64-' + Buffer.from(JSON.stringify(initial)).toString('base64url')]]);
  h.cookies.mockResolvedValue({ getAll: () => [...jar].map(([name, value]) => ({ name, value })), set: ({ name, value }: { name: string; value: string }) => { jar.set(name, value); } });
  const fetcher = vi.fn(async (_url: RequestInfo | URL) => Response.json({ message: 'Invalid Refresh Token', code: 'refresh_token_not_found' }, { status: 400 })); vi.stubGlobal('fetch', fetcher);
  expect(await projectFileOpenIdentity()).toBeNull(); expect(fetcher).toHaveBeenCalledTimes(1);
  expect(String(fetcher.mock.calls[0]?.[0])).toContain('/auth/v1/token');
});

it('rejects a server-ended session even when its cookie JWT has not expired', async () => {
  const expires = Math.floor(Date.now() / 1000) + 3600;
  const session = { access_token: token(expires), refresh_token: 'synthetic-refresh', expires_at: expires, expires_in: 3600, token_type: 'bearer', user };
  const jar = new Map([['sb-fixture-auth-token', 'base64-' + Buffer.from(JSON.stringify(session)).toString('base64url')]]);
  h.cookies.mockResolvedValue({ getAll: () => [...jar].map(([name, value]) => ({ name, value })), set: ({ name, value }: { name: string; value: string }) => { jar.set(name, value); } });
  const fetcher = vi.fn(async (_url: RequestInfo | URL) => Response.json({ message: 'Session ended', code: 'session_not_found' }, { status: 401 })); vi.stubGlobal('fetch', fetcher);
  expect(await projectFileOpenIdentity()).toBeNull(); expect(fetcher).toHaveBeenCalledTimes(1);
  expect(String(fetcher.mock.calls[0][0])).toContain('/auth/v1/user');
});
