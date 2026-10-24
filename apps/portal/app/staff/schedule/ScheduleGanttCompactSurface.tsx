'use client';
import type { ReactNode } from 'react';
import ScheduleCrewFilter, { type ScheduleCrewFilterOption } from './ScheduleCrewFilterSurface';
import { formatShortDate } from './ScheduleGanttCalendarModel';
import type { GanttAttentionMode } from './ScheduleGanttToolbar';
import sharedStyles from './schedule.module.css';
import ganttStyles from './scheduleGantt.module.css';
const styles = { ...sharedStyles, ...ganttStyles };
export default function ScheduleGanttCompactSurface({
  today,
  rangeStart,
  rangeEnd,
  children,
  attentionMode,
  attentionCount,
  readState,
  controlsDisabled,
  crews,
  hiddenCrewIds,
  hiddenItemCount,
  emptyCrewIds,
  crewPanel,
  showCompleted,
  onAttentionModeChange,
  onShowCompletedChange,
  onOpenBoard,
  onToggleCrew,
  onHideCrews,
  onShowAllCrews,
}: {
  today: string;
  rangeStart: string;
  rangeEnd: string;
  children: ReactNode;
  attentionMode: GanttAttentionMode;
  attentionCount: number | null;
  readState?: 'pending' | 'unavailable';
  controlsDisabled: boolean;
  crewPanel?: ReactNode;
  crews: ScheduleCrewFilterOption[];
  hiddenCrewIds: ReadonlySet<string>;
  hiddenItemCount: number;
  emptyCrewIds: string[];
  showCompleted: boolean;
  onAttentionModeChange: (next: GanttAttentionMode) => void;
  onShowCompletedChange: (next: boolean) => void;
  onOpenBoard: (control: HTMLButtonElement) => void;
  onToggleCrew: (crewId: string) => void;
  onHideCrews: (crewIds: readonly string[]) => void;
  onShowAllCrews: () => void;
}) {
  return (
    <section className={styles.ganttCompact} aria-labelledby="gantt-compact-title">
      <div className={styles.ganttCompactHeader}>
        <div>
          <p className={styles.ganttCompactEyebrow}>Small-screen agenda</p>
          <h2 id="gantt-compact-title" className={styles.ganttCompactTitle}>Crew schedule</h2>
          <p className={styles.ganttCompactRange}>
            Today {formatShortDate(today)} · Plan {formatShortDate(rangeStart)} to {formatShortDate(rangeEnd)}
          </p>
        </div>
        <p className={styles.ganttCompactNotice}>
          Read-only here. Open Board to safely move, reorder or unschedule work.
        </p>
      </div>

      <div className={styles.ganttCompactControls} aria-label="Small-screen schedule controls">
        <div className={styles.ganttAttentionToggle} role="group" aria-label="Schedule item view">
          <button
            type="button"
            className={styles.ganttSegmentButton}
            aria-pressed={attentionMode === 'all'}
            disabled={controlsDisabled}
            onClick={() => onAttentionModeChange('all')}
          >
            All jobs
          </button>
          <button
            type="button"
            className={styles.ganttSegmentButton}
            aria-pressed={attentionMode === 'attention'}
            disabled={controlsDisabled || Boolean(readState)}
            onClick={() => onAttentionModeChange('attention')}
          >
            Needs attention <span className={styles.ganttSegmentCount}>{attentionCount??(readState==='unavailable'?'Unavailable':'Reading…')}</span>
          </button>
        </div>
        <ScheduleCrewFilter
          panel={crewPanel}
          readState={readState}
          crews={crews}
          hiddenCrewIds={hiddenCrewIds}
          hiddenItemCount={hiddenItemCount}
          emptyCrewIds={emptyCrewIds}
          disabled={controlsDisabled}
          onToggleCrew={onToggleCrew}
          onHideCrews={onHideCrews}
          onShowAllCrews={onShowAllCrews}
        />
        <label className={styles.ganttCompactCompleted}>
          <input
            type="checkbox"
            checked={showCompleted}
            disabled={controlsDisabled}
            onChange={(event) => onShowCompletedChange(event.target.checked)}
          />
          Show completed
        </label>
        <button
          type="button"
          className={`${styles.buttonSecondary} ${styles.ganttCompactBoardButton}`}
          disabled={controlsDisabled}
          onClick={(event) => onOpenBoard(event.currentTarget)}
        >
          Open Board and unscheduled work
        </button>
      </div>

      <div className={styles.ganttCompactList} role="region" aria-label="Crew schedule agenda">
        {children}
      </div>
    </section>
  );
}
