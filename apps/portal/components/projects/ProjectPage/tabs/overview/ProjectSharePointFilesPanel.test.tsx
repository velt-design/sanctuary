import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../../../test/reactHarness';
import ProjectSharePointFilesPanel from './ProjectSharePointFilesPanel';
vi.mock('next/link', () => ({ default: ({ children, href, prefetch: _prefetch, ...props }: any) => <a href={href} {...props}>{children}</a> }));
const rootId = '11111111-1111-4111-8111-111111111111';
const ready = { state: 'ready', roots: [{ id: rootId, itemId: 'root', label: 'Current project' }, { id: '22222222-2222-4222-8222-222222222222', itemId: 'older', label: 'Earlier enquiry' }], rootId, folderId: 'root', items: [], cursor: null };
let client: QueryClient, unmount: (() => void) | undefined;
const fetcher = vi.fn();
beforeEach(() => { vi.useFakeTimers(); vi.stubGlobal('fetch', fetcher); client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); fetcher.mockReset(); });
afterEach(() => { unmount?.(); client.clear(); vi.useRealTimers(); vi.unstubAllGlobals(); });
async function flush() { await act(async () => { await vi.advanceTimersByTimeAsync(5); }); }
async function render(disabled = false) {
  const mounted = renderIntoDocument(<QueryClientProvider client={client}><ProjectSharePointFilesPanel projectId="proj_fixture" host="fixture" disabled={disabled} /></QueryClientProvider>);
  unmount = mounted.unmount; await flush(); return mounted.container;
}
async function click(container: HTMLElement, text: string) { const button = [...container.querySelectorAll('button')].find(value => value.textContent === text); expect(button).toBeTruthy(); await act(async () => button!.click()); await flush(); }
it('opens CAD folder, downloads Rhino, views PDF, and returns to the root', async () => {
  fetcher.mockImplementation(async (url: string) => Response.json(url.includes('folderId=cad') ? { ...ready, folderId: 'cad', items: [{ id: 'rhino', name: 'Original.3dm', kind: 'file', size: 470000000, viewable: false }, { id: 'pdf', name: 'Design.pdf', kind: 'file', size: 1000, viewable: true }] } : { ...ready, items: [{ id: 'cad', name: '3 CAD', kind: 'folder', size: 0, viewable: false }] }));
  const container = await render();
  await click(container, '3 CAD');
  expect(container.textContent).toContain('Original.3dm');
  expect(container.querySelectorAll('a')).toHaveLength(3);
  expect(container.querySelector('a')?.href).toContain(`/rhino/open?rootId=${rootId}&mode=download`);
  expect([...container.querySelectorAll('a')].find(a => a.textContent === 'View')?.href).toContain('/pdf/open');
  await click(container, 'Back to project folder'); expect(container.textContent).toContain('3 CAD'); expect(container.textContent).not.toContain('Original.3dm');
});
it('changes explicit roots and pages without carrying old folder state', async () => {
  fetcher.mockImplementation(async (url: string) => Response.json({ ...ready, rootId: new URL(url, 'https://fixture').searchParams.get('rootId') ?? rootId, cursor: url.includes('cursor=next') ? null : 'next' }));
  const container = await render();
  await click(container, 'Next page'); expect(fetcher.mock.calls.at(-1)?.[0]).toContain('cursor=next');
  await click(container, 'Previous page');
  const select = container.querySelector('select')!;
  await act(async () => { select.value = ready.roots[1].id; select.dispatchEvent(new Event('change', { bubbles: true })); }); await flush();
  expect(fetcher.mock.calls.at(-1)?.[0]).toContain(`rootId=${ready.roots[1].id}`);
  expect(fetcher.mock.calls.at(-1)?.[0]).not.toContain('cursor=');
});
it('recovers from connection failure and distinguishes pending setup', async () => {
  fetcher.mockResolvedValueOnce(new Response(null, { status: 503 })).mockImplementation(async () => Response.json({ ...ready, state: 'pending', roots: [] }));
  const container = await render(); expect(container.textContent).toContain('could not be loaded');
  const retry = [...container.querySelectorAll('button')][0]; await act(async () => retry.click()); await flush();
  expect(container.textContent).toContain('being prepared');
});
it('does not issue network requests for static fixtures', async () => { await render(true); expect(fetcher).not.toHaveBeenCalled(); });
