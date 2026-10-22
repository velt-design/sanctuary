import { beforeEach, expect, it, vi } from 'vitest';
import { getSupabaseServerAuth } from '@/lib/supabase/serverClient';
import { readSavedVisits } from '@/lib/siteVisits/readSavedVisits.server';
import { loadCalendarVisitsInitialRead } from './loadCalendarVisitsInitialRead';
vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/serverClient', () => ({ getSupabaseServerAuth: vi.fn() }));
vi.mock('@/lib/siteVisits/readSavedVisits.server', () => ({ readSavedVisits: vi.fn() }));
beforeEach(() => vi.clearAllMocks());
it('keeps simultaneous request clients, users and result promises separate', async () => {
  vi.mocked(getSupabaseServerAuth).mockResolvedValueOnce({ request: 'a' } as never).mockResolvedValueOnce({ request: 'b' } as never);
  vi.mocked(readSavedVisits).mockResolvedValue({ ok: true, data: { events: [], enabled: false } } as never);
  const a = loadCalendarVisitsInitialRead('a', 'portal.test', { project: 'proj_a', visit: null });
  const b = loadCalendarVisitsInitialRead('b', 'portal.test', { project: null, visit: 'exact' });
  expect(a.id).not.toBe(b.id); expect(a.result).not.toBe(b.result);
  await Promise.all([a.result, b.result]);
  expect(vi.mocked(readSavedVisits).mock.calls.map(([client, query]) => [client, query.toString()])).toEqual([
    [{ request: 'a' }, 'project=proj_a'], [{ request: 'b' }, 'visit=exact'],
  ]);
});
it('serializes safe retryable failures without exposing client exceptions', async () => {
  vi.mocked(getSupabaseServerAuth).mockRejectedValue(new Error('private client detail'));
  const read = loadCalendarVisitsInitialRead('a', 'portal.test', { project: null, visit: null });
  expect(await read.result).toEqual({ ok: false, status: 503, message: 'Site visits could not be loaded.' });
  expect(readSavedVisits).not.toHaveBeenCalled();
});
