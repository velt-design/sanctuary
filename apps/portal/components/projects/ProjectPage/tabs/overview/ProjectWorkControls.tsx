"use client";

import type { ProjectPageSnapshot } from "@/lib/projects/types";
import type {
  ProjectClosedOutcome,
  ProjectOperationalState,
  ProjectWorkResponsibilityArea,
} from "@/lib/projects/workItems/types";
import {
  Badge,
  Button,
  ButtonLink,
  Input,
  Select,
  Textarea,
} from "@/components/ui/foundation";
import ConfirmationCorrectionControls from "@/components/projects/workQueue/ConfirmationCorrectionControls.client";
import { isProjectLostClosedOutcome } from "@/lib/projects/workItems/closePolicy";
import { isDecisionReviewWorkItem } from "./projectWorkPresentation";
import type { ProjectWorkCommandController } from "./useProjectWorkCommandController";
import styles from "./ProjectWorkSection.module.css";

const RESPONSIBILITY_AREAS: Array<{
  value: ProjectWorkResponsibilityArea;
  label: string;
}> = [
  { value: "CUSTOMER", label: "Customer" },
  { value: "DESIGN", label: "Design" },
  { value: "COMMERCIAL", label: "Commercial" },
  { value: "OPERATIONS", label: "Operations" },
  { value: "ADMIN", label: "Admin" },
];

const CLOSED_OUTCOMES: Array<{
  value: ProjectClosedOutcome;
  label: string;
}> = [
  { value: "LOST_NO_RESPONSE", label: "Lost — no response" },
  { value: "LOST_BUDGET_PRICE", label: "Lost — budget or price" },
  { value: "LOST_OTHER_SUPPLIER", label: "Lost — chose another supplier" },
  { value: "LOST_TIMING_DEFERRED", label: "Lost — timing or deferred" },
  { value: "LOST_NOT_SUITABLE", label: "Lost — not suitable" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "COMPLETE", label: "Complete" },
];

