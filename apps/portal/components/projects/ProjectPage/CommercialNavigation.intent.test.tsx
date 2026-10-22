import { act, useSyncExternalStore } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import { bindLocalFirstStoreOwner, __resetLocalFirstStoreForTests, __setLocalFirstStorageAdapterForTests } from '@/lib/localFirst/store';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProjectPageShell from './ProjectPageShell';
import { useProjectTabSelection } from './useProjectTabSelection';
import { useProjectViewDraftGuard } from './projectViewNavigation';

const h = vi.hoisted(() => ({ index: 0, loads: {} as Record<string, () => Promise<any>>, prefetch: vi.fn() }));
let canonicalSearch = '?tab=estimates';
let bridgeHeld = true;
const listeners = new Set<() => void>();
let client: QueryClient;
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => window.location.pathname, useSearchParams: () => new URLSearchParams(useSyncExternalStore(
  (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
  () => canonicalSearch, () => canonicalSearch,
)) }));
vi.mock('@/components/ui/toast/ToastProvider', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));
vi.mock('@/components/auth/PortalAuthProvider', () => ({ usePortalSession: () => ({ isAdmin: false, role: 'staff' }) }));
vi.mock('@/lib/supabase/browserClient', () => ({ supabaseRuntimeUrl: () => 'https://example.invalid', supabaseHostFromUrl: () => 'host' }));
vi.mock('@/lib/localFirst/useResolvedLocalFirstId', () => ({ useResolvedLocalFirstId: (value: string) => value }));
vi.mock('@/lib/queries/projectEstimates', () => ({ estimateMetasByProjectQueryOptions: (_host: string, id: string) => ({ queryKey: ['estimates', id], queryFn: async () => [] }), estimateDetailQueryOptions: () => ({ queryKey: ['unused-detail'], queryFn: async () => null }) }));
vi.mock('@/lib/queries/quotes', () => ({ quoteVersionsByProjectQueryOptions: (_host: string, id: string) => ({ queryKey: ['quotes', id], queryFn: async () => [] }), quoteVersionDetailQueryOptions: () => ({ queryKey: ['unused-quote'], queryFn: async () => null }) }));
vi.mock('@/lib/queries/jobPacks', () => ({ generatedJobPacksByProjectQueryOptions: (_host: string, id: string) => ({ queryKey: ['job-packs', id], queryFn: async () => [] }) }));
vi.mock('@/lib/queries/invoices', () => ({ depositInvoicesByProjectQueryOptions: (_host: string, id: string) => ({ queryKey: ['invoices', id], queryFn: async () => [] }) }));
vi.mock('@/lib/repo/invoicesRepo', async () => ({ ...await vi.importActual('@/lib/repo/invoicesRepo'), loadProjectInvoiceSchedule: async () => ({ terms: [], payments: [], totals: { invoicedIncGstCents: 0, paidIncGstCents: 0, outstandingIncGstCents: 0 } }) }));
vi.mock('./projectTabModules', async () => {
  const { default: Loadable } = await vi.importActual<typeof import('next/dist/shared/lib/lazy-dynamic/loadable')>('next/dist/shared/lib/lazy-dynamic/loadable');
  const Commercial = (await import('./tabs/CommercialTab')).default;
  return { CommercialTab: Loadable({ loader: async () => ({ default: Commercial }), loading: () => <div data-outer-commercial-pending /> }),
    OverviewTab: () => null, FilesTab: () => null, JobPacksTab: () => null };
});
vi.mock('next/dynamic', async () => {
  const { default: Loadable } = await vi.importActual<typeof import('next/dist/shared/lib/lazy-dynamic/loadable')>('next/dist/shared/lib/lazy-dynamic/loadable');
  return { default: (loader: () => Promise<any>, options?: object) => {
    const kind = ['estimates', 'quotes', 'invoices'][h.index++];
    // Preserve the installed factory's actual ssr/loading boundary defaults.
    return Loadable({ loader: kind ? () => h.loads[kind]() : loader, ...options });
  } };
});
function deferred() {
  let resolve!: (value: any) => void;
  const promise = new Promise<any>((accept) => { resolve = accept; });
  return { promise, resolve };
}
function loaded(kind: string) { return { default: ({ projectId }: { projectId: string }) => <div data-lazy-body={kind} data-project={projectId} /> }; }
function adoptUrl() { canonicalSearch = window.location.search; for (const listener of listeners) listener(); }
function adoptPopstate() { if (!bridgeHeld) adoptUrl(); }
async function go(direction: 'back' | 'forward') {
  await act(async () => { await new Promise<void>((resolve) => { window.addEventListener('popstate', () => resolve(), { once: true }); window.history[direction](); }); });
}
function Page({ projectId = 'proj_1' }: { projectId?: string }) {
  const selection = useProjectTabSelection(projectId, 'estimates', true);
  useProjectViewDraftGuard(true);
  return <QueryClientProvider client={client}><ProjectPageShell projectId={projectId} snapshot={null} host="host" readOnly tab="estimates"
    optimisticTab={selection.optimisticTab} onTabSelect={selection.selectTab} /></QueryClientProvider>;
}
beforeEach(() => { __setLocalFirstStorageAdapterForTests({ get: async () => undefined, set: h.prefetch }); bindLocalFirstStoreOwner('fictional-navigation-user'); client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); window.history.replaceState(null, '', '/staff/projects/proj_1?tab=estimates'); canonicalSearch = window.location.search; bridgeHeld = true; window.addEventListener('popstate', adoptPopstate); });
afterEach(() => { client.clear(); __resetLocalFirstStoreForTests(); __setLocalFirstStorageAdapterForTests(null); window.removeEventListener('popstate', adoptPopstate); vi.restoreAllMocks(); });

