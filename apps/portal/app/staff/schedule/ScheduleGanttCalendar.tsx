'use client';
import type { ReactNode, RefObject } from 'react';
import { formatShortDate, GANTT_LABEL_RESIZER_WIDTH_PX, type GanttCalendar, type GanttDensity, type GanttLabelWidthBounds } from './ScheduleGanttCalendarModel';
import sharedStyles from './schedule.module.css';
import ganttStyles from './scheduleGantt.module.css';
import timelineStyles from './scheduleTimeline.module.css';
const styles = { ...sharedStyles, ...timelineStyles, ...ganttStyles };
export type ScheduleGanttCalendarProps = {
  gantt: GanttCalendar; density: GanttDensity; labelWidthPx: number; labelWidthBounds: GanttLabelWidthBounds; labelResizeActive: boolean; snapGuidePx: number | null; scrollRef: RefObject<HTMLDivElement | null>; rows: ReactNode; empty: ReactNode;
  onBeginLabelResize: (event: React.PointerEvent<HTMLDivElement>) => void;
  onLabelResizeKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
};
/** The genuine date axis and viewport are shared by pending and populated views. */
export default function ScheduleGanttCalendar({gantt,density,labelWidthPx,labelWidthBounds,labelResizeActive,snapGuidePx,scrollRef,rows,empty,onBeginLabelResize,onLabelResizeKeyDown}: ScheduleGanttCalendarProps) {
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

        {rows}
      </div>
      {empty}
    </div>
  );
}
