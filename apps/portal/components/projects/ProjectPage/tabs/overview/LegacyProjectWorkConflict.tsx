"use client";

import type { ProjectCommandCentreOperations } from "@/lib/projects/commandCentre/types";
import { AlertBanner, Button, Select } from "@/components/ui/foundation";
import type { LegacyProjectWorkCommandController } from "./useLegacyProjectWorkCommandController";
import styles from "./ProjectPrimaryActionCard.module.css";

export default function LegacyProjectWorkConflict({
  operations,
  controller,
}: {
  operations: ProjectCommandCentreOperations;
  controller: LegacyProjectWorkCommandController;
}) {
  if (controller.legacyReviewRequired) {
    return (
      <div data-legacy-work-review="true">
        <AlertBanner tone="blocking" title="Legacy work needs review">
          A prohibited legacy action is server-selected or affects selection. It
          stays hidden and no browser replacement is chosen.
        </AlertBanner>
      </div>
    );
  }

  if (!operations.selectionConflict) return null;

  return (
    <div data-action-conflict="true">
      <AlertBanner tone="blocking" title="Primary-action review required">
        <p>
          {operations.selectionConflict.challenger.title} now outranks the
          selected action.
        </p>
        {operations.permissions.canResolveConflict ? (
          <div className={styles.inlineActions}>
            <Button
              variant="secondary"
              size="small"
              disabled={controller.disabled}
              onClick={() =>
                controller.current &&
                void controller.executeCommand({
                  command: "resolve_conflict",
                  resolution: "keep_current",
                  ...controller.actionRef(controller.current),
                })
              }
            >
              Keep current
            </Button>
            <Select
              label="Outranking action"
              value={
                controller.conflictCandidateKey ||
                (controller.conflictCandidate
                  ? `${controller.conflictCandidate.sourceKind}:${controller.conflictCandidate.sourceId}`
                  : "")
              }
              disabled={controller.disabled}
              onChange={(event) =>
                controller.setConflictCandidateKey(event.target.value)
              }
            >
              {controller.visibleConflictCandidates.map((candidate) => (
                <option
                  key={`${candidate.sourceKind}:${candidate.sourceId}`}
                  value={`${candidate.sourceKind}:${candidate.sourceId}`}
                >
                  {candidate.title}
                </option>
              ))}
            </Select>
            <Button
              size="small"
              disabled={controller.disabled || !controller.conflictCandidate}
              onClick={() =>
                controller.conflictCandidate &&
                void controller.executeCommand({
                  command: "resolve_conflict",
                  resolution: "select_candidate",
                  ...controller.actionRef(controller.conflictCandidate),
                })
              }
            >
              Use selected action
            </Button>
          </div>
        ) : (
          <p>
            An admin must resolve this. You can still complete the current
            action.
          </p>
        )}
      </AlertBanner>
    </div>
  );
}
