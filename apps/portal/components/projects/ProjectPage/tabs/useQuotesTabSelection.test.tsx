import {ApiError} from '@/lib/repo/apiClient';
import { act, useSyncExternalStore } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderIntoDocument } from '../../../../../../test/reactHarness';
import { useQuotesTabSelection } from './useQuotesTabSelection';
import { qk } from '@/lib/queries/keys';
import { replaceQuoteDetailCache, upsertQuoteDetailCache } from '@/lib/localFirst/portalEntities';
import { __resetLocalFirstStoreForTests, __setLocalFirstStorageAdapterForTests, ensureLocalFirstStoreReady, registerLocalFirstIdAlias } from '@/lib/localFirst/store';
import type { QuoteVersionDetail } from '@/lib/quotes/types';

const h = vi.hoisted(() => ({ get: vi.fn(), error: vi.fn() }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(useSyncExternalStore(
  listener => { window.addEventListener('popstate', listener); return () => window.removeEventListener('popstate', listener); },
  () => window.location.search, () => '',
)) }));
vi.mock('@/components/ui/toast/ToastProvider', () => ({ useToast: () => ({ error: h.error }) }));
vi.mock('@/lib/supabase/browserClient', () => ({ supabaseHostFromUrl: () => 'host', supabaseRuntimeUrl: () => 'https://example.supabase.co' }));
vi.mock('@/lib/quotes/quotesRepo', () => ({ getQuoteVersion: h.get, listQuoteVersions: async () => [] }));
vi.mock('@/lib/queries/projectEstimates', () => ({ estimateMetasByProjectQueryOptions: () => ({ queryKey: ['estimates'], queryFn: async () => [] }) }));
vi.mock('@/lib/queries/jobPacks', () => ({ generatedJobPacksByProjectQueryOptions: () => ({ queryKey: ['jobPacks'], queryFn: async () => [] }) }));

const localId = 'local-quote:synthetic-intent';
const durableId = 'qv_synthetic';
const local = { id: localId, quoteId: localId, projectId: 'proj_test', status: 'DRAFT', sourceEstimateVersionId: 'est_revised', sourceEstimateVersionLabel: 'V2', totals: { totalIncGstCents: 1029003 } } as QuoteVersionDetail;
const durable = { ...local, id: durableId, quoteId: 'qt_synthetic' };
const nativePush = window.history.pushState.bind(window.history);
let client: QueryClient;
let mounted: ReturnType<typeof renderIntoDocument> | undefined;
let selection: ReturnType<typeof useQuotesTabSelection>;
function Harness() {
  selection = useQuotesTabSelection({ projectId: 'proj_test' });
  return <div data-selected={selection.selectedId}>{selection.detail?.id ?? 'no detail'}</div>;
}
function mount() { mounted = renderIntoDocument(<QueryClientProvider client={client}><Harness /></QueryClientProvider>); }
async function settle() { await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); }); }

beforeEach(async () => {
  __resetLocalFirstStoreForTests();
  __setLocalFirstStorageAdapterForTests({ get: async () => undefined, set: async () => undefined });
  await ensureLocalFirstStoreReady();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  h.get.mockReset().mockResolvedValue(durable); h.error.mockReset();
  nativePush(null, '', '/staff/projects/proj_test?tab=quotes');
  vi.spyOn(window.history, 'pushState').mockImplementation((...args) => { nativePush(...args); window.dispatchEvent(new Event('popstate')); });
  upsertQuoteDetailCache(client, 'host', 'proj_test', local);
});
afterEach(() => { mounted?.unmount(); mounted = undefined; client.clear(); vi.restoreAllMocks(); __resetLocalFirstStoreForTests(); });

describe('quote creation identity handoff', () => {
  it('never sends a provisional ID to the server while pending or when its cache is invalidated', async () => {
    mount(); act(() => selection.selectQuote(localId, { createFromEstimateId: null }));
    await act(async () => { await client.invalidateQueries({ queryKey: qk.quotes.detail('host', localId) }); });
    await settle();
    expect(h.get).not.toHaveBeenCalled();
    expect(selection.detail).toMatchObject({ id: localId, sourceEstimateVersionId: 'est_revised', totals: local.totals });
    expect(h.error).not.toHaveBeenCalled();
  });

  it('moves an open optimistic draft to the canonical cache and URL after delayed persistence', async () => {
    mount(); act(() => selection.selectQuote(localId, { createFromEstimateId: null })); await settle();
    await act(async () => {
      // The real mutation handler replaces the cache before persisting the alias.
      replaceQuoteDetailCache(client, 'host', 'proj_test', localId, durable);
      await new Promise(resolve => setTimeout(resolve, 10));
      await registerLocalFirstIdAlias(localId, durableId);
    });
    await settle();
    expect(h.get.mock.calls.flat()).not.toContain(localId);
    expect(selection.selectedId).toBe(durableId);
    expect(selection.detail).toEqual(durable);
    expect(new URL(window.location.href).searchParams.get('quoteId')).toBe(durableId);
    mounted!.unmount(); mounted = undefined; mount(); await settle();
    expect(selection.detail).toEqual(durable);
  });

  it('resolves an already-completed alias before starting a selected detail query', async () => {
    replaceQuoteDetailCache(client, 'host', 'proj_test', localId, durable);
    await registerLocalFirstIdAlias(localId, durableId);
    mount(); act(() => selection.selectQuote(localId)); await settle();
    expect(h.get.mock.calls.flat()).not.toContain(localId);
    expect(selection.detail?.id).toBe(durableId);
    expect(new URL(window.location.href).searchParams.get('quoteId')).toBe(durableId);
  });

  it('does not reopen a draft when its late create finishes after staff return to the list', async () => {
    mount(); act(() => selection.selectQuote(localId)); act(() => selection.selectQuote(null));
    await act(async () => { replaceQuoteDetailCache(client, 'host', 'proj_test', localId, durable); await registerLocalFirstIdAlias(localId, durableId); });
    await settle();
    expect(selection.selectedId).toBeNull();
    expect(new URL(window.location.href).searchParams.has('quoteId')).toBe(false);
    expect(client.getQueryData(qk.quotes.versionsByProject('host', 'proj_test'))).toEqual([expect.objectContaining({ id: durableId })]);
  });
});

it('clears a genuine cached quote after a denied refresh without changing its selection identity',async()=>{client.setQueryData(qk.quotes.detail('host',durableId),durable);nativePush(null,'',`/staff/projects/proj_test?tab=quotes&quoteId=${durableId}`);mount();await settle();expect(selection.detail?.id).toBe(durableId);h.get.mockRejectedValueOnce(new ApiError('Access ended',{status:403,body:null}));await act(async()=>{await selection.quoteDetailQuery.refetch();});await settle();expect(selection.selectedId).toBe(durableId);expect(selection.detail).toBeNull();expect(client.getQueryData(qk.quotes.detail('host',durableId))).toBeTruthy();});
