import type { MouseEvent } from 'react';

const key = '__sanctuaryProjectCollectionReturn';
type CollectionReturn = { href: string; scrollY: number };
type EntryReturn = { path: string; collection: CollectionReturn };
let pendingReturn: EntryReturn | null = null;
const warmReturnCards = new Set<string>();
const currentPath = () => window.location.pathname + window.location.search;

export function isCollectionReturnImageWarm(slug: string) { return warmReturnCards.has(slug); }

function rememberVisibleImages() {
  warmReturnCards.clear();
  for (const card of document.querySelectorAll<HTMLElement>('[data-project-card]')) {
    const image = card.querySelector('img');
    const rect = image?.getBoundingClientRect();
    if (image?.complete && image.naturalWidth > 0 && rect && rect.bottom > 0 && rect.top < window.innerHeight
      && rect.right > 0 && rect.left < window.innerWidth) {
      warmReturnCards.add(card.dataset.projectCard!);
      if (warmReturnCards.size === 12) break;
    }
  }
}

function collectionScrollElement(): HTMLElement | null {
  const body = document.body;
  // Some responsive layouts scroll BODY independently of the document viewport.
  // Check its geometry too, so the same owner is found when returning at the top.
  return body.scrollTop > 0 || (
    /^(auto|scroll|overlay)$/.test(getComputedStyle(body).overflowY)
    && body.scrollHeight > body.clientHeight + 1
  ) ? body : null;
}

export function restoreCollectionScroll(top: number) {
  const scroller = collectionScrollElement();
  if (Math.abs((scroller?.scrollTop ?? window.scrollY) - top) < 1) return;
  if (scroller) scroller.scrollTo({ top, behavior: 'instant' });
  else window.scrollTo({ top, behavior: 'instant' });
}

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

/** A new All projects entry needs its journey context; Back already has an entry owner. */
export function readCollectionLinkReturn(): CollectionReturn | null {
  const isLinkReturn = pendingReturn?.path === currentPath();
  const collection = readCollectionReturn();
  return isLinkReturn ? collection : null;
}

/** Carry return context only along unmodified links activated in this journey. */
export function saveCollectionReturn(event: MouseEvent<HTMLElement>) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const anchor = (event.target as Element).closest<HTMLAnchorElement>('a[href]');
  if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
  const target = new URL(anchor.href, window.location.origin);
  if (target.origin !== window.location.origin || !/^\/projects(?:\/[^/]+)?$/.test(target.pathname)) return;
  const collection = window.location.pathname === '/projects'
    ? { href: currentPath(), scrollY: collectionScrollElement()?.scrollTop ?? window.scrollY }
    : entryReturn();
  pendingReturn = null;
  if (!collection) return;
  if (window.location.pathname === '/projects') rememberVisibleImages();
  markEntry(collection);
  pendingReturn = { path: target.pathname + target.search, collection };
}
