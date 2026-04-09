import Link from 'next/link';
import { notFound } from 'next/navigation';
import styles from '@/components/projects/ProjectPage/ProjectPage.module.css';
import DesignWorkbenchEstimateClient from './DesignWorkbenchEstimateClient';
import DesignWorkbenchFixtureClient from './DesignWorkbenchFixtureClient';
import {
  loadDesignWorkbenchRouteContext,
  type DesignWorkbenchRouteContext,
  type DesignWorkbenchRouteEstimateSummary,
  type DesignWorkbenchRouteRequestSummary,
  type WorkbenchEstimateWarning,
  type WorkbenchRequestWarning,
} from '@/lib/drawings/loadDesignWorkbenchRouteContext';
import type { SanctuaryGeometryWorkbenchFixture } from '@/lib/drawings/sanctuaryWorkbenchFixtures.types';
import { getSanctuaryGeometryWorkbenchFixture } from '@/lib/drawings/sanctuaryWorkbenchFixtures';
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

function formatEstimateSelectionSource(source: DesignWorkbenchRouteEstimateSummary['selectionSource']): string {
  if (source === 'query') return 'Query param';
  if (source === 'active_draft') return 'Active draft default';
  return 'Most recent default';
}

function formatRequestSelectionSource(source: DesignWorkbenchRouteRequestSummary['selectionSource']): string {
  return source === 'query' ? 'Query param' : 'Active request';
}

