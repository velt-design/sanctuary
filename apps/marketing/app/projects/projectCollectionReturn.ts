const key = 'sanctuary-project-collection-return';
type CollectionReturn = { href: string; scrollY: number };
export function readCollectionReturn(): CollectionReturn | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    return value && /^\/projects(?:\?[^#]*)?$/.test(value.href) && Number.isFinite(value.scrollY) && value.scrollY >= 0 ? value : null;
  } catch { return null; }
}
export function saveCollectionReturn() {
  if (window.location.pathname !== '/projects') return;
  try { sessionStorage.setItem(key, JSON.stringify({ href: window.location.pathname + window.location.search, scrollY: window.scrollY })); } catch { /* Native navigation remains available without storage. */ }
}
