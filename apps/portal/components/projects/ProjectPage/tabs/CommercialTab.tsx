'use client';

import dynamic from 'next/dynamic';
import EstimatesTab from './ProjectCalculatorTab';
import type { ProjectSnapshotLoadState } from '@/lib/projects/types';
import { Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { depositInvoicesByProjectQueryOptions } from '@/lib/queries/invoices';
import { estimateMetasByProjectQueryOptions } from '@/lib/queries/projectEstimates';
import { quoteVersionsByProjectQueryOptions } from '@/lib/queries/quotes';
import { Button, TabNavigation } from '@/components/ui/foundation';
import styles from './CommercialTab.module.css';
import { selectProjectView, updateProjectView } from '../projectViewNavigation';
import { CommercialProjectNotice } from '../ProjectCommercialContext';

type CommercialView = 'estimates' | 'quotes' | 'invoices';
type QuoteView = 'edit' | 'preview';

const loadQuotesTab = () => import('./QuotesTab');
const loadInvoicesTab = () => import('./InvoicesTab');
const QuotesTab = dynamic(loadQuotesTab);
const InvoicesTab = dynamic(loadInvoicesTab);

export function preloadCommercialViewModule(view: CommercialView): Promise<unknown> {
  if (view === 'estimates') return Promise.resolve();
  if (view === 'quotes') return loadQuotesTab();
  return loadInvoicesTab();
}

export default function CommercialTab({
  host,
  projectReady = true,
  projectState = "pending",
  readOnly = false,
  projectId,
  projectName = 'Project estimate',
  view,
  optimisticView,
  onViewSelect,
  calculatorWorkspace = false,
  statusPanel,
}: {
  host: string;
  projectReady?: boolean;
  projectState?: ProjectSnapshotLoadState;
  readOnly?: boolean;
  projectId: string;
  projectName?: string;
  view: CommercialView;
  optimisticView?: CommercialView | null;
  onViewSelect?: (view: CommercialView) => void;
  calculatorWorkspace?: boolean;
  statusPanel?: ReactNode;
}) {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const quoteView: QuoteView = searchParams.get('quotePreview') === '1' ? 'preview' : 'edit';
  const viewFromUrl = searchParams.get('tab');
  const canonicalView: CommercialView = viewFromUrl === 'estimates'
    || viewFromUrl === 'quotes'
    || viewFromUrl === 'invoices'
    ? viewFromUrl
    : view;
  const quoteIdFromUrl = useMemo(() => searchParams.get('quoteId')?.trim() || null, [searchParams]);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(quoteIdFromUrl);
  const activeView = optimisticView ?? canonicalView;

  useEffect(() => {
    setSelectedQuoteId(quoteIdFromUrl);
  }, [quoteIdFromUrl]);

  const setView = (nextView: CommercialView) => {
    if (!selectProjectView(nextView)) return;
    // Reuse the page intent owner above lazy bodies after the existing draft guard.
    onViewSelect?.(nextView);
    setSelectedQuoteId(null);
  };

  const setQuotePreview = (preview: boolean) => {
    updateProjectView((query) => {
      query.set('tab', 'quotes');
      if (preview) query.set('quotePreview', '1');
      else query.delete('quotePreview');
      query.delete('mode');
    });
  };

  const preload = (nextView: CommercialView) => {
    void preloadCommercialViewModule(nextView);
    if (nextView === 'estimates') {
      void queryClient.prefetchQuery(estimateMetasByProjectQueryOptions(host, projectId));
      return;
    }
    if (nextView === 'quotes') {
      void Promise.all([
        queryClient.prefetchQuery(estimateMetasByProjectQueryOptions(host, projectId)),
        queryClient.prefetchQuery(quoteVersionsByProjectQueryOptions(host, projectId)),
      ]);
      return;
    }
    void queryClient.prefetchQuery(depositInvoicesByProjectQueryOptions(host, projectId));
  };

  return (
    <div
      className={`${styles.container} ${calculatorWorkspace ? styles.containerCalculatorWorkspace : ''}`}
      data-project-commercial-view={activeView}
      data-commercial-calculator-workspace={calculatorWorkspace ? "true" : undefined}
    >
      {!calculatorWorkspace ? <div className={styles.toolbar}>
        <TabNavigation
          items={[
            { key: 'estimates', label: 'Estimates' },
            { key: 'quotes', label: 'Quotes' },
            { key: 'invoices', label: 'Invoices' },
          ]}
          selectedKey={activeView}
          onSelect={setView}
          onIntent={preload}
          ariaLabel="Commercial sections"
        />

        {activeView === 'quotes' && selectedQuoteId ? (
          <div className={styles.quoteViews} role="group" aria-label="Quote view">
            {(['edit', 'preview'] as const).map((value) => {
              const disabled = value === 'preview' && !selectedQuoteId;
              return (
                <Button
                  key={value}
                  type="button"
                  variant={quoteView === value ? 'secondary' : 'quiet'}
                  size="small"
                  aria-pressed={quoteView === value}
                  disabled={disabled}
                  title={disabled ? 'Select a quote to preview' : undefined}
                  onClick={() => setQuotePreview(value === 'preview')}
                >
                  {value === 'preview' ? 'Preview' : 'Details'}
                </Button>
              );
            })}
          </div>
        ) : null}
      </div> : null}

      {statusPanel}
      <CommercialProjectNotice projectId={projectId} view={activeView} />
      <Suspense key={activeView} fallback={<p role="status" data-commercial-code-pending={activeView}>Preparing {activeView} tools...</p>}>
      <div inert={readOnly && projectReady} style={{ display: 'contents' }}>
      {!projectReady ? <p role={projectState === "pending" || projectState === "summary" ? "status" : undefined}>{projectState === "pending" || projectState === "summary" ? "Reading project details…" : "Project details unavailable. Retry the project read above."}</p> : null}
      {activeView === 'estimates' ? (
        <EstimatesTab key={projectId} host={host} projectId={projectId} projectName={projectReady ? projectName : undefined} projectReady={projectReady} />
      ) : activeView === 'quotes' ? (
        <QuotesTab
          key={projectId}
          projectId={projectId}
          selectedQuoteId={selectedQuoteId}
          onSelectedQuoteChange={setSelectedQuoteId}
        />
      ) : (
        <InvoicesTab key={projectId} projectId={projectId} />
      )}</div>
      </Suspense>
    </div>
  );
}
