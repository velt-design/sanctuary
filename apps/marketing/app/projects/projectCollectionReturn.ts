import type { MouseEvent } from 'react';

const key = '__sanctuaryProjectCollectionReturn';
type CollectionReturn = { href: string; scrollY: number };
type EntryReturn = { path: string; collection: CollectionReturn };
let pendingReturn: EntryReturn | null = null;
const currentPath = () => window.location.pathname + window.location.search;

function validCollection(value: unknown): value is CollectionReturn {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as CollectionReturn;
  return typeof candidate.href === 'string' && /^\/projects(?:\?[^#]*)?$/.test(candidate.href)
    && Number.isFinite(candidate.scrollY) && candidate.scrollY >= 0;
}

function entryReturn(): CollectionReturn | null {
  const entry = window.history.state?.[key] as EntryReturn | undefined;
  return entry?.path === currentPath() && validCollection(entry.collection) ? entry.collection : null;
}

function markEntry(collection: CollectionReturn) {
  // This is metadata on the existing entry, not a URL change: retain Next's tree.
  window.history.replaceState({ ...window.history.state, [key]: { path: currentPath(), collection } }, '', window.location.href);
}

export function readCollectionReturn(): CollectionReturn | null {
  const pending = pendingReturn;
  pendingReturn = null;
  if (pending?.path === currentPath()) markEntry(pending.collection);
  return entryReturn();
}

/** Carry return context only along unmodified links activated in this journey. */
export function saveCollectionReturn(event: MouseEvent<HTMLElement>) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const anchor = (event.target as Element).closest<HTMLAnchorElement>('a[href]');
  if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
  const target = new URL(anchor.href, window.location.origin);
  if (target.origin !== window.location.origin || !/^\/projects(?:\/[^/]+)?$/.test(target.pathname)) return;
  const collection = window.location.pathname === '/projects'
    ? { href: currentPath(), scrollY: window.scrollY }
    : entryReturn();
  pendingReturn = null;
  if (!collection) return;
  markEntry(collection);
  pendingReturn = { path: target.pathname + target.search, collection };
}
