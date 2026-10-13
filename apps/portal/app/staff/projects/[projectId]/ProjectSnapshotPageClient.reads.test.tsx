import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../../test/reactHarness';
import { qk } from '@/lib/queries/keys';
import { useActiveProjectOverviewReads } from '@/components/projects/ProjectPage/ProjectOverviewReads';
import ProjectSnapshotPageClient from './ProjectSnapshotPageClient';

const state = vi.hoisted(() => ({ search: '', preload: vi.fn().mockResolvedValue(undefined) }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(state.search) }));
vi.mock('@/components/projects/ProjectPage/projectTabModules', () => ({ preloadProjectOverviewModule: state.preload }));
vi.mock('@/lib/supabase/browserClient', () => ({ supabaseHostFromUrl: () => 'host', supabaseRuntimeUrl: () => 'https://host.supabase.co' }));
vi.mock('@/components/debug/PortalDebugExportButton', () => ({ default: () => null }));
vi.mock('@/components/navigation/ProjectsIndexLink', () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));
vi.mock('@/components/projects/ProjectPage/ProjectPageFrame', () => ({
  default: ({ snapshot, host, optimisticTab, onTabSelect, snapshotState }: any) => {
    const { commandQuery, paymentQuery } = useActiveProjectOverviewReads(host, snapshot.project.id);
    return <div data-frame={snapshot.project.id} data-snapshot={snapshotState}>
      <span>{snapshot.project.name}</span>
      <span data-command={commandQuery.data?.projectId}>{commandQuery.data?.projectId}</span>
      <span data-payment={paymentQuery.data?.paidIncGstCents} />
      <span data-command-fetching={String(commandQuery.isFetching)} data-tab={optimisticTab} />
      <button onClick={() => onTabSelect('estimates')}>Commercial</button>
      <button onClick={() => onTabSelect('activity')}>Overview</button>
    </div>;
  },
}));

type PendingRequest = { path: string; resolve: (response: Response) => void; answered: boolean };
let requests: PendingRequest[];
let client: QueryClient;
let view: ReturnType<typeof renderIntoDocument> | undefined;

function response(kind: string, id = 'proj_1') {
  const project = { id: id === '00000000-0000-4000-8000-000000000001' ? `proj_${id}` : id, name: `Private ${id}`, stage: 'new', hasJobPacks: true };
  if (kind === 'command-centre') return { projectId: id, workModel: 'v2' };
  if (kind === 'invoice-schedule') return { schedule: { paidIncGstCents: 12345 } };
  return { snapshot: { project, workModel: 'v2', pipeline: { stage: 'new' }, activity: [], emails: [], notes: [] }, generatedAt: '2026-10-13T00:00:00Z' };
}
function element(projectId = 'proj_1', tab = 'activity') {
  return <QueryClientProvider client={client}><ProjectSnapshotPageClient projectId={projectId} tab={tab} estimateId={null} debugExportEnabled={false} /></QueryClientProvider>;
}
async function settle() {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
}
async function answer(kind: string, status = 200, id = 'proj_1') {
  const request = requests.find((item) => !item.answered && item.path.includes(`/${id}/`) && item.path.endsWith(`/${kind}`));
  expect(request, `pending ${id}/${kind}`).toBeDefined();
  request!.answered = true;
  await act(async () => {
    request!.resolve(new Response(JSON.stringify(status === 200 ? response(kind, id) : { error: 'Unavailable' }), { status }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await settle();
}
function count(kind: string) { return requests.filter((request) => request.path.endsWith(`/${kind}`)).length; }

beforeEach(() => {
  requests = [];
  state.search = '';
  state.preload.mockClear();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60_000, gcTime: Infinity } } });
  vi.stubGlobal('fetch', vi.fn((path: string) => new Promise<Response>((resolve) => requests.push({ path, resolve, answered: false }))));
});
afterEach(() => { view?.unmount(); view = undefined; client.clear(); vi.unstubAllGlobals(); });

