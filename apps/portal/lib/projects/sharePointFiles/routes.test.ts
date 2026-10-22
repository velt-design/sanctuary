import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), list: vi.fn(), graph: vi.fn(), download: vi.fn(), fetch: vi.fn() }));
vi.mock('@/lib/api/staffApi', () => ({ requireStaffContext: mocks.auth }));
vi.mock('@/lib/api/routeDiagnostics', () => ({ createRouteDiagnostics: () => ({}), applyRouteDiagnostics: (response: Response) => response }));
vi.mock('./server', () => ({ listProjectFiles: mocks.list, projectGraph: mocks.graph, inlineTypes: new Set(['application/pdf', 'image/png']) }));
import { GET as list } from '../../../app/api/staff/v1/projects/[projectId]/files/route';
import { GET as open } from '../../../app/api/staff/v1/projects/[projectId]/files/[itemId]/open/route';
const rootId = '11111111-1111-4111-8111-111111111111';
const ctx = { params: Promise.resolve({ projectId: 'proj_fixture', itemId: 'file' }) };
const request = (mode = 'download', headers = {}) => new Request(`https://portal.test/api/file?rootId=${rootId}&mode=${mode}`, { headers });
beforeEach(() => {
  vi.resetAllMocks(); vi.stubGlobal('fetch', mocks.fetch);
  mocks.auth.mockResolvedValue({ ok: true, supabase: {} });
  mocks.graph.mockResolvedValue({ root: { itemId: 'root' }, graph: { download: mocks.download } });
  mocks.download.mockResolvedValue({ item: { name: 'Original design.3dm', size: 500000000, file: { mimeType: 'application/octet-stream' } }, url: 'https://fixture.sharepoint.com/_layouts/15/download.aspx?ephemeral=secret' });
});
it('authenticates list and open before Graph or project access', async () => {
  mocks.auth.mockImplementation(async () => ({ ok: false, response: new Response(null, { status: 401 }) }));
  expect((await list(new Request('https://portal.test/api/files'), ctx)).status).toBe(401);
  expect((await open(request(), ctx)).status).toBe(401);
  expect(mocks.graph).not.toHaveBeenCalled(); expect(mocks.list).not.toHaveBeenCalled();
});
it('redirects a large original without proxying or caching its body', async () => {
  const response = await open(request(), ctx);
  expect(response.status).toBe(302); expect(response.headers.get('location')).toContain('download.aspx');
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(response.headers.get('referrer-policy')).toBe('no-referrer'); expect(mocks.fetch).not.toHaveBeenCalled();
});
it.each([200, 206])('streams safe inline content when range response is %s without forwarding authorization', async status => {
  mocks.download.mockResolvedValue({ item: { name: 'design.pdf', size: 123, file: { mimeType: 'application/pdf' } }, url: 'https://fixture.sharepoint.com/_layouts/15/download.aspx?ephemeral=secret' });
  mocks.fetch.mockResolvedValue(new Response('pdf', { status, headers: { 'content-range': 'bytes 0-2/123' } }));
  const response = await open(request('view', { range: 'bytes=0-2' }), ctx);
  expect(response.status).toBe(status); expect(await response.text()).toBe('pdf');
  expect(mocks.fetch.mock.calls[0][1].headers).toEqual({ Range: 'bytes=0-2' });
  expect(response.headers.get('content-disposition')).toContain('inline;');
});
it('rejects active formats and large previews while leaving downloads available', async () => {
  expect((await open(request('view'), ctx)).status).toBe(400);
  mocks.download.mockResolvedValue({ item: { name: 'active.svg', size: 100, file: { mimeType: 'image/svg+xml' } }, url: 'unused' });
  expect((await open(request('view'), ctx)).status).toBe(400);
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it('rejects unknown query fields before Graph and sanitizes provider failures', async () => {
  expect((await open(new Request(request().url + '&url=https://evil.test'), ctx)).status).toBe(400);
  expect(mocks.graph).not.toHaveBeenCalled();
  mocks.graph.mockRejectedValue(new Error('secret provider url and token'));
  const response = await open(request(), ctx);
  expect(response.status).toBe(503); expect(await response.text()).not.toContain('secret');
});
