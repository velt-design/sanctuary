import Link from 'next/link';
import type { SiteVisitsSnapshot } from '@/lib/dashboard/types';
import styles from '@/app/staff/projects/projects.module.css';
import dash from '../dashboard.module.css';
import { formatShortDateTime } from '@/lib/dashboard/format';
import { projectDetailHref } from '@/lib/dashboard/links';

export default function SiteVisitsCard({ siteVisits }: { siteVisits: SiteVisitsSnapshot }) {
  return (
    <section className={styles.section} aria-label="Site visits">
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Site visits</h2>
        <Link className={styles.link} href={siteVisits.hrefSiteVisits}>
          Open calendar
        </Link>
      </div>
      <div className={styles.sectionBody}>
        <div className={dash.sectionMeta} style={{ marginBottom: 10 }}>
          Unscheduled visits: <strong>{siteVisits.unscheduledCount}</strong>
        </div>

        <div className={dash.twoColumn}>
          <div>
            <div className={dash.sectionMeta} style={{ marginBottom: 8 }}>
              Today
            </div>
            {siteVisits.today.length ? (
              <ul className={dash.list}>
                {siteVisits.today.map((visit) => (
                  <li key={visit.id} className={dash.listItem}>
                    <div className={dash.listMain}>
                      <div className={dash.listTitle}>
                        {visit.projectId ? (
                          <Link className={styles.link} href={projectDetailHref(visit.projectId)}>
                            {visit.projectName ?? 'Project'}
                          </Link>
                        ) : (
                          visit.projectName ?? 'Project'
                        )}
                      </div>
                      <div className={dash.listSubtitle}>
                        {[visit.clientName ?? visit.locationLabel ?? '—', visit.assignedTo ? `Assigned: ${visit.assignedTo}` : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </div>
                    <div className={dash.listMeta}>{formatShortDateTime(visit.startsAt)}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className={dash.sectionMeta}>No site visits today.</div>
            )}
          </div>

          <div>
            <div className={dash.sectionMeta} style={{ marginBottom: 8 }}>
              Next 7 days
            </div>
            {siteVisits.next7.length ? (
              <ul className={dash.list}>
                {siteVisits.next7.map((visit) => (
                  <li key={visit.id} className={dash.listItem}>
                    <div className={dash.listMain}>
                      <div className={dash.listTitle}>
                        {visit.projectId ? (
                          <Link className={styles.link} href={projectDetailHref(visit.projectId)}>
                            {visit.projectName ?? 'Project'}
                          </Link>
                        ) : (
                          visit.projectName ?? 'Project'
                        )}
                      </div>
                      <div className={dash.listSubtitle}>
                        {[visit.clientName ?? visit.locationLabel ?? '—', visit.assignedTo ? `Assigned: ${visit.assignedTo}` : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </div>
                    <div className={dash.listMeta}>{formatShortDateTime(visit.startsAt)}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className={dash.sectionMeta}>No upcoming site visits.</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
