'use client';

import { useLayoutEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import StaffPageHeader from '@/components/layout/StaffPageHeader';
import PaginatedProjectWorkQueueList from '@/components/projects/workQueue/PaginatedProjectWorkQueueList.client';
import type { WorkQueueEntryView } from '@/components/projects/workQueue/workQueuePresentation';
import {
  AlertBanner,
  AlertActionButton,
  DataStatePanel,
  PageLayout,
} from '@/components/ui/foundation';
import { fetchProjectStaffDirectory } from '@/lib/projects/commandCentre/client';
import { isProjectWorkUnavailableError } from '@/lib/projects/workItems/client';
import { ApiError } from '@/lib/repo/apiClient';
import { qk } from '@/lib/queries/keys';
import { projectWorkQueueQueryOptions } from '@/lib/queries/projectWorkQueue';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import WorkQueueFrame from './WorkQueueFrame';
import styles from './workQueuePage.module.css';
import {useWorkQueueWorkspace} from './WorkQueueWorkspace';
import InactiveEnquiryReview from './InactiveEnquiryReview.client';

function isAccessEndingError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

export default function WorkQueueClient({
  canReviewInactiveEnquiries = false,queueLoader,staffLoader,readOnly=false,
}: {
  canReviewInactiveEnquiries?: boolean;
  queueLoader?:()=>Promise<import('@/lib/queries/projectWorkQueue').ProjectWorkQueueResponse>;
  staffLoader?:typeof fetchProjectStaffDirectory;readOnly?:boolean;
}) {
  const workspace=useWorkQueueWorkspace();
  const host = useMemo(
    () => supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown',
    [],
  );
  const queue = useQuery({
    ...projectWorkQueueQueryOptions(host),...(queueLoader?{queryFn:queueLoader}:{}),
    refetchOnMount: 'always',
    retry: (failureCount, error) => (
      !isAccessEndingError(error)
      && !isProjectWorkUnavailableError(error)
      && failureCount < 2
    ),
  });
  const staffQuery = useQuery({
    queryKey: qk.staff.directory(host),
    queryFn: staffLoader??fetchProjectStaffDirectory,
    staleTime: 5 * 60 * 1_000,
    retry: 1,
  });

  const unavailable = isAccessEndingError(queue.error);
  const notReady = isProjectWorkUnavailableError(queue.error);
  const entries = unavailable || notReady
    ? []
    : (queue.data?.entries ?? []) as WorkQueueEntryView[];
  const state = unavailable
    ? 'unavailable'
    : notReady
      ? 'not-ready'
    : queue.error
      ? queue.data
        ? 'refresh-failed'
        : 'error'
      : !queue.data
        ? 'pending'
        : queue.isFetching
          ? 'cached'
          : 'fresh';

  const page={state,count:queue.data&&!notReady&&!unavailable?`${entries.length} projects`:undefined,
    noticeTitle:state==='refresh-failed'?'Queue refresh failed':staffQuery.error?'Staff names unavailable':state==='cached'?'Updating the queue…':undefined,
    retry:()=>{void queue.refetch();},
    admin:!readOnly&&canReviewInactiveEnquiries?<InactiveEnquiryReview host={host}/>:null,
    notices:<>      {state === 'cached' ? (
        <div className={styles.refreshing} role="status">Updating the queue...</div>
      ) : null}
      {state === 'refresh-failed' ? (
        <AlertBanner
          tone="warning"
          title="Could not refresh the queue"
          action={(
            <AlertActionButton onClick={() => void queue.refetch()}>Retry</AlertActionButton>
          )}
        >
          The last confirmed queue is still shown.
        </AlertBanner>
      ) : null}
      {staffQuery.error ? (
        <AlertBanner tone="info" title="Staff names unavailable">
          Assignments remain intact. Some owners are shown generically until the directory refreshes.
        </AlertBanner>
      ) : null}

</>};
  useLayoutEffect(()=>{workspace?.publishPage(page);});
  useLayoutEffect(()=>()=>workspace?.publishPage(null),[workspace?.publishPage]);
  const content=(      <PaginatedProjectWorkQueueList
        entries={entries} staff={staffQuery.data??[]} host={host}
        mutationsEnabled={!readOnly&&state==='fresh'} reassignmentEnabled={!readOnly&&staffQuery.isSuccess}
        pending={state==='pending'}
        statusPanel={state==='not-ready'?<DataStatePanel state="unavailable" title="Work Queue not ready" description="Project Work is not available in this environment. No unconfirmed work is shown." onRetry={()=>void queue.refetch()}/>:state==='error'||state==='unavailable'?<DataStatePanel state={state==='unavailable'?'unavailable':'error'} onRetry={state==='error'?()=>void queue.refetch():undefined}/>:undefined}
      />
);
  return workspace?content:<WorkQueueFrame {...page}>{content}</WorkQueueFrame>;
}
