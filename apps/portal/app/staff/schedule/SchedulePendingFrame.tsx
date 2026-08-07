import HeaderActions from '@/components/layout/HeaderActions';
import StaffPageHeader from '@/components/layout/StaffPageHeader';
import { PageLayout } from '@/components/ui/foundation/FoundationSurfaces';
import styles from './schedule.module.css';
import pendingStyles from './SchedulePendingFrame.module.css';

type PendingScheduleView = 'board' | 'gantt';

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

function PendingInstallerLanes({ view }: { view: PendingScheduleView }) {
  return (
    <>
      <div className={pendingStyles.controls} aria-label="Schedule controls">
        <span className={pendingStyles.controlLabel}>
          {view === 'gantt' ? 'Planning range and crews' : 'Forecast'}
        </span>
        <label><input type="checkbox" disabled /> Show completed jobs</label>
        <button type="button" className={styles.buttonSecondary} disabled>Crews</button>
      </div>
      <div className={pendingStyles.lanes}>
        {Array.from({ length: 3 }, (_, laneIndex) => (
          <section className={pendingStyles.lane} key={laneIndex}>
            <header className={pendingStyles.laneHeader}>
              <h3>Crew</h3>
              <span
                className={pendingStyles.laneValue}
                data-portal-value-slot="loading"
                aria-hidden="true"
              />
            </header>
            <div className={pendingStyles.laneBody}>
              {view === 'gantt' ? (
                Array.from({ length: 5 }, (_, rowIndex) => (
                  <div className={pendingStyles.ganttTrack} key={rowIndex} />
                ))
              ) : (
                Array.from({ length: 2 }, (_, rowIndex) => (
                  <div className={pendingStyles.placeholderCard} key={rowIndex}>
                    <span data-portal-value-slot="loading" aria-hidden="true" />
                    <span data-portal-value-slot="loading" aria-hidden="true" />
                  </div>
                ))
              )}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

export function ScheduleGanttChunkPendingFrame() {
  return (
    <div data-schedule-chunk-pending="gantt" aria-busy="true">
      <PendingInstallerLanes view="gantt" />
      <span className="visually-hidden" role="status">Updating crews...</span>
    </div>
  );
}

function SchedulePendingPanels({ view }: { view: PendingScheduleView }) {
  return (
    <>
      <div className={pendingStyles.panels} data-schedule-chunk-pending={view} aria-busy="true">
        <aside className={pendingStyles.unscheduled} aria-label="Unscheduled jobs">
          <div className={pendingStyles.panelHeader}>
            <h2>Unscheduled</h2>
            <button
              type="button"
              className={pendingStyles.collapseButton}
              aria-label="Collapse unscheduled panel"
              aria-expanded="true"
              disabled
            >
              ‹
            </button>
          </div>
          <div className={pendingStyles.filters}>
            <input
              className={pendingStyles.search}
              aria-label="Search unscheduled projects"
              placeholder="Search projects..."
              disabled
            />
            <p className={pendingStyles.hint}>
              Deposit-stage projects with an active estimate appear here.
            </p>
          </div>
          <div className={pendingStyles.placeholderList}>
            {Array.from({ length: 3 }, (_, index) => (
              <div className={pendingStyles.placeholderCard} key={index}>
                <span data-portal-value-slot="loading" aria-hidden="true" />
                <span data-portal-value-slot="loading" aria-hidden="true" />
              </div>
            ))}
          </div>
        </aside>
        <section
          className={pendingStyles.installerRegion}
          aria-label="Installer lanes"
          data-portal-page-region="schedule-installer-lanes"
          aria-busy="true"
        >
          <PendingInstallerLanes view={view} />
        </section>
      </div>
      <span className="visually-hidden" role="status">Updating crews...</span>
    </>
  );
}

export function ScheduleBoardChunkPendingFrame() {
  return <SchedulePendingPanels view="board" />;
}

export default function SchedulePendingFrame({
  view = 'board',
  onViewSelect,
}: {
  view?: PendingScheduleView;
  onViewSelect?: (view: PendingScheduleView) => void;
}) {
  return (
    <PageLayout
      width="full"
      density="compact"
      data-ui-foundation-consumer="schedule"
      data-portal-page-shell="schedule"
      data-portal-page-shell-ready="true"
      data-portal-page-shell-state="pending"
      data-schedule-view={view}
      data-schedule-background-ready="false"
      className={cx(styles.page, styles.pageLocked)}
    >
      <StaffPageHeader
        title="Schedule"
        right={
          <HeaderActions>
            <button
              type="button"
              className={styles.buttonSecondary}
              aria-pressed={view === 'board'}
              disabled={!onViewSelect}
              onClick={() => onViewSelect?.('board')}
            >
              Board
            </button>
            <button
              type="button"
              className={styles.buttonSecondary}
              aria-pressed={view === 'gantt'}
              disabled={!onViewSelect}
              onClick={() => onViewSelect?.('gantt')}
            >
              Gantt
            </button>
          </HeaderActions>
        }
      />
      <div className={pendingStyles.stack}>
        <SchedulePendingPanels view={view} />
      </div>
    </PageLayout>
  );
}
