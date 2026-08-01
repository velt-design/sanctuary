'use client';

import { useEffect, useMemo, useState } from 'react';
import ScheduleBoardView, { type ScheduleBoardMenuAction } from '@/app/staff/schedule/ScheduleBoardView';
import ScheduleGanttView from '@/app/staff/schedule/ScheduleGanttView';
import ScheduleGanttTimingReview from '@/app/staff/schedule/ScheduleGanttTimingReview';
import type { ScheduleBoardMutationNotice } from '@/app/staff/schedule/useScheduleBoardMutationNotice';
import { addDaysYmd } from '@/lib/scheduling/date';
import { WORK_HOURS_PER_DAY } from '@/lib/scheduling/duration';
import type { ScheduleItem } from '@/lib/types/scheduling';
import type { ScheduleBoardDrop } from '@/app/staff/schedule/ScheduleBoardView';
import { resolveScheduleBoardOrderChange } from '@/app/staff/schedule/scheduleBoardOrder';
import { boardModelForFixture, createScheduleOpsFixture } from './fixtures';
import styles from './scheduleOpsFixture.module.css';

export default function ScheduleOpsFixtureClient({
  initialView,
  scale,
  initialState,
}: {
  initialView: 'board' | 'gantt';
  scale: 'standard' | 'large';
  initialState: 'failed' | 'stale' | null;
}) {
  const fixture = useMemo(() => createScheduleOpsFixture(scale), [scale]);
  const boardModel = useMemo(() => boardModelForFixture(fixture), [fixture]);
  const [view, setView] = useState(initialView);
  const [query, setQuery] = useState('');
  const [unscheduledCollapsed, setUnscheduledCollapsed] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [laneItems, setLaneItems] = useState(() => new Map(
    Array.from(fixture.laneItems, ([crewId, items]) => [crewId, items.map((item) => ({ ...item }))]),
  ));
  const [scheduleItemById, setScheduleItemById] = useState(() => new Map(
    Array.from(fixture.scheduleItemById, ([id, item]) => [id, { ...item }]),
  ));
  const [unscheduledJobs, setUnscheduledJobs] = useState(() => fixture.unscheduledJobs.slice());
  const [noticeState, setNoticeState] = useState(initialState);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const visibleUnscheduled = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return unscheduledJobs;
    return unscheduledJobs.filter((job) => (job.searchText ?? '').includes(normalized));
  }, [query, unscheduledJobs]);
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
  const feedbackProjectId = Array.from(scheduleItemById.values()).find(
    (item) => item.itemType !== 'downtime',
  )?.projectId ?? null;
  const mutationNotice: ScheduleBoardMutationNotice | null = noticeState && feedbackProjectId
    ? {
        id: 1,
        projectId: feedbackProjectId,
        tone: noticeState === 'failed' ? 'error' : 'warning',
        message: noticeState === 'failed'
          ? 'Move wasn\'t saved. Previous position restored.'
          : 'Couldn\'t verify this change. Refresh before moving another job.',
        actionLabel: noticeState === 'failed' ? 'Retry' : 'Refresh',
        onAction: () => setNoticeState(null),
      }
    : null;
  const interactionDisabled = noticeState === 'stale';

  if (!hydrated) {
    return <div className={styles.loading} role="status">Loading synthetic Schedule fixture…</div>;
  }

  const handleFixtureDrop = (activeId: string, drop: ScheduleBoardDrop) => {
    if (drop.kind === 'unscheduled') return;
    const destinationCrewId = drop.laneId;
    const activeItem = scheduleItemById.get(activeId) ?? null;
    const sourceCrewId = activeItem?.installerId ?? null;
    const sourceIds = sourceCrewId ? (laneItems.get(sourceCrewId) ?? []).map((item) => item.id) : [];
    const destinationIds = (laneItems.get(destinationCrewId) ?? []).map((item) => item.id);
    const order = resolveScheduleBoardOrderChange({
      activeId,
      sourceIds,
      destinationIds,
      requestedIndex: drop.insertionIndex,
      sameLane: sourceCrewId === destinationCrewId,
    });
    if (!order.changed) return;

    const job = fixture.jobsById.get(activeId) ?? null;
    const nextItem: ScheduleItem | null = activeItem
      ? { ...activeItem, installerId: destinationCrewId }
      : job
        ? {
            id: job.id,
            projectId: job.projectId,
            estimateId: job.estimateId,
            installerId: destinationCrewId,
            sortIndex: order.insertionIndex,
            scheduleStatus: 'TENTATIVE',
            locked: false,
            itemType: 'job',
            forecastStart: fixture.today,
            forecastEndExclusive: addDaysYmd(fixture.today, Math.max(1, Math.ceil(job.durationHours / WORK_HOURS_PER_DAY))),
            forecastDurationDays: Math.max(1, Math.ceil(job.durationHours / WORK_HOURS_PER_DAY)),
            durationHoursOverride: job.durationHours,
            mode: 'floating',
            jobStatus: 'not_started',
            updatedAt: new Date().toISOString(),
          }
        : null;
    if (!nextItem || !job) return;

    const nextItemById = new Map(scheduleItemById);
    nextItemById.set(activeId, nextItem);
    const nextLanes = new Map(laneItems);
    if (sourceCrewId && sourceCrewId !== destinationCrewId) {
      nextLanes.set(sourceCrewId, order.sourceIds.map((id, index) => {
        const updated = { ...nextItemById.get(id)!, sortIndex: index };
        nextItemById.set(id, updated);
        return updated;
      }));
    }
    nextLanes.set(destinationCrewId, order.destinationIds.map((id, index) => {
      const item = id === activeId ? nextItem : nextItemById.get(id)!;
      const updated = { ...item, installerId: destinationCrewId, sortIndex: index };
      nextItemById.set(id, updated);
      return updated;
    }));
    setLaneItems(nextLanes);
    setScheduleItemById(nextItemById);
    setUnscheduledJobs((jobs) => jobs.filter((candidate) => candidate.id !== activeId));
    setNoticeState(null);
  };

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
          unscheduledJobsAll={unscheduledJobs}
          laneItems={laneItems}
          scheduleItemById={scheduleItemById}
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
          onDrop={handleFixtureDrop}
          interaction={{
            disabled: interactionDisabled,
            reason: interactionDisabled ? 'Refresh the schedule before making another change.' : undefined,
          }}
          mutationNotice={mutationNotice}
          buildJobMenuActions={fixtureActions}
          buildDowntimeMenuActions={fixtureDowntimeActions}
        />
      ) : (
        <ScheduleGanttView
          today={fixture.today}
          scheduleMode="v2"
          installers={fixture.installers}
          laneItems={laneItems}
          visibleScheduleItems={Array.from(scheduleItemById.values())}
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
