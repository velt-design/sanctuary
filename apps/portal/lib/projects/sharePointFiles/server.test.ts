import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ config: vi.fn(), graph: vi.fn() }));
vi.mock('./config', async () => ({ ...await vi.importActual('./config'), sharePointConfig: mocks.config }));
vi.mock('./graph', () => ({ createGraph: mocks.graph }));
import { listProjectFiles, projectGraph } from './server';
import type { SupabaseClient } from '@supabase/supabase-js';
const project = 'proj_11111111-1111-4111-8111-111111111111';
const root = { id: '22222222-2222-4222-8222-222222222222', label: 'Explicit project folder', itemId: 'root' };
function db(data: unknown, error: unknown = null) { return { rpc: vi.fn(async () => ({ data, error })) } as unknown as SupabaseClient; }
beforeEach(() => { vi.resetAllMocks(); mocks.config.mockReturnValue({ binding: 'binding' }); });
it('does not call the provider for unlinked or pending projects', async () => {
  expect((await listProjectFiles(db({ state: 'pending', roots: [], binding: 'binding' }), project, {}, '')).state).toBe('pending');
  expect(mocks.graph).not.toHaveBeenCalled();
});
it('denies stale source binding and roots belonging to another project', async () => {
  await expect(projectGraph(db({ state: 'ready', roots: [root], binding: 'old' }), project, root.id, '', AbortSignal.timeout(1000))).rejects.toMatchObject({ code: 'not_configured' });
  await expect(projectGraph(db({ state: 'ready', roots: [root], binding: 'binding' }), project, '33333333-3333-4333-8333-333333333333', '', AbortSignal.timeout(1000))).rejects.toMatchObject({ code: 'not_found' });
  expect(mocks.graph).not.toHaveBeenCalled();
});
it('honours database staff denial before configuration or provider access', async () => {
  await expect(listProjectFiles(db(null, { code: '42501' }), project, {}, '')).rejects.toMatchObject({ code: 'access_required', status: 403 });
  expect(mocks.config).not.toHaveBeenCalled(); expect(mocks.graph).not.toHaveBeenCalled();
});
it('observes the binding read without changing provider order, arguments or metadata', async () => {
  const events: string[] = [], database = db({ state: 'ready', roots: [root], binding: 'binding' });
  const observer = vi.fn((phase: string) => { events.push(phase); throw new Error('observer failure'); });
  mocks.config.mockImplementation(() => { events.push('config'); return { binding: 'binding' }; });
  const children = vi.fn(async () => ({ items: [], cursor: null }));
  mocks.graph.mockImplementation(async (_cfg, assertion, signal, fetcher, receivedObserver) => {
    events.push('graph'); expect(assertion).toBe('synthetic-assertion'); expect(signal).toBeInstanceOf(AbortSignal);
    expect(fetcher).toBeUndefined(); expect(receivedObserver).toBe(observer); return { children };
  });
  expect(await listProjectFiles(database, project, {}, 'synthetic-assertion', observer)).toEqual({ state: 'ready', roots: [root], rootId: root.id, folderId: 'root', items: [], cursor: null });
  expect(events).toEqual(['bindings_rpc', 'config', 'graph']);
  expect(database.rpc).toHaveBeenCalledWith('project_files_read', { p_project_id: '11111111-1111-4111-8111-111111111111' });
  expect(children).toHaveBeenCalledWith('root', 'root', undefined);
});
