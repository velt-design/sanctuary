'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { depositInvoicesByProjectQueryOptions } from '@/lib/queries/invoices';
import { estimateMetasByProjectQueryOptions } from '@/lib/queries/projectEstimates';
import { quoteVersionsByProjectQueryOptions } from '@/lib/queries/quotes';
import { Button, LoadingSkeleton, TabNavigation } from '@/components/ui/foundation';
import styles from './CommercialTab.module.css';

type CommercialView = 'estimates' | 'quotes' | 'invoices';
type QuoteView = 'edit' | 'preview';

const loadEstimatesTab = () => import('./ProjectCalculatorTab');
const loadQuotesTab = () => import('./QuotesTab');
const loadInvoicesTab = () => import('./InvoicesTab');
const EstimatesTab = dynamic(loadEstimatesTab, {
  loading: () => <LoadingSkeleton rows={4} columns={5} label="Loading estimates" />,
});
const QuotesTab = dynamic(loadQuotesTab, {
  loading: () => <LoadingSkeleton rows={4} columns={5} label="Loading quotes" />,
});
const InvoicesTab = dynamic(loadInvoicesTab, {
  loading: () => <LoadingSkeleton rows={4} columns={6} label="Loading invoices" />,
});

export function preloadCommercialViewModule(view: CommercialView): Promise<unknown> {
  if (view === 'estimates') return loadEstimatesTab();
  if (view === 'quotes') return loadQuotesTab();
  return loadInvoicesTab();
}

export default function CommercialTab({
  host,
  projectId,
  projectName = 'Project estimate',
  view,
  calculatorWorkspace = false,
}: {
  host: string;
  projectId: string;
  projectName?: string;
  view: CommercialView;
  calculatorWorkspace?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
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
  const [optimisticView, setOptimisticView] = useState<CommercialView | null>(null);
  const [pendingView, setPendingView] = useState<{
    from: CommercialView;
    target: CommercialView;
  } | null>(null);
  const activeView = optimisticView ?? canonicalView;

  useEffect(() => {
    setSelectedQuoteId(quoteIdFromUrl);
  }, [quoteIdFromUrl]);

  useEffect(() => {
    if (pendingView) {
      if (canonicalView === pendingView.from) return;
      setPendingView(null);
    }
    setOptimisticView(null);
  }, [canonicalView, pendingView]);

  const replaceParams = (update: (query: URLSearchParams) => void) => {
    const query = new URLSearchParams(searchParams.toString());
    update(query);
    router.replace(`${pathname}?${query.toString()}`);
  };

  const setView = (nextView: CommercialView) => {
    setPendingView({ from: canonicalView, target: nextView });
    setOptimisticView(nextView);
    setSelectedQuoteId(null);
    replaceParams((query) => {
      query.set('tab', nextView);
      query.delete('quoteId');
      query.delete('quotePreview');
      query.delete('estimateId');
      query.delete('fromEstimateId');
      query.delete('newDesign');
      query.delete('mode');
    });
  };

  const setQuotePreview = (preview: boolean) => {
    replaceParams((query) => {
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

        {activeView === 'quotes' ? (
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
                  {value === 'preview' ? 'Preview' : 'Edit'}
                </Button>
              );
            })}
          </div>
        ) : null}
      </div> : null}

      {activeView === 'estimates' ? (
        <EstimatesTab key={projectId} host={host} projectId={projectId} projectName={projectName} />
      ) : activeView === 'quotes' ? (
        <QuotesTab
          key={projectId}
          projectId={projectId}
          selectedQuoteId={selectedQuoteId}
          onSelectedQuoteChange={setSelectedQuoteId}
        />
      ) : (
        <InvoicesTab key={projectId} projectId={projectId} />
      )}
    </div>
  );
}
