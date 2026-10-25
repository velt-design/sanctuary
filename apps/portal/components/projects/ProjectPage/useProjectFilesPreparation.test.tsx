import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import { prepareProjectFiles, projectFilesQueryOptions } from '@/lib/projects/sharePointFiles/query';
import type { ProjectFilesPage } from '@/lib/projects/sharePointFiles/types';
import { readPreview, retainPreview, setPreviewOwner, subscribePreview } from './tabs/overview/projectFilePreviewCache';
import { useProjectFilesPreparation } from './useProjectFilesPreparation';
import { emptyFilesNavigation, filesNavigationKey, readFilesNavigation, writeFilesNavigation } from './tabs/overview/projectFilesNavigation';
const session = vi.hoisted(() => ({ user: { id: 'staff-a' }, role: 'staff', status: 'authenticated' }));
vi.mock('@/components/auth/PortalAuthProvider', () => ({ usePortalSession: () => session }));
// Isolate the unrendered UI preload; its own imports must not bypass held code mocks.
vi.mock('./tabs/FilesTab', () => ({ default: () => null }));
vi.mock('./tabs/QuotePdfInlinePreview', () => ({ preloadQuotePdfPreview: async () => undefined }));
const clients: QueryClient[] = [];
let mounted: ReturnType<typeof renderIntoDocument> | undefined;
const releaseCode: (() => void)[] = [];
afterEach(async () => { mounted?.unmount(); mounted = undefined; releaseCode.splice(0).forEach(release => release()); await vi.dynamicImportSettled(); clients.forEach(client => client.clear()); clients.length = 0; vi.doUnmock('./tabs/overview/projectFilePreviewPreparation'); vi.doUnmock('@/lib/projects/sharePointFiles/query'); vi.useRealTimers(); vi.unstubAllGlobals(); session.user = { id: 'staff-a' }; session.role = 'staff'; session.status = 'authenticated'; sessionStorage.clear(); });
const rootId = '11111111-1111-4111-8111-111111111111';
function Owner({ project = 'project-a', enabled = true }: { project?: string; enabled?: boolean }) { useProjectFilesPreparation(project, 'host', enabled); return <p>Snapshot still loading</p>; }
async function flush() { await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); }); }
it('prepares alongside snapshot loading, shares exact owner keys, and bounds first-page preparation to two child folders', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); clients.push(client);
  const fetcher = vi.fn(async (url: string) => {
    const query = new URL(url, 'https://fixture').searchParams;
    return Response.json({ state: 'ready', rootId, folderId: query.get('folderId') ?? 'root', roots: [{ id: rootId, itemId: 'root', label: 'Project' }], items: query.has('folderId') ? [] : Array.from({ length: 8 }, (_, index) => ({ id: 'folder'+index, name: 'Folder '+index, kind: 'folder', size: 0, modifiedAt: null, viewable: false })), cursor: null });
  }); vi.stubGlobal('fetch', fetcher);
  mounted = renderIntoDocument(<QueryClientProvider client={client}><Owner /></QueryClientProvider>); await flush();
  expect(mounted.container.textContent).toBe('Snapshot still loading'); expect(fetcher).toHaveBeenCalledTimes(3);
  expect(client.getQueryData(['project-sharepoint-files', 'host', 'staff-a', 'project-a', rootId, 'folder0'])).toBeTruthy();
  mounted.rerender(<QueryClientProvider client={client}><Owner /></QueryClientProvider>); await flush(); expect(fetcher).toHaveBeenCalledTimes(3);
});
it('cancels a departed project and does not start late child preparation or cross an auth-owner boundary', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); clients.push(client);
  let finish: ((response: Response) => void) | undefined;
  const fetcher = vi.fn((_url: string, _init: RequestInit) => new Promise<Response>(resolve => { finish = resolve; })); vi.stubGlobal('fetch', fetcher);
  mounted = renderIntoDocument(<QueryClientProvider client={client}><Owner /></QueryClientProvider>); await flush();
  const oldSignal = fetcher.mock.calls[0][1].signal!;
  session.user = { id: 'staff-b' }; mounted.rerender(<QueryClientProvider client={client}><Owner project="project-b" /></QueryClientProvider>); await flush();
  expect(oldSignal.aborted).toBe(true); expect(fetcher).toHaveBeenCalledTimes(2);
  await act(async () => finish!(Response.json({ state: 'unlinked', roots: [], rootId: null, folderId: null, items: [], cursor: null }))); await flush();
  expect(client.getQueryData(['project-sharepoint-files', 'host', 'staff-a', 'project-a', 'default', 'root'])).toBeUndefined();
  session.status = 'anonymous'; mounted.rerender(<QueryClientProvider client={client}><Owner project="project-c" /></QueryClientProvider>); await flush(); expect(fetcher).toHaveBeenCalledTimes(2);
});

