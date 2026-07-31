'use client';

import ScheduleCrewFilter, { type ScheduleCrewFilterOption } from './ScheduleCrewFilter';
import { formatShortDate, formatStatusLabel, type GanttRow } from './ScheduleGanttModel';
import type { GanttAttentionMode } from './ScheduleGanttToolbar';
import sharedStyles from './schedule.module.css';
import ganttStyles from './scheduleGantt.module.css';

const styles = { ...sharedStyles, ...ganttStyles };

type CompactGroup = {
  group: Extract<GanttRow, { kind: 'group' }>;
  items: Array<Extract<GanttRow, { kind: 'item' }>>;
};

function groupRows(rows: readonly GanttRow[]): CompactGroup[] {
  const groups: CompactGroup[] = [];
  let active: CompactGroup | null = null;
  for (const row of rows) {
    if (row.kind === 'group') {
      active = { group: row, items: [] };
      groups.push(active);
    } else if (active) {
      active.items.push(row);
    }
  }
  return groups;
}

export default function ScheduleGanttCompactView({
  today,
  rangeStart,
  rangeEnd,
  rows,
  attentionMode,
  attentionCount,
  controlsDisabled,
  crews,
  hiddenCrewIds,
  hiddenItemCount,
  emptyCrewIds,
  showCompleted,
  emptyState,
  onAttentionModeChange,
  onShowCompletedChange,
  onOpenBoard,
  onOpenProject,
  onToggleCrew,
  onHideCrews,
  onShowAllCrews,
  onToggleCrewCollapsed,
}: {
  today: string;
  rangeStart: string;
  rangeEnd: string;
  rows: readonly GanttRow[];
  attentionMode: GanttAttentionMode;
  attentionCount: number;
  controlsDisabled: boolean;
  crews: ScheduleCrewFilterOption[];
  hiddenCrewIds: ReadonlySet<string>;
  hiddenItemCount: number;
  emptyCrewIds: string[];
  showCompleted: boolean;
  emptyState: { title: string; message: string; actionLabel?: string; onAction?: () => void } | null;
  onAttentionModeChange: (next: GanttAttentionMode) => void;
  onShowCompletedChange: (next: boolean) => void;
  onOpenBoard: (control: HTMLButtonElement) => void;
  onOpenProject: (projectId: string) => void;
  onToggleCrew: (crewId: string) => void;
  onHideCrews: (crewIds: readonly string[]) => void;
  onShowAllCrews: () => void;
  onToggleCrewCollapsed: (installerId: string) => void;
}) {
  const groups = groupRows(rows);
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
            disabled={controlsDisabled}
            onClick={() => onAttentionModeChange('attention')}
          >
            Needs attention <span className={styles.ganttSegmentCount}>{attentionCount}</span>
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
        {emptyState ? (
          <div className={styles.ganttCompactEmpty} role="status">
            <strong>{emptyState.title}</strong>
            <p>{emptyState.message}</p>
            {emptyState.actionLabel && emptyState.onAction ? (
              <button type="button" className={styles.buttonSecondary} onClick={emptyState.onAction}>
                {emptyState.actionLabel}
              </button>
            ) : null}
          </div>
        ) : groups.map(({ group, items }) => (
          <section key={group.id} className={styles.ganttCompactCrew} aria-labelledby={`compact-${group.id}`}>
            <button
              type="button"
              className={styles.ganttCompactCrewHeader}
              aria-expanded={!group.collapsed}
              onClick={() => onToggleCrewCollapsed(group.installerId)}
            >
              <span className={styles.ganttCompactCrewIdentity}>
                <span className={styles.ganttCompactCrewDot} style={{ background: group.color }} aria-hidden="true" />
                <strong id={`compact-${group.id}`}>{group.label}</strong>
              </span>
              <span>{group.itemCount} job{group.itemCount === 1 ? '' : 's'} · {group.attentionCount} need attention</span>
            </button>
            {!group.collapsed ? (
              items.length ? (
                <ul className={styles.ganttCompactJobs}>
                  {items.map((item) => (
                    <li key={item.id} className={styles.ganttCompactJob} data-attention={item.needsAttention ? 'true' : undefined}>
                      {item.isDowntime ? (
                        <div className={styles.ganttCompactJobBody}>
                          <strong>{item.projectName}</strong>
                          <span>{formatShortDate(item.startDate)} to {formatShortDate(item.endDate)} · {item.durationLabel}</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className={styles.ganttCompactJobButton}
                          aria-label={[
                            `Open project ${item.projectName}`,
                            item.identityDetail,
                            `Forecast ${formatShortDate(item.startDate)} to ${formatShortDate(item.endDate)}, ${item.durationLabel}`,
                            `Stage ${formatStatusLabel(item.status)}`,
                            `Plan ${item.plannedCommitmentLabel ?? 'Draft'}`,
                            item.isPinned ? 'Pinned' : null,
                            item.attentionLabel,
                          ].filter(Boolean).join('. ')}
                          onClick={() => onOpenProject(item.projectId)}
                        >
                          <span className={styles.ganttCompactJobBody}>
                            <strong>{item.projectName}</strong>
                            {item.identityDetail ? <span>{item.identityDetail}</span> : null}
                            <span>Forecast: {formatShortDate(item.startDate)} to {formatShortDate(item.endDate)} · {item.durationLabel}</span>
                          </span>
                          <span className={styles.ganttCompactJobMeta}>
                            <span>Stage: {formatStatusLabel(item.status)}</span>
                            <span>Plan: {item.plannedCommitmentLabel ?? 'Draft'}</span>
                            {item.isPinned ? <span>Pinned</span> : null}
                            {item.attentionLabel ? <strong>{item.attentionLabel}</strong> : null}
                          </span>
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : <p className={styles.ganttCompactCrewEmpty}>No jobs in this range.</p>
            ) : null}
          </section>
        ))}
      </div>
    </section>
  );
}