describe('active Overview reads across the route and lazy-consumer boundary', () => {
  it.each(['before', 'after'])('starts all four reads together and never rereads when data finishes %s Overview mounts', async (order) => {
    view = renderIntoDocument(element());
    expect(requests.map((request) => request.path.split('/').at(-1)).sort()).toEqual(['command-centre', 'invoice-schedule', 'snapshot', 'summary']);
    expect(state.preload).toHaveBeenCalledTimes(1);
    expect(view.container.querySelector('[data-frame]')).toBeNull();
    if (order === 'before') { await answer('command-centre'); await answer('invoice-schedule'); }
    await answer('summary');
    expect(view.container.querySelector('[data-frame]')).not.toBeNull();
    if (order === 'after') { await answer('command-centre'); await answer('invoice-schedule'); }
    await answer('snapshot');
    expect(view.container.querySelector('[data-command="proj_1"]')).not.toBeNull();
    expect(view.container.querySelector('[data-payment="12345"]')).not.toBeNull();
    expect(view.container.querySelector('[data-project-snapshot-state="fresh"]')).not.toBeNull();
    expect(requests).toHaveLength(4);
  });

  it('keeps raw UUID links on the same canonical Overview keys as their returned snapshot', async () => {
    const uuid = '00000000-0000-4000-8000-000000000001';
    const appId = `proj_${uuid}`;
    view = renderIntoDocument(element(uuid));
    await answer('command-centre', 200, appId); await answer('invoice-schedule', 200, appId);
    await answer('summary', 200, uuid); await answer('snapshot', 200, uuid);
    expect(view.container.querySelector(`[data-frame="${appId}"]`)).not.toBeNull();
    expect(view.container.querySelector(`[data-command="${appId}"]`)).not.toBeNull();
    expect(requests).toHaveLength(4);
    expect(client.getQueryData(qk.projects.commandCentre('host', appId))).toBeDefined();
  });

  it('does not load Overview for direct Commercial entry, and refreshes its stale command view on return', async () => {
    view = renderIntoDocument(element('proj_1', 'estimates'));
    expect(requests).toHaveLength(2);
    expect(state.preload).not.toHaveBeenCalled();
    await answer('snapshot');
    act(() => [...view!.container.querySelectorAll('button')].find((button) => button.textContent === 'Overview')!.click());
    await answer('command-centre'); await answer('invoice-schedule');
    expect(count('command-centre')).toBe(1);
    act(() => [...view!.container.querySelectorAll('button')].find((button) => button.textContent === 'Commercial')!.click());
    act(() => [...view!.container.querySelectorAll('button')].find((button) => button.textContent === 'Overview')!.click());
    expect(count('command-centre')).toBe(2);
    // The existing payment freshness policy remains unchanged.
    expect(count('invoice-schedule')).toBe(1);
    expect(view.container.querySelector('[data-command-fetching="true"]')).not.toBeNull();
  });

  it('resolves unknown Job Packs availability without speculative Overview reads', async () => {
    view = renderIntoDocument(element('proj_1', 'job-packs'));
    expect(requests).toHaveLength(2);
    await answer('snapshot');
    expect(requests).toHaveLength(2);
  });

  it.each(['summary', 'snapshot', 'command-centre', 'invoice-schedule'])('keeps early %s denial authoritative even when older project reads finish later', async (kind) => {
    view = renderIntoDocument(element());
    await answer(kind, 403);
    expect(view.container.querySelector('[data-project-snapshot-state="unavailable"]')).not.toBeNull();
    if (kind !== 'summary') await answer('summary');
    if (kind !== 'snapshot') await answer('snapshot');
    if (kind !== 'command-centre') await answer('command-centre');
    if (kind !== 'invoice-schedule') await answer('invoice-schedule');
    expect(view.container.textContent).not.toContain('Private proj_1');
    expect(requests).toHaveLength(4);
    expect(client.getQueryData(qk.projects.snapshot('host', 'proj_1'))).toBeUndefined();
    expect(client.getQueryData(qk.invoices.scheduleByProject('host', 'proj_1'))).toBeUndefined();
  });

  it.each([401, 403, 404])('hides and evicts all cached project facts after a late payment %s', async (status) => {
    view = renderIntoDocument(element());
    for (const kind of ['summary', 'snapshot', 'command-centre', 'invoice-schedule']) await answer(kind);
    client.setQueryData(qk.estimates.metaByProject('host', 'proj_1'), ['private estimate']);
    client.setQueryData(qk.quotes.versionsByProject('host', 'proj_1'), ['private quote']);
    client.setQueryData(qk.jobPacks.list('host', 'proj_1'), ['private pack']);
    act(() => { void client.invalidateQueries({ queryKey: qk.invoices.scheduleByProject('host', 'proj_1') }); });
    await answer('invoice-schedule', status);
    expect(view.container.querySelector('[data-frame]')).toBeNull();
    expect(view.container.textContent).not.toContain('Private proj_1');
    for (const query of client.getQueryCache().getAll()) expect(query.state.data).toBeUndefined();
  });

  it('never transfers a previous project response or optimistic tab into the next route', async () => {
    view = renderIntoDocument(element());
    await answer('summary');
    act(() => [...view!.container.querySelectorAll('button')].find((button) => button.textContent === 'Commercial')!.click());
    view.rerender(element('proj_2'));
    expect(view.container.textContent).not.toContain('Private proj_1');
    await answer('command-centre'); await answer('invoice-schedule'); await answer('snapshot');
    expect(view.container.textContent).not.toContain('Private proj_1');
    for (const kind of ['summary', 'snapshot', 'command-centre', 'invoice-schedule']) await answer(kind, 200, 'proj_2');
    expect(view.container.querySelector('[data-command="proj_2"]')).not.toBeNull();
    expect(view.container.textContent).not.toContain('Private proj_1');
  });
});
