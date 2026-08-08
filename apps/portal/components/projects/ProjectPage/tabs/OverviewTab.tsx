"use client";

import { lazy, Suspense, useEffect, useMemo, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ProjectPageSnapshot,
  ProjectSnapshotLoadState,
} from "@/lib/projects/types";
import { projectCommandCentreQueryOptions } from "@/lib/queries/projects";
import { invalidateProjectWorkReads } from "@/lib/queries/projectWorkCache";
import { ApiError } from "@/lib/repo/apiClient";
import {
  AlertBanner,
  Button,
  Card,
  DataStatePanel,
} from "@/components/ui/foundation";
import ProjectOverviewLayout from "./overview/ProjectOverviewLayout";
import {
  ProjectCommercialPendingCard,
  ProjectOrientationPendingCard,
  ProjectRecentPendingCard,
  ProjectWorkPendingCard,
} from "./overview/ProjectOverviewPendingFrame";
import type { ProjectOrientationFreshness } from "./overview/ProjectOrientationBand";

const ProjectCurrentDesignCommercialCard = lazy(
  () => import("./overview/ProjectCurrentDesignCommercialCard"),
);
const ProjectOrientationBand = lazy(
  () => import("./overview/ProjectOrientationBand"),
);
const ProjectRecentNotesEvents = lazy(
  () => import("./overview/ProjectRecentNotesEvents"),
);
const ProjectWorkSection = lazy(() => import("./overview/ProjectWorkSection"));

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

function ProjectWorkState({
  children,
  model = "unavailable",
}: {
  children: ReactNode;
  model?: string;
}) {
  return (
    <section
      aria-label="Project Work"
      data-project-work-section="true"
      data-project-work-model={model}
    >
      {children}
    </section>
  );
}

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
  const commandQueryOptions = useMemo(
    () => projectCommandCentreQueryOptions(host, snapshot.project.id),
    [host, snapshot.project.id],
  );
  const commandQuery = useQuery({
    ...commandQueryOptions,
    enabled: snapshotState === "fresh" && !snapshot.commandCentre,
    placeholderData: snapshot.commandCentre,
  });
  const accessEndingStatus =
    commandQuery.error instanceof ApiError &&
    [401, 403, 404].includes(commandQuery.error.status)
      ? commandQuery.error.status
      : null;
  const workModelMismatch =
    accessEndingStatus === null &&
    Boolean(
      commandQuery.data && commandQuery.data.workModel !== snapshot.workModel,
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
    commandCentreState !== "ready" || snapshotState !== "fresh";
  const orientationProjection =
    !workModelMismatch && commandQuery.data?.workModel === "v2"
      ? commandQuery.data.projectWork
      : snapshot.workModel === "v2"
        ? snapshot.projectWork
        : undefined;
  const refreshProjectWorkModel = () => {
    void invalidateProjectWorkReads(queryClient, host, snapshot.project.id);
  };

  useEffect(() => {
    if (accessEndingStatus !== null) onAccessEnding?.(accessEndingStatus);
  }, [accessEndingStatus, onAccessEnding]);

  useEffect(() => {
    if (!snapshot.commandCentre) return;
    queryClient.setQueryData(commandQueryOptions.queryKey, snapshot.commandCentre);
  }, [commandQueryOptions.queryKey, queryClient, snapshot.commandCentre]);

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
  let commercial: ReactNode;

  if (accessEndingStatus !== null) {
    projectWork = (
      <ProjectWorkState>
        <DataStatePanel
          state="unavailable"
          title="Project access unavailable"
          description="Your access changed while this Overview was open."
        />
      </ProjectWorkState>
    );
    commercial = (
      <DataStatePanel
        state="unavailable"
        title="Commercial state unavailable"
        description="Your access changed while this Overview was open."
      />
    );
  } else if (commandQuery.data) {
    commercial = (
      <Suspense
        fallback={<ProjectCommercialPendingCard />}
      >
        <ProjectCurrentDesignCommercialCard
          data={commandQuery.data.currentDesign}
          projectId={snapshot.project.id}
        />
      </Suspense>
    );

    if (workModelMismatch) {
      projectWork = (
        <ProjectWorkState model="mismatch">
          <DataStatePanel
            state="error"
            title="Project work is updating"
            description="No project-work action is available until the latest server reads agree."
            onRetry={refreshProjectWorkModel}
          />
        </ProjectWorkState>
      );
    } else {
      projectWork = (
        <Suspense
          fallback={
            <ProjectWorkState model={commandQuery.data.workModel}>
              <ProjectWorkPendingCard />
            </ProjectWorkState>
          }
        >
          {commandQuery.data.workModel === "v2" ? (
            <ProjectWorkSection
              workModel="v2"
              projectId={snapshot.project.id}
              host={host}
              projectWork={commandQuery.data.projectWork}
              pipelineStage={snapshot.project.stage}
              stale={projectWorkControlsStale}
              onRefresh={() => void commandQuery.refetch()}
            />
          ) : (
            <ProjectWorkState model="unavailable">
              <DataStatePanel
                state="unavailable"
                title="Project Work is not ready"
                description="No project-work action is available until the portfolio rollout is complete."
              />
            </ProjectWorkState>
          )}
        </Suspense>
      );
    }
  } else if (commandQuery.isPending) {
    projectWork = (
      <ProjectWorkState model="pending">
        <ProjectWorkPendingCard />
      </ProjectWorkState>
    );
    commercial = <ProjectCommercialPendingCard />;
  } else {
    projectWork = (
      <ProjectWorkState model="failed">
        <DataStatePanel
          state="error"
          title="Could not load the Project Overview"
          description="No next action or commercial position is available until the server view loads."
          onRetry={() => void commandQuery.refetch()}
        />
      </ProjectWorkState>
    );
    commercial = (
      <DataStatePanel
        state="unavailable"
        title="Commercial state unavailable"
        description="Commercial facts remain unavailable until the Project Overview server view loads."
      />
    );
  }

  const recent = snapshotContentReady ? (
    <Suspense
      fallback={<ProjectRecentPendingCard />}
    >
      <ProjectRecentNotesEvents
        projectId={snapshot.project.id}
        notes={snapshot.notes}
        events={snapshot.activity}
      />
    </Suspense>
  ) : (
    <Card
      title="Recent notes and events"
      padding="compact"
      data-recent-notes-events="true"
    >
      <AlertBanner
        tone={snapshotState === "refresh-failed" ? "warning" : "info"}
        title={
          snapshotState === "refresh-failed"
            ? "Saved history is not complete"
            : "Updating recent history"
        }
      >
        {snapshotState === "refresh-failed"
          ? "The latest refresh failed. No partial history is presented as complete."
          : "Recent notes and server events appear after the complete snapshot loads."}
      </AlertBanner>
    </Card>
  );

  return (
    <div
      data-project-overview="true"
      data-portal-page-shell="project-overview"
      data-portal-page-shell-ready="true"
    >
      <ProjectOverviewLayout
        state={commandCentreState}
        orientation={
          <Suspense
            fallback={<ProjectOrientationPendingCard />}
          >
            <ProjectOrientationBand
              project={snapshot.project}
              host={host}
              operationalState={orientationProjection?.effectiveState}
              freshness={orientationFreshness(
                commandCentreState,
                commandQuery.data?.generatedAt,
              )}
            />
          </Suspense>
        }
        exception={exception}
        projectWork={projectWork}
        commercial={commercial}
        recent={recent}
      />
    </div>
  );
}
