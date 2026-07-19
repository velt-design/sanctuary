import Link from 'next/link';
import styles from '@/components/projects/ProjectPage/ProjectPage.module.css';

export default function ProjectDetailLoading() {
  return (
    <main className={styles.page} data-project-route-pending="true">
      <section className={styles.surface}>
        <div className={styles.surfaceInner}>
          <h1 className={styles.title}>Opening project...</h1>
          <p className={styles.subtitle} role="status">
            Preparing the project summary in the background.
          </p>
          <Link href="/staff/projects" className={styles.backLink}>
            Back to Projects
          </Link>
        </div>
      </section>
    </main>
  );
}
