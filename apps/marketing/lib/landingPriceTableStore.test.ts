import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LANDING_PRICE_CELLS, type LandingPriceTable } from './landingPriceTable';
import { createLandingPriceTableStore } from './landingPriceTableStore';

const table: LandingPriceTable = { schema: 'landing-price-table.v1', id: 'a'.repeat(64), publicationKey: 'b'.repeat(64), versionId: '11111111-1111-4111-8111-111111111111',
  versionNumber: 1, currency: 'NZD', includesGst: true, amounts: Array(LANDING_PRICE_CELLS).fill(12345) as number[] };
const ready = { status: 'ready', table, leaseMs: 30000 };
const reply = (body: unknown, ok = true) => ({ ok, json: async () => body });
let stops: Array<() => void>;
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(100000); stops = []; });
afterEach(() => { stops.forEach(stop => stop()); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
async function tick(ms = 0) { await vi.advanceTimersByTimeAsync(ms); }
function mount() { const store = createLandingPriceTableStore(); stops.push(store.subscribe(vi.fn())); return store; }

it('loads on subscription, deduplicates consumers, conditionally renews without blanking, and bounds memory to one table', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(reply(ready)).mockResolvedValue(reply({ status: 'current', id: table.id, leaseMs: 30000 }));
  vi.stubGlobal('fetch', fetcher);
  const store = mount(); stops.push(store.subscribe(vi.fn())); await tick();
  expect(fetcher).toHaveBeenCalledTimes(1); expect(store.getSnapshot().table).toBeTruthy();
  const initial = store.getSnapshot();
  await tick(15000);
  expect(store.getSnapshot().status).toBe('ready'); expect(store.getSnapshot().epoch).toBe(initial.epoch);
  expect(store.getSnapshot().expiresAt).toBe(145000);
  expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ knownId: table.id });
  expect(store.getSnapshot().table).toBe(initial.table);
});

it('expires while a renewal hangs, so suspended or offline work cannot keep an old price', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(reply(ready)).mockImplementation(() => new Promise(() => {})));
  const store = mount(); await tick(); const epoch = store.getSnapshot().epoch;
  await tick(29999); expect(store.getSnapshot().status).toBe('ready');
  await tick(1); expect(store.getSnapshot()).toMatchObject({ status: 'unavailable', table: null });
  expect(store.getSnapshot().epoch).toBeGreaterThan(epoch);
});

it.each([{ status: 'disabled' }, { status: 'unavailable' }, { status: 'current', id: 'wrong', leaseMs: 30000 }, { ...ready, leaseMs: 0 }])('clears immediately on a failed or invalid renewal: %o', async body => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(reply(ready)).mockResolvedValue(reply(body)));
  const store = mount(); await tick(); const epoch = store.getSnapshot().epoch;
  await tick(15000); expect(store.getSnapshot().table).toBeNull(); expect(store.getSnapshot().epoch).toBeGreaterThan(epoch);
});

it('deducts transfer time from the lease and rejects an already expired response', async () => {
  let resolve!: (value: unknown) => void;
  vi.stubGlobal('fetch', vi.fn(() => new Promise(done => { resolve = done; })));
  const store = mount(); await tick(30001); resolve(reply(ready)); await tick();
  expect(store.getSnapshot()).toMatchObject({ status: 'unavailable', table: null });
});

it('focus invalidates authorization immediately and late responses cannot replace a fresh version', async () => {
  const pending: Array<(value: unknown) => void> = [];
  vi.stubGlobal('fetch', vi.fn(() => new Promise(done => pending.push(done))));
  const store = mount(); pending[0](reply(ready)); await tick();
  window.dispatchEvent(new Event('focus')); expect(store.getSnapshot().table).toBeNull();
  window.dispatchEvent(new Event('pageshow'));
  const replacement = { ...table, id: 'c'.repeat(64), versionNumber: 2 };
  pending[2](reply({ ...ready, table: replacement })); await tick();
  pending[1](reply(ready)); await tick();
  expect(store.getSnapshot().table?.id).toBe(replacement.id);
});

it('hidden tabs clear authorization and revalidate cached content on return or remount', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(reply(ready)).mockResolvedValue(reply({ status: 'current', id: table.id, leaseMs: 30000 }));
  vi.stubGlobal('fetch', fetcher); const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  const store = mount(); await tick();
  visibility.mockReturnValue('hidden'); document.dispatchEvent(new Event('visibilitychange')); expect(store.getSnapshot().table).toBeNull();
  await tick(60000); expect(fetcher).toHaveBeenCalledTimes(1);
  visibility.mockReturnValue('visible'); document.dispatchEvent(new Event('visibilitychange')); await tick();
  expect(store.getSnapshot().status).toBe('ready');
  stops.pop()!(); expect(store.getSnapshot().status).toBe('ready');
  stops.push(store.subscribe(vi.fn())); await tick(); expect(fetcher).toHaveBeenCalledTimes(2);
});

it('retry recovers a failed initial request without retaining a prior lease', async () => {
  const fetcher = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(reply(ready));
  vi.stubGlobal('fetch', fetcher); const store = mount(); await tick();
  expect(store.getSnapshot().status).toBe('unavailable'); store.retry(); await tick();
  expect(store.getSnapshot().status).toBe('ready');
});

it('reuses only an unexpired same-mode visible-document lease on route return', async () => {
  const fetcher = vi.fn().mockResolvedValue(reply(ready)); vi.stubGlobal('fetch', fetcher);
  const store = mount(); await tick(); const initial = store.getSnapshot(); stops.pop()!();
  await tick(1000); stops.push(store.subscribe(vi.fn()));
  expect(store.getSnapshot()).toBe(initial); expect(fetcher).toHaveBeenCalledTimes(1);
  stops.pop()!(); await tick(30000); expect(store.getSnapshot().status).toBe('unavailable');
  stops.push(store.subscribe(vi.fn())); await tick(); expect(fetcher).toHaveBeenCalledTimes(2);
});

it('revokes an unmounted lease on tab hiding and never makes background price requests', async () => {
  const fetcher = vi.fn().mockResolvedValue(reply(ready)); vi.stubGlobal('fetch', fetcher);
  const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  const store = mount(); await tick(); stops.pop()!();
  visibility.mockReturnValue('hidden'); document.dispatchEvent(new Event('visibilitychange'));
  expect(store.getSnapshot().status).toBe('loading'); await tick(1000); expect(fetcher).toHaveBeenCalledTimes(1);
  visibility.mockReturnValue('visible'); stops.push(store.subscribe(vi.fn())); await tick(); expect(fetcher).toHaveBeenCalledTimes(2);
});
