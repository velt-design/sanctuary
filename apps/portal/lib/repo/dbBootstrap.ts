import type { Estimate } from '@/lib/types/estimate';
import type { Quote } from '@/lib/types/quote';
import type { Installer, ScheduleItem } from '@/lib/types/scheduling';
import { apiJson } from '@/lib/repo/apiClient';
import { readJson, writeJson } from '@/lib/repo/storage';

const BOOTSTRAP_KEY = 'sp_db_bootstrap_done_v1';

const ESTIMATES_KEY = 'sp_estimates_v1';
const QUOTES_KEY = 'sp_quotes_v1';
const INSTALLERS_KEY = 'sp_installers_v1';
const SCHEDULE_ITEMS_KEY = 'sp_schedule_items_v1';

type SyncPayload = {
  estimates: Estimate[];
  quotes: Quote[];
  installers: Installer[];
  scheduleItems: ScheduleItem[];
};

export type DbBootstrapResult =
  | { ok: true; source: 'db'; detail?: 'hydrated' | 'pushed_local_then_hydrated' | 'empty' }
  | { ok: false; source: 'local'; reason: 'db_unreachable' | 'db_empty_kept_local' }
  | { ok: false; source: 'none'; reason: 'server' };

function hasAnyData(sync: SyncPayload): boolean {
  return (
    Boolean(sync.estimates?.length) ||
    Boolean(sync.quotes?.length) ||
    Boolean(sync.scheduleItems?.length)
  );
}

function localHasAnyData(): boolean {
  const estimates = readJson<Estimate[]>(ESTIMATES_KEY, []);
  const quotes = readJson<Quote[]>(QUOTES_KEY, []);
  const scheduleItems = readJson<ScheduleItem[]>(SCHEDULE_ITEMS_KEY, []);

  return (
    (Array.isArray(estimates) && estimates.length > 0) ||
    (Array.isArray(quotes) && quotes.length > 0) ||
    (Array.isArray(scheduleItems) && scheduleItems.length > 0)
  );
}

function hydrateLocalCache(sync: SyncPayload) {
  writeJson(ESTIMATES_KEY, sync.estimates ?? []);
  writeJson(QUOTES_KEY, sync.quotes ?? []);
  writeJson(INSTALLERS_KEY, sync.installers ?? []);
  writeJson(SCHEDULE_ITEMS_KEY, sync.scheduleItems ?? []);
}

async function pushLocalToDbIfEmpty() {
  const estimates = readJson<Estimate[]>(ESTIMATES_KEY, []);
  const quotes = readJson<Quote[]>(QUOTES_KEY, []);
  const scheduleItems = readJson<ScheduleItem[]>(SCHEDULE_ITEMS_KEY, []);

  if (!Array.isArray(estimates) && !Array.isArray(quotes) && !Array.isArray(scheduleItems)) return;

  const estimatesArr = Array.isArray(estimates) ? estimates : [];
  const quotesArr = Array.isArray(quotes) ? quotes : [];
  const scheduleArr = Array.isArray(scheduleItems) ? scheduleItems : [];

  if (!estimatesArr.length && !quotesArr.length && !scheduleArr.length) return;

  for (const e of estimatesArr) {
    if (!e?.id || !e.projectId || !e.createdAt) continue;
    await apiJson('/api/staff/v1/estimates', { method: 'POST', body: JSON.stringify({ estimate: e }) }).catch(() => null);
  }

  for (const q of quotesArr) {
    if (!q?.id || !q.projectId || !q.createdAt) continue;
    await apiJson('/api/staff/v1/quotes', { method: 'POST', body: JSON.stringify({ quote: q }) }).catch(() => null);
  }

  if (scheduleArr.length) {
    await apiJson('/api/staff/v1/schedule-items', { method: 'PUT', body: JSON.stringify({ items: scheduleArr }) }).catch(() => null);
  }
}

export async function ensureDbBootstrapped(): Promise<DbBootstrapResult> {
  if (typeof window === 'undefined') return { ok: false, source: 'none', reason: 'server' };
  const done = window.localStorage.getItem(BOOTSTRAP_KEY) === '1';
  const localHas = localHasAnyData();

  const fetchSync = async (): Promise<SyncPayload | null> => {
    try {
      return await apiJson<SyncPayload>('/api/staff/v1/sync', { skipSaveTracking: true });
    } catch {
      return null;
    }
  };

  const sync = await fetchSync();
  if (!sync) return { ok: false, source: 'local', reason: 'db_unreachable' };

  if (hasAnyData(sync)) {
    hydrateLocalCache(sync);
    window.localStorage.setItem(BOOTSTRAP_KEY, '1');
    return { ok: true, source: 'db', detail: 'hydrated' };
  }

  // DB is reachable but empty.
  // If we still have local cache data, do NOT overwrite it with empty DB results. Try pushing to DB instead.
  if (localHas) {
    await pushLocalToDbIfEmpty();
    const sync2 = await fetchSync();
    if (sync2 && hasAnyData(sync2)) {
      hydrateLocalCache(sync2);
      window.localStorage.setItem(BOOTSTRAP_KEY, '1');
      return { ok: true, source: 'db', detail: 'pushed_local_then_hydrated' };
    }
    return { ok: false, source: 'local', reason: 'db_empty_kept_local' };
  }

  // Both DB + local are empty: safe to hydrate (empty) and mark bootstrapped.
  if (!done) {
    hydrateLocalCache(sync);
    window.localStorage.setItem(BOOTSTRAP_KEY, '1');
  }
  return { ok: true, source: 'db', detail: 'empty' };
}