it('purges remembered project bytes when the owning route observes access ending', async () => {
  const client = new QueryClient(); clients.push(client);
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ state: 'unlinked', roots: [], rootId: null, folderId: null, items: [], cursor: null })));
  mounted = renderIntoDocument(<QueryClientProvider client={client}><Owner /></QueryClientProvider>); await flush();
  const scope = { owner: JSON.stringify(['host','staff-a']), projectId: 'project-a', rootId, itemId: 'file', folderId: 'folder' };
  retainPreview(client, scope, { bytes: new Uint8Array([1]), version: '"v1"', name: 'Photo.png', mime: 'image/png' });
  expect(readPreview(client, scope, [])).not.toBeNull();
  mounted.rerender(<QueryClientProvider client={client}><Owner enabled={false} /></QueryClientProvider>); await flush();
  expect(readPreview(client, scope, [])).toBeNull();
});

it('does not prepare children from old successful data after a fresh root request fails', async () => {
  const client = new QueryClient(); clients.push(client);
  client.setQueryData(projectFilesQueryOptions('host','staff-a','project-a').queryKey, { pages: [{ state: 'ready', rootId, folderId: 'root', roots: [{ id: rootId, itemId: 'root', label: 'Project' }], items: [{ id: 'folder', name: 'Folder', kind: 'folder', size: 0, modifiedAt: null, viewable: false }], cursor: null }], pageParams: [undefined] }, { updatedAt: Date.now()-600000 });
  const fetcher = vi.fn(async () => new Response(null, { status: 503 })); vi.stubGlobal('fetch', fetcher);
  await prepareProjectFiles(client, 'host', 'staff-a', 'project-a');
  expect(fetcher).toHaveBeenCalledTimes(1);
});

