import { shouldPreserveProjectDetailScroll } from './projectDetailNavigation';

const ENTRY_KEY = '__sanctuaryPageEntry';
const STORAGE_KEY = 'sanctuary.page-positions.v1';
const SCROLLERS = ['.two-col-page', '[data-products-index]', '[data-product-detail]', '.projects-experience'];
type Position = { x: number; y: number; body: number; containers: number[] };
type SavedPosition = { position: Position; saved: number };
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;

function entryId(state: unknown): string | null {
  const id = state && typeof state === 'object' ? (state as Record<string, unknown>)[ENTRY_KEY] : null;
  return typeof id === 'string' && id.length < 100 ? id : null;
}
function newId() { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`; }
function containers() { return Array.from(document.querySelectorAll<HTMLElement>(SCROLLERS.join(','))); }
function readPosition(): Position {
  // Safari can report negative coordinates during native edge elasticity.
  // Save the logical page boundary without writing back into that gesture.
  return { x: Math.max(0, window.scrollX), y: Math.max(0, window.scrollY), body: Math.max(0, document.body.scrollTop), containers: containers().map(el => Math.max(0, el.scrollTop)) };
}
function currentOwnerPosition(position: Position): Position {
  const body = document.body;
  const bodyScrolls = /^(auto|scroll|overlay)$/.test(getComputedStyle(body).overflowY)
    && body.scrollHeight > body.clientHeight + 1;
  // BODY and the viewport are alternative owners of the same page coordinate.
  // Keep old snapshots usable across responsive/CSS changes; nested panes stay separate.
  const top = position.y || position.body;
  return { ...position, y: bodyScrolls ? 0 : top, body: bodyScrolls ? top : 0 };
}
function scroll(position: Position) {
  window.scrollTo({ left: position.x, top: position.y, behavior: 'instant' });
  document.body.scrollTop = position.body;
  containers().forEach((el, index) => { el.scrollTop = position.containers[index] ?? 0; });
}
function hashTarget() {
  const hash = window.location.hash.slice(1);
  if (!hash) return null;
  try { return document.getElementById(decodeURIComponent(hash)); }
  catch { return document.getElementById(hash); }
}

/** Coordinates belong to a history entry, never a pathname (the same page can occur twice). */
export function createPageContinuity() {
  const positions = new Map<string, SavedPosition>();
  const nativePush = window.history.pushState;
  const nativeReplace = window.history.replaceState;
  const previousScrollRestoration = window.history.scrollRestoration;
  window.history.scrollRestoration = 'manual';
  let activeId = entryId(window.history.state) ?? newId();
  let activePath = window.location.pathname;
  let activeHref = window.location.href;
  let activeHistoryState = window.history.state;
  let restoring = false;
  let frame = 0;
  let writeTimer: ReturnType<typeof setTimeout> | undefined;
  let stopRestore = () => {};

  try {
    const stored: unknown = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '[]');
    if (Array.isArray(stored)) for (const item of stored.slice(-50)) {
      const [id, value] = Array.isArray(item) ? item : [];
      const p = value?.position;
      if (typeof id === 'string' && id.length < 100 && finite(value?.saved) && Date.now() - value.saved < 86_400_000
        && p && finite(p.x) && finite(p.y) && finite(p.body) && Array.isArray(p.containers) && p.containers.length < 20 && p.containers.every(finite)) positions.set(id, value);
    }
  } catch { /* Native browser restoration remains available without storage. */ }
  const persist = () => {
    clearTimeout(writeTimer);
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(positions).slice(-50))); } catch { /* Memory still works. */ }
  };
  const capture = () => {
    if (restoring || activeHref !== window.location.href) return;
    // The mobile menu/native dialogs pin BODY at -scrollY; their zero viewport is not a page position.
    if (document.body.style.position === 'fixed' && document.body.style.top) return;
    positions.delete(activeId);
    positions.set(activeId, { position: readPosition(), saved: Date.now() });
    if (positions.size > 50) positions.delete(positions.keys().next().value!);
    clearTimeout(writeTimer);
    writeTimer = setTimeout(persist, 120);
  };
  nativeReplace.call(window.history, { ...window.history.state, [ENTRY_KEY]: activeId }, '', window.location.href);

  const push: History['pushState'] = function (this: History, data, unused, url) {
    capture(); persist(); stopRestore();
    // Next may copy custom state from the old entry. A push always gets its own identity.
    const result = nativePush.call(this, { ...data, [ENTRY_KEY]: newId() }, unused, url);
    if (window.location.pathname === activePath) frame = requestAnimationFrame(commit);
    return result;
  };
  const replace: History['replaceState'] = function (this: History, data, unused, url) {
    const nextHref = url == null ? window.location.href : new URL(String(url), window.location.href).href;
    if (nextHref !== window.location.href) { capture(); persist(); stopRestore(); }
    const id = nextHref !== window.location.href ? newId() : entryId(data) ?? entryId(window.history.state) ?? activeId;
    const result = nativeReplace.call(this, { ...data, [ENTRY_KEY]: id }, unused, url);
    if (nextHref !== activeHref && window.location.pathname === activePath) frame = requestAnimationFrame(commit);
    return result;
  };
  window.history.pushState = push;
  window.history.replaceState = replace;

  const restore = (position: Position) => {
    stopRestore();
    restoring = true;
    const started = performance.now();
    const inputs = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
    const finish = () => {
      cancelAnimationFrame(frame); restoring = false;
      inputs.forEach(type => window.removeEventListener(type, finish));
    };
    stopRestore = finish;
    inputs.forEach(type => window.addEventListener(type, finish, { passive: true, once: true }));
    const apply = () => {
      const target = currentOwnerPosition(position);
      scroll(target);
      const actual = readPosition();
      const reached = Math.abs(actual.y - target.y) < 1 && Math.abs(actual.body - target.body) < 1
        && target.containers.every((top, index) => Math.abs((actual.containers[index] ?? 0) - top) < 1);
      // Only retry while content is too short. Never keep dragging a visitor back after input.
      if (!reached && performance.now() - started < 1000) frame = requestAnimationFrame(apply);
      else finish();
    };
    apply();
  };
  const commit = () => {
    const id = entryId(window.history.state) ?? newId();
    const nextPath = window.location.pathname;
    const saved = positions.get(id);
    const changedPath = activePath !== nextPath;
    const changedHash = new URL(activeHref).hash !== window.location.hash;
    const preserveProject = window.matchMedia('(min-width: 900px)').matches
      && shouldPreserveProjectDetailScroll(activePath, nextPath, window.history.state);
    activeId = id; activePath = nextPath; activeHref = window.location.href; activeHistoryState = window.history.state;
    // New pushes/URL replacements receive fresh IDs. A saved ID is a return,
    // even when the framework commits before its popstate subscribers run.
    if (preserveProject) return;
    if (saved) restore(saved.position);
    else if (!preserveProject && (changedPath || changedHash)) {
      const target = hashTarget();
      if (target) {
        target.scrollIntoView({ block: 'start', behavior: 'instant' });
        // Responsive disclosures reveal fragment targets after the route commit.
        frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => hashTarget()?.scrollIntoView({ block: 'start', behavior: 'instant' })); });
      } else if (changedPath) scroll({ x: 0, y: 0, body: 0, containers: [] });
    }
  };
  const pop = () => {
    // The last scroll event captured the old entry before the browser changed location.
    persist(); stopRestore();
    // Same-page fragments/query history may not cause a React route commit.
    if (window.location.pathname === activePath) frame = requestAnimationFrame(commit);
  };
  const hide = () => { capture(); persist(); };
  const hash = () => {
    const id = entryId(window.history.state);
    // Native fragment links do not call pushState. Give that entry an identity,
    // retaining the router tree so Forward stays a same-document traversal.
    if (!id || (id === activeId && activeHref !== window.location.href)) {
      nativeReplace.call(window.history, { ...activeHistoryState, ...window.history.state, [ENTRY_KEY]: newId() }, '', window.location.href);
    }
    commit();
  };
  const show = (event: PageTransitionEvent) => { if (event.persisted) commit(); };
  document.addEventListener('scroll', capture, { capture: true, passive: true });
  document.addEventListener('click', capture, true);
  document.addEventListener('visibilitychange', hide);
  window.addEventListener('pagehide', hide);
  window.addEventListener('pageshow', show);
  // Capture bookkeeping before downstream routing subscribers run.
  window.addEventListener('popstate', pop, true);
  window.addEventListener('hashchange', hash);
  return {
    commit,
    dispose() {
      capture(); persist(); stopRestore();
      document.removeEventListener('scroll', capture, true);
      document.removeEventListener('click', capture, true);
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('pagehide', hide);
      window.removeEventListener('pageshow', show);
      window.removeEventListener('popstate', pop, true);
      window.removeEventListener('hashchange', hash);
      window.history.scrollRestoration = previousScrollRestoration;
      if (window.history.pushState === push) window.history.pushState = nativePush;
      if (window.history.replaceState === replace) window.history.replaceState = nativeReplace;
    },
  };
}
