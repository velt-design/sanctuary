import Link from 'next/link';
import { notFound } from 'next/navigation';
import styles from '@/components/projects/ProjectPage/ProjectPage.module.css';
import DesignWorkbenchEstimateClient from './DesignWorkbenchEstimateClient';
import DesignWorkbenchFixtureClient from './DesignWorkbenchFixtureClient';
import { loadDesignWorkbenchRouteContext } from '@/lib/drawings/loadDesignWorkbenchRouteContext';
import type { SanctuaryGeometryWorkbenchFixture } from '@/lib/drawings/sanctuaryWorkbenchFixtures.types';
import { getSanctuaryGeometryWorkbenchFixture } from '@/lib/drawings/sanctuaryWorkbenchFixtures';
import { buildWorkbenchFixturePricingReadiness } from '@/lib/drawings/workbenchFixturePricingReadiness';
import { isSanctuaryGeometryWorkbenchEnabled, isSanctuaryGeometryWorkbenchFixturesEnabled } from '@/lib/drawings/workbenchFlags';
import { loadProjectEstimateDetail } from '@/lib/estimates/loadProjectEstimateDetail';
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

function formatLabel(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function renderInvalidFixtureLines(fixtureSlug: string): string[] {
  return [
    'This hidden internal route can mount baked Sanctuary Geometry Workbench fixtures for QA.',
    'Route state: Invalid Fixture',
    `Unknown fixture slug: ${fixtureSlug}`,
  ];
}

function renderNoEstimateLines(context: {
  providedEstimateId: string | null;
  providedRequestId: string | null;
}): string[] {
  const lines = ['No usable estimate exists for this project yet. Create or generate an estimate before opening the workbench.'];
  if (context.providedEstimateId) {
    lines.push(`Supplied estimateId: ${context.providedEstimateId}`);
  }
  if (context.providedRequestId) {
    lines.push(`Supplied requestId: ${context.providedRequestId}`);
  }
  return lines;
}

export default async function DesignWorkbenchPage({
  params,
  searchParams,
}: {
  params: PageParams | Promise<PageParams>;
  searchParams?: SearchParams | Promise<SearchParams>;
}) {
  if (!isSanctuaryGeometryWorkbenchEnabled()) {
    notFound();
  }

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

    const pricingReadiness = buildWorkbenchFixturePricingReadiness(fixture, {
      projectId: normalizedProjectId,
    });

    return (
      <main
        className={styles.page}
        data-project-id={normalizedProjectId}
        data-workbench-context="fixture_ready"
        data-workbench-fixture={fixture.slug}
        data-workbench-pricing-source={pricingReadiness.source}
        data-workbench-pricing-trust-status={pricingReadiness.trustStatus}
        data-workbench-pricing-readiness={pricingReadiness.readiness}
        data-workbench-pricing-blocking-gates={pricingReadiness.blockingGateCodes.join(',')}
        data-workbench-pricing-quantity-takeoff-source={pricingReadiness.quantityTakeoffSource}
        data-workbench-pricing-parity-status={pricingReadiness.parity.status}
        data-workbench-pricing-parity-pergolas-compared={pricingReadiness.parity.pergolasCompared}
        data-workbench-pricing-parity-modules-compared={pricingReadiness.parity.modulesCompared}
        data-workbench-pricing-parity-differences={pricingReadiness.parity.differences}
        data-workbench-pricing-parity-blocking-differences={pricingReadiness.parity.blockingDifferences}
        data-workbench-pricing-parity-warning-differences={pricingReadiness.parity.warningDifferences}
      >
        <section className={styles.surface}>
          <div className={styles.surfaceInner}>
            <DesignWorkbenchFixtureClient
              fixture={fixture}
              projectName={projectName}
              siteAddress={siteAddress}
              backHref={backHref}
            />
          </div>
        </section>
      </main>
    );
  }

  const context = await loadDesignWorkbenchRouteContext({
    projectId: normalizedProjectId,
    estimateId,
    requestId,
  });

  if (context.kind === 'project_unavailable') {
    return renderUnavailable('We could not load this project. It may have been deleted, or access is temporarily unavailable.');
  }

  if (context.kind === 'ready') {
    let estimateDetail = null;

    try {
      estimateDetail = await loadProjectEstimateDetail(normalizedProjectId, context.estimate.id);
    } catch {
      return renderUnavailable('We could not load the selected estimate for this project. It may have been deleted, or access is temporarily unavailable.');
    }

    if (!estimateDetail) {
      return renderUnavailable('We could not load the selected estimate for this project. It may have been deleted, or access is temporarily unavailable.');
    }

    return (
      <main
        className={styles.page}
        data-project-id={normalizedProjectId}
        data-workbench-context={context.kind}
        data-estimate-id={context.estimate.id}
        data-request-id={context.request?.id}
      >
        <section className={styles.surface}>
          <div className={styles.surfaceInner}>
            <DesignWorkbenchEstimateClient
              estimate={estimateDetail}
              projectName={context.project.name}
              siteAddress={context.project.siteAddress}
              backHref={backHref}
            />
          </div>
        </section>
      </main>
    );
  }

  return (
    <main
      className={styles.page}
      data-project-id={normalizedProjectId}
      data-workbench-context={context.kind}
      data-estimate-id={context.providedEstimateId ?? undefined}
      data-request-id={context.providedRequestId ?? undefined}
    >
      <section className={styles.surface}>
        <div className={styles.surfaceInner}>
          <h1 className={styles.title}>Design Workbench</h1>
          <p className={styles.subtitle}>{context.project.name}</p>
          {renderNoEstimateLines({
            providedEstimateId: context.providedEstimateId,
            providedRequestId: context.providedRequestId,
          }).map((line) => (
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
