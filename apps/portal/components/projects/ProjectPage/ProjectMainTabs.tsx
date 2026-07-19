'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import ActivityTab from './tabs/ActivityTab';
import { LazyProjectDetailsSidebar, preloadProjectDetails } from './projectDetailsModule';
import type { ProjectPageSnapshot, ProjectSnapshotLoadState } from '@/lib/projects/types';
import legacy from '@/app/staff/projects/projects.module.css';
import layout from './ProjectPage.module.css';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import {
  EmailsTab,
  EstimatesTab,
  InvoicesTab,
  JobPacksTab,
  QuotesTab,
  preloadProjectTab,
  type ProjectTabModuleKey,
} from './projectTabModules';

const BASE_TABS = [
  { key: 'activity', label: 'Activity' },
  { key: 'estimates', label: 'Designs' },
  { key: 'quotes', label: 'Quotes' },
  { key: 'invoices', label: 'Invoices' },
  { key: 'job-packs', label: 'Job Packs' },
  { key: 'emails', label: 'Emails' },
] as const;

type BaseTabKey = (typeof BASE_TABS)[number]['key'];
type TabKey = BaseTabKey | 'details';
type QuoteViewKey = 'edit' | 'preview';

function coerceTab(value: string | undefined, allowedTabs: readonly { key: TabKey; label: string }[]): TabKey {
  return (allowedTabs.find((t) => t.key === value)?.key ?? 'activity') as TabKey;
}

function ProjectSnapshotTabStatus({
  label,
  snapshotState,
}: {
  label: string;
  snapshotState: ProjectSnapshotLoadState;
}) {
  const failed = snapshotState === 'refresh-failed';
  return (
    <div className={layout.tabLoadingState} data-project-tab-awaiting-snapshot={label} role="status">
      {failed
        ? `Couldn’t refresh ${label}. The project summary is still available.`
        : `Updating ${label} in the background…`}
    </div>
  );
}

