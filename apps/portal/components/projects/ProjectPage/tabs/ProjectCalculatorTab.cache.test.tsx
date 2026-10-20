import { act } from 'react';
import { QueryClient, QueryClientProvider, dehydrate, hydrate } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../../test/reactHarness';
import { qk } from '@/lib/queries/keys';
import type { EstimateMeta } from '@/lib/estimates/types';
import { __resetLocalFirstStoreForTests, __setLocalFirstStorageAdapterForTests, ensureLocalFirstStoreReady, getLocalFirstWorkingCopy, writeLocalFirstWorkingCopy } from '@/lib/localFirst/store';
import { buildEstimateEntityKey } from '@/lib/localFirst/portalEntities';
import ProjectCalculatorTab from './ProjectCalculatorTab';

const { apiJson, replace, push } = vi.hoisted(() => ({ apiJson: vi.fn(), replace: vi.fn(), push: vi.fn() }));
let project = 'proj_1';
let search = 'tab=estimates&estimateId=est_1';
vi.mock('@/lib/repo/apiClient', () => ({ apiJson }));
vi.mock('next/navigation', () => ({
  usePathname: () => `/staff/projects/${project}`,
  useSearchParams: () => new URLSearchParams(search),
  useRouter: () => ({ replace, push }),
}));
vi.mock('@/components/ui/toast/ToastProvider', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));
vi.mock('@/lib/queries/quotes', () => ({ quoteVersionsByProjectQueryOptions: () => ({ queryKey: ['quote-links'], queryFn: async () => [] }) }));
vi.mock('@/app/staff/calculator/CalculatorGridClient', () => ({
  default: ({ workspace }: { workspace: { editEstimateId?: string } }) => <div data-calculator={workspace.editEstimateId ?? 'new'} />,
}));

const oldRow: EstimateMeta = {
  id: 'est_1', projectId: 'proj_1', versionLabel: 'V3', createdAt: '2026-10-20T00:00:00Z',
  status: 'draft', summary: {}, isActiveDraft: true, hasSentQuote: false,
  jobPackEligible: false, jobPackGeneratedAt: null, jobPackQuoteVersionId: null,
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function restoredCache(rows: EstimateMeta[] = [oldRow]) {
  const before = new QueryClient();
  before.setQueryData(qk.estimates.metaByProject('host', rows[0].projectId), rows, { updatedAt: Date.now() });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  hydrate(client, dehydrate(before));
  before.clear();
  return client;
}
const screen = (client: QueryClient) => <QueryClientProvider client={client}><ProjectCalculatorTab host="host" projectId={project} /></QueryClientProvider>;
async function settle() { await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)); }); }

beforeEach(async () => {
  apiJson.mockReset(); replace.mockReset(); push.mockReset();
  project = 'proj_1'; search = 'tab=estimates&estimateId=est_1';
  __resetLocalFirstStoreForTests();
  __setLocalFirstStorageAdapterForTests({ get: async () => undefined, set: async () => undefined });
  await ensureLocalFirstStoreReady();
});
afterEach(() => { document.body.innerHTML = ''; });

