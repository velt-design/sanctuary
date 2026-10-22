import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, createContext, useState } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../../../test/reactHarness';
import ProjectSharePointFilesPanel from './ProjectSharePointFilesPanel';
import FilesTab from '../FilesTab';
import { PortalAuthContext } from '@/components/auth/PortalAuthProvider';
import { emptyFilesNavigation, filesNavigationKey, readFilesNavigation, writeFilesNavigation } from './projectFilesNavigation';
vi.mock('next/link', () => ({ default: ({ children, href, prefetch: _prefetch, ...props }: any) => <a href={href} {...props}>{children}</a> }));
vi.mock('@/components/auth/PortalAuthProvider', () => ({ PortalAuthContext: createContext({ status: 'authenticated', user: { id: 'staff-a' }, role: 'staff' }) }));
vi.mock('../QuotePdfInlinePreview', () => ({ default: ({ data }: { data: Uint8Array }) => <div data-testid="pdf-bytes">{new TextDecoder().decode(data)}</div> }));
vi.mock('./ProjectEnquiryReceiptPanel', () => ({ default: () => <p>Original enquiry context</p> }));
const rootId = '11111111-1111-4111-8111-111111111111';
const olderId = '22222222-2222-4222-8222-222222222222';
const ready = { state: 'ready', roots: [{ id: rootId, itemId: 'root', label: 'Current project' }, { id: olderId, itemId: 'older', label: 'Earlier enquiry' }], rootId, folderId: 'root', items: [], cursor: null };
const item = (id: string, contentType = 'application/pdf') => ({ id, name: `${id}.${contentType === 'application/pdf' ? 'pdf' : 'png'}`, kind: 'file', size: 1000, modifiedAt: null, viewable: true, contentType });
const cad = { id: 'cad', name: '3 CAD', kind: 'folder', size: 0, modifiedAt: null, viewable: false };
const fetcher = vi.fn();
let client: QueryClient, mounted: ReturnType<typeof renderIntoDocument> | undefined;
const width = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
const originalGeometry = Object.fromEntries(['scrollTop', 'scrollHeight', 'clientHeight'].map(key => [key, Object.getOwnPropertyDescriptor(HTMLElement.prototype, key)]));
beforeEach(() => {
  vi.useFakeTimers(); vi.stubGlobal('fetch', fetcher); fetcher.mockReset(); sessionStorage.clear();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 1200 });
  // JSDOM has no layout. Model real overflow/clamping, including partial cursor
  // pages, so restoring to an impossible first-page offset cannot falsely pass.
  const tops = new WeakMap<HTMLElement, number>();
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get(this: HTMLElement) { return this.getAttribute('aria-label') === 'Files list' ? this.querySelectorAll('tbody tr').length * 54 + 36 : 0; } });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 360 });
  Object.defineProperty(HTMLElement.prototype, 'scrollTop', { configurable: true, get(this: HTMLElement) { return tops.get(this) ?? 0; }, set(this: HTMLElement, top: number) { tops.set(this, Math.min(Math.max(0, top), Math.max(0, this.scrollHeight - this.clientHeight))); } });
  URL.createObjectURL = vi.fn(() => 'blob:synthetic-image'); URL.revokeObjectURL = vi.fn();
});
afterEach(() => { mounted?.unmount(); mounted = undefined; client.clear(); vi.useRealTimers(); vi.unstubAllGlobals(); if (width) Object.defineProperty(HTMLElement.prototype, 'clientWidth', width); for (const [key, descriptor] of Object.entries(originalGeometry)) if (descriptor) Object.defineProperty(HTMLElement.prototype, key, descriptor); });
async function flush() { await act(async () => { await vi.advanceTimersByTimeAsync(20); }); }
const wrap = (ui: React.ReactNode) => <QueryClientProvider client={client}>{ui}</QueryClientProvider>;
function WorkspaceReturnFixture() { const [files, setFiles] = useState(true); return <><button onClick={() => setFiles(false)}>Work</button><button onClick={() => setFiles(true)}>Files</button>{files ? <FilesTab projectId="proj_fixture" host="fixture" /> : <p>Work context</p>}</>; }
async function render(wrapper = false) { mounted = renderIntoDocument(wrap(wrapper ? <WorkspaceReturnFixture /> : <ProjectSharePointFilesPanel projectId="proj_fixture" host="fixture" websiteFiles={<p>Website attachments preserved</p>} />)); await flush(); return mounted.container; }
function button(container: ParentNode, text: string) { const found = [...container.querySelectorAll('button')].find(b => b.textContent?.trim() === text); expect(found, text).toBeTruthy(); return found!; }
async function click(container: ParentNode, text: string) { await act(async () => button(container, text).click()); await flush(); }
async function selectFile(container: ParentNode, name: string) { const found = [...container.querySelectorAll('button')].find(b => b.className.includes('filename') && b.textContent?.includes(name)); expect(found, name).toBeTruthy(); await act(async () => found!.click()); await flush(); }
async function find(container: ParentNode, term: string) { const input = container.querySelector('input')!; await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, term); input.dispatchEvent(new Event('input', { bubbles: true })); }); await flush(); }
function normalSource(url: string) { if (url.includes('/open?')) return new Response('ACTUAL SELECTED PDF', { headers: { 'content-type': 'application/pdf' } }); const p = new URL(url, 'https://fixture').searchParams; return Response.json({ ...ready, rootId: p.get('rootId') ?? rootId, folderId: p.get('folderId') ?? 'root', items: p.get('folderId') ? [item('Design'), { ...item('Rhino'), name: 'Original.3dm', size: 470000000, viewable: false, contentType: 'application/octet-stream' }, ...Array.from({ length: 8 }, (_, i) => item('Other drawing '+i))] : [cad] }); }
it('deduplicates initial observers and equivalent explicit-root return without an extra read', async () => {
  fetcher.mockImplementation(async (url: string) => normalSource(url)); const c = await render();
  expect(fetcher).toHaveBeenCalledTimes(1); await selectFile(c, '3 CAD'); expect(fetcher).toHaveBeenCalledTimes(2);
  expect(c.textContent).toContain('Original.3dm'); expect(c.querySelector('a[aria-label="Download Original.3dm"]')?.getAttribute('href')).toContain(`/Rhino/open?rootId=${rootId}&mode=download`);
  await click(c, 'Back to project folder'); expect(fetcher).toHaveBeenCalledTimes(2); await selectFile(c, '3 CAD'); expect(fetcher).toHaveBeenCalledTimes(2);
});
it('retains the dedicated Files workspace folder, selection and scroll across Work, project remount and fresh cache return', async () => {
  fetcher.mockImplementation(async (url: string) => normalSource(url)); const c = await render(true); await click(c, 'Files'); await selectFile(c, '3 CAD'); await selectFile(c, 'Design.pdf');
  expect(c.textContent).toContain('ACTUAL SELECTED PDF'); const list = c.querySelector('[aria-label="Files list"]') as HTMLDivElement;
  await act(async () => { list.scrollTop = 146; list.dispatchEvent(new Event('scroll')); });
  await click(c, 'Work'); await click(c, 'Files'); expect((c.querySelector('[aria-label="Files list"]') as HTMLDivElement).scrollTop).toBe(146);
  expect(c.querySelector('[aria-current="true"]')?.textContent).toContain('Design.pdf');
  mounted!.unmount(); mounted = undefined; const again = await render(true); expect(again.textContent).toContain('Design.pdf'); expect((again.querySelector('[aria-label="Files list"]') as HTMLDivElement).scrollTop).toBe(146);
  const metadata = fetcher.mock.calls.filter(([url]) => !String(url).includes('/open?')); expect(metadata).toHaveLength(2);
});
it('reads real cursor pages in bounded finding batches and never claims complete no-match while pages remain', async () => {
  fetcher.mockImplementation(async (url: string) => { const p = new URL(url, 'https://fixture').searchParams; const page = Number(p.get('cursor') ?? 0); return Response.json({ ...ready, items: [item(page === 4 ? 'Hidden target' : 'Other '+page)], cursor: page < 5 ? String(page + 1) : null }); });
  const c = await render(); await find(c, 'Hidden target'); await act(async () => vi.advanceTimersByTimeAsync(300)); await flush(); await flush();
  expect(fetcher).toHaveBeenCalledTimes(4); expect(c.textContent).toContain('More files remain'); expect(c.textContent).not.toContain('No files match this name in this folder.');
  await click(c, 'Continue finding in this folder'); expect(fetcher).toHaveBeenCalledTimes(6); expect(c.textContent).toContain('Hidden target'); expect(c.textContent).toContain('Folder complete');
  expect(fetcher.mock.calls.map(([url]) => new URL(url, 'https://fixture').searchParams.get('cursor'))).toEqual([null, '1', '2', '3', '4', '5']);
});
it('does not let late folder or preview responses replace the current selection', async () => {
  let resolveOld: (r: Response) => void = () => undefined;
  fetcher.mockImplementation(async (url: string) => { if (url.includes('/Old/open')) return new Promise<Response>(resolve => { resolveOld = resolve; }); if (url.includes('/New/open')) return new Response('NEW FILE BYTES', { headers: { 'content-type': 'application/pdf' } }); return Response.json({ ...ready, items: [item('Old'), item('New')] }); });
  const c = await render(); await selectFile(c, 'Old.pdf'); await selectFile(c, 'New.pdf'); expect(c.textContent).toContain('NEW FILE BYTES');
  await act(async () => resolveOld(new Response('OLD FILE BYTES', { headers: { 'content-type': 'application/pdf' } }))); await flush(); expect(c.textContent).not.toContain('OLD FILE BYTES');
  const oldSignal = fetcher.mock.calls.find(([url]) => String(url).includes('/Old/open'))?.[1].signal; expect(oldSignal.aborted).toBe(true);
});
it('reuses the selected preview in its expanded modal and refetches only when explicitly refreshed', async () => {
  fetcher.mockImplementation(async (url: string) => url.includes('/open?') ? new Response('DISTINCT FILE', { headers: { 'content-type': 'application/pdf' } }) : Response.json({ ...ready, items: [item('Design')] }));
  const c = await render(); await selectFile(c, 'Design.pdf'); expect(fetcher.mock.calls.filter(([url]) => String(url).includes('/open?'))).toHaveLength(1);
  await click(c, 'Expand preview'); expect(document.body.textContent).toContain('DISTINCT FILE'); await click(document.body, 'Close preview'); expect(fetcher.mock.calls.filter(([url]) => String(url).includes('/open?'))).toHaveLength(1);
  await click(c, 'Refresh files'); expect(fetcher.mock.calls.filter(([url]) => String(url).includes('/open?'))).toHaveLength(2);
});
it('hides stale source actions on denial and offers recovery after source errors', async () => {
  let deny = false; fetcher.mockImplementation(async (url: string) => deny ? new Response(null, { status: 403 }) : normalSource(url));
  const c = await render(); await selectFile(c, '3 CAD'); await selectFile(c, 'Design.pdf'); deny = true; await click(c, 'Refresh files'); expect(c.textContent).toContain('File access is unavailable'); expect(c.querySelector('a')).toBeNull();
  deny = false; const retry = [...c.querySelectorAll('button')].find(b => /retry/i.test(b.textContent ?? ''))!; await act(async () => retry.click()); await flush(); expect(c.textContent).toContain('Design.pdf');
});
it('keeps existing website attachments available as a source and sends no reads for disabled fixtures', async () => {
  fetcher.mockImplementation(async (url: string) => normalSource(url)); const c = await render(); await click(c, 'Website enquiry files'); expect(c.textContent).toContain('Website attachments preserved');
  mounted!.rerender(wrap(<ProjectSharePointFilesPanel projectId="proj_other" host="fixture" disabled />)); const count = fetcher.mock.calls.length; await flush(); expect(fetcher).toHaveBeenCalledTimes(count);
});
it('cancels an old folder read when roots switch and ignores a late old-root response', async () => {
  let finish: (response: Response) => void = () => undefined;
  fetcher.mockImplementation(async (url: string) => {
    const p = new URL(url, 'https://fixture').searchParams;
    if (p.get('folderId') === 'cad') return new Promise<Response>(resolve => { finish = resolve; });
    return Response.json({ ...ready, rootId: p.get('rootId') ?? rootId, items: p.get('rootId') === olderId ? [item('Earlier drawing')] : [cad] });
  });
  const c = await render(); await selectFile(c, '3 CAD');
  const select = c.querySelector('select')!;
  await act(async () => { select.value = olderId; select.dispatchEvent(new Event('change', { bubbles: true })); }); await flush();
  expect(c.textContent).toContain('Earlier drawing');
  await act(async () => finish(Response.json({ ...ready, items: [item('STALE OLD FOLDER')] }))); await flush();
  expect(c.textContent).not.toContain('STALE OLD FOLDER');
  expect(fetcher.mock.calls.find(([url]) => String(url).includes('folderId=cad'))?.[1].signal.aborted).toBe(true);
});
it('scopes metadata and navigation to the authenticated owner and hides cached files after role denial', async () => {
  fetcher.mockImplementation(async () => Response.json({ ...ready, items: [item('Owner drawing')] }));
  const auth = (id: string, role = 'staff') => ({ status: 'authenticated', user: { id }, role, email: null, isAdmin: false, signOut: vi.fn(), refresh: vi.fn() }) as any;
  const view = (id: string, role = 'staff') => wrap(<PortalAuthContext.Provider value={auth(id, role)}><ProjectSharePointFilesPanel projectId="proj_fixture" host="fixture" /></PortalAuthContext.Provider>);
  mounted = renderIntoDocument(view('staff-a')); await flush(); const reads = fetcher.mock.calls.length;
  mounted.rerender(view('staff-b')); expect(mounted.container.textContent).not.toContain('Owner drawing'); await flush(); expect(fetcher.mock.calls.length).toBeGreaterThan(reads);
  expect(client.getQueryCache().getAll().filter(q => q.queryKey.includes('staff-a'))).not.toHaveLength(0);
  mounted.rerender(view('staff-b', 'no_access')); await flush(); expect(mounted.container.textContent).toContain('File access is unavailable'); expect(mounted.container.textContent).not.toContain('Owner drawing');
});
it('retains the selected original download when inline content is unsafe or exceeds the cap', async () => {
  fetcher.mockImplementation(async (url: string) => url.includes('/open?') ? new Response('<svg/>', { headers: { 'content-type': 'image/svg+xml' } }) : Response.json({ ...ready, items: [item('Renamed active'), { ...item('Big'), size: 78000000, viewable: false }] }));
  const c = await render(); await selectFile(c, 'Renamed active.pdf'); expect(c.textContent).toContain('Preview unavailable'); expect(c.querySelector('img')).toBeNull();
  const count = fetcher.mock.calls.length; await selectFile(c, 'Big.pdf'); expect(fetcher).toHaveBeenCalledTimes(count); expect(c.textContent).toContain('Above the 50 MB preview limit'); expect([...c.querySelectorAll('a')].find(a => a.textContent === 'Download original')?.href).toContain('mode=download');
});

