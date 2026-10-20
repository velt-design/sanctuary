'use client';

import { useEffect } from 'react';
import { guardPortalHistory } from '@/components/page-state/portalHistoryGuard';
const BEFORE_VIEW_CHANGE = 'portal:before-project-view-change';

export function useProjectViewDraftGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const guard = (event: Event) => {
      if (!window.confirm('Discard unsaved quote changes?')) event.preventDefault();
    };
    window.addEventListener(BEFORE_VIEW_CHANGE, guard);
    const releaseHistory = guardPortalHistory((from, to) => {
      const sameDraft = from.pathname === to.pathname
        && to.searchParams.get('tab') === 'quotes'
        && from.searchParams.get('quoteId') === to.searchParams.get('quoteId');
      return sameDraft || window.confirm('Discard unsaved quote changes?');
    });
    return () => {
      window.removeEventListener(BEFORE_VIEW_CHANGE, guard);
      releaseHistory();
    };
  }, [dirty]);
}

/** Project views read through their own query owners. A server route transition
 * here can arrive after a newer click and briefly replace that newer view. */
export function updateProjectView(
  update: (query: URLSearchParams) => void,
  history: 'push' | 'replace' = 'push',
) {
  const url = new URL(window.location.href);
  update(url.searchParams);
  if (url.href === window.location.href) return;
  window.history[history === 'push' ? 'pushState' : 'replaceState'](null, '', url);
}

export function selectProjectView(tab: string, history: 'push' | 'replace' = 'push') {
  if (history === 'push' && !window.dispatchEvent(new Event(BEFORE_VIEW_CHANGE, { cancelable: true }))) return false;
  updateProjectView((query) => {
    query.set('tab', tab);
    for (const key of ['quoteId', 'quotePreview', 'estimateId', 'fromEstimateId', 'createFromEstimateId', 'newDesign', 'mode', 'sheet']) {
      query.delete(key);
    }
  }, history);
  return true;
}
