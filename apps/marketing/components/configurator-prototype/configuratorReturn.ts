const KEY = 'sanctuary.configurator-return.v1';
const RESTORE_KEY = 'sanctuary.configurator-scroll.v1';
function pageScrollElement(): HTMLElement | null {
  const body = document.body;
  return body.scrollTop > 0 || (
    /^(auto|scroll|overlay)$/.test(getComputedStyle(body).overflowY)
    && body.scrollHeight > body.clientHeight + 1
  ) ? body : null;
}

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
    sessionStorage.setItem(KEY, JSON.stringify({ from, destination: destination.pathname + destination.search, created: Date.now(), scrollY: pageScrollElement()?.scrollTop ?? window.scrollY }));
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
  try {
    const raw = sessionStorage.getItem(RESTORE_KEY);
    if (!raw) return;
    const entry = JSON.parse(raw) as ReturnEntry;
    if (entry.from !== window.location.pathname + window.location.search + window.location.hash) return;
    if (!Number.isFinite(entry.scrollY) || entry.scrollY < 0 || Date.now() - entry.created > 60_000) {
      sessionStorage.removeItem(RESTORE_KEY);
      return;
    }
    let frame = 0;
    let scheduled = false;
    const inputs = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
    const cleanup = () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      inputs.forEach(type => window.removeEventListener(type, cancel));
    };
    const cancel = () => {
      cleanup();
      try { sessionStorage.removeItem(RESTORE_KEY); } catch { /* Storage is optional. */ }
    };
    const restoreWhenReady = () => {
      if (scheduled || document.querySelector('[data-configurator-return-ready="false"]')) return;
      scheduled = true;
      observer.disconnect();
      // Saved selections can change the source layout after hydration/API loading.
      // Wait for their real readiness, then route effects and browser hash scrolling.
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          const scroller = pageScrollElement();
          if (scroller) scroller.scrollTo({ top: entry.scrollY, behavior: 'instant' });
          else window.scrollTo({ top: entry.scrollY, behavior: 'instant' });
          cancel();
        });
      });
    };
    const observer = new MutationObserver(restoreWhenReady);
    observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-configurator-return-ready'] });
    inputs.forEach(type => window.addEventListener(type, cancel, { once: true, passive: true }));
    restoreWhenReady();
    return cleanup;
  } catch { /* Storage is optional. */ }
}
