'use client';

type NavigationEntries = EventTarget & { currentEntry?: { index: number } | null };
type Guard = (from: URL, to: URL) => boolean;
const POSITION_KEY = '__sanctuaryHistoryPosition';

/** A history traversal has already changed the URL when popstate fires. Keep it
 * away from router listeners until the dirty-view decision is made. Cancellation
 * traverses back to the existing entry; it never rewrites or appends an entry. */
function createHistoryGuard() {
  const history = window.history;
  const navigation = (window as Window & { navigation?: NavigationEntries }).navigation;
  const hasEntries = Number.isInteger(navigation?.currentEntry?.index);
  const position = () => hasEntries
    ? navigation!.currentEntry!.index
    : history.state?.[POSITION_KEY] as number | undefined;
  const guards = new Set<Guard>();
  const originalPush = history.pushState;
  const originalReplace = history.replaceState;
  let current = { index: position() ?? 0, url: window.location.href };
  let restoring = false;

  const remember = () => {
    current = { index: position() ?? current.index, url: window.location.href };
  };
  // Navigation entries also cover browser-created hash entries. Older browsers
  // use additive state metadata, installed at the Portal shell before navigation.
  const entryChanged = (event: Event) => {
    if ((event as Event & { navigationType?: string }).navigationType !== 'traverse') remember();
  };
  const push: History['pushState'] = function (data, unused, url) {
    originalPush.call(history, { ...data, [POSITION_KEY]: current.index + 1 }, unused, url);
    remember();
  };
  const replace: History['replaceState'] = function (data, unused, url) {
    originalReplace.call(history, { ...data, [POSITION_KEY]: position() ?? current.index }, unused, url);
    remember();
  };
  if (hasEntries) {
    navigation!.addEventListener('currententrychange', entryChanged);
  } else {
    originalReplace.call(history, { ...history.state, [POSITION_KEY]: current.index }, '', window.location.href);
    history.pushState = push;
    history.replaceState = replace;
  }

  const onPopState = (event: PopStateEvent) => {
    const index = position();
    // Entries from a previous document are protected by beforeunload. Do not
    // guess a direction for an entry that predates this shell's history tracking.
    if (typeof index !== 'number') return;
    if (restoring) {
      event.stopImmediatePropagation();
      restoring = index !== current.index;
      return;
    }
    const target = new URL(window.location.href);
    if (index !== current.index && [...guards].some(guard => !guard(new URL(current.url), target))) {
      event.stopImmediatePropagation();
      restoring = true;
      history.go(current.index - index);
      return;
    }
    remember();
  };
  window.addEventListener('popstate', onPopState, { capture: true });
  return {
    guards,
    dispose() {
      window.removeEventListener('popstate', onPopState, { capture: true });
      navigation?.removeEventListener('currententrychange', entryChanged);
      if (history.pushState === push) history.pushState = originalPush;
      if (history.replaceState === replace) history.replaceState = originalReplace;
    },
  };
}

let active: ReturnType<typeof createHistoryGuard> | undefined;
let users = 0;
export function retainPortalHistory() {
  active ??= createHistoryGuard();
  users += 1;
  return () => {
    users -= 1;
    if (users === 0) {
      active?.dispose();
      active = undefined;
    }
  };
}

export function guardPortalHistory(guard: Guard) {
  const release = retainPortalHistory();
  const owner = active!;
  owner.guards.add(guard);
  return () => {
    owner.guards.delete(guard);
    release();
  };
}