it('returns desktop Escape/Close to a persistent current-file Expand control across photo changes without duplicate reads', async () => {
  fetcher.mockImplementation(async (url: string) => url.includes('/open?') ? new Response('RASTER', { headers: { 'content-type': 'image/png' } }) : Response.json({ ...ready, items: [item('Photo1', 'image/png'), item('Photo2', 'image/png')] }));
  const c = await render(); await selectFile(c, 'Photo1.png');
  const expand = button(c, 'Expand preview'); expand.focus(); await click(c, 'Expand preview');
  await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))); await flush();
  expect(document.activeElement).toBe(expand); expect(expand.isConnected).toBe(true);
  await click(c, 'Expand preview'); await click(document.querySelector('[role="dialog"]')!, 'Next photo');
  expect(document.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('Preview Photo2.png');
  await click(document.querySelector('[role="dialog"]')!, 'Close preview');
  expect(document.activeElement).toBe(button(c, 'Expand preview'));
  expect(c.querySelector('aside h4')?.textContent).toBe('Photo2.png');
  expect(fetcher.mock.calls.filter(([url]) => String(url).includes('/open?'))).toHaveLength(2);
});

it('keeps narrow keyboard row return usable and returns gallery close to the current selected photo row', async () => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 390 });
  fetcher.mockImplementation(async (url: string) => url.includes('/open?') ? new Response('RASTER', { headers: { 'content-type': 'image/png' } }) : Response.json({ ...ready, items: [item('Photo1', 'image/png'), item('Photo2', 'image/png')] }));
  const c = await render(); const row = [...c.querySelectorAll('button')].find(b => b.textContent?.includes('Photo1.png'))!;
  row.focus(); await selectFile(c, 'Photo1.png'); await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))); await flush(); expect(document.activeElement).toBe(row);
  await selectFile(c, 'Photo1.png'); await click(document.querySelector('[role="dialog"]')!, 'Next photo'); await click(document.querySelector('[role="dialog"]')!, 'Close preview');
  expect(document.activeElement).toBe(c.querySelector('button[aria-current="true"]'));
  expect(document.activeElement?.textContent).toContain('Photo2.png');
});

