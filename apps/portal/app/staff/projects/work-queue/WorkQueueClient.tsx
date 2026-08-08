'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePortalSession } from '@/components/auth/PortalAuthProvider';
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
import styles from './workQueuePage.module.css';
import InactiveEnquiryReview from './InactiveEnquiryReview.client';
import { WorkQueuePendingBody } from './WorkQueuePendingFrame';

function isAccessEndingError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

const subscribeToHydration = () => () => undefined;
const hydratedBrowserSnapshot = () => true;
const pendingServerSnapshot = () => false;

export default function WorkQueueClient() {
  const { role } = usePortalSession();
  const canReviewInactiveEnquiries = role === 'admin';
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    hydratedBrowserSnapshot,
    pendingServerSnapshot,
  );
  const host = useMemo(
    () => supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown',
    [],
  );
  const queue = useQuery({
    ...projectWorkQueueQueryOptions(host),
    retry: (failureCount, error) => (
      !isAccessEndingError(error)
      && !isProjectWorkUnavailableError(error)
      && failureCount < 2
    ),
  });
  const staffQuery = useQuery({
    queryKey: qk.staff.directory(host),
    queryFn: fetchProjectStaffDirectory,
    staleTime: 5 * 60 * 1_000,
    retry: 1,
  });

  const unavailable = isAccessEndingError(queue.error);
  const notReady = isProjectWorkUnavailableError(queue.error);
  const entries = unavailable || notReady || !hydrated
    ? []
    : (queue.data?.entries ?? []) as WorkQueueEntryView[];
  const state = !hydrated
    ? 'pending'
    : unavailable
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

  return (
    <PageLayout
      width="full"
      density="compact"
      className={styles.page}
      data-portal-page-shell="work-queue"
      data-portal-page-shell-ready="true"
      data-project-work-queue-state={state}
      data-project-work-queue-background-ready={state === 'fresh' ? 'true' : 'false'}
    >
      <StaffPageHeader
        title="Work Queue"
        variant="index"
        description="One server-confirmed operational obligation per project."
        count={queue.data && !notReady ? `${entries.length} projects` : undefined}
      />

      {canReviewInactiveEnquiries ? <InactiveEnquiryReview host={host} /> : null}

      {state === 'cached' ? (
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

      {state === 'pending' ? (
        <WorkQueuePendingBody />
      ) : state === 'not-ready' ? (
        <DataStatePanel
          state="unavailable"
          title="Work Queue not ready"
          description="Project Work is not available in this environment. No unconfirmed work is shown."
          onRetry={() => void queue.refetch()}
        />
      ) : state === 'error' || state === 'unavailable' ? (
        <DataStatePanel
          state={state === 'unavailable' ? 'unavailable' : 'error'}
          onRetry={state === 'error' ? () => void queue.refetch() : undefined}
        />
      ) : (
        <PaginatedProjectWorkQueueList
          entries={entries}
          staff={staffQuery.data ?? []}
          host={host}
          mutationsEnabled={state === 'fresh'}
          reassignmentEnabled={staffQuery.isSuccess}
        />
      )}
    </PageLayout>
  );
}
