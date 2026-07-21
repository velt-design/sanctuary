'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { depositInvoicesByProjectQueryOptions } from '@/lib/queries/invoices';
import { estimateMetasByProjectQueryOptions } from '@/lib/queries/projectEstimates';
import { quoteVersionsByProjectQueryOptions } from '@/lib/queries/quotes';
import styles from './CommercialTab.module.css';

type CommercialView = 'quotes' | 'invoices';
type QuoteView = 'edit' | 'preview';

const loadQuotesTab = () => import('./QuotesTab');
const loadInvoicesTab = () => import('./InvoicesTab');
const QuotesTab = dynamic(loadQuotesTab, {
  loading: () => <div className={styles.loading} role="status">Loading quotes…</div>,
});
const InvoicesTab = dynamic(loadInvoicesTab, {
  loading: () => <div className={styles.loading} role="status">Loading invoices…</div>,
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

  useEffect(() => {
    if (quoteIdFromUrl) setSelectedQuoteId(quoteIdFromUrl);
  }, [quoteIdFromUrl]);

  const replaceParams = (update: (query: URLSearchParams) => void) => {
    const query = new URLSearchParams(searchParams.toString());
    update(query);
    router.replace(`${pathname}?${query.toString()}`);
  };

  const setView = (nextView: CommercialView) => {
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
    <div className={styles.container} data-project-commercial-view={view}>
      <div className={styles.toolbar}>
        <div className={styles.switcher} role="tablist" aria-label="Commercial sections">
          {(['quotes', 'invoices'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={view === value}
              className={view === value ? styles.active : undefined}
              onClick={() => setView(value)}
              onFocus={() => preload(value)}
              onMouseEnter={() => preload(value)}
              onPointerDown={() => preload(value)}
            >
              {value === 'quotes' ? 'Quotes' : 'Invoices'}
            </button>
          ))}
        </div>

        {view === 'quotes' ? (
          <div className={styles.quoteViews} role="group" aria-label="Quote view">
            {(['edit', 'preview'] as const).map((value) => {
              const disabled = value === 'preview' && !selectedQuoteId;
              return (
                <button
                  key={value}
                  type="button"
                  className={quoteView === value ? styles.active : undefined}
                  aria-pressed={quoteView === value}
                  disabled={disabled}
                  title={disabled ? 'Select a quote to preview' : undefined}
                  onClick={() => setQuotePreview(value === 'preview')}
                >
                  {value === 'preview' ? 'Preview' : 'Edit'}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {view === 'quotes' ? (
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
