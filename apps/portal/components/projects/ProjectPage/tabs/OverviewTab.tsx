'use client';

import { lazy, Suspense, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProjectPageSnapshot, ProjectSnapshotLoadState } from '@/lib/projects/types';
import { projectCommandCentreQueryOptions } from '@/lib/queries/projects';
import { invalidateProjectWorkReads } from '@/lib/queries/projectWorkCache';
import { ApiError } from '@/lib/repo/apiClient';
import ProjectTasksSidebarClient from '../ProjectTasksSidebar.client';
import ProjectWorkItemsSidebar from '../ProjectWorkItemsSidebar.client';
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
const ProjectWorkCommandCard = lazy(() => import('./overview/ProjectWorkCommandCard'));

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
  const queryClient = useQueryClient();
  const commandQuery = useQuery(projectCommandCentreQueryOptions(host, snapshot.project.id));
  const accessEndingStatus = commandQuery.error instanceof ApiError
    && [401, 403, 404].includes(commandQuery.error.status)
    ? commandQuery.error.status
    : null;
  const workModelMismatch = accessEndingStatus === null
    && Boolean(
      commandQuery.data
      && commandQuery.data.workModel !== snapshot.workModel,
    );
  const commandCentreState = accessEndingStatus !== null
    ? 'unavailable'
    : workModelMismatch
      ? 'model-mismatch'
      : commandQuery.data && commandQuery.isError
        ? 'stale'
        : commandQuery.data && commandQuery.isFetching
          ? 'refreshing'
          : commandQuery.data
            ? 'ready'
            : commandQuery.isPending
              ? 'pending'
              : 'failed';
  const refreshProjectWorkModel = () => {
    void invalidateProjectWorkReads(
      queryClient,
      host,
      snapshot.project.id,
    );
  };

  useEffect(() => {
    if (accessEndingStatus !== null) onAccessEnding?.(accessEndingStatus);
  }, [accessEndingStatus, onAccessEnding]);

  return (
    <div className={styles.container} data-project-overview="true">
      {workModelMismatch ? (
        <AlertBanner
          tone="warning"
          title="Project work is updating"
          action={<Button variant="secondary" onClick={refreshProjectWorkModel}>Retry</Button>}
        >
          Project work is paused until the latest server reads agree.
        </AlertBanner>
      ) : commandQuery.data && commandQuery.isError ? (
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

      <OperationalGrid columns={3} data-command-centre-state={commandCentreState}>
        <Suspense fallback={<Card padding="compact"><LoadingSkeleton rows={4} columns={2} label="Loading project details" /></Card>}>
          <ProjectStatusDetailsCard project={snapshot.project} host={host} />
        </Suspense>
        {accessEndingStatus !== null ? (
          <DataStatePanel state="unavailable" title="Project access unavailable" description="Your access changed while this overview was open." />
        ) : commandQuery.data ? (
          <>
            <Suspense fallback={<Card padding="compact"><LoadingSkeleton rows={4} columns={2} label="Loading commercial summary" /></Card>}>
              <ProjectCurrentDesignCommercialCard data={commandQuery.data.currentDesign} />
            </Suspense>
            {workModelMismatch ? (
              <DataStatePanel
                state="error"
                title="Project work is updating"
                description="No project-work action is available until the latest server reads agree."
                onRetry={refreshProjectWorkModel}
              />
            ) : (
              <Suspense fallback={<Card padding="compact"><LoadingSkeleton rows={4} columns={2} label="Loading project command" /></Card>}>
                {commandQuery.data.workModel === 'v2' ? (
                  <ProjectWorkCommandCard
                    projectId={snapshot.project.id}
                    host={host}
                    projectWork={commandQuery.data.projectWork}
                    owner={commandQuery.data.owner}
                    pipelineStage={snapshot.project.stage}
                    stale={commandCentreState !== 'ready'}
                    onRefresh={() => void commandQuery.refetch()}
                  />
                ) : (
                  <ProjectPrimaryActionCard
                    projectId={snapshot.project.id}
                    host={host}
                    operations={commandQuery.data.operations}
                    stale={commandCentreState !== 'ready'}
                    onRefresh={() => void commandQuery.refetch()}
                  />
                )}
              </Suspense>
            )}
          </>
        ) : commandQuery.isPending ? (
          <Card padding="compact"><LoadingSkeleton rows={5} columns={3} label="Loading design, commercial state and project command" /></Card>
        ) : (
          <DataStatePanel
            state="error"
            title="Could not load the project overview"
            description="The design, commercial summary and next action are unavailable."
            onRetry={() => void commandQuery.refetch()}
          />
        )}
      </OperationalGrid>

      <div className={styles.workstreamsSlot} data-stage3-workstreams-slot aria-hidden="true" />

      {snapshotContentReady ? (
        <OperationalGrid className={styles.layout} data-project-overview-context="fresh">
          <Card title="Activity" eyebrow="Project history" padding="none" data-overview-column="activity">
            <ProjectNotesPanel projectId={snapshot.project.id} initialNotes={snapshot.notes} />
          </Card>
          <Card title="Tasks" eyebrow="Current stage" padding="none" data-overview-column="tasks">
            {workModelMismatch ? (
              <DataStatePanel
                state="error"
                title="Tasks are updating"
                description="Task controls are paused until the latest server reads agree."
                onRetry={refreshProjectWorkModel}
              />
            ) : snapshot.workModel === 'v2' && snapshot.projectWork ? (
              <ProjectWorkItemsSidebar
                projectId={snapshot.project.id}
                projectWork={commandQuery.data?.workModel === 'v2'
                  ? commandQuery.data.projectWork
                  : snapshot.projectWork}
                host={host}
                stale={snapshotState !== 'fresh' || commandCentreState !== 'ready'}
              />
            ) : (
              <ProjectTasksSidebarClient projectId={snapshot.project.id} tasks={snapshot.tasks} />
            )}
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
