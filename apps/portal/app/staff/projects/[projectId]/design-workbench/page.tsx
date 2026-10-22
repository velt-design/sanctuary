import Link from 'next/link';
import { notFound } from 'next/navigation';
import styles from '@/components/projects/ProjectPage/ProjectPage.module.css';
import { requireStaffPageAccess } from '@/lib/auth';
import DesignWorkbenchReadHost from './DesignWorkbenchReadHost';
import { loadWorkbenchPageRead } from './loadWorkbenchPageRead.server';
import DesignWorkbenchFixtureClient from './DesignWorkbenchFixtureClient';
import { getSanctuaryGeometryWorkbenchFixture } from '@/lib/drawings/sanctuaryWorkbenchFixtures';
import { isSanctuaryGeometryWorkbenchFixturesEnabled } from '@/lib/drawings/workbenchFlags';
import { isPortalPageDebugExportEnabled } from '@/lib/debug/portalPageDebugExport';
import { getProjectPageSnapshot } from '@/lib/projects/getProjectPageSnapshot';

type PageParams = { projectId: string };
type SearchParams = { [key: string]: string | string[] | undefined };

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

function resolveQueryParam(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed || null;
}

function renderInvalidFixtureLines(fixtureSlug: string): string[] {
  return [
    'This hidden internal route can mount baked Sanctuary Geometry Workbench fixtures for QA.',
    'Route state: Invalid Fixture',
    `Unknown fixture slug: ${fixtureSlug}`,
  ];
}


export default async function DesignWorkbenchPage({
  params,
  searchParams,
}: {
  params: Promise<PageParams>;
  searchParams?: Promise<SearchParams>;
}) {
  const { projectId } = await params;
  const normalizedProjectId = projectId.trim();

  if (!normalizedProjectId) {
    return renderUnavailable('Invalid project id.');
  }

  const resolvedSearchParams = await searchParams;
  const estimateId = resolveQueryParam(resolvedSearchParams?.estimateId);
  const requestId = resolveQueryParam(resolvedSearchParams?.requestId);
  const fixtureSlug = resolveQueryParam(resolvedSearchParams?.fixture);
  const backHref = `/staff/projects/${encodeURIComponent(normalizedProjectId)}`;

  if (fixtureSlug && !isSanctuaryGeometryWorkbenchFixturesEnabled()) {
    notFound();
  }

  if (fixtureSlug) {
    const fixture = getSanctuaryGeometryWorkbenchFixture(fixtureSlug);
    const snapshot = await getProjectPageSnapshot(normalizedProjectId).catch(() => null);
    const projectName = snapshot?.project.name ?? 'Sanctuary Fixture Project';
    const siteAddress = snapshot?.project.siteAddress ?? null;

    if (!fixture) {
      return (
        <main
          className={styles.page}
          data-project-id={normalizedProjectId}
          data-workbench-context="invalid_fixture"
          data-workbench-fixture={fixtureSlug}
        >
          <section className={styles.surface}>
            <div className={styles.surfaceInner}>
              <h1 className={styles.title}>Design Workbench</h1>
              <p className={styles.subtitle}>{projectName}</p>
              {renderInvalidFixtureLines(fixtureSlug).map((line) => (
                <p key={line} className={styles.subtitle}>
                  {line}
                </p>
              ))}
              <Link href={backHref} className={styles.backLink}>
                Back to Project
              </Link>
            </div>
          </section>
        </main>
      );
    }

    return (
      <main
        className={styles.page}
        data-project-id={normalizedProjectId}
        data-workbench-context="fixture_ready"
        data-workbench-fixture={fixture.slug}
      >
        <section className={styles.surface}>
          <div className={styles.surfaceInner}>
            <DesignWorkbenchFixtureClient
              fixture={fixture}
              projectId={normalizedProjectId}
              projectName={projectName}
              siteAddress={siteAddress}
              backHref={backHref}
            />
          </div>
        </section>
      </main>
    );
  }

  await requireStaffPageAccess(`/staff/projects/${encodeURIComponent(normalizedProjectId)}/design-workbench`);
  const initialRead = loadWorkbenchPageRead({ projectId: normalizedProjectId, estimateId, requestId });
  return <DesignWorkbenchReadHost projectId={normalizedProjectId} estimateId={estimateId} requestId={requestId} initialRead={initialRead} backHref={backHref} debugExportEnabled={isPortalPageDebugExportEnabled()} />;
}
