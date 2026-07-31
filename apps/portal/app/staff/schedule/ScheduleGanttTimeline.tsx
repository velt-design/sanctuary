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

  return (
    <div className={styles.ganttScroll} role="region" aria-label="Gantt timeline" ref={scrollRef}>
      <div
        className={styles.ganttTable}
        data-density={density}
        style={
          {
            gridTemplateColumns: `${labelWidthPx}px ${gantt.totalWidth}px`,
            ['--ganttLabelW' as string]: `${labelWidthPx}px`,
            ['--ganttDayW' as string]: `${gantt.axis.baseDayPx}px`,
          } as React.CSSProperties
        }
      >
        <div
          className={styles.currentWeekWash}
          data-gantt-current-week="true"
          style={{ left: labelWidthPx + gantt.currentWeekLeftPx, width: gantt.currentWeekWidthPx }}
          aria-hidden="true"
        />
        {gantt.todayColumnLeftPx != null ? (
          <div
            className={styles.todayColumnWash}
            style={{ left: labelWidthPx + gantt.todayColumnLeftPx, width: gantt.todayColumnWidthPx }}
            aria-hidden="true"
          />
        ) : null}
        {gantt.weekendBlocks.map((block) => (
          <div
            key={`weekend-${block.date}`}
            className={styles.weekendShade}
            style={{ left: labelWidthPx + block.leftPx, width: block.widthPx }}
            aria-hidden="true"
          />
        ))}
        {gantt.holidayBlocks.map((block) => (
          <div
            key={`holiday-${block.date}`}
            className={styles.holidayShade}
            style={{ left: labelWidthPx + block.leftPx, width: block.widthPx }}
            aria-hidden="true"
          />
        ))}
        <div className={styles.ganttGridLines} aria-hidden="true">
          {gantt.dayBoundaryLines.map((leftPx, index) => (
            <div
              key={`day-line-${index}-${leftPx}`}
              className={styles.ganttDayBoundary}
              style={{ left: labelWidthPx + leftPx }}
            />
          ))}
          {gantt.weekBoundaryLines.map((leftPx, index) => (
            <div
              key={`week-line-${index}-${leftPx}`}
              className={styles.ganttWeekBoundary}
              style={{ left: labelWidthPx + leftPx }}
            />
          ))}
        </div>
        <div
          className={styles.ganttLabelResizer}
          data-active={labelResizeActive ? 'true' : 'false'}
          style={{ left: labelWidthPx - GANTT_LABEL_RESIZER_WIDTH_PX / 2 }}
          role="separator"
          tabIndex={0}
          aria-orientation="vertical"
          aria-label="Resize crew label column"
          aria-valuemin={labelWidthBounds.min}
          aria-valuemax={labelWidthBounds.max}
          aria-valuenow={labelWidthPx}
          aria-valuetext={`${labelWidthPx} pixels`}
          onPointerDown={onBeginLabelResize}
          onKeyDown={onLabelResizeKeyDown}
        />
        <div className={styles.ganttCorner}>
          <div className={styles.ganttLeftHeaderGrid}>
            <div className={styles.ganttColProject}>Crew / Project</div>
          </div>
        </div>
        <div className={styles.ganttHeader} style={{ width: gantt.totalWidth }}>
          <div className={styles.ganttTodayPillTrack}>
            {gantt.todayColumnLeftPx != null ? (
              <span
                className={styles.ganttTodayPill}
                style={{ left: gantt.todayColumnLeftPx + gantt.todayColumnWidthPx / 2 }}
              >
                Today - {formatShortDate(gantt.displayToday)}
              </span>
            ) : null}
          </div>
          <div className={styles.ganttMonthBand}>
            {gantt.axis.months.map((month) => (
              <div
                key={`month-${month.key}-${month.startWeekIndex}`}
                className={styles.ganttMonthLabel}
                style={{ left: month.startPx, width: month.widthPx }}
              >
                {month.label}
              </div>
            ))}
          </div>
          <div className={styles.ganttWeekBand}>
            {gantt.axis.weeks.map((week) => (
              <div
                key={`week-${week.index}-${week.startDate}`}
                className={styles.ganttWeekLabel}
                style={{ left: week.startPx, width: week.widthPx }}
              >
                {week.label}
              </div>
            ))}
          </div>
          {gantt.holidayBlocks.map((block) => (
            <div
              key={`holiday-hover-${block.date}`}
              className={styles.ganttHolidayHoverZone}
              style={{ left: block.leftPx, width: block.widthPx }}
              title={block.label}
              role="note"
              tabIndex={0}
              aria-label={block.label}
            />
          ))}
        </div>
        <div className={styles.todayLine} style={{ left: labelWidthPx + gantt.todayLinePx }} aria-hidden="true" />
        {snapGuidePx != null ? (
          <div
            className={styles.ganttSnapGuide}
            style={{ left: labelWidthPx + snapGuidePx }}
            aria-hidden="true"
          />
        ) : null}

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
                      <span className={styles.ganttProjectText}>{row.label}</span>
                      {row.itemCount > 0 ? (
                        <span className={styles.ganttGroupCount}>
                          {row.itemCount} {row.itemCount === 1 ? 'item' : 'items'}
                        </span>
                      ) : null}
                      {row.attentionCount > 0 ? (
                        <span className={styles.ganttGroupAttention}>{row.attentionCount} attention</span>
                      ) : row.itemCount === 0 ? (
                        <span className={styles.ganttGroupEmpty}>No scheduled items</span>
                      ) : null}
                    </span>
                  ) : (
                    <span className={styles.ganttProjectDetails}>
                      <span className={styles.ganttProjectNameLine}>
                        <span className={styles.ganttProjectText} title={row.projectName}>{row.projectName}</span>
                        {row.needsAttention ? (
                          <span className={styles.ganttItemAttention} title={row.attentionLabel ?? undefined}>
                            Attention
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
      </div>

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
    </div>
  );
}
