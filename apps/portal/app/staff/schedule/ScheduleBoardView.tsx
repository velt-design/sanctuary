'use client';

import { useMemo } from 'react';
import type { ReactNode } from 'react';
import {
  closestCenter,
  DndContext,
  type CollisionDetection,
  DragOverlay,
  pointerWithin,
  useDroppable,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { ScheduleProjectSummary } from '@/lib/queries/schedule';
import { addDaysYmd } from '@/lib/scheduling/date';
import { SCHEDULE_TIME_ZONE } from '@/lib/scheduling/scheduleClock';
import type { Installer, ScheduleItem, ScheduleItemStatus } from '@/lib/types/scheduling';
import sharedStyles from './schedule.module.css';
import boardStyles from './scheduleBoard.module.css';
import timelineStyles from './scheduleTimeline.module.css';
import type { ScheduleBoardModel, SchedulableJob } from './ScheduleClientModel';
import {
  DowntimeCard,
  formatScheduleBoardStatusLabel,
  ScheduledJobCard,
  type ScheduleBoardMenuAction,
  UnscheduledJobCard,
} from './ScheduleBoardCards';
import ScheduleCrewFilter from './ScheduleCrewFilter';
import type { BoardDropTarget } from './boardDrag';
import { useScheduleCrewVisibility } from './useScheduleCrewVisibility';
import {
  useScheduleBoardDragController,
  type ScheduleBoardDrop,
} from './useScheduleBoardDragController';
import type { ScheduleBoardChangeFeedback } from './useScheduleBoardChangeFeedback';

const styles = { ...sharedStyles, ...timelineStyles, ...boardStyles };

export type { ScheduleBoardMenuAction } from './ScheduleBoardCards';
export type { ScheduleBoardDrop, ScheduleBoardDropDebug } from './useScheduleBoardDragController';

export type ScheduleBoardViewProps = {
  today: string;
  scheduleMode: 'v2' | 'legacy';
  installers: Installer[];
  schedulable: ScheduleBoardModel['schedulable'];
  unscheduledJobs: SchedulableJob[];
  unscheduledJobsAll: SchedulableJob[];
  laneItems: Map<string, ScheduleItem[]>;
  scheduleItemById: Map<string, ScheduleItem>;
  barsByScheduleId: Map<string, { startDate: string; endDate: string }>;
  issueLevelByScheduleId: Map<string, 'warning' | 'error'>;
  nextAvailableByInstallerId: Map<string, string>;
  unscheduledCollapsed: boolean;
  query: string;
  showCompleted: boolean;
  onQueryChange: (value: string) => void;
  onToggleUnscheduledCollapsed: () => void;
  onShowCompletedChange: (value: boolean) => void;
  onDrop: (activeId: string, drop: ScheduleBoardDrop) => void;
  interaction?: {
    disabled: boolean;
    reason?: string;
  };
  changeFeedback?: ScheduleBoardChangeFeedback | null;
  buildJobMenuActions: (args: {
    id: string;
    scheduleItem: ScheduleItem;
    job: SchedulableJob | null;
    scheduleStatus: ScheduleItemStatus;
  }) => ScheduleBoardMenuAction[];
  buildDowntimeMenuActions: (id: string, scheduleItem: ScheduleItem) => ScheduleBoardMenuAction[];
};

const boardCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  return pointerCollisions.length ? pointerCollisions : closestCenter(args);
};

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