function renewalFixture() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); clients.push(client);
  const requests: string[] = [];
  const fetcher = vi.fn(async (url: string) => {
    const folder = new URL(url, 'https://fixture').searchParams.get('folderId') ?? 'root'; requests.push(folder);
    const pass = requests.filter(value => value === folder).length;
    return Response.json({ state: 'ready', rootId, folderId: folder, roots: [{ id: rootId, itemId: 'root', label: 'Project' }], items: folder === 'root' ? [0,1].map(index => ({ id: 'folder'+index, name: `Folder ${index} pass ${pass}`, kind: 'folder', size: 0, modifiedAt: null, viewable: false })) : [], cursor: null });
  });
  vi.stubGlobal('fetch', fetcher);
  return { client, requests, fetcher };
}
async function tick(milliseconds: number) { await act(async () => { await vi.advanceTimersByTimeAsync(milliseconds); }); }
it('fetches fresh root and bounded child metadata on the first four-minute renewal, before the five-minute lease expires', async () => {
  vi.useFakeTimers(); const started = Date.now(), { client, requests, fetcher } = renewalFixture();
  mounted = renderIntoDocument(<QueryClientProvider client={client}><Owner /></QueryClientProvider>); await tick(0);
  await vi.dynamicImportSettled();
  expect(requests).toEqual(['root','folder0','folder1']);
  await tick(4 * 60_000 - 1); expect(fetcher).toHaveBeenCalledTimes(3);
  await tick(1); expect(requests).toEqual(['root','folder0','folder1','root','folder0','folder1']);
  const options = projectFilesQueryOptions('host','staff-a','project-a');
  expect(client.getQueryState(options.queryKey)?.dataUpdatedAt).toBe(started + 4 * 60_000);
  expect(client.getQueryData(options.queryKey)?.pages[0].items[0].name).toBe('Folder 0 pass 2');
  await tick(60_000); expect(fetcher).toHaveBeenCalledTimes(6);
});
it('renews the latest non-likely folder on the fixed project timer despite intervening selection changes', async () => {
  vi.useFakeTimers(); const { client, requests } = renewalFixture();
  mounted = renderIntoDocument(<QueryClientProvider client={client}><Owner /></QueryClientProvider>); await tick(0);
  await vi.dynamicImportSettled();
  await tick(60_000);
  const key = filesNavigationKey('host','staff-a','project-a');
  writeFilesNavigation(key, { ...emptyFilesNavigation(), rootId, trail: [{ id: 'deep-folder', name: 'Photos' }], selectedId: 'photo1' });
  await tick(2 * 60_000);
  writeFilesNavigation(key, { ...emptyFilesNavigation(), rootId, trail: [{ id: 'deep-folder', name: 'Photos' }], selectedId: 'photo20' });
  await tick(60_000);
  expect(requests.slice(3).sort()).toEqual(['deep-folder','folder0','folder1','root']);
  expect(client.getQueryData(projectFilesQueryOptions('host','staff-a','project-a',rootId,'deep-folder').queryKey)?.pages[0].folderId).toBe('deep-folder');
});
it('keeps the project timer available when entering from website files and later switching to SharePoint', async () => {
  vi.useFakeTimers(); const { client, requests } = renewalFixture(), key = filesNavigationKey('host','staff-a','project-a');
  writeFilesNavigation(key, { ...emptyFilesNavigation(), source: 'website' });
  mounted = renderIntoDocument(<QueryClientProvider client={client}><Owner /></QueryClientProvider>); await tick(0); expect(requests).toEqual([]);
  await tick(2 * 60_000);
  writeFilesNavigation(key, { ...emptyFilesNavigation(), rootId, trail: [{ id: 'deep-folder', name: 'Photos' }] });
  await tick(2 * 60_000); await vi.dynamicImportSettled(); expect(requests.sort()).toEqual(['deep-folder','folder0','folder1','root']);
});
it('coalesces overlapping forced renewal passes without restarting the same query work', async () => {
  const { client, requests } = renewalFixture();
  await prepareProjectFiles(client, 'host','staff-a','project-a');
  await Promise.all([0,1].map(() => prepareProjectFiles(client, 'host','staff-a','project-a',undefined,undefined,undefined,undefined,true)));
  expect(requests).toEqual(['root','folder0','folder1','root','folder0','folder1']);
});

