import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderIntoDocument } from '../../../../test/reactHarness';
import { useProjectCommercialContext } from '@/components/projects/ProjectPage/ProjectCommercialContext';
import type { ProjectCommandCentreResponse } from '@/lib/projects/commandCentre/types';
import StudioCommercialPolicy from './StudioCommercialPolicy';

const mocks = vi.hoisted(() => ({ read: vi.fn(), actor: 'actor', status: 'authenticated', role: 'staff' }));
vi.mock('@/components/auth/PortalAuthProvider', () => ({ usePortalSession: () => ({ status: mocks.status, user: { id: mocks.actor }, role: mocks.role }) }));
vi.mock('@/lib/supabase/browserClient', () => ({ supabaseRuntimeUrl: () => 'http://local', supabaseHostFromUrl: () => 'local' }));
vi.mock('@/lib/queries/projects', () => ({ projectCommandCentreQueryOptions: (host: string, projectId: string, actorId: string) => ({ queryKey: ['projects', host, 'commandCentre', projectId, 'studio-commercial', actorId], queryFn: () => mocks.read(projectId), staleTime: 0, refetchOnMount: 'always' }) }));

function response(state = 'ACTIVE', projectId = 'one', version = 1) {
  return { projectId, workModel: 'v2', projectWork: { projectId, effectiveState: state, stateRowVersion: version } } as ProjectCommandCentreResponse;
}
function deferred() {
  let resolve!: (value: ProjectCommandCentreResponse) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<ProjectCommandCentreResponse>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
function Command() {
  const policy = useProjectCommercialContext();
  return <><a href="/saved-design">Open saved design</a><button disabled={!policy.actionsAvailable}>Create fixture</button></>;
}
const mounted: ReturnType<typeof renderIntoDocument>[] = [];
const clients: QueryClient[] = [];
const flush = async () => { await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)); }); };
const button = (label: string) => [...document.querySelectorAll('button')].find(item => item.textContent === label)!;
const click = async (label: string) => { await act(async () => button(label).click()); await flush(); };
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); clients.push(client);
  const view = (actorId = 'actor', projectId = 'one') => <QueryClientProvider client={client}><StudioCommercialPolicy actorId={actorId} projectId={projectId}><Command /></StudioCommercialPolicy></QueryClientProvider>;
  const result = renderIntoDocument(view()); mounted.push(result);
  return { client, result, view };
}
beforeEach(() => { vi.resetAllMocks(); mocks.actor = 'actor'; mocks.status = 'authenticated'; mocks.role = 'staff'; });
afterEach(() => { mounted.splice(0).forEach(value => value.unmount()); clients.splice(0).forEach(value => value.clear()); });

describe('Studio uses the current Project commercial presentation policy', () => {
  it('never enables a command during loading or a failed read, and explicitly retries', async () => {
    const first = deferred(); mocks.read.mockReturnValueOnce(first.promise).mockResolvedValue(response());
    mount();
    expect(button('Create fixture').disabled).toBe(true);
    expect(document.querySelector('a')?.getAttribute('href')).toBe('/saved-design');
    await act(async () => first.reject(Error('Unavailable'))); await flush();
    expect(button('Create fixture').disabled).toBe(true);
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('Commercial actions are paused');
    await click('Retry project state');
    expect(button('Create fixture').disabled).toBe(false);
  });
  it.each(['CLOSED', 'ARCHIVED', 'WAITING'])('requires the existing acknowledgement for %s and resets on a new state version', async state => {
    mocks.read.mockResolvedValue(response(state)); const { client } = mount(); await flush();
    expect(button('Create fixture').disabled).toBe(true);
    await click('Review commercial actions'); expect(button('Create fixture').disabled).toBe(false);
    mocks.read.mockResolvedValue(response(state, 'one', 2));
    await act(async () => { await client.invalidateQueries(); }); await flush();
    expect(button('Create fixture').disabled).toBe(true);
  });
  it('refuses wrong-project data and has no enabled flash from a previous project or actor', async () => {
    mocks.read.mockResolvedValue(response('CLOSED')); const { result, view } = mount(); await flush();
    await click('Review commercial actions');
    const next = deferred(); mocks.read.mockReturnValue(next.promise);
    result.rerender(view('actor', 'two'));
    expect(button('Create fixture').disabled).toBe(true);
    await act(async () => next.resolve(response('ACTIVE', 'one'))); await flush();
    expect(button('Create fixture').disabled).toBe(true);
    mocks.actor = 'another'; mocks.read.mockResolvedValue(response('CLOSED', 'two'));
    result.rerender(view('another', 'two')); await flush();
    expect(button('Create fixture').disabled).toBe(true);
    await click('Review commercial actions'); expect(button('Create fixture').disabled).toBe(false);
    mocks.role = 'customer'; result.rerender(view('another', 'two'));
    expect(button('Create fixture').disabled).toBe(true);
  });
  it('waits for a fresh read even when an active response is cached for this actor', async () => {
    mocks.read.mockResolvedValue(response()); const { client, result, view } = mount(); await flush();
    const pending = deferred(); mocks.read.mockReturnValue(pending.promise);
    result.rerender(<QueryClientProvider client={client}><div /></QueryClientProvider>);
    result.rerender(view());
    expect(button('Create fixture').disabled).toBe(true);
    await act(async () => pending.resolve(response('WAITING'))); await flush();
    expect(button('Create fixture').disabled).toBe(true);
    await click('Review commercial actions'); expect(button('Create fixture').disabled).toBe(false);
  });
  it('ignores a late response from the previous identity and permits resolved legacy projects', async () => {
    const first = deferred(), second = deferred(); mocks.read.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result, view } = mount(); result.rerender(view('actor', 'two'));
    await act(async () => first.resolve(response())); await flush();
    expect(button('Create fixture').disabled).toBe(true);
    await act(async () => second.resolve({ projectId: 'two', workModel: 'legacy', legacyWork: { status: 'retired' } } as ProjectCommandCentreResponse)); await flush();
    expect(button('Create fixture').disabled).toBe(false);
  });
});
