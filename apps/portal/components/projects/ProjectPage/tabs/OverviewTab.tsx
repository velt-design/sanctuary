"use client";

import ProjectRecentNotesEvents from "./overview/ProjectRecentNotesEvents";
import ProjectWorkFilesCard from "./overview/ProjectWorkFilesCard";
import workStyles from "./overview/ProjectWorkSection.module.css";
import ProjectCommercialDetails from './overview/ProjectCommercialDetails';
import ProjectNextVisit from '@/components/site-visits/ProjectNextVisit';

import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type {
  ProjectPageSnapshot,
  ProjectSnapshotLoadState,
} from "@/lib/projects/types";
import { useActiveProjectOverviewReads } from "../ProjectOverviewReads";
import { invalidateProjectWorkReads } from "@/lib/queries/projectWorkCache";
import { ApiError } from "@/lib/repo/apiClient";
import {
  AlertBanner,
  Button,
  Card,
  DataStatePanel,
  LoadingSkeleton,
} from "@/components/ui/foundation";
import ProjectOverviewLayout from "./overview/ProjectOverviewLayout";
import { projectPositionLabel } from './overview/projectPositionLabel';
import { currentProjectWork } from '@/lib/projects/projectCurrentStatus';
import type { ProjectOrientationFreshness } from "./overview/ProjectOrientationBand";
import { CommercialProjectNotice } from '../ProjectCommercialContext';

const overviewModules = {
  commercial: () => import("./overview/ProjectCurrentDesignCommercialCard"),
  orientation: () => import("./overview/ProjectOrientationBand"),
  work: () => import("./overview/ProjectWorkSection"),
  payment: () => import("./overview/ProjectPaymentPositionQuery"),
  correspondence: () => import("./overview/ProjectCorrespondenceQuery"),
};
const ProjectCurrentDesignCommercialCard = lazy(overviewModules.commercial);
const ProjectOrientationBand = lazy(overviewModules.orientation);
const ProjectWorkSection = lazy(overviewModules.work);
const ProjectPaymentPositionQuery = lazy(overviewModules.payment);
const ProjectCorrespondenceQuery = lazy(overviewModules.correspondence);

export async function preloadOverviewModules(): Promise<void> {
  await Promise.all(Object.values(overviewModules).map((load) => load()));
}

type CommandCentreState =
  | "unavailable"
  | "model-mismatch"
  | "stale"
  | "refreshing"
  | "ready"
  | "pending"
  | "failed";

const SERVER_TIME = new Intl.DateTimeFormat("en-NZ", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Pacific/Auckland",
});

function serverViewDetail(generatedAt: string | undefined): string | null {
  if (!generatedAt) return null;
  const parsed = new Date(generatedAt);
  return Number.isFinite(parsed.valueOf())
    ? `Server view ${SERVER_TIME.format(parsed)}`
    : null;
}

function orientationFreshness(
  state: CommandCentreState,
  generatedAt: string | undefined,
): ProjectOrientationFreshness {
  const detail = serverViewDetail(generatedAt);
  if (state === "ready") return { label: "Current", detail, tone: "neutral" };
  if (state === "refreshing") {
    return {
      label: "Refreshing",
      detail: detail
        ? `${detail} · controls paused`
        : "Showing the saved server view · controls paused",
      tone: "info",
    };
  }
  if (state === "stale") {
    return {
      label: "Saved view",
      detail: detail
        ? `${detail} · latest refresh failed`
        : "Latest refresh failed",
      tone: "warning",
    };
  }
  if (state === "model-mismatch") {
    return {
      label: "Review required",
      detail: "Server reads disagree · controls paused",
      tone: "warning",
    };
  }
  if (state === "pending") {
    return {
      label: "Loading",
      detail: "Waiting for the server view",
      tone: "info",
    };
  }
  return {
    label: "Unavailable",
    detail: "The current server view is unavailable",
    tone: "error",
  };
}

