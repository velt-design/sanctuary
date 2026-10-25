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
  let lifecycleAttached = false;
  let authorizationMode: boolean | null = null;
  function detachLifecycle() {
    window.removeEventListener('focus', refresh);
    window.removeEventListener('pageshow', refresh);
    document.removeEventListener('visibilitychange', visibility);
    lifecycleAttached = false;
  }
  const emit = (next: LandingTableState) => { state = next; listeners.forEach(listener => listener()); };
  const clearTimers = () => { clearTimeout(renewal); clearTimeout(expiration); };
  const invalidate = (status: LandingTableState['status'] = 'loading') => {
    clearTimers();
    emit({ status, table: null, expiresAt: 0, epoch: state.epoch + 1 });
    if (!listeners.size) detachLifecycle();
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
        authorizationMode = funnel;
        clearTimers();
        emit({ status: 'ready', table, expiresAt, epoch: state.epoch });
        expiration = setTimeout(() => invalidate('unavailable'), expiresAt - Date.now());
        renewal = setTimeout(() => { if (listeners.size) void load(); }, Math.max(funnel ? 1000 : 0, expiresAt - Date.now() - LANDING_PRICE_LEASE_MS / 2));
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
  function refresh() { reset(); if (listeners.size && document.visibilityState !== 'hidden') void load(); }
  function visibility() { if (document.visibilityState === 'hidden') reset(); else refresh(); }
  return {
    getSnapshot: () => state,
    getServerSnapshot: () => EMPTY_LANDING_TABLE,
    retry: refresh,
    subscribe(listener: () => void) {
      const first = listeners.size === 0;
      listeners.add(listener);
      if (first) {
        if (!lifecycleAttached) {
          window.addEventListener('focus', refresh);
          window.addEventListener('pageshow', refresh);
          document.addEventListener('visibilitychange', visibility);
          lifecycleAttached = true;
        }
        // Route unmounts do not revoke a still-current server lease in a visible document.
        // A hidden tab, focus/pageshow, expiry or different pricing mode still revokes it.
        if (state.status !== 'ready' || state.expiresAt <= Date.now() || document.visibilityState === 'hidden'
          || authorizationMode !== isInlineFunnelPath(window.location.pathname)) refresh();
        else if (state.expiresAt - Date.now() <= LANDING_PRICE_LEASE_MS / 2) void load();
      }
      return () => {
        listeners.delete(listener);
        if (!listeners.size) {
          clearTimeout(renewal);
          generation++; controller?.abort(); pending = null;
          if (state.status !== 'ready' || state.expiresAt <= Date.now()) reset();
        }
      };
    },
  };
}

export const landingPriceTableStore = createLandingPriceTableStore();
