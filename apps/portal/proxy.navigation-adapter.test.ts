// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { adapter } from 'next/dist/server/web/adapter';
import { DOCUMENT_CALLBACK_HEADER, NAVIGATION_CALLBACK_HEADER, REGIONAL_NAVIGATION_PATHS } from './lib/regionalDocumentAccess';
const h = vi.hoisted(() => ({ session: vi.fn(), user: vi.fn(), role: vi.fn() }));
vi.mock('@supabase/ssr', () => ({ createServerClient: () => ({
  auth: { getSession: h.session, getUser: h.user }, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: h.role }) }) }),
}) }));
import { middleware } from './middleware';
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.invalid'); vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'fictional');
  vi.stubEnv('PORTAL_DOCUMENT_DIAGNOSTICS', ''); vi.stubEnv('__NEXT_NO_MIDDLEWARE_URL_NORMALIZE', '');
  h.session.mockResolvedValue({ data: { session: null }, error: null }); h.user.mockResolvedValue({ data: { user: null }, error: null }); h.role.mockResolvedValue({ data: null, error: null });
});
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });
async function throughAdapter(path: string, extra: Record<string, string> = {}, method = 'GET') {
  return adapter({ page: 'middleware', request: {
    url: `https://portal.example${path}?_rsc=fictional&q=one`, method, signal: new AbortController().signal, nextConfig: {},
    // Actual Chromium request shape: Accept */*, fetch destination empty and
    // Next-Url. Its project identifier is fictional; it is not an access input.
    headers: { rsc: '1', 'next-router-state-tree': '["",{}]', accept: '*/*', 'sec-fetch-dest': 'empty',
      'next-url': '/staff/projects/proj_00000000-0000-4000-8000-000000000001', [DOCUMENT_CALLBACK_HEADER]: '/admin?forged=1', [NAVIGATION_CALLBACK_HEADER]: '/admin?forged=1', ...extra },
  }, handler: async request => {
    expect(request.headers.get('rsc')).toBeNull(); expect(request.headers.get('next-router-state-tree')).toBeNull();
    expect(request.headers.get('accept')).toBe(extra.accept ?? '*/*');
    return middleware(request);
  } });
}
it.each(REGIONAL_NAVIGATION_PATHS)('activates the fresh-server lane for adapter-normalized %s without middleware identity reads', async path => {
  const { response } = await throughAdapter(path);
  expect(h.session).toHaveBeenCalledOnce(); expect(h.user).not.toHaveBeenCalled(); expect(h.role).not.toHaveBeenCalled();
  expect(response.headers.get(`x-middleware-request-${NAVIGATION_CALLBACK_HEADER}`)).toBe(`${path}?q=one`);
  expect(response.headers.get(`x-middleware-request-${DOCUMENT_CALLBACK_HEADER}`)).toBeNull();
  expect(response.headers.get('x-middleware-request-rsc')).toBe('1');
  expect(response.headers.get('x-middleware-request-next-router-state-tree')).toBe('["",{}]');
  expect(response.headers.get('cache-control')).toBe('private, no-store');
});
const exclusions: Array<{ path: string; extra: Record<string, string> }> = [
  { path: '/staff/contacts', extra: { 'next-action': 'fictional' } },
  { path: '/staff/projects/work-queue', extra: { 'next-action': 'fictional' } },
  { path: '/staff/projects/work-queue', extra: { accept: 'application/json' } },
  { path: '/schedule', extra: {} }, { path: '/admin', extra: {} }, { path: '/staff/projects/work-queue/child', extra: {} },
];
it.each(exclusions)('retains original middleware authority outside the selected fetch shape: $path $extra', async ({ path, extra }) => {
  const { response } = await throughAdapter(path, extra);
  expect(h.session).not.toHaveBeenCalled(); expect(h.user).toHaveBeenCalledOnce(); expect(response.status).toBe(307);
  expect(response.headers.get(`x-middleware-request-${NAVIGATION_CALLBACK_HEADER}`)).toBeNull();
});
it.each(['/staff/contacts', '/staff/projects/work-queue'])('keeps %s actions outside the lane after real adapter normalization', async path => {
  const { response } = await throughAdapter(path, { 'next-action': 'fictional' }, 'POST');
  expect(h.session).not.toHaveBeenCalled(); expect(h.user).toHaveBeenCalledOnce(); expect(response.status).toBe(307);
});

it.each(REGIONAL_NAVIGATION_PATHS)('keeps document placement distinct after installed adapter normalization for %s', async path => {
  const {response} = await throughAdapter(path, {'sec-fetch-dest':'document',accept:'text/html'});
  expect(h.session).toHaveBeenCalledOnce();expect(h.user).not.toHaveBeenCalled();expect(h.role).not.toHaveBeenCalled();
  expect(response.headers.get('x-middleware-request-'+DOCUMENT_CALLBACK_HEADER)).toBe(path+'?q=one');
  expect(response.headers.get('x-middleware-request-'+NAVIGATION_CALLBACK_HEADER)).toBeNull();
  expect(response.headers.get('cache-control')).toBe('private, no-store');
});
