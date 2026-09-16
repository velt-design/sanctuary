"use client";

import { Button } from "@/components/ui/foundation";
import type { ProjectWorkItem } from "@/lib/projects/workItems/types";
import type { ProjectWorkCommandController } from "./useProjectWorkCommandController";
import styles from "./ProjectWorkSection.module.css";

export default function ProjectEmailWorkControls({ item, controller, canRecordSent, canRecordReply }: {
  item: ProjectWorkItem;
  controller: ProjectWorkCommandController;
  canRecordSent: boolean;
  canRecordReply: boolean;
}) {
  const disabled = controller.pending || controller.stale || item.status === "BLOCKED";
  return (
    <details className={styles.emailRecording}>
      <summary>Update follow-up tracking</summary>
      <p className={styles.commandHelp}>
        After sending in Outlook, record it here to schedule the next reminder.
        Record a reply only when it answers this follow-up; this stops its reminders.
        These controls do not send email.
      </p>
      <div className={styles.inlineActions}>
        {canRecordSent ? (
          <Button variant="secondary" loading={controller.pendingItemId === item.id}
            disabled={disabled} onClick={() => void controller.runItemAction(item, "sent")}>
            Record email sent
          </Button>
        ) : null}
        {canRecordReply ? (
          <Button variant="secondary" disabled={disabled}
            onClick={() => void controller.runItemAction(item, "reply")}>
            Record customer reply
          </Button>
        ) : null}
      </div>
    </details>
  );
}
