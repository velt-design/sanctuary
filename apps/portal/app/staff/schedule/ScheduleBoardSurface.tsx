'use client';
import ScheduleCrewFilter from './ScheduleCrewFilterSurface';
import { useScheduleSurfaceController, useScheduleSurfaceEvidence } from './ScheduleSurfaceContext';
import sharedStyles from './schedule.module.css';
import boardStyles from './scheduleBoard.module.css';
import timelineStyles from './scheduleTimeline.module.css';
const styles = { ...sharedStyles, ...timelineStyles, ...boardStyles };
const noAction = () => undefined;
const noCrews: [] = [];
const noHidden = new Set<string>();
function cx(...classes: Array<string | false | null | undefined>) { return classes.filter(Boolean).join(' '); }
export type ScheduleBoardSurfaceProps = { query: string; unscheduledCollapsed: boolean; showCompleted: boolean; onQueryChange:(value:string)=>void; onToggleUnscheduledCollapsed:()=>void; onShowCompletedChange:(value:boolean)=>void; dataError?:boolean; scheduleMode?:'v2'|'legacy' };
/** Existing Board controls and viewport; only genuine rows enter its slots. */
export default function ScheduleBoardSurface({ query, unscheduledCollapsed, showCompleted, onQueryChange, onToggleUnscheduledCollapsed, onShowCompletedChange, dataError=false, scheduleMode='v2' }: ScheduleBoardSurfaceProps) {
  const surface = useScheduleSurfaceController()!;
  const read = useScheduleSurfaceEvidence().board;
  const readState = read?.crewFilter.readState ?? (read ? undefined : dataError ? 'unavailable' : 'pending');
  const dataPending = Boolean(readState);
  const crewFilter = read?.crewFilter ?? { readState, crews:noCrews,hiddenCrewIds:noHidden,hiddenItemCount:0,emptyCrewIds:noCrews,onToggleCrew:noAction,onHideCrews:noAction,onShowAllCrews:noAction };
  return <>
    <div className={styles.dragLiveRegion} role="status" aria-live="assertive" ref={surface.slotRefs.live} />
      <div className={styles.panels}>
        <aside
          className={cx(styles.leftPanel, unscheduledCollapsed && styles.leftPanelCollapsed)}
          data-collapsed={unscheduledCollapsed ? 'true' : 'false'}
          aria-label="Unscheduled jobs"
        >
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>Unscheduled</h2>
            <div className={styles.panelHeaderActions}>
              <span className={styles.muted}>{dataPending ? dataError ? 'Unavailable' : 'Loading…' : read?.unscheduledCount}</span>
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

          <div className={styles.unscheduledBody} ref={surface.slotRefs.unscheduled}>
            {!read ? <p className={styles.note} role={dataError ? undefined : 'status'}>{dataError ? 'Unscheduled projects unavailable. Retry the schedule.' : 'Reading unscheduled projects…'}</p> : null}
          </div>

          <div style={{display:'contents'}} ref={surface.slotRefs.debug} />
        </aside>

        <section className={styles.mainPanel} aria-label="Installer lanes">
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
            <ScheduleCrewFilter {...crewFilter} />
          </div>
          <div
            className={styles.lanes}
            ref={surface.slotRefs.lanes}
            data-board-lanes="true"
            data-visible-crew-count={read?.visibleCrewCount ?? undefined}
          >
            {!read ? <div className={styles.allCrewsHidden}><p className={styles.emptyLaneTitle}>{dataError ? 'Schedule unavailable' : 'Reading crews and scheduled work…'}</p></div> : null}
          </div>
        </section>
      </div>
    <div style={{display:'contents'}} ref={surface.slotRefs.boardOverlay} />
  </>;
}
