'use client';

import { useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  coerceProjectTab,
  getAvailableProjectTabs,
  isProjectNavigationTabSelected,
  type ProjectNavigationTabKey,
  type ProjectTabKey,
} from '@/lib/projects/projectTabs';
import { TabNavigation } from '@/components/ui/foundation/FoundationOperational';
import { selectProjectView, updateProjectView } from './projectViewNavigation';

export default function ProjectTabNavigationSurface({
  hasJobPacks,
  onIntent, deferHistory = false,
  tabAvailabilityReady = true,
  initialTab,
  optimisticTab,
  onTabSelect,
}: {
  hasJobPacks: boolean;
  deferHistory?: boolean;
  onIntent?: (tab: ProjectNavigationTabKey) => void;
  tabAvailabilityReady?: boolean;
  host: string;
  initialTab: string;
  projectId: string;
  optimisticTab?: ProjectTabKey | null;
  onTabSelect?: (tab: ProjectTabKey) => void;
}) {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get('tab') ?? initialTab;
  // A summary snapshot has no pack inventory. Preserve a deep link until the
  // complete snapshot can distinguish an absent pack from an unfinished read.
  const showJobPacks = hasJobPacks || (!tabAvailabilityReady && requestedTab === 'job-packs');
  const activeTab = coerceProjectTab(requestedTab, showJobPacks);
  const tabs = getAvailableProjectTabs(showJobPacks);
  const selectedTab = optimisticTab ?? activeTab;
  const selectedNavigationKey = tabs.find((item) => isProjectNavigationTabSelected(item.navigationKey, selectedTab))?.navigationKey
    ?? 'activity';

  const replaceTab = useCallback((nextTab: ProjectTabKey) => {
    updateProjectView((query) => {
    query.set('tab', nextTab);
    if (nextTab !== 'quotes') query.delete('quotePreview');
    if (nextTab !== 'job-packs') query.delete('sheet');
    query.delete('mode');
    }, 'replace');
  }, []);

  useEffect(() => {
    if (deferHistory || requestedTab === activeTab) return;
    replaceTab(activeTab);
  }, [activeTab, deferHistory, replaceTab, requestedTab]);



  const selectTab = (tab: ProjectNavigationTabKey) => {
    if (deferHistory) {
      if (window.dispatchEvent(new Event('portal:before-project-view-change', { cancelable: true }))) onTabSelect?.(tab);
    } else if (selectProjectView(tab)) onTabSelect?.(tab);
  };

  return (
    <TabNavigation
      ariaLabel="Project sections"
      items={tabs.map((item) => ({ key: item.navigationKey, label: item.label, controls: 'project-tab-content' }))}
      selectedKey={selectedNavigationKey}
      onSelect={selectTab}
      onIntent={onIntent}
    />
  );
}
