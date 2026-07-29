'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import StaffPageHeader from '@/components/layout/StaffPageHeader';
import ProjectWorkQueueList from '@/components/projects/workQueue/ProjectWorkQueueList';
import type { WorkQueueEntryView } from '@/components/projects/workQueue/workQueuePresentation';
import { usePortalSession } from '@/components/auth/PortalAuthProvider';
import {
  AlertBanner,
  AlertActionButton,
  ButtonLink,
  DataStatePanel,
  LoadingSkeleton,
  PageLayout,
} from '@/components/ui/foundation';
import { fetchProjectStaffDirectory } from '@/lib/projects/commandCentre/client';
import { ApiError } from '@/lib/repo/apiClient';
import { qk } from '@/lib/queries/keys';
import { projectWorkQueueQueryOptions } from '@/lib/queries/projectWorkQueue';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import styles from './workQueuePage.module.css';

function isAccessEndingError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

function isWorkItemsUnavailableError(error: unknown): boolean {
  if (!(error instanceof ApiError) || error.status !== 503) return false;
  const body = error.body;
  return Boolean(
    body
    && typeof body === 'object'
    && 'code' in body
    && (body as { code?: unknown }).code === 'WORK_ITEMS_UNAVAILABLE',
  );
}

export default function WorkQueueClient() {
  const { role } = usePortalSession();
  const host = useMemo(
    () => supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown',
    [],
  );
  const queue = useQuery({
    ...projectWorkQueueQueryOptions(host),
    refetchOnMount: 'always',
    retry: (failureCount, error) => (
      !isAccessEndingError(error)
      && !isWorkItemsUnavailableError(error)
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
  const notReady = isWorkItemsUnavailableError(queue.error);
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

  return (
    <PageLayout
      width="full"
      density="compact"
      className={styles.page}
      data-project-work-queue-state={state}
      data-project-work-queue-background-ready={state === 'fresh' ? 'true' : 'false'}
    >
      <StaffPageHeader
        title="Work Queue"
        variant="index"
        description="One server-confirmed operational obligation per project."
        count={queue.data && !notReady ? `${entries.length} projects` : undefined}
        right={role === 'admin' && queue.data && !notReady ? (
          <ButtonLink variant="secondary" href="/staff/projects/work-queue/legacy-review">
            Review old Contacted projects
          </ButtonLink>
        ) : undefined}
      />

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
        <LoadingSkeleton rows={7} columns={4} label="Loading project work queue" />
      ) : state === 'not-ready' ? (
        <DataStatePanel
          state="unavailable"
          title="Work Queue not ready"
          description="Project Work V2 is not available in this environment. Existing projects and legacy tasks are unchanged."
          onRetry={() => void queue.refetch()}
        />
      ) : state === 'error' || state === 'unavailable' ? (
        <DataStatePanel
          state={state === 'unavailable' ? 'unavailable' : 'error'}
          onRetry={state === 'error' ? () => void queue.refetch() : undefined}
        />
      ) : (
        <ProjectWorkQueueList
          entries={entries}
          staff={staffQuery.data ?? []}
          host={host}
        />
      )}
    </PageLayout>
  );
}