describe('saved design metadata upgrade', () => {
  it.each(['studio', 'calculator'] as const)('refreshes a fresh rehydrated untyped row before opening %s', async (kind) => {
    const request = deferred<{ estimates: EstimateMeta[] }>();
    apiJson.mockReturnValueOnce(request.promise);
    const client = restoredCache();
    const rendered = renderIntoDocument(screen(client));
    expect(apiJson).toHaveBeenCalledWith('/api/projects/proj_1/estimates');
    expect(rendered.container.querySelector('[data-calculator]')).toBeNull();
    expect(replace).not.toHaveBeenCalled();
    await act(async () => request.resolve({ estimates: [{ ...oldRow, designKind: kind }] }));
    await settle();
    if (kind === 'studio') {
      expect(replace).toHaveBeenCalledWith('/staff/design-studio/proj_1/est_1');
      expect(rendered.container.querySelector('[data-calculator]')).toBeNull();
    } else {
      expect(rendered.container.querySelector('[data-calculator="est_1"]')).not.toBeNull();
      expect(replace).not.toHaveBeenCalled();
    }
    expect(apiJson).toHaveBeenCalledTimes(1);
    rendered.unmount(); client.clear();
  });

  it.each(['failed read', 'untyped response', 'wrong project'] as const)('retains a refusal and retry after %s without clearing work', async (failure) => {
    const saved = { privateDraft: 'Retained local input' };
    await writeLocalFirstWorkingCopy({ entityKey: 'unrelated-working-copy', data: saved });
    if (failure === 'failed read') apiJson.mockRejectedValueOnce(Error('Network unavailable'));
    else apiJson.mockResolvedValueOnce({ estimates: [failure === 'untyped response' ? oldRow : { ...oldRow, projectId: 'proj_other', designKind: 'calculator' }] });
    apiJson.mockResolvedValueOnce({ estimates: [{ ...oldRow, designKind: 'studio' }] });
    const client = restoredCache();
    const rendered = renderIntoDocument(screen(client));
    await settle();
    expect(rendered.container.querySelector('[data-calculator]')).toBeNull();
    expect(rendered.container.textContent).toContain('Could not load project designs');
    expect(replace).not.toHaveBeenCalled();
    const retry = Array.from(rendered.container.querySelectorAll('button')).find(button => /retry|try again/i.test(button.textContent ?? ''))!;
    expect(retry).toBeTruthy();
    await act(async () => retry.click());
    await settle();
    expect(replace).toHaveBeenCalledWith('/staff/design-studio/proj_1/est_1');
    expect(getLocalFirstWorkingCopy('unrelated-working-copy')?.data).toEqual(saved);
    rendered.unmount(); client.clear();
  });

  it('ignores an old project refresh when the selected target changes', async () => {
    const first = deferred<{ estimates: EstimateMeta[] }>(), second = deferred<{ estimates: EstimateMeta[] }>();
    apiJson.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const client = restoredCache();
    const target = { ...oldRow, id: 'est_2', projectId: 'proj_2' };
    client.setQueryData(qk.estimates.metaByProject('host', 'proj_2'), [target]);
    const rendered = renderIntoDocument(screen(client));
    project = 'proj_2'; search = 'tab=estimates&estimateId=est_2';
    act(() => rendered.rerender(screen(client)));
    await act(async () => first.resolve({ estimates: [{ ...oldRow, designKind: 'calculator' }] }));
    await settle();
    expect(rendered.container.querySelector('[data-calculator]')).toBeNull();
    expect(replace).not.toHaveBeenCalled();
    await act(async () => second.resolve({ estimates: [{ ...target, designKind: 'studio' }] }));
    await settle();
    expect(replace).toHaveBeenCalledWith('/staff/design-studio/proj_2/est_2');
    expect(replace).not.toHaveBeenCalledWith('/staff/design-studio/proj_1/est_1');
    rendered.unmount(); client.clear();
  });

  it('refreshes ownership again if an old detail cache writes an untyped row into the current list', async () => {
    const request = deferred<{ estimates: EstimateMeta[] }>();
    apiJson.mockReturnValueOnce(request.promise);
    const client = restoredCache([{ ...oldRow, designKind: 'calculator' }]);
    const rendered = renderIntoDocument(screen(client));
    expect(apiJson).not.toHaveBeenCalled();
    expect(rendered.container.querySelector('[data-calculator]')).not.toBeNull();
    await act(async () => client.setQueryData(qk.estimates.metaByProject('host', project), [oldRow]));
    await settle();
    expect(rendered.container.querySelector('[data-calculator]')).toBeNull();
    expect(apiJson).toHaveBeenCalledTimes(1);
    await act(async () => request.resolve({ estimates: [{ ...oldRow, designKind: 'studio' }] }));
    await settle();
    expect(replace).toHaveBeenCalledWith('/staff/design-studio/proj_1/est_1');
    rendered.unmount(); client.clear();
  });

  it('retains the established local calculator draft without requiring a server discriminator', async () => {
    const local = { ...oldRow, id: 'local-estimate:offline' };
    search = `tab=estimates&estimateId=${encodeURIComponent(local.id)}`;
    const copy = { ...local, calculatorSnapshot: { inputs: { widthM: '6.5' } } };
    await writeLocalFirstWorkingCopy({ entityKey: buildEstimateEntityKey(local.id), data: copy });
    const client = restoredCache([local]);
    const rendered = renderIntoDocument(screen(client));
    await settle();
    expect(apiJson).not.toHaveBeenCalled();
    expect(rendered.container.querySelector('[data-calculator="local-estimate:offline"]')).not.toBeNull();
    expect(getLocalFirstWorkingCopy(buildEstimateEntityKey(local.id))?.data).toEqual(copy);
    rendered.unmount(); client.clear();
  });
});
