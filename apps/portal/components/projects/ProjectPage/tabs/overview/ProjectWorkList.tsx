"use client";

import type { ProjectCommandStaffSummary } from "@/lib/projects/commandCentre/types";
import { isGenericCompletableWorkSource } from "@/lib/projects/workItems/workItemCapabilities";
import {
  Badge,
  Button,
  EmptyState,
  TaskList,
  TaskRow,
} from "@/components/ui/foundation";
import type { ProjectWorkCommandController } from "./useProjectWorkCommandController";
import {
  formatProjectWorkDue,
  isCadenceWorkItem,
  isDecisionReviewWorkItem,
  projectWorkAssigneeLabel,
  sentCommandForWorkItem,
} from "./projectWorkPresentation";
import { isProhibitedProjectWorkItem } from "./projectWorkVisibilityPolicy";
import styles from "./ProjectWorkSection.module.css";

type ProjectWorkListProps = {
  controller: ProjectWorkCommandController;
  staff?: ProjectCommandStaffSummary[];
};

export default function ProjectWorkList(props: ProjectWorkListProps) {
  const visibleBlockedPrimary =
    props.controller.primaryItem?.status === "BLOCKED" &&
    !isProhibitedProjectWorkItem(props.controller.primaryItem);
  const primaryId = visibleBlockedPrimary
    ? null
    : (props.controller.primaryItem?.id ?? null);
  const visibleOpenItems = props.controller.projection.openItems.filter(
    (item) => item.id !== primaryId && !isProhibitedProjectWorkItem(item),
  );
  const visibleBlockedItems = props.controller.projection.blockedItems.filter(
    (item) => item.id !== primaryId && !isProhibitedProjectWorkItem(item),
  );
  const items = [...visibleOpenItems, ...visibleBlockedItems];

  return (
    <section
      className={styles.workList}
      aria-labelledby="other-project-work-list-title"
      data-project-work-list="v2"
    >
      <div className={styles.subsectionHeading}>
        <div>
          <h3 id="other-project-work-list-title">
            {visibleBlockedPrimary
              ? "Open and blocked project work"
              : "Other project work"}
          </h3>
          <p>
            {visibleBlockedPrimary
              ? "Blocked work remains an exception with no enabled action."
              : "Open and blocked server-ranked work below the primary action."}
          </p>
        </div>
        <div className={styles.badges}>
          <Badge tone={visibleOpenItems.length ? "warning" : "neutral"}>
            {visibleOpenItems.length} open
          </Badge>
          {visibleBlockedItems.length ? (
            <Badge tone="error">{visibleBlockedItems.length} blocked</Badge>
          ) : null}
        </div>
      </div>

      {items.length ? (
        <TaskList ariaLabel="Other project work">
          {items.map((item) => {
            const sendCommand = sentCommandForWorkItem(item);
            const cadence = isCadenceWorkItem(item);
            const blocked = item.status === "BLOCKED";
            const itemPending = props.controller.pendingItemId === item.id;
            const controlsDisabled =
              props.controller.pending || props.controller.stale || blocked;
            const description = blocked
              ? `${item.blockedReason ?? "This work is blocked."} · ${projectWorkAssigneeLabel(item, props.staff)}`
              : `${item.responsibilityArea.toLowerCase()} · ${projectWorkAssigneeLabel(item, props.staff)} · Due ${formatProjectWorkDue(item.dueAt)}`;
            return (
              <TaskRow
                key={item.id}
                checked={false}
                showControl={false}
                label={item.title}
                description={description}
                status={
                  <div className={styles.badges}>
                    {item.priority === "CRITICAL" ? (
                      <Badge tone="error">Critical</Badge>
                    ) : null}
                    {blocked ? <Badge tone="error">Blocked</Badge> : null}
                    {!blocked && isDecisionReviewWorkItem(item) ? (
                      <Badge tone="warning">Decision required</Badge>
                    ) : null}
                  </div>
                }
                actions={
                  !blocked ? (
                    <div className={styles.rowActions}>
                      {sendCommand ? (
                        <Button
                          size="small"
                          loading={itemPending}
                          disabled={controlsDisabled}
                          onClick={() =>
                            void props.controller.runItemAction(item, "sent")
                          }
                        >
                          Email sent
                        </Button>
                      ) : null}
                      {cadence ? (
                        <Button
                          size="small"
                          variant="secondary"
                          disabled={controlsDisabled}
                          onClick={() =>
                            void props.controller.runItemAction(item, "reply")
                          }
                        >
                          Customer replied
                        </Button>
                      ) : null}
                      {isGenericCompletableWorkSource(item.sourceType) ? (
                        <Button
                          size="small"
                          loading={itemPending}
                          disabled={controlsDisabled}
                          onClick={() =>
                            void props.controller.runItemAction(
                              item,
                              "complete",
                            )
                          }
                        >
                          Complete
                        </Button>
                      ) : null}
                    </div>
                  ) : null
                }
              />
            );
          })}
        </TaskList>
      ) : (
        <EmptyState
          compact
          title="No other open work"
          description="The primary action above is the only current work selected by the server."
        />
      )}
    </section>
  );
}
