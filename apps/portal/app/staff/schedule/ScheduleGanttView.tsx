'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Estimate } from '@/lib/types/estimate';
import type { Installer, ScheduleItem, SchedulingIssue } from '@/lib/types/scheduling';
import type { ScheduleProjectSummary } from '@/lib/queries/schedule';
import { addDaysYmd, diffDaysYmd, isYmd } from '@/lib/scheduling/date';
import { trapTabKey } from '@/components/ui/focusTrap';
import { lockDocumentScroll, unlockDocumentScroll } from '@/components/ui/scrollLock';
import {
  axisXForDayIndex,
  GANTT_WEEKEND_WEIGHT,
  snapAxisDayDeltaForPixelDelta,
} from './ganttAxis';
import {
  addWorkingDaysInclusive,
  buildGanttAttentionReasons,
  buildScheduleGanttModel,
  canAdjustGanttTiming,
  canEditGanttCommitment,
  clampGanttLabelWidthToBounds,
  formatShortDate,
  GANTT_DEFAULT_ZOOM_WEEKS,
  GANTT_LABEL_DEFAULT_PX,
  GANTT_LABEL_KEYBOARD_STEP_PX,
  ganttLabelWidthBoundsForViewport,
  hasPlannedCommitment,
  normalizeGanttZoomWeeks,
  prefersReducedMotion,
  readGanttDensityPreference,
  readGanttLabelWidthPreference,
  snapToWeekdayYmd,
  snapToWeekdayYmdDirectional,
  workingDaysInclusive,
  writeGanttDensityPreference,
  writeGanttLabelWidthPreference,
  type GanttDensity,
  type GanttDragPreview,
  type GanttLabelWidthBounds,
  type GanttRow,
  type GanttZoomWeeks,
  type ScheduleGanttBar,
} from './ScheduleGanttModel';
import ScheduleGanttTimeline, { type GanttEmptyState } from './ScheduleGanttTimeline';
import ScheduleGanttToolbar, { type GanttAttentionMode } from './ScheduleGanttToolbar';
import { useScheduleCrewVisibility } from './useScheduleCrewVisibility';
import sharedStyles from './schedule.module.css';
import ganttStyles from './scheduleGantt.module.css';
import timelineStyles from './scheduleTimeline.module.css';

const styles = { ...sharedStyles, ...timelineStyles, ...ganttStyles };

type GanttPopoverAnchor = {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

type GanttPopoverAction = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'danger';
  shortcut?: string;
};

export type ScheduleGanttViewProps = {
  today: string;
  scheduleMode: 'v2' | 'legacy';
  installers: Installer[];
  laneItems: Map<string, ScheduleItem[]>;
  visibleScheduleItems: ScheduleItem[];
  projectsById: Map<string, ScheduleProjectSummary>;
  estimatesById: Map<string, Estimate>;
  scheduleBars: ScheduleGanttBar[];
  scheduleIssues: SchedulingIssue[];
  holidays: Array<{ date: string; name?: string; kind: 'holiday' }>;
  showCompleted: boolean;
  onShowCompletedChange: (next: boolean) => void;
  onOpenProject: (projectId: string) => void;
  onOpenProjectPack: (projectId: string, estimateId: string) => void;
  onOpenCommitmentEdit: (scheduleItemId: string, mode: 'lock' | 'reschedule') => void;
  onOpenPinEdit: (scheduleItemId: string, requestedStart: string) => void;
  onUnpinScheduleItem: (scheduleItemId: string) => void;
  onAckClientUpdate: (scheduleItemId: string) => void;
  onMovePin: (scheduleItemId: string, requestedStart: string, durationDays: number) => void;
  onResizePin: (scheduleItemId: string, requestedStart: string, durationDays: number) => void;
};

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

function isTextInputLikeTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

function computeGanttPopoverPosition(anchor: GanttPopoverAnchor): { top: number; left: number } {
  const width = 300;
  const margin = 12;
  const gap = 10;
  if (typeof window === 'undefined') return { top: anchor.bottom + gap, left: anchor.left };
  const maxLeft = Math.max(margin, window.innerWidth - width - margin);
  const left = Math.min(Math.max(anchor.left, margin), maxLeft);
  const preferredTop = anchor.bottom + gap;
  const estimatedHeight = 340;
  const canOpenBelow = preferredTop + estimatedHeight <= window.innerHeight - margin;
  const top = canOpenBelow ? preferredTop : Math.max(margin, anchor.top - estimatedHeight - gap);
  return { top, left };
}

