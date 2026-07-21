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
import styles from './ProjectPage.module.css';

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
    <nav className={styles.headerTabsScroller} aria-label="Project sections">
      <div className={styles.headerTabs} role="tablist" aria-label="Project tabs">
        {tabs.map((tab) => {
          const selected = isProjectNavigationTabSelected(tab.navigationKey, activeTab);
          return (
            <button
              key={tab.key}
              type="button"
              className={`${styles.headerTab} ${selected ? styles.headerTabActive : ''}`}
              aria-selected={selected}
              role="tab"
              onClick={() => replaceTab(tab.navigationKey)}
              onFocus={() => prefetch(tab.navigationKey)}
              onKeyDown={(event) => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                event.preventDefault();
                const currentIndex = tabs.findIndex((candidate) => candidate.key === tab.key);
                const nextIndex = event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? tabs.length - 1
                    : event.key === 'ArrowRight'
                      ? (currentIndex + 1) % tabs.length
                      : (currentIndex - 1 + tabs.length) % tabs.length;
                const nextTab = tabs[nextIndex];
                const nextButton = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex];
                nextButton?.focus();
                replaceTab(nextTab.navigationKey);
              }}
              onMouseEnter={() => prefetch(tab.navigationKey)}
              onPointerDown={() => prefetch(tab.navigationKey)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
