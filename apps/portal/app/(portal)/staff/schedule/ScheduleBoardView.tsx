'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import {
  closestCenter,
  DndContext,
  type CollisionDetection,
  type DragEndEvent,
  type DragMoveEvent,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ScheduleProjectSummary } from '@/lib/queries/schedule';
import { WORK_HOURS_PER_DAY } from '@/lib/scheduling/duration';
import { addDaysYmd } from '@/lib/scheduling/date';
import { SCHEDULE_TIME_ZONE } from '@/lib/scheduling/scheduleClock';
import { normalizeProjectStatus, projectStatusLabel } from '@/lib/types/project';
import type { Installer, ScheduleItem, ScheduleItemStatus } from '@/lib/types/scheduling';
import sharedStyles from './schedule.module.css';
import boardStyles from './scheduleBoard.module.css';
import timelineStyles from './scheduleTimeline.module.css';
import type { ScheduleBoardModel, SchedulableJob } from './ScheduleClientModel';
import { resolveBoardDropTarget, type BoardDragLane, type BoardDragPoint, type BoardDragRect, type BoardDropTarget } from './boardDrag';
import { logScheduleDebug } from './scheduleDebug';

const styles = { ...sharedStyles, ...timelineStyles, ...boardStyles };

export type ScheduleBoardMenuAction = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'danger';
};

export type ScheduleBoardDropDebug = {
  activeId: string;
  rawOverId: string | null;
  sourceLaneId: string | null;
  resolvedKind: BoardDropTarget['kind'];
  resolvedLaneId: string | null;
  insertionIndex: number | null;
  placement: 'before' | 'after' | 'end' | null;
  resolvedOverId: string | null;
  point: BoardDragPoint | null;
  activeRect: BoardDragRect | null;
  targetLaneRect: BoardDragRect | null;
  unscheduledRect: BoardDragRect | null;
  laneItemCounts: Record<string, number>;
};

export type ScheduleBoardDrop =
  | {
      kind: 'lane';
      laneId: string;
      insertionIndex: number;
      placement: 'before' | 'after' | 'end';
      overId: string | null;
      debug?: ScheduleBoardDropDebug;
    }
  | {
      kind: 'unscheduled';
      overId: 'unscheduled';
      debug?: ScheduleBoardDropDebug;
    };

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

function formatDuration(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return '—';
  const days = hours / WORK_HOURS_PER_DAY;
  const daysLabel = Number.isFinite(days) ? days.toFixed(days % 1 === 0 ? 0 : 1) : '—';
  return `${daysLabel}d`;
}

function formatHours(hours: number): string {
  if (!Number.isFinite(hours)) return '—';
  const h = hours.toFixed(hours % 1 === 0 ? 0 : 1);
  return `${h}h`;
}

function formatStatusLabel(status: string): string {
  if (!status) return '—';
  if (status.toUpperCase() === 'DOWNTIME') return 'Downtime';
  const normalized = normalizeProjectStatus(status);
  return projectStatusLabel(normalized.status);
}

function normalizeScheduleStatus(value: unknown): ScheduleItemStatus {
  const s = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (s === 'CONFIRMED' || s === 'IN_PROGRESS' || s === 'COMPLETED') return s as ScheduleItemStatus;
  return 'TENTATIVE';
}

function scheduleStatusLabel(status: ScheduleItemStatus): string {
  if (status === 'CONFIRMED') return 'Confirmed';
  if (status === 'IN_PROGRESS') return 'In progress';
  if (status === 'COMPLETED') return 'Completed';
  return 'Tentative';
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

function isLockedScheduleStatus(status: ScheduleItemStatus): boolean {
  return status === 'CONFIRMED' || status === 'IN_PROGRESS' || status === 'COMPLETED';
}

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.slice(0, 1).toUpperCase() + w.slice(1))
    .join(' ');
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

function isElementOrParentNoDnd(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest('[data-no-dnd="true"]'));
}

