import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createConfiguratorPriceStore } from './configuratorPriceStore';
import { CONFIGURATOR_PRICE_LEASE_HEADER, CONFIGURATOR_PRICE_PUBLICATION_HEADER } from './configuratorPriceLease';

const price = (amount = 12345) => ({ status: 'priced', amountIncGst: amount, calculationRef: 'cf1.synthetic', currency: 'NZD', includesGst: true, versionNumber: 1, breakdown: [{ label: 'Pergola', amountIncGst: amount }] });
const reply = (body: unknown, identity = 'a'.repeat(64), leaseMs = 30000) => ({ ok: true, json: async () => body,
  headers: new Headers({ [CONFIGURATOR_PRICE_PUBLICATION_HEADER]: identity, [CONFIGURATOR_PRICE_LEASE_HEADER]: String(leaseMs) }) });
let stops: Array<() => void>;
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(100000); stops = []; });
afterEach(() => { stops.forEach(stop => stop()); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const tick = () => vi.advanceTimersByTimeAsync(0);
it('starts immediately, shares identical requests and reuses exact full designs only within their lease', async () => {
  const fetcher = vi.fn().mockResolvedValue(reply(price())); vi.stubGlobal('fetch', fetcher);
  const store = createConfiguratorPriceStore();
  stops.push(store.subscribe('full-design-with-extras', vi.fn()), store.subscribe('full-design-with-extras', vi.fn()));
  expect(fetcher).toHaveBeenCalledTimes(1); await tick();
  expect(store.getSnapshot('full-design-with-extras')).toEqual(price());
  expect(store.getSnapshot('different-dimensions')).toBeNull();
  stops.pop()!(); stops.pop()!();
  stops.push(store.subscribe('full-design-with-extras', vi.fn()));
  expect(store.getSnapshot('full-design-with-extras')).toEqual(price()); expect(fetcher).toHaveBeenCalledTimes(1);
});
it.each(['disabled', 'unavailable', 'network error'])('a %s reply fences older in-flight success for another design', async status => {
  const pending: Array<{ resolve: (v: unknown) => void; reject: (e: Error) => void }> = [];
  vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve, reject) => pending.push({ resolve, reject }))));
  const store = createConfiguratorPriceStore(); stops.push(store.subscribe('A', vi.fn()), store.subscribe('B', vi.fn()));
  if (status === 'network error') pending[1].reject(new Error('network'));
  else pending[1].resolve(reply({ status }));
  await tick(); pending[0].resolve(reply(price())); await tick();
  expect(store.getSnapshot('A')).toEqual({ status: 'unavailable' });
  expect(store.getSnapshot('B')?.status).toBe(status === 'disabled' ? 'disabled' : 'unavailable');
});
it('expires while renewal hangs and focus invalidates exact cached prices immediately', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(reply(price())).mockImplementation(() => new Promise(() => {})); vi.stubGlobal('fetch', fetcher);
  const store = createConfiguratorPriceStore(); stops.push(store.subscribe('A', vi.fn())); await tick();
  await vi.advanceTimersByTimeAsync(15000); expect(fetcher).toHaveBeenCalledTimes(2); expect(store.getSnapshot('A')).toEqual(price());
  await vi.advanceTimersByTimeAsync(15000); expect(store.getSnapshot('A')).toBeNull();
  window.dispatchEvent(new Event('focus')); expect(store.getSnapshot('A')).toBeNull();
});
it('a changed publication discards old exact results and fences other in-flight designs', async () => {
  const pending: Array<(v: unknown) => void> = [];
  vi.stubGlobal('fetch', vi.fn(() => new Promise(resolve => pending.push(resolve))));
  const store = createConfiguratorPriceStore(); stops.push(store.subscribe('A', vi.fn()));
  pending[0](reply(price())); await tick();
  stops.push(store.subscribe('B', vi.fn()), store.subscribe('C', vi.fn()));
  pending[2](reply(price(16000), 'b'.repeat(64))); await tick();
  expect(store.getSnapshot('A')).toBeNull();
  expect(store.getSnapshot('C')).toEqual(price(16000));
  pending[1](reply(price(12000))); await tick();
  expect(store.getSnapshot('B')).toBeNull();
  expect(pending).toHaveLength(5); // A and B are revalidated under the new publication.
});
it('rejects prices without current lease evidence and deducts request time from remaining authority', async () => {
  const pending: Array<(v: unknown) => void> = [];
  vi.stubGlobal('fetch', vi.fn(() => new Promise(resolve => pending.push(resolve))));
  const store = createConfiguratorPriceStore(); stops.push(store.subscribe('A', vi.fn()));
  await vi.advanceTimersByTimeAsync(1000); pending[0](reply(price(), 'a'.repeat(64), 500)); await tick();
  expect(store.getSnapshot('A')).toEqual({ status: 'unavailable' });
  store.retry(); pending[1](reply(price(), '', 30000)); await tick();
  expect(store.getSnapshot('A')).toEqual({ status: 'unavailable' });
});
