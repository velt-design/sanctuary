'use client';

import { useCallback, useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  coerceProjectTab,
  getAvailableProjectTabs,
  isProjectNavigationTabSelected,
  type ProjectNavigationTabKey,
  type ProjectTabKey,
} from '@/lib/projects/projectTabs';
import { preloadProjectTab } from './projectTabModules';
import { TabNavigation } from '@/components/ui/foundation';

export default function ProjectTabNavigation({
  hasJobPacks,
  tabAvailabilityReady = true,
  host,
  initialTab,
  projectId,
  optimisticTab,
  onTabSelect,
}: {
  hasJobPacks: boolean;
  tabAvailabilityReady?: boolean;
  host: string;
  initialTab: string;
  projectId: string;
  optimisticTab?: ProjectNavigationTabKey | null;
  onTabSelect?: (tab: ProjectNavigationTabKey) => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const requestedTab = searchParams.get('tab') ?? initialTab;
  // A summary snapshot has no pack inventory. Preserve a deep link until the
  // complete snapshot can distinguish an absent pack from an unfinished read.
  const showJobPacks = hasJobPacks || (!tabAvailabilityReady && requestedTab === 'job-packs');
  const activeTab = coerceProjectTab(requestedTab, showJobPacks);
  const tabs = getAvailableProjectTabs(showJobPacks);
  const selectedTab = optimisticTab ?? activeTab;
  const selectedNavigationKey = tabs.find((item) => isProjectNavigationTabSelected(item.navigationKey, selectedTab))?.navigationKey
    ?? 'activity';

  const replaceTab = useCallback((nextTab: ProjectTabKey, resetNestedSelection = false) => {
    const query = new URLSearchParams(searchParams.toString());
    query.set('tab', nextTab);
    if (nextTab !== 'quotes') query.delete('quotePreview');
    if (nextTab !== 'job-packs') query.delete('sheet');
    if (resetNestedSelection) {
      query.delete('quoteId');
      query.delete('quotePreview');
      query.delete('estimateId');
      query.delete('fromEstimateId');
      query.delete('newDesign');
    }
    query.delete('mode');
    router.replace(`${pathname}?${query.toString()}`);
  }, [pathname, router, searchParams]);

  useEffect(() => {
    if (requestedTab === activeTab) return;
    replaceTab(activeTab);
  }, [activeTab, replaceTab, requestedTab]);

  const prefetch = (tab: ProjectNavigationTabKey) => {
    void preloadProjectTab(tab, { host, projectId, queryClient });
  };

  const selectTab = (tab: ProjectNavigationTabKey) => {
    onTabSelect?.(tab);
    replaceTab(tab, true);
  };

  return (
    <TabNavigation
      ariaLabel="Project sections"
      items={tabs.map((item) => ({ key: item.navigationKey, label: item.label, controls: 'project-tab-content' }))}
      selectedKey={selectedNavigationKey}
      onSelect={selectTab}
      onIntent={prefetch}
    />
  );
}
