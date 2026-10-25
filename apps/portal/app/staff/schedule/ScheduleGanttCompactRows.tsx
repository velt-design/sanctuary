'use client';
import { formatShortDate } from './ScheduleGanttCalendarModel';
import { formatStatusLabel, type GanttRow } from './ScheduleGanttModel';
import type { GanttEmptyState } from './ScheduleGanttTimeline';
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

export function ScheduleGanttCompactRows({rows,emptyState,onOpenProject,onToggleCrewCollapsed}: {rows: readonly GanttRow[]; emptyState: GanttEmptyState|null; onOpenProject:(id:string)=>void; onToggleCrewCollapsed:(id:string)=>void}) {
 const groups = groupRows(rows);
 return (<>
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
              <span className={styles.ganttCompactCrewSummary}>
                {group.loadLabel}
                {group.attentionCount ? ` · ${group.attentionCount} need attention` : ''}
              </span>
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
                            <span className={styles.ganttCompactJobTitleRow}>
                              <strong>{item.projectName}</strong>
                              {item.attentionBadgeLabel ? (
                                <span className={styles.ganttCompactAttention} title={item.attentionLabel ?? undefined}>
                                  {item.attentionBadgeLabel}
                                </span>
                              ) : null}
                            </span>
                            {item.identityDetail ? <span>{item.identityDetail}</span> : null}
                            <span className={styles.ganttCompactTiming}>
                              Forecast: {formatShortDate(item.startDate)} to {formatShortDate(item.endDate)} · {item.durationLabel}
                            </span>
                          </span>
                          <span className={styles.ganttCompactJobMeta}>
                            <span>Stage: {formatStatusLabel(item.status)}</span>
                            <span>Plan: {item.plannedCommitmentLabel ?? 'Draft'}</span>
                            {item.isPinned ? <span>Pinned</span> : null}
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

 </>);
}
