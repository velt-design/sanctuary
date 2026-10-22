import { act } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { renderIntoDocument } from '../../../../test/reactHarness';
import { apiJson, ApiError } from '@/lib/repo/apiClient';
import type { CalendarVisitsInitialRead } from '@/lib/siteVisits/savedVisitsContract';
import type { VisitSnapshot } from '@/lib/siteVisits/contract';
import { calendarVisitKey, useCalendarVisits } from './useCalendarVisits';
vi.mock('@/lib/repo/apiClient', async original => ({ ...await original<typeof import('@/lib/repo/apiClient')>(), apiJson: vi.fn() }));
const data: VisitSnapshot = { enabled: false, events: [], lastSuccess: 'initial', lastAttempt: null, error: null, rangeStart: null, rangeEnd: null, syncing: false };
let mounted: ReturnType<typeof renderIntoDocument> | undefined;
let latest: ReturnType<typeof useCalendarVisits>;
const clients: QueryClient[] = [];
beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); focusManager.setFocused(true); vi.mocked(apiJson).mockResolvedValue({ ...data, lastSuccess: 'API' }); });
afterEach(() => { mounted?.unmount(); clients.splice(0).forEach(client => client.clear()); focusManager.setFocused(undefined); vi.useRealTimers(); });
async function mount() {
  const client = new QueryClient(); clients.push(client);
  const initial: CalendarVisitsInitialRead = { id: crypto.randomUUID(), ownerId: 'a', host: window.location.host, project: null, visit: null, result: Promise.resolve({ ok: true, data }) };
  function Probe() { latest = useCalendarVisits(undefined, undefined, undefined, { read: initial, ownerId: 'a' }); return <span>{latest.data?.lastSuccess}</span>; }
  mounted = renderIntoDocument(<QueryClientProvider client={client}><Probe /></QueryClientProvider>);
  await act(async () => { await vi.advanceTimersByTimeAsync(10); });
  return client;
}
it('preserves the saved-data poll after one initial read without calling the provider', async () => {
  await mount(); expect(latest.data).toEqual(data); expect(apiJson).not.toHaveBeenCalled();
  await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
  expect(apiJson).toHaveBeenCalledTimes(1);
  expect(vi.mocked(apiJson).mock.calls[0][0]).toBe('/api/staff/v1/outlook-site-visits?');
  expect(latest.data?.lastSuccess).toBe('API');
});
it('uses the ordinary API on correction invalidation and hides saved rows on denial', async () => {
  const client = await mount();
  await act(async () => { await client.invalidateQueries({ queryKey: calendarVisitKey }); await vi.advanceTimersByTimeAsync(10); });
  expect(apiJson).toHaveBeenCalledTimes(1); expect(latest.data?.lastSuccess).toBe('API');
  vi.mocked(apiJson).mockRejectedValue(new ApiError('Denied', { status: 403, body: {} }));
  await act(async () => { await latest.refetch(); await vi.advanceTimersByTimeAsync(10); });
  expect(latest.denied).toBe(true); expect(latest.data).toBeUndefined();
});
