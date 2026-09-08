'use client';

import { useEffect, useMemo, useState } from 'react';
import ScheduleBoardView, { type ScheduleBoardMenuAction } from '@/app/staff/schedule/ScheduleBoardView';
import ScheduleGanttView from '@/app/staff/schedule/ScheduleGanttView';
import type { ScheduleBoardMutationNotice } from '@/app/staff/schedule/useScheduleBoardMutationNotice';
import { addDaysYmd } from '@/lib/scheduling/date';
import { WORK_HOURS_PER_DAY } from '@/lib/scheduling/duration';
import type { ScheduleItem } from '@/lib/types/scheduling';
import type { ScheduleBoardDrop } from '@/app/staff/schedule/ScheduleBoardView';
import { resolveScheduleBoardOrderChange } from '@/app/staff/schedule/scheduleBoardOrder';
import { boardModelForFixture, createScheduleOpsFixture } from './fixtures';
import { recomputePreviewSchedule } from './previewSchedule';
import styles from './scheduleOpsFixture.module.css';

export default function ScheduleOpsFixtureClient({
  initialView,
  scale,
  initialState,
}: {
  initialView: 'board' | 'gantt';
  scale: 'standard' | 'large';
  initialState: 'failed' | 'stale' | 'slow' | null;
}) {
  const fixture = useMemo(() => createScheduleOpsFixture(scale), [scale]);
  const boardModel = useMemo(() => boardModelForFixture(fixture), [fixture]);
  const [view, setView] = useState(initialView);
  const [query, setQuery] = useState('');
  const [unscheduledCollapsed, setUnscheduledCollapsed] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [laneItems, setLaneItems] = useState(() => new Map(
    Array.from(fixture.laneItems, ([crewId, items]) => [crewId, items.map((item) => ({ ...item }))]),
  ));
  const [scheduleItemById, setScheduleItemById] = useState(() => new Map(
    Array.from(fixture.scheduleItemById, ([id, item]) => [id, { ...item }]),
  ));
  const [unscheduledJobs, setUnscheduledJobs] = useState(() => fixture.unscheduledJobs.slice());
  const [noticeState, setNoticeState] = useState(initialState);
  const [hydrated, setHydrated] = useState(false);
  const scheduleBars = useMemo(() => Array.from(scheduleItemById.values()).flatMap((item) => {
    const job = fixture.jobsById.get(item.id);
    if (!job || !item.forecastStart || !item.forecastEndExclusive) return [];
    return [{ scheduleItemId: item.id, installerId: item.installerId, projectId: item.projectId,
      estimateId: item.estimateId, projectName: job.projectName, status: job.status,
      startDate: item.forecastStart, endDate: addDaysYmd(item.forecastEndExclusive, -1),
      durationHours: (item.forecastDurationDays ?? 1) * WORK_HOURS_PER_DAY }];
  }), [fixture, scheduleItemById]);
  const barsByScheduleId = useMemo(() => new Map(scheduleBars.map((bar) => [bar.scheduleItemId, bar])), [scheduleBars]);
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
  const feedbackItem = Array.from(scheduleItemById.values()).find(
    (item) => item.itemType !== 'downtime',
  ) ?? null;
  const feedbackProjectId = feedbackItem?.projectId ?? null;
  const mutationNotice: ScheduleBoardMutationNotice | null = noticeState && noticeState !== 'slow' && feedbackProjectId
    ? {
        id: 1,
        projectId: feedbackProjectId,
        tone: noticeState === 'failed' ? 'error' : 'warning',
        message: noticeState === 'failed'
          ? 'Move wasn\'t saved. Previous position restored.'
          : 'Couldn\'t verify this change. Refresh this job before moving it again.',
        actionLabel: noticeState === 'failed' ? 'Retry' : 'Refresh',
        onAction: () => setNoticeState(null),
      }
    : null;

  if (!hydrated) {
    return <div className={styles.loading} role="status">Loading synthetic Schedule fixture…</div>;
  }

  const applyPreviewLanes = (lanes: Map<string, ScheduleItem[]>) => {
    const next = recomputePreviewSchedule(lanes, fixture.installers, fixture.today);
    setLaneItems(next.laneItems);
    setScheduleItemById(next.scheduleItemById);
  };
  const handleTimingChange = (id: string, start: string, duration: number) => {
    const item = scheduleItemById.get(id);
    if (!item || item.actualStartDate || item.jobStatus !== 'not_started') return;
    const next = new Map(laneItems);
    next.set(item.installerId, (next.get(item.installerId) ?? []).map((row) => row.id === id
      ? { ...row, mode: 'pinned', forecastStart: start, forecastDurationDays: duration,
          durationHoursOverride: duration * WORK_HOURS_PER_DAY, updatedAt: new Date().toISOString() }
      : row));
    applyPreviewLanes(next);
  };
  const handleUnpin = (id: string) => {
    const item = scheduleItemById.get(id);
    if (!item || item.actualStartDate || item.jobStatus !== 'not_started') return;
    const next = new Map(laneItems);
    next.set(item.installerId, (next.get(item.installerId) ?? []).map((row) => row.id === id
      ? { ...row, mode: 'floating', updatedAt: new Date().toISOString() }
      : row));
    applyPreviewLanes(next);
  };

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
    applyPreviewLanes(nextLanes);
    setUnscheduledJobs((jobs) => jobs.filter((candidate) => candidate.id !== activeId));
    setNoticeState(null);
  };

  return (
    <div className={styles.fixture} data-schedule-ops-view={view} data-schedule-ops-scale={scale}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Interactive sample schedule</p>
          <h1>Schedule operational context</h1>
          <p>
            {fixture.installers.length} crews · {fixture.scheduleBars.length} scheduled jobs ·{' '}
            {unscheduledJobs.length} unscheduled jobs. {view === 'board' ? 'Use Move to place a card at the insertion line.' : 'Drag a bar to move it; drag its right edge to change duration.'} Release to apply. Changes reset on refresh and never affect live jobs.
          </p>
        </div>
        <div className={styles.headerActions}>
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
          barsByScheduleId={barsByScheduleId}
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
            moveDisabled: false,
            actionDisabled: noticeState === 'slow' || noticeState === 'stale',
            actionDisabledReason: noticeState === 'slow'
              ? 'Placement changes are saving in the background.'
              : noticeState === 'stale'
                ? 'Refresh this job before changing it again.'
                : undefined,
            blockedLaneIds: noticeState === 'stale' && feedbackItem ? [feedbackItem.installerId] : [],
            blockedProjectIds: noticeState === 'stale' && feedbackProjectId ? [feedbackProjectId] : [],
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
          scheduleBars={scheduleBars}
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
          onUnpinScheduleItem={handleUnpin}
          onAckClientUpdate={noMutation}
          onMovePin={handleTimingChange}
          onResizePin={handleTimingChange}
        />
      )}
    </div>
  );
}