export default function ProjectMainTabs({
  snapshot,
  snapshotContentReady = true,
  snapshotState = 'fresh',
  showDetailsTab = false,
  tab,
  onActiveTabChange,
}: {
  snapshot: ProjectPageSnapshot;
  snapshotContentReady?: boolean;
  snapshotState?: ProjectSnapshotLoadState;
  showDetailsTab?: boolean;
  tab: string;
  onActiveTabChange?: (tab: TabKey) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const hostKey = useMemo(() => supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown', []);
  const projectId = snapshot.project.id;

  const availableTabs = useMemo(
    () => {
      const tabs: Array<{ key: TabKey; label: string }> = BASE_TABS.filter(
        (tabItem) => tabItem.key !== 'job-packs' || snapshot.project.hasJobPacks,
      );
      if (showDetailsTab) tabs.push({ key: 'details', label: 'Details' });
      return tabs;
    },
    [showDetailsTab, snapshot.project.hasJobPacks],
  );
  const requestedTab = searchParams.get('tab') ?? tab;
  const tabFromUrl = useMemo(() => coerceTab(requestedTab, availableTabs), [availableTabs, requestedTab]);
  const [activeTab, setActiveTab] = useState<TabKey>(tabFromUrl);
  const quotePreviewFromUrl = useMemo(() => searchParams.get('quotePreview') === '1', [searchParams]);
  const quoteView: QuoteViewKey = quotePreviewFromUrl ? 'preview' : 'edit';
  const quoteIdFromUrl = useMemo(() => {
    const raw = searchParams.get('quoteId') ?? '';
    return raw.trim() || null;
  }, [searchParams]);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(quoteIdFromUrl);
  const hasSelectedQuote = Boolean(selectedQuoteId);
  const showLegacyModeToggle = false;

  useEffect(() => {
    setActiveTab(tabFromUrl);
  }, [tabFromUrl]);

  useEffect(() => {
    onActiveTabChange?.(activeTab);
  }, [activeTab, onActiveTabChange]);

  useEffect(() => {
    if (quoteIdFromUrl) {
      setSelectedQuoteId(quoteIdFromUrl);
    }
  }, [quoteIdFromUrl]);

  const updateParams = (next: Partial<{ tab: TabKey; quotePreview: boolean }>) => {
    const qs = new URLSearchParams(searchParams.toString());
    if (next.tab) qs.set('tab', next.tab);
    if (Object.prototype.hasOwnProperty.call(next, 'quotePreview')) {
      if (next.quotePreview) qs.set('quotePreview', '1');
      else qs.delete('quotePreview');
    }
    if (next.tab && next.tab !== 'quotes') qs.delete('quotePreview');
    if (next.tab && next.tab !== 'job-packs') qs.delete('sheet');
    qs.delete('mode');
    const query = qs.toString();
    if (next.tab) setActiveTab(next.tab);
    router.replace(`${pathname}${query ? `?${query}` : ''}`);
  };

  useEffect(() => {
    if (requestedTab !== 'details' || showDetailsTab) return;
    updateParams({ tab: 'activity' });
  }, [requestedTab, showDetailsTab]);

  const prefetchTabData = (tabKey: TabKey) => {
    if (tabKey === 'details') {
      void preloadProjectDetails();
      return;
    }
    void preloadProjectTab(tabKey as ProjectTabModuleKey, {
      host: hostKey,
      projectId,
      queryClient,
    });
  };

  return (
    <section
      className={`${legacy.section} ${activeTab === 'estimates' ? layout.tabSectionWorkspace : ''}`}
      aria-label="Project tabs"
      data-project-active-tab={activeTab}
    >
      <div className={legacy.sectionHeader}>
        <div className={layout.tabScroller}>
          <div className={legacy.tabsPill} role="tablist" aria-label="Project tabs">
            {availableTabs.map((tabItem) => {
              const isActive = tabItem.key === activeTab;
              return (
                <button
                  key={tabItem.key}
                  type="button"
                  onClick={() => updateParams({ tab: tabItem.key })}
                  onMouseEnter={() => prefetchTabData(tabItem.key)}
                  onFocus={() => prefetchTabData(tabItem.key)}
                  onPointerDown={() => prefetchTabData(tabItem.key)}
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
          {!showLegacyModeToggle && activeTab === 'quotes' ? (
            <div className={legacy.tabsPill} role="group" aria-label="Quote view">
              {(['edit', 'preview'] as const).map((value) => {
                const active = quoteView === value;
                const disabled = value === 'preview' && !hasSelectedQuote;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => updateParams({ tab: 'quotes', quotePreview: value === 'preview' })}
                    className={`${legacy.tabButton} ${active ? legacy.tabButtonActive : ''}`}
                    aria-pressed={active}
                    disabled={disabled}
                    title={disabled ? 'Select a quote to preview' : undefined}
                  >
                    {value === 'preview' ? 'Preview' : 'Edit'}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      <div
        className={`${legacy.sectionBody} ${activeTab === 'estimates' ? layout.sectionBodyWorkspace : ''}`}
        data-project-tab-body={activeTab}
      >
        {activeTab === 'activity' ? (
          snapshotContentReady ? (
            <ActivityTab snapshot={snapshot} />
          ) : (
            <ProjectSnapshotTabStatus snapshotState={snapshotState} label="activity" />
          )
        ) : null}
        {activeTab === 'details' ? <LazyProjectDetailsSidebar project={snapshot.project} /> : null}
        {activeTab === 'emails' ? (
          snapshotContentReady ? (
            <EmailsTab projectId={snapshot.project.id} emails={snapshot.emails} />
          ) : (
            <ProjectSnapshotTabStatus snapshotState={snapshotState} label="emails" />
          )
        ) : null}
        {activeTab === 'estimates' ? (
          <EstimatesTab projectId={snapshot.project.id} projectSnapshot={snapshot} />
        ) : null}
        {activeTab === 'invoices' ? <InvoicesTab projectId={snapshot.project.id} /> : null}
        {activeTab === 'quotes' ? (
          <QuotesTab
            projectId={snapshot.project.id}
            selectedQuoteId={selectedQuoteId}
            onSelectedQuoteChange={setSelectedQuoteId}
          />
        ) : null}
        {activeTab === 'job-packs' ? <JobPacksTab projectId={snapshot.project.id} /> : null}
      </div>
    </section>
  );
}