it('shares guarded urgent intent above delayed bodies, then follows canonical Back and project identity', async () => {
  const quotes = deferred(), invoices = deferred();
  h.loads.estimates = async () => loaded('estimates'); h.loads.quotes = () => quotes.promise.then(() => import('./tabs/QuotesTab')); h.loads.invoices = () => invoices.promise.then(() => import('./tabs/InvoicesTab'));
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  const view = renderIntoDocument(<Page />);
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)); });
  const tabs = view.container.querySelector('[role="tablist"]');
  const button = (label: string) => [...view.container.querySelectorAll('button')].find((node) => node.textContent === label)!;
  const selected = () => view.container.querySelector('[aria-label="Commercial sections"] [aria-selected="true"]')?.textContent;
  act(() => button('Quotes').click());
  expect(selected()).toBe('Estimates'); expect(window.location.search).toBe('?tab=estimates');
  confirm.mockReturnValue(true);
  act(() => button('Quotes').click());
  expect(canonicalSearch).toBe('?tab=estimates'); // Next's canonical bridge has not committed.
  expect(view.container.querySelector('[data-project-commercial-view]')?.getAttribute('data-project-commercial-view')).toBe('quotes');
  expect(selected()).toBe('Quotes'); expect(view.container.querySelector('[data-project-tab-body]')?.getAttribute('data-project-tab-body')).toBe('quotes');
  expect(view.container.querySelector('[data-commercial-code-pending="quotes"]')).not.toBeNull();
  act(() => button('Invoices').click());
  expect(selected()).toBe('Invoices'); expect(view.container.querySelector('[data-commercial-code-pending="invoices"]')).not.toBeNull();
  await go('back');
  expect(window.location.search).toBe('?tab=quotes'); expect(canonicalSearch).toBe('?tab=estimates'); expect(selected()).toBe('Quotes');
  await go('back');
  expect(window.location.search).toBe('?tab=estimates'); expect(canonicalSearch).toBe('?tab=estimates'); expect(selected()).toBe('Estimates');
  await go('forward'); expect(selected()).toBe('Quotes');
  await go('forward'); expect(selected()).toBe('Invoices');
  act(() => { canonicalSearch = '?tab=quotes'; for (const listener of listeners) listener(); });
  expect(selected()).toBe('Invoices'); // A retired bridge update cannot replace current history intent.
  await act(async () => { quotes.resolve(null); await vi.dynamicImportSettled(); });
  expect(view.container.querySelector('#quote-search')).toBeNull();
  await act(async () => { invoices.resolve(null); await vi.dynamicImportSettled(); });
  expect(view.container.querySelector('#invoice-search')).not.toBeNull(); expect(view.container.querySelector('table')?.textContent).toContain('Invoice');
  act(adoptUrl); expect(selected()).toBe('Invoices'); expect(view.container.querySelector('[role="tablist"]')).toBe(tabs);
  bridgeHeld = false; await go('back');
  expect(selected()).toBe('Quotes'); expect(view.container.querySelector('#quote-search')).not.toBeNull(); expect(view.container.querySelector('table')?.textContent).toContain('Quote');
  act(() => button('Invoices').click());
  act(() => { window.history.replaceState(null, '', '/staff/projects/proj_2?tab=estimates'); adoptUrl(); view.rerender(<Page projectId="proj_2" />); });
  expect(selected()).toBe('Estimates'); expect(view.container.querySelector('[data-lazy-body]')?.getAttribute('data-project')).toBe('proj_2');
  expect(h.prefetch).not.toHaveBeenCalled();
  view.unmount();
});
