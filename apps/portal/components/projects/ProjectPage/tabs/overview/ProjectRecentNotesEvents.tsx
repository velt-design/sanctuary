"use client";

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
}: {
  projectId: string;
  notes: ProjectNote[];
  events: ProjectActivityItem[];
}) {
  const visibleEvents = events.filter(
    (event) => !hasProhibitedProjectWorkText(event.title, event.detail),
  );

  return (
    <Card
      className={styles.card}
      title="Recent notes and events"
      padding="none"
      aria-label="Recent notes and events"
      data-recent-notes-events="true"
    >
      <div className={styles.layout}>
        <section
          className={styles.notes}
          aria-labelledby="project-notes-heading"
        >
          <h3 id="project-notes-heading">Team notes</h3>
          <ProjectNotesPanel projectId={projectId} initialNotes={notes} />
        </section>
        <section
          className={styles.events}
          aria-labelledby="project-events-heading"
        >
          <h3 id="project-events-heading">Recent system events</h3>
          {visibleEvents.length ? (
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
              description="No bounded server event is available for this project."
            />
          )}
        </section>
      </div>
    </Card>
  );
}
