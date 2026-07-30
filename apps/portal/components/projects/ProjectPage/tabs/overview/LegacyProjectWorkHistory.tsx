"use client";

import { lazy, Suspense, useState } from "react";
import type { ProjectCommandAuditEntry } from "@/lib/projects/commandCentre/types";
import {
  ActivityTimeline,
  ActivityTimelineItem,
  Badge,
  Button,
} from "@/components/ui/foundation";
import styles from "./ProjectPrimaryActionCard.module.css";

const ProjectCommandHistoryModal = lazy(
  () => import("./ProjectCommandHistoryModal"),
);

function eventLabel(eventType: string): string {
  return eventType
    .replace(/^primary_action_/, "")
    .replaceAll("_", " ")
    .replace(/^./, (value) => value.toUpperCase());
}

function auditTimestamp(value: string): string {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.valueOf())) return "Time unavailable";
  return new Intl.DateTimeFormat("en-NZ", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Pacific/Auckland",
  }).format(parsed);
}

function AuditItems({ entries }: { entries: ProjectCommandAuditEntry[] }) {
  return (
    <>
      {entries.map((entry) => (
        <ActivityTimelineItem
          key={entry.id}
          marker={<Badge tone="neutral">{eventLabel(entry.eventType)}</Badge>}
          meta={`${entry.actor?.displayName ?? "Staff"} · ${auditTimestamp(entry.createdAt)}`}
          footer={entry.reason || undefined}
        >
          {entry.reason ? "Reason recorded" : "Project command updated"}
        </ActivityTimelineItem>
      ))}
    </>
  );
}

export default function LegacyProjectWorkHistory({
  entries,
}: {
  entries: ProjectCommandAuditEntry[];
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  if (!entries.length) return null;

  return (
    <>
      <details className={styles.history}>
        <summary>Legacy command history</summary>
        <section aria-label="Recent project command changes">
          <div className={styles.historyHeader}>
            <h3>Recent changes</h3>
            {entries.length > 5 ? (
              <Button
                variant="tertiary"
                size="small"
                onClick={() => setHistoryOpen(true)}
              >
                View recent history
              </Button>
            ) : null}
          </div>
          <ActivityTimeline ariaLabel="Recent project command changes">
            <AuditItems entries={entries.slice(0, 5)} />
          </ActivityTimeline>
        </section>
      </details>

      {historyOpen ? (
        <Suspense fallback={null}>
          <ProjectCommandHistoryModal onClose={() => setHistoryOpen(false)}>
            <AuditItems entries={entries} />
          </ProjectCommandHistoryModal>
        </Suspense>
      ) : null}
    </>
  );
}
