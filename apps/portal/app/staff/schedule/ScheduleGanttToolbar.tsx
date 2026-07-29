'use client';

import ScheduleCrewFilter, { type ScheduleCrewFilterOption } from './ScheduleCrewFilter';
import sharedStyles from './schedule.module.css';
import ganttStyles from './scheduleGantt.module.css';
import timelineStyles from './scheduleTimeline.module.css';
import type { GanttDensity, GanttZoomWeeks } from './ScheduleGanttModel';

const styles = { ...sharedStyles, ...timelineStyles, ...ganttStyles };

export type GanttAttentionMode = 'all' | 'attention';

type ScheduleGanttToolbarProps = {
  rangeStartLabel: string;
  rangeEndLabel: string;
  zoomWeeks: GanttZoomWeeks;
  density: GanttDensity;
  scheduleMode: 'v2' | 'legacy';
  showCompleted: boolean;
  showPlanned: boolean;
  attentionMode: GanttAttentionMode;
  attentionCount: number;
  controlsDisabled: boolean;
  crews: ScheduleCrewFilterOption[];
  hiddenCrewIds: ReadonlySet<string>;
  hiddenItemCount: number;
  emptyCrewIds: string[];
  onZoomWeeksChange: (next: GanttZoomWeeks) => void;
  onDensityChange: (next: GanttDensity) => void;
  onShowCompletedChange: (next: boolean) => void;
  onShowPlannedChange: (next: boolean) => void;
  onAttentionModeChange: (next: GanttAttentionMode) => void;
  onJumpToToday: () => void;
  onToggleCrew: (crewId: string) => void;
  onHideCrews: (crewIds: readonly string[]) => void;
  onShowAllCrews: () => void;
};

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export default function ScheduleGanttToolbar({
  rangeStartLabel,
  rangeEndLabel,
  zoomWeeks,
  density,
  scheduleMode,
  showCompleted,
  showPlanned,
  attentionMode,
  attentionCount,
  controlsDisabled,
  crews,
  hiddenCrewIds,
  hiddenItemCount,
  emptyCrewIds,
  onZoomWeeksChange,
  onDensityChange,
  onShowCompletedChange,
  onShowPlannedChange,
  onAttentionModeChange,
  onJumpToToday,
  onToggleCrew,
  onHideCrews,
  onShowAllCrews,
}: ScheduleGanttToolbarProps) {
  return (
    <div className={styles.ganttToolbar}>
      <div className={styles.ganttPlanningRow} role="group" aria-label="Timeline controls">
        <div className={styles.ganttMeta}>
          <span className={styles.ganttMetaLabel}>Plan</span>
          <strong>{rangeStartLabel}</strong>
          <span aria-hidden="true">to</span>
          <strong>{rangeEndLabel}</strong>
        </div>

        <label className={styles.ganttLabeledControl}>
          <span>Scale</span>
          <select
            className={cx(styles.input, styles.ganttControlSelect)}
            value={zoomWeeks}
            disabled={controlsDisabled}
            onChange={(event) => onZoomWeeksChange(Number(event.target.value) as GanttZoomWeeks)}
            aria-label="Timeline scale"
          >
            <option value={4}>4 weeks</option>
            <option value={8}>8 weeks</option>
            <option value={12}>12 weeks</option>
          </select>
        </label>

        <button
          type="button"
          className={cx(styles.buttonSecondary, styles.ganttControlButton, styles.ganttJumpButton)}
          disabled={controlsDisabled}
          onClick={onJumpToToday}
          aria-label="Jump to today"
        >
          Today
        </button>

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
            disabled={controlsDisabled}
            onClick={() => onAttentionModeChange('attention')}
          >
            Needs attention
            <span className={styles.ganttSegmentCount}>{attentionCount}</span>
          </button>
        </div>

        <ScheduleCrewFilter
          crews={crews}
          hiddenCrewIds={hiddenCrewIds}
          hiddenItemCount={hiddenItemCount}
          emptyCrewIds={emptyCrewIds}
          disabled={controlsDisabled}
          onToggleCrew={onToggleCrew}
          onHideCrews={onHideCrews}
          onShowAllCrews={onShowAllCrews}
        />
      </div>

      <div className={styles.ganttDisplayRow} role="group" aria-label="View options">
        {scheduleMode === 'v2' ? (
          <button
            type="button"
            className={cx(styles.buttonSecondary, styles.ganttControlButton)}
            aria-pressed={showPlanned}
            disabled={controlsDisabled}
            onClick={() => onShowPlannedChange(!showPlanned)}
          >
            {showPlanned ? 'Hide planned' : 'Show planned'}
          </button>
        ) : null}

        <label className={styles.toggleControl}>
          <input
            type="checkbox"
            className={styles.toggleCheckbox}
            checked={showCompleted}
            disabled={controlsDisabled}
            onChange={(event) => onShowCompletedChange(event.target.checked)}
          />
          Show completed jobs
        </label>

        <label className={styles.ganttLabeledControl}>
          <span>Density</span>
          <select
            className={styles.ganttDensitySelect}
            value={density}
            disabled={controlsDisabled}
            onChange={(event) => onDensityChange(event.target.value === 'comfortable' ? 'comfortable' : 'compact')}
            aria-label="Density"
          >
            <option value="compact">Compact</option>
            <option value="comfortable">Comfortable</option>
          </select>
        </label>

        {scheduleMode === 'v2' ? (
          <div className={styles.ganttLegendInline} aria-label="Gantt legend">
            <span className={styles.legendItem}><span className={styles.legendSwatch} />Forecast</span>
            {showPlanned ? <span className={styles.legendItem}><span className={cx(styles.legendSwatch, styles.legendSwatchPlanned)} />Planned</span> : null}
            <span className={styles.legendItem}><span className={styles.legendDot} aria-hidden="true" />Pinned</span>
            <span className={styles.legendItem}><span className={cx(styles.legendSwatch, styles.legendSwatchConflict)} />Attention</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
