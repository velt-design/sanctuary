'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import ActivityTab from './tabs/ActivityTab';
import EmailsTab from './tabs/EmailsTab';
import PlaceholderTab from './tabs/PlaceholderTab';
import type { ProjectPageSnapshot } from '@/lib/projects/types';
import legacy from '@/app/staff/projects/projects.module.css';
import layout from './ProjectPage.module.css';

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
        {activeTab === 'estimates' ? (
          <PlaceholderTab title="Estimates" description="Estimate summaries and approvals will live here." />
        ) : null}
        {activeTab === 'quotes' ? (
          <PlaceholderTab title="Quotes" description="Quote drafts, versions, and status updates will appear here." />
        ) : null}
        {activeTab === 'files' ? (
          <PlaceholderTab title="Files" description="Upload and manage project files once storage is wired up." />
        ) : null}
      </div>
    </section>
  );
}