it('renews the loaded three-page extent and later-page selected preview without advancing or resetting navigation', async () => {
  vi.useFakeTimers();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); clients.push(client);
  const selectedId = 'late-selected', ids = ['first','second',selectedId], metadataRequests: string[] = [], previewRequests: string[][] = [];
  let shortened = false;
  const roots = [{ id: rootId, itemId: 'root', label: 'Project' }];
  const rootPage: ProjectFilesPage = { state: 'ready', rootId, folderId: 'root', roots, items: [], cursor: null };
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/previews')) {
      const input = JSON.parse(init!.body as string); previewRequests.push(input.items.map((item: { id: string }) => item.id));
      const packets = [{ kind: 'project-preview-batch-v1', projectId: 'project-a', rootId, folderId: 'deep-folder' },
        ...input.items.map((item: { id: string; known: { version: string; profile: string; hash: string } }) => ({ kind: 'preview', item: { id: item.id, name: item.id+'.pdf', ...item.known, mime: 'application/pdf', size: 3 } })), { kind: 'complete', unavailable: [] }];
      return new Response(packets.map(packet => JSON.stringify(packet)).join('\n')+'\n', { headers: { 'content-type': 'application/x-ndjson' } });
    }
    const query = new URL(url, 'https://fixture').searchParams;
    if (!query.has('folderId')) return Response.json(rootPage);
    const cursor = query.get('cursor') ?? 'page1'; metadataRequests.push(cursor);
    const index = cursor === 'page1' ? 0 : cursor === 'page2' ? 1 : 2;
    return Response.json({ state: 'ready', rootId, folderId: 'deep-folder', roots, items: [{ id: ids[index], name: ids[index]+'.pdf', kind: 'file', size: 3, contentType: 'application/pdf', modifiedAt: null, viewable: true, eTag: '"v1"' }], cursor: shortened ? null : 'page'+(index+2) });
  }));
  const options = projectFilesQueryOptions('host','staff-a','project-a',rootId,'deep-folder');
  await client.prefetchInfiniteQuery({ ...options, pages: 3 });
  client.setQueryData(projectFilesQueryOptions('host','staff-a','project-a',rootId).queryKey, { pages: [rootPage], pageParams: [undefined] });
  const owner = JSON.stringify(['host','staff-a']); setPreviewOwner(client, owner);
  const scope = (itemId: string) => ({ owner, projectId: 'project-a', rootId, folderId: 'deep-folder', itemId });
  for (const id of [...ids,'unseen-next-page']) retainPreview(client, scope(id), { bytes: new Uint8Array([1,2,3]), version: '"v1"', name: id+'.pdf', mime: 'application/pdf', profile: 'pdf-v1', hash: '1'.repeat(64) }, true);
  const key = filesNavigationKey('host','staff-a','project-a');
  const navigation = { ...emptyFilesNavigation(), rootId, trail: [{ id: 'deep-folder', name: 'Photos' }], selectedId, pageCounts: { [rootId+':deep-folder']: 3 }, scrolls: { [rootId+':deep-folder']: 950 } };
  writeFilesNavigation(key, navigation);
  mounted = renderIntoDocument(<QueryClientProvider client={client}><Owner /></QueryClientProvider>); await tick(0);
  await vi.dynamicImportSettled();
  await tick(4 * 60_000);
  expect(metadataRequests).toEqual(['page1','page2','page3','page1','page2','page3']);
  expect(client.getQueryData(options.queryKey)?.pages).toHaveLength(3);
  expect(client.getQueryData(options.queryKey)?.pages.flatMap(page => page.items).some(item => item.id === selectedId)).toBe(true);
  expect(previewRequests).toEqual([[selectedId,'first','second']]);
  expect(readPreview(client, scope('unseen-next-page'), [], false)).not.toBeNull();
  expect(readFilesNavigation(key)).toEqual(navigation);
  await tick(61_000);
  expect(readPreview(client, scope(selectedId), [], false)).not.toBeNull();
  expect(readFilesNavigation(key)).toEqual(navigation);
  shortened = true; await tick(3 * 60_000 - 1_000);
  expect(metadataRequests).toEqual(['page1','page2','page3','page1','page2','page3','page1']);
  expect(client.getQueryData(options.queryKey)?.pages).toHaveLength(1);
  expect(readPreview(client, scope(selectedId), [], false)).toBeNull();
});

it('does not overwrite a longer explicit-root page set while normalizing a first-page default-root preparation', async () => {
  const { client } = renewalFixture(), explicit = projectFilesQueryOptions('host','staff-a','project-a',rootId).queryKey;
  const page: ProjectFilesPage = { state: 'ready', rootId, folderId: 'root', roots: [{ id: rootId, itemId: 'root', label: 'Project' }], items: [], cursor: 'next' };
  client.setQueryData(explicit, { pages: [page,page,page], pageParams: [undefined,'second','third'] }, { updatedAt: Date.now()-60_000 });
  await prepareProjectFiles(client,'host','staff-a','project-a');
  expect(client.getQueryData(explicit)?.pages).toHaveLength(3);
});

