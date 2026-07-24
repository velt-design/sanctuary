'use client';

import { lazy, Suspense, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ProjectPageSnapshot, ProjectSnapshotLoadState } from '@/lib/projects/types';
import { projectCommandCentreQueryOptions } from '@/lib/queries/projects';
import { ApiError } from '@/lib/repo/apiClient';
import ProjectTasksSidebarClient from '../ProjectTasksSidebar.client';
import ProjectNotesPanel from './_components/ProjectNotesPanel.client';
import {
  AlertBanner,
  Button,
  Card,
  DataStatePanel,
  LoadingSkeleton,
  OperationalGrid,
} from '@/components/ui/foundation';
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
  const commandCentreState = accessEndingStatus !== null
    ? 'unavailable'
    : commandQuery.data && commandQuery.isError
      ? 'stale'
      : commandQuery.data && commandQuery.isFetching
        ? 'refreshing'
        : commandQuery.data
          ? 'ready'
          : commandQuery.isPending
            ? 'pending'
            : 'failed';

  useEffect(() => {
    if (accessEndingStatus !== null) onAccessEnding?.(accessEndingStatus);
  }, [accessEndingStatus, onAccessEnding]);

  return (
    <div className={styles.container} data-project-overview="true">
      {commandQuery.data && commandQuery.isError ? (
        <AlertBanner
          tone="warning"
          title="Showing saved commercial state"
          action={<Button variant="secondary" onClick={() => void commandQuery.refetch()}>Retry</Button>}
        >
          The latest overview refresh failed. The last known commercial state remains available.
        </AlertBanner>
      ) : commandQuery.data && commandQuery.isFetching ? (
        <AlertBanner tone="info" title="Updating commercial state">The saved overview remains available while the latest data loads.</AlertBanner>
      ) : null}

      <section
        className={styles.commandSection}
        data-command-centre-state={commandCentreState}
        aria-label="Project operational overview"
      >
        <div className={styles.commandGrid}>
          <div className={styles.statusSlot} data-overview-slot="status">
            <Suspense fallback={<Card padding="compact"><LoadingSkeleton rows={4} columns={2} label="Loading project details" /></Card>}>
              <ProjectStatusDetailsCard project={snapshot.project} host={host} />
            </Suspense>
          </div>
          {accessEndingStatus !== null ? (
            <div className={styles.commandStateSlot}>
              <DataStatePanel state="unavailable" title="Project access unavailable" description="Your access changed while this overview was open." />
            </div>
          ) : commandQuery.data ? (
            <>
              <div className={styles.commercialSlot} data-overview-slot="commercial">
                <Suspense fallback={<Card padding="compact"><LoadingSkeleton rows={4} columns={2} label="Loading commercial summary" /></Card>}>
                  <ProjectCurrentDesignCommercialCard data={commandQuery.data.currentDesign} />
                </Suspense>
              </div>
              <div className={styles.actionSlot} data-overview-slot="action">
                <Suspense fallback={<Card padding="compact"><LoadingSkeleton rows={4} columns={2} label="Loading project command" /></Card>}>
                  <ProjectPrimaryActionCard
                    projectId={snapshot.project.id}
                    host={host}
                    operations={commandQuery.data.operations}
                    stale={commandQuery.isError}
                    onRefresh={() => void commandQuery.refetch()}
                  />
                </Suspense>
              </div>
            </>
          ) : commandQuery.isPending ? (
            <div className={styles.commandStateSlot}>
              <Card padding="compact"><LoadingSkeleton rows={5} columns={3} label="Loading design, commercial state and project command" /></Card>
            </div>
          ) : (
            <div className={styles.commandStateSlot}>
              <DataStatePanel
                state="error"
                title="Could not load the project overview"
                description="The design, commercial summary and next action are unavailable."
                onRetry={() => void commandQuery.refetch()}
              />
            </div>
          )}
        </div>
      </section>

      <div className={styles.workstreamsSlot} data-stage3-workstreams-slot aria-hidden="true" />

      {snapshotContentReady ? (
        <OperationalGrid className={styles.layout} data-project-overview-context="fresh">
          <Card title="Activity" eyebrow="Project history" padding="none" data-overview-column="activity">
            <ProjectNotesPanel projectId={snapshot.project.id} initialNotes={snapshot.notes} />
          </Card>
          <Card title="Tasks" eyebrow="Current stage" padding="none" data-overview-column="tasks">
            <ProjectTasksSidebarClient projectId={snapshot.project.id} tasks={snapshot.tasks} />
          </Card>
        </OperationalGrid>
      ) : (
        <AlertBanner
          tone={snapshotState === 'refresh-failed' ? 'warning' : 'info'}
          title={snapshotState === 'refresh-failed' ? 'Activity and tasks are saved' : 'Updating activity and tasks in the background'}
        >
          {snapshotState === 'refresh-failed'
            ? 'The latest refresh failed. The project summary remains available.'
            : 'The project summary is ready while the remaining workstreams load.'}
        </AlertBanner>
      )}
    </div>
  );
}
