import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), list: vi.fn(), graph: vi.fn(), download: vi.fn(), fetch: vi.fn() }));
vi.mock('@/lib/api/staffApi', () => ({ requireStaffContext: mocks.auth }));
vi.mock('./server', () => ({ listProjectFiles: mocks.list, projectGraph: mocks.graph, inlineTypes: new Set(['application/pdf', 'image/png']) }));
import { GET as list } from '../../../app/api/staff/v1/projects/[projectId]/files/route';
import { GET as open } from '../../../app/api/staff/v1/projects/[projectId]/files/[itemId]/open/route';
import { ProjectFilesError } from './types';
import type { ProjectFilesTimingObserver } from './timing';
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
it('appends only finite static phases to successful staff-list timing without altering metadata or private headers', async () => {
  const payload = { state: 'ready', roots: [{ id: rootId, label: 'PRIVATE-FILENAME-CANARY' }], items: [], cursor: 'PRIVATE-CURSOR-CANARY' };
  mocks.list.mockImplementation(async (_db, _project, _input, assertion, observe: ProjectFilesTimingObserver) => {
    expect(assertion).toBe('PRIVATE-ASSERTION-CANARY');
    for (const phase of ['bindings_rpc', 'token', 'library', 'ancestry', 'children'] as const) observe(phase, 12.25);
    observe('children', NaN); observe('children', Infinity); observe('children', -1);
    observe('PRIVATE-PHASE-CANARY' as Parameters<ProjectFilesTimingObserver>[0], 10);
    return payload;
  });
  const response = await list(new Request(`https://portal.test/api/files?rootId=${rootId}`, { headers: { 'x-vercel-oidc-token': 'PRIVATE-ASSERTION-CANARY' } }), ctx);
  expect(response.status).toBe(200); expect(await response.text()).toBe(JSON.stringify(payload));
  expect(response.headers.get('cache-control')).toBe('private, no-store'); expect(response.headers.get('x-content-type-options')).toBe('nosniff'); expect(response.headers.get('referrer-policy')).toBe('no-referrer');
  const timing = response.headers.get('server-timing')!;
  expect(timing).not.toMatch(/PRIVATE|https|cursor|oidc|Bearer|proj_fixture/);
  const entries = timing.split(',').map(entry => entry.trim());
  expect(entries).toHaveLength(7);
  expect(entries.map(entry => entry.split(';')[0])).toEqual(['total', 'files_auth', 'files_bindings_rpc', 'files_token', 'files_library', 'files_ancestry', 'files_children']);
  expect(entries.every(entry => /^(?:total|files_[a-z_]+);dur=\d+\.\d$/.test(entry) && Number.isFinite(Number(entry.split('=')[1])))).toBe(true);
  mocks.list.mockImplementation(async (_db, _project, _input, _assertion, observe: ProjectFilesTimingObserver) => { observe('bindings_rpc', 2); return { state: 'pending', roots: [], items: [], cursor: null }; });
  const unready = await list(new Request('https://portal.test/api/files'), ctx);
  expect(unready.status).toBe(200);
  expect(unready.headers.get('server-timing')!.split(',').map(entry => entry.trim().split(';')[0])).toEqual(['total', 'files_auth', 'files_bindings_rpc']);
});
it('retains list denial, invalid-query and provider-error behavior without exposing partial timing phases', async () => {
  const invalid = await list(new Request('https://portal.test/api/files?extra=not-allowed'), ctx);
  expect(invalid.status).toBe(400); expect(mocks.list).not.toHaveBeenCalled(); expect(invalid.headers.get('server-timing')).not.toContain('files_');
  mocks.list.mockImplementation(async (_db, _project, _input, _assertion, observe: ProjectFilesTimingObserver) => { observe('token', 10); throw new ProjectFilesError('source_unavailable'); });
  const response = await list(new Request('https://portal.test/api/files'), ctx);
  expect(response.status).toBe(503); expect(await response.json()).toEqual({ error: 'Project files are temporarily unavailable. Please try again.', code: 'source_unavailable' });
  expect(response.headers.get('server-timing')).toMatch(/^total;dur=\d+\.\d$/);
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

it('forwards request cancellation to list and to the entire open provider path', async () => {
  const controller = new AbortController();
  mocks.list.mockResolvedValue({ state: 'unlinked', roots: [], items: [] });
  const listing = new Request('https://portal.test/api/files', { signal: controller.signal });
  await list(listing, ctx);
  expect(mocks.list.mock.calls[0][5]).toBe(listing.signal);
  await open(new Request(request().url, { signal: controller.signal }), ctx);
  const signal = mocks.graph.mock.calls[0][4] as AbortSignal;
  expect(signal.aborted).toBe(false); controller.abort(); expect(signal.aborted).toBe(true);
});
it('returns a verified conditional result only after current item MIME and size proof, without content transport', async () => {
  mocks.download.mockResolvedValue({ item: { name: 'Current name.pdf', size: 123, file: { mimeType: 'application/pdf' }, eTag: '"v1"' }, url: null, notModified: true });
  const response = await open(request('view', { 'if-none-match': '"v1"' }), ctx);
  expect(mocks.download).toHaveBeenCalledWith('root', 'file', '"v1"');
  expect(response.status).toBe(304); expect(response.headers.get('x-project-file-verified-version')).toBe('"v1"');
  expect(response.headers.get('content-disposition')).toContain('Current%20name.pdf');
  expect(response.headers.get('cache-control')).toBe('private, no-store'); expect(mocks.fetch).not.toHaveBeenCalled();
  mocks.download.mockResolvedValue({ item: { name: 'now-large.pdf', size: 50000001, file: { mimeType: 'application/pdf' } }, url: null, notModified: true });
  expect((await open(request('view', { 'if-none-match': '"v1"' }), ctx)).status).toBe(400);
  mocks.graph.mockRejectedValue(new ProjectFilesError('access_required'));
  expect((await open(request('view', { 'if-none-match': '"v1"' }), ctx)).status).toBe(503);
});
it.each(['"v1"', '"changed-during-transfer"', 'W/"v1"', null])('binds reusable bytes only to the exact strong current origin version %s', async origin => {
  mocks.download.mockResolvedValue({ item: { name: 'design.pdf', size: 3, file: { mimeType: 'application/pdf' }, eTag: '"v1"' }, url: 'https://fixture.sharepoint.com/_layouts/15/download.aspx?ephemeral=current', notModified: false });
  mocks.fetch.mockResolvedValue(new Response('pdf', { headers: { 'content-length': '3', ...(origin ? { ETag: origin } : {}) } }));
  const response = await open(request('view'), ctx);
  expect(await response.text()).toBe('pdf');
  expect(response.headers.get('x-project-file-verified-version')).toBe(origin === '"v1"' ? origin : null);
});
