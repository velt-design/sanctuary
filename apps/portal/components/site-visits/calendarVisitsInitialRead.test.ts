import { beforeEach, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { apiJson, ApiError } from '@/lib/repo/apiClient';
import type { VisitSnapshot } from '@/lib/siteVisits/contract';
import type { CalendarVisitScope, CalendarVisitsInitialRead, SavedVisitsResult } from '@/lib/siteVisits/savedVisitsContract';
import { calendarVisitsQueryKey, calendarVisitsReadFunction } from './calendarVisitsInitialRead';
vi.mock('@/lib/repo/apiClient', async original => ({ ...await original<typeof import('@/lib/repo/apiClient')>(), apiJson: vi.fn() }));
const host = 'portal.example.test', scope: CalendarVisitScope = { project: null, visit: null };
const data = (lastSuccess = 'initial'): VisitSnapshot => ({ enabled: false, events: [], lastSuccess, lastAttempt: null, error: null, rangeStart: null, rangeEnd: null, syncing: false });
function pending() {
  let resolve!: (value: SavedVisitsResult) => void;
  const result = new Promise<SavedVisitsResult>(done => { resolve = done; });
  return { initial: { id: crypto.randomUUID(), ownerId: 'a', host, ...scope, result } satisfies CalendarVisitsInitialRead, resolve };
}
function options(client: QueryClient, initial: CalendarVisitsInitialRead, request = scope, owner = 'a', queryHost = host) {
  return { queryKey: calendarVisitsQueryKey(queryHost, request), staleTime: 0, retry: false,
    queryFn: calendarVisitsReadFunction(client, queryHost, request, owner, initial) };
}
beforeEach(() => { vi.clearAllMocks(); vi.mocked(apiJson).mockResolvedValue(data('API')); });
it('consumes the real Flight thenable once; later refresh/retry use the API', async () => {
  const client = new QueryClient(), { initial } = pending();
  initial.result = { then(done: (value: SavedVisitsResult) => void) { done({ ok: true, data: data() }); } } as unknown as Promise<SavedVisitsResult>;
  expect(await client.fetchQuery(options(client, initial))).toEqual(data());
  expect(apiJson).not.toHaveBeenCalled();
  expect(await client.fetchQuery(options(client, initial))).toEqual(data('API'));
  expect(apiJson).toHaveBeenCalledTimes(1);
});
it('never adopts another user, host or scope and consumes an obsolete handoff before A-to-B-to-A return', async () => {
  for (const change of [{ owner: 'b' }, { host: 'another.test' }, { scope: { project: 'proj_other', visit: null } }, { scope: { project: null, visit: 'exact' } }]) {
    const client = new QueryClient(), { initial, resolve } = pending(); resolve({ ok: true, data: data('private old') });
    expect(await client.fetchQuery(options(client, initial, change.scope ?? scope, change.owner ?? 'a', change.host ?? host))).toEqual(data('API'));
    expect(await client.fetchQuery(options(client, initial))).toEqual(data('API'));
  }
});
it('does not overwrite a populated or invalidated cache', async () => {
  const client = new QueryClient(), { initial, resolve } = pending(), request = options(client, initial);
  client.setQueryData(request.queryKey, data('newer')); await client.invalidateQueries({ queryKey: request.queryKey });
  resolve({ ok: true, data: data('old') });
  expect(await client.fetchQuery(request)).toEqual(data('API'));
});
it('preserves cancellation, then uses the API if the user returns', async () => {
  const client = new QueryClient(), { initial, resolve } = pending(), request = options(client, initial);
  const result = client.fetchQuery(request).catch(error => error);
  await client.cancelQueries({ queryKey: request.queryKey }); resolve({ ok: true, data: data('late') }); await result;
  expect(client.getQueryData(request.queryKey)).toBeUndefined();
  expect(await client.fetchQuery(request)).toEqual(data('API'));
});
it('does not replace an intervening correction or invalidation with late initial data', async () => {
  const client = new QueryClient(), { initial, resolve } = pending(), request = options(client, initial);
  const result = client.fetchQuery(request); client.setQueryData(request.queryKey, data('correction'));
  await client.invalidateQueries({ queryKey: request.queryKey }); resolve({ ok: true, data: data('obsolete') });
  expect(await result).toEqual(data('API'));
});
it('reports failed/malformed/rejected reads safely; explicit Retry never replays the seed', async () => {
  const results = [Promise.resolve({ ok: false, status: 503, message: 'Site visits could not be loaded.' }), Promise.resolve({ ok: true, data: null }), Promise.resolve().then(() => { throw Error('private detail'); })];
  // Attach handlers before advancing to each case so a rejected Flight promise cannot become unhandled.
  results.forEach(result => void result.catch(() => {}));
  for (const result of results) {
    const client = new QueryClient(), { initial } = pending(); initial.result = result as Promise<SavedVisitsResult>;
    await expect(client.fetchQuery(options(client, initial))).rejects.toMatchObject({ status: 503, message: 'Site visits could not be loaded.' });
    expect(await client.fetchQuery(options(client, initial))).toEqual(data('API'));
  }
});
it('isolates concurrent users and preserves access-ending errors on later reads', async () => {
  const a = pending(), b = pending(), ca = new QueryClient(), cb = new QueryClient(); b.initial.ownerId = 'b';
  const reads = [ca.fetchQuery(options(ca, a.initial)), cb.fetchQuery(options(cb, b.initial, scope, 'b'))];
  b.resolve({ ok: true, data: data('b') }); a.resolve({ ok: true, data: data('a') });
  expect((await Promise.all(reads)).map(row => row.lastSuccess)).toEqual(['a', 'b']);
  vi.mocked(apiJson).mockRejectedValue(new ApiError('Denied', { status: 403, body: {} }));
  await expect(ca.fetchQuery(options(ca, a.initial))).rejects.toMatchObject({ status: 403 });
});
