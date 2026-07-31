'use client';

import { useEffect, useMemo, useState } from 'react';
import ScheduleBoardView, { type ScheduleBoardMenuAction } from '@/app/staff/schedule/ScheduleBoardView';
import ScheduleGanttView from '@/app/staff/schedule/ScheduleGanttView';
import ScheduleGanttTimingReview from '@/app/staff/schedule/ScheduleGanttTimingReview';
import type {
  ScheduleBoardChangeFeedback,
  ScheduleBoardChangePhase,
} from '@/app/staff/schedule/useScheduleBoardChangeFeedback';
import { addDaysYmd } from '@/lib/scheduling/date';
import { boardModelForFixture, createScheduleOpsFixture } from './fixtures';
import styles from './scheduleOpsFixture.module.css';

export default function ScheduleOpsFixtureClient({
  initialView,
  scale,
  initialState,
}: {
  initialView: 'board' | 'gantt';
  scale: 'standard' | 'large';
  initialState: ScheduleBoardChangePhase | null;
}) {
  const fixture = useMemo(() => createScheduleOpsFixture(scale), [scale]);
  const boardModel = useMemo(() => boardModelForFixture(fixture), [fixture]);
  const [view, setView] = useState(initialView);
  const [query, setQuery] = useState('');
  const [unscheduledCollapsed, setUnscheduledCollapsed] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const visibleUnscheduled = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return fixture.unscheduledJobs;
    return fixture.unscheduledJobs.filter((job) => (job.searchText ?? '').includes(normalized));
  }, [fixture.unscheduledJobs, query]);
  const noMutation = () => undefined;
  const fixtureActions = (): ScheduleBoardMenuAction[] => [
    { label: 'Set duration…', group: 'timing', onClick: noMutation },
    { label: 'Mark in progress', group: 'progress', onClick: noMutation },
    { label: 'Mark client contacted', group: 'client', onClick: noMutation },
    { label: 'Unschedule', group: 'exceptions', tone: 'danger', onClick: noMutation },
  ];
  const fixtureDowntimeActions = (): ScheduleBoardMenuAction[] => [
    { label: 'Edit downtime…', group: 'timing', onClick: noMutation },
    { label: 'Delete downtime', group: 'exceptions', tone: 'danger', onClick: noMutation },
  ];
  const feedbackProjectId = Array.from(fixture.scheduleItemById.values()).find(
    (item) => item.itemType !== 'downtime',
  )?.projectId ?? null;
  const changeFeedback: ScheduleBoardChangeFeedback | null = initialState && feedbackProjectId
    ? {
        id: 1,
        projectId: feedbackProjectId,
        action: 'Move',
        destination: fixture.installers[1]?.name ?? fixture.installers[0]?.name ?? 'Fixture crew',
        phase: initialState,
      }
    : null;
  const interactionDisabled = Boolean(initialState && ['checking', 'reviewing', 'saving', 'reconciling'].includes(initialState));

  if (!hydrated) {
    return <div className={styles.loading} role="status">Loading synthetic Schedule fixture…</div>;
  }

  return (
    <div className={styles.fixture} data-schedule-ops-view={view} data-schedule-ops-scale={scale}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Synthetic read-only QA fixture</p>
          <h1>Schedule operational context</h1>
          <p>
            {fixture.installers.length} crews · {fixture.scheduleBars.length} scheduled jobs ·{' '}
            {fixture.unscheduledJobs.length} unscheduled jobs. Controls cannot persist changes.
          </p>
        </div>
        <div className={styles.headerActions}>
          {view === 'gantt' ? (
            <button type="button" className={styles.reviewButton} onClick={() => setReviewOpen(true)}>
              Preview change review
            </button>
          ) : null}
          <div className={styles.viewControls} role="group" aria-label="Schedule fixture view">
            <button type="button" aria-pressed={view === 'board'} onClick={() => setView('board')}>
              Board
            </button>
            <button type="button" aria-pressed={view === 'gantt'} onClick={() => setView('gantt')}>
              Gantt
            </button>
          </div>
        </div>
      </header>

      {view === 'board' ? (
        <ScheduleBoardView
          today={fixture.today}
          scheduleMode="v2"
          installers={fixture.installers}
          schedulable={boardModel.schedulable}
          unscheduledJobs={visibleUnscheduled}
          unscheduledJobsAll={fixture.unscheduledJobs}
          laneItems={fixture.laneItems}
          scheduleItemById={fixture.scheduleItemById}
          barsByScheduleId={fixture.barsByScheduleId}
          issueLevelByScheduleId={new Map(
            fixture.scheduleIssues.flatMap((issue) =>
              issue.scheduleItemId ? [[issue.scheduleItemId, issue.level] as const] : [],
            ),
          )}
          nextAvailableByInstallerId={fixture.nextAvailableByInstallerId}
          unscheduledCollapsed={unscheduledCollapsed}
          query={query}
          showCompleted={showCompleted}
          onQueryChange={setQuery}
          onToggleUnscheduledCollapsed={() => setUnscheduledCollapsed((value) => !value)}
          onShowCompletedChange={setShowCompleted}
          onDrop={noMutation}
          interaction={{
            disabled: interactionDisabled,
            reason: interactionDisabled ? 'Synthetic schedule change in progress.' : undefined,
          }}
          changeFeedback={changeFeedback}
          buildJobMenuActions={fixtureActions}
          buildDowntimeMenuActions={fixtureDowntimeActions}
        />
      ) : (
        <ScheduleGanttView
          today={fixture.today}
          scheduleMode="v2"
          installers={fixture.installers}
          laneItems={fixture.laneItems}
          visibleScheduleItems={Array.from(fixture.scheduleItemById.values())}
          projectsById={fixture.projectsById}
          estimatesById={new Map()}
          scheduleBars={fixture.scheduleBars}
          scheduleIssues={fixture.scheduleIssues}
          holidays={[]}
          showCompleted={showCompleted}
          onShowCompletedChange={setShowCompleted}
          onOpenUnscheduled={() => {
            setView('board');
            setUnscheduledCollapsed(false);
          }}
          onOpenProject={noMutation}
          onOpenProjectPack={noMutation}
          onOpenCommitmentEdit={noMutation}
          onOpenPinEdit={noMutation}
          onUnpinScheduleItem={noMutation}
          onAckClientUpdate={noMutation}
          onMovePin={noMutation}
          onResizePin={noMutation}
        />
      )}
      {reviewOpen ? (
        <ScheduleGanttTimingReview
          change={{
            mode: 'move',
            scheduleItemId: 'fixture-schedule-0',
            itemUpdatedAt: '2026-07-31T00:00:00.000Z',
            projectName: fixture.jobsById.get('fixture-schedule-0')?.projectName ?? 'Fixture job',
            identityDetail: fixture.jobsById.get('fixture-schedule-0')?.identityDetail ?? null,
            crewName: fixture.installers[0]?.name ?? 'Fixture crew',
            currentStart: fixture.today,
            currentEnd: fixture.today,
            currentDurationDays: 1,
            requestedStart: addDaysYmd(fixture.today, 3),
            requestedDurationDays: 1,
          }}
          stale={false}
          onCancel={() => setReviewOpen(false)}
          onConfirm={() => setReviewOpen(false)}
        />
      ) : null}
    </div>
  );
}
