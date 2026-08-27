"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { ProjectCommandCentreCurrentDesign } from "@/lib/projects/commandCentre/types";
import {
  AlertBanner,
  Button,
  Card,
  DataStatePanel,
  LoadingSkeleton,
} from "@/components/ui/foundation";
import ProjectCurrentDesignCommercialCard from "@/components/projects/ProjectPage/tabs/overview/ProjectCurrentDesignCommercialCard";
import ProjectOrientationBand from "@/components/projects/ProjectPage/tabs/overview/ProjectOrientationBand";
import ProjectOverviewLayout from "@/components/projects/ProjectPage/tabs/overview/ProjectOverviewLayout";
import ProjectRecentNotesEvents from "@/components/projects/ProjectPage/tabs/overview/ProjectRecentNotesEvents";
import ProjectWorkSection from "@/components/projects/ProjectPage/tabs/overview/ProjectWorkSection";
import type { ProjectEnquiryAttachment } from "@/lib/projects/enquiryAttachments/types";
import {
  commandCentreFixtureStaff,
  commandCentreOverviewFixtureProject,
  type CommandCentreViewFixtureState,
  type CommandCentreWorkFixture,
} from "./fixtures";

const FIXTURE_ENQUIRY_ATTACHMENTS: ProjectEnquiryAttachment[] = [
  {
    id: "attachment-fixture-site-plan",
    filename: "matakana-site-plan.pdf",
    contentType: "application/pdf",
    sizeBytes: 1_572_864,
    submittedAt: "2026-08-26T23:42:00.000Z",
  },
  {
    id: "attachment-fixture-inspiration",
    filename: "outdoor-area-inspiration.jpg",
    contentType: "image/jpeg",
    sizeBytes: 9_437_184,
    submittedAt: "2026-08-26T23:42:00.000Z",
  },
];

const FIXTURE_NOTES = [
  {
    id: "note_fixture",
    body: "Customer prefers email updates and has confirmed the site address.",
    authorId: commandCentreFixtureStaff[0].userId,
    authorEmail: commandCentreFixtureStaff[0].email ?? "",
    authorDisplayName: commandCentreFixtureStaff[0].displayName,
    createdAt: "2026-07-29T04:00:00.000Z",
    updatedAt: "2026-07-29T04:00:00.000Z",
    isOwn: false,
  },
];

const FIXTURE_EVENTS = [
  {
    id: "event_fixture_quote",
    at: "2026-07-29T03:00:00.000Z",
    type: "quote_created" as const,
    title: "Quote Q-0100 created",
    detail: "The bounded project snapshot includes this quote event.",
  },
  {
    id: "event_fixture_email",
    at: "2026-07-29T02:00:00.000Z",
    type: "email_sent" as const,
    title: "Customer email sent",
    detail: "Delivery was recorded by the server.",
  },
];

