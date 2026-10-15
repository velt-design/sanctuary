import type { ConfiguratorPublicPrice } from './configuratorPublicPrice';
import { CONFIGURATOR_PRICE_LEASE_HEADER, CONFIGURATOR_PRICE_LEASE_MS, CONFIGURATOR_PRICE_MODE_HEADER, CONFIGURATOR_PRICE_PUBLICATION_HEADER } from './configuratorPriceLease';

type Entry = { value: ConfiguratorPublicPrice | null; expiresAt: number; renewAt: number };
/** Exact full-draft results only, shared by the funnel and its optional designer.
 * No persistence, approximation, private pricing inputs or stale-while-revalidate.
 */
export function createConfiguratorPriceStore() {
  const entries = new Map<string, Entry>();
  const listeners = new Map<string, Set<() => void>>();
  const pending = new Map<string, AbortController>();
  let publication: string | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let generation = 0;
  const emit = () => listeners.forEach(group => group.forEach(listener => listener()));
  function invalidateOtherRequests(key: string, unavailable: boolean) {
    generation++;
    pending.forEach((request, candidate) => { if (candidate !== key) { request.abort(); pending.delete(candidate); } });
    entries.clear(); publication = null;
    if (unavailable) listeners.forEach((_, candidate) => entries.set(candidate, { value: { status: 'unavailable' }, expiresAt: 0, renewAt: 0 }));
  }
  function schedule() {
    clearTimeout(timer);
    const deadlines = [...listeners.keys()].flatMap(key => {
      const entry = entries.get(key);
      return entry?.expiresAt ? [entry.expiresAt, ...(pending.has(key) ? [] : [entry.renewAt])] : [];
    });
    if (!deadlines.length) return;
    timer = setTimeout(() => {
      for (const key of listeners.keys()) {
        const entry = entries.get(key);
        if (entry?.expiresAt && entry.expiresAt <= Date.now()) {
          entries.set(key, { value: null, expiresAt: 0, renewAt: 0 }); emit();
          void load(key);
        } else if (entry?.renewAt && entry.renewAt <= Date.now()) void load(key);
      }
      schedule();
    }, Math.max(0, Math.min(...deadlines) - Date.now()));
  }
  function trim() {
    for (const key of entries.keys()) {
      if (entries.size <= 64) break;
      if (!listeners.has(key)) entries.delete(key);
    }
  }
  async function load(key: string) {
    if (pending.has(key) || document.visibilityState === 'hidden') return;
    const controller = new AbortController(), started = Date.now(), requestGeneration = generation;
    pending.set(key, controller);
    try {
      const response = await fetch('/api/configurator-price', { method: 'POST', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', [CONFIGURATOR_PRICE_MODE_HEADER]: 'funnel' }, body: key, signal: controller.signal });
      const value = await response.json() as ConfiguratorPublicPrice;
      if (controller.signal.aborted || requestGeneration !== generation) return;
      if (!response.ok || !['priced', 'custom', 'disabled', 'unavailable'].includes(value?.status)) throw new Error('Price unavailable');
      let expiresAt = 0;
      if (value.status === 'priced') {
        const identity = response.headers.get(CONFIGURATOR_PRICE_PUBLICATION_HEADER);
        const leaseMs = Number(response.headers.get(CONFIGURATOR_PRICE_LEASE_HEADER));
        expiresAt = started + Math.min(leaseMs, CONFIGURATOR_PRICE_LEASE_MS);
        if (!identity || !/^[a-f0-9]{64}$/.test(identity) || !Number.isFinite(leaseMs) || expiresAt <= Date.now()
          || !Number.isSafeInteger(value.amountIncGst) || value.amountIncGst <= 0 || !value.calculationRef) throw new Error('Invalid price lease');
        if (publication && publication !== identity) {
          invalidateOtherRequests(key, false);
          queueMicrotask(() => listeners.forEach((_, candidate) => { if (candidate !== key) void load(candidate); }));
        }
        publication = identity;
      } else if (value.status === 'disabled' || value.status === 'unavailable') {
        invalidateOtherRequests(key, true);
      }
      entries.set(key, { value, expiresAt, renewAt: expiresAt ? Math.max(Date.now() + 1000, expiresAt - CONFIGURATOR_PRICE_LEASE_MS / 2) : 0 });
      trim(); emit();
    } catch {
      if (!controller.signal.aborted && requestGeneration === generation) {
        invalidateOtherRequests(key, true);
        entries.set(key, { value: { status: 'unavailable' }, expiresAt: 0, renewAt: 0 }); emit();
      }
    } finally {
      if (pending.get(key) === controller) pending.delete(key);
      schedule();
    }
  }
  function reset() {
    generation++; pending.forEach(request => request.abort()); pending.clear();
    entries.clear(); publication = null; clearTimeout(timer); emit();
  }
  function refresh() {
    reset();
    if (document.visibilityState !== 'hidden') listeners.forEach((_, key) => { void load(key); });
  }
  return {
    getSnapshot(key: string | null): ConfiguratorPublicPrice | null {
      const entry = key ? entries.get(key) : null;
      return entry && (!entry.expiresAt || entry.expiresAt > Date.now()) ? entry.value : null;
    },
    retry: refresh,
    subscribe(key: string | null, listener: () => void) {
      if (!key) return () => {};
      if (!listeners.size) {
        window.addEventListener('focus', refresh); window.addEventListener('pageshow', refresh);
        document.addEventListener('visibilitychange', refresh);
      }
      const subscribed = listeners.has(key);
      const group = listeners.get(key) ?? new Set(); group.add(listener); listeners.set(key, group);
      const entry = entries.get(key);
      if ((!entry?.expiresAt && !subscribed) || (entry?.expiresAt && entry.expiresAt <= Date.now())) { entries.delete(key); void load(key); }
      schedule();
      return () => {
        group.delete(listener);
        if (!group.size) { listeners.delete(key); pending.get(key)?.abort(); pending.delete(key); }
        if (!listeners.size) {
          window.removeEventListener('focus', refresh); window.removeEventListener('pageshow', refresh);
          document.removeEventListener('visibilitychange', refresh); clearTimeout(timer);
        } else schedule();
      };
    },
  };
}
export const configuratorPriceStore = createConfiguratorPriceStore();
