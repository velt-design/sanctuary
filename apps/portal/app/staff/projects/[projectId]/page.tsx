import Link from 'next/link';
import styles from '@/components/projects/ProjectPage/ProjectPage.module.css';
import ProjectSnapshotPageClient from './ProjectSnapshotPageClient';
import { getProjectPageSnapshot } from '@/lib/projects/getProjectPageSnapshot';

const VALID_TABS = new Set(['estimates', 'quotes', 'job-packs', 'emails', 'files']);

function parseTab(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw && VALID_TABS.has(raw)) return raw;
  return 'estimates';
}

type SearchParams = { [key: string]: string | string[] | undefined };
type PageParams = { projectId: string };

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: PageParams | Promise<PageParams>;
  searchParams?: SearchParams | Promise<SearchParams>;
}) {
  const { projectId } = await params;
  const resolvedSearchParams = await searchParams;
  const tab = parseTab(resolvedSearchParams?.tab);
  if (!projectId.trim()) {
    return (
      <main className={styles.page}>
        <section className={styles.surface}>
          <div className={styles.surfaceInner}>
            <h1 className={styles.title}>Project unavailable</h1>
            <p className={styles.subtitle}>Invalid project id.</p>
            <Link href="/staff/projects" className={styles.backLink}>
              Back to Projects
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const snapshot = await getProjectPageSnapshot(projectId);
  if (!snapshot) {
    return (
      <main className={styles.page}>
        <section className={styles.surface}>
          <div className={styles.surfaceInner}>
            <h1 className={styles.title}>Project unavailable</h1>
            <p className={styles.subtitle}>We could not load this project. It may have been deleted, or access is temporarily unavailable.</p>
            <Link href="/staff/projects" className={styles.backLink}>
              Back to Projects
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return <ProjectSnapshotPageClient projectId={projectId} tab={tab} initialSnapshot={snapshot} />;
}
