import { act, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import ProjectMainTabs from './ProjectMainTabs';
import { ProjectCommercialProvider } from './ProjectCommercialContext';

let search = 'tab=estimates';
const { estimates, packs, editorModules } = vi.hoisted(() => ({ estimates: vi.fn(), packs: vi.fn(), editorModules: vi.fn() }));
vi.mock('next/dynamic', async () => {
  const { default: Loadable } = await vi.importActual<typeof import('next/dist/shared/lib/lazy-dynamic/loadable')>('next/dist/shared/lib/lazy-dynamic/loadable');
  return { default: (loader: () => Promise<any>, options?: object) => Loadable({ loader: () => {
    if (String(loader).includes('CalculatorGridClient')) { editorModules(); return new Promise(() => undefined); }
    return loader();
  }, ...options }) };
});
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(search), usePathname: () => '/staff/projects/proj_1', useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));
vi.mock('@/components/ui/toast/ToastProvider', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));
vi.mock('@/lib/supabase/browserClient', () => ({ supabaseRuntimeUrl: () => 'https://example.invalid', supabaseHostFromUrl: () => 'host' }));
vi.mock('@/lib/localFirst/useResolvedLocalFirstId', () => ({ useResolvedLocalFirstId: (value: string) => value }));
vi.mock('@/lib/queries/projectEstimates', () => ({ estimateMetasByProjectQueryOptions: () => ({ queryKey: ['estimates', 'proj_1'], queryFn: estimates }), estimateDetailQueryOptions: () => ({ queryKey: ['unused-detail'], queryFn: vi.fn() }) }));
vi.mock('@/lib/queries/quotes', () => ({ quoteVersionsByProjectQueryOptions: () => ({ queryKey: ['quotes', 'proj_1'], queryFn: async () => [] }) }));
vi.mock('@/lib/queries/jobPacks', () => ({ generatedJobPacksByProjectQueryOptions: () => ({ queryKey: ['job-packs', 'proj_1'], queryFn: packs }) }));
vi.mock('@/app/staff/calculator/CalculatorGridClient', () => ({ default: () => { throw new Error('Record runtime must not mount for this list read'); } }));

function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((accept) => { resolve = accept; }); return { promise, resolve }; }
function tree(client: QueryClient, tab: string, ready = false) {
  const snapshot = ready ? { project: { id: 'proj_1', name: 'Verified project', hasJobPacks: true } } as any : null;
  return <QueryClientProvider client={client}><ProjectCommercialProvider projectId="proj_1" ready={ready}><Suspense fallback={null}><ProjectMainTabs host="host" projectId="proj_1" snapshot={snapshot} snapshotContentReady={ready} snapshotState={ready ? 'fresh' : 'pending'} tab={tab} /></Suspense></ProjectCommercialProvider></QueryClientProvider>;
}
async function settleModules() { for (let depth = 0; depth < 3; depth += 1) await act(async () => { await vi.dynamicImportSettled(); }); }

describe('actual Project specialist parent during independent reads', () => {
  it('keeps the actual Estimates Find and table before and after both source and metadata settle', async () => {
    search = 'tab=estimates'; editorModules.mockClear();
    const read = deferred<any[]>(); estimates.mockReturnValue(read.promise);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = renderIntoDocument(tree(client, 'estimates'));
    await settleModules();
    const find = view.container.querySelector('#estimate-search') as HTMLInputElement;
    const table = view.container.querySelector('table');
    expect(find).not.toBeNull(); expect(find.disabled).toBe(false);
    expect(table?.textContent).toContain('Estimate');
    expect(editorModules).not.toHaveBeenCalled();
    expect(view.container.textContent).toContain('Reading estimates');
    expect(view.container.textContent).not.toContain('Create estimate');
    await act(async () => { read.resolve([{ id: 'est_1', projectId: 'proj_1', versionLabel: 'V2', createdAt: '2026-10-01', status: 'draft', isActiveDraft: true }]); await new Promise((resolve) => setTimeout(resolve, 5)); });
    expect(table?.textContent).toContain('V2');
    view.rerender(tree(client, 'estimates', true));
    expect(view.container.querySelector('#estimate-search')).toBe(find);
    expect(view.container.querySelector('table')).toBe(table);
    expect(view.container.textContent).toContain('Create estimate');
    expect(editorModules).not.toHaveBeenCalled();
    view.unmount(); client.clear();
  });

  it('mounts the actual Job Pack table before availability metadata is known', async () => {
    search = 'tab=job-packs';
    const read = deferred<any[]>(); packs.mockReturnValue(read.promise);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = renderIntoDocument(tree(client, 'job-packs'));
    await settleModules();
    const table = view.container.querySelector('table');
    expect(table).not.toBeNull(); expect(table?.textContent).toContain('Reading job packs');
    await act(async () => { read.resolve([]); await new Promise((resolve) => setTimeout(resolve, 5)); });
    expect(view.container.textContent).toContain('No job packs yet');
    view.rerender(tree(client, 'job-packs', true));
    expect(view.container.querySelector('table')).toBe(table);
    view.unmount(); client.clear();
  });
});
