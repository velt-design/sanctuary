'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { coerceProjectTab, type ProjectNavigationTabKey } from '@/lib/projects/projectTabs';

// Navigation intent belongs above the metadata and lazy-tab loading boundaries.
export function useProjectTabSelection(projectId: string, tab: string, hasJobPacks?: boolean) {
  const searchParams = useSearchParams();
  const [selection, setSelection] = useState<{ projectId: string; tab: ProjectNavigationTabKey } | null>(null);
  const optimisticTab = selection?.projectId === projectId ? selection.tab : null;
  // An unresolved summary must not turn a direct Job Packs entry into Overview.
  const canonicalTab = coerceProjectTab(searchParams.get('tab') ?? tab, hasJobPacks ?? true);
  const pendingTabRef = useRef<{
    projectId: string;
    from: typeof canonicalTab;
    target: ProjectNavigationTabKey;
  } | null>(null);

  useEffect(() => {
    const pending = pendingTabRef.current;
    if (pending?.projectId === projectId) {
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
  }, [canonicalTab, projectId]);

  const selectTab = (nextTab: ProjectNavigationTabKey) => {
    pendingTabRef.current = { projectId, from: canonicalTab, target: nextTab };
    setSelection({ projectId, tab: nextTab });
  };

  return {
    optimisticTab,
    selectTab,
    activeTab: coerceProjectTab(optimisticTab ?? canonicalTab, hasJobPacks ?? true),
  };
}
