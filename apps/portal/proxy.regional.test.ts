// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { DOCUMENT_CALLBACK_HEADER } from './lib/regionalDocumentAccess';
import { DOCUMENT_CARRIER_HEADER } from './lib/performance/documentDiagnostics';

const h = vi.hoisted(() => ({ session: vi.fn(), user: vi.fn(), role: vi.fn(), cookies: [] as any[] }));
vi.mock('@supabase/ssr', () => ({ createServerClient: (_url: string, _key: string, options: any) => ({
  auth: {
    getSession: async () => { options.cookies.setAll(h.cookies); return h.session(); },
    getUser: h.user,
  },
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: h.role }) }) }),
}) }));
import { middleware } from './middleware';

const documentHeaders = { 'sec-fetch-dest': 'document', accept: 'text/html' };
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'synthetic');
  vi.stubEnv('PORTAL_DOCUMENT_DIAGNOSTICS', '');
  h.session.mockResolvedValue({ data: { session: { user: { role: 'admin' } } }, error: null });
  h.user.mockResolvedValue({ data: { user: null }, error: null });
  h.role.mockResolvedValue({ data: null, error: null });
  h.cookies = [];
});
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

it.each(['/staff/projects', '/staff/site-visits', '/staff/marketing-performance', '/staff/projects/proj_00000000-0000-4000-8000-000000000001', '/staff/projects/00000000-0000-4000-8000-000000000001'])('defers only %s document authority to regional checks', async path => {
  const callback = `${path}?q=one&q=two&tab=activity`;
  const response = await middleware(new NextRequest(`https://portal.example${callback}`, { headers: { ...documentHeaders, [DOCUMENT_CALLBACK_HEADER]: '/staff/projects?spoof=1' } }));
  expect(h.session).toHaveBeenCalledOnce();
  expect(h.user).not.toHaveBeenCalled();
  expect(h.role).not.toHaveBeenCalled();
  expect(response.headers.get(`x-middleware-request-${DOCUMENT_CALLBACK_HEADER}`)).toBe(callback);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
});

it.each(['/staff/marketing-performance/child', '/staff/marketing-performance-extra', '/staff/projects/new', '/staff/projects/work-queue', '/staff/projects/proj_1', '/staff/projects/proj_00000000-0000-4000-8000-000000000001/estimate/a', '/projects', '/admin', '/dashboard'])('keeps full global authority for %s', async path => {
  const response = await middleware(new NextRequest(`https://portal.example${path}`, { headers: { ...documentHeaders, [DOCUMENT_CALLBACK_HEADER]: '/staff/projects' } }));
  expect(h.session).not.toHaveBeenCalled();
  expect(h.user).toHaveBeenCalledOnce();
  expect(response.status).toBe(307);
  expect(response.headers.get(`x-middleware-request-${DOCUMENT_CALLBACK_HEADER}`)).toBeNull();
});

it.each(['/staff/projects','/staff/marketing-performance'].flatMap(path=>[{ rsc: '1' }, { 'next-router-prefetch': '1' }, { 'next-router-segment-prefetch': '/_tree' }, { 'next-action': 'synthetic' }, { purpose: 'prefetch' }, { 'sec-purpose': 'prefetch;prerender' }, { 'sec-fetch-dest': 'empty' }, { accept: 'text/x-component' }].map(extra=>({path,extra}))))('retains full checks for request variant %j', async ({path,extra}) => {
  const headers = new Headers(documentHeaders);
  for (const [name, value] of Object.entries(extra)) if (value !== undefined) headers.set(name, value);
  const response = await middleware(new NextRequest(`https://portal.example${path}`, { headers }));
  expect(h.session).not.toHaveBeenCalled();
  expect(h.user).toHaveBeenCalledOnce();
  expect(response.status).toBe(307);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
});

it.each(['/staff/projects','/staff/marketing-performance'])('retains full checks for POST %s and strips spoofed context from API pass-through', async path => {
  await middleware(new NextRequest(`https://portal.example${path}`, { method: 'POST', headers: documentHeaders }));
  expect(h.session).not.toHaveBeenCalled();
  expect(h.user).toHaveBeenCalledOnce();
  const response = await middleware(new NextRequest('https://portal.example/api/staff/v1/marketing-performance/hub', { headers: { [DOCUMENT_CALLBACK_HEADER]: path } }));
  expect(response.headers.get(`x-middleware-request-${DOCUMENT_CALLBACK_HEADER}`)).toBeNull();
});

it('forwards rotated chunks and removals alongside the exact response cookies and diagnostic headers', async () => {
  vi.stubEnv('PORTAL_DOCUMENT_DIAGNOSTICS', JSON.stringify({ until: new Date(Date.now() + 60_000).toISOString(), nonce: 'A'.repeat(43) }));
  const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  h.cookies = [{ name: 'session.0', value: '', options: { maxAge: 0, path: '/' } }, { name: 'session.1', value: '', options: { maxAge: 0, path: '/' } }, { name: 'session', value: 'rotated', options: { httpOnly: true, sameSite: 'lax', path: '/' } }];
  const response = await middleware(new NextRequest('https://portal.example/staff/site-visits', { headers: { ...documentHeaders, cookie: 'session.0=old0; session.1=old1; unrelated=keep', [DOCUMENT_CARRIER_HEADER]: 'forged' } }));
  const forwarded = response.headers.get('x-middleware-request-cookie');
  expect(forwarded).toContain('session=rotated');
  expect(forwarded).toContain('unrelated=keep');
  expect(forwarded).not.toMatch(/old|session\.0|session\.1/);
  expect(response.cookies.get('session')?.value).toBe('rotated');
  expect(response.cookies.get('session.0')?.maxAge).toBe(0);
  expect(response.headers.get(`x-middleware-request-${DOCUMENT_CARRIER_HEADER}`)).not.toBe('forged');
  expect(JSON.stringify(log.mock.calls)).not.toMatch(/rotated|old0|old1/);
  log.mockRestore();
});

it('does not convert a transport failure or forged session role into authenticated state', async () => {
  h.session.mockResolvedValue({ data: { session: null }, error: { message: 'synthetic rejected refresh' } });
  const response = await middleware(new NextRequest('https://portal.example/staff/projects', { headers: documentHeaders }));
  expect(response.headers.get('x-middleware-next')).toBe('1');
  expect(response.headers.get('location')).toBeNull();
  expect(h.role).not.toHaveBeenCalled();
  h.session.mockRejectedValue(new Error('synthetic failure'));
  await expect(middleware(new NextRequest('https://portal.example/staff/projects', { headers: documentHeaders }))).rejects.toThrow('synthetic failure');
});
