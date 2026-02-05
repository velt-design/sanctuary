import Link from 'next/link';
import type { SiteVisitsSnapshot } from '@/lib/dashboard/types';
import styles from '@/app/staff/projects/projects.module.css';
import dash from '../dashboard.module.css';
import { formatShortDateTime } from '@/lib/dashboard/format';
import { projectDetailHref } from '@/lib/dashboard/links';

export default function SiteVisitsCard({ siteVisits }: { siteVisits: SiteVisitsSnapshot }) {
  const maxItems = 3;
  const todayItems = siteVisits.today.slice(0, maxItems);
  const next7Items = siteVisits.next7.slice(0, maxItems);
  const todayHasMore = siteVisits.today.length > maxItems;
  const next7HasMore = siteVisits.next7.length > maxItems;

  return (
    <section className={`${styles.section} ${dash.card} ${dash.cardCompact}`} aria-label="Site visits">
      <div className={`${styles.sectionHeader} ${dash.cardHeader}`}>
        <h2 className={styles.sectionTitle}>Site visits</h2>
        <Link className={styles.link} href={siteVisits.hrefSiteVisits}>
          Open calendar
        </Link>
      </div>
      <div className={`${styles.sectionBody} ${dash.cardBody}`}>
        <div className={dash.sectionMeta} style={{ marginBottom: 10 }}>
          Unscheduled visits: <strong>{siteVisits.unscheduledCount}</strong>
        </div>

        <div className={dash.twoColumn}>
          <div>
            <div className={dash.sectionMeta} style={{ marginBottom: 8 }}>
              Today
            </div>
            {todayItems.length ? (
              <ul className={dash.list}>
                {todayItems.map((visit) => (
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
            {todayHasMore ? (
              <div className={dash.sectionMeta} style={{ marginTop: 8 }}>
                <Link className={dash.flatRowLink} href={siteVisits.hrefSiteVisits}>
                  View all visits
                </Link>
              </div>
            ) : null}
          </div>

          <div>
            <div className={dash.sectionMeta} style={{ marginBottom: 8 }}>
              Next 7 days
            </div>
            {next7Items.length ? (
              <ul className={dash.list}>
                {next7Items.map((visit) => (
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
            {next7HasMore ? (
              <div className={dash.sectionMeta} style={{ marginTop: 8 }}>
                <Link className={dash.flatRowLink} href={siteVisits.hrefSiteVisits}>
                  View all visits
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
