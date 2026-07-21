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
  host,
  initialTab,
  projectId,
}: {
  hasJobPacks: boolean;
  host: string;
  initialTab: string;
  projectId: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const requestedTab = searchParams.get('tab') ?? initialTab;
  const activeTab = coerceProjectTab(requestedTab, hasJobPacks);
  const tabs = getAvailableProjectTabs(hasJobPacks);
  const selectedNavigationKey = tabs.find((item) => isProjectNavigationTabSelected(item.navigationKey, activeTab))?.navigationKey
    ?? 'activity';

  const replaceTab = useCallback((nextTab: ProjectTabKey) => {
    const query = new URLSearchParams(searchParams.toString());
    query.set('tab', nextTab);
    if (nextTab !== 'quotes') query.delete('quotePreview');
    if (nextTab !== 'job-packs') query.delete('sheet');
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

  return (
    <TabNavigation
      ariaLabel="Project sections"
      items={tabs.map((item) => ({ key: item.navigationKey, label: item.label, controls: 'project-tab-content' }))}
      selectedKey={selectedNavigationKey}
      onSelect={replaceTab}
      onIntent={prefetch}
    />
  );
}
