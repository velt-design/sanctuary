import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { apiJson, ApiError } from '@/lib/repo/apiClient';
import { defaultProjectsIndexParams, projectsIndexQueryOptions } from '@/lib/queries/projectsIndex';
import { projectsIndexReadFunction, type ProjectsIndexInitialRead, type ProjectsIndexInitialResult } from './projectsIndexInitialRead';
import type { ProjectsIndexResponse } from '@/lib/projects/projectsIndexContract';

vi.mock('@/lib/repo/apiClient', async original => ({
  ...await original<typeof import('@/lib/repo/apiClient')>(), apiJson: vi.fn(),
}));
const params = defaultProjectsIndexParams('active');
function data(search = '', name = 'Current'): ProjectsIndexResponse {
  return { archive: 'active', query: { search, status: 'all', journey: 'all', state: 'all', owner: 'all', sort: 'newest' },
    projects: { rows: [{ id: 'proj_1', projectName: name } as never], page: 1, pageSize: 50, totalCount: 1, totalPages: 1, truncated: false },
    contacts: { rows: [], totalCount: null, truncated: false }, generatedAt: '2026-10-21T00:00:00Z' };
}
function deferred() {
  let resolve!: (value: ProjectsIndexInitialResult) => void;
  const result = new Promise<ProjectsIndexInitialResult>(done => { resolve = done; });
  return { initial: { id: crypto.randomUUID(), ownerId: 'staff-a', params, result } satisfies ProjectsIndexInitialRead, resolve };
}
function query(client: QueryClient, initial: ProjectsIndexInitialRead, search = '', owner = 'staff-a') {
  const request = { ...params, search };
  return { queryKey: projectsIndexQueryOptions('active', request).queryKey, staleTime: 0, retry: false,
    queryFn: projectsIndexReadFunction(client, request, owner, initial) };
}
beforeEach(() => { vi.clearAllMocks(); vi.mocked(apiJson).mockResolvedValue(data('', 'API current')); });

