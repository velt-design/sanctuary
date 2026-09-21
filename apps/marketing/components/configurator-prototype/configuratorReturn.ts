const KEY = 'sanctuary.configurator-return.v1';
const RESTORE_KEY = 'sanctuary.configurator-scroll.v1';
type ReturnEntry = { from: string; destination: string; created: number; scrollY: number };

export function safeConfiguratorReturn(value: string | null, origin: string) {
  if (!value?.startsWith('/') || value.startsWith('//')) return null;
  try {
    const url = new URL(value, origin);
    if (url.origin !== origin || url.pathname === '/configurator-preview') return null;
    return url.pathname + url.search + url.hash;
  } catch { return null; }
}

export function rememberConfiguratorReturn(destination: URL) {
  if (destination.origin !== window.location.origin || destination.pathname !== '/configurator-preview'
    || destination.searchParams.get('open') !== '1' || !destination.hash) return;
  const from = safeConfiguratorReturn(window.location.pathname + window.location.search + window.location.hash, window.location.origin);
  if (!from) return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ from, destination: destination.pathname + destination.search, created: Date.now(), scrollY: window.scrollY }));
  } catch { /* The validated source path still provides a close destination. */ }
}

export function consumeConfiguratorReturn(): ReturnEntry | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as ReturnEntry;
    return entry.destination === window.location.pathname + window.location.search
      && Date.now() - entry.created >= 0 && Date.now() - entry.created < 60_000
      && Number.isFinite(entry.scrollY) && entry.scrollY >= 0
      && safeConfiguratorReturn(entry.from, window.location.origin) ? entry : null;
  } catch { return null; }
}

export function prepareConfiguratorReturn(entry: ReturnEntry) {
  try { sessionStorage.setItem(RESTORE_KEY, JSON.stringify({ ...entry, created: Date.now() })); } catch { /* Return navigation remains available. */ }
}

export function restoreConfiguratorScroll() {
  let frame = 0;
  try {
    const raw = sessionStorage.getItem(RESTORE_KEY);
    if (!raw) return;
    const entry = JSON.parse(raw) as ReturnEntry;
    if (entry.from !== window.location.pathname + window.location.search + window.location.hash) return;
    sessionStorage.removeItem(RESTORE_KEY);
    if (!Number.isFinite(entry.scrollY) || entry.scrollY < 0 || Date.now() - entry.created > 60_000) return;
    // Run after route effects and the browser's default history/focus scrolling.
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => window.scrollTo({ top: entry.scrollY, behavior: 'instant' }));
    });
  } catch { /* Storage is optional. */ }
  return () => cancelAnimationFrame(frame);
}
