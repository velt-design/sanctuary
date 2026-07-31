"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchProjectStaffDirectory } from "@/lib/projects/commandCentre/client";
import type { ProjectCommandStaffSummary } from "@/lib/projects/commandCentre/types";
import type { ProjectPageSnapshot } from "@/lib/projects/types";
import type { ProjectWorkProjection } from "@/lib/projects/workItems/types";
import { isGenericCompletableWorkSource } from "@/lib/projects/workItems/workItemCapabilities";
import { qk } from "@/lib/queries/keys";
import {
  ActionPanel,
  AlertBanner,
  Badge,
  Button,
  ButtonLink,
  Card,
  KeyValueGrid,
} from "@/components/ui/foundation";
import ProjectWorkControls from "./ProjectWorkControls";
import ProjectWorkList from "./ProjectWorkList";
import {
  formatProjectWorkDue,
  isDecisionReviewWorkItem,
  projectWorkAssigneeLabel,
  projectWorkStateLabel,
} from "./projectWorkPresentation";
import {
  useProjectWorkCommandController,
  type ProjectWorkCommandController,
} from "./useProjectWorkCommandController";
import {
  isProhibitedProjectWorkItem,
  isProhibitedProjectWorkPrimary,
} from "./projectWorkVisibilityPolicy";
import styles from "./ProjectWorkSection.module.css";

type SharedProps = {
  projectId: string;
  host: string;
  pipelineStage: ProjectPageSnapshot["project"]["stage"];
  stale: boolean;
  onRefresh: () => void;
  initialStaff?: ProjectCommandStaffSummary[];
};

export type ProjectWorkSectionProps = SharedProps & {
  workModel: "v2";
  projectWork: ProjectWorkProjection;
};

function primaryPresentation(
  controller: ProjectWorkCommandController,
  staff: ProjectCommandStaffSummary[],
) {
  const { primary, primaryItem } = controller;
  const title =
    primary.kind === "workItem" ? primary.item.title : primary.title;
  const reason =
    primary.kind === "workItem"
      ? null
      : primary.reason;
  const href =
    (primary.kind === "recovery" || primary.kind === "specialist") &&
    !/site[\s_-]*visits?/i.test(primary.href ?? "")
      ? primary.href
      : null;
  const badge =
    primary.kind === "workItem"
      ? primary.dueState === "critical"
        ? "Critical"
        : primary.dueState === "overdue"
          ? "Overdue"
          : primary.dueState === "today"
            ? "Due today"
            : formatProjectWorkDue(primary.item.dueAt)
      : primary.kind === "needsTriage" || primary.kind === "stateReview"
        ? "Review"
        : primary.kind === "none"
          ? "Status"
          : "Ready";
  const owner =
    primary.kind === "workItem"
      ? projectWorkAssigneeLabel(primary.item, staff)
      : primary.kind === "specialist"
        ? primary.owner
        : "Not provided";
  const due =
    primary.kind === "workItem"
      ? formatProjectWorkDue(primary.item.dueAt)
      : primary.kind === "stateReview"
        ? formatProjectWorkDue(primary.dueAt)
        : "Not provided";
  const expectedResult =
    primary.kind === "specialist" ? primary.expectedResult : null;

  return {
    title,
    reason,
    href,
    badge,
    owner,
    due,
    expectedResult,
    tone:
      primary.kind === "workItem" && primary.dueState === "critical"
        ? ("critical" as const)
        : ("inverse" as const),
    statusTone:
      badge === "Critical"
        ? ("error" as const)
        : badge === "Overdue"
          ? ("warning" as const)
          : ("neutral" as const),
    primaryItem,
  };
}

