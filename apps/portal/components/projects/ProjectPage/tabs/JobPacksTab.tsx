'use client';

import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import SpreadsheetPageTemplate from '@/components/spreadsheet/SpreadsheetPageTemplate';
import styles from './JobPacksTab.module.css';
import JobPacksListSurface, { type JobPacksListEvidence } from './JobPacksListSurface';
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
import { useProjectCommercialContext } from '../ProjectCommercialContext';
import {ApiError} from '@/lib/repo/apiClient';
import { formatPortalDate } from '@/lib/format/portalDateTime';
import { estimateDetailQueryOptions } from '@/lib/queries/projectEstimates';
import { generatedJobPacksByProjectQueryOptions } from '@/lib/queries/jobPacks';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import { coerceJobPackSheet, useJobPackSpreadsheetAdapter, type JobPackSheetKey } from './useJobPackSpreadsheetAdapter';

function formatDate(value: string | null | undefined): string {
  return formatPortalDate(value, { fallback: '-' });
}

export default function JobPacksTab({ projectId, readOnly = false, publishList }: { projectId: string; readOnly?: boolean; publishList?: (value: JobPacksListEvidence | null) => void }) {
  const commercial = useProjectCommercialContext();
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

  const jobPacksQuery = useQuery(generatedJobPacksByProjectQueryOptions(hostKey, projectId));
  const selectedDetailQuery = useQuery({
    ...estimateDetailQueryOptions(hostKey, selectedEstimateId ?? ''),
    enabled: Boolean(selectedEstimateId),
  });

  const listDenied=jobPacksQuery.error instanceof ApiError&&[401,403,404].includes(jobPacksQuery.error.status);
  const jobPacks=listDenied?[]:jobPacksQuery.data;
  const candidate=selectedDetailQuery.data;
  const denied=selectedDetailQuery.error instanceof ApiError&&[401,403,404].includes(selectedDetailQuery.error.status);
  const selectedDetail = !denied&&candidate?.id===selectedEstimateId&&candidate.projectId===projectId?candidate:null;

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
    readOnly: readOnly || !commercial.ready,
    hostKey,
    onRetry:()=>{if(!selectedDetailQuery.isFetching)void selectedDetailQuery.refetch();},detail: selectedDetail,pending:selectedDetailQuery.isPending||(!selectedDetail&&selectedDetailQuery.isFetching),error:selectedDetailQuery.isError&&!selectedDetailQuery.isFetching?'Job pack unavailable. Retry the read.':null,refreshing:selectedDetailQuery.isFetching,
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

  const listEvidence = useMemo<JobPacksListEvidence>(() => ({ status: <>      {jobPacksQuery.isError ? (
        <DataStatePanel
          state="error"
          title="Could not load job packs"
          description={jobPacksQuery.error instanceof Error ? jobPacksQuery.error.message : 'Failed to load job packs.'}
          onRetry={() => void jobPacksQuery.refetch()}
        />
      ) : null}

      {!jobPacksQuery.isLoading && !jobPacksQuery.isError && !(jobPacks?.length ?? 0) ? (
        <DataStatePanel
          state="empty"
          title="No job packs yet"
          description="Send a quote, then generate a job pack from that quote to see it here."
        />
      ) : null}

</>, rows: <>{jobPacksQuery.isPending&&<TableRow><TableCell colSpan={5}><span role="status">Reading job packs…</span></TableCell></TableRow>}
              {jobPacksQuery.isError&&!(jobPacks?.length??0)&&<TableRow><TableCell colSpan={5}>Job packs unavailable.</TableCell></TableRow>}
              {jobPacks?.map((jobPack) => (
                <TableRow
                  key={jobPack.id}
                  className={styles.rowClickable}
                  tabIndex={0}
                  aria-label={`Open job pack ${jobPack.estimateVersionLabel}, ${jobPack.quoteRef}`}
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
                  <TableCell data-label="Quote">{`${jobPack.quoteRef} • V${jobPack.quoteVersionNumber}`}</TableCell>
                  <TableCell data-label="Generated">{formatDate(jobPack.createdAt)}</TableCell>
                  <TableCell data-label="Quote status"><Badge tone={jobPack.quoteStatus === 'DECLINED' ? 'neutral' : 'info'}>{jobPack.quoteStatus}</Badge></TableCell><TableCell><span className={styles.openPack}>Open pack →</span></TableCell>
                </TableRow>
              ))}</> }), [jobPacksQuery, jobPacks, prefetchDetail, updateParams]);
  useLayoutEffect(() => { publishList?.(selectedEstimateId ? null : listEvidence); }, [publishList, selectedEstimateId, listEvidence]);
  useLayoutEffect(() => () => publishList?.(null), [publishList]);

  if (selectedEstimateId) {
    return (
      <div className={styles.wrapper}>
        {selectedDetailQuery.isError&&!selectedDetailQuery.isFetching&&<DataStatePanel state="error" title="Job pack unavailable" description="Retry the verified source read." onRetry={()=>{if(!selectedDetailQuery.isFetching)void selectedDetailQuery.refetch();}}/>}
        <div className={styles.sheetWrap}>{adapter&&<SpreadsheetPageTemplate adapter={adapter} embedded zoomDockPlacement="viewport" />}</div>
      </div>
    );
  }

  return publishList ? null : <JobPacksListSurface evidence={listEvidence} />;
}
