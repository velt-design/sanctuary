'use client';

import { lazy, Suspense, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ProjectPageSnapshot, ProjectSnapshotLoadState } from '@/lib/projects/types';
import { projectCommandCentreQueryOptions } from '@/lib/queries/projects';
import { ApiError } from '@/lib/repo/apiClient';
import ProjectTasksSidebarClient from '../ProjectTasksSidebar.client';
import ProjectNotesPanel from './_components/ProjectNotesPanel.client';
import styles from './overview/OverviewTab.module.css';

const ProjectCurrentDesignCommercialCard = lazy(() => import('./overview/ProjectCurrentDesignCommercialCard'));
const ProjectPrimaryActionCard = lazy(() => import('./overview/ProjectPrimaryActionCard'));
const ProjectStatusDetailsCard = lazy(() => import('./overview/ProjectStatusDetailsCard'));

export default function OverviewTab({
  snapshot,
  snapshotContentReady,
  snapshotState,
  host,
  onAccessEnding,
}: {
  snapshot: ProjectPageSnapshot;
  snapshotContentReady: boolean;
  snapshotState: ProjectSnapshotLoadState;
  host: string;
  onAccessEnding?: (status: number) => void;
}) {
  const commandQuery = useQuery(projectCommandCentreQueryOptions(host, snapshot.project.id));
  const accessEndingStatus = commandQuery.error instanceof ApiError
    && [401, 403, 404].includes(commandQuery.error.status)
    ? commandQuery.error.status
    : null;

  useEffect(() => {
    if (accessEndingStatus !== null) onAccessEnding?.(accessEndingStatus);
  }, [accessEndingStatus, onAccessEnding]);

  return (
    <div className={styles.container} data-project-overview="true">
      {commandQuery.data && commandQuery.isError ? (
        <div className={styles.refreshNotice} data-command-centre-state="stale" role="status">
          Couldn&apos;t refresh this overview. Showing the last known commercial state.
          <button type="button" onClick={() => void commandQuery.refetch()}>Retry</button>
        </div>
      ) : commandQuery.data && commandQuery.isFetching ? (
        <div className={styles.refreshNotice} data-command-centre-state="refreshing" role="status">
          Updating commercial state…
        </div>
      ) : null}

      <div className={styles.operationalGrid}>
        <Suspense fallback={<section className={styles.queryState} role="status">Loading project details...</section>}>
          <ProjectStatusDetailsCard project={snapshot.project} host={host} />
        </Suspense>
        {accessEndingStatus !== null ? (
          <section className={styles.commandState} data-command-centre-state="unavailable" role="status">
            Project access is no longer available.
          </section>
        ) : commandQuery.data ? (
          <>
            <Suspense fallback={<section className={styles.queryState} role="status">Loading commercial summary…</section>}>
              <ProjectCurrentDesignCommercialCard data={commandQuery.data.currentDesign} />
            </Suspense>
            <Suspense fallback={<section className={styles.queryState} role="status">Loading primary action…</section>}>
              <ProjectPrimaryActionCard
                projectId={snapshot.project.id}
                host={host}
                operations={commandQuery.data.operations}
                stale={commandQuery.isError}
                onRefresh={() => void commandQuery.refetch()}
              />
            </Suspense>
          </>
        ) : commandQuery.isPending ? (
          <section className={styles.commandState} data-command-centre-state="pending" role="status">
            Updating current design and commercial state…
          </section>
        ) : (
          <section className={styles.commandState} data-command-centre-state="failed" role="alert">
            <strong>Couldn&apos;t load current design and commercial state.</strong>
            <span>Check your connection and try again.</span>
            <button type="button" onClick={() => void commandQuery.refetch()}>Retry</button>
          </section>
        )}
      </div>

      <div className={styles.workstreamsSlot} data-stage3-workstreams-slot aria-hidden="true" />

      {snapshotContentReady ? (
        <div className={styles.layout} data-project-overview-context="fresh">
          <div className={`${styles.column} ${styles.activityColumn}`} data-overview-column="activity">
            <h2 className={styles.columnHeader}>Activity</h2>
            <ProjectNotesPanel projectId={snapshot.project.id} initialNotes={snapshot.notes} />
          </div>
          <div className={`${styles.column} ${styles.tasksColumn}`} data-overview-column="tasks">
            <h2 className={styles.columnHeader}>Tasks</h2>
            <ProjectTasksSidebarClient projectId={snapshot.project.id} tasks={snapshot.tasks} />
          </div>
        </div>
      ) : (
        <section
          className={styles.queryState}
          data-project-overview-context={snapshotState}
          role="status"
        >
          {snapshotState === 'refresh-failed'
            ? 'Couldn’t refresh activity and tasks. The project summary remains available.'
            : 'Updating activity and tasks in the background…'}
        </section>
      )}
    </div>
  );
}
