import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { projectWorkReadFunction } from './projectWorkInitialRead';
import type { ProjectWorkInitialRead } from '@/lib/projects/projectWorkInitialRead';

const key = ['projects', 'host', 'commandCentre', 'proj_1'];
const data = { projectId: 'proj_1', workModel: 'v2' } as any;
function setup(result: any = Promise.resolve({ ok: true, data })) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const fallback = vi.fn().mockResolvedValue({ ...data, ordinary: true });
  const initial = { id: 'render-1', host: 'host', projectId: 'proj_1', ownerId: 'staff-a', results: { command: result } } as ProjectWorkInitialRead;
  const read = (owner = 'staff-a', host = 'host', project = 'proj_1') => projectWorkReadFunction(client, key, 'command', host, project, owner, fallback, initial);
  const context = { signal: new AbortController().signal, queryKey: key, client, meta: undefined };
  return { client, fallback, initial, read, context };
}
describe('Work one-use query handoff', () => {
  it.each(['absent', 'owner mismatch', 'host mismatch', 'project mismatch', 'consumed', 'cached', 'invalidated'])(
    'keeps one pending ordinary request across observer remount when the handoff is %s', async (reason) => {
      const test = setup();
      let finish!: (value: typeof data) => void;
      test.fallback.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
      if (reason === 'consumed') await test.read()(test.context);
      if (reason === 'cached') test.client.setQueryData(key, data);
      if (reason === 'invalidated') {
        test.client.getQueryCache().build(test.client, { queryKey: key });
        await test.client.invalidateQueries({ queryKey: key });
      }
      const queryFn = projectWorkReadFunction(test.client, key, 'command',
        reason === 'host mismatch' ? 'other' : 'host',
        reason === 'project mismatch' ? 'proj_2' : 'proj_1',
        reason === 'owner mismatch' ? 'staff-b' : 'staff-a', test.fallback,
        reason === 'absent' ? undefined : test.initial);
      const observer = new QueryObserver(test.client, { queryKey: key, queryFn });
      const unsubscribe = observer.subscribe(() => {});
      unsubscribe();
      const returned = observer.subscribe(() => {});
      try {
        expect(test.fallback).toHaveBeenCalledTimes(1);
        finish(data);
        await vi.waitFor(() => expect(observer.getCurrentResult().fetchStatus).toBe('idle'));
        expect(observer.getCurrentResult().data).toBe(data);
      } finally {
        returned();
        test.client.clear();
      }
    },
  );
  it('adopts a Flight thenable once per query client and then uses the ordinary API', async () => {
    const test = setup({ then: (resolve: (value: unknown) => void) => { resolve({ ok: true, data }); } });
    expect(await test.read()(test.context)).toBe(data);
    expect(test.fallback).not.toHaveBeenCalled();
    expect(await test.read()(test.context)).toMatchObject({ ordinary: true });
  });
  it.each([['staff-b', 'host', 'proj_1'], ['staff-a', 'other', 'proj_1'], ['staff-a', 'host', 'proj_2']])('rejects mismatched owner/host/project %s %s %s', async (owner, host, project) => {
    const test = setup(new Promise(() => {}));
    expect(await test.read(owner, host, project)(test.context)).toMatchObject({ ordinary: true });
  });
  it('keeps existing cache and invalidation authoritative over a late result', async () => {
    let finish!: (value: any) => void;
    const test = setup(new Promise((resolve) => { finish = resolve; }));
    test.client.getQueryCache().build(test.client, { queryKey: key });
    const read = test.read()(test.context);
    test.client.setQueryData(key, { optimistic: true });
    finish({ ok: true, data });
    expect(await read).toMatchObject({ ordinary: true });
    expect(test.client.getQueryData(key)).toEqual({ optimistic: true });
  });
  it('aborts a superseded scope without accepting its later private result', async () => {
    const test = setup(new Promise(() => {}));
    const abort = new AbortController();
    const read = test.read()({ ...test.context, signal: abort.signal });
    abort.abort();
    await expect(read).rejects.toMatchObject({ name: 'AbortError' });
    expect(test.fallback).not.toHaveBeenCalled();
  });
  it.each([undefined, { ok: false, status: 403, message: 'Access ended' }])('keeps malformed and denial results truthful and leaves Retry on the API', async (result) => {
    const test = setup(Promise.resolve(result));
    await expect(test.read()(test.context)).rejects.toMatchObject({ status: result ? 403 : 503 });
    expect(await test.read()(test.context)).toMatchObject({ ordinary: true });
  });
});
