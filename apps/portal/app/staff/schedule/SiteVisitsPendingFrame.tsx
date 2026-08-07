import HeaderActions from '@/components/layout/HeaderActions';
import StaffPageHeader from '@/components/layout/StaffPageHeader';
import { PageLayout } from '@/components/ui/foundation/FoundationSurfaces';
import styles from './schedule.module.css';

function PendingValue() {
  return <span data-portal-value-slot="loading" aria-hidden="true" />;
}

export function SiteVisitsChunkPendingFrame() {
  return (
    <section
      className={styles.siteVisitsShell}
      aria-label="Site visits calendar"
      aria-busy="true"
      data-schedule-chunk-pending="site-visits"
    >
      <div className={styles.siteVisitsTopBar}>
        <div className={styles.siteVisitsControls}>
          <button type="button" className={styles.buttonSecondary} disabled>← Prev</button>
          <button type="button" className={styles.buttonSecondary} disabled>This week</button>
          <button type="button" className={styles.buttonSecondary} disabled>Next →</button>
          <span className={styles.controlMeta}><PendingValue /></span>
        </div>
        <div className={styles.siteVisitsControls}>
          <label className={styles.controlMeta}>Sales:</label>
          <select className={styles.siteVisitsSelect} aria-label="Salesperson" disabled>
            <option>All</option>
          </select>
          <span className={styles.controlMeta}><PendingValue /></span>
        </div>
      </div>
      <div className={styles.siteVisitsContent}>
        <div className={styles.siteVisitsPanels}>
          <aside className={styles.siteVisitsQueue} aria-label="Unscheduled site visits">
            <div className={styles.siteVisitsQueueHeader}>
              <div>
                <div className={styles.siteVisitsQueueTitle}>Unscheduled site visits</div>
                <div className={styles.muted}><PendingValue /></div>
              </div>
            </div>
            <div className={styles.siteVisitsQueueSearchRow}>
              <div className={styles.siteVisitsQueueSearch}>
                <input className={styles.siteVisitsSearchInput} placeholder="Search..." disabled />
              </div>
            </div>
            <div className={styles.siteVisitsQueueBody}><PendingValue /></div>
          </aside>
          <main className={styles.siteVisitsCalendar} aria-label="Site visits week calendar">
            <div className={styles.siteVisitsCalendarScroll}>
              <div className={styles.siteVisitsCalendarHeader} aria-hidden="true">
                <div className={styles.siteVisitsTimeHeader} />
                {Array.from({ length: 5 }, (_, index) => (
                  <div className={styles.siteVisitsDayHeader} key={index}><PendingValue /></div>
                ))}
              </div>
              <div className={styles.siteVisitsCalendarBody} aria-hidden="true">
                <div className={styles.siteVisitsTimeColumn} />
                {Array.from({ length: 5 }, (_, index) => (
                  <div className={styles.siteVisitsDayColumn} key={index} />
                ))}
              </div>
            </div>
          </main>
        </div>
      </div>
      <span className="visually-hidden" role="status">Updating site visits...</span>
    </section>
  );
}

export default function SiteVisitsPendingFrame({
  onViewSelect,
}: {
  onViewSelect?: (view: 'board' | 'gantt') => void;
}) {
  return (
    <PageLayout
      width="full"
      density="compact"
      data-ui-foundation-consumer="schedule"
      data-portal-page-shell="schedule"
      data-portal-page-shell-ready="true"
      data-portal-page-shell-state="pending"
      data-schedule-view="site-visits"
      className={`${styles.page} ${styles.pageLocked}`}
    >
      <StaffPageHeader
        title="Schedule"
        right={
          <HeaderActions>
            <button
              type="button"
              className={styles.buttonSecondary}
              aria-pressed={false}
              disabled={!onViewSelect}
              onClick={() => onViewSelect?.('board')}
            >
              Board
            </button>
            <button
              type="button"
              className={styles.buttonSecondary}
              aria-pressed={false}
              disabled={!onViewSelect}
              onClick={() => onViewSelect?.('gantt')}
            >
              Gantt
            </button>
          </HeaderActions>
        }
      />
      <div className={`${styles.stack} ${styles.stackLocked}`}>
        <SiteVisitsChunkPendingFrame />
      </div>
    </PageLayout>
  );
}
