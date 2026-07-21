'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { ProjectPageSnapshot, ProjectSnapshotLoadState } from '@/lib/projects/types';
import { coerceProjectTab } from '@/lib/projects/projectTabs';
import legacy from '@/app/staff/projects/projects.module.css';
import layout from './ProjectPage.module.css';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import {
  OverviewTab,
  EmailsTab,
  EstimatesTab,
  InvoicesTab,
  JobPacksTab,
  QuotesTab,
} from './projectTabModules';

type QuoteViewKey = 'edit' | 'preview';

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
        ? `Couldn't refresh ${label}. The project summary is still available.`
        : `Updating ${label} in the background...`}
    </div>
  );
}

export default function ProjectMainTabs({
  snapshot,
  snapshotContentReady = true,
  snapshotState = 'fresh',
  tab,
  onProjectAccessEnding,
}: {
  snapshot: ProjectPageSnapshot;
  snapshotContentReady?: boolean;
  snapshotState?: ProjectSnapshotLoadState;
  tab: string;
  onProjectAccessEnding?: (status: number) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const host = useMemo(() => supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown', []);
  const requestedTab = searchParams.get('tab') ?? tab;
  const activeTab = coerceProjectTab(requestedTab, Boolean(snapshot.project.hasJobPacks));
  const quoteView: QuoteViewKey = searchParams.get('quotePreview') === '1' ? 'preview' : 'edit';
  const quoteIdFromUrl = useMemo(() => {
    const raw = searchParams.get('quoteId') ?? '';
    return raw.trim() || null;
  }, [searchParams]);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(quoteIdFromUrl);
  const hasSelectedQuote = Boolean(selectedQuoteId);

  useEffect(() => {
    if (quoteIdFromUrl) setSelectedQuoteId(quoteIdFromUrl);
  }, [quoteIdFromUrl]);

  const setQuotePreview = (preview: boolean) => {
    const query = new URLSearchParams(searchParams.toString());
    query.set('tab', 'quotes');
    if (preview) query.set('quotePreview', '1');
    else query.delete('quotePreview');
    query.delete('mode');
    router.replace(`${pathname}?${query.toString()}`);
  };

  return (
    <section
      className={`${layout.projectTabSurface} ${activeTab === 'estimates' ? layout.tabSectionWorkspace : ''}`}
      aria-label="Project tab content"
      data-project-active-tab={activeTab}
    >
      {activeTab === 'quotes' ? (
        <div className={layout.projectTabToolbar}>
          <div className={legacy.tabsPill} role="group" aria-label="Quote view">
            {(['edit', 'preview'] as const).map((value) => {
              const active = quoteView === value;
              const disabled = value === 'preview' && !hasSelectedQuote;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setQuotePreview(value === 'preview')}
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
        </div>
      ) : null}

      <div
        className={`${layout.projectTabBody} ${activeTab === 'estimates' ? layout.sectionBodyWorkspace : ''}`}
        data-project-tab-body={activeTab}
      >
        {activeTab === 'activity' ? (
          <OverviewTab
            snapshot={snapshot}
            snapshotContentReady={snapshotContentReady}
            snapshotState={snapshotState}
            host={host}
            onAccessEnding={onProjectAccessEnding}
          />
        ) : null}
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
