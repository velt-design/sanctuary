import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../../test/reactHarness';
import { qk } from '@/lib/queries/keys';
import { useActiveProjectOverviewReads } from '@/components/projects/ProjectPage/ProjectOverviewReads';
import ProjectMainTabs from '@/components/projects/ProjectPage/ProjectMainTabs';
import ProjectSnapshotPageClient from './ProjectSnapshotPageClient';
import type { ProjectWorkInitialRead } from '@/lib/projects/projectWorkInitialRead';
vi.mock('@/components/auth/PortalAuthProvider', () => ({ usePortalSession: () => ({ user: { id: 'staff-a' } }) }));

const state = vi.hoisted(() => ({ search: '', preload: vi.fn().mockResolvedValue(undefined) }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(state.search) }));
vi.mock('@/components/projects/ProjectPage/projectTabModules', () => ({
  preloadProjectOverviewModule: state.preload,
  OverviewTab: () => <div data-testid="overview-tab" />,
  CommercialTab: () => <div data-testid="commercial-tab" />,
  FilesTab: () => <div data-testid="files-tab" />,
  JobPacksTab: () => <div data-testid="job-packs-tab" />,
}));
vi.mock('@/lib/supabase/browserClient', () => ({ supabaseHostFromUrl: () => 'host', supabaseRuntimeUrl: () => 'https://host.supabase.co' }));
vi.mock('@/components/debug/PortalDebugExportButton', () => ({ default: () => null }));
vi.mock('@/components/navigation/ProjectsIndexLink', () => ({ default: ({ children, ...props }: any) => <a {...props}>{children}</a> }));
vi.mock('@/components/projects/ProjectPage/ProjectPageFrame', () => ({
  default: ({ snapshot, projectId, host, optimisticTab, onTabSelect, snapshotState, snapshotContentReady, tab, statusPanel }: any) => {
    const { commandQuery, paymentQuery } = useActiveProjectOverviewReads(host, projectId);
    return <div data-frame={snapshot?.project.id} data-snapshot={snapshotState} data-actual-frame>
      <span>{snapshot?.project.name ?? 'Reading project…'}</span>
      {statusPanel}
      <span data-command={commandQuery.data?.projectId}>{commandQuery.data?.projectId}</span>
      <span data-payment={paymentQuery.data?.paidIncGstCents} />
      <span data-command-fetching={String(commandQuery.isFetching)} data-tab={optimisticTab} />
      <button onClick={() => onTabSelect('estimates')}>Commercial</button>
      <button onClick={() => onTabSelect('activity')}>Overview</button>
      <ProjectMainTabs snapshot={snapshot} projectId={projectId} host={host} optimisticTab={optimisticTab}
        snapshotState={snapshotState} snapshotContentReady={snapshotContentReady} tab={tab} />
    </div>;
  },
}));

type PendingRequest = { path: string; resolve: (response: Response) => void; answered: boolean };
let requests: PendingRequest[];
let client: QueryClient;
let view: ReturnType<typeof renderIntoDocument> | undefined;