const savedKey = filesNavigationKey('fixture', 'staff-a', 'proj_fixture')!;
const cadScope = `${rootId}:cad`;
function seedDeepPosition(pages = 5, top = 22_774.5) {
  writeFilesNavigation(savedKey, { ...emptyFilesNavigation(), rootId, trail: [{ id: 'cad', name: '3 CAD' }], selectedId: 'Detail430', pageCounts: { [cadScope]: pages }, scrolls: { [cadScope]: top } });
}
function pagedSource(url: string, total = 438) {
  if (url.includes('/open?')) return new Response('SELECTED 430 PDF', { headers: { 'content-type': 'application/pdf' } });
  const p = new URL(url, 'https://fixture').searchParams; if (!p.get('folderId')) return Response.json({ ...ready, items: [cad] });
  const start = Number(p.get('cursor') ?? 0); return Response.json({ ...ready, folderId: 'cad', items: Array.from({ length: Math.min(100, total - start) }, (_, i) => item('Detail'+(start+i+1))), cursor: start + 100 < total ? String(start + 100) : null });
}
it('defers deep restoration through real asynchronous cursor pages, preserves its target on partial failure, then recovers', async () => {
  seedDeepPosition(); let release: (response: Response) => void = () => undefined; let gate = true;
  fetcher.mockImplementation(async (url: string) => url.includes('cursor=100') && gate ? new Promise<Response>(resolve => { release = resolve; }) : pagedSource(url));
  const c = await render(); await flush();
  const list = c.querySelector('[aria-label="Files list"]') as HTMLDivElement;
  expect(list.querySelectorAll('tbody tr')).toHaveLength(100); expect(list.scrollTop).toBe(0);
  await act(async () => { list.scrollTop = 22_774.5; list.dispatchEvent(new Event('scroll')); });
  expect(readFilesNavigation(savedKey).scrolls[cadScope]).toBe(22_774.5);
  await act(async () => release(new Response(null, { status: 503 }))); await flush();
  expect(c.textContent).toContain('SharePoint files could not be loaded'); expect(readFilesNavigation(savedKey).scrolls[cadScope]).toBe(22_774.5);
  gate = false; await click(c, 'Retry'); await flush(); await flush();
  const restored = c.querySelector('[aria-label="Files list"]') as HTMLDivElement;
  expect(restored.querySelectorAll('tbody tr')).toHaveLength(438); expect(restored.scrollTop).toBe(22_774.5);
  expect(c.querySelector('button[aria-current="true"]')?.textContent).toContain('Detail430.pdf');
  await find(c, 'Detail430'); expect((c.querySelector('[aria-label="Files list"]') as HTMLDivElement).scrollTop).toBe(0);
  expect(readFilesNavigation(savedKey).scrolls[cadScope]).toBe(22_774.5); await find(c, '');
  expect((c.querySelector('[aria-label="Files list"]') as HTMLDivElement).scrollTop).toBe(22_774.5);
});

