'use client';

import { useCallback, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
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
import { usePortalRouteTransition } from '@/components/page-state/PortalRouteTransition';

export default function ProjectTabNavigation({
  hasJobPacks,
  host,
  initialTab,
  projectId,
  optimisticTab,
  onTabSelect,
}: {
  hasJobPacks: boolean;
  host: string;
  initialTab: string;
  projectId: string;
  optimisticTab?: ProjectNavigationTabKey | null;
  onTabSelect?: (tab: ProjectNavigationTabKey) => void;
}) {
  const pathname = usePathname();
  const { navigateRoute } = usePortalRouteTransition();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const requestedTab = searchParams.get('tab') ?? initialTab;
  const activeTab = coerceProjectTab(requestedTab, hasJobPacks);
  const tabs = getAvailableProjectTabs(hasJobPacks);
  const selectedTab = optimisticTab ?? activeTab;
  const selectedNavigationKey = tabs.find((item) => isProjectNavigationTabSelected(item.navigationKey, selectedTab))?.navigationKey
    ?? 'activity';

  const replaceTab = useCallback((nextTab: ProjectTabKey) => {
    const query = new URLSearchParams(searchParams.toString());
    query.set('tab', nextTab);
    if (nextTab !== 'quotes') query.delete('quotePreview');
    if (nextTab !== 'job-packs') query.delete('sheet');
    query.delete('mode');
    const href = `${pathname}?${query.toString()}`;
    const label = getAvailableProjectTabs(hasJobPacks)
      .find((item) => item.navigationKey === nextTab)?.label ?? 'Project';
    navigateRoute({ href, label, source: 'project-tab' }, { replace: true, scroll: false });
  }, [hasJobPacks, navigateRoute, pathname, searchParams]);

  useEffect(() => {
    if (requestedTab === activeTab) return;
    replaceTab(activeTab);
  }, [activeTab, replaceTab, requestedTab]);

  const prefetch = (tab: ProjectNavigationTabKey) => {
    void preloadProjectTab(tab, { host, projectId, queryClient });
  };

  const selectTab = (tab: ProjectNavigationTabKey) => {
    onTabSelect?.(tab);
    replaceTab(tab);
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
