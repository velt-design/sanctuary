'use client';

import { useState, type RefObject } from 'react';
import sharedStyles from './schedule.module.css';
import ganttStyles from './scheduleGantt.module.css';
import timelineStyles from './scheduleTimeline.module.css';
import {
  darkenHex,
  formatShortDate,
  formatStatusLabel,
  GANTT_BAR_LABEL_MIN_PX,
  GANTT_LABEL_RESIZER_WIDTH_PX,
  getReadableTextColor,
  type GanttDensity,
  type GanttLabelWidthBounds,
  type GanttModel,
  type GanttRow,
} from './ScheduleGanttModel';

const styles = { ...sharedStyles, ...timelineStyles, ...ganttStyles };

export type GanttEmptyState = {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

type ScheduleGanttTimelineProps = {
  gantt: GanttModel;
  density: GanttDensity;
  labelWidthPx: number;
  labelWidthBounds: GanttLabelWidthBounds;
  labelResizeActive: boolean;
  ganttDragId: string | null;
  ganttPopoverItemId: string | null;
  snapGuidePx: number | null;
  scrollRef: RefObject<HTMLDivElement | null>;
  emptyState: GanttEmptyState | null;
  onBeginLabelResize: (event: React.PointerEvent<HTMLDivElement>) => void;
  onLabelResizeKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  onToggleCrewCollapsed: (installerId: string) => void;
  onOpenItem: (row: Extract<GanttRow, { kind: 'item' }>, target: HTMLElement) => void;
  onBeginGanttDrag: (
    row: Extract<GanttRow, { kind: 'item' }>,
    mode: 'move' | 'resize',
    event: React.PointerEvent,
  ) => void;
  shouldBlockClick: () => boolean;
};

import ScheduleGanttCalendar from './ScheduleGanttCalendar';
import { createPortal } from 'react-dom';
import { useScheduleSurfaceController } from './ScheduleSurfaceContext';
function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export default function ScheduleGanttTimeline({
  gantt,
  density,
  labelWidthPx,
  labelWidthBounds,
  labelResizeActive,
  ganttDragId,
  ganttPopoverItemId,
  snapGuidePx,
  scrollRef,
  emptyState,
  onBeginLabelResize,
  onLabelResizeKeyDown,
  onToggleCrewCollapsed,
  onOpenItem,
  onBeginGanttDrag,
  shouldBlockClick,
}: ScheduleGanttTimelineProps) {
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);

  const surface = useScheduleSurfaceController();
  const rows = (<>
        {gantt.rows.map((row) => (
          <div
            key={row.id}
            className={styles.ganttRowWrap}
            data-kind={row.kind}
            data-gantt-crew-id={row.kind === 'group' ? row.installerId : undefined}
            data-gantt-schedule-item-id={row.kind === 'item' ? row.scheduleItemId : undefined}
            data-needs-attention={row.kind === 'item' ? String(row.needsAttention) : undefined}
            data-hovered={hoveredRowId === row.id ? 'true' : 'false'}
            onMouseEnter={() => setHoveredRowId(row.id)}
            onMouseLeave={() => setHoveredRowId((current) => (current === row.id ? null : current))}
          >
            <div className={cx(styles.ganttLeftCell, row.kind === 'group' && styles.ganttLeftCellGroup)}>
              <div className={styles.ganttLeftGrid}>
                <div className={styles.ganttColProject}>
                  {row.kind === 'group' ? (
                    <span className={styles.ganttGroupLabel}>
                      <button
                        type="button"
                        className={styles.ganttCollapseBtn}
                        aria-label={row.collapsed ? `Expand ${row.label}` : `Collapse ${row.label}`}
                        aria-expanded={!row.collapsed}
                        onClick={(event) => {
                          event.stopPropagation();
                          onToggleCrewCollapsed(row.installerId);
                        }}
                      >
                        {row.collapsed ? '>' : 'v'}
                      </button>
                      <span className={styles.colorDot} style={{ background: row.color }} />
                      <span className={styles.ganttGroupIdentity}>
                        <span className={styles.ganttProjectText} title={row.label}>{row.label}</span>
                        <span className={styles.ganttGroupLoad}>{row.loadLabel}</span>
                      </span>
                      {row.attentionCount > 0 ? (
                        <span className={styles.ganttGroupAttention}>{row.attentionCount} attention</span>
                      ) : null}
                    </span>
                  ) : (
                    <span className={styles.ganttProjectDetails}>
                      <span className={styles.ganttProjectNameLine}>
                        <span className={styles.ganttProjectText} title={row.projectName}>{row.projectName}</span>
                        {row.needsAttention ? (
                          <span className={styles.ganttItemAttention} title={row.attentionLabel ?? undefined}>
                            {row.attentionBadgeLabel ?? 'Attention'}
                          </span>
                        ) : null}
                      </span>
                      <span className={styles.ganttProjectMeta}>
                        {formatShortDate(row.startDate)} to {formatShortDate(row.endDate)} / {row.durationLabel}
                      </span>
                      {row.identityDetail ? (
                        <span className={styles.ganttProjectIdentity} title={row.identityDetail}>{row.identityDetail}</span>
                      ) : null}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div
              className={cx(styles.ganttTimelineRow, row.kind === 'group' && styles.ganttTimelineRowGroup)}
              style={{ width: gantt.totalWidth }}
            >
              {row.kind === 'group' && row.collapsed
                ? row.summarySpans.map((span, index) => (
                    <div
                      key={`crew-summary-${row.installerId}-${index}`}
                      className={styles.ganttCrewSummaryBar}
                      style={{ left: span.leftPx, width: span.widthPx, backgroundColor: row.color }}
                      aria-hidden="true"
                    />
                  ))
                : null}
              {row.kind === 'item' && row.plannedWidthPx && row.plannedWidthPx > 0 ? (
                <div
                  className={styles.ganttPlannedBar}
                  style={{ left: row.plannedLeftPx, width: row.plannedWidthPx }}
                  title={
                    row.plannedStart && row.plannedEnd
                      ? `Planned: ${formatShortDate(row.plannedStart)} to ${formatShortDate(row.plannedEnd)}`
                      : 'Planned dates'
                  }
                />
              ) : null}
              {row.kind === 'item' && row.ghostWidthPx && row.ghostWidthPx > 0 ? (
                <div
                  className={styles.ganttGhostBar}
                  style={{ left: row.ghostLeftPx, width: row.ghostWidthPx }}
                  aria-hidden="true"
                />
              ) : null}
              {row.kind === 'item' && row.barWidthPx > 0 ? (
                <div
                  className={styles.ganttBar}
                  data-conflict={row.issueLevel === 'error' ? 'true' : undefined}
                  data-attention={row.needsAttention ? 'true' : undefined}
                  data-pinned={row.isPinned ? 'true' : undefined}
                  data-dragging={ganttDragId === row.scheduleItemId ? 'true' : undefined}
                  data-timing-adjustable={row.timingAdjustable ? 'true' : 'false'}
                  style={{
                    left: row.barLeftPx,
                    width: row.barWidthPx,
                    backgroundColor: row.barColor,
                    borderColor: darkenHex(row.barColor, 0.12),
                    color: getReadableTextColor(row.barColor),
                  }}
                  title={[
                    row.projectName,
                    row.customerName ? `Customer: ${row.customerName}` : null,
                    row.siteAddress ? `Site: ${row.siteAddress}` : null,
                    `Crew: ${row.crewName}`,
                    row.isPinned ? 'Pinned' : null,
                    row.plannedCommitmentLabel ? `Planned: ${row.plannedCommitmentLabel}` : 'Planned: Draft',
                    typeof row.driftDays === 'number'
                      ? `Drift: +${row.driftDays} working day${row.driftDays === 1 ? '' : 's'}`
                      : null,
                    row.clientUpdateStatus === 'needed'
                      ? 'Client update needed'
                      : row.clientUpdateStatus === 'acknowledged'
                        ? 'Client contacted'
                        : null,
                    row.conflictMessage ? `Conflict: ${row.conflictMessage}` : null,
                    `Status: ${formatStatusLabel(row.status)}`,
                    `Duration: ${row.durationLabel}`,
                    `Start: ${formatShortDate(row.startDate)}`,
                    `End: ${formatShortDate(row.endDate)}`,
                  ].filter((line): line is string => Boolean(line)).join('\n')}
                  role={row.isDowntime ? undefined : 'button'}
                  tabIndex={row.isDowntime ? undefined : 0}
                  aria-haspopup={row.isDowntime ? undefined : 'dialog'}
                  aria-expanded={row.isDowntime ? undefined : ganttPopoverItemId === row.scheduleItemId}
                  aria-label={
                    row.isDowntime
                      ? undefined
                      : `${row.projectName}.${row.customerName ? ` Customer ${row.customerName}.` : ''}${row.siteAddress ? ` Site ${row.siteAddress}.` : ''} Crew ${row.crewName}. Forecast ${formatShortDate(row.startDate)} to ${formatShortDate(row.endDate)}. ${row.durationLabel}.${row.attentionLabel ? ` Attention: ${row.attentionLabel}.` : ''} Press Enter for actions.`
                  }
                  onPointerDown={row.timingAdjustable ? (event) => onBeginGanttDrag(row, 'move', event) : undefined}
                  onClick={(event) => {
                    if (shouldBlockClick()) return;
                    event.stopPropagation();
                    onOpenItem(row, event.currentTarget);
                  }}
                  onKeyDown={(event) => {
                    if (row.isDowntime || (event.key !== 'Enter' && event.key !== ' ')) return;
                    event.preventDefault();
                    event.stopPropagation();
                    onOpenItem(row, event.currentTarget);
                  }}
                >
                  {row.isPinned ? <span className={styles.ganttPin} aria-hidden="true" /> : null}
                  {row.barWidthPx >= GANTT_BAR_LABEL_MIN_PX ? (
                    <span className={styles.ganttBarTextFade}>
                      <span className={styles.ganttBarText}>{row.projectName}</span>
                    </span>
                  ) : null}
                  {row.timingAdjustable ? (
                    <span
                      className={styles.ganttResizeHandle}
                      data-gantt-resize-handle="true"
                      role="presentation"
                      onPointerDown={(event) => onBeginGanttDrag(row, 'resize', event)}
                      onClick={(event) => event.stopPropagation()}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        ))}
  </>);
  const empty = (<>
      {emptyState ? (
        <div className={styles.ganttEmptyState} role="status" aria-label="Gantt empty state">
          <strong>{emptyState.title}</strong>
          <span>{emptyState.message}</span>
          {emptyState.actionLabel && emptyState.onAction ? (
            <button type="button" className={styles.buttonSecondary} onClick={emptyState.onAction}>
              {emptyState.actionLabel}
            </button>
          ) : null}
        </div>
      ) : null}

  </>);
  if (surface) return <>
    {surface.slots.timelineRows ? createPortal(rows, surface.slots.timelineRows) : null}
    {surface.slots.timelineEmpty ? createPortal(empty, surface.slots.timelineEmpty) : null}
  </>;
  return <ScheduleGanttCalendar gantt={gantt} density={density} labelWidthPx={labelWidthPx} labelWidthBounds={labelWidthBounds} labelResizeActive={labelResizeActive} snapGuidePx={snapGuidePx} scrollRef={scrollRef} rows={rows} empty={empty} onBeginLabelResize={onBeginLabelResize} onLabelResizeKeyDown={onLabelResizeKeyDown} />;
}
