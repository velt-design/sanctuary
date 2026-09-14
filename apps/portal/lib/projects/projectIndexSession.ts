const PREFIX = 'sanctuary:project-index:v1:';
let activeKey: string | null = null;

type ProjectIndexPosition = { href: string; scrollY: number; anchor?: { id: string; offsetY: number } };

export function setProjectIndexSession(userId: string | null, environment: string) {
  activeKey = projectIndexSessionKey(userId, environment);
}

export function projectIndexSessionKey(userId: string | null, environment: string) {
  return userId ? PREFIX + encodeURIComponent(environment) + ':' + encodeURIComponent(userId) : null;
}

export function cleanProjectIndexHref(href: string): string | null {
  try {
    const base = typeof window === 'undefined' ? 'https://portal.invalid' : window.location.origin;
    const url = new URL(href, base);
    if (url.origin !== base || url.pathname !== '/staff/projects') return null;
    url.searchParams.delete('__portal_opening');
    url.searchParams.delete('toast');
    url.searchParams.sort();
    return url.pathname + url.search;
  } catch { return null; }
}

export function readProjectIndexPosition(key = activeKey): ProjectIndexPosition | null {
  if (!key || typeof window === 'undefined') return null;
  try {
    const value = JSON.parse(window.sessionStorage.getItem(key) ?? 'null');
    const href = value && typeof value.href === 'string' ? cleanProjectIndexHref(value.href) : null;
    const anchor = value?.anchor;
    return href && Number.isFinite(value.scrollY) && value.scrollY >= 0
      ? { href, scrollY: value.scrollY, ...(typeof anchor?.id === 'string' && anchor.id.length <= 200 && Number.isFinite(anchor.offsetY) ? { anchor } : {}) } : null;
  } catch { return null; }
}

export function rememberProjectIndexPosition(href: string, scrollY: number, key = activeKey, captureAnchor = true) {
  const clean = cleanProjectIndexHref(href);
  if (!key || !clean || typeof window === 'undefined') return;
  try {
    const row = captureAnchor ? Array.from(document.querySelectorAll<HTMLElement>('[data-project-index-anchor]'))
      .find((row) => row.getBoundingClientRect().bottom > 0) : null;
    const anchor = row ? { id: row.dataset.projectIndexAnchor, offsetY: row.getBoundingClientRect().top } : null;
    window.sessionStorage.setItem(key, JSON.stringify({ href: clean, scrollY: Math.max(0, scrollY), ...(anchor ? { anchor } : {}) }));
  } catch { /* Navigation remains URL-owned when browser storage is unavailable. */ }
}

export function resolveProjectIndexReturnHref(href: string): string {
  return href === '/staff/projects' ? readProjectIndexPosition()?.href ?? href : href;
}
