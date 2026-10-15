import { LANDING_PRICE_LEASE_MS, parseLandingPriceTable, type LandingPriceTable } from './landingPriceTable';
import { isInlineFunnelPath } from './googleFunnel';
import { CONFIGURATOR_PRICE_MODE_HEADER } from './configuratorPriceLease';

export type LandingTableState = {
  status: 'loading' | 'ready' | 'disabled' | 'unavailable'; table: LandingPriceTable | null; expiresAt: number; epoch: number;
};
export const EMPTY_LANDING_TABLE: LandingTableState = { status: 'loading', table: null, expiresAt: 0, epoch: 0 };

/** One bounded, memory-only table per document; no localStorage or stale-while-revalidate authorization. */
export function createLandingPriceTableStore() {
  let state = EMPTY_LANDING_TABLE;
  let cached: LandingPriceTable | null = null;
  const listeners = new Set<() => void>();
  let pending: Promise<void> | null = null;
  let controller: AbortController | null = null;
  let generation = 0;
  let renewal: ReturnType<typeof setTimeout> | undefined;
  let expiration: ReturnType<typeof setTimeout> | undefined;
  const emit = (next: LandingTableState) => { state = next; listeners.forEach(listener => listener()); };
  const clearTimers = () => { clearTimeout(renewal); clearTimeout(expiration); };
  const invalidate = (status: LandingTableState['status'] = 'loading') => {
    clearTimers();
    emit({ status, table: null, expiresAt: 0, epoch: state.epoch + 1 });
  };

  function load(): Promise<void> {
    if (pending) return pending;
    const requestGeneration = generation, started = Date.now();
    const funnel = isInlineFunnelPath(window.location.pathname);
    controller = new AbortController();
    const signal = controller.signal;
    pending = (async () => {
      try {
        const response = await fetch('/api/landing-price-table', { method: 'POST', cache: 'no-store',
          headers: { 'Content-Type': 'application/json', ...(funnel ? { [CONFIGURATOR_PRICE_MODE_HEADER]: 'funnel' } : {}) }, body: JSON.stringify(cached ? { knownId: cached.id } : {}), signal });
        const body = await response.json();
        if (requestGeneration !== generation || signal.aborted) return;
        if (body?.status === 'disabled') { invalidate('disabled'); return; }
        if (!response.ok) throw new Error('Table unavailable');
        const table = body?.status === 'ready' ? parseLandingPriceTable(body.table)
          : body?.status === 'current' && cached?.id === body.id ? cached : null;
        const lease = body?.leaseMs;
        // Count request time against the lease; slow requests cannot extend authorization.
        const expiresAt = started + Math.min(lease, LANDING_PRICE_LEASE_MS);
        if (!table || !Number.isFinite(lease) || lease <= 0 || expiresAt <= Date.now()) throw new Error('Invalid table lease');
        cached = table;
        clearTimers();
        emit({ status: 'ready', table, expiresAt, epoch: state.epoch });
        expiration = setTimeout(() => invalidate('unavailable'), expiresAt - Date.now());
        renewal = setTimeout(() => { void load(); }, Math.max(funnel ? 1000 : 0, expiresAt - Date.now() - LANDING_PRICE_LEASE_MS / 2));
      } catch {
        if (requestGeneration === generation && !signal.aborted) invalidate('unavailable');
      } finally {
        if (requestGeneration === generation) pending = null;
      }
    })();
    return pending;
  }

  function reset() {
    generation++; controller?.abort(); pending = null;
    invalidate();
  }
  function refresh() { reset(); if (document.visibilityState !== 'hidden') void load(); }
  function visibility() { if (document.visibilityState === 'hidden') reset(); else refresh(); }
  return {
    getSnapshot: () => state,
    getServerSnapshot: () => EMPTY_LANDING_TABLE,
    retry: refresh,
    subscribe(listener: () => void) {
      const first = listeners.size === 0;
      listeners.add(listener);
      if (first) {
        window.addEventListener('focus', refresh);
        window.addEventListener('pageshow', refresh);
        document.addEventListener('visibilitychange', visibility);
        refresh();
      }
      return () => {
        listeners.delete(listener);
        if (!listeners.size) {
          window.removeEventListener('focus', refresh);
          window.removeEventListener('pageshow', refresh);
          document.removeEventListener('visibilitychange', visibility);
          reset();
        }
      };
    },
  };
}

export const landingPriceTableStore = createLandingPriceTableStore();