function parseYmd(ymd: string): Date | null {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function isWeekendDate(ymd: string): boolean {
  const dt = parseYmd(ymd);
  if (!dt) return false;
  const day = dt.getUTCDay();
  return day === 0 || day === 6;
}

function nextWorkdayAfter(ymd: string): string {
  let d = addDaysYmd(ymd, 1);
  for (let i = 0; i < 8; i += 1) {
    if (!isWeekendDate(d)) return d;
    d = addDaysYmd(d, 1);
  }
  return d;
}

function formatShortDate(ymd: string): string {
  const dt = parseYmd(ymd);
  if (!dt) return ymd;
  return new Intl.DateTimeFormat('en-NZ', { day: '2-digit', month: 'short', timeZone: SCHEDULE_TIME_ZONE }).format(dt);
}

function formatDateRange(startYmd: string, endYmd: string): string {
  return `${formatShortDate(startYmd)} → ${formatShortDate(endYmd)}`;
}

function normalizeScheduleStatus(value: unknown): ScheduleItemStatus {
  const s = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (s === 'CONFIRMED' || s === 'IN_PROGRESS' || s === 'COMPLETED') return s as ScheduleItemStatus;
  return 'TENTATIVE';
}

function deriveScheduleStatus(item: ScheduleItem, today: string): ScheduleItemStatus {
  const raw = normalizeScheduleStatus(item.scheduleStatus);
  if (raw === 'COMPLETED') return 'COMPLETED';
  const planned = typeof item.startDateOverride === 'string' ? item.startDateOverride : '';
  const started = Boolean(item.actualStartDate) || (planned && planned <= today);
  if (started) return 'IN_PROGRESS';
  if (raw === 'CONFIRMED' || item.locked) return 'CONFIRMED';
  return 'TENTATIVE';
}

function hasPlannedCommitment(item: ScheduleItem): boolean {
  return Boolean(item.plannedCommitmentType || item.plannedStart || item.plannedWeekStart);
}

function startOfWeekMonday(ymd: string): string {
  const dt = parseYmd(ymd);
  if (!dt) return ymd;
  const daysSinceMonday = (dt.getUTCDay() + 6) % 7;
  return addDaysYmd(ymd, -daysSinceMonday);
}

function resolveCommitmentType(item: ScheduleItem): 'week_of' | 'fixed_date' | null {
  if (item.plannedCommitmentType === 'week_of' || item.plannedCommitmentType === 'fixed_date') return item.plannedCommitmentType;
  if (item.plannedStart) return 'fixed_date';
  return null;
}

function resolvePlannedFlexDays(item: ScheduleItem): number | null {
  if (typeof item.plannedFlexDays === 'number' && Number.isFinite(item.plannedFlexDays)) {
    return Math.max(0, Math.trunc(item.plannedFlexDays));
  }
  const commitmentType = resolveCommitmentType(item);
  if (!commitmentType) return null;
  return commitmentType === 'week_of' ? 4 : 1;
}

function formatCommitmentLabel(item: ScheduleItem): string | null {
  const commitmentType = resolveCommitmentType(item);
  if (!commitmentType) return null;
  if (commitmentType === 'week_of') {
    const weekStart = item.plannedWeekStart ?? (item.plannedStart ? startOfWeekMonday(item.plannedStart) : null);
    if (!weekStart) return 'Week of —';
    return `Week of ${formatShortDate(weekStart)}`;
  }
  if (!item.plannedStart) return 'Starts —';
  return `Starts ${formatShortDate(item.plannedStart)}`;
}

function LaneDropZone({
  laneId,
  children,
  onMount,
}: {
  laneId: string;
  children: ReactNode;
  onMount?: (node: HTMLDivElement | null) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `lane:${laneId}` });
  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        onMount?.(node);
      }}
      className={styles.laneBody}
      data-board-lane-body={laneId}
      data-over={isOver ? 'true' : 'false'}
    >
      {children}
    </div>
  );
}

function UnscheduledDropZone({
  children,
  onMount,
}: {
  children: ReactNode;
  onMount?: (node: HTMLDivElement | null) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: 'unscheduled' });
  return (
    <div
      ref={(node) => {
        setNodeRef(node);
        onMount?.(node);
      }}
      className={styles.unscheduledBody}
      data-over={isOver ? 'true' : 'false'}
    >
      {children}
    </div>
  );
}

