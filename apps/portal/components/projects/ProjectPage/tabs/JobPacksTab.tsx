'use client';

import { useCallback, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import SpreadsheetPageTemplate from '@/components/spreadsheet/SpreadsheetPageTemplate';
import legacy from '@/app/staff/projects/projects.module.css';
import styles from './JobPacksTab.module.css';
import { estimateDetailQueryOptions, estimateMetasByProjectQueryOptions } from '@/lib/queries/projectEstimates';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import { coerceJobPackSheet, useJobPackSpreadsheetAdapter, type JobPackSheetKey } from './useJobPackSpreadsheetAdapter';

function formatMoney(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  return `$${value.toFixed(2)}`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function statusLabel(status: string): string {
  return status === 'archived' ? 'Archived' : 'Draft';
}

function statusClass(status: string): string {
  return status === 'archived' ? styles.statusArchived : styles.statusDraft;
}

export default function JobPacksTab({ projectId }: { projectId: string }) {
  const router = useRouter();
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

  const estimatesQuery = useQuery(estimateMetasByProjectQueryOptions(hostKey, projectId));
  const selectedDetailQuery = useQuery({
    ...estimateDetailQueryOptions(hostKey, selectedEstimateId ?? ''),
    enabled: Boolean(selectedEstimateId),
  });

  const selectedDetail = selectedDetailQuery.data ?? null;

  const updateParams = useCallback(
    (next: {
      estimateId?: string | null;
      sheet?: JobPackSheetKey | null;
      tab?: 'job-packs' | 'estimates' | 'quotes' | 'emails' | 'files';
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
      router.replace(`${pathname}${query ? `?${query}` : ''}`);
    },
    [pathname, router, searchParams],
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
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>Loading job pack</p>
            <p>Fetching the estimate snapshot and building the workbook.</p>
          </div>
        ) : selectedDetailQuery.isError ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>Job pack unavailable</p>
            <p>{selectedDetailQuery.error instanceof Error ? selectedDetailQuery.error.message : 'Failed to load this job pack.'}</p>
          </div>
        ) : !adapter ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>Workbook unavailable</p>
            <p>This estimate snapshot is missing the data needed to render the spreadsheet view.</p>
          </div>
        ) : (
          <div className={styles.sheetWrap}>
            <SpreadsheetPageTemplate adapter={adapter} embedded zoomDockPlacement="viewport" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div>
          <h3 className={styles.title}>Job Packs</h3>
          <p className={styles.subtitle}>Open an estimate version to view its job pack in the shared spreadsheet template.</p>
        </div>
      </div>

      {estimatesQuery.isLoading ? <p className={legacy.note}>Loading job packs...</p> : null}
      {estimatesQuery.isError ? (
        <p className={legacy.error}>{estimatesQuery.error instanceof Error ? estimatesQuery.error.message : 'Failed to load job packs.'}</p>
      ) : null}

      {!estimatesQuery.isLoading && !estimatesQuery.isError && !(estimatesQuery.data?.length ?? 0) ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>No job packs yet</p>
          <p>Create an estimate first, then open its job pack from here.</p>
        </div>
      ) : null}

      {estimatesQuery.data?.length ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Version</th>
                <th>Created</th>
                <th>Status</th>
                <th>Estimate total</th>
                <th>True cost</th>
              </tr>
            </thead>
            <tbody>
              {estimatesQuery.data.map((estimate) => (
                <tr
                  key={estimate.id}
                  className={styles.rowClickable}
                  tabIndex={0}
                  onMouseEnter={() => prefetchDetail(estimate.id)}
                  onFocus={() => prefetchDetail(estimate.id)}
                  onClick={() => updateParams({ estimateId: estimate.id, sheet: 'materials' })}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    updateParams({ estimateId: estimate.id, sheet: 'materials' });
                  }}
                >
                  <td>{estimate.versionLabel}</td>
                  <td>{formatDate(estimate.createdAt)}</td>
                  <td>
                    <span className={`${styles.statusPill} ${statusClass(estimate.status)}`}>{statusLabel(estimate.status)}</span>
                  </td>
                  <td>{formatMoney(estimate.summary.total ?? null)}</td>
                  <td>{formatMoney(estimate.summary.cost ?? null)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
