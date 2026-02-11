'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import ActivityTab from './tabs/ActivityTab';
import EmailsTab from './tabs/EmailsTab';
import EstimatesTab from './tabs/EstimatesTab';
import PlaceholderTab from './tabs/PlaceholderTab';
import QuotesTab from './tabs/QuotesTab';
import type { ProjectPageSnapshot } from '@/lib/projects/types';
import legacy from '@/app/staff/projects/projects.module.css';
import layout from './ProjectPage.module.css';
import { estimateMetasByProjectQueryOptions } from '@/lib/queries/projectEstimates';
import { quoteVersionsByProjectQueryOptions } from '@/lib/queries/quotes';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';

const TABS = [
  { key: 'activity', label: 'Activity' },
  { key: 'emails', label: 'Emails' },
  { key: 'estimates', label: 'Estimates' },
  { key: 'quotes', label: 'Quotes' },
  { key: 'files', label: 'Files' },
] as const;

type TabKey = (typeof TABS)[number]['key'];
type ModeKey = 'general' | 'focus';

function coerceTab(value: string | undefined): TabKey {
  return (TABS.find((t) => t.key === value)?.key ?? 'activity') as TabKey;
}

function coerceMode(value: string | undefined): ModeKey {
  return value === 'focus' ? 'focus' : 'general';
}

export default function ProjectMainTabs({
  snapshot,
  tab,
  mode,
  setMode,
}: {
  snapshot: ProjectPageSnapshot;
  tab: string;
  mode: ModeKey;
  setMode: (mode: ModeKey) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const hostKey = useMemo(() => supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown', []);
  const projectId = snapshot.project.id;

  const tabFromUrl = useMemo(() => coerceTab(searchParams.get('tab') ?? tab), [searchParams, tab]);
  const [activeTab, setActiveTab] = useState<TabKey>(tabFromUrl);
  const activeMode = coerceMode(mode);

  useEffect(() => {
    setActiveTab(tabFromUrl);
  }, [tabFromUrl]);

  const updateParams = (next: Partial<{ tab: TabKey }>) => {
    const qs = new URLSearchParams(searchParams.toString());
    if (next.tab) qs.set('tab', next.tab);
    const query = qs.toString();
    if (next.tab) setActiveTab(next.tab);
    router.replace(`${pathname}${query ? `?${query}` : ''}`);
  };

  const prefetchTabData = (tabKey: TabKey) => {
    if (tabKey === 'estimates') {
      void queryClient.prefetchQuery(estimateMetasByProjectQueryOptions(hostKey, projectId));
      return;
    }
    if (tabKey === 'quotes') {
      void queryClient.prefetchQuery(estimateMetasByProjectQueryOptions(hostKey, projectId));
      void queryClient.prefetchQuery(quoteVersionsByProjectQueryOptions(hostKey, projectId));
    }
  };

  useEffect(() => {
    const key = `sp_project_tabs_warmup_v1:${hostKey}:${projectId}`;
    if (typeof window === 'undefined') return;
    if (window.sessionStorage.getItem(key) === '1') return;
    window.sessionStorage.setItem(key, '1');

    const run = async () => {
      await Promise.allSettled([
        queryClient.prefetchQuery(estimateMetasByProjectQueryOptions(hostKey, projectId)),
        queryClient.prefetchQuery(quoteVersionsByProjectQueryOptions(hostKey, projectId)),
      ]);
    };

    const ric = (window as any).requestIdleCallback as ((cb: () => void, opts?: { timeout: number }) => number) | undefined;
    if (typeof ric === 'function') {
      ric(() => void run(), { timeout: 2500 });
      return;
    }
    const t = window.setTimeout(() => void run(), 200);
    return () => window.clearTimeout(t);
  }, [hostKey, projectId, queryClient]);

  return (
    <section className={legacy.section} aria-label="Project tabs">
      <div className={legacy.sectionHeader}>
        <div className={layout.tabScroller}>
          <div className={legacy.tabsPill} role="tablist" aria-label="Project tabs">
            {TABS.map((tabItem) => {
              const isActive = tabItem.key === activeTab;
              return (
                <button
                  key={tabItem.key}
                  type="button"
                  onClick={() => updateParams({ tab: tabItem.key })}
                  onMouseEnter={() => prefetchTabData(tabItem.key)}
                  onFocus={() => prefetchTabData(tabItem.key)}
                  className={`${legacy.tabButton} ${isActive ? legacy.tabButtonActive : ''}`}
                  aria-selected={isActive}
                  role="tab"
                >
                  {tabItem.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className={legacy.actions}>
          <div className={legacy.tabsPill} role="group" aria-label="Mode toggle">
            {(['general', 'focus'] as const).map((value) => {
              const active = activeMode === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  className={`${legacy.tabButton} ${active ? legacy.tabButtonActive : ''}`}
                  aria-pressed={active}
                >
                  {value === 'focus' ? 'Focus' : 'General'}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className={legacy.sectionBody}>
        {activeTab === 'activity' ? <ActivityTab activity={snapshot.activity} /> : null}
        {activeTab === 'emails' ? <EmailsTab projectId={snapshot.project.id} emails={snapshot.emails} /> : null}
        {activeTab === 'estimates' ? <EstimatesTab projectId={snapshot.project.id} mode={activeMode} /> : null}
        {activeTab === 'quotes' ? <QuotesTab projectId={snapshot.project.id} /> : null}
        {activeTab === 'files' ? (
          <PlaceholderTab title="Files" description="Upload and manage project files once storage is wired up." />
        ) : null}
      </div>
    </section>
  );
}
