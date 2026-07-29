'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import StaffPageHeader from '@/components/layout/StaffPageHeader';
import {
  AlertBanner,
  AlertActionButton,
  Badge,
  Button,
  ButtonLink,
  DataStatePanel,
  EmptyState,
  LoadingSkeleton,
  PageLayout,
  Select,
} from '@/components/ui/foundation';
import { ApiError } from '@/lib/repo/apiClient';
import { fetchLegacyContactedReview } from '@/lib/projects/workItems/legacyTriage/client';
import type {
  LegacyContactedCursor,
  LegacyContactedProject,
  LegacyContactedScope,
} from '@/lib/projects/workItems/legacyTriage/types';
import { qk } from '@/lib/queries/keys';
import {
  supabaseHostFromUrl,
  supabaseRuntimeUrl,
} from '@/lib/supabase/browserClient';
import LegacyContactedMigrationForm from './LegacyContactedMigrationForm';
import {
  legacyFollowUpDateLabel,
  legacyReasonLabel,
  RECOMMENDATION_COPY,
} from './legacyContactedPresentation';
import styles from './legacyReview.module.css';

function recommendationTone(
  recommendation: LegacyContactedProject['recommendation'],
): 'neutral' | 'info' | 'warning' | 'error' {
  if (recommendation === 'ACTIVE_EVIDENCE') return 'warning';
  if (recommendation === 'WAITING_CANDIDATE') return 'info';
  if (recommendation === 'LOST_NO_RESPONSE_CANDIDATE') return 'error';
  return 'neutral';
}

function isAccessEndingError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}

