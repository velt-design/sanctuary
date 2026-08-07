'use client';

import { useCallback, useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import SpreadsheetPageTemplate from '@/components/spreadsheet/SpreadsheetPageTemplate';
import styles from './JobPacksTab.module.css';
import {
  Badge,
  DataStatePanel,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/foundation';
import { formatPortalDate } from '@/lib/format/portalDateTime';
import { estimateDetailQueryOptions } from '@/lib/queries/projectEstimates';
import { generatedJobPacksByProjectQueryOptions } from '@/lib/queries/jobPacks';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import { coerceJobPackSheet, useJobPackSpreadsheetAdapter, type JobPackSheetKey } from './useJobPackSpreadsheetAdapter';
import { usePortalRouteTransition } from '@/components/page-state/PortalRouteTransition';
import JobPackDetailPendingFrame from './JobPackDetailPendingFrame';
import JobPacksPendingFrame from './JobPacksPendingFrame';

function formatDate(value: string | null | undefined): string {
  return formatPortalDate(value, { fallback: '-' });
}

export default function JobPacksTab({ projectId }: { projectId: string }) {
  const { navigateRoute } = usePortalRouteTransition();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const hostKey = useMemo(() => supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown', []);
  const [showNotesColumn, setShowNotesColumn] = useState(false);

  const selectedEstimateId = useMemo(() => {
    const raw = searchParams.get('estimateId') ?? '';
    return raw.trim() || null;
  }, [searchParams]);

  const sheet = useMemo(() => coerceJobPackSheet(searchParams.get('sheet')), [searchParams]);

  const jobPacksQuery = useQuery(generatedJobPacksByProjectQueryOptions(hostKey, projectId));
  const selectedDetailQuery = useQuery({
    ...estimateDetailQueryOptions(hostKey, selectedEstimateId ?? ''),
    enabled: Boolean(selectedEstimateId),
  });

  const selectedDetail = selectedDetailQuery.data ?? null;

  const updateParams = useCallback(
    (next: {
      estimateId?: string | null;
      sheet?: JobPackSheetKey | null;
      tab?: 'job-packs' | 'estimates' | 'quotes' | 'invoices' | 'emails';
    }) => {
      const qs = new URLSearchParams(searchParams.toString());
      const nextTab = next.tab ?? 'job-packs';
      qs.set('tab', nextTab);
      qs.delete('quotePreview');

      if (Object.prototype.hasOwnProperty.call(next, 'estimateId')) {
        if (next.estimateId) qs.set('estimateId', next.estimateId);
        else qs.delete('estimateId');
      }

      if (Object.prototype.hasOwnProperty.call(next, 'sheet')) {
        if (next.sheet) qs.set('sheet', next.sheet);
        else qs.delete('sheet');
      } else if (nextTab !== 'job-packs') {
        qs.delete('sheet');
      }

      qs.delete('mode');

      const query = qs.toString();
      navigateRoute(
        {
          href: `${pathname}${query ? `?${query}` : ''}`,
          label: nextTab === 'job-packs' ? 'Job packs' : 'Calculator',
          source: 'project-job-pack',
        },
        { replace: true, scroll: false },
      );
    },
    [navigateRoute, pathname, searchParams],
  );

  const handleBackToList = useCallback(() => {
    updateParams({ estimateId: null, sheet: null });
  }, [updateParams]);

  const handleSheetChange = useCallback(
    (nextSheet: JobPackSheetKey) => {
      updateParams({ sheet: nextSheet });
    },
    [updateParams],
  );

  const handleOpenEstimate = useCallback(() => {
    if (!selectedEstimateId) return;
    updateParams({ tab: 'estimates', estimateId: selectedEstimateId, sheet: null });
  }, [selectedEstimateId, updateParams]);

  const adapter = useJobPackSpreadsheetAdapter({
    hostKey,
    detail: selectedDetail,
    sheet,
    onSheetChange: handleSheetChange,
    onBackToList: handleBackToList,
    onOpenEstimate: handleOpenEstimate,
    showNotesColumn,
    onShowNotesColumnChange: setShowNotesColumn,
  });

  const prefetchDetail = useCallback(
    (estimateId: string) => {
      void queryClient.prefetchQuery(estimateDetailQueryOptions(hostKey, estimateId));
    },
    [hostKey, queryClient],
  );

  if (selectedEstimateId) {
    return (
      <div className={styles.wrapper}>
        {selectedDetailQuery.isLoading ? (
          <JobPackDetailPendingFrame sheet={sheet} onBack={handleBackToList} />
        ) : selectedDetailQuery.isError ? (
          <DataStatePanel
            state="error"
            title="Job pack unavailable"
            description={selectedDetailQuery.error instanceof Error ? selectedDetailQuery.error.message : 'Failed to load this job pack.'}
            onRetry={() => void selectedDetailQuery.refetch()}
          />
        ) : !adapter ? (
          <DataStatePanel
            state="unavailable"
            title="Workbook unavailable"
            description="This estimate snapshot is missing the data needed to render the spreadsheet view."
          />
        ) : (
          <div className={styles.sheetWrap}>
            <SpreadsheetPageTemplate adapter={adapter} embedded zoomDockPlacement="viewport" />
          </div>
        )}
      </div>
    );
  }

  if (jobPacksQuery.isLoading) {
    return <JobPacksPendingFrame />;
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>Job Packs</h3>
          <p className={styles.subtitle}>Open an estimate version to view its job pack in the shared spreadsheet template.</p>
        </div>
      </div>

      {jobPacksQuery.isError ? (
        <DataStatePanel
          state="error"
          title="Could not load job packs"
          description={jobPacksQuery.error instanceof Error ? jobPacksQuery.error.message : 'Failed to load job packs.'}
          onRetry={() => void jobPacksQuery.refetch()}
        />
      ) : null}

      {!jobPacksQuery.isLoading && !jobPacksQuery.isError && !(jobPacksQuery.data?.length ?? 0) ? (
        <DataStatePanel
          state="empty"
          title="No job packs yet"
          description="Send a quote, then generate a job pack from that quote to see it here."
        />
      ) : null}

      {jobPacksQuery.data?.length ? (
        <Table aria-label="Job packs">
            <TableHeader>
              <TableRow>
                <TableHead>Design</TableHead>
                <TableHead>Quote</TableHead>
                <TableHead>Generated</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobPacksQuery.data.map((jobPack) => (
                <TableRow
                  key={jobPack.id}
                  className={styles.rowClickable}
                  tabIndex={0}
                  onMouseEnter={() => prefetchDetail(jobPack.estimateId)}
                  onFocus={() => prefetchDetail(jobPack.estimateId)}
                  onClick={() => updateParams({ estimateId: jobPack.estimateId, sheet: 'materials' })}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    updateParams({ estimateId: jobPack.estimateId, sheet: 'materials' });
                  }}
                >
                  <TableCell>{jobPack.estimateVersionLabel}</TableCell>
                  <TableCell>{`${jobPack.quoteRef} • V${jobPack.quoteVersionNumber}`}</TableCell>
                  <TableCell>{formatDate(jobPack.createdAt)}</TableCell>
                  <TableCell><Badge tone={jobPack.quoteStatus === 'DECLINED' ? 'neutral' : 'info'}>{jobPack.quoteStatus}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
        </Table>
      ) : null}
    </div>
  );
}
