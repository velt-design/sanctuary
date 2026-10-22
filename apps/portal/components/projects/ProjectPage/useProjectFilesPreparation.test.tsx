import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import { prepareProjectFiles, projectFilesQueryOptions } from '@/lib/projects/sharePointFiles/query';
import { readPreview, retainPreview } from './tabs/overview/projectFilePreviewCache';
import { useProjectFilesPreparation } from './useProjectFilesPreparation';
import { emptyFilesNavigation, filesNavigationKey, writeFilesNavigation } from './tabs/overview/projectFilesNavigation';
const session = vi.hoisted(() => ({ user: { id: 'staff-a' }, role: 'staff', status: 'authenticated' }));
vi.mock('@/components/auth/PortalAuthProvider', () => ({ usePortalSession: () => session }));
vi.mock('./tabs/QuotePdfInlinePreview', () => ({ preloadQuotePdfPreview: async () => undefined }));
const clients: QueryClient[] = [];
let mounted: ReturnType<typeof renderIntoDocument> | undefined;
afterEach(() => { mounted?.unmount(); mounted = undefined; clients.forEach(client => client.clear()); clients.length = 0; vi.useRealTimers(); vi.unstubAllGlobals(); session.user = { id: 'staff-a' }; session.role = 'staff'; session.status = 'authenticated'; sessionStorage.clear(); });
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
  await tick(2 * 60_000); expect(requests.sort()).toEqual(['deep-folder','folder0','folder1','root']);
});
it('coalesces overlapping forced renewal passes without restarting the same query work', async () => {
  const { client, requests } = renewalFixture();
  await prepareProjectFiles(client, 'host','staff-a','project-a');
  await Promise.all([0,1].map(() => prepareProjectFiles(client, 'host','staff-a','project-a',undefined,undefined,undefined,undefined,true)));
  expect(requests).toEqual(['root','folder0','folder1','root','folder0','folder1']);
});