export default function LegacyContactedReviewClient() {
  const queryClient = useQueryClient();
  const host = useMemo(
    () => supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown',
    [],
  );
  const [scope, setScope] = useState<LegacyContactedScope>('due');
  const [cursorStack, setCursorStack] = useState<Array<LegacyContactedCursor | null>>(
    [null],
  );
  const [reviewingProjectId, setReviewingProjectId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const cursor = cursorStack.at(-1) ?? null;
  const query = useQuery({
    queryKey: [
      ...qk.projectWork.legacyContactedReview(host, scope),
      cursor ? JSON.stringify(cursor) : 'first',
    ],
    queryFn: () => fetchLegacyContactedReview({ scope, cursor, limit: 50 }),
    staleTime: 30_000,
    retry: (failureCount, error) => (
      !isAccessEndingError(error) && failureCount < 2
    ),
  });
  const unavailable = isAccessEndingError(query.error);
  const reviewData = unavailable ? null : query.data;
  const state = unavailable
    ? 'unavailable'
    : query.error
      ? reviewData
        ? 'refresh-failed'
        : 'error'
      : !reviewData
        ? 'pending'
        : query.isFetching
          ? 'cached'
          : 'fresh';

  const changeScope = (nextScope: LegacyContactedScope) => {
    setScope(nextScope);
    setCursorStack([null]);
    setReviewingProjectId(null);
    setMessage(null);
  };

  const migrated = async (savedMessage: string) => {
    setMessage(savedMessage);
    setReviewingProjectId(null);
    await Promise.allSettled([
      query.refetch(),
      queryClient.invalidateQueries({ queryKey: qk.projectWork.queue(host) }),
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'data'] }),
    ]);
  };

  return (
    <PageLayout
      width="full"
      density="compact"
      className={styles.page}
      data-legacy-contacted-review
      data-legacy-contacted-review-state={state}
    >
      <StaffPageHeader
        title="Review old Contacted projects"
        variant="index"
        description="Classify old records one project at a time before moving them into V2 work."
        count={reviewData ? `${reviewData.summary.total} to review` : undefined}
        right={(
          <ButtonLink variant="secondary" href="/staff/projects/work-queue">
            Back to Work Queue
          </ButtonLink>
        )}
      />

      <AlertBanner tone="info" title="This is a controlled migration">
        Recommendations are evidence only. Nothing is contacted, archived, deleted, or changed until an administrator confirms one reviewed project.
      </AlertBanner>

      <section className={styles.toolbar} aria-label="Legacy review controls">
        <Select
          label="Projects shown"
          value={scope}
          onChange={(event) => changeScope(event.target.value as LegacyContactedScope)}
        >
          <option value="due">Due for review</option>
          <option value="all">All unreviewed Contacted projects</option>
        </Select>
        {reviewData ? (
          <dl className={styles.summary}>
            <div><dt>Due</dt><dd>{reviewData.summary.due}</dd></div>
            <div><dt>Unreviewed</dt><dd>{reviewData.summary.total}</dd></div>
            <div><dt>Already archived</dt><dd>{reviewData.summary.archived}</dd></div>
          </dl>
        ) : null}
      </section>

      {message ? (
        <AlertBanner tone="info" title="Project review saved">{message}</AlertBanner>
      ) : null}
      {state === 'refresh-failed' ? (
        <AlertBanner
          tone="warning"
          title="Could not refresh the review"
          action={(
            <AlertActionButton onClick={() => void query.refetch()}>
              Retry
            </AlertActionButton>
          )}
        >
          The last server-confirmed classification is still shown. Migration
          remains protected by the project version reviewed here.
        </AlertBanner>
      ) : null}

      {state === 'pending' ? (
        <LoadingSkeleton rows={8} columns={4} label="Loading old Contacted projects" />
      ) : state === 'error' || state === 'unavailable' ? (
        <DataStatePanel
          state={state === 'unavailable' ? 'unavailable' : 'error'}
          onRetry={state === 'error' ? () => void query.refetch() : undefined}
        />
      ) : reviewData!.projects.length === 0 ? (
        <EmptyState
          compact
          title="No projects in this review"
          description={scope === 'due'
            ? 'No old Contacted projects are due. Choose all unreviewed projects to inspect future or undated records.'
            : 'Every old Contacted project has been reviewed or is outside this classifier.'}
        />
      ) : (
        <section className={styles.reviewList} aria-label="Unreviewed Contacted projects">
          <header className={styles.listHeader}>
            <div>
              <h2>Evidence review</h2>
              <p>Project identity and operational evidence only. Customer contact details are deliberately excluded.</p>
            </div>
            {state === 'cached' ? <span role="status">Updating...</span> : null}
          </header>
          <ol>
            {reviewData!.projects.map((project) => {
              const copy = RECOMMENDATION_COPY[project.recommendation];
              const reviewing = reviewingProjectId === project.projectId;
              return (
                <li key={project.projectId} className={styles.reviewRow}>
                  <div className={styles.rowMain}>
                    <div className={styles.identity}>
                      <Link href={`/staff/projects/${encodeURIComponent(project.projectId)}`}>
                        {project.projectName}
                      </Link>
                      <span>{project.pipelineStage} · follow-up {legacyFollowUpDateLabel(project.followUpDate)}</span>
                    </div>
                    <div className={styles.recommendation}>
                      <Badge tone={recommendationTone(project.recommendation)}>
                        {copy.label}
                      </Badge>
                      <p>{copy.description}</p>
                    </div>
                    <ul className={styles.evidence} aria-label="Recorded evidence">
                      {project.reasonCodes.map((reason) => (
                        <li key={reason}>{legacyReasonLabel(reason)}</li>
                      ))}
                    </ul>
                    <Button
                      size="small"
                      variant={reviewing ? 'tertiary' : 'secondary'}
                      aria-expanded={reviewing}
                      onClick={() => {
                        setMessage(null);
                        setReviewingProjectId(reviewing ? null : project.projectId);
                      }}
                    >
                      {reviewing ? 'Close review' : 'Review one project'}
                    </Button>
                  </div>
                  {reviewing ? (
                    <LegacyContactedMigrationForm
                      project={project}
                      onCancel={() => setReviewingProjectId(null)}
                      onSaved={(savedMessage) => void migrated(savedMessage)}
                    />
                  ) : null}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {reviewData ? (
        <nav className={styles.pagination} aria-label="Legacy review pages">
          <Button
            variant="secondary"
            disabled={cursorStack.length === 1 || query.isFetching}
            onClick={() => {
              setCursorStack((current) => current.slice(0, -1));
              setReviewingProjectId(null);
            }}
          >
            Previous
          </Button>
          <Button
            variant="secondary"
            disabled={!reviewData.nextCursor || query.isFetching}
            onClick={() => {
              if (!reviewData.nextCursor) return;
              setCursorStack((current) => [...current, reviewData.nextCursor]);
              setReviewingProjectId(null);
            }}
          >
            Next
          </Button>
        </nav>
      ) : null}
    </PageLayout>
  );
}
