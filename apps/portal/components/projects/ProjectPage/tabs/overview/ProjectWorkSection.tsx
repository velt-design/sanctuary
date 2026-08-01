"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchProjectStaffDirectory } from "@/lib/projects/commandCentre/client";
import type { ProjectCommandStaffSummary } from "@/lib/projects/commandCentre/types";
import type { ProjectPageSnapshot } from "@/lib/projects/types";
import type { ProjectWorkProjection } from "@/lib/projects/workItems/types";
import { isApprovedSiteVisitSpecialistIdentity } from "@/lib/projects/workItems/prohibitedWork";
import { isGenericCompletableWorkSource } from "@/lib/projects/workItems/workItemCapabilities";
import {
  projectClosedOutcomeLabel,
  projectWorkResponsibilityLabel,
} from "@/lib/projects/workItems/presentation";
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
  const reason = primary.reason;
  const href =
    primary.kind === "recovery" || primary.kind === "specialist"
      ? primary.href
      : null;
  const actionLabel =
    primary.kind === "recovery" || primary.kind === "specialist"
      ? (primary.actionLabel ??
        (primary.kind === "recovery" ? "Review recovery" : "Open workflow"))
      : null;
  const badge =
    primary.kind === "workItem"
      ? primary.dueState === "critical"
        ? "Critical"
        : primary.dueState === "overdue"
          ? "Overdue"
          : primary.dueState === "today"
            ? "Due today"
            : "Upcoming"
      : primary.kind === "needsTriage" || primary.kind === "stateReview"
        ? "Review"
        : primary.kind === "none"
          ? null
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
  const details =
    primary.kind === "workItem"
      ? [
          { label: "Owner", value: owner },
          { label: "Due", value: due },
          {
            label: "Area",
            value: projectWorkResponsibilityLabel(
              primary.item.responsibilityArea,
            ),
          },
        ]
      : primary.kind === "specialist"
        ? [
            { label: "Owner", value: owner },
            { label: "When", value: "Ready now" },
          ]
        : primary.kind === "stateReview"
          ? [{ label: "Due", value: due }]
          : [];

  return {
    title,
    reason,
    href,
    actionLabel,
    badge,
    details,
    expectedResult,
    tone:
      primary.kind === "workItem" && primary.dueState === "critical"
        ? ("critical" as const)
        : ("default" as const),
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
  const siteVisitCompleted = controller.projection.confirmedFacts.some(
    (fact) => fact.type === "SITE_VISIT_COMPLETED",
  );
  const siteVisitPrimary =
    controller.primary.kind === "specialist" &&
    isApprovedSiteVisitSpecialistIdentity({
      actionKind: controller.primary.kind,
      key: controller.primary.key,
      href: controller.primary.href,
    });
  const prohibitedPrimary = isProhibitedProjectWorkPrimary(controller.primary);
  const blockedPrimary =
    active &&
    controller.primary.kind === "workItem" &&
    controller.primary.item.status === "BLOCKED";
  const ordinaryPrimarySuppressed =
    !active &&
    (controller.primary.kind === "workItem" ||
      controller.primary.kind === "recovery" ||
      controller.primary.kind === "specialist");
  const stateItems = [
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
            value: projectClosedOutcomeLabel(
              controller.projection.closedOutcome,
            ),
          },
        ]
      : []),
  ];

  return (
    <Card
      className={styles.card}
      data-project-work-section="true"
      data-project-work-model="v2"
      aria-label="Project Work"
      title="Project Work"
      eyebrow="Next project action"
      padding="compact"
    >
      <div className={styles.stack}>
        {stateItems.length ? (
          <KeyValueGrid
            columns={stateItems.length === 1 ? 1 : 2}
            ariaLabel="Project work state details"
            items={stateItems}
          />
        ) : null}

        {prohibitedPrimary ? (
          <AlertBanner tone="blocking" title="Legacy work needs review">
            A retired legacy, Call, or unapproved Site Visit action is
            server-selected. It stays hidden and no browser replacement is
            chosen.
          </AlertBanner>
        ) : ordinaryPrimarySuppressed ? (
          <AlertBanner tone="warning" title="Project work state needs review">
            The server returned ordinary work for a non-Active project. No
            browser action is available.
          </AlertBanner>
        ) : blockedPrimary ? (
          <AlertBanner
            tone="blocking"
            title="Blocked project work needs review"
          >
            The server selected blocked work as the primary action. It remains
            visible below as an exception, but no action is enabled until the
            server returns it to open work.
          </AlertBanner>
        ) : (
          <ActionPanel
            className={styles.primaryAction}
            data-primary-project-work="true"
            title={primary.title}
            eyebrow={
              controller.primary.kind === "workItem" ||
              controller.primary.kind === "specialist" ||
              controller.primary.kind === "recovery"
                ? "Do this next"
                : "Project state"
            }
            tone={primary.tone}
            status={
              primary.badge ? (
                <Badge
                  className={styles.primaryStatus}
                  tone={primary.statusTone}
                >
                  {primary.badge}
                </Badge>
              ) : undefined
            }
            footer={
              <div className={styles.commandArea}>
                {controller.primarySentCommand ? (
                  <p className={styles.commandHelp}>
                    <strong>Send externally first.</strong> Then record the
                    outcome.
                  </p>
                ) : (
                  <span className={styles.commandLabel}>
                    {primary.href
                      ? "Continue in the owning workflow"
                      : "Record the outcome"}
                  </span>
                )}
                <div className={styles.inlineActions}>
                  {active && primary.href ? (
                    <ButtonLink href={primary.href} disabled={controller.stale}>
                      {primary.actionLabel}
                    </ButtonLink>
                  ) : null}
                  {active &&
                  pipelineStage.trim().toLowerCase() === "site_visit" &&
                  siteVisitPrimary &&
                  !siteVisitCompleted ? (
                    <Button
                      variant="secondary"
                      loading={controller.pending}
                      disabled={controller.pending || controller.stale}
                      onClick={() => void controller.recordSiteVisitCompleted()}
                    >
                      Record visit complete
                    </Button>
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
                      Mark complete
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
                      Record email sent
                    </Button>
                  ) : null}
                  {active &&
                  controller.primaryCanRecordReply &&
                  primary.primaryItem ? (
                    <Button
                      variant="tertiary"
                      disabled={controller.pending || controller.stale}
                      onClick={() =>
                        void controller.runItemAction(
                          primary.primaryItem!,
                          "reply",
                        )
                      }
                    >
                      Record customer reply
                    </Button>
                  ) : null}
                </div>
              </div>
            }
          >
            {primary.reason ? (
              <p className={styles.reason} data-primary-work-reason="true">
                {primary.reason}
              </p>
            ) : null}
            {primary.details.length ? (
              <KeyValueGrid
                className={styles.primaryFacts}
                columns={
                  primary.details.length >= 3
                    ? 3
                    : primary.details.length === 2
                      ? 2
                      : 1
                }
                items={primary.details}
              />
            ) : null}
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
        ) : null}

        <ProjectWorkControls
          controller={controller}
          projectId={projectId}
          host={host}
          pipelineStage={pipelineStage}
          siteVisitActionProminent={siteVisitPrimary}
          onRefresh={onRefresh}
        />

        {controller.stale ? (
          <p className={styles.pausedNotice} role="status">
            Work controls paused until the Overview refresh completes.
          </p>
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