function WorkState({
  model,
  children,
}: {
  model: string;
  children: ReactNode;
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

function freshnessFor(state: CommandCentreViewFixtureState) {
  switch (state) {
    case "ready":
      return {
        label: "Current",
        detail: "Fixture server view",
        tone: "neutral" as const,
      };
    case "refreshing":
      return {
        label: "Refreshing",
        detail: "Saved facts · controls paused",
        tone: "info" as const,
      };
    case "stale":
      return {
        label: "Saved view",
        detail: "Latest refresh failed",
        tone: "warning" as const,
      };
    case "model-mismatch":
      return {
        label: "Review required",
        detail: "Server reads disagree",
        tone: "warning" as const,
      };
    case "summary":
      return {
        label: "Loading",
        detail: "Complete project snapshot pending",
        tone: "info" as const,
      };
    case "pending":
      return {
        label: "Loading",
        detail: "Waiting for the server view",
        tone: "info" as const,
      };
    case "failed":
    case "retry":
      return {
        label: "Unavailable",
        detail: "Server view unavailable",
        tone: "error" as const,
      };
    case "access-401":
    case "access-403":
    case "access-404":
      return {
        label: "Unavailable",
        detail: `Project access ended (${state.slice(-3)})`,
        tone: "error" as const,
      };
  }
}

export default function ProjectCommandCentreFixtureClient({
  currentDesign,
  work,
  viewState,
}: {
  currentDesign: ProjectCommandCentreCurrentDesign;
  work: CommandCentreWorkFixture;
  viewState: CommandCentreViewFixtureState;
}) {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const stale = viewState !== "ready";
  const accessEndingStatus = viewState.startsWith("access-")
    ? viewState.slice(-3)
    : null;
  if (accessEndingStatus) {
    return (
      <div
        data-command-centre-fixture-hydrated={hydrated ? "true" : "false"}
        data-command-centre-state="unavailable"
        data-project-access-boundary={accessEndingStatus}
      >
        <DataStatePanel
          state="unavailable"
          title="Project access unavailable"
          description={`Your access changed while this Overview was open (${accessEndingStatus}).`}
        />
      </div>
    );
  }
  const orientationState = work.projectWork.effectiveState;
  const project = {
    ...commandCentreOverviewFixtureProject,
    ...work.project,
    stage: work.stage,
  };
  const exception =
    viewState === "stale" ? (
      <AlertBanner
        tone="warning"
        title="Saved Overview"
        action={<Button variant="secondary">Retry</Button>}
      >
        Latest refresh failed. Facts remain visible; work controls are paused.
      </AlertBanner>
    ) : viewState === "summary" ? (
      <AlertBanner tone="info" title="Loading the complete project">
        The project summary is ready. Project Work controls and recent history
        remain paused until the complete snapshot arrives.
      </AlertBanner>
    ) : null;

  const projectWork =
    viewState === "pending" ? (
      <WorkState model="pending">
        <Card padding="compact">
          <LoadingSkeleton rows={5} label="Loading Project Work" />
        </Card>
      </WorkState>
    ) : viewState === "failed" || viewState === "retry" ? (
      <WorkState model="failed">
        <DataStatePanel
          state="error"
          title="Could not load the Project Overview"
          description="No next action or commercial position is available until the server view loads."
          onRetry={viewState === "retry" ? () => undefined : undefined}
        />
      </WorkState>
    ) : viewState === "model-mismatch" ? (
      <WorkState model="mismatch">
        <DataStatePanel
          state="error"
          title="Project work is updating"
          description="No action is available until server reads agree."
        />
      </WorkState>
    ) : (
      <ProjectWorkSection
        workModel="v2"
        projectId={project.id}
        host="fixture"
        projectWork={work.projectWork}
        pipelineStage={project.stage}
        stale={stale}
        onRefresh={() => undefined}
        initialStaff={commandCentreFixtureStaff}
        initialEnquiryAttachments={FIXTURE_ENQUIRY_ATTACHMENTS}
        disableFileActions
      />
    );

  const commercial =
    viewState === "pending" ? (
      <Card padding="compact">
        <LoadingSkeleton
          rows={4}
          columns={2}
          label="Loading current design and commercial state"
        />
      </Card>
    ) : viewState === "failed" || viewState === "retry" ? null : (
      <ProjectCurrentDesignCommercialCard data={currentDesign} />
    );

  const recent =
    viewState === "summary" ? (
      <Card
        title="Recent notes and events"
        eyebrow="Bounded project history"
        padding="compact"
        data-recent-notes-events="true"
      >
        <AlertBanner tone="info" title="Updating recent history">
          Recent notes and server events appear after the complete snapshot
          loads.
        </AlertBanner>
      </Card>
    ) : (
      <ProjectRecentNotesEvents
        projectId={project.id}
        notes={FIXTURE_NOTES}
        events={FIXTURE_EVENTS}
      />
    );

  return (
    <div data-command-centre-fixture-hydrated={hydrated ? "true" : "false"}>
      <ProjectOverviewLayout
        state={viewState}
        orientation={
          <ProjectOrientationBand
            project={project}
            host="fixture"
            operationalState={orientationState}
            freshness={freshnessFor(viewState)}
          />
        }
        exception={exception}
        projectWork={projectWork}
        commercial={commercial}
        recent={recent}
      />
    </div>
  );
}