export default function OverviewTab({
  snapshot,
  projectId = snapshot?.project.id ?? "",
  snapshotContentReady,
  snapshotState,
  host,
  readOnly = false,
  onAccessEnding,
}: {
  snapshot: ProjectPageSnapshot | null;
  projectId?: string;
  snapshotContentReady: boolean;
  snapshotState: ProjectSnapshotLoadState;
  host: string;
  readOnly?: boolean;
  onAccessEnding?: (status: number) => void;
}) {
  const queryClient = useQueryClient();
  const { commandQuery } = useActiveProjectOverviewReads(host, projectId);
  const accessEndingStatus =
    commandQuery.error instanceof ApiError &&
    [401, 403, 404].includes(commandQuery.error.status)
      ? commandQuery.error.status
      : null;
  const workModelMismatch =
    accessEndingStatus === null &&
    Boolean(
      snapshot && commandQuery.data && commandQuery.data.workModel !== snapshot.workModel,
    );
  const commandCentreState: CommandCentreState =
    accessEndingStatus !== null
      ? "unavailable"
      : workModelMismatch
        ? "model-mismatch"
        : commandQuery.data && commandQuery.isError
          ? "stale"
          : commandQuery.data && commandQuery.isFetching
            ? "refreshing"
            : commandQuery.data
              ? "ready"
              : commandQuery.isPending
                ? "pending"
                : "failed";
  const projectWorkControlsStale =
    readOnly || commandCentreState !== "ready" || snapshotState !== "fresh";
  const orientationProjection = snapshot ? currentProjectWork(snapshot, commandQuery.data) : undefined;
  const refreshProjectWorkModel = () => {
    void invalidateProjectWorkReads(queryClient, host, projectId);
  };

  useEffect(() => {
    if (accessEndingStatus !== null) onAccessEnding?.(accessEndingStatus);
  }, [accessEndingStatus, onAccessEnding]);

  const exception =
    commandQuery.data && commandQuery.isError ? (
      <AlertBanner
        tone="warning"
        title="Saved Overview"
        action={
          <Button
            variant="secondary"
            onClick={() => void commandQuery.refetch()}
          >
            Retry
          </Button>
        }
      >
        Latest refresh failed. Facts remain visible; work controls are paused.
      </AlertBanner>
    ) : null;

  let projectWork: ReactNode;
  if (accessEndingStatus !== null) {
    projectWork = <DataStatePanel state="unavailable" title="Project access unavailable"
      description="Your access changed while this Overview was open." />;
  } else if (workModelMismatch) {
    projectWork = <DataStatePanel state="error" title="Project work is updating"
      description="No project-work action is available until the latest server reads agree."
      onRetry={refreshProjectWorkModel} />;
  } else if (commandQuery.data && snapshot) {
    projectWork = commandQuery.data.workModel === "v2" ? (
      <Suspense fallback={<p role="status">Reading project work controls…</p>}>
        <ProjectWorkSection embedded workModel="v2" projectId={projectId} host={host}
          projectWork={orientationProjection ?? commandQuery.data.projectWork}
          ownerLabel={commandQuery.data.owner.owner?.displayName}
          pipelineStage={snapshot.project.stage} stale={projectWorkControlsStale}
          onRefresh={() => void commandQuery.refetch()} />
      </Suspense>
    ) : <DataStatePanel state="unavailable" title="Project Work is not ready"
      description="No project-work action is available until the portfolio rollout is complete." />;
  } else if (commandQuery.isPending || (!snapshot && !commandQuery.isError)) {
    projectWork = <p role="status">{!snapshot && snapshotState === "refresh-failed" ? "Project work needs verified project details. Retry the project read above." : "Reading project work…"}</p>;
  } else {
    projectWork = <DataStatePanel state="error" title="Could not load the Project Overview"
      description="No next action is available until the server view loads."
      onRetry={() => void commandQuery.refetch()} />;
  }
  const commercial = accessEndingStatus === null ? (
    <>
      <ProjectCommercialDetails data={commandQuery.data?.currentDesign ?? null} pending={commandQuery.isPending}>
        {commandQuery.data ? (
          <Suspense fallback={<p role="status">Reading commercial details…</p>}>
            <ProjectCurrentDesignCommercialCard previewOnly={readOnly} data={commandQuery.data.currentDesign} projectId={projectId} />
          </Suspense>
        ) : commandQuery.isPending ? <p role="status">Reading current design and commercial state…</p> : (
          <DataStatePanel state="error" title="Commercial state unavailable"
            description="The current design and price could not be loaded. Use the Project Overview retry." />
        )}
      </ProjectCommercialDetails>
      <Suspense fallback={<p role="status">Reading payment interface…</p>}>
        <ProjectPaymentPositionQuery readOnly={readOnly} projectId={projectId} host={host} onAccessEnding={onAccessEnding} />
      </Suspense>
    </>
  ) : null;

  const history = <ProjectRecentNotesEvents projectId={projectId} readOnly={readOnly} pending={snapshotState !== "refresh-failed"}
    notes={snapshotContentReady && snapshot ? snapshot.notes : null}
    events={snapshotContentReady && snapshot ? snapshot.activity : null}
    statusPanel={!snapshotContentReady ? <AlertBanner tone={snapshotState === 'refresh-failed' ? 'warning' : 'info'}
      title={snapshotState === 'refresh-failed' ? 'Saved history is not complete' : 'Updating recent history'}>
      {snapshotState === 'refresh-failed' ? 'The latest refresh failed. No partial history is presented as complete.' : 'Recent notes and server events appear after the complete snapshot loads.'}
    </AlertBanner> : null} />;

  return (
    <div data-project-overview="true">
      <ProjectOverviewLayout
        state={commandCentreState}
        orientation={snapshot ?
          <Suspense
            fallback={
              <Card padding="compact">
                <LoadingSkeleton
                  rows={2}
                  columns={4}
                  label="Loading project orientation"
                />
              </Card>
            }
          >
            <div inert={readOnly}><ProjectOrientationBand
              project={snapshot.project}
              host={host}
              operationalState={orientationProjection?.effectiveState}
              freshness={orientationFreshness(
                commandCentreState,
                commandQuery.data?.generatedAt,
              )}
            /></div>
          </Suspense> : null
        }
        exception={exception}
        projectWork={<><ProjectWorkFilesCard projectId={projectId} host={host} className={workStyles.card}
          positionLabel={snapshot && commandQuery.data && commandQuery.data.workModel === "v2" ? projectPositionLabel(snapshot.project.stage, (orientationProjection ?? commandQuery.data.projectWork).effectiveState, commandQuery.data.currentDesign, (orientationProjection ?? commandQuery.data.projectWork).closedOutcome) : undefined}>
          {commandQuery.data && snapshot && commandQuery.data.workModel === 'v2' && !workModelMismatch ? projectWork : (
            <section data-project-work-section="true" data-project-work-model={workModelMismatch ? 'mismatch' : commandQuery.isPending || !snapshot ? 'pending' : 'failed'}>{projectWork}</section>
          )}</ProjectWorkFilesCard>{accessEndingStatus === null && <CommercialProjectNotice projectId={projectId} view="activity" />}</>}
        commercial={<>{commercial}{accessEndingStatus === null && <ProjectNextVisit projectId={projectId} host={host} onAccessEnding={onAccessEnding} />}</>}
        recent={
          <>
            {accessEndingStatus === null && (
              <Suspense fallback={<Card padding="compact"><LoadingSkeleton rows={4} label="Loading customer emails" /></Card>}>
                <ProjectCorrespondenceQuery projectId={projectId} onAccessEnding={onAccessEnding}
                  project={{ customerEmail: snapshot?.project.contactEmail, quoteRef: commandQuery.data?.currentDesign.quote?.quoteRef }} />
              </Suspense>
            )}
            {history}
          </>
        }
      />
    </div>
  );
}
