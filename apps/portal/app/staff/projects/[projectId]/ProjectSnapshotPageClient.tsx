'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import PortalDebugExportButton from '@/components/debug/PortalDebugExportButton';
import ProjectPageFrame from '@/components/projects/ProjectPage/ProjectPageFrame';
import styles from '@/components/projects/ProjectPage/ProjectPage.module.css';
import { buildPortalPageDebugExport, type PortalPageDebugExport } from '@/lib/debug/portalPageDebugExport';
import { inferPortalScenarioFromLabel } from '@/lib/debug/portalScenarioDebug';
import type { ProjectPageSnapshot, ProjectPageSnapshotResponse } from '@/lib/projects/types';
import { projectPageSnapshotQueryOptions } from '@/lib/queries/projects';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';

export default function ProjectSnapshotPageClient({
  projectId,
  tab,
  estimateId,
  initialSnapshot,
  debugExportEnabled,
}: {
  projectId: string;
  tab: string;
  estimateId: string | null;
  initialSnapshot: ProjectPageSnapshot;
  debugExportEnabled: boolean;
}) {
  const host = useMemo(() => supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown', []);
  const initialData = useMemo<ProjectPageSnapshotResponse>(
    () => ({ snapshot: initialSnapshot, generatedAt: new Date().toISOString() }),
    [initialSnapshot],
  );

  const { data } = useQuery({
    ...projectPageSnapshotQueryOptions(host, projectId),
    initialData,
  });

  const snapshot = data?.snapshot ?? initialSnapshot;
  const debugExport = useMemo<PortalPageDebugExport | null>(() => {
    if (!debugExportEnabled) return null;

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
  }, [debugExportEnabled, estimateId, host, projectId, snapshot, tab]);

  return (
    <main className={styles.page} data-project-id={projectId}>
      {debugExport ? <PortalDebugExportButton payload={debugExport} /> : null}
      <ProjectPageFrame snapshot={snapshot} tab={tab} />
    </main>
  );
}