async function holdPreparationCode() {
  await vi.dynamicImportSettled();
  const actual = await vi.importActual<typeof import('./tabs/overview/projectFilePreviewPreparation')>('./tabs/overview/projectFilePreviewPreparation');
  let release!: () => void, reject!: (error: Error) => void;
  const gate = new Promise<void>((resolve, fail) => { release = resolve; reject = fail; });
  releaseCode.push(release);
  const entered = vi.fn();
  const prepare = vi.fn(actual.prepareFolderPreviews), cancel = vi.fn(actual.cancelProjectPreviewPreparation);
  vi.doMock('./tabs/overview/projectFilePreviewPreparation', async () => {
    entered(); await gate;
    return { ...actual, prepareFolderPreviews: prepare, cancelProjectPreviewPreparation: cancel };
  });
  return { entered, prepare, cancel, release, reject };
}
function preparedMetadataFixture() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); clients.push(client);
  const previews: string[] = [], metadata: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const project = url.split('/projects/')[1].split('/')[0];
    if (url.endsWith('/previews')) {
      previews.push(project);
      const input = JSON.parse(init!.body as string);
      return new Response([
        { kind: 'project-preview-batch-v1', projectId: project, rootId, folderId: 'root' },
        { kind: 'complete', unavailable: input.items.map((item: { id: string }) => item.id) },
      ].map(packet => JSON.stringify(packet)).join('\n')+'\n', { headers: { 'content-type': 'application/x-ndjson' } });
    }
    metadata.push(project);
    return Response.json({ state: 'ready', rootId, folderId: 'root', roots: [{ id: rootId, itemId: 'root', label: 'Project' }], items: [{ id: 'file', name: 'Plan.pdf', kind: 'file', size: 1, modifiedAt: null, contentType: 'application/pdf', eTag: '"v1"', viewable: true }], cursor: null });
  }));
  return { client, metadata, previews };
}
it.each(['disabled', 'anonymous', 'denied'])('does not load private preparation or read metadata for an initially %s owner', async state => {
  const code = await holdPreparationCode(), source = await holdMetadataCode(), { client, metadata, previews } = preparedMetadataFixture();
  if (state === 'anonymous') session.status = 'anonymous';
  if (state === 'denied') session.role = 'customer';
  mounted = renderIntoDocument(<QueryClientProvider client={client}><Owner enabled={state !== 'disabled'} /></QueryClientProvider>); await flush();
  expect(code.entered).not.toHaveBeenCalled(); expect(source.entered).not.toHaveBeenCalled(); expect(metadata).toEqual([]); expect(previews).toEqual([]);
});
it('publishes metadata independently of held private code, then prepares the same current folder and cancels it synchronously on departure', async () => {
  const code = await holdPreparationCode(), { client, metadata, previews } = preparedMetadataFixture();
  const scope = { owner: JSON.stringify(['host','staff-a']), projectId: 'project-a', rootId, folderId: 'root', itemId: 'file' };
  setPreviewOwner(client, scope.owner);
  retainPreview(client, scope, { bytes: new Uint8Array([1]), version: '"old"', name: 'Old.pdf', mime: 'application/pdf' });
  const changed = vi.fn(), unsubscribe = subscribePreview(client, scope, changed);
  mounted = renderIntoDocument(<QueryClientProvider client={client}><Owner /></QueryClientProvider>); await flush();
  expect(code.entered).toHaveBeenCalledTimes(1); expect(metadata).toEqual(['project-a']); expect(previews).toEqual([]);
  expect(client.getQueryData(projectFilesQueryOptions('host','staff-a','project-a',rootId).queryKey)?.pages[0].items[0].name).toBe('Plan.pdf');
  expect(readPreview(client, scope, [])).toBeNull(); expect(changed).toHaveBeenCalledExactlyOnceWith(null);
  expect(mounted.container.textContent).toBe('Snapshot still loading');
  await act(async () => code.release()); await flush();
  expect(previews).toEqual(['project-a']); expect(code.prepare).toHaveBeenCalledTimes(1);
  expect(code.prepare.mock.calls[0][1]).toEqual({ owner: JSON.stringify(['host','staff-a']), projectId: 'project-a', rootId, folderId: 'root' });
  mounted.unmount(); mounted = undefined;
  expect(code.cancel).toHaveBeenCalledExactlyOnceWith(client, JSON.stringify(['host','staff-a']), 'project-a');
  unsubscribe();
});
it.each(['unmount', 'disable', 'anonymous', 'denied'])('does not revive a held private owner after %s', async retirement => {
  const code = await holdPreparationCode(), { client, metadata, previews } = preparedMetadataFixture();
  mounted = renderIntoDocument(<QueryClientProvider client={client}><Owner /></QueryClientProvider>); await flush();
  expect(metadata).toEqual(['project-a']); expect(code.entered).toHaveBeenCalledTimes(1);
  const scope = { owner: JSON.stringify(['host','staff-a']), projectId: 'project-a', rootId, folderId: 'root', itemId: 'file' };
  retainPreview(client, scope, { bytes: new Uint8Array([1]), version: '"v1"', name: 'Plan.pdf', mime: 'application/pdf' });
  const changed = vi.fn(), unsubscribe = subscribePreview(client, scope, changed);
  if (retirement === 'unmount') { mounted.unmount(); mounted = undefined; }
  else {
    if (retirement === 'anonymous') session.status = 'anonymous';
    if (retirement === 'denied') session.role = 'customer';
    mounted.rerender(<QueryClientProvider client={client}><Owner enabled={retirement !== 'disable'} /></QueryClientProvider>);
    expect(readPreview(client, scope, [])).toBeNull(); expect(changed).toHaveBeenCalledExactlyOnceWith(null);
  }
  await act(async () => code.release()); await flush();
  expect(code.prepare).not.toHaveBeenCalled(); expect(code.cancel).not.toHaveBeenCalled(); expect(previews).toEqual([]);
  unsubscribe();
});
it('rejects retired held A while current B and return A work through available code without a late cancellation', async () => {
  const code = await holdPreparationCode(), { client, metadata, previews } = preparedMetadataFixture();
  mounted = renderIntoDocument(<QueryClientProvider client={client}><Owner /></QueryClientProvider>); await flush();
  expect(code.prepare).not.toHaveBeenCalled(); expect(previews).toEqual([]);
  session.user = { id: 'staff-b' };
  mounted.rerender(<QueryClientProvider client={client}><Owner project="project-b" /></QueryClientProvider>); await flush();
  // Vitest bypasses an in-progress manual factory on a second import of its URL.
  // B therefore uses the actual available module while the first A remains held.
  expect(code.prepare).not.toHaveBeenCalled(); expect(previews).toEqual(['project-b']);
  session.user = { id: 'staff-a' };
  mounted.rerender(<QueryClientProvider client={client}><Owner /></QueryClientProvider>); await flush();
  expect(code.prepare).not.toHaveBeenCalled(); expect(previews).toEqual(['project-b','project-a']);
  expect(metadata).toEqual(['project-a','project-b']);
  await act(async () => code.release()); await flush();
  expect(previews).toEqual(['project-b','project-a']); expect(code.prepare).not.toHaveBeenCalled(); expect(code.cancel).not.toHaveBeenCalled();
  mounted.rerender(<QueryClientProvider client={client}><Owner enabled={false} /></QueryClientProvider>); await flush();
  expect(code.cancel).not.toHaveBeenCalled();
});
it('keeps metadata after code-load failure and requests code again only on the existing scheduled pass', async () => {
  vi.useFakeTimers(); const started = Date.now();
  const code = await holdPreparationCode(), { client, metadata, previews } = preparedMetadataFixture();
  mounted = renderIntoDocument(<QueryClientProvider client={client}><Owner /></QueryClientProvider>); await tick(0);
  await vi.waitFor(() => expect(code.entered).toHaveBeenCalledTimes(1));
  expect(metadata).toEqual(['project-a']);
  expect(code.entered).toHaveBeenCalledTimes(1);
  await act(async () => code.reject(new Error('Fictional module unavailable'))); await vi.dynamicImportSettled();
  expect(client.getQueryData(projectFilesQueryOptions('host','staff-a','project-a',rootId).queryKey)?.pages[0].state).toBe('ready');
  expect(previews).toEqual([]); expect(code.entered).toHaveBeenCalledTimes(1);
  const recovery = await holdPreparationCode();
  await tick(started + 4 * 60_000 - 1 - Date.now()); expect(recovery.entered).not.toHaveBeenCalled();
  await tick(1); await vi.waitFor(() => expect(recovery.entered).toHaveBeenCalledTimes(1)); expect(previews).toEqual([]);
  await act(async () => recovery.release()); await tick(0);
  expect(metadata).toEqual(['project-a','project-a']); expect(previews).toEqual(['project-a']); expect(recovery.prepare).toHaveBeenCalledTimes(1);
});