function formatLabel(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatEstimateSummary(estimate: DesignWorkbenchRouteEstimateSummary): string {
  const parts = [`${estimate.versionLabel} (${estimate.id})`, formatLabel(estimate.status)];
  if (estimate.isActiveDraft) parts.push('active draft');
  return parts.join(' · ');
}

function formatRequestSummary(request: DesignWorkbenchRouteRequestSummary): string {
  const parts = [`Request v${request.requestVersion} (${request.id})`, formatLabel(request.status), formatLabel(request.priorityTier)];
  if (request.estimateVersionLabel) parts.push(`linked ${request.estimateVersionLabel}`);
  return parts.join(' · ');
}

function estimateWarningMessage(warning: WorkbenchEstimateWarning): string {
  return `The supplied estimateId (${warning.providedEstimateId}) is not available for this project. Showing the default estimate instead.`;
}

function requestWarningMessage(warning: WorkbenchRequestWarning, selectedEstimateId: string): string {
  if (warning.reason === 'request_not_found') {
    return `The supplied requestId (${warning.providedRequestId}) is not available for this project. Showing the selected estimate without design-request metadata.`;
  }

  const requestEstimateText = warning.requestEstimateId ? `linked to estimate ${warning.requestEstimateId}` : 'not linked to the selected estimate';
  return `The supplied requestId (${warning.providedRequestId}) is ${requestEstimateText}. Showing estimate ${selectedEstimateId} and ignoring the request context.`;
}

function renderContextLines(context: Exclude<DesignWorkbenchRouteContext, { kind: 'project_unavailable' }>): string[] {
  const lines = [
    'This hidden internal route opens the Sanctuary Geometry Workbench against the selected estimate context.',
    `Route state: ${formatLabel(context.kind)}`,
  ];

  if ('estimate' in context && context.estimate) {
    lines.push(`Estimate selection: ${formatEstimateSelectionSource(context.estimate.selectionSource)}`);
    lines.push(`Estimate: ${formatEstimateSummary(context.estimate)}`);
  }

  if ('request' in context && context.request) {
    lines.push(`Design request selection: ${formatRequestSelectionSource(context.request.selectionSource)}`);
    lines.push(`Design request: ${formatRequestSummary(context.request)}`);
  } else if (context.kind !== 'no_estimate') {
    lines.push('Design request context: none linked to the selected estimate');
  }

  if (context.kind === 'no_estimate') {
    lines.push('No usable estimate exists for this project yet. Create or generate an estimate before opening the workbench.');
  }

  if (context.kind === 'ready' && context.estimateWarning) {
    lines.push(estimateWarningMessage(context.estimateWarning));
  }

  if (context.kind === 'ready' && context.requestWarning) {
    lines.push(requestWarningMessage(context.requestWarning, context.estimate.id));
  }

  if (context.kind === 'no_estimate' && context.providedEstimateId) {
    lines.push(`Supplied estimateId: ${context.providedEstimateId}`);
  }

  if (context.kind === 'no_estimate' && context.providedRequestId) {
    lines.push(`Supplied requestId: ${context.providedRequestId}`);
  }

  return lines;
}

function renderFixtureLines(fixture: SanctuaryGeometryWorkbenchFixture): string[] {
  return [
    'This hidden internal route is mounting a baked Sanctuary Geometry Workbench fixture for QA.',
    'Route state: Fixture Ready',
    `Fixture: ${fixture.label} (${fixture.slug})`,
    'Fixture source: baked calculator snapshot data',
    `Fixture estimate: ${fixture.estimate.versionLabel} (${fixture.estimate.id}) · ${formatLabel(fixture.estimate.status)}`,
    `Fixture design request: Request v${fixture.request.requestVersion} (${fixture.request.id}) · ${formatLabel(fixture.request.status)} · ${formatLabel(
      fixture.request.priorityTier,
    )}`,
  ];
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

  if (fixtureSlug && !isSanctuaryGeometryWorkbenchFixturesEnabled()) {
    notFound();
  }

  if (fixtureSlug) {
    const snapshot = await getProjectPageSnapshot(normalizedProjectId);
    if (!snapshot) {
      return renderUnavailable('We could not load this project. It may have been deleted, or access is temporarily unavailable.');
    }

    const fixture = getSanctuaryGeometryWorkbenchFixture(fixtureSlug);
    const sharedHeader = (
      <>
        <h1 className={styles.title}>Design Workbench</h1>
        <p className={styles.subtitle}>{snapshot.project.name}</p>
      </>
    );

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
              {sharedHeader}
              {renderInvalidFixtureLines(fixtureSlug).map((line) => (
                <p key={line} className={styles.subtitle}>
                  {line}
                </p>
              ))}
              <Link href={`/staff/projects/${encodeURIComponent(normalizedProjectId)}`} className={styles.backLink}>
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
            {sharedHeader}
            {renderFixtureLines(fixture).map((line) => (
              <p key={line} className={styles.subtitle}>
                {line}
              </p>
            ))}
            <Link href={`/staff/projects/${encodeURIComponent(normalizedProjectId)}`} className={styles.backLink}>
              Back to Project
            </Link>
          </div>
        </section>
        <section className={styles.surface}>
          <div className={styles.surfaceInner}>
            <DesignWorkbenchFixtureClient
              fixture={fixture}
              projectName={snapshot.project.name}
              siteAddress={snapshot.project.siteAddress ?? null}
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
            <h1 className={styles.title}>Design Workbench</h1>
            <p className={styles.subtitle}>{context.project.name}</p>
            {renderContextLines(context).map((line) => (
              <p key={line} className={styles.subtitle}>
                {line}
              </p>
            ))}
            <Link href={`/staff/projects/${encodeURIComponent(normalizedProjectId)}`} className={styles.backLink}>
              Back to Project
            </Link>
          </div>
        </section>
        <section className={styles.surface}>
          <div className={styles.surfaceInner}>
            <DesignWorkbenchEstimateClient
              estimate={estimateDetail}
              projectName={context.project.name}
              siteAddress={context.project.siteAddress}
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
          {renderContextLines(context).map((line) => (
            <p key={line} className={styles.subtitle}>
              {line}
            </p>
          ))}
          <Link href={`/staff/projects/${encodeURIComponent(normalizedProjectId)}`} className={styles.backLink}>
            Back to Project
          </Link>
        </div>
      </section>
    </main>
  );
}