export default function ProjectWorkControls({
  controller,
  projectId,
  host,
  pipelineStage,
  siteVisitActionProminent = false,
  onRefresh,
}: {
  controller: ProjectWorkCommandController;
  projectId: string;
  host: string;
  pipelineStage: ProjectPageSnapshot["project"]["stage"];
  siteVisitActionProminent?: boolean;
  onRefresh: () => void;
}) {
  const lostCloseSelected =
    controller.stateChoice === "CLOSED" &&
    isProjectLostClosedOutcome(controller.closedOutcome);
  const reviewItem =
    controller.primaryItem && isDecisionReviewWorkItem(controller.primaryItem)
      ? controller.primaryItem
      : null;
  const siteVisitCompleted = controller.projection.confirmedFacts.some(
    (fact) => fact.type === "SITE_VISIT_COMPLETED",
  );
  const active = controller.projection.effectiveState === "ACTIVE";
  const controlsLabel = active
    ? "Manage project work"
    : controller.projection.effectiveState === "WAITING"
      ? "Resume or update waiting"
      : "Reopen project";

  if (controller.projection.effectiveState === "ARCHIVED") return null;

  return (
    <div className={styles.controlsSection}>
      <Button
        type="button"
        variant="tertiary"
        disabled={controller.stale}
        aria-expanded={controller.controlsOpen}
        onClick={() => controller.setControlsOpen(!controller.controlsOpen)}
      >
        {controller.controlsOpen ? "Close work controls" : controlsLabel}
      </Button>
      {controller.controlsOpen ? (
        <div className={styles.controlStack}>
          {active ? (
            <details className={styles.disclosure}>
              <summary>
                {reviewItem
                  ? "Keep Active with new work"
                  : "Create manual work"}
              </summary>
              <div className={styles.formGrid}>
                {reviewItem ? (
                  <Textarea
                    label="Why the project is staying Active"
                    value={controller.manualReason}
                    maxLength={500}
                    disabled={controller.pending || controller.stale}
                    onChange={(event) =>
                      controller.setManualReason(event.target.value)
                    }
                  />
                ) : null}
                <Input
                  label="Work to do"
                  value={controller.manualTitle}
                  maxLength={160}
                  disabled={controller.pending || controller.stale}
                  onChange={(event) =>
                    controller.setManualTitle(event.target.value)
                  }
                />
                {controller.manualTitleProhibited ? (
                  <p className={styles.policyNotice} role="alert">
                    Call and Site Visit work cannot be created from Project
                    Work.
                  </p>
                ) : null}
                <Select
                  label="Responsibility"
                  value={controller.manualArea}
                  disabled={controller.pending || controller.stale}
                  onChange={(event) =>
                    controller.setManualArea(
                      event.target.value as ProjectWorkResponsibilityArea,
                    )
                  }
                >
                  {RESPONSIBILITY_AREAS.map((area) => (
                    <option key={area.value} value={area.value}>
                      {area.label}
                    </option>
                  ))}
                </Select>
                <Input
                  label="Due in Auckland"
                  type="datetime-local"
                  value={controller.manualDueAt}
                  disabled={controller.pending || controller.stale}
                  onChange={(event) =>
                    controller.setManualDueAt(event.target.value)
                  }
                />
                <Button
                  loading={controller.pending}
                  disabled={
                    controller.stale || controller.manualTitleProhibited
                  }
                  onClick={() => void controller.createManualItem()}
                >
                  {reviewItem ? "Replace review with work" : "Create work"}
                </Button>
              </div>
            </details>
          ) : null}

          <details className={styles.disclosure}>
            <summary>Change operational state</summary>
            <div className={styles.formGrid}>
              <Select
                label="State"
                value={controller.stateChoice}
                disabled={controller.pending || controller.stale}
                onChange={(event) =>
                  controller.setStateChoice(
                    event.target.value as ProjectOperationalState,
                  )
                }
              >
                <option value="ACTIVE">Active</option>
                <option value="WAITING">Waiting</option>
                <option value="CLOSED">Closed</option>
              </Select>
              {controller.stateChoice === "WAITING" ? (
                <Input
                  label="Wake-up time in Auckland"
                  type="datetime-local"
                  value={controller.waitingUntil}
                  disabled={controller.pending || controller.stale}
                  onChange={(event) =>
                    controller.setWaitingUntil(event.target.value)
                  }
                />
              ) : null}
              {controller.stateChoice === "CLOSED" ? (
                <Select
                  label="Outcome"
                  value={controller.closedOutcome}
                  disabled={controller.pending || controller.stale}
                  onChange={(event) =>
                    controller.setClosedOutcome(
                      event.target.value as ProjectClosedOutcome,
                    )
                  }
                >
                  {CLOSED_OUTCOMES.map((outcome) => (
                    <option key={outcome.value} value={outcome.value}>
                      {outcome.label}
                    </option>
                  ))}
                </Select>
              ) : null}
              {!lostCloseSelected ? (
                <Textarea
                  label={
                    controller.stateChoice === "ACTIVE"
                      ? "Reason (optional)"
                      : "Reason"
                  }
                  value={controller.stateReason}
                  maxLength={500}
                  disabled={controller.pending || controller.stale}
                  onChange={(event) =>
                    controller.setStateReason(event.target.value)
                  }
                />
              ) : null}
              {controller.stateChoice === "CLOSED" ? (
                <Textarea
                  label="Additional note (optional)"
                  value={controller.closedNote}
                  maxLength={1000}
                  disabled={controller.pending || controller.stale}
                  onChange={(event) =>
                    controller.setClosedNote(event.target.value)
                  }
                />
              ) : null}
              <Button
                loading={controller.pending}
                disabled={controller.stale}
                onClick={() => void controller.updateState()}
              >
                Save state
              </Button>
            </div>
          </details>

          {active ? (
            <ConfirmationCorrectionControls
              projectId={projectId}
              host={host}
              facts={controller.projection.confirmedFacts}
              disabled={controller.pending || controller.stale}
              onRefresh={onRefresh}
            />
          ) : null}

          {active &&
          pipelineStage === "site_visit" &&
          !siteVisitActionProminent ? (
            <div
              className={styles.manualFact}
              data-manual-site-visit-fact="true"
            >
              <div>
                <strong>Manual site visit confirmation</strong>
                <p>
                  Book or confirm the visit in the direct Site Visits workflow.
                  Completion remains a separate manual fact.
                </p>
              </div>
              <div className={styles.inlineActions}>
                <ButtonLink
                  variant="secondary"
                  disabled={controller.stale}
                  size="small"
                  href={`/staff/schedule?view=site-visits&project=${encodeURIComponent(projectId)}`}
                >
                  Book or confirm site visit
                </ButtonLink>
                {siteVisitCompleted ? (
                  <Badge tone="success">Recorded complete</Badge>
                ) : (
                  <Button
                    variant="secondary"
                    size="small"
                    loading={controller.pending}
                    disabled={controller.stale}
                    onClick={() => void controller.recordSiteVisitCompleted()}
                  >
                    Record completion
                  </Button>
                )}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
