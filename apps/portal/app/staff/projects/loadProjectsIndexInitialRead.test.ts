import { beforeEach, expect, it, vi } from 'vitest';
import { getSupabaseServerAuth } from '@/lib/supabase/serverClient';
import { loadProjectsIndexData, ProjectsIndexSchemaError } from '@/lib/projects/serverProjectsIndex';
import { defaultProjectsIndexParams } from '@/lib/queries/projectsIndex';
import { loadProjectsIndexInitialRead } from './loadProjectsIndexInitialRead';
import type { ProjectsIndexResponse } from '@/lib/projects/projectsIndexContract';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/serverClient', () => ({ getSupabaseServerAuth: vi.fn() }));
vi.mock('@/lib/projects/serverProjectsIndex', () => ({
  loadProjectsIndexData: vi.fn(), ProjectsIndexSchemaError: class extends Error {},
}));
const params = defaultProjectsIndexParams('active');
const result: Pick<ProjectsIndexResponse, 'projects' | 'contacts'> = { projects: { rows: [], totalCount: 0, totalPages: 1, page: 1, pageSize: 50, truncated: false },
  contacts: { rows: [], totalCount: null, truncated: false } };
beforeEach(() => { vi.clearAllMocks(); });

it('returns an in-flight result and uses the request client with the existing bounded reader', async () => {
  const client = { request: 'a' };
  let finish!: (value: typeof result) => void;
  vi.mocked(getSupabaseServerAuth).mockResolvedValue(client as never);
  vi.mocked(loadProjectsIndexData).mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const initial = loadProjectsIndexInitialRead('staff-a', params);
  await Promise.resolve();
  expect(initial.ownerId).toBe('staff-a');
  expect(loadProjectsIndexData).toHaveBeenCalledWith(params, client);
  finish(result);
  expect(await initial.result).toMatchObject({ ok: true, data: { ...result, archive: 'active', query: { search: '', owner: 'all' } } });
});

it('does not share clients, identifiers or results between simultaneous requests', async () => {
  vi.mocked(getSupabaseServerAuth).mockResolvedValueOnce({ request: 'a' } as never).mockResolvedValueOnce({ request: 'b' } as never);
  vi.mocked(loadProjectsIndexData).mockResolvedValue(result);
  const a = loadProjectsIndexInitialRead('staff-a', params), b = loadProjectsIndexInitialRead('staff-b', params);
  await Promise.all([a.result, b.result]);
  expect(a.id).not.toBe(b.id);
  expect(vi.mocked(loadProjectsIndexData).mock.calls.map(call => call[1])).toEqual([{ request: 'a' }, { request: 'b' }]);
});

it('preserves query length validation without starting a database read', async () => {
  const initial = loadProjectsIndexInitialRead('staff-a', { ...params, search: 'x'.repeat(81) });
  expect(await initial.result).toMatchObject({ ok: false, status: 400 });
  expect(getSupabaseServerAuth).not.toHaveBeenCalled();
});

it('serializes schema and ordinary failures as safe retryable results', async () => {
  vi.mocked(getSupabaseServerAuth).mockResolvedValue({ request: 'a' } as never);
  const schemaError = new ProjectsIndexSchemaError(); schemaError.message = 'Schema not ready';
  vi.mocked(loadProjectsIndexData).mockRejectedValueOnce(schemaError);
  expect(await loadProjectsIndexInitialRead('staff-a', params).result).toEqual({ ok: false, status: 503, message: 'Schema not ready' });
  vi.mocked(loadProjectsIndexData).mockRejectedValueOnce(new Error('Private database detail'));
  expect(await loadProjectsIndexInitialRead('staff-a', params).result).toEqual({ ok: false, status: 500, message: 'Failed to load projects' });
});
