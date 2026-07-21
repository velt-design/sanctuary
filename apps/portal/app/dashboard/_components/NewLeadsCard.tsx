import Link from 'next/link';
import ProjectsIndexLink from '@/components/navigation/ProjectsIndexLink';
import styles from '@/components/ui/surface/PortalSurface.module.css';
import { PORTAL_TIME_ZONE } from '@/lib/format/portalDateTime';
import { projectsHref } from '@/lib/dashboard/links';
import type { DashboardNewLead } from '@/lib/dashboard/types';
import dash from '../dashboard.module.css';

function createdLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat('en-NZ', {
    timeZone: PORTAL_TIME_ZONE,
    day: 'numeric',
    month: 'short',
  }).format(date);
}

export default function NewLeadsCard({ items, totalCount }: { items: DashboardNewLead[]; totalCount: number }) {
  return (
    <section className={`${styles.section} ${dash.card}`} aria-label="New Leads">
      <div className={`${styles.sectionHeader} ${dash.cardHeader}`}>
        <div>
          <h2 className={styles.sectionTitle}>New Leads</h2>
          <div className={`${styles.muted} ${dash.cardSubheading}`}>Oldest uncontacted first.</div>
        </div>
        <span className={dash.sectionMeta}>{totalCount} total</span>
      </div>
      <div className={`${styles.sectionBody} ${dash.cardBody}`}>
        {items.length ? (
          <ul className={dash.operationalList}>
            {items.map((item) => (
              <li key={item.projectId}>
                <Link className={dash.operationalRow} href={item.href}>
                  <span className={dash.rowPrimary}>
                    <strong>{item.projectName}</strong>
                    <small>{item.contactName ?? item.siteAddress ?? 'Contact not linked'}</small>
                  </span>
                  <time dateTime={item.createdAt}>{createdLabel(item.createdAt)}</time>
                </Link>
              </li>
            ))}
          </ul>
        ) : <div className={dash.emptyState}>No projects are currently in New.</div>}
      </div>
      <div className={dash.cardFooter}>
        <ProjectsIndexLink href={projectsHref({ status: 'NEW' })}>View all new leads <span aria-hidden="true">→</span></ProjectsIndexLink>
      </div>
    </section>
  );
}
