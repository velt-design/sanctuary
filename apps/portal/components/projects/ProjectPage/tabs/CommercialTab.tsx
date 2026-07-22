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

type CommercialView = 'quotes' | 'invoices';
type QuoteView = 'edit' | 'preview';

const loadQuotesTab = () => import('./QuotesTab');
const loadInvoicesTab = () => import('./InvoicesTab');
const QuotesTab = dynamic(loadQuotesTab, {
  loading: () => <LoadingSkeleton rows={4} columns={5} label="Loading quotes" />,
});
const InvoicesTab = dynamic(loadInvoicesTab, {
  loading: () => <LoadingSkeleton rows={4} columns={6} label="Loading invoices" />,
});

export default function CommercialTab({
  host,
  projectId,
  view,
}: {
  host: string;
  projectId: string;
  view: CommercialView;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const quoteView: QuoteView = searchParams.get('quotePreview') === '1' ? 'preview' : 'edit';
  const quoteIdFromUrl = useMemo(() => searchParams.get('quoteId')?.trim() || null, [searchParams]);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(quoteIdFromUrl);
  const [optimisticView, setOptimisticView] = useState<CommercialView | null>(null);
  const activeView = optimisticView ?? view;

  useEffect(() => {
    if (quoteIdFromUrl) setSelectedQuoteId(quoteIdFromUrl);
  }, [quoteIdFromUrl]);

  useEffect(() => {
    setOptimisticView(null);
  }, [view]);

  const replaceParams = (update: (query: URLSearchParams) => void) => {
    const query = new URLSearchParams(searchParams.toString());
    update(query);
    router.replace(`${pathname}?${query.toString()}`);
  };

  const setView = (nextView: CommercialView) => {
    setOptimisticView(nextView);
    replaceParams((query) => {
      query.set('tab', nextView);
      if (nextView === 'invoices') query.delete('quotePreview');
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
    if (nextView === 'quotes') {
      void loadQuotesTab();
      void Promise.all([
        queryClient.prefetchQuery(estimateMetasByProjectQueryOptions(host, projectId)),
        queryClient.prefetchQuery(quoteVersionsByProjectQueryOptions(host, projectId)),
      ]);
      return;
    }
    void loadInvoicesTab();
    void queryClient.prefetchQuery(depositInvoicesByProjectQueryOptions(host, projectId));
  };

  return (
    <div className={styles.container} data-project-commercial-view={activeView}>
      <div className={styles.toolbar}>
        <TabNavigation
          items={[
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
      </div>

      {activeView === 'quotes' ? (
        <QuotesTab
          projectId={projectId}
          selectedQuoteId={selectedQuoteId}
          onSelectedQuoteChange={setSelectedQuoteId}
        />
      ) : (
        <InvoicesTab projectId={projectId} />
      )}
    </div>
  );
}
