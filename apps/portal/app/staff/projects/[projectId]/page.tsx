import ProjectsIndexLink from '@/components/navigation/ProjectsIndexLink';
import styles from '@/components/projects/ProjectPage/ProjectPage.module.css';
import ProjectSnapshotPageClient from './ProjectSnapshotPageClient';
import { isPortalPageDebugExportEnabled } from '@/lib/debug/portalPageDebugExport';
import { isProjectTabKey } from '@/lib/projects/projectTabs';

function parseTab(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (isProjectTabKey(raw)) return raw;
  return 'activity';
}

type SearchParams = { [key: string]: string | string[] | undefined };
type PageParams = { projectId: string };

function parseSingleSearchParam(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && raw.trim() ? raw : null;
}

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
  const estimateId = parseSingleSearchParam(resolvedSearchParams?.estimateId);
  if (!projectId.trim()) {
    return (
      <main className={styles.page}>
        <section className={styles.surface}>
          <div className={styles.surfaceInner}>
            <h1 className={styles.title}>Project unavailable</h1>
            <p className={styles.subtitle}>Invalid project id.</p>
            <ProjectsIndexLink href="/staff/projects" className={styles.backLink}>
              Back to Projects
            </ProjectsIndexLink>
          </div>
        </section>
      </main>
    );
  }

  return (
    <ProjectSnapshotPageClient
      projectId={projectId}
      tab={tab}
      estimateId={estimateId}
      debugExportEnabled={isPortalPageDebugExportEnabled()}
    />
  );
}