describe('Projects first read handoff', () => {
  it.each(['absent', 'consumed', 'owner mismatch', 'filter mismatch', 'cached', 'invalidated'])(
    'keeps one pending API request across observer remount when the handoff is %s', async (reason) => {
      const client = new QueryClient(), { initial, resolve } = deferred();
      if (reason === 'consumed') {
        resolve({ ok: true, data: data() });
        await client.fetchQuery(query(client, initial));
      }
      const request = { ...params, search: reason === 'filter mismatch' ? 'changed' : '' };
      const options = { ...projectsIndexQueryOptions('active', request), refetchOnMount: 'always' as const, retry: false,
        queryFn: projectsIndexReadFunction(client, request, reason === 'owner mismatch' ? 'staff-b' : 'staff-a', reason === 'absent' ? undefined : initial) };
      if (reason === 'cached') client.setQueryData(options.queryKey, data());
      if (reason === 'invalidated') {
        client.getQueryCache().build(client, { queryKey: options.queryKey });
        await client.invalidateQueries({ queryKey: options.queryKey });
      }
      let finish!: (value: ProjectsIndexResponse) => void;
      vi.mocked(apiJson).mockImplementation(() => new Promise(done => { finish = done; }));
      const observer = new QueryObserver(client, options);
      const unsubscribe = observer.subscribe(() => {});
      unsubscribe();
      const returned = observer.subscribe(() => {});
      try {
        expect(apiJson).toHaveBeenCalledTimes(1);
        finish(data(request.search));
        await vi.waitFor(() => expect(observer.getCurrentResult().fetchStatus).toBe('idle'));
        expect(observer.getCurrentResult().data).toEqual(data(request.search));
      } finally {
        returned();
        client.clear();
      }
    },
  );
  it('consumes one matching streamed read without a browser duplicate; refresh uses the API', async () => {
    const client = new QueryClient(), { initial, resolve } = deferred();
    const pending = client.fetchQuery(query(client, initial));
    expect(apiJson).not.toHaveBeenCalled();
    resolve({ ok: true, data: data() });
    expect(await pending).toEqual(data());
    expect(await client.fetchQuery(query(client, initial))).toEqual(data('', 'API current'));
    expect(apiJson).toHaveBeenCalledTimes(1);
  });

  it('adopts a Flight thenable whose then method returns void', async () => {
    const client = new QueryClient(), { initial } = deferred();
    initial.result = { then(resolve: (result: ProjectsIndexInitialResult) => void) {
      resolve({ ok: true, data: data('', 'Flight') });
    } } as unknown as Promise<ProjectsIndexInitialResult>;
    expect(await client.fetchQuery(query(client, initial))).toEqual(data('', 'Flight'));
    expect(apiJson).not.toHaveBeenCalled();
  });

  it('a changed filter consumes the old handoff, including a later return to its original key', async () => {
    const client = new QueryClient(), { initial, resolve } = deferred();
    vi.mocked(apiJson).mockResolvedValueOnce(data('new filter'));
    await client.fetchQuery(query(client, initial, 'new filter'));
    resolve({ ok: true, data: data('', 'Obsolete seed') });
    expect(await client.fetchQuery(query(client, initial))).toEqual(data('', 'API current'));
    expect(apiJson).toHaveBeenCalledTimes(2);
  });

  it('never adopts another user result or replaces existing current-user cached data', async () => {
    const { initial, resolve } = deferred();
    resolve({ ok: true, data: data('', 'Private staff A') });
    const other = new QueryClient();
    expect(await other.fetchQuery(query(other, initial, '', 'staff-b'))).toEqual(data('', 'API current'));
    const cached = new QueryClient();
    cached.setQueryData(query(cached, initial).queryKey, data('', 'Cached'));
    expect(await cached.fetchQuery(query(cached, initial))).toEqual(data('', 'API current'));
    expect(apiJson).toHaveBeenCalledTimes(2);
  });

  it('uses independent first reads for concurrent authenticated clients', async () => {
    const first = deferred(), second = deferred();
    second.initial.ownerId = 'staff-b';
    const a = new QueryClient(), b = new QueryClient();
    const reads = [a.fetchQuery(query(a, first.initial)), b.fetchQuery(query(b, second.initial, '', 'staff-b'))];
    second.resolve({ ok: true, data: data('', 'B') }); first.resolve({ ok: true, data: data('', 'A') });
    expect((await Promise.all(reads)).map(row => row.projects.rows[0].projectName)).toEqual(['A', 'B']);
    expect(apiJson).not.toHaveBeenCalled();
  });

  it('preserves cancellation when navigation abandons a still-streaming read', async () => {
    const client = new QueryClient(), { initial, resolve } = deferred();
    const options = query(client, initial);
    const pending = client.fetchQuery(options).catch(error => error);
    await client.cancelQueries({ queryKey: options.queryKey });
    resolve({ ok: true, data: data('', 'Late') }); await pending;
    expect(client.getQueryData(options.queryKey)).toBeUndefined();
    expect(await client.fetchQuery(query(client, initial))).toEqual(data('', 'API current'));
  });

  it('does not overwrite an intervening optimistic cache update with the initial read', async () => {
    const client = new QueryClient(), { initial, resolve } = deferred();
    const options = query(client, initial);
    const pending = client.fetchQuery(options);
    client.setQueryData(options.queryKey, data('', 'Optimistic'));
    resolve({ ok: true, data: data('', 'Old seed') });
    expect(await pending).toEqual(data('', 'API current'));
    expect(apiJson).toHaveBeenCalledTimes(1);
  });

  it('retains a truthful failure, then Retry uses the API instead of replaying the failed seed', async () => {
    const client = new QueryClient(), { initial, resolve } = deferred();
    resolve({ ok: false, status: 503, message: 'Schema unavailable' });
    await expect(client.fetchQuery(query(client, initial))).rejects.toMatchObject({ status: 503, message: 'Schema unavailable' });
    expect(apiJson).not.toHaveBeenCalled();
    expect(await client.fetchQuery(query(client, initial))).toEqual(data('', 'API current'));
  });

  it('preserves access-ending API failure on return instead of replaying private seed rows', async () => {
    const client = new QueryClient(), { initial, resolve } = deferred();
    resolve({ ok: true, data: data() }); await client.fetchQuery(query(client, initial));
    vi.mocked(apiJson).mockRejectedValue(new ApiError('Denied', { status: 403, body: {} }));
    await expect(client.fetchQuery(query(client, initial))).rejects.toMatchObject({ status: 403 });
  });
});