it('lets deliberate scrolling take over a pending restoration without fighting the user when remaining pages arrive', async () => {
  seedDeepPosition(); let release: (response: Response) => void = () => undefined;
  fetcher.mockImplementation(async (url: string) => url.includes('cursor=100') ? new Promise<Response>(resolve => { release = resolve; }) : pagedSource(url));
  const c = await render(); await flush(); const list = c.querySelector('[aria-label="Files list"]') as HTMLDivElement;
  await act(async () => { list.dispatchEvent(new WheelEvent('wheel', { bubbles: true })); list.scrollTop = 200; list.dispatchEvent(new Event('scroll')); });
  await act(async () => release(pagedSource('/files?folderId=cad&cursor=100'))); await flush(); await flush();
  expect(list.querySelectorAll('tbody tr')).toHaveLength(438); expect(list.scrollTop).toBe(200); expect(readFilesNavigation(savedKey).scrolls[cadScope]).toBe(200);
});

it('keeps the ten-page automatic restoration budget and preserves a deeper intended offset until explicit continuation or user scroll', async () => {
  seedDeepPosition(20, 100_000); fetcher.mockImplementation(async (url: string) => pagedSource(url, 2000));
  const c = await render(); await flush(); await flush();
  const list = c.querySelector('[aria-label="Files list"]') as HTMLDivElement;
  expect(list.querySelectorAll('tbody tr')).toHaveLength(1000); expect(readFilesNavigation(savedKey).scrolls[cadScope]).toBe(100_000);
  expect(c.textContent).toContain('More files available'); expect(fetcher.mock.calls.filter(([url]) => String(url).includes('folderId=cad'))).toHaveLength(10);
  await act(async () => button(c, 'Load more files').dispatchEvent(new Event('pointerdown', { bubbles: true })));
  await click(c, 'Load more files'); expect(list.querySelectorAll('tbody tr')).toHaveLength(1100);
  await act(async () => { list.scrollTop = 500; list.dispatchEvent(new Event('scroll')); });
  expect(readFilesNavigation(savedKey).scrolls[cadScope]).toBe(100_000);
});
