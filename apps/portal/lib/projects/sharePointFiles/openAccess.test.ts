// @vitest-environment node
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ client: vi.fn(), config: vi.fn(), graph: vi.fn(), user: vi.fn(), rpc: vi.fn(), from: vi.fn(), download: vi.fn(), fetch: vi.fn(), repository: vi.fn() }));
vi.mock('@/lib/supabase/serverClient', () => ({ getSupabaseServerAuth: h.client }));
vi.mock('./config', async () => ({ ...await vi.importActual('./config'), sharePointConfig: h.config }));
vi.mock('./graph', () => ({ createGraph: h.graph }));
vi.mock('./previews/repository', () => ({ previewRepository: h.repository }));
import { GET } from '../../../app/api/staff/v1/projects/[projectId]/files/[itemId]/open/route';
import { POST } from '../../../app/api/staff/v1/projects/[projectId]/files/previews/route';
import { createHash } from 'node:crypto';
const db = new PGlite();
const actor = '00000000-0000-4000-8000-000000000003', project = '00000000-0000-4000-8000-000000000001';
const binding = 'a'.repeat(64);
let rootId: string;
const client = { auth: { getUser: h.user }, rpc: h.rpc, from: h.from };
const context = { params: Promise.resolve({ projectId: 'proj_' + project, itemId: 'file' }) };
const request = (mode = 'view', root = rootId, headers = {}) => new Request(`https://portal.test/open?mode=${mode}&rootId=${root}`, { headers });
beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema private; create schema auth;
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function auth.role() returns text language sql as $$select current_setting('request.jwt.claim.role',true)$$;
    create table auth.users(id uuid primary key,email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz);
    create table public.portal_users(user_id uuid primary key,role text);
    create table public.projects(id uuid primary key,name text);
    insert into public.projects values('${project}','Synthetic fixture');
    insert into auth.users values('${actor}',now(),null,null); insert into public.portal_users values('${actor}','staff');`);
  await db.exec(readFileSync('supabase/migrations/20261022090001_project_sharepoint_files.sql', 'utf8'));
  await db.exec(`set request.jwt.claim.role='service_role'`);
  const admin = (action: string, input: object) => db.query('select public.project_files_admin($1,$2::jsonb)', [action, JSON.stringify(input)]);
  await admin('configure', { binding, driveId: 'drive', enquiriesItemId: 'enquiries', enabled: true, provisionEnabled: false });
  await admin('import', { binding, projectId: project, itemId: 'root', label: 'Synthetic root', evidenceSha256: binding });
  rootId = (await db.query<{ id: string }>('select id from private.project_file_roots')).rows[0].id;
});
afterAll(async () => { await db.close(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
beforeEach(async () => {
  vi.resetAllMocks(); vi.stubGlobal('fetch', h.fetch);
  vi.stubEnv('SANCTUARY_SHAREPOINT_PREVIEW_CACHE_ENABLED', 'true');
  await db.exec(`reset role; insert into portal_users values('${actor}','staff') on conflict(user_id) do update set role='staff'; update auth.users set email_confirmed_at=now(),deleted_at=null,banned_until=null;
    set request.jwt.claim.sub='${actor}'; set request.jwt.claim.role='authenticated'; set role authenticated;`);
  h.client.mockResolvedValue(client); h.user.mockResolvedValue({ data: { user: { id: actor } }, error: null });
  h.from.mockImplementation(() => { throw new Error('Duplicate role lookup'); });
  h.rpc.mockImplementation(async (name, input) => {
    expect(name).toBe('project_files_read');
    try { return { data: (await db.query<{ result: unknown }>('select public.project_files_read($1::uuid) result', [input.p_project_id])).rows[0].result, error: null }; }
    catch (error) { return { data: null, error }; }
  });
  h.config.mockReturnValue({ binding });
  h.graph.mockResolvedValue({ download: h.download, within: async (_root: string, id: string) => id === 'folder' ? { id, folder: {} } : { id, name: id+'.pdf', size: 3, file: { mimeType: 'application/pdf' }, eTag: '"v1"', parentReference: { id: 'folder' } } });
  h.repository.mockReturnValue({ command: async () => ({ completed: true }), read: async () => ({ hash: createHash('sha256').update('pdf').digest('hex'), profile: 'pdf-v1', mime: 'application/pdf', size: 3 }), bytes: async () => Buffer.from('pdf') });
  h.download.mockResolvedValue({ item: { name: 'Synthetic.pdf', size: 3, file: { mimeType: 'application/pdf' }, eTag: '"v1"' }, url: 'https://fixture.test/body', notModified: false });
  h.fetch.mockResolvedValue(new Response('pdf', { headers: { etag: '"v1"', 'content-length': '3' } }));
});
it.each(['staff', 'admin'])('uses fresh identity and one current SQL actor/root proof for %s without duplicate role read', async role => {
  await db.exec(`reset role; update portal_users set role='${role}'; set role authenticated;`);
  const response = await GET(request(), context);
  expect(response.status).toBe(200); expect(await response.text()).toBe('pdf');
  expect(h.client).toHaveBeenCalledTimes(1); expect(h.user).toHaveBeenCalledTimes(1); expect(h.rpc).toHaveBeenCalledTimes(1); expect(h.from).not.toHaveBeenCalled();
  expect(h.graph).toHaveBeenCalledTimes(1); expect(h.user.mock.invocationCallOrder[0]).toBeLessThan(h.rpc.mock.invocationCallOrder[0]);
});
it.each(['missing', 'error', 'throw'])('denies %s identity privately before the RPC or provider', async kind => {
  if (kind === 'throw') h.user.mockRejectedValue(new Error('private auth failure'));
  else h.user.mockResolvedValue({ data: { user: kind === 'missing' ? null : { id: actor } }, error: kind === 'error' ? { message: 'revoked session' } : null });
  const response = await GET(request('download'), context);
  expect(response.status).toBe(401); expect(await response.json()).toEqual({ error: 'Unauthorized' });
  expect(response.headers.get('cache-control')).toBe('private, no-store'); expect(h.rpc).not.toHaveBeenCalled(); expect(h.graph).not.toHaveBeenCalled(); expect(h.fetch).not.toHaveBeenCalled();
});
it.each(['role', 'unconfirmed', 'deleted', 'banned'])('rejects current SQL %s denial after valid identity, for view, recent receipt and original', async kind => {
  await db.exec('reset role');
  if (kind === 'role') await db.exec('delete from portal_users');
  else await db.exec(`update auth.users set ${kind === 'unconfirmed' ? 'email_confirmed_at=null' : kind === 'deleted' ? 'deleted_at=now()' : "banned_until=now()+interval '1 day'"}`);
  for (const [mode, headers] of [['view', {}], ['view', { 'x-project-file-preview-version': '"v1"' }], ['download', {}]] as const) {
    await db.exec('set role authenticated');
    const response = await GET(request(mode, rootId, headers), context);
    expect(response.status).toBe(403); expect(response.headers.get('cache-control')).toBe('private, no-store');
  }
  expect(h.graph).not.toHaveBeenCalled(); expect(h.fetch).not.toHaveBeenCalled();
  await db.exec(`reset role; insert into portal_users values('${actor}','staff') on conflict(user_id) do update set role='staff';`);
});
it('keeps an absent root and RPC errors or malformed snapshots ahead of provider access', async () => {
  expect((await GET(request('download', '11111111-1111-4111-8111-111111111111'), context)).status).toBe(404);
  h.rpc.mockResolvedValue({ data: null, error: { code: '42501' } });
  expect((await GET(request(), context)).status).toBe(403);
  h.rpc.mockRejectedValue(new Error('private database failure'));
  expect((await GET(request(), context)).status).toBe(503);
  h.rpc.mockResolvedValue({ data: { state: 'ready', roots: 'malformed' }, error: null });
  expect((await GET(request(), context)).status).toBe(503);
  expect(h.graph).not.toHaveBeenCalled(); expect(h.fetch).not.toHaveBeenCalled();
});
it('retains current proof before a recent receipt and the original redirect', async () => {
  h.download.mockResolvedValue({ item: { name: 'Synthetic.pdf', size: 3, file: { mimeType: 'application/pdf' }, eTag: '"v1"' }, url: null, notModified: true });
  const receipt = await GET(request('view', rootId, { 'x-project-file-preview-version': '"v1"' }), context);
  expect(receipt.status).toBe(200); expect((await receipt.json()).version).toBe('"v1"'); expect(h.fetch).not.toHaveBeenCalled();
  h.download.mockResolvedValue({ item: { name: 'Synthetic.3dm', size: 500000000, file: { mimeType: 'application/octet-stream' } }, url: 'https://fixture.test/original', notModified: false });
  const original = await GET(request('download'), context);
  expect(original.status).toBe(302); expect(original.headers.get('location')).toBe('https://fixture.test/original'); expect(h.rpc).toHaveBeenCalledTimes(2); expect(h.user).toHaveBeenCalledTimes(2); expect(h.fetch).not.toHaveBeenCalled();
});

it('rejects invalid root input and identity setup failure privately without RPC or provider work', async () => {
  expect((await GET(request('view', 'not-a-root-uuid'), context)).status).toBe(400);
  expect(h.rpc).not.toHaveBeenCalled();
  h.client.mockRejectedValue(new Error('private setup failure'));
  const response = await GET(request(), context);
  expect(response.status).toBe(401); expect(await response.text()).not.toContain('private');
  expect(response.headers.get('cache-control')).toBe('private, no-store'); expect(h.rpc).not.toHaveBeenCalled(); expect(h.graph).not.toHaveBeenCalled(); expect(h.fetch).not.toHaveBeenCalled();
});
const batchRequest = (root = rootId, origin = 'https://portal.test') => new Request('https://portal.test/api/staff/v1/projects/project/files/previews', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify({ rootId: root, folderId: 'folder', items: Array.from({ length: 8 }, (_, index) => ({ id: 'file'+index })) }) });
it('authorizes eight new private byte deliveries with one fresh identity, one current real SQL actor/root proof and one Graph context', async () => {
  const response = await POST(batchRequest(), context); expect(response.status).toBe(200);
  expect((await response.text()).split('\n').filter(line => line.includes('"kind":"preview"'))).toHaveLength(8);
  expect(h.user).toHaveBeenCalledTimes(1); expect(h.rpc).toHaveBeenCalledTimes(1); expect(h.graph).toHaveBeenCalledTimes(1); expect(h.repository).toHaveBeenCalledTimes(1);
  expect(h.user.mock.invocationCallOrder[0]).toBeLessThan(h.rpc.mock.invocationCallOrder[0]); expect(h.rpc.mock.invocationCallOrder[0]).toBeLessThan(h.graph.mock.invocationCallOrder[0]);
});
it.each(['role', 'unconfirmed', 'deleted', 'banned', 'root', 'rpc', 'session'])('blocks new batch bytes after current %s removal/failure before private storage or provider access', async kind => {
  await db.exec('reset role');
  if (kind === 'role') await db.exec('delete from portal_users');
  if (kind === 'unconfirmed') await db.exec('update auth.users set email_confirmed_at=null');
  if (kind === 'deleted') await db.exec('update auth.users set deleted_at=now()');
  if (kind === 'banned') await db.exec("update auth.users set banned_until=now()+interval '1 day'");
  await db.exec('set role authenticated');
  if (kind === 'rpc') h.rpc.mockResolvedValue({ data: null, error: { code: '42501' } });
  if (kind === 'session') h.user.mockResolvedValue({ data: { user: null }, error: { message: 'Server-ended session' } });
  const response = await POST(batchRequest(kind === 'root' ? '11111111-1111-4111-8111-111111111111' : rootId), context);
  expect(response.status).toBe(kind === 'session' ? 401 : kind === 'root' ? 404 : 403);
  expect(response.headers.get('cache-control')).toBe('private, no-store'); expect(h.repository).not.toHaveBeenCalled(); expect(h.graph).not.toHaveBeenCalled(); expect(h.fetch).not.toHaveBeenCalled();
});
it('rejects cross-origin batch delivery before provider/storage and keeps the default cache switch dark', async () => {
  expect((await POST(batchRequest(rootId, 'https://other.test'), context)).status).toBe(400);
  vi.stubEnv('SANCTUARY_SHAREPOINT_PREVIEW_CACHE_ENABLED', 'false');
  expect((await POST(batchRequest(), context)).status).toBe(503);
  expect(h.rpc).not.toHaveBeenCalled(); expect(h.graph).not.toHaveBeenCalled(); expect(h.repository).not.toHaveBeenCalled();
});
