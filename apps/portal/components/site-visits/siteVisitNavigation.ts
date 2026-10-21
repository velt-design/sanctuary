'use client';

type VisitFilters = { view?: string; person?: string; q?: string; project?: string; visit?:string };

/** All agenda controls share one immediate URL transition. Mixing a server
 * Link transition with local filters lets an older scope overwrite a new view. */
export function selectSiteVisitView(next: VisitFilters, mode: 'push' | 'replace' = 'replace') {
  const url = new URL(window.location.href);
  if(!Object.hasOwn(next,'visit')&&Object.keys(next).some(k=>['view','person','q','project'].includes(k)))url.searchParams.delete('visit');
  for (const [key, value] of Object.entries(next)) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  if (url.href === window.location.href) return;
  // Next copies its own history metadata. Supplying its internal __NA state
  // would mark this as a router-owned write and skip the search-param update.
  window.history[mode === 'push' ? 'pushState' : 'replaceState'](null, '', url);
}

export function allVisitsHref(params: { toString(): string }) {
  const query = new URLSearchParams(params.toString());
  query.delete('project');
  query.delete('visit');
  const search = query.toString();
  return `/staff/site-visits${search ? `?${search}` : ''}`;
}
