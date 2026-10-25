"use client";

import type { ReactNode } from "react";
import type { ProjectActivityItem, ProjectNote } from "@/lib/projects/types";
import { formatPortalDateTime } from "@/lib/format/portalDateTime";
import {
  ActivityTimeline,
  ActivityTimelineItem,
  Badge,
  Card,
  EmptyState,
} from "@/components/ui/foundation";
import ProjectNotesPanel from "../_components/ProjectNotesPanel.client";
import { hasProhibitedProjectWorkText } from "./projectWorkVisibilityPolicy";
import { ProjectRecentNotesSurface } from "../ProjectOverviewSurface";

function eventLabel(type: ProjectActivityItem["type"]): string {
  return type
    .replaceAll("_", " ")
    .replace(/^./, (value) => value.toUpperCase());
}

export function projectRecentNotesEvidence({
  projectId,
  notes,
  events,
  statusPanel,
  readOnly = false,
  pending = true,
}: {
  projectId: string;
  notes: ProjectNote[] | null;
  events: ProjectActivityItem[] | null;
  statusPanel?: ReactNode;
  readOnly?: boolean;
  pending?: boolean;
}) {
  const visibleEvents = events?.filter(
    (event) => !hasProhibitedProjectWorkText(event.title, event.detail),
  );

  return { notes: notes ? <div inert={readOnly}><ProjectNotesPanel projectId={projectId} initialNotes={notes} compactComposer /></div> : <p role="status">{pending ? "Reading complete notes…" : "Complete notes unavailable"}</p>, events: !visibleEvents ? <p role="status">{pending ? "Reading complete events…" : "Complete events unavailable"}</p> : visibleEvents.length ? (
            <ActivityTimeline ariaLabel="Recent system events">
              {visibleEvents.map((event) => (
                <ActivityTimelineItem
                  key={event.id}
                  marker={
                    <Badge tone="neutral">{eventLabel(event.type)}</Badge>
                  }
                  meta={formatPortalDateTime(event.at)}
                >
                  <strong>{event.title}</strong>
                  {event.detail ? <p>{event.detail}</p> : null}
                </ActivityTimelineItem>
              ))}
            </ActivityTimeline>
          ) : (
            <EmptyState
              compact
              title="No recent system events"
              description="No recent portal activity is recorded for this project."
            />
          ), statusPanel };
}

export default function ProjectRecentNotesEvents(props: Parameters<typeof projectRecentNotesEvidence>[0]) { return <ProjectRecentNotesSurface {...projectRecentNotesEvidence(props)}/>; }