function response(kind: string, id = 'proj_1', hasJobPacks = true) {
  const project = { id: id === '00000000-0000-4000-8000-000000000001' ? `proj_${id}` : id, name: `Private ${id}`, stage: 'new', ...(kind === 'summary' ? {} : { hasJobPacks }) };
  if (kind === 'command-centre') return { projectId: id, workModel: 'v2' };
  if (kind === 'invoice-schedule') return { schedule: { paidIncGstCents: 12345 } };
  return { snapshot: { project, workModel: 'v2', pipeline: { stage: 'new' }, activity: [], emails: [], notes: [] }, generatedAt: '2026-10-13T00:00:00Z' };
}
function element(projectId = 'proj_1', tab = 'activity', initialRead?: ProjectWorkInitialRead) {
  return <QueryClientProvider client={client}><ProjectSnapshotPageClient projectId={projectId} tab={tab} estimateId={null} debugExportEnabled={false} initialRead={initialRead} /></QueryClientProvider>;
}
async function settle() {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
}
async function answer(kind: string, status = 200, id = 'proj_1', body = response(kind, id)) {
  const request = requests.find((item) => !item.answered && item.path.includes(`/${id}/`) && item.path.endsWith(`/${kind}`));
  expect(request, `pending ${id}/${kind}`).toBeDefined();
  request!.answered = true;
  await act(async () => {
    request!.resolve(new Response(JSON.stringify(status === 200 ? body : { error: 'Unavailable' }), { status }));
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
  it('streams summary first and keeps failed snapshot incomplete despite successful command and payment, then retries the API', async () => {
    let finishSnapshot!: (value: any) => void;
    const initial: ProjectWorkInitialRead = { id: 'render-a', ownerId: 'staff-a', host: 'host', projectId: 'proj_1', results: {
      summary: Promise.resolve({ ok: true, data: response('summary') as any }),
      snapshot: new Promise((resolve) => { finishSnapshot = resolve; }),
      command: Promise.resolve({ ok: true, data: response('command-centre') as any }),
      payment: Promise.resolve({ ok: true, data: { paidIncGstCents: 12345 } as any }),
    } };
    view = renderIntoDocument(element('proj_1', 'activity', initial));
    await settle(); await settle();
    expect(requests).toHaveLength(0);
    expect(view.container.querySelector('[data-frame]')).not.toBeNull();
    expect(view.container.querySelector('[data-project-snapshot-state="summary"]')).not.toBeNull();
    await act(async () => finishSnapshot({ ok: false, status: 500, message: 'Failed to load project snapshot' }));
    await settle();
    expect(view.container.querySelector('[data-project-snapshot-state="refresh-failed"]')).not.toBeNull();
    expect(view.container.querySelector('[data-command="proj_1"]')).not.toBeNull();
    act(() => [...view!.container.querySelectorAll('button')].find((button) => button.textContent === 'Retry')!.click());
    expect(count('snapshot')).toBe(1);
    await answer('snapshot');
    expect(view.container.querySelector('[data-project-snapshot-state="fresh"]')).not.toBeNull();
  });

  it('adopts all four initial results and refreshes the ordinary command API on a tab return', async () => {
    const initial = { id: 'render-b', ownerId: 'staff-a', host: 'host', projectId: 'proj_1', results: {
      summary: Promise.resolve({ ok: true, data: response('summary') }),
      snapshot: Promise.resolve({ ok: true, data: response('snapshot') }),
      command: Promise.resolve({ ok: true, data: response('command-centre') }),
      payment: Promise.resolve({ ok: true, data: { paidIncGstCents: 12345 } }),
    } } as unknown as ProjectWorkInitialRead;
    view = renderIntoDocument(element('proj_1', 'activity', initial));
    await settle(); await settle();
    expect(requests).toHaveLength(0);
    expect(view.container.querySelector('[data-project-snapshot-state="fresh"]')).not.toBeNull();
    act(() => [...view!.container.querySelectorAll('button')].find((button) => button.textContent === 'Commercial')!.click());
    act(() => [...view!.container.querySelectorAll('button')].find((button) => button.textContent === 'Overview')!.click());
    expect(count('command-centre')).toBe(1);
    await answer('command-centre');
  });
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

  it('keeps a direct Files entry independent of Overview reads through snapshot failure and Retry', async () => {
    state.search = 'tab=files';
    view = renderIntoDocument(element('proj_1', 'files'));
    await answer('summary');
    expect(view.container.querySelector('[data-testid="files-tab"]')).not.toBeNull();
    await answer('snapshot', 500);
    expect(view.container.querySelector('[data-project-active-tab="files"]')).not.toBeNull();
    expect(count('command-centre')).toBe(0);
    expect(count('invoice-schedule')).toBe(0);
    expect(state.preload).not.toHaveBeenCalled();
    act(() => [...view!.container.querySelectorAll('button')].find(button => button.textContent === 'Retry')!.click());
    await answer('snapshot');
    expect(view.container.querySelector('[data-testid="files-tab"]')).not.toBeNull();
    expect(count('command-centre')).toBe(0);
    expect(count('invoice-schedule')).toBe(0);
  });

  it('resolves unknown Job Packs availability without speculative Overview reads', async () => {
    view = renderIntoDocument(element('proj_1', 'job-packs'));
    expect(requests).toHaveLength(2);
    await answer('snapshot');
    expect(requests).toHaveLength(2);
  });

  it.each([true, false])('keeps a failed direct Job Packs entry recoverable until Retry resolves availability=%s', async (hasJobPacks) => {
    state.search = 'tab=job-packs';
    view = renderIntoDocument(element('proj_1', 'job-packs'));
    await answer('summary');
    expect(view.container.querySelector('[data-project-active-tab="job-packs"]')).not.toBeNull();
    expect(view.container.querySelector('[data-testid="job-packs-tab"]')).not.toBeNull();
    expect(view.container.querySelector('[data-testid="overview-tab"]')).toBeNull();
    expect(view.container.querySelector('[data-testid="job-packs-tab"]')).not.toBeNull();
    await answer('snapshot', 500);
    expect(view.container.querySelector('[data-project-snapshot-state="refresh-failed"]')).not.toBeNull();
    expect([...view.container.querySelectorAll('button')].some((button) => button.textContent === 'Retry')).toBe(true);
    expect(count('command-centre')).toBe(0);
    expect(count('invoice-schedule')).toBe(0);
    expect(state.preload).not.toHaveBeenCalled();

    act(() => [...view!.container.querySelectorAll('button')].find((button) => button.textContent === 'Retry')!.click());
    await answer('snapshot', 200, 'proj_1', response('snapshot', 'proj_1', hasJobPacks));
    expect(count('snapshot')).toBe(2);
    expect(view.container.querySelector('[data-project-job-packs-availability]')).toBeNull();
    expect(view.container.querySelector(`[data-project-active-tab="${hasJobPacks ? 'job-packs' : 'activity'}"]`)).not.toBeNull();
    expect(count('command-centre')).toBe(hasJobPacks ? 0 : 1);
    expect(count('invoice-schedule')).toBe(hasJobPacks ? 0 : 1);
    if (hasJobPacks) {
      expect(view.container.querySelector('[data-testid="job-packs-tab"]')).not.toBeNull();
      expect(view.container.querySelector('[data-testid="overview-tab"]')).toBeNull();
    } else {
      await answer('command-centre'); await answer('invoice-schedule');
      expect(view.container.querySelector('[data-testid="overview-tab"]')).not.toBeNull();
      expect(view.container.querySelector('[data-command="proj_1"]')).not.toBeNull();
      expect(view.container.querySelector('[data-payment="12345"]')).not.toBeNull();
    }
  });

  it.each(['Overview', 'Commercial'])('can leave unresolved Job Packs for %s with only the selected owner active', async (target) => {
    state.search = 'tab=job-packs';
    view = renderIntoDocument(element('proj_1', 'job-packs'));
    await answer('summary'); await answer('snapshot', 500);
    act(() => [...view!.container.querySelectorAll('button')].find((button) => button.textContent === target)!.click());
    const overview = target === 'Overview';
    expect(view.container.querySelector(`[data-project-active-tab="${overview ? 'activity' : 'estimates'}"]`)).not.toBeNull();
    expect(count('command-centre')).toBe(overview ? 1 : 0);
    expect(count('invoice-schedule')).toBe(overview ? 1 : 0);
    if (overview) {
      await answer('command-centre'); await answer('invoice-schedule');
      expect(view.container.querySelector('[data-command="proj_1"]')).not.toBeNull();
      expect(view.container.querySelector('[data-payment="12345"]')).not.toBeNull();
    } else {
      expect(view.container.querySelector('[data-testid="commercial-tab"]')).not.toBeNull();
      expect(state.preload).not.toHaveBeenCalled();
    }
    expect(view.container.querySelector('[data-project-snapshot-state="refresh-failed"]')).not.toBeNull();
  });

  it.each([401, 403, 404])('removes the pending Job Packs body when snapshot access ends with %s', async (status) => {
    state.search = 'tab=job-packs';
    view = renderIntoDocument(element('proj_1', 'job-packs'));
    await answer('summary');
    expect(view.container.querySelector('[data-testid="job-packs-tab"]')).not.toBeNull();
    await answer('snapshot', status);
    expect(view.container.querySelector('[data-project-snapshot-state="unavailable"]')).not.toBeNull();
    expect(view.container.querySelector('[data-project-tab-body]')).toBeNull();
    expect(view.container.textContent).not.toContain('Private proj_1');
    expect(view.container.textContent).not.toContain('Retry');
    expect(count('command-centre')).toBe(0);
    expect(count('invoice-schedule')).toBe(0);
    expect(client.getQueryData(qk.projects.summary('host', 'proj_1'))).toBeUndefined();
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
