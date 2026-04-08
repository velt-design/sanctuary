import Link from 'next/link';
import styles from '@/components/projects/ProjectPage/ProjectPage.module.css';
import { getProjectPageSnapshot } from '@/lib/projects/getProjectPageSnapshot';

type PageParams = { projectId: string };

function renderUnavailable(message: string) {
  return (
    <main className={styles.page}>
      <section className={styles.surface}>
        <div className={styles.surfaceInner}>
          <h1 className={styles.title}>Project unavailable</h1>
          <p className={styles.subtitle}>{message}</p>
          <Link href="/staff/projects" className={styles.backLink}>
            Back to Projects
          </Link>
        </div>
      </section>
    </main>
  );
}

export default async function DesignWorkbenchPage({
  params,
}: {
  params: PageParams | Promise<PageParams>;
}) {
  const { projectId } = await params;
  const normalizedProjectId = projectId.trim();

  if (!normalizedProjectId) {
    return renderUnavailable('Invalid project id.');
  }

  const snapshot = await getProjectPageSnapshot(normalizedProjectId);
  if (!snapshot) {
    return renderUnavailable('We could not load this project. It may have been deleted, or access is temporarily unavailable.');
  }

  return (
    <main className={styles.page} data-project-id={normalizedProjectId}>
      <section className={styles.surface}>
        <div className={styles.surfaceInner}>
          <h1 className={styles.title}>Design Workbench</h1>
          <p className={styles.subtitle}>{snapshot.project.name}</p>
          <p className={styles.subtitle}>This hidden internal route is the initial Sanctuary Geometry Workbench scaffold.</p>
          <Link href={`/staff/projects/${encodeURIComponent(normalizedProjectId)}`} className={styles.backLink}>
            Back to Project
          </Link>
        </div>
      </section>
    </main>
  );
}