function describeDropTarget(input: {
  target: BoardDropTarget | null;
  installers: Installer[];
  scheduleItemById: Map<string, ScheduleItem>;
  jobsById: ScheduleBoardModel['schedulable']['jobsById'];
}): string {
  const { target } = input;
  if (!target) return 'Move over a crew lane or Unscheduled.';
  if (!target.valid) {
    if (target.reason === 'same-position') return 'Already in this position.';
    if (target.reason === 'same-unscheduled') return 'Already unscheduled.';
    if (target.reason === 'restricted') return 'Downtime stays with its current crew.';
    return 'Not a valid destination.';
  }
  if (target.kind === 'unscheduled') return 'Return this job to Unscheduled.';
  const crewName = input.installers.find((installer) => installer.id === target.laneId)?.name ?? 'crew';
  if (target.placement === 'end' || !target.overId || target.overId.startsWith('lane:')) {
    return `Drop at the end of ${crewName} · position ${target.insertionIndex + 1}.`;
  }
  const targetItem = input.scheduleItemById.get(target.overId) ?? null;
  const targetJob = targetItem ? input.jobsById.get(targetItem.id) ?? null : null;
  const targetName = targetJob?.projectName ?? (targetItem?.itemType === 'downtime' ? 'downtime' : 'the next job');
  return `Drop in ${crewName} · position ${target.insertionIndex + 1}, before ${targetName}.`;
}