async function holdMetadataCode() {
  await vi.dynamicImportSettled();
  const actual = await vi.importActual<typeof import('@/lib/projects/sharePointFiles/query')>('@/lib/projects/sharePointFiles/query');
  let release!: () => void, reject!: (error: Error) => void;
  const gate = new Promise<void>((resolve, fail) => { release = resolve; reject = fail; });
  releaseCode.push(release);
  const entered = vi.fn(), prepare = vi.fn(actual.prepareProjectFiles);
  vi.doMock('@/lib/projects/sharePointFiles/query', async () => {
    entered(); await gate; return { ...actual, prepareProjectFiles: prepare };
  });
  return { entered, prepare, release, reject };
}
it('starts both independent code loads and reconciles metadata while preview code remains held', async () => {
  const source = await holdMetadataCode(), code = await holdPreparationCode(), { client, metadata, previews } = preparedMetadataFixture();
  const scope = { owner: JSON.stringify(['host','staff-a']), projectId: 'project-a', rootId, folderId: 'root', itemId: 'file' };
  setPreviewOwner(client, scope.owner);
  retainPreview(client, scope, { bytes: new Uint8Array([1]), version: '"old"', name: 'Old.pdf', mime: 'application/pdf' });
  const changed = vi.fn(), unsubscribe = subscribePreview(client, scope, changed);
  mounted = renderIntoDocument(<QueryClientProvider client={client}><Owner /></QueryClientProvider>); await flush();
  expect(source.entered).toHaveBeenCalledTimes(1); expect(code.entered).toHaveBeenCalledTimes(1);
  expect(metadata).toEqual([]); expect(previews).toEqual([]); expect(readPreview(client, scope, [])).not.toBeNull();
  const frame = mounted.container.firstChild;
  await act(async () => source.release()); await flush();
  expect(metadata).toEqual(['project-a']); expect(source.prepare).toHaveBeenCalledTimes(1);
  expect(readPreview(client, scope, [])).toBeNull(); expect(changed).toHaveBeenCalledExactlyOnceWith(null);
  expect(code.prepare).not.toHaveBeenCalled(); expect(previews).toEqual([]); expect(mounted.container.firstChild).toBe(frame);
  await act(async () => code.release()); await flush();
  expect(previews).toEqual(['project-a']); expect(code.prepare).toHaveBeenCalledTimes(1); unsubscribe();
});
it.each(['unmount', 'disable', 'anonymous', 'denied'])('does not begin a late metadata read after fully held owner %s', async retirement => {
  const source = await holdMetadataCode(), { client, metadata, previews } = preparedMetadataFixture();
  mounted = renderIntoDocument(<QueryClientProvider client={client}><Owner /></QueryClientProvider>); await flush();
  expect(source.entered).toHaveBeenCalledTimes(1); expect(metadata).toEqual([]);
  const scope = { owner: JSON.stringify(['host','staff-a']), projectId: 'project-a', rootId, folderId: 'root', itemId: 'file' };
  retainPreview(client, scope, { bytes: new Uint8Array([1]), version: '"v1"', name: 'Plan.pdf', mime: 'application/pdf' });
  const changed = vi.fn(), unsubscribe = subscribePreview(client, scope, changed);
  if (retirement === 'unmount') { mounted.unmount(); mounted = undefined; }
  else {
    if (retirement === 'anonymous') session.status = 'anonymous';
    if (retirement === 'denied') session.role = 'customer';
    mounted.rerender(<QueryClientProvider client={client}><Owner enabled={retirement !== 'disable'} /></QueryClientProvider>);
    expect(readPreview(client, scope, [])).toBeNull(); expect(changed).toHaveBeenCalledExactlyOnceWith(null);
  }
  await act(async () => source.release()); await flush();
  expect(source.prepare).not.toHaveBeenCalled(); expect(metadata).toEqual([]); expect(previews).toEqual([]); unsubscribe();
});
it('rejects the retired metadata A before its first read while available current B and return A use unchanged keys', async () => {
  const source = await holdMetadataCode(), { client, metadata, previews } = preparedMetadataFixture();
  mounted = renderIntoDocument(<QueryClientProvider client={client}><Owner /></QueryClientProvider>); await flush();
  expect(source.entered).toHaveBeenCalledTimes(1); expect(metadata).toEqual([]);
  session.user = { id: 'staff-b' };
  mounted.rerender(<QueryClientProvider client={client}><Owner project="project-b" /></QueryClientProvider>); await flush();
  // As with the preview test, Vitest's concurrent manual-mock bypass makes B's
  // actual module available. This asserts retired-A admission, not native coalescing.
  expect(metadata).toEqual(['project-b']); expect(previews).toEqual(['project-b']);
  session.user = { id: 'staff-a' };
  mounted.rerender(<QueryClientProvider client={client}><Owner /></QueryClientProvider>); await flush();
  expect(metadata).toEqual(['project-b','project-a']); expect(previews).toEqual(['project-b','project-a']);
  expect(client.getQueryData(projectFilesQueryOptions('host','staff-a','project-a',rootId).queryKey)?.pages[0].folderId).toBe('root');
  await act(async () => source.release()); await flush();
  expect(source.prepare).not.toHaveBeenCalled(); expect(metadata).toEqual(['project-b','project-a']); expect(previews).toEqual(['project-b','project-a']);
});
it('recovers a metadata-code load on the existing four-minute pass without coupling it to preview code or retrying sooner', async () => {
  vi.useFakeTimers(); const started = Date.now();
  const source = await holdMetadataCode(), { client, metadata, previews } = preparedMetadataFixture();
  mounted = renderIntoDocument(<QueryClientProvider client={client}><Owner /></QueryClientProvider>); await tick(0);
  await vi.waitFor(() => expect(source.entered).toHaveBeenCalledTimes(1));
  await act(async () => source.reject(new Error('Fictional metadata module unavailable'))); await vi.dynamicImportSettled();
  expect(metadata).toEqual([]); expect(previews).toEqual([]);
  const recovery = await holdMetadataCode();
  await tick(started + 4 * 60_000 - 1 - Date.now()); expect(recovery.entered).not.toHaveBeenCalled();
  await tick(1); await vi.waitFor(() => expect(recovery.entered).toHaveBeenCalledTimes(1)); expect(metadata).toEqual([]);
  await act(async () => recovery.release()); await tick(0);
  expect(recovery.prepare).toHaveBeenCalledTimes(1); expect(recovery.prepare.mock.calls[0][8]).toBe(true);
  expect(metadata).toEqual(['project-a']); expect(previews).toEqual(['project-a']);
});
