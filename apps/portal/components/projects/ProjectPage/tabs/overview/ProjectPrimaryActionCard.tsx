"use client";

import { lazy, type ReactNode, Suspense } from "react";
import type {
  ProjectCommandCentreOperations,
  ProjectCommandStaffSummary,
} from "@/lib/projects/commandCentre/types";
import {
  ActionPanel,
  AlertBanner,
  Badge,
  Button,
  Card,
  EmptyState,
  KeyValueGrid,
} from "@/components/ui/foundation";
import LegacyProjectWorkConflict from "./LegacyProjectWorkConflict";
import LegacyProjectWorkHistory from "./LegacyProjectWorkHistory";
import { useLegacyProjectWorkCommandController } from "./useLegacyProjectWorkCommandController";
import styles from "./ProjectPrimaryActionCard.module.css";

const ProjectPrimaryActionControls = lazy(
  () => import("./ProjectPrimaryActionControls"),
);
export default function ProjectPrimaryActionCard({
  projectId,
  host,
  operations,
  stale,
  onRefresh,
  initialStaff,
  children,
}: {
  projectId: string;
  host: string;
  operations: ProjectCommandCentreOperations;
  stale: boolean;
  onRefresh: () => void;
  initialStaff?: ProjectCommandStaffSummary[];
  children?: ReactNode;
}) {
  const controller = useLegacyProjectWorkCommandController({
    projectId,
    host,
    operations,
    stale,
    onRefresh,
  });
  const {
    controlsOpen,
    current,
    disabled,
    error,
    executeCommand,
    legacyReviewRequired,
    message,
    pending,
    prohibitedCurrent,
    setControlsOpen,
    visibleCandidates,
  } = controller;

  const actionTone = current?.isCritical
    ? "error"
    : current?.dueState === "overdue"
      ? "warning"
      : "neutral";

  return (
    <Card
      className={styles.card}
      data-primary-action-card="true"
      data-project-work-section="true"
      data-project-work-model="legacy"
      aria-label="Project Work"
      title="Project Work"
      eyebrow="Legacy compatibility"
      padding="compact"
      action={
        current && !prohibitedCurrent ? (
          <Badge tone={actionTone}>
            {current.isCritical ? "Critical" : current.dueLabel}
          </Badge>
        ) : (
          <Badge tone="neutral">Legacy</Badge>
        )
      }
    >
      <div className={styles.stack}>
        <LegacyProjectWorkConflict
          operations={operations}
          controller={controller}
        />

        {current && !prohibitedCurrent ? (
          <ActionPanel
            title={current.title}
            eyebrow={current.sourceLabel}
            tone={current.isCritical ? "critical" : "inverse"}
            data-primary-action-source={current.sourceKind}
            status={
              <Badge tone={actionTone}>
                {current.isCritical ? "Critical" : current.dueLabel}
              </Badge>
            }
            footer={
              <Button
                loading={pending}
                disabled={disabled || !operations.permissions.canComplete}
                onClick={() =>
                  void executeCommand({
                    command: "complete",
                    ...controller.actionRef(current),
                  })
                }
              >
                Complete
              </Button>
            }
          >
            <KeyValueGrid
              columns={3}
              items={[
                {
                  label: "Owner",
                  value: current.owner?.displayName ?? "Unassigned",
                },
                { label: "Due", value: current.dueLabel },
                { label: "Category", value: current.category },
              ]}
            />
            {current.isCritical && current.criticalReason ? (
              <AlertBanner tone="blocking" title="Critical action">
                {current.criticalReason}
              </AlertBanner>
            ) : null}
          </ActionPanel>
        ) : prohibitedCurrent ? null : (
          <div data-primary-action-state="empty">
            <EmptyState
              compact
              title="No next action has been set"
              description={
                visibleCandidates.some((candidate) => candidate.requiresDueDate)
                  ? "Due date required. Select open work or create an action; undated work needs a date before it can become primary."
                  : visibleCandidates.length
                    ? "Select open work or create a concrete action."
                    : "No permitted legacy next action is visible. Create an email, design, commercial, follow-up, or other action."
              }
            />
          </div>
        )}

        {!legacyReviewRequired &&
        (operations.permissions.canSelect ||
          operations.permissions.canCreate ||
          operations.permissions.canReschedule ||
          operations.permissions.canReassign ||
          operations.permissions.canSetCritical) ? (
          <div className={styles.controlsSection}>
            <Button
              type="button"
              variant="secondary"
              disabled={disabled}
              aria-expanded={controlsOpen}
              onClick={() => setControlsOpen((open) => !open)}
            >
              {controlsOpen ? "Close action controls" : "Manage next action"}
            </Button>
            {controlsOpen ? (
              <Suspense
                fallback={
                  <AlertBanner tone="info" title="Loading action controls" />
                }
              >
                <ProjectPrimaryActionControls
                  operations={operations}
                  current={current}
                  disabled={disabled}
                  host={host}
                  initialStaff={initialStaff}
                  executeCommand={executeCommand}
                />
              </Suspense>
            ) : null}
          </div>
        ) : null}

        {stale ? (
          <AlertBanner tone="warning" title="Action controls paused">
            Refresh the Overview before changing the primary action.
          </AlertBanner>
        ) : null}
        {message ? (
          <AlertBanner tone="info" title="Project command saved">
            {message}
          </AlertBanner>
        ) : null}
        {error ? (
          <AlertBanner tone="error" title="Project command not saved">
            {error}
          </AlertBanner>
        ) : null}

        {children}

        <LegacyProjectWorkHistory entries={operations.audit} />
      </div>
    </Card>
  );
}