export default function ScheduleBoardView({
  today,
  scheduleMode,
  installers,
  schedulable,
  unscheduledJobs,
  unscheduledJobsAll,
  laneItems,
  scheduleItemById,
  barsByScheduleId,
  issueLevelByScheduleId,
  nextAvailableByInstallerId,
  unscheduledCollapsed,
  query,
  showCompleted,
  onQueryChange,
  onToggleUnscheduledCollapsed,
  onShowCompletedChange,
  onDrop,
  interaction = { disabled: false },
  changeFeedback = null,
  buildJobMenuActions,
  buildDowntimeMenuActions,
}: ScheduleBoardViewProps) {
  const activeInstallers = useMemo(() => installers.filter((installer) => installer.active), [installers]);
  const activeInstallerIds = useMemo(() => activeInstallers.map((installer) => installer.id), [activeInstallers]);
  const { hiddenCrewIds, toggleCrew, hideCrews, showAllCrews } = useScheduleCrewVisibility(activeInstallerIds);
  const visibleInstallers = useMemo(
    () => activeInstallers.filter((installer) => !hiddenCrewIds.has(installer.id)),
    [activeInstallers, hiddenCrewIds],
  );
  const emptyCrewIds = useMemo(
    () => activeInstallers.filter((installer) => (laneItems.get(installer.id) ?? []).length === 0).map((installer) => installer.id),
    [activeInstallers, laneItems],
  );
  const hiddenItemCount = useMemo(
    () =>
      activeInstallers.reduce(
        (count, installer) => count + (hiddenCrewIds.has(installer.id) ? (laneItems.get(installer.id) ?? []).length : 0),
        0,
      ),
    [activeInstallers, hiddenCrewIds, laneItems],
  );
  const crewFilterOptions = useMemo(
    () =>
      activeInstallers.map((installer) => ({
        id: installer.id,
        name: installer.name,
        color: installer.color,
        itemCount: (laneItems.get(installer.id) ?? []).length,
      })),
    [activeInstallers, laneItems],
  );

  const visibleInstallerIds = useMemo(() => visibleInstallers.map((installer) => installer.id), [visibleInstallers]);
  const {
    sensors,
    activeDragId,
    boardDropTarget,
    boardScrollRef,
    laneBodyRefs,
    boardCardRefs,
    unscheduledBodyRef,
    handleDragStart,
    handleDragOver,
    handleDragMove,
    handleDragEnd,
    clearDragState,
  } = useScheduleBoardDragController({
    interactionDisabled: interaction.disabled,
    visibleInstallerIds,
    laneItems,
    scheduleItemById,
    onDrop,
  });
  const overLaneId = boardDropTarget?.valid && boardDropTarget.kind === 'lane' ? boardDropTarget.laneId : null;
  const overlayJob = activeDragId ? schedulable.jobsById.get(activeDragId) ?? null : null;
  const overlayScheduleItem = activeDragId ? scheduleItemById.get(activeDragId) ?? null : null;
  const overlayTitle = overlayJob?.projectName ?? (overlayScheduleItem?.itemType === 'downtime' ? 'Downtime' : 'Schedule item');
  const overlayDescriptor = overlayJob?.descriptor ?? (overlayScheduleItem?.downtimeNote || 'Crew unavailable');
  const dropDescription = activeDragId
    ? describeDropTarget({
        target: boardDropTarget,
        installers,
        scheduleItemById,
        jobsById: schedulable.jobsById,
      })
    : '';

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={boardCollisionDetection}
      autoScroll={false}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragMove={handleDragMove}
      onDragCancel={clearDragState}
      onDragEnd={handleDragEnd}
    >
      <div className={styles.dragLiveRegion} role="status" aria-live="assertive">
        {dropDescription}
      </div>
      <div className={styles.panels}>
        <aside
          className={cx(styles.leftPanel, unscheduledCollapsed && styles.leftPanelCollapsed)}
          data-collapsed={unscheduledCollapsed ? 'true' : 'false'}
          aria-label="Unscheduled jobs"
        >
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>Unscheduled</h2>
            <div className={styles.panelHeaderActions}>
              <span className={styles.muted}>{unscheduledJobs.length}</span>
              <button
                type="button"
                className={styles.panelCollapseButton}
                aria-label={unscheduledCollapsed ? 'Expand unscheduled panel' : 'Collapse unscheduled panel'}
                aria-expanded={!unscheduledCollapsed}
                onClick={onToggleUnscheduledCollapsed}
              >
                {unscheduledCollapsed ? '▸' : '◂'}
              </button>
            </div>
          </div>

          <div className={styles.filters}>
            <input
              className={cx(styles.input, styles.boardSearchInput)}
              aria-label="Search unscheduled projects"
              placeholder="Search projects…"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
            />
            <p className={styles.hint}>Only deposit-stage projects with at least one active estimate appear here.</p>
          </div>

          <UnscheduledDropZone onMount={(node) => (unscheduledBodyRef.current = node)}>
            {unscheduledJobs.length ? (
              <div className={styles.cardList}>
                {unscheduledJobs.map((job) => (
                  <UnscheduledJobCard
                    key={job.id}
                    job={job}
                    interactionDisabled={interaction.disabled}
                    interactionDisabledReason={interaction.reason}
                    changeFeedback={changeFeedback?.projectId === job.projectId ? changeFeedback : null}
                  />
                ))}
              </div>
            ) : (
              <div>
                {unscheduledJobsAll.length === 0 ? (
                  <>
                    <p className={styles.note}>No unscheduled deposit-stage projects.</p>
                    <p className={styles.hint}>Projects appear here once they reach Deposit and have an active estimate.</p>
                  </>
                ) : (
                  <p className={styles.note}>No projects match this search.</p>
                )}
              </div>
            )}
          </UnscheduledDropZone>

          {process.env.NODE_ENV === 'development' ? (
            <details className={styles.debugDetails}>
              <summary className={styles.debugSummary}>Debug: schedulable jobs</summary>
              <div className={styles.debugBody}>
                <div className={styles.debugRow}>
                  <span className={styles.muted}>Projects</span>
                  <span>{schedulable.debug.totalProjects}</span>
                </div>
                <div className={styles.debugRow}>
                  <span className={styles.muted}>Schedulable (has active estimate)</span>
                  <span>{schedulable.debug.schedulableProjects}</span>
                </div>
                <div className={styles.debugRow}>
                  <span className={styles.muted}>Unscheduled</span>
                  <span>{schedulable.debug.unscheduledJobs}</span>
                </div>

                <div className={styles.debugSectionTitle}>Excluded projects</div>
                <div className={styles.debugRow}>
                  <span className={styles.muted}>No estimates</span>
                  <span>{schedulable.debug.excluded.noEstimates}</span>
                </div>
                <div className={styles.debugRow}>
                  <span className={styles.muted}>No active estimate</span>
                  <span>{schedulable.debug.excluded.noSchedulableEstimate}</span>
                </div>
                <div className={styles.debugRow}>
                  <span className={styles.muted}>Already scheduled</span>
                  <span>{schedulable.debug.excluded.alreadyScheduled}</span>
                </div>

                <div className={styles.debugSectionTitle}>Schedule items</div>
                <div className={styles.debugRow}>
                  <span className={styles.muted}>Total</span>
                  <span>{schedulable.debug.scheduleItems.total}</span>
                </div>
                <div className={styles.debugRow}>
                  <span className={styles.muted}>Blocking (valid + active estimate)</span>
                  <span>{schedulable.debug.scheduleItems.blocking}</span>
                </div>
                <div className={styles.debugRow}>
                  <span className={styles.muted}>Missing project</span>
                  <span>{schedulable.debug.scheduleItems.missingProject}</span>
                </div>
                <div className={styles.debugRow}>
                  <span className={styles.muted}>Missing estimate</span>
                  <span>{schedulable.debug.scheduleItems.missingEstimate}</span>
                </div>
                <div className={styles.debugRow}>
                  <span className={styles.muted}>Estimate archived</span>
                  <span>{schedulable.debug.scheduleItems.estimateNotSchedulable}</span>
                </div>
              </div>
            </details>
          ) : null}
        </aside>

        <section className={styles.mainPanel} aria-label="Installer lanes">
          {interaction.disabled ? (
            <div className={styles.boardInteractionNotice} role="status" aria-live="polite">
              {interaction.reason ?? 'Schedule changes are temporarily paused.'}
            </div>
          ) : null}
          <div className={cx(styles.legendRow, styles.boardControls)} aria-label="Schedule controls">
            <div className={styles.boardLegend}>
              {scheduleMode === 'v2' ? (
                <>
                  <span className={styles.legendItem}>
                    <span className={styles.legendSwatch} />
                    Forecast
                  </span>
                  <span className={styles.legendItem}>
                    <span className={styles.legendDot} aria-hidden="true" />
                    Pinned
                  </span>
                  <span className={styles.legendItem}>
                    <span className={cx(styles.legendSwatch, styles.legendSwatchConflict)} />
                    Conflict
                  </span>
                </>
              ) : null}
              <label className={cx(styles.toggleControl, styles.boardToggleControl)}>
                <input
                  type="checkbox"
                  className={styles.toggleCheckbox}
                  checked={showCompleted}
                  onChange={(e) => onShowCompletedChange(e.target.checked)}
                />
                Show completed jobs
              </label>
            </div>
            {activeInstallers.length > 0 ? (
              <ScheduleCrewFilter
                crews={crewFilterOptions}
                hiddenCrewIds={hiddenCrewIds}
                hiddenItemCount={hiddenItemCount}
                emptyCrewIds={emptyCrewIds}
                disabled={Boolean(activeDragId)}
                onToggleCrew={toggleCrew}
                onHideCrews={hideCrews}
                onShowAllCrews={showAllCrews}
              />
            ) : null}
          </div>
          <div
            className={styles.lanes}
            ref={boardScrollRef}
            data-board-lanes="true"
            data-visible-crew-count={visibleInstallers.length}
          >
            {visibleInstallers.length === 0 ? (
              <div className={styles.allCrewsHidden}>
                <p className={styles.emptyLaneTitle}>
                  {activeInstallers.length === 0 ? 'No active crews available' : 'All crews are hidden'}
                </p>
                {activeInstallers.length > 0 ? (
                  <>
                    <p className={styles.emptyLaneHint}>Choose crews from the filter or show everyone again.</p>
                    <button type="button" className={styles.showAllCrewsButton} onClick={showAllCrews}>
                      Show all crews
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}
            {visibleInstallers.map((installer) => {
              const items = laneItems.get(installer.id) ?? [];
              const ids = items.map((item) => item.id);
              const laneIsOver = overLaneId === installer.id && Boolean(activeDragId);
              const laneDropTarget = boardDropTarget?.valid && boardDropTarget.kind === 'lane' && boardDropTarget.laneId === installer.id ? boardDropTarget : null;
              const insertionAtEnd = Boolean(laneDropTarget && laneDropTarget.placement === 'end' && activeDragId);
              let maxEnd: string | null = null;
              for (const id of ids) {
                const dates = barsByScheduleId.get(id);
                if (!dates) continue;
                const end = dates.endDate;
                if (!maxEnd || end > maxEnd) maxEnd = end;
              }
              const nextAvailableCandidate = maxEnd ? nextWorkdayAfter(maxEnd) : null;
              const computedNextAvailable = nextAvailableCandidate && nextAvailableCandidate < today ? today : nextAvailableCandidate;
              const nextAvailable = scheduleMode === 'v2' ? nextAvailableByInstallerId.get(installer.id) ?? computedNextAvailable : computedNextAvailable;
              const issueCount = ids.reduce((count, id) => count + (issueLevelByScheduleId.has(id) ? 1 : 0), 0);

              const cards: ReactNode[] = [];
              for (const [itemIndex, id] of ids.entries()) {
                const showInsertBefore = Boolean(laneDropTarget && laneDropTarget.overId === id && activeDragId !== id && activeDragId);
                const job = schedulable.jobsById.get(id) ?? null;
                const dates = barsByScheduleId.get(id);
                const dateLine = dates ? formatDateRange(dates.startDate, dates.endDate) : undefined;
                const scheduleItem = scheduleItemById.get(id) ?? null;
                const scheduleStatus = scheduleItem ? deriveScheduleStatus(scheduleItem, today) : 'TENTATIVE';
                const issueLevel = issueLevelByScheduleId.get(id);

                if (scheduleItem?.itemType === 'downtime') {
                  const downtimeActions = buildDowntimeMenuActions(id, scheduleItem);

                  cards.push(
                    <DowntimeCard
                      key={id}
                      id={id}
                      item={scheduleItem}
                      dateLine={dateLine}
                      dropTarget={showInsertBefore}
                      menuActions={downtimeActions}
                      issueLevel={issueLevel}
                      interactionDisabled={interaction.disabled}
                      interactionDisabledReason={interaction.reason}
                      sequencePosition={itemIndex + 1}
                      onMount={(node) => boardCardRefs.current.set(id, node)}
                    />,
                  );
                  continue;
                }

                if (!scheduleItem) continue;
                const menuActions = buildJobMenuActions({ id, scheduleItem, job, scheduleStatus });
                const commitmentLabel = formatCommitmentLabel(scheduleItem);
                const commitmentType = resolveCommitmentType(scheduleItem);
                const flexDays = resolvePlannedFlexDays(scheduleItem);
                const driftDays =
                  typeof scheduleItem.driftDays === 'number' && Number.isFinite(scheduleItem.driftDays)
                    ? Math.max(0, Math.trunc(scheduleItem.driftDays))
                    : null;
                const driftExceeded = driftDays !== null && flexDays !== null ? driftDays > flexDays : false;
                const clientUpdateStatus = scheduleItem.clientUpdateStatus ?? 'none';
                const extraBadges = (
                  <>
                    {!hasPlannedCommitment(scheduleItem) ? <span className={styles.draftPill}>Plan: Draft</span> : null}
                    {hasPlannedCommitment(scheduleItem) && commitmentLabel ? <span className={styles.commitmentPill}>Plan: {commitmentLabel}</span> : null}
                    {commitmentType && driftDays !== null && driftDays > 0 && !driftExceeded ? (
                      <span className={styles.driftPill}>Drift +{driftDays}d</span>
                    ) : null}
                    {clientUpdateStatus === 'needed' ? <span className={styles.clientUpdatePill}>Client update needed</span> : null}
                    {clientUpdateStatus === 'acknowledged' ? <span className={styles.clientAckPill}>Client contacted</span> : null}
                  </>
                );

                cards.push(
                  <ScheduledJobCard
                    key={id}
                    id={id}
                    job={job}
                    scheduleStatus={scheduleStatus}
                    dateLine={dateLine}
                    dropTarget={showInsertBefore}
                    menuActions={menuActions}
                    issueLevel={issueLevel}
                    pinned={scheduleMode === 'v2' && scheduleItem.mode === 'pinned'}
                    extraBadges={extraBadges}
                    interactionDisabled={interaction.disabled}
                    interactionDisabledReason={interaction.reason}
                    changeFeedback={changeFeedback?.projectId === scheduleItem.projectId ? changeFeedback : null}
                    sequencePosition={itemIndex + 1}
                    onMount={(node) => boardCardRefs.current.set(id, node)}
                  />,
                );
              }
              return (
                <section
                  key={installer.id}
                  className={styles.lane}
                  style={{ borderLeftColor: installer.color }}
                  data-over={laneIsOver ? 'true' : 'false'}
                  data-board-lane-id={installer.id}
                  aria-label={`Lane ${installer.name}`}
                >
                  <div className={styles.laneHeader}>
                    <div>
                      <div className={styles.laneNameRow}>
                        <span className={styles.colorDot} style={{ background: installer.color }} />
                        <h3 className={styles.laneTitle}>{installer.name}</h3>
                      </div>
                      {nextAvailable ? <div className={styles.smallMeta}>Next available: {formatShortDate(nextAvailable)}</div> : null}
                    </div>
                    <div className={styles.laneCounts}>
                      <span className={styles.muted}>
                        {ids.length} {ids.length === 1 ? 'item' : 'items'}
                      </span>
                      {issueCount > 0 ? <span className={styles.laneIssueCount}>{issueCount} attention</span> : null}
                    </div>
                  </div>
                  <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                    <LaneDropZone
                      laneId={installer.id}
                      onMount={(node) => {
                        if (node) laneBodyRefs.current.set(installer.id, node);
                        else laneBodyRefs.current.delete(installer.id);
                      }}
                    >
                      {ids.length ? (
                        <div
                          className={styles.cardList}
                          data-drop-end={insertionAtEnd ? 'true' : undefined}
                          data-drop-end-position={insertionAtEnd ? ids.length + 1 : undefined}
                        >
                          {cards}
                        </div>
                      ) : (
                        <div className={styles.emptyLane}>
                          <div className={styles.emptyLaneIcon} aria-hidden="true">
                            ↓
                          </div>
                          <p className={styles.emptyLaneTitle}>Drop jobs here</p>
                          <p className={styles.emptyLaneHint}>Drag from Unscheduled or move from another crew</p>
                        </div>
                      )}
                    </LaneDropZone>
                  </SortableContext>
                </section>
              );
            })}
          </div>
        </section>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeDragId ? (
          <div
            className={styles.dragOverlay}
            data-board-drag-overlay="true"
            data-valid={boardDropTarget?.valid ? 'true' : 'false'}
          >
            <div className={styles.jobTitle}>{overlayTitle}</div>
            <div className={styles.jobDescriptor}>{overlayDescriptor}</div>
            {overlayJob ? (
              <div className={styles.badgesRow}>
                <span className={styles.statusPill}>{formatScheduleBoardStatusLabel(overlayJob.status)}</span>
                <span className={styles.durationPill}>{overlayJob.durationLabel}</span>
              </div>
            ) : null}
            <div className={styles.dragDestination}>{dropDescription}</div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