function rectFromElement(element: Element | null | undefined): BoardDragRect | null {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

function dragRectFromEvent(event: DragMoveEvent | DragEndEvent): BoardDragRect | null {
  const rect = ((event.active.rect?.current as any)?.translated ?? (event.active.rect?.current as any)?.initial) as
    | { left: number; top: number; width: number; height: number }
    | undefined;
  if (!rect) return null;
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

function dragPointFromEvent(event: DragMoveEvent | DragEndEvent): BoardDragPoint | null {
  const rect = dragRectFromEvent(event);
  if (!rect) return null;
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

function toBoardDrop(target: BoardDropTarget, debug?: ScheduleBoardDropDebug): ScheduleBoardDrop | null {
  if (!target.valid) return null;
  if (target.kind === 'unscheduled') return { kind: 'unscheduled', overId: target.overId, debug };
  return {
    kind: 'lane',
    laneId: target.laneId,
    insertionIndex: target.insertionIndex,
    placement: target.placement,
    overId: target.overId,
    debug,
  };
}

function boardDropSignature(target: BoardDropTarget): string {
  if (!target.valid) return `none:${target.overId ?? ''}`;
  if (target.kind === 'unscheduled') return 'unscheduled';
  return `lane:${target.laneId}:${target.insertionIndex}:${target.placement}:${target.overId ?? ''}`;
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

function JobActionsMenu({
  actions,
  ariaLabel,
}: {
  actions: ScheduleBoardMenuAction[];
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const items = actions.filter((action) => action && typeof action.onClick === 'function');

  useEffect(() => {
    if (!open) return;

    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target || !ref.current) return;
      if (!ref.current.contains(target)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!items.length) return null;

  return (
    <div
      ref={ref}
      className={styles.menuWrap}
      data-no-dnd="true"
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className={styles.kebab}
        data-no-dnd="true"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel ?? 'Job actions'}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((value) => !value);
        }}
        title="Job actions"
      >
        ⋯
      </button>
      {open ? (
        <div
          role="menu"
          className={styles.menu}
          data-no-dnd="true"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((action, idx) => (
            <button
              key={`${action.label}-${idx}`}
              type="button"
              role="menuitem"
              data-no-dnd="true"
              className={cx(styles.menuItem, action.tone === 'danger' && styles.menuItemDanger)}
              disabled={Boolean(action.disabled)}
              onPointerDown={(e) => {
                e.stopPropagation();
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (action.disabled) return;
                setOpen(false);
                window.setTimeout(() => action.onClick(), 0);
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (action.disabled) return;
                setOpen(false);
                window.setTimeout(() => action.onClick(), 0);
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function JobCardShell({
  dragId,
  title,
  descriptor,
  statusLabel,
  durationLabel,
  durationTitle,
  scheduleStatus,
  pinned,
  onOpen,
  dateLine,
  extraBadges,
  warning,
  issueLevel,
  dragProps,
  draggable,
  dragging,
  menu,
  cardRef,
  style,
  dropTarget,
}: {
  dragId?: string;
  title: string;
  descriptor: string;
  statusLabel: string;
  durationLabel: string;
  durationTitle: string;
  scheduleStatus?: ScheduleItemStatus;
  pinned?: boolean;
  onOpen?: () => void;
  dateLine?: string;
  extraBadges?: ReactNode;
  warning?: boolean;
  issueLevel?: 'warning' | 'error';
  dragProps?: Record<string, unknown>;
  draggable?: boolean;
  dragging?: boolean;
  menu?: ReactNode;
  cardRef: (node: HTMLElement | null) => void;
  style?: CSSProperties;
  dropTarget?: boolean;
}) {
  return (
    <div
      ref={cardRef}
      className={styles.jobCard}
      style={style}
      data-schedule-card-id={dragId}
      data-drop-target={dropTarget ? 'true' : 'false'}
      data-draggable={draggable ? 'true' : undefined}
      data-dragging={dragging ? 'true' : undefined}
      data-issue-level={issueLevel ?? (warning ? 'warning' : undefined)}
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      {...(dragProps as any)}
      onDoubleClick={(e) => {
        if (!onOpen || dragging || isElementOrParentNoDnd(e.target)) return;
        onOpen();
      }}
      onKeyDown={(e) => {
        if (!onOpen) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <div className={styles.jobTopRow}>
        <div className={styles.jobMain}>
          <div className={styles.jobTitle} title={title}>
            {title}
          </div>
          <div className={styles.jobDescriptor} title={descriptor}>
            {descriptor}
          </div>
        </div>

        <div className={styles.jobRight}>{menu}</div>
      </div>

      <div className={styles.badgesRow}>
        <span className={styles.statusPill}>{statusLabel}</span>
        <span className={styles.durationPill} title={durationTitle}>
          {durationLabel}
        </span>
        {pinned ? (
          <span className={styles.pinnedPill}>
            <span className={styles.pinnedDot} aria-hidden="true" />
            Pinned
          </span>
        ) : null}
        {scheduleStatus ? <span className={styles.schedulePill}>{scheduleStatusLabel(scheduleStatus)}</span> : null}
        {extraBadges}
        {issueLevel === 'error' ? <span className={styles.warnBadge}>Conflict</span> : warning || issueLevel === 'warning' ? <span className={styles.warnBadge}>Warning</span> : null}
      </div>

      {dateLine ? <div className={styles.dateLine}>{dateLine}</div> : null}
    </div>
  );
}

function UnscheduledJobCard({ job }: { job: SchedulableJob }) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: job.id,
    data: { kind: 'job' },
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.55 : 1,
  } as CSSProperties;

  return (
    <JobCardShell
      dragId={job.id}
      title={job.projectName}
      descriptor={job.descriptor}
      statusLabel={formatStatusLabel(job.status)}
      durationLabel={job.durationLabel}
      durationTitle={job.durationTitle}
      onOpen={() => router.push(`/staff/projects/${encodeURIComponent(job.projectId)}`)}
      warning={job.warnings.length > 0}
      dragProps={{ ...attributes, ...listeners }}
      draggable
      dragging={isDragging}
      cardRef={(node) => setNodeRef(node as any)}
      style={style}
    />
  );
}

function ScheduledJobCard({
  id,
  job,
  scheduleStatus,
  dateLine,
  dropTarget,
  menuActions,
  pinned,
  extraBadges,
  issueLevel,
  onMount,
}: {
  id: string;
  job: SchedulableJob | null;
  scheduleStatus: ScheduleItemStatus;
  dateLine?: string;
  dropTarget?: boolean;
  menuActions: ScheduleBoardMenuAction[];
  pinned?: boolean;
  extraBadges?: ReactNode;
  issueLevel?: 'warning' | 'error';
  onMount?: (node: HTMLElement | null) => void;
}) {
  const router = useRouter();
  const locked = isLockedScheduleStatus(scheduleStatus);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: locked });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
  } as CSSProperties;

  return (
    <JobCardShell
      dragId={id}
      title={job?.projectName ?? 'Untitled project'}
      descriptor={job?.descriptor ?? '—'}
      statusLabel={formatStatusLabel(job?.status ?? '')}
      durationLabel={job?.durationLabel ?? '—'}
      durationTitle={job?.durationTitle ?? '—'}
      scheduleStatus={scheduleStatus}
      pinned={pinned}
      extraBadges={extraBadges}
      onOpen={job ? () => router.push(`/staff/projects/${encodeURIComponent(job.projectId)}`) : undefined}
      dateLine={dateLine}
      warning={Boolean(job?.warnings?.length)}
      issueLevel={issueLevel}
      dragProps={locked ? {} : { ...attributes, ...listeners }}
      draggable={!locked}
      dragging={isDragging}
      menu={<JobActionsMenu actions={menuActions} />}
      cardRef={(node) => {
        setNodeRef(node as any);
        onMount?.(node);
      }}
      style={style}
      dropTarget={dropTarget}
    />
  );
}

function DowntimeCard({
  id,
  item,
  dateLine,
  dropTarget,
  menuActions,
  issueLevel,
  onMount,
}: {
  id: string;
  item: ScheduleItem;
  dateLine?: string;
  dropTarget?: boolean;
  menuActions: ScheduleBoardMenuAction[];
  issueLevel?: 'warning' | 'error';
  onMount?: (node: HTMLElement | null) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
  } as CSSProperties;

  const durationHours =
    typeof item.durationHoursOverride === 'number' && Number.isFinite(item.durationHoursOverride) && item.durationHoursOverride > 0
      ? item.durationHoursOverride
      : typeof item.forecastDurationDays === 'number' && Number.isFinite(item.forecastDurationDays) && item.forecastDurationDays > 0
        ? item.forecastDurationDays * WORK_HOURS_PER_DAY
        : WORK_HOURS_PER_DAY;

  const reason = item.downtimeReason ? titleCase(item.downtimeReason) : 'Downtime';

  return (
    <JobCardShell
      dragId={id}
      title={reason}
      descriptor={item.downtimeNote ?? 'Crew unavailable'}
      statusLabel="Downtime"
      durationLabel={formatDuration(durationHours)}
      durationTitle={formatHours(durationHours)}
      dateLine={dateLine}
      issueLevel={issueLevel}
      dragProps={{ ...attributes, ...listeners }}
      draggable
      dragging={isDragging}
      menu={<JobActionsMenu actions={menuActions} ariaLabel="Downtime actions" />}
      cardRef={(node) => {
        setNodeRef(node as any);
        onMount?.(node);
      }}
      style={style}
      dropTarget={dropTarget}
    />
  );
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
  buildJobMenuActions,
  buildDowntimeMenuActions,
}: ScheduleBoardViewProps) {
  const boardScrollRef = useRef<HTMLDivElement | null>(null);
  const laneBodyRefs = useRef(new Map<string, HTMLDivElement | null>());
  const boardCardRefs = useRef(new Map<string, HTMLElement | null>());
  const unscheduledBodyRef = useRef<HTMLDivElement | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [overLaneId, setOverLaneId] = useState<string | null>(null);
  const [boardDropTarget, setBoardDropTarget] = useState<BoardDropTarget | null>(null);
  const lastDropTargetSignatureRef = useRef<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function buildBoardDragLanes(): BoardDragLane[] {
    return installers
      .filter((installer) => installer.active)
      .map((installer) => {
        const items = laneItems.get(installer.id) ?? [];
        const itemRects: BoardDragLane['itemRects'] = {};
        for (const item of items) {
          itemRects[item.id] = rectFromElement(boardCardRefs.current.get(item.id));
        }
        return {
          id: installer.id,
          itemIds: items.map((item) => item.id),
          rect: rectFromElement(laneBodyRefs.current.get(installer.id) ?? null),
          itemRects,
        };
      });
  }

  function resolveBoardDrop(event: DragMoveEvent | DragEndEvent): { target: BoardDropTarget; debug: ScheduleBoardDropDebug } {
    const activeId = String(event.active.id);
    const eventOverId = event.over ? String(event.over.id) : null;
    const activeItem = scheduleItemById.get(activeId) ?? null;
    const sourceLaneId = activeItem?.installerId ?? null;
    const lanes = buildBoardDragLanes();
    const point = dragPointFromEvent(event);
    const unscheduledRect = rectFromElement(unscheduledBodyRef.current);
    const target = resolveBoardDropTarget({
      activeId,
      sourceLaneId,
      overId: eventOverId,
      point,
      lanes,
      unscheduledRect,
    });
    const resolvedLaneId = target.valid && target.kind === 'lane' ? target.laneId : null;
    const targetLaneRect = resolvedLaneId ? (lanes.find((lane) => lane.id === resolvedLaneId)?.rect ?? null) : null;
    const laneItemCounts = Object.fromEntries(lanes.map((lane) => [lane.id, lane.itemIds.length]));
    return {
      target,
      debug: {
        activeId,
        rawOverId: eventOverId,
        sourceLaneId,
        resolvedKind: target.kind,
        resolvedLaneId,
        insertionIndex: target.valid && target.kind === 'lane' ? target.insertionIndex : null,
        placement: target.valid && target.kind === 'lane' ? target.placement : null,
        resolvedOverId: target.overId,
        point,
        activeRect: dragRectFromEvent(event),
        targetLaneRect,
        unscheduledRect,
        laneItemCounts,
      },
    };
  }

  function applyBoardDropTarget(target: BoardDropTarget, debug: ScheduleBoardDropDebug, phase: 'over' | 'move'): void {
    const signature = boardDropSignature(target);
    if (lastDropTargetSignatureRef.current !== signature) {
      lastDropTargetSignatureRef.current = signature;
      logScheduleDebug('board.drop.target', { phase, ...debug });
    }
    setBoardDropTarget(target);
    if (!target.valid) {
      setOverId(null);
      setOverLaneId(null);
      return;
    }
    if (target.kind === 'unscheduled') {
      setOverId('unscheduled');
      setOverLaneId(null);
      return;
    }
    setOverId(target.overId);
    setOverLaneId(target.laneId);
  }

  function clearBoardDragState(): void {
    setActiveDragId(null);
    setOverId(null);
    setOverLaneId(null);
    setBoardDropTarget(null);
    lastDropTargetSignatureRef.current = null;
  }

  function handleDragMove(event: DragMoveEvent) {
    if (!activeDragId) return;

    const { target, debug } = resolveBoardDrop(event);
    applyBoardDropTarget(target, debug, 'move');

    const point = dragPointFromEvent(event);
    if (!point) return;

    const edgePx = 80;
    const stepPx = 32;

    const board = boardScrollRef.current;
    if (board) {
      const br = board.getBoundingClientRect();
      if (point.x < br.left + edgePx) board.scrollLeft -= stepPx;
      else if (point.x > br.right - edgePx) board.scrollLeft += stepPx;
    }

    const verticalTarget =
      target.valid && target.kind === 'unscheduled'
        ? unscheduledBodyRef.current
        : target.valid && target.kind === 'lane'
          ? laneBodyRefs.current.get(target.laneId) ?? null
          : null;
    if (verticalTarget) {
      const vr = verticalTarget.getBoundingClientRect();
      if (point.y < vr.top + edgePx) verticalTarget.scrollTop -= stepPx;
      else if (point.y > vr.bottom - edgePx) verticalTarget.scrollTop += stepPx;
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const { target, debug } = resolveBoardDrop(event);
    const drop = toBoardDrop(target, debug);
    logScheduleDebug('board.drop.end', { ...debug, valid: Boolean(drop) });
    clearBoardDragState();
    if (!drop) return;
    onDrop(activeId, drop);
  }

  const overlayJob = activeDragId ? schedulable.jobsById.get(activeDragId) ?? null : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={boardCollisionDetection}
      autoScroll={false}
      onDragStart={(event) => {
        setActiveDragId(String(event.active.id));
        setBoardDropTarget(null);
        lastDropTargetSignatureRef.current = null;
      }}
      onDragOver={(event) => {
        const { target, debug } = resolveBoardDrop(event);
        applyBoardDropTarget(target, debug, 'over');
      }}
      onDragMove={handleDragMove}
      onDragCancel={clearBoardDragState}
      onDragEnd={handleDragEnd}
    >
      <div className={styles.panels}>
        <aside className={cx(styles.leftPanel, unscheduledCollapsed && styles.leftPanelCollapsed)} aria-label="Unscheduled jobs">
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
              className={styles.input}
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
                  <UnscheduledJobCard key={job.id} job={job} />
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
          <div className={styles.legendRow} aria-label="Schedule controls">
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
            <label className={styles.toggleControl}>
              <input
                type="checkbox"
                className={styles.toggleCheckbox}
                checked={showCompleted}
                onChange={(e) => onShowCompletedChange(e.target.checked)}
              />
              Show completed jobs
            </label>
          </div>
          <div className={styles.lanes} ref={boardScrollRef}>
            {installers.filter((installer) => installer.active).map((installer) => {
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

              const cards: ReactNode[] = [];
              for (const id of ids) {
                const showInsertBefore = Boolean(laneDropTarget && laneDropTarget.overId === id && activeDragId !== id && activeDragId);
                if (showInsertBefore) cards.push(<div key={`insert-${id}`} className={styles.insertionMarker} aria-hidden="true" />);

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
                      dropTarget={overId === id && activeDragId !== id}
                      menuActions={downtimeActions}
                      issueLevel={issueLevel}
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
                    {!hasPlannedCommitment(scheduleItem) ? <span className={styles.draftPill}>Draft</span> : null}
                    {hasPlannedCommitment(scheduleItem) && commitmentLabel ? <span className={styles.commitmentPill}>{commitmentLabel}</span> : null}
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
                    dropTarget={overId === id && activeDragId !== id}
                    menuActions={menuActions}
                    issueLevel={issueLevel}
                    pinned={scheduleMode === 'v2' && scheduleItem.mode === 'pinned'}
                    extraBadges={extraBadges}
                    onMount={(node) => boardCardRefs.current.set(id, node)}
                  />,
                );
              }
              if (insertionAtEnd) cards.push(<div key="insert-end" className={styles.insertionMarker} aria-hidden="true" />);

              return (
                <section
                  key={installer.id}
                  className={styles.lane}
                  style={{ borderLeftColor: installer.color }}
                  data-over={laneIsOver ? 'true' : 'false'}
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
                    <span className={styles.muted}>{ids.length}</span>
                  </div>
                  <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                    <LaneDropZone laneId={installer.id} onMount={(node) => laneBodyRefs.current.set(installer.id, node)}>
                      {ids.length ? (
                        <div className={styles.cardList}>
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

      <DragOverlay>
        {overlayJob ? (
          <div className={styles.dragOverlay}>
            <div className={styles.jobTitle}>{overlayJob.projectName}</div>
            <div className={styles.jobDescriptor}>{overlayJob.descriptor}</div>
            <div className={styles.badgesRow}>
              <span className={styles.statusPill}>{formatStatusLabel(overlayJob.status)}</span>
              <span className={styles.durationPill}>{overlayJob.durationLabel}</span>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