export default function ProjectWorkSection({
  projectId,
  host,
  projectWork,
  pipelineStage,
  stale,
  onRefresh,
  initialStaff,
}: ProjectWorkSectionProps) {
  const prohibitedServerPrimary = isProhibitedProjectWorkPrimary(
    projectWork.primaryAction,
  );
  const controller = useProjectWorkCommandController({
    projectId,
    host,
    projectWork,
    stale: stale || prohibitedServerPrimary,
    onRefresh,
  });
  const needsStaffDirectory = [
    ...(controller.primaryItem ? [controller.primaryItem] : []),
    ...controller.projection.openItems,
    ...controller.projection.blockedItems,
  ].some((item) => item.effectiveAssignee.kind === "staff");
  const staffQuery = useQuery({
    queryKey: qk.staff.directory(host),
    queryFn: fetchProjectStaffDirectory,
    staleTime: 5 * 60 * 1000,
    enabled: needsStaffDirectory && !initialStaff,
    ...(initialStaff ? { initialData: initialStaff } : null),
  });
  const staff = staffQuery.data ?? [];
  const primary = primaryPresentation(controller, staff);
  const active = controller.projection.effectiveState === "ACTIVE";
  const prohibitedPrimary = isProhibitedProjectWorkPrimary(controller.primary);
  const blockedPrimary =
    active &&
    controller.primary.kind === "workItem" &&
    controller.primary.item.status === "BLOCKED";
  const visibleOpenItems = controller.projection.openItems.filter(
    (item) => !isProhibitedProjectWorkItem(item),
  );
  const visibleBlockedItems = controller.projection.blockedItems.filter(
    (item) => !isProhibitedProjectWorkItem(item),
  );
  const ordinaryPrimarySuppressed =
    !active &&
    (controller.primary.kind === "workItem" ||
      controller.primary.kind === "recovery" ||
      controller.primary.kind === "specialist");
  const stateItems = [
    {
      label: "Operational state",
      value: projectWorkStateLabel(controller.projection.effectiveState),
    },
    ...(active
      ? [
          {
            label: "Current work",
            value: `${visibleOpenItems.length} open · ${visibleBlockedItems.length} blocked`,
          },
        ]
      : []),
    ...(controller.projection.effectiveState === "WAITING"
      ? [
          {
            label: "Waiting until",
            value: controller.projection.waitingUntil
              ? formatProjectWorkDue(controller.projection.waitingUntil)
              : "Not provided",
          },
          {
            label: "Waiting reason",
            value: controller.projection.waitingReason ?? "Not provided",
          },
        ]
      : []),
    ...(controller.projection.effectiveState === "CLOSED"
      ? [
          {
            label: "Outcome",
            value:
              controller.projection.closedOutcome
                ?.replaceAll("_", " ")
                .toLowerCase() ?? "Not provided",
          },
        ]
      : []),
  ];
  const nonActiveNotice =
    controller.projection.effectiveState === "WAITING"
      ? {
          title: "Ordinary project work is paused",
          detail:
            "Only the server-provided waiting review and operational-state controls are available.",
        }
      : controller.projection.effectiveState === "CLOSED"
        ? {
            title: "Closed project work is paused",
            detail:
              "Reopen the project through its operational state before creating or acting on work.",
          }
        : controller.projection.effectiveState === "ARCHIVED"
          ? {
              title: "Archived project work is read-only",
              detail:
                "Archived projects expose no active Project Work or mutation controls.",
            }
          : null;

  return (
    <Card
      className={styles.card}
      data-project-work-section="true"
      data-project-work-model="v2"
      aria-label="Project Work"
      title="Project Work"
      eyebrow="Server-ranked next action"
      padding="compact"
      action={
        <Badge
          tone={
            controller.projection.effectiveState === "WAITING"
              ? "warning"
              : "neutral"
          }
        >
          {projectWorkStateLabel(controller.projection.effectiveState)}
        </Badge>
      }
    >
      <div className={styles.stack}>
        <KeyValueGrid
          columns={stateItems.length > 2 ? 3 : 2}
          ariaLabel="Project work state"
          items={stateItems}
        />

        {active && visibleBlockedItems.length && !blockedPrimary ? (
          <AlertBanner
            tone="blocking"
            title={`${visibleBlockedItems.length} blocked project-work ${visibleBlockedItems.length === 1 ? "item" : "items"}`}
          >
            Blocked work stays visible below but cannot become an enabled
            primary action.
          </AlertBanner>
        ) : null}

        {prohibitedPrimary ? (
          <AlertBanner tone="blocking" title="Legacy work needs review">
            A retired legacy, Call, or Site Visit action is server-selected. It
            stays hidden and no browser replacement is chosen.
          </AlertBanner>
        ) : ordinaryPrimarySuppressed ? (
          <AlertBanner tone="warning" title="Project work state needs review">
            The server returned ordinary work for a non-Active project. No
            browser action is available.
          </AlertBanner>
        ) : blockedPrimary ? (
          <AlertBanner tone="blocking" title="Blocked project work needs review">
            The server selected blocked work as the primary action. It remains
            visible below as an exception, but no action is enabled until the
            server returns it to open work.
          </AlertBanner>
        ) : (
          <ActionPanel
            title={primary.title}
            eyebrow={
              controller.primary.kind === "workItem"
                ? "Primary project work"
                : "Project state"
            }
            tone={primary.tone}
            status={<Badge tone={primary.statusTone}>{primary.badge}</Badge>}
            footer={
              <div className={styles.inlineActions}>
                {active && primary.href ? (
                  <ButtonLink href={primary.href}>Open</ButtonLink>
                ) : null}
                {active &&
                primary.primaryItem &&
                isGenericCompletableWorkSource(
                  primary.primaryItem.sourceType,
                ) ? (
                  <Button
                    loading={
                      controller.pendingItemId === primary.primaryItem.id
                    }
                    disabled={controller.pending || controller.stale}
                    onClick={() =>
                      void controller.runItemAction(
                        primary.primaryItem!,
                        "complete",
                      )
                    }
                  >
                    Complete
                  </Button>
                ) : null}
                {active &&
                controller.primarySentCommand &&
                primary.primaryItem ? (
                  <Button
                    loading={
                      controller.pendingItemId === primary.primaryItem.id
                    }
                    disabled={controller.pending || controller.stale}
                    onClick={() =>
                      void controller.runItemAction(
                        primary.primaryItem!,
                        "sent",
                      )
                    }
                  >
                    Email sent
                  </Button>
                ) : null}
                {active &&
                controller.primaryCanRecordReply &&
                primary.primaryItem ? (
                  <Button
                    variant="secondary"
                    disabled={controller.pending || controller.stale}
                    onClick={() =>
                      void controller.runItemAction(
                        primary.primaryItem!,
                        "reply",
                      )
                    }
                  >
                    Customer replied
                  </Button>
                ) : null}
              </div>
            }
          >
            {primary.reason ? (
              <p className={styles.reason}>{primary.reason}</p>
            ) : null}
            <KeyValueGrid
              columns={3}
              items={[
                { label: "Owner", value: primary.owner },
                { label: "Due", value: primary.due },
                {
                  label: "Source",
                  value: primary.primaryItem
                    ? primary.primaryItem.responsibilityArea.toLowerCase()
                    : controller.primary.kind,
                },
              ]}
            />
            {primary.expectedResult ? (
              <KeyValueGrid
                columns={1}
                items={[
                  {
                    label: "Expected result",
                    value: primary.expectedResult,
                  },
                ]}
              />
            ) : null}
            {primary.primaryItem?.priority === "CRITICAL" &&
            primary.primaryItem.priorityReason ? (
              <AlertBanner tone="blocking" title="Critical work">
                {primary.primaryItem.priorityReason}
              </AlertBanner>
            ) : null}
            {primary.primaryItem &&
            isDecisionReviewWorkItem(primary.primaryItem) ? (
              <AlertBanner tone="warning" title="A staff decision is required">
                Keep the project Active with new work, move it to Waiting, or
                close it with an outcome. Nothing happens automatically.
              </AlertBanner>
            ) : null}
          </ActionPanel>
        )}

        {active ? (
          <ProjectWorkList controller={controller} staff={staff} />
        ) : nonActiveNotice ? (
          <AlertBanner tone="info" title={nonActiveNotice.title}>
            {nonActiveNotice.detail}
          </AlertBanner>
        ) : null}

        <ProjectWorkControls
          controller={controller}
          projectId={projectId}
          host={host}
          pipelineStage={pipelineStage}
          onRefresh={onRefresh}
        />

        {controller.stale ? (
          <AlertBanner tone="warning" title="Work controls paused">
            Refresh the Overview before changing project work.
          </AlertBanner>
        ) : null}
        {controller.message ? (
          <AlertBanner tone="info" title="Project work updated">
            {controller.message}
          </AlertBanner>
        ) : null}
        {controller.error ? (
          <AlertBanner tone="error" title="Project work update not confirmed">
            {controller.error}
          </AlertBanner>
        ) : null}
      </div>
    </Card>
  );
}