function GanttBarPopover({
  anchor,
  actions,
  details,
  onClose,
  onKeyDown,
  focusRef,
}: {
  anchor: GanttPopoverAnchor;
  actions: GanttPopoverAction[];
  details?: React.ReactNode;
  onClose: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  focusRef: React.RefObject<HTMLDivElement | null>;
}) {
  const pos = computeGanttPopoverPosition(anchor);
  useEffect(() => {
    lockDocumentScroll();
    return () => unlockDocumentScroll();
  }, []);

  return (
    <>
      <div className={styles.ganttPopoverBackdrop} onPointerDown={onClose} onMouseDown={onClose} />
      <div
        ref={focusRef}
        tabIndex={-1}
        className={styles.ganttPopover}
        style={{ top: pos.top, left: pos.left }}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(event) => {
          trapTabKey(event.nativeEvent, event.currentTarget);
          onKeyDown(event);
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Gantt quick actions"
        data-modal-panel="true"
      >
        {details ? <div className={styles.ganttPopoverDetails}>{details}</div> : null}
        <div className={styles.ganttPopoverActionList}>
          {actions.map((action, actionIndex) => (
            <button
              key={`${action.label}-${actionIndex}`}
              type="button"
              className={cx(styles.ganttPopoverAction, action.tone === 'danger' && styles.ganttPopoverActionDanger)}
              disabled={Boolean(action.disabled)}
              onClick={() => action.onClick()}
            >
              <span>{action.label}</span>
              {action.shortcut ? <span className={styles.ganttPopoverShortcut}>{action.shortcut}</span> : null}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

export default function ScheduleGanttView({
  today,
  scheduleMode,
  installers,
  laneItems,
  visibleScheduleItems,
  projectsById,
  estimatesById,
  scheduleBars,
  scheduleIssues,
  holidays,
  showCompleted,
  onShowCompletedChange,
  onOpenProject,
  onOpenProjectPack,
  onOpenCommitmentEdit,
  onOpenPinEdit,
  onUnpinScheduleItem,
  onAckClientUpdate,
  onMovePin,
  onResizePin,
}: ScheduleGanttViewProps) {
  const ganttScrollRef = useRef<HTMLDivElement | null>(null);
  const ganttPopoverRef = useRef<HTMLDivElement | null>(null);
  const ganttPopoverTriggerRef = useRef<HTMLElement | null>(null);
  const labelWidthPxRef = useRef(GANTT_LABEL_DEFAULT_PX);
  const pendingZoomAnchorRef = useRef<{ date: string; viewportOffsetPx: number } | null>(null);
  const ganttDragDeltaRef = useRef(0);
  const ganttDragMovedRef = useRef(false);
  const ganttClickBlockUntilRef = useRef(0);
  const scheduleItemById = useMemo(() => new Map(visibleScheduleItems.map((item) => [item.id, item] as const)), [visibleScheduleItems]);
  const scheduleItemByIdRef = useRef(scheduleItemById);
  const scheduleBarById = useMemo(
    () => new Map(scheduleBars.map((bar) => [bar.scheduleItemId, bar] as const)),
    [scheduleBars],
  );
  const scheduleBarByIdRef = useRef(scheduleBarById);

  const [zoomWeeks, setZoomWeeks] = useState<GanttZoomWeeks>(GANTT_DEFAULT_ZOOM_WEEKS);
  const [ganttDensity, setGanttDensity] = useState<GanttDensity>(() => readGanttDensityPreference());
  const [preferredLabelWidthPx, setPreferredLabelWidthPx] = useState<number>(() => readGanttLabelWidthPreference());
  const [narrowLabelWidthPx, setNarrowLabelWidthPx] = useState<number | null>(null);
  const [ganttViewportWidthPx, setGanttViewportWidthPx] = useState(0);
  const [collapsedCrews, setCollapsedCrews] = useState<Record<string, boolean>>({});
  const [showPlanned, setShowPlanned] = useState(true);
  const [attentionMode, setAttentionMode] = useState<GanttAttentionMode>('all');
  const [ganttLabelResize, setGanttLabelResize] = useState<{
    startX: number;
    startWidth: number;
    bounds: GanttLabelWidthBounds;
  } | null>(null);
  const [ganttPopover, setGanttPopover] = useState<{ scheduleItemId: string; anchor: GanttPopoverAnchor } | null>(null);
  const [ganttDrag, setGanttDrag] = useState<GanttDragPreview | null>(null);
  const [ganttDragDelta, setGanttDragDelta] = useState(0);
  const [ganttDragPointer, setGanttDragPointer] = useState<{ x: number; y: number } | null>(null);
  const activeInstallers = useMemo(() => installers.filter((installer) => installer.active), [installers]);
  const activeInstallerIds = useMemo(() => activeInstallers.map((installer) => installer.id), [activeInstallers]);
  const { hiddenCrewIds, toggleCrew, hideCrews, showAllCrews } = useScheduleCrewVisibility(activeInstallerIds);
  const crewFilterOptions = useMemo(
    () => activeInstallers.map((installer) => ({
      id: installer.id,
      name: installer.name,
      color: installer.color,
      itemCount: (laneItems.get(installer.id) ?? []).length,
    })),
    [activeInstallers, laneItems],
  );
  const emptyCrewIds = useMemo(
    () => crewFilterOptions.filter((crew) => crew.itemCount === 0).map((crew) => crew.id),
    [crewFilterOptions],
  );
  const hiddenItemCount = useMemo(
    () => crewFilterOptions.reduce(
      (count, crew) => count + (hiddenCrewIds.has(crew.id) ? crew.itemCount : 0),
      0,
    ),
    [crewFilterOptions, hiddenCrewIds],
  );
  const visibleInstallers = useMemo(
    () => activeInstallers.filter((installer) => !hiddenCrewIds.has(installer.id)),
    [activeInstallers, hiddenCrewIds],
  );
  const attentionReasonsByScheduleId = useMemo(
    () => buildGanttAttentionReasons(visibleScheduleItems, scheduleIssues),
    [scheduleIssues, visibleScheduleItems],
  );
  const visibleAttentionItemIds = useMemo(() => {
    const ids = new Set<string>();
    for (const installer of visibleInstallers) {
      for (const item of laneItems.get(installer.id) ?? []) {
        if (attentionReasonsByScheduleId.has(item.id)) ids.add(item.id);
      }
    }
    return ids;
  }, [attentionReasonsByScheduleId, laneItems, visibleInstallers]);
  const displayInstallers = useMemo(
    () => attentionMode === 'all'
      ? visibleInstallers
      : visibleInstallers.filter((installer) =>
          (laneItems.get(installer.id) ?? []).some((item) => visibleAttentionItemIds.has(item.id))),
    [attentionMode, laneItems, visibleAttentionItemIds, visibleInstallers],
  );
  const displayLaneItems = useMemo(() => {
    if (attentionMode === 'all') return laneItems;
    const filtered = new Map<string, ScheduleItem[]>();
    for (const installer of displayInstallers) {
      filtered.set(
        installer.id,
        (laneItems.get(installer.id) ?? []).filter((item) => visibleAttentionItemIds.has(item.id)),
      );
    }
    return filtered;
  }, [attentionMode, displayInstallers, laneItems, visibleAttentionItemIds]);
  const labelWidthBounds = useMemo(() => ganttLabelWidthBoundsForViewport(ganttViewportWidthPx), [ganttViewportWidthPx]);
  const labelWidthPx = clampGanttLabelWidthToBounds(
    labelWidthBounds.narrow ? narrowLabelWidthPx ?? labelWidthBounds.max : preferredLabelWidthPx,
    labelWidthBounds,
  );

  const applyInteractiveLabelWidth = useCallback((value: number, bounds: GanttLabelWidthBounds) => {
    const next = clampGanttLabelWidthToBounds(value, bounds);
    labelWidthPxRef.current = next;
    if (bounds.narrow) {
      setNarrowLabelWidthPx(next);
      return next;
    }
    setPreferredLabelWidthPx(next);
    return next;
  }, []);

  useEffect(() => {
    scheduleItemByIdRef.current = scheduleItemById;
  }, [scheduleItemById]);

  useEffect(() => {
    scheduleBarByIdRef.current = scheduleBarById;
  }, [scheduleBarById]);

  useEffect(() => {
    writeGanttDensityPreference(ganttDensity);
  }, [ganttDensity]);

  useEffect(() => {
    labelWidthPxRef.current = labelWidthPx;
  }, [labelWidthPx]);

  useLayoutEffect(() => {
    const scroller = ganttScrollRef.current;
    if (!scroller) return;
    const updateViewportWidth = () => {
      const next = Math.max(0, Math.floor(scroller.clientWidth));
      setGanttViewportWidthPx((current) => (current === next ? current : next));
    };
    updateViewportWidth();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateViewportWidth) : null;
    observer?.observe(scroller);
    window.addEventListener('resize', updateViewportWidth);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateViewportWidth);
    };
  }, []);

  const gantt = useMemo(() => buildScheduleGanttModel({
    today,
    scheduleMode,
    installers: displayInstallers,
    laneItems: displayLaneItems,
    visibleScheduleItems,
    projectsById,
    estimatesById,
    scheduleBars,
    scheduleIssues,
    holidays,
    collapsedCrews,
    showPlanned,
    zoomWeeks,
    ganttDrag,
    ganttDragDelta,
    scheduleItemById,
    attentionReasonsByScheduleId,
  }), [
    attentionReasonsByScheduleId,
    collapsedCrews,
    displayInstallers,
    displayLaneItems,
    estimatesById,
    ganttDrag,
    ganttDragDelta,
    holidays,
    projectsById,
    scheduleBars,
    scheduleIssues,
    scheduleItemById,
    scheduleMode,
    showPlanned,
    today,
    visibleScheduleItems,
    zoomWeeks,
  ]);

  const activeGanttPopoverRow = useMemo(() => {
    if (!ganttPopover) return null;
    return gantt.rows.find((row): row is Extract<GanttRow, { kind: 'item' }> => row.kind === 'item' && row.scheduleItemId === ganttPopover.scheduleItemId) ?? null;
  }, [gantt.rows, ganttPopover]);
  const ganttPopoverScheduleItemId = ganttPopover?.scheduleItemId ?? null;
  const activeGanttPopoverScheduleItemId = activeGanttPopoverRow?.scheduleItemId ?? null;

  const activeGanttDragRow = useMemo(() => {
    if (!ganttDrag) return null;
    return gantt.rows.find((row): row is Extract<GanttRow, { kind: 'item' }> => row.kind === 'item' && row.scheduleItemId === ganttDrag.id) ?? null;
  }, [gantt.rows, ganttDrag]);

  const activeGanttDragIsStale = useMemo(() => {
    if (!ganttDrag) return false;
    const item = scheduleItemById.get(ganttDrag.id) ?? null;
    const bar = scheduleBarById.get(ganttDrag.id) ?? null;
    return (
      scheduleMode !== 'v2' ||
      !canAdjustGanttTiming(item) ||
      item?.updatedAt !== ganttDrag.itemUpdatedAt ||
      bar?.startDate !== ganttDrag.startDate ||
      bar?.endDate !== ganttDrag.endDate
    );
  }, [ganttDrag, scheduleBarById, scheduleItemById, scheduleMode]);

  useEffect(() => {
    if (!ganttDrag || (activeGanttDragRow && !activeGanttDragIsStale)) return;
    ganttDragDeltaRef.current = 0;
    ganttDragMovedRef.current = false;
    setGanttDrag(null);
    setGanttDragDelta(0);
    setGanttDragPointer(null);
  }, [activeGanttDragIsStale, activeGanttDragRow, ganttDrag]);

  const ganttDragFeedback = useMemo(() => {
    if (!ganttDrag || !activeGanttDragRow) return null;
    return {
      mode: ganttDrag.mode,
      startDate: activeGanttDragRow.startDate,
      endDate: activeGanttDragRow.endDate,
      durationDays: Math.max(1, activeGanttDragRow.durationDays),
      snapLinePx: ganttDrag.mode === 'resize' ? activeGanttDragRow.barLeftPx + activeGanttDragRow.barWidthPx : activeGanttDragRow.barLeftPx,
    };
  }, [activeGanttDragRow, ganttDrag]);

  const closeGanttPopover = useCallback(() => {
    const trigger = ganttPopoverTriggerRef.current;
    setGanttPopover(null);
    window.setTimeout(() => {
      if (trigger?.isConnected) trigger.focus();
    }, 0);
  }, []);

  const ganttPopoverDetails = useMemo(() => {
    if (!ganttPopover || !activeGanttPopoverRow) return null;
    const row = activeGanttPopoverRow;
    if (row.isDowntime) return null;
    const scheduleItem = scheduleItemById.get(row.scheduleItemId) ?? null;
    if (!scheduleItem || scheduleItem.itemType === 'downtime') return null;
    const isPinned = scheduleItem.mode === 'pinned';
    const hasCommitment = hasPlannedCommitment(scheduleItem);
    const clientUpdateStatus = scheduleItem.clientUpdateStatus ?? 'none';
    const timingAdjustable = scheduleMode === 'v2' && canAdjustGanttTiming(scheduleItem);
    const commitmentEditable = canEditGanttCommitment(scheduleMode, scheduleItem);
    const closeAndRun = (action: () => void, restoreFocus = false) => {
      if (restoreFocus) closeGanttPopover();
      else setGanttPopover(null);
      action();
    };
    const details = (
      <>
        <div className={styles.ganttPopoverTitle}>{row.projectName}</div>
        <div className={styles.ganttPopoverMeta}>
          Planned: {hasCommitment ? row.plannedCommitmentLabel ?? 'Committed' : 'Draft'}
          {hasCommitment && row.plannedDurationDays ? ` - ~${row.plannedDurationDays}d` : ''}
          {hasCommitment && typeof row.plannedFlexDays === 'number' ? ` - flex ${row.plannedFlexDays}wd` : ''}
        </div>
        <div className={styles.ganttPopoverMeta}>
          Forecast: {formatShortDate(row.startDate)} - {formatShortDate(row.endDate)} - {row.durationLabel}
        </div>
        {hasCommitment && typeof row.driftDays === 'number' ? (
          <div className={styles.ganttPopoverMeta}>Drift: +{row.driftDays} working day{row.driftDays === 1 ? '' : 's'}</div>
        ) : null}
        {clientUpdateStatus === 'needed' ? <div className={styles.clientUpdatePill}>Client update needed</div> : null}
        {clientUpdateStatus === 'acknowledged' ? <div className={styles.clientAckPill}>Client contacted</div> : null}
      </>
    );
    const openProjectAction = () => closeAndRun(() => onOpenProject(row.projectId));
    const pinAction = timingAdjustable
      ? () => {
          const latest = scheduleItemByIdRef.current.get(row.scheduleItemId) ?? null;
          if (scheduleMode !== 'v2' || !canAdjustGanttTiming(latest)) return;
          const latestIsPinned = latest?.mode === 'pinned';
          closeAndRun(() => {
            if (latestIsPinned) {
              onUnpinScheduleItem(row.scheduleItemId);
              return;
            }
            onOpenPinEdit(
              row.scheduleItemId,
              isYmd(latest?.forecastStart ?? '') ? latest?.forecastStart ?? '' : row.startDate,
            );
          }, latestIsPinned);
        }
      : undefined;
    const actions: GanttPopoverAction[] = [
      { label: 'Open project', shortcut: 'Enter', onClick: openProjectAction },
      {
        label: 'Open project pack',
        onClick: () => closeAndRun(() => onOpenProjectPack(row.projectId, row.estimateId)),
      },
    ];
    if (commitmentEditable) {
      actions.push({
        label: hasCommitment ? 'Reschedule...' : 'Lock schedule...',
        onClick: () => {
          const latest = scheduleItemByIdRef.current.get(row.scheduleItemId) ?? null;
          if (!latest || !canEditGanttCommitment(scheduleMode, latest)) return;
          closeAndRun(() =>
            onOpenCommitmentEdit(
              row.scheduleItemId,
              hasPlannedCommitment(latest) ? 'reschedule' : 'lock',
            ));
        },
      });
    }
    if (scheduleMode === 'v2' && clientUpdateStatus === 'needed') {
      actions.push({
        label: 'Mark client contacted',
        onClick: () => closeAndRun(() => onAckClientUpdate(row.scheduleItemId), true),
      });
    } else if (scheduleMode === 'v2' && clientUpdateStatus === 'acknowledged') {
      actions.push({ label: 'Client contacted', onClick: () => {}, disabled: true });
    }
    if (pinAction) {
      actions.push({ label: isPinned ? 'Unpin' : 'Pin...', shortcut: 'P', onClick: pinAction });
    }

    return {
      details,
      actions,
      openProjectAction,
      pinAction,
    };
  }, [
    activeGanttPopoverRow,
    closeGanttPopover,
    ganttPopover,
    onAckClientUpdate,
    onOpenCommitmentEdit,
    onOpenPinEdit,
    onOpenProject,
    onOpenProjectPack,
    onUnpinScheduleItem,
    scheduleItemById,
    scheduleMode,
  ]);

  useLayoutEffect(() => {
    const anchor = pendingZoomAnchorRef.current;
    if (!anchor) return;
    const scroller = ganttScrollRef.current;
    if (!scroller || gantt.axis.rangeDays <= 0) {
      pendingZoomAnchorRef.current = null;
      return;
    }
    const rawIndex = diffDaysYmd(gantt.rangeStart, anchor.date);
    const dayIndex = Math.max(0, Math.min(gantt.axis.rangeDays - 1, rawIndex));
    const nextTodayAbsolutePx = labelWidthPx + axisXForDayIndex(gantt.axis, dayIndex);
    const maxLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    scroller.scrollLeft = Math.max(0, Math.min(maxLeft, nextTodayAbsolutePx - anchor.viewportOffsetPx));
    pendingZoomAnchorRef.current = null;
  }, [gantt.axis.boundaryPx, gantt.axis.rangeDays, gantt.rangeStart, gantt.totalWidth, labelWidthPx, zoomWeeks]);

  useEffect(() => {
    if (!ganttPopoverScheduleItemId) return;
    if (activeGanttPopoverScheduleItemId !== ganttPopoverScheduleItemId) {
      setGanttPopover(null);
      return;
    }
    const timer = window.setTimeout(() => ganttPopoverRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [activeGanttPopoverScheduleItemId, ganttPopoverScheduleItemId]);

  useEffect(() => {
    if (!ganttDrag) return;

    const onMove = (e: PointerEvent) => {
      const deltaPx = e.clientX - ganttDrag.originX;
      setGanttDragPointer({ x: e.clientX, y: e.clientY });
      if (Math.abs(deltaPx) > 3) ganttDragMovedRef.current = true;
      const anchorDate = ganttDrag.mode === 'resize' ? ganttDrag.endDate : ganttDrag.startDate;
      const rawDelta = snapAxisDayDeltaForPixelDelta({
        startDate: anchorDate,
        deltaPx,
        baseDayPx: gantt.axis.baseDayPx,
        weekendWeight: GANTT_WEEKEND_WEIGHT,
        maxSteps: gantt.rangeDays + 21,
      });
      const requested = addDaysYmd(anchorDate, rawDelta);
      const snapped = snapToWeekdayYmdDirectional(requested, rawDelta);
      const nextDelta = diffDaysYmd(anchorDate, snapped);
      if (nextDelta !== ganttDragDeltaRef.current) {
        ganttDragDeltaRef.current = nextDelta;
        setGanttDragDelta(nextDelta);
      }
    };

    const onUp = () => {
      const deltaDays = ganttDragDeltaRef.current;
      const moved = ganttDragMovedRef.current;
      ganttDragDeltaRef.current = 0;
      ganttDragMovedRef.current = false;
      setGanttDrag(null);
      setGanttDragDelta(0);
      setGanttDragPointer(null);
      if (moved) ganttClickBlockUntilRef.current = Date.now() + 250;
      if (!moved || deltaDays === 0) return;

      const item = scheduleItemByIdRef.current.get(ganttDrag.id) ?? null;
      const currentBar = scheduleBarByIdRef.current.get(ganttDrag.id) ?? null;
      if (
        !item ||
        scheduleMode !== 'v2' ||
        !canAdjustGanttTiming(item) ||
        item.updatedAt !== ganttDrag.itemUpdatedAt ||
        currentBar?.startDate !== ganttDrag.startDate ||
        currentBar?.endDate !== ganttDrag.endDate
      ) {
        return;
      }
      if (ganttDrag.mode === 'move') {
        const requested = addDaysYmd(ganttDrag.startDate, deltaDays);
        const snapped = snapToWeekdayYmdDirectional(requested, deltaDays);
        onMovePin(ganttDrag.id, snapped, Math.max(1, ganttDrag.durationDays));
        return;
      }
      const baseStart = item.forecastStart ?? ganttDrag.startDate;
      const snappedStart = snapToWeekdayYmd(baseStart);
      const requestedEnd = addDaysYmd(ganttDrag.endDate, deltaDays);
      const snappedEnd = snapToWeekdayYmdDirectional(requestedEnd, deltaDays);
      const nextDuration = Math.max(1, workingDaysInclusive(snappedStart, snappedEnd));
      onResizePin(ganttDrag.id, snappedStart, nextDuration);
    };
    const onCancel = () => {
      const moved = ganttDragMovedRef.current;
      ganttDragDeltaRef.current = 0;
      ganttDragMovedRef.current = false;
      setGanttDrag(null);
      setGanttDragDelta(0);
      setGanttDragPointer(null);
      if (moved) ganttClickBlockUntilRef.current = Date.now() + 250;
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('blur', onCancel);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('blur', onCancel);
    };
  }, [gantt.axis.baseDayPx, gantt.rangeDays, ganttDrag, onMovePin, onResizePin, scheduleMode]);

  useEffect(() => {
    if (!ganttLabelResize) return;
    const onMove = (event: PointerEvent) => {
      applyInteractiveLabelWidth(ganttLabelResize.startWidth + event.clientX - ganttLabelResize.startX, ganttLabelResize.bounds);
    };
    const onUp = () => {
      if (!ganttLabelResize.bounds.narrow) writeGanttLabelWidthPreference(labelWidthPxRef.current);
      setGanttLabelResize(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('blur', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('blur', onUp);
    };
  }, [applyInteractiveLabelWidth, ganttLabelResize]);

  const handleGanttZoomWeeksChange = (next: GanttZoomWeeks) => {
    if (next === zoomWeeks) return;
    const scroller = ganttScrollRef.current;
    if (scroller && gantt.axis.rangeDays > 0) {
      const timelineViewportWidth = Math.max(0, scroller.clientWidth - labelWidthPx);
      const todayViewportOffsetPx = labelWidthPx + gantt.todayLinePx - scroller.scrollLeft;
      const minVisiblePx = labelWidthPx + 8;
      const maxVisiblePx = Math.max(minVisiblePx, scroller.clientWidth - 8);
      const fallbackVisiblePx = labelWidthPx + timelineViewportWidth * 0.3;
      pendingZoomAnchorRef.current = {
        date: gantt.displayToday,
        viewportOffsetPx: todayViewportOffsetPx >= minVisiblePx && todayViewportOffsetPx <= maxVisiblePx ? todayViewportOffsetPx : fallbackVisiblePx,
      };
    }
    setZoomWeeks(next);
  };

  const jumpGanttToToday = () => {
    const scroller = ganttScrollRef.current;
    if (!scroller) return;
    const timelineViewportWidth = Math.max(0, scroller.clientWidth - labelWidthPx);
    const todayAbsolutePx = labelWidthPx + gantt.todayLinePx;
    const targetLeft = Math.max(0, todayAbsolutePx - (labelWidthPx + timelineViewportWidth * 0.3));
    const maxLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    scroller.scrollTo({
      left: Math.min(maxLeft, targetLeft),
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
  };

  const beginGanttLabelResize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    setGanttLabelResize({ startX: event.clientX, startWidth: labelWidthPx, bounds: labelWidthBounds });
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // ignore pointer capture errors
    }
  };

  const handleGanttLabelResizeKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? GANTT_LABEL_KEYBOARD_STEP_PX * 2 : GANTT_LABEL_KEYBOARD_STEP_PX;
    let next: number | null = null;
    if (event.key === 'ArrowLeft') next = labelWidthPx - step;
    if (event.key === 'ArrowRight') next = labelWidthPx + step;
    if (event.key === 'Home') next = labelWidthBounds.min;
    if (event.key === 'End') next = labelWidthBounds.max;
    if (next == null) return;
    event.preventDefault();
    event.stopPropagation();
    const applied = applyInteractiveLabelWidth(next, labelWidthBounds);
    if (!labelWidthBounds.narrow) writeGanttLabelWidthPreference(applied);
  };

  const openGanttPopover = (row: Extract<GanttRow, { kind: 'item' }>, target: HTMLElement) => {
    if (row.isDowntime) {
      setGanttPopover(null);
      return;
    }
    ganttPopoverTriggerRef.current = target;
    const rect = target.getBoundingClientRect();
    setGanttPopover({
      scheduleItemId: row.scheduleItemId,
      anchor: { top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height },
    });
  };

  const beginGanttDrag = (
    row: Extract<GanttRow, { kind: 'item' }>,
    mode: 'move' | 'resize',
    e: React.PointerEvent,
  ) => {
    if (scheduleMode !== 'v2' || row.isDowntime || e.button !== 0) return;
    const scheduleItem = scheduleItemByIdRef.current.get(row.scheduleItemId) ?? null;
    if (!scheduleItem || !canAdjustGanttTiming(scheduleItem)) return;
    e.preventDefault();
    e.stopPropagation();
    setGanttPopover(null);
    ganttDragDeltaRef.current = 0;
    ganttDragMovedRef.current = false;
    setGanttDragDelta(0);
    setGanttDragPointer({ x: e.clientX, y: e.clientY });
    setGanttDrag({
      id: row.scheduleItemId,
      itemUpdatedAt: scheduleItem.updatedAt,
      mode,
      originX: e.clientX,
      startDate: row.startDate,
      endDate: row.endDate,
      durationDays: Math.max(1, Math.trunc(row.durationDays)),
    });
    try {
      (e.currentTarget as HTMLElement | null)?.setPointerCapture?.(e.pointerId);
    } catch {
      // ignore pointer capture errors
    }
  };

  const shouldBlockGanttClick = () => typeof window !== 'undefined' && Date.now() < ganttClickBlockUntilRef.current;
  const toggleCrewCollapsed = (installerId: string) => setCollapsedCrews((prev) => ({ ...prev, [installerId]: !prev[installerId] }));
  const controlsDisabled = Boolean(ganttDrag || ganttLabelResize);
  const handleAttentionModeChange = (next: GanttAttentionMode) => {
    if (controlsDisabled) return;
    setGanttPopover(null);
    setAttentionMode(next);
  };
  const handleToggleCrew = (crewId: string) => {
    if (controlsDisabled) return;
    setGanttPopover(null);
    toggleCrew(crewId);
  };
  const handleHideCrews = (crewIds: readonly string[]) => {
    if (controlsDisabled) return;
    setGanttPopover(null);
    hideCrews(crewIds);
  };
  const handleShowAllCrews = () => {
    if (controlsDisabled) return;
    setGanttPopover(null);
    showAllCrews();
  };

  let ganttEmptyState: GanttEmptyState | null = null;
  if (gantt.rows.length === 0) {
    if (activeInstallers.length === 0) {
      ganttEmptyState = {
        title: 'No active crews',
        message: 'Active crews will appear here when they are available.',
      };
    } else if (visibleInstallers.length === 0) {
      ganttEmptyState = {
        title: 'No crews visible',
        message: 'Your saved crew filter is hiding every active crew.',
        actionLabel: 'Show all crews',
        onAction: handleShowAllCrews,
      };
    } else if (attentionMode === 'attention') {
      ganttEmptyState = {
        title: 'Nothing needs attention',
        message: 'No visible schedule items have an issue, a required client update, or drift beyond the allowed flex.',
        actionLabel: 'Show all jobs',
        onAction: () => handleAttentionModeChange('all'),
      };
    }
  }

  const handleGanttPopoverKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (isTextInputLikeTarget(event.target)) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeGanttPopover();
      return;
    }
    if (event.target !== event.currentTarget) return;
    if (!ganttPopoverDetails) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      ganttPopoverDetails.openProjectAction?.();
      return;
    }
    if (event.key.toLowerCase() === 'p') {
      event.preventDefault();
      ganttPopoverDetails.pinAction?.();
    }
  };

  return (
    <div className={styles.gantt}>
      <ScheduleGanttToolbar
        rangeStartLabel={formatShortDate(gantt.rangeStart)}
        rangeEndLabel={formatShortDate(gantt.rangeEnd)}
        zoomWeeks={zoomWeeks}
        density={ganttDensity}
        scheduleMode={scheduleMode}
        showCompleted={showCompleted}
        showPlanned={showPlanned}
        attentionMode={attentionMode}
        attentionCount={visibleAttentionItemIds.size}
        controlsDisabled={controlsDisabled}
        crews={crewFilterOptions}
        hiddenCrewIds={hiddenCrewIds}
        hiddenItemCount={hiddenItemCount}
        emptyCrewIds={emptyCrewIds}
        onZoomWeeksChange={(next) => handleGanttZoomWeeksChange(normalizeGanttZoomWeeks(next))}
        onDensityChange={setGanttDensity}
        onShowCompletedChange={onShowCompletedChange}
        onShowPlannedChange={setShowPlanned}
        onAttentionModeChange={handleAttentionModeChange}
        onJumpToToday={jumpGanttToToday}
        onToggleCrew={handleToggleCrew}
        onHideCrews={handleHideCrews}
        onShowAllCrews={handleShowAllCrews}
      />

      <ScheduleGanttTimeline
        gantt={gantt}
        density={ganttDensity}
        labelWidthPx={labelWidthPx}
        labelWidthBounds={labelWidthBounds}
        labelResizeActive={Boolean(ganttLabelResize)}
        ganttDragId={ganttDrag?.id ?? null}
        ganttPopoverItemId={ganttPopover?.scheduleItemId ?? null}
        snapGuidePx={ganttDragFeedback?.snapLinePx ?? null}
        scrollRef={ganttScrollRef}
        emptyState={ganttEmptyState}
        onBeginLabelResize={beginGanttLabelResize}
        onLabelResizeKeyDown={handleGanttLabelResizeKeyDown}
        onToggleCrewCollapsed={toggleCrewCollapsed}
        onOpenItem={openGanttPopover}
        onBeginGanttDrag={beginGanttDrag}
        shouldBlockClick={shouldBlockGanttClick}
      />
      {ganttDragFeedback && ganttDragPointer ? (
        <div className={styles.ganttDragTooltip} style={{ left: ganttDragPointer.x + 14, top: ganttDragPointer.y + 14 }}>
          {ganttDragFeedback.mode === 'move' ? <div>Start: {formatShortDate(ganttDragFeedback.startDate)}</div> : null}
          <div>End: {formatShortDate(ganttDragFeedback.endDate)}</div>
          <div>Duration: {ganttDragFeedback.durationDays}d</div>
        </div>
      ) : null}
      {ganttPopover && ganttPopoverDetails ? (
        <GanttBarPopover
          anchor={ganttPopover.anchor}
          actions={ganttPopoverDetails.actions}
          details={ganttPopoverDetails.details}
          onClose={closeGanttPopover}
          onKeyDown={handleGanttPopoverKeyDown}
          focusRef={ganttPopoverRef}
        />
      ) : null}
    </div>
  );
}
