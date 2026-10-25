'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { coerceProjectTab, type ProjectTabKey } from '@/lib/projects/projectTabs';

// Navigation intent belongs above the metadata and lazy-tab loading boundaries.
export function useProjectTabSelection(projectId: string, tab: string, hasJobPacks?: boolean) {
  const searchParams = useSearchParams();
  const [selection, setSelection] = useState<{ projectId: string; tab: ProjectTabKey } | null>(null);
  const optimisticTab = selection?.projectId === projectId ? selection.tab : null;
  // An unresolved summary must not turn a direct Job Packs entry into Overview.
  const canonicalTab = coerceProjectTab(searchParams.get('tab') ?? tab, hasJobPacks ?? true);
  const pendingTabRef = useRef<{
    projectId: string;
    from: typeof canonicalTab;
    target: ProjectTabKey;
  } | null>(null);

  useEffect(() => {
    const pending = pendingTabRef.current;
    if (pending?.projectId === projectId) {
      // Native history may have moved again before Next adopts an older bridge
      // update. Keep the latest intent until canonical state matches that URL.
      const historyTab = coerceProjectTab(new URL(window.location.href).searchParams.get('tab') ?? tab, hasJobPacks ?? true);
      if (canonicalTab !== historyTab) return;
      if (canonicalTab === pending.target) {
        pendingTabRef.current = null;
      } else if (canonicalTab === pending.from) {
        return;
      } else {
        pendingTabRef.current = null;
      }
    } else {
      pendingTabRef.current = null;
    }
    setSelection(null);
  }, [canonicalTab, projectId, tab, hasJobPacks]);

  useEffect(() => {
    const pathname = window.location.pathname;
    const restoreHistoryIntent = () => {
      if (window.location.pathname !== pathname) {
        pendingTabRef.current = null;
        setSelection(null);
        return;
      }
      const target = coerceProjectTab(new URL(window.location.href).searchParams.get('tab') ?? tab, hasJobPacks ?? true);
      pendingTabRef.current = { projectId, from: canonicalTab, target };
      setSelection({ projectId, tab: target });
    };
    window.addEventListener('popstate', restoreHistoryIntent);
    return () => window.removeEventListener('popstate', restoreHistoryIntent);
  }, [canonicalTab, projectId, tab, hasJobPacks]);

  const selectTab = (nextTab: ProjectTabKey) => {
    pendingTabRef.current = { projectId, from: canonicalTab, target: nextTab };
    setSelection({ projectId, tab: nextTab });
  };

  return {
    optimisticTab,
    selectTab,
    activeTab: coerceProjectTab(optimisticTab ?? canonicalTab, hasJobPacks ?? true),
  };
}
