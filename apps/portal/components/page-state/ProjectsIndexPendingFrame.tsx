'use client';

import Link from 'next/link';
import HeaderActions from '@/components/layout/HeaderActions';
import StaffPageHeader from '@/components/layout/StaffPageHeader';
import type { PortalInstantRoute } from '@/lib/portalInstantRoutes';
import styles from './ProjectsIndexPendingFrame.module.css';

type ProjectsIndexPendingFrameProps = {
  instantRoute?: PortalInstantRoute;
  title?: string;
  description?: string;
  projectLabel?: string | null;
};

export default function ProjectsIndexPendingFrame({
  instantRoute = 'projects-index',
  title = 'Projects',
  description,
  projectLabel,
}: ProjectsIndexPendingFrameProps = {}) {
  if (instantRoute !== 'projects-index') {
    const visibleTitle = instantRoute === 'project-detail' && projectLabel?.trim()
      ? projectLabel.trim()
      : title;

    return (
      <main
        className={styles.page}
        data-portal-instant-shell={instantRoute}
        data-portal-instant-shell-state="pending"
        data-project-route-pending={instantRoute === 'project-detail' ? 'true' : undefined}
        aria-busy="true"
      >
        <StaffPageHeader variant="index" title={visibleTitle} />
        <div className={styles.stack}>
          <section className={styles.section} aria-label={`${visibleTitle} workspace`}>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Workspace</h2>
              <span className={styles.muted}>Updating…</span>
            </div>
            <div className={styles.sectionBody}>
              <p className={styles.note} role="status">{description}</p>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main
      className={styles.page}
      data-projects-index-state="pending"
      data-ui-foundation-consumer="projects-pending"
      data-projects-index-background-ready="false"
      aria-label="Opening projects"
    >
      <StaffPageHeader
        variant="index"
        title="Projects"
        right={
          <HeaderActions className={styles.actions}>
            <Link className={styles.action} href="/staff/projects/design-packages">
              Drafting Queue
            </Link>
            <Link className={styles.action} href="/staff/projects/running-jobs">
              Running Jobs
            </Link>
            <Link className={styles.action} href="/staff/projects/new">
              New Project
            </Link>
          </HeaderActions>
        }
      />

      <div className={styles.stack}>
        <section className={styles.section} aria-label="Filters">
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Filters</h2>
          </div>
          <div className={styles.sectionBody}>
            <div className={styles.formGrid} aria-busy="true">
              <div className={styles.field}>
                <label htmlFor="projectSearchPending">Search</label>
                <input id="projectSearchPending" placeholder="Name, client, phone, address…" disabled />
              </div>
              <div className={styles.field}>
                <label htmlFor="projectStatusPending">Status</label>
                <select id="projectStatusPending" defaultValue="all" disabled>
                  <option value="all">All</option>
                </select>
              </div>
              <div className={styles.field}>
                <label htmlFor="projectArchivePending">Archive</label>
                <select id="projectArchivePending" defaultValue="active" disabled>
                  <option value="active">Active</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.section} aria-label="Projects list" aria-busy="true">
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>All Projects</h2>
            <span className={styles.muted}>Updating…</span>
          </div>
          <div className={styles.sectionBody}>
            <p className={styles.note}>Updating projects…</p>
          </div>
        </section>
      </div>
    </main>
  );
}
