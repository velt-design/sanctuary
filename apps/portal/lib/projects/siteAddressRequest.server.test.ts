import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(), update: vi.fn(), search: vi.fn(), validate: vi.fn(), provider: vi.fn(), row: null as any, error: null as unknown }));
vi.mock('@/lib/api/staffApi', () => ({ requireStaffContext: mocks.auth, jsonOk: (body: unknown) => Response.json(body),
  jsonError: (error: string, status: number, _diagnostics: unknown, extra: object) => Response.json({ error, ...extra }, { status }) }));
vi.mock('./siteAddressProvider.server', async original => {
  const actual = await original<typeof import('./siteAddressProvider.server')>();
  return { ...actual, googleSiteAddressProvider: mocks.provider };
});
import { projectSiteAddressRequest } from './siteAddressRequest.server';
import { GET, POST } from '@/app/api/projects/[projectId]/site-address/route';

// Synthetic HTTP -> real domain -> synthetic caller/RLS client/provider. No real database/provider verification.
const id = '10000000-0000-4000-8000-000000000001', projectId = `proj_${id}`;
const original = { id, site_address: 'Previous project text', updated_at: '2026-10-28T01:00:00Z' };
const selection = { action: 'select', requestId: id, placeId: 'fixture_place', address: '12 Example Road, Auckland, New Zealand', sessionToken: id, expectedUpdatedAt: original.updated_at };
beforeEach(() => {
  vi.resetAllMocks(); process.env.ENABLE_PORTAL_DESIGN_STUDIO = '1'; mocks.row = { ...original }; mocks.error = null;
  const chain: any = { select: mocks.select, eq: mocks.eq, update: mocks.update, abortSignal: () => chain,
    maybeSingle: async () => ({ data: mocks.row, error: mocks.error }) };
  mocks.select.mockReturnValue(chain); mocks.eq.mockReturnValue(chain); mocks.from.mockReturnValue(chain);
  mocks.update.mockImplementation(patch => { mocks.row = { ...mocks.row, ...patch }; return chain; });
  mocks.auth.mockResolvedValue({ ok: true, session: { role: 'staff', user: { id: 'fixture-actor' } }, supabase: { from: mocks.from } });
  mocks.search.mockResolvedValue([{ placeId: selection.placeId, address: selection.address }]);
  mocks.validate.mockImplementation(async input => input.address);
  mocks.provider.mockReturnValue({ search: mocks.search, validateSelection: mocks.validate });
});
async function call(body?: unknown, method = body === undefined ? 'GET' : 'POST') {
  return projectSiteAddressRequest(new Request('http://localhost/site-address', { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), projectId);
}
it('refuses a foreign browser origin before project reads or provider work',async()=>{
 const response=await POST(new Request('http://localhost/site-address',{method:'POST',headers:{origin:'https://foreign.invalid'},body:JSON.stringify(selection)}),{params:Promise.resolve({projectId})});
 expect(response.status).toBe(403);expect(mocks.from).not.toHaveBeenCalled();expect(mocks.provider).not.toHaveBeenCalled();expect(mocks.update).not.toHaveBeenCalled();
});
it('reads canonical text without provider initialization or durable validation metadata', async () => {
  const response = await GET(new Request('http://localhost/site-address'), { params: Promise.resolve({ projectId }) });
  expect(await response.json()).toEqual({ siteAddress: { projectId, address: original.site_address, updatedAt: original.updated_at } });
  expect(response.headers.get('cache-control')).toBe('private, no-store'); expect(mocks.provider).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled();
});
it('checks fresh staff/project access before autocomplete and stores nothing on search', async () => {
  const command = { action: 'search', query: '12 Example', sessionToken: id }, response = await call(command);
  expect(await response.json()).toEqual({ suggestions: [{ placeId: selection.placeId, address: selection.address }] });
  expect(mocks.auth.mock.invocationCallOrder[0]).toBeLessThan(mocks.from.mock.invocationCallOrder[0]);
  expect(mocks.from.mock.invocationCallOrder[0]).toBeLessThan(mocks.search.mock.invocationCallOrder[0]); expect(mocks.update).not.toHaveBeenCalled();
});
it('runs the thin POST route through selected validation and exact two-column CAS, then reconciles retry without a second write', async () => {
  const request = () => new Request('http://localhost/site-address', { method: 'POST', body: JSON.stringify(selection) });
  const response = await POST(request(), { params: Promise.resolve({ projectId }) }), saved = await response.json();
  expect(response.status).toBe(200); expect(saved.siteAddress.address).toBe(selection.address); expect(mocks.update).toHaveBeenCalledOnce();
  expect(Object.keys(mocks.update.mock.calls[0][0]).sort()).toEqual(['site_address', 'updated_at']);
  expect(mocks.validate.mock.invocationCallOrder[0]).toBeLessThan(mocks.update.mock.invocationCallOrder[0]);
  const replay = await POST(request(), { params: Promise.resolve({ projectId }) });
  expect((await replay.json()).siteAddress.address).toBe(selection.address); expect(mocks.validate).toHaveBeenCalledTimes(2); expect(mocks.update).toHaveBeenCalledOnce();
});
it.each([401, 403])('performs zero business/provider work after fresh access denial (%s)', async status => {
  mocks.auth.mockResolvedValue({ ok: false, response: Response.json({ error: 'Denied' }, { status }) });
  const response = await call(selection); expect(response.status).toBe(status); expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(mocks.from).not.toHaveBeenCalled(); expect(mocks.provider).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled();
});
it('rejects non-staff roles and inaccessible/foreign project rows before external work', async () => {
  mocks.auth.mockResolvedValueOnce({ ok: true, session: { role: 'customer' }, supabase: { from: mocks.from } });
  expect((await call(selection)).status).toBe(403); expect(mocks.from).not.toHaveBeenCalled();
  mocks.row = null; expect((await call(selection)).status).toBe(404);
  mocks.row = { ...original, id: 'foreign' }; expect((await call(selection)).status).toBe(503); expect(mocks.provider).not.toHaveBeenCalled();
});
it.each([{ action: 'select', address: 'arbitrary text' }, { ...selection, confirmed: true }, { action: 'search', query: '1', sessionToken: id }])('refuses invalid commands before business/provider work: %j', async command => {
  expect((await call(command)).status).toBe(400); expect(mocks.from).not.toHaveBeenCalled(); expect(mocks.provider).not.toHaveBeenCalled();
});
it('does not write on provider rejection and hides raw unexpected/provider failures', async () => {
  const { SiteAddressError } = await import('./siteAddressProvider.server');
  mocks.validate.mockRejectedValueOnce(new SiteAddressError('Choose a complete physical NZ address.', 422, 'ADDRESS_NOT_CONFIRMED'));
  expect((await call(selection)).status).toBe(422); expect(mocks.update).not.toHaveBeenCalled();
  mocks.validate.mockRejectedValueOnce(Error('secret-provider-response-and-key'));
  const response = await call(selection); expect(response.status).toBe(503); expect(await response.text()).not.toContain('secret-provider'); expect(mocks.update).not.toHaveBeenCalled();
});
it('keeps configuration unavailable honest with the real provider factory and no fixture fallback', async () => {
  const actual = await vi.importActual<typeof import('./siteAddressProvider.server')>('./siteAddressProvider.server');
  mocks.provider.mockReturnValue(actual.googleSiteAddressProvider(vi.fn(), ''));
  const response = await call({ action: 'search', query: '12 Example', sessionToken: id }), body = await response.json();
  expect(response.status).toBe(503); expect(body.code).toBe('ADDRESS_NOT_CONFIGURED'); expect(body.error).toContain('not configured'); expect(mocks.update).not.toHaveBeenCalled();
});
it('rejects malformed, oversized, unsupported and disabled requests without provider work', async () => {
  expect((await projectSiteAddressRequest(new Request('http://localhost', { method: 'POST', body: '{broken' }), projectId)).status).toBe(400);
  expect((await projectSiteAddressRequest(new Request('http://localhost', { method: 'POST', body: 'a'.repeat(2049) }), projectId)).status).toBe(413);
  expect((await call(undefined, 'DELETE')).status).toBe(405);
  expect((await projectSiteAddressRequest(new Request('http://localhost'), 'wrong')).status).toBe(400);
  process.env.ENABLE_PORTAL_DESIGN_STUDIO = '0'; expect((await call(selection)).status).toBe(404);
  expect(mocks.provider).not.toHaveBeenCalled(); expect(mocks.from).not.toHaveBeenCalled();
});
