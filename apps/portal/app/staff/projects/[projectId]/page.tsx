import Link from 'next/link';
import ProjectHeader from '@/components/projects/ProjectPage/ProjectHeader';
import ProjectPipelineBar from '@/components/projects/ProjectPage/ProjectPipelineBar';
import ProjectPageShell from '@/components/projects/ProjectPage/ProjectPageShell';
import { getProjectPageSnapshot } from '@/lib/projects/getProjectPageSnapshot';
import styles from '@/components/projects/ProjectPage/ProjectPage.module.css';

const VALID_TABS = new Set(['activity', 'emails', 'estimates', 'quotes', 'files']);

function parseTab(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw && VALID_TABS.has(raw)) return raw;
  return 'activity';
}

function parseMode(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === 'focus' ? 'focus' : 'general';
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
  const mode = parseMode(resolvedSearchParams?.mode);

  const snapshot = await getProjectPageSnapshot(projectId);
  if (!snapshot) {
    return (
      <main className={styles.page}>
        <section className={styles.surface}>
          <div className={styles.surfaceInner}>
            <h1 className={styles.title}>Project unavailable</h1>
            <p className={styles.subtitle}>
              We couldn&apos;t load this project. It may have been deleted, or access to the record is temporarily unavailable.
            </p>
            <Link
              href="/staff/projects"
              className={styles.backLink}
            >
              Back to Projects
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <ProjectHeader project={snapshot.project} />
      <ProjectPipelineBar stage={snapshot.pipeline.stage} />
      <ProjectPageShell snapshot={snapshot} tab={tab} mode={mode} />
    </main>
  );
}
