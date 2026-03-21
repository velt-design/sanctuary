'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import EmailsTab from './tabs/EmailsTab';
import EstimatesTab from './tabs/EstimatesTab';
import JobPacksTab from './tabs/JobPacksTab';
import PlaceholderTab from './tabs/PlaceholderTab';
import QuotesTab from './tabs/QuotesTab';
import type { ProjectPageSnapshot } from '@/lib/projects/types';
import legacy from '@/app/staff/projects/projects.module.css';
import layout from './ProjectPage.module.css';
import { estimateMetasByProjectQueryOptions } from '@/lib/queries/projectEstimates';
import { quoteVersionsByProjectQueryOptions } from '@/lib/queries/quotes';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';

const BASE_TABS = [
  { key: 'estimates', label: 'Designs' },
  { key: 'quotes', label: 'Quotes' },
  { key: 'job-packs', label: 'Job Packs' },
  { key: 'emails', label: 'Emails' },
  { key: 'files', label: 'Files' },
] as const;

type TabKey = (typeof BASE_TABS)[number]['key'];
type QuoteViewKey = 'edit' | 'preview';

function coerceTab(value: string | undefined, allowedTabs: readonly { key: TabKey; label: string }[]): TabKey {
  return (allowedTabs.find((t) => t.key === value)?.key ?? 'estimates') as TabKey;
}

export default function ProjectMainTabs({
  snapshot,
  tab,
  onActiveTabChange,
}: {
  snapshot: ProjectPageSnapshot;
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
    () => BASE_TABS.filter((tabItem) => tabItem.key !== 'job-packs' || snapshot.project.hasJobPacks),
    [snapshot.project.hasJobPacks],
  );
  const tabFromUrl = useMemo(() => coerceTab(searchParams.get('tab') ?? tab, availableTabs), [availableTabs, searchParams, tab]);
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

  const prefetchTabData = (tabKey: TabKey) => {
    if (tabKey === 'estimates') {
      void queryClient.prefetchQuery(estimateMetasByProjectQueryOptions(hostKey, projectId));
      return;
    }
    if (tabKey === 'quotes') {
      void queryClient.prefetchQuery(estimateMetasByProjectQueryOptions(hostKey, projectId));
      void queryClient.prefetchQuery(quoteVersionsByProjectQueryOptions(hostKey, projectId));
      return;
    }
    if (tabKey === 'job-packs') {
      void queryClient.prefetchQuery(estimateMetasByProjectQueryOptions(hostKey, projectId));
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
        {activeTab === 'emails' ? <EmailsTab projectId={snapshot.project.id} emails={snapshot.emails} /> : null}
        {activeTab === 'estimates' ? (
          <EstimatesTab projectId={snapshot.project.id} projectSnapshot={snapshot} />
        ) : null}
        {activeTab === 'quotes' ? (
          <QuotesTab
            projectId={snapshot.project.id}
            selectedQuoteId={selectedQuoteId}
            onSelectedQuoteChange={setSelectedQuoteId}
          />
        ) : null}
        {activeTab === 'job-packs' ? <JobPacksTab projectId={snapshot.project.id} /> : null}
        {activeTab === 'files' ? (
          <PlaceholderTab title="Files" description="Upload and manage project files once storage is wired up." />
        ) : null}
      </div>
    </section>
  );
}
