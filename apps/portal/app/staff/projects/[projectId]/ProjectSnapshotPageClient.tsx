'use client';

import ProjectsIndexLink from '@/components/navigation/ProjectsIndexLink';
import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import PortalDebugExportButton from '@/components/debug/PortalDebugExportButton';
import ProjectPageFrame from '@/components/projects/ProjectPage/ProjectPageFrame';
import styles from '@/components/projects/ProjectPage/ProjectPage.module.css';
import { buildPortalPageDebugExport, type PortalPageDebugExport } from '@/lib/debug/portalPageDebugExport';
import { inferPortalScenarioFromLabel } from '@/lib/debug/portalScenarioDebug';
import type { ProjectPageSnapshot, ProjectSnapshotLoadState } from '@/lib/projects/types';
import { ApiError } from '@/lib/repo/apiClient';
import { getProjectSnapshotPlaceholderFromCaches } from '@/lib/queries/projectCache';
import { projectPageSnapshotQueryOptions, projectPageSummaryQueryOptions } from '@/lib/queries/projects';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';

export default function ProjectSnapshotPageClient({
  projectId,
  tab,
  estimateId,
  debugExportEnabled,
}: {
  projectId: string;
  tab: string;
  estimateId: string | null;
  debugExportEnabled: boolean;
}) {
  const queryClient = useQueryClient();
  const [commandCentreAccess, setCommandCentreAccess] = useState<{
    projectId: string;
    status: number;
  } | null>(null);
  const commandCentreAccessStatus = commandCentreAccess?.projectId === projectId
    ? commandCentreAccess.status
    : null;
  const host = useMemo(() => supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown', []);
  const cachedSummary = useMemo(
    () => getProjectSnapshotPlaceholderFromCaches(queryClient, host, projectId),
    [host, projectId, queryClient],
  );

  const summaryQuery = useQuery({
    ...projectPageSummaryQueryOptions(host, projectId),
    enabled: !cachedSummary,
  });

  const snapshotQuery = useQuery({
    ...projectPageSnapshotQueryOptions(host, projectId),
    placeholderData: cachedSummary ?? summaryQuery.data,
  });

  const snapshotStatus = snapshotQuery.error instanceof ApiError ? snapshotQuery.error.status : null;
  const summaryStatus = summaryQuery.error instanceof ApiError ? summaryQuery.error.status : null;
  const snapshotContentReady = Boolean(snapshotQuery.data && !snapshotQuery.isPlaceholderData);
  const accessUnavailable = commandCentreAccessStatus !== null
    || (!snapshotContentReady && [snapshotStatus, summaryStatus]
      .some((status) => status === 401 || status === 403 || status === 404));
  const handleProjectAccessEnding = useCallback((status: number) => {
    if (![401, 403, 404].includes(status)) return;
    queryClient.removeQueries({ queryKey: ['projects', host] });
    queryClient.removeQueries({ queryKey: ['estimates', host] });
    queryClient.removeQueries({ queryKey: ['quotes', host] });
    queryClient.removeQueries({ queryKey: ['invoices', host] });
    queryClient.removeQueries({ queryKey: ['jobPacks', host] });
    setCommandCentreAccess({ projectId, status });
  }, [host, projectId, queryClient]);
  const knownSummary = cachedSummary
    ?? summaryQuery.data
    ?? (snapshotQuery.isPlaceholderData ? snapshotQuery.data : undefined);
  const snapshot = accessUnavailable
    ? null
    : snapshotContentReady
      ? snapshotQuery.data?.snapshot ?? null
      : knownSummary?.snapshot ?? null;
  const loadState: ProjectSnapshotLoadState = accessUnavailable
    ? 'unavailable'
    : snapshotQuery.error
      ? 'refresh-failed'
      : snapshotContentReady
        ? 'fresh'
        : snapshot
          ? 'summary'
          : 'pending';
  const retry = () => {
    void snapshotQuery.refetch();
    if (!cachedSummary) void summaryQuery.refetch();
  };
  const debugExport = useMemo<PortalPageDebugExport | null>(() => {
    if (!debugExportEnabled || loadState !== 'fresh' || !snapshot) return null;

    const isEstimateRoute = Boolean(estimateId);
    const pageId = isEstimateRoute ? 'estimate-detail' : 'project-detail';
    const route = isEstimateRoute
      ? `/staff/projects/${encodeURIComponent(projectId)}/estimate/${encodeURIComponent(estimateId ?? '')}`
      : `/staff/projects/${encodeURIComponent(projectId)}`;

    return buildPortalPageDebugExport({
      pageId,
      route,
      selectedIds: {
        projectId,
        contactId: snapshot.project.contactId ?? null,
        estimateId: estimateId ?? null,
      },
      serverState: {
        project: {
          id: snapshot.project.id,
          name: snapshot.project.name,
          stage: snapshot.project.stage,
          contactId: snapshot.project.contactId ?? null,
          quoteRef: snapshot.project.quoteRef ?? null,
        },
        pipelineStage: snapshot.pipeline.stage,
        taskCount: snapshot.tasks.items.length,
        activityCount: snapshot.activity.length,
        emailCount: snapshot.emails.length,
        noteCount: snapshot.notes.length,
      },
      clientState: {
        activeTab: tab,
        queryHost: host,
      },
      diagnostics: {
        debugExportStatus: 'ready',
        source: 'project-snapshot-page',
      },
      scenario: inferPortalScenarioFromLabel(snapshot.project.name),
    });
  }, [debugExportEnabled, estimateId, host, loadState, projectId, snapshot, tab]);

  if (!snapshot) {
    const pending = loadState === 'pending';
    const unavailable = loadState === 'unavailable';
    const title = pending
      ? 'Opening project…'
      : unavailable && (
          commandCentreAccessStatus === 401
          || commandCentreAccessStatus === 403
          || snapshotStatus === 401
          || snapshotStatus === 403
          || summaryStatus === 401
          || summaryStatus === 403
        )
        ? 'Project access unavailable'
        : unavailable
          ? 'Project unavailable'
          : 'Could not refresh project';
    const message = pending
      ? 'Loading the latest project details in the background.'
      : unavailable
        ? 'The project may have been removed, or your access may have changed.'
        : 'Check your connection and try again.';

    return (
      <main className={styles.page} data-project-id={projectId} data-project-snapshot-state={loadState}>
        <section className={styles.surface}>
          <div className={styles.surfaceInner}>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.subtitle} role={pending ? 'status' : undefined}>{message}</p>
            {!pending && !unavailable ? (
              <button type="button" className={styles.refreshButton} onClick={retry}>
                Retry
              </button>
            ) : null}
            <ProjectsIndexLink href="/staff/projects" className={styles.backLink}>
              Back to Projects
            </ProjectsIndexLink>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main
      className={styles.page}
      data-project-background-ready={loadState === 'fresh' ? 'true' : undefined}
      data-project-id={projectId}
      data-project-shell-ready="true"
      data-project-snapshot-state={loadState}
    >
      {debugExport ? <PortalDebugExportButton payload={debugExport} /> : null}
      {loadState === 'summary' ? (
        <div className={styles.backgroundStatus} role="status">Updating project…</div>
      ) : null}
      {loadState === 'refresh-failed' ? (
        <div className={styles.backgroundStatus} role="status">
          Couldn&apos;t refresh this project. Showing the last known details.
          <button type="button" className={styles.inlineRetryButton} onClick={retry}>
            Retry
          </button>
        </div>
      ) : null}
      <ProjectPageFrame
        snapshot={snapshot}
        snapshotContentReady={snapshotContentReady}
        snapshotState={loadState}
        tab={tab}
        onProjectAccessEnding={handleProjectAccessEnding}
      />
    </main>
  );
}
