import Link from 'next/link';
import HeaderActions from '@/components/layout/HeaderActions';
import PageHeader from '@/components/layout/PageHeader';
import styles from './projects.module.css';

export default function ProjectsLoading() {
  return (
    <main
      className={styles.page}
      data-projects-index-state="pending"
      data-projects-index-background-ready="false"
      aria-label="Opening projects"
    >
      <PageHeader
        title="Projects"
        right={
          <HeaderActions>
            <Link className={styles.button} href="/staff/projects/design-packages">
              Drafting Queue
            </Link>
            <Link className={styles.button} href="/staff/projects/running-jobs">
              Running Jobs
            </Link>
            <Link className={styles.button} href="/staff/projects/new">
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
