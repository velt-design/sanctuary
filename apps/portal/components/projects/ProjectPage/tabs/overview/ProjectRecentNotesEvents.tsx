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
import styles from "./ProjectRecentNotesEvents.module.css";

function eventLabel(type: ProjectActivityItem["type"]): string {
  return type
    .replaceAll("_", " ")
    .replace(/^./, (value) => value.toUpperCase());
}

export default function ProjectRecentNotesEvents({
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

  return (
    <details>
    <summary style={{ cursor: 'pointer', padding: 'var(--ui-space-3)', fontWeight: 600 }}>Team notes & portal history</summary>
    <Card
      className={styles.card}
      title="Recent notes and events"
      padding="none"
      aria-label="Recent notes and events"
      data-recent-notes-events="true"
    >
      {statusPanel}
      <div className={styles.layout}>
        <section
          className={styles.notes}
          aria-labelledby="project-notes-heading"
        >
          <h3 id="project-notes-heading">Team notes</h3>
          {notes ? <div inert={readOnly}><ProjectNotesPanel projectId={projectId} initialNotes={notes} compactComposer /></div> : <p role="status">{pending ? "Reading complete notes…" : "Complete notes unavailable"}</p>}
        </section>
        <section
          className={styles.events}
          aria-labelledby="project-events-heading"
        >
          <h3 id="project-events-heading">Recent system events</h3>
          <p>Portal activity only. Customer conversations are not included here.</p>
          {!visibleEvents ? <p role="status">{pending ? "Reading complete events…" : "Complete events unavailable"}</p> : visibleEvents.length ? (
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
          )}
        </section>
      </div>
    </Card>
    </details>
  );
}
