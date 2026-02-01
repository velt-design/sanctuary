import Link from 'next/link';
import type { ScheduleSnapshot } from '@/lib/dashboard/types';
import styles from '@/app/staff/projects/projects.module.css';
import dash from '../dashboard.module.css';
import { formatShortDate } from '@/lib/dashboard/format';
import { projectDetailHref } from '@/lib/dashboard/links';

function CrewAvailabilityList(props: {
  rows: { crewName: string; nextAvailableDate?: string | null }[];
  hrefBoard: string;
}) {
  if (!props.rows.length) {
    return <div className={dash.sectionMeta}>No crews available yet.</div>;
  }

  const rows = props.rows.slice(0, 6);
  const hasMore = props.rows.length > 6;

  return (
    <div className={dash.flatList}>
      {rows.map((crew) => (
        <div key={crew.crewName} className={dash.flatRow}>
          <div className={dash.flatRowTitle}>{crew.crewName}</div>
          <div className={dash.flatRowMeta}>{crew.nextAvailableDate ? formatShortDate(crew.nextAvailableDate) : '—'}</div>
        </div>
      ))}
      {hasMore ? (
        <div className={dash.flatListFooter}>
          <Link className={dash.flatRowLink} href={props.hrefBoard}>
            View all crews
          </Link>
        </div>
      ) : null}
    </div>
  );
}

export default function InstallScheduleCard({ schedule }: { schedule: ScheduleSnapshot }) {
  return (
    <section className={styles.section} aria-label="Install schedule">
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Install schedule</h2>
        <div className={styles.actions}>
          <Link className={styles.buttonSecondary} href={schedule.hrefBoard}>
            Board
          </Link>
          <Link className={styles.buttonSecondary} href={schedule.hrefGantt}>
            Gantt
          </Link>
        </div>
      </div>
      <div className={styles.sectionBody}>
        <div className={dash.twoColumn}>
          <div>
            <div className={dash.sectionMeta} style={{ marginBottom: 8 }}>
              Starting soon
            </div>
            {schedule.startingSoon.length ? (
              <div className={dash.flatList}>
                {schedule.startingSoon.map((item) => (
                  <div key={`${item.projectId}-${item.startDate}`} className={dash.flatRow}>
                    <div className={dash.flatRowMain}>
                      <div className={dash.flatRowTitle}>
                        {item.projectId ? (
                          <Link className={dash.flatRowLink} href={projectDetailHref(item.projectId)}>
                            {item.projectName}
                          </Link>
                        ) : (
                          item.projectName
                        )}
                      </div>
                      <div className={dash.flatRowSubtitle}>{item.crewName}</div>
                    </div>
                    <div className={dash.flatRowMeta}>{formatShortDate(item.startDate)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={dash.sectionMeta}>No installs starting in the next 7 days.</div>
            )}
          </div>

          <div>
            <div className={dash.sectionMeta} style={{ marginBottom: 8 }}>
              Next available
            </div>
            <CrewAvailabilityList rows={schedule.crewAvailability} hrefBoard={schedule.hrefBoard} />
          </div>
        </div>
      </div>
    </section>
  );
}
