// @vitest-environment node
import { AsyncLocalStorage } from 'node:async_hooks';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

type RequestContext = { cache: Map<unknown, unknown>; headers: Headers; client: unknown };
const context = new AsyncLocalStorage<RequestContext>();
vi.mock('react', () => ({ cache: (read: () => unknown) => () => {
  const current = context.getStore()!;
  if (!current.cache.has(read)) current.cache.set(read, read());
  return current.cache.get(read);
} }));
vi.mock('next/headers', () => ({ headers: async () => context.getStore()!.headers }));
vi.mock('@/lib/supabase/serverClient', () => ({ getSupabaseServerAuth: async () => context.getStore()!.client }));
vi.mock('next/navigation', () => ({ redirect: (href: string) => { throw new Error(`redirect:${href}`); } }));

import { prepareProxyDocumentDiagnostics } from './documentDiagnostics';
import { getDocumentRenderDiagnostics } from './documentRenderDiagnostics';
import { getPortalAccessState, getPortalSession, requireStaffPageAccess } from '../auth';
import { resolvePortalAccessState, type PortalAccessLookup } from '../portalAccess';

beforeEach(() => {
  vi.stubEnv('PORTAL_DOCUMENT_DIAGNOSTICS', JSON.stringify({ until: new Date(Date.now() + 60_000).toISOString(), nonce: 'A'.repeat(43) }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

function client(id: string, role: string | null = 'staff') {
  const getUser = vi.fn(async () => ({ data: { user: { id, email: `${id}@example.test` } }, error: null }));
  const maybeSingle = vi.fn(async () => ({ data: role ? { role } : null, error: null }));
  return { auth: { getUser }, from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }), maybeSingle };
}

it('shares one actual auth lookup within each simulated render context and isolates concurrent request carriers', async () => {
  const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  const reads = ['private-one', 'private-two'].map((id,index) => {
    const db = client(id);
    const prepared = prepareProxyDocumentDiagnostics(new Request(`https://portal.example${index?'/staff/marketing-performance':'/staff/projects'}`, {
      headers: { accept: 'text/html', 'sec-fetch-dest': 'document' },
    }));
    return context.run({ cache: new Map(), headers: prepared.requestHeaders!, client: db }, async () => {
      const [state, session, required, scope] = await Promise.all([
        getPortalAccessState(), getPortalSession(), requireStaffPageAccess('/staff/projects'), getDocumentRenderDiagnostics(),
      ]);
      expect(state.kind).toBe('authenticated');
      expect(session?.user.id).toBe(id);
      expect(required.user.id).toBe(id);
      expect(db.auth.getUser).toHaveBeenCalledTimes(1);
      expect(db.maybeSingle).toHaveBeenCalledTimes(1);
      return scope!.id;
    });
  });
  const ids = await Promise.all(reads);
  expect(new Set(ids).size).toBe(2);
  for (const id of ids) {
    expect(log.mock.calls.map((call) => call[1]).filter((event) => event.requestId === id).map((event) => event.phase))
      .toEqual(['rsc.identity', 'rsc.role', 'rsc.access']);
  }
  expect(JSON.stringify(log.mock.calls)).not.toMatch(/private-|example.test/);
});

it('preserves access and thrown error identity when the pure optional observer throws or rejects', async () => {
  for (const observer of [() => { throw new Error('logger'); }, () => Promise.reject(new Error('logger'))]) {
    const db = client('private-user');
    expect(await resolvePortalAccessState(db, observer)).toEqual(await resolvePortalAccessState(db));
    const failure = new Error('private-auth-error');
    const failed: PortalAccessLookup = { ...db, auth: { getUser: async () => { throw failure; } } };
    await expect(resolvePortalAccessState(failed, observer)).rejects.toBe(failure);
  }
});

it('does not add an identity lookup on a denied cached render and preserves its redirect', async () => {
  const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  const db = client('private-denied', null);
  const prepared = prepareProxyDocumentDiagnostics(new Request('https://portal.example/staff/site-visits', {
    headers: { accept: 'text/html', 'sec-fetch-dest': 'document' },
  }));
  await context.run({ cache: new Map(), headers: prepared.requestHeaders!, client: db }, async () => {
    expect((await getPortalAccessState()).kind).toBe('no_access');
    await expect(requireStaffPageAccess('/staff/site-visits')).rejects.toThrow('redirect:/access-status?');
    expect(db.auth.getUser).toHaveBeenCalledTimes(1);
    expect(db.maybeSingle).toHaveBeenCalledTimes(1);
  });
  expect(log.mock.calls.at(-1)?.[1]).toMatchObject({ phase: 'rsc.access', outcome: 'no_access' });
});
