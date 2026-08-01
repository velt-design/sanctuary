"use client";

import { useEffect, useMemo, useState } from "react";
import { PipelineModal } from "@/components/ui/PipelineModal";
import { Button, Radio, Select, Textarea } from "@/components/ui/foundation";
import {
  PIPELINE_STAGE_LABELS,
  type PipelineStageKey,
} from "@/lib/projects/pipelineDefinition";
import { projectClosedOutcomeLabel } from "@/lib/projects/workItems/presentation";
import type { ProjectClosedOutcome } from "@/lib/projects/workItems/types";
import styles from "./ProjectCloseDialog.module.css";

const LOST_OUTCOMES = [
  "LOST_NO_RESPONSE",
  "LOST_BUDGET_PRICE",
  "LOST_OTHER_SUPPLIER",
  "LOST_TIMING_DEFERRED",
  "LOST_NOT_SUITABLE",
] as const satisfies readonly ProjectClosedOutcome[];

type ClosePath = "LOST" | "CANCELLED" | "COMPLETE";

type ProjectCloseInput = {
  outcome: ProjectClosedOutcome;
  note?: string;
  cancellationReason?: string;
};

function finalActionLabel(
  path: ClosePath | null,
  lostOutcome: ProjectClosedOutcome | "",
): string {
  if (path === "LOST" && lostOutcome) {
    return `Close as ${projectClosedOutcomeLabel(lostOutcome)}`;
  }
  if (path === "CANCELLED") return "Close as Cancelled";
  if (path === "COMPLETE") return "Close as Complete";
  return "Choose a close outcome";
}

export default function ProjectCloseDialog({
  open,
  stage,
  openWorkCount,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  stage: PipelineStageKey;
  openWorkCount: number;
  busy: boolean;
  onClose: () => void;
  onConfirm: (input: ProjectCloseInput) => Promise<boolean> | boolean;
}) {
  const [path, setPath] = useState<ClosePath | null>(null);
  const [lostOutcome, setLostOutcome] = useState<ProjectClosedOutcome | "">("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    setPath(null);
    setLostOutcome("");
    setReason("");
    setNote("");
  }, [open]);

  const requiresReason = path === "CANCELLED" || path === "COMPLETE";
  const outcome = useMemo<ProjectClosedOutcome | null>(() => {
    if (path === "LOST") return lostOutcome || null;
    if (path === "CANCELLED") return "CANCELLED";
    if (path === "COMPLETE") return "COMPLETE";
    return null;
  }, [lostOutcome, path]);
  const canConfirm = Boolean(
    !busy && outcome && (!requiresReason || reason.trim()),
  );
  const stageLabel = PIPELINE_STAGE_LABELS[stage] ?? stage;

  if (!open) return null;

  return (
    <PipelineModal
      open
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !busy) onClose();
      }}
      title="Close project"
      description="Choose the business outcome. This does not change the project stage."
      actions={
        <>
          <Button
            type="button"
            variant="destructive"
            fullWidth
            loading={busy}
            disabled={!canConfirm}
            onClick={() => {
              if (!canConfirm || !outcome) return;
              void Promise.resolve(
                onConfirm({
                  outcome,
                  note: note.trim() || undefined,
                  cancellationReason: requiresReason
                    ? reason.trim()
                    : undefined,
                }),
              ).then((saved) => {
                if (saved) onClose();
              });
            }}
          >
            {finalActionLabel(path, lostOutcome)}
          </Button>
          <Button
            type="button"
            variant="tertiary"
            fullWidth
            disabled={busy}
            onClick={onClose}
          >
            Keep project open
          </Button>
        </>
      }
      hint="Closing can be reversed later with Reopen project."
    >
      <div className={styles.content}>
        <fieldset className={styles.outcomes}>
          <legend>Why is this project closing?</legend>
          <Radio
            name="project-close-path"
            value="LOST"
            checked={path === "LOST"}
            disabled={busy}
            label="Lost"
            description="The enquiry or opportunity did not proceed."
            onChange={() => {
              setPath("LOST");
              setReason("");
            }}
          />
          <Radio
            name="project-close-path"
            value="CANCELLED"
            checked={path === "CANCELLED"}
            disabled={busy}
            label="Cancelled"
            description="Work was stopped after it had been accepted or planned."
            onChange={() => {
              setPath("CANCELLED");
              setLostOutcome("");
            }}
          />
          <Radio
            name="project-close-path"
            value="COMPLETE"
            checked={path === "COMPLETE"}
            disabled={busy}
            label="Complete"
            description="All expected project delivery is finished."
            onChange={() => {
              setPath("COMPLETE");
              setLostOutcome("");
            }}
          />
        </fieldset>

        {path === "LOST" ? (
          <Select
            id="project-lost-outcome"
            label="Lost outcome"
            value={lostOutcome}
            disabled={busy}
            onChange={(event) =>
              setLostOutcome(event.target.value as ProjectClosedOutcome | "")
            }
          >
            <option value="">Choose the outcome</option>
            {LOST_OUTCOMES.map((item) => (
              <option key={item} value={item}>
                {projectClosedOutcomeLabel(item).replace(/^Lost - /, "")}
              </option>
            ))}
          </Select>
        ) : null}

        {requiresReason ? (
          <Textarea
            id="project-close-reason"
            label="Reason"
            helperText="Required for Cancelled and Complete."
            value={reason}
            maxLength={500}
            disabled={busy}
            onChange={(event) => setReason(event.target.value)}
          />
        ) : null}

        {path ? (
          <Textarea
            id="project-close-note"
            label="Additional note (optional)"
            value={note}
            maxLength={1000}
            disabled={busy}
            onChange={(event) => setNote(event.target.value)}
          />
        ) : null}

        <section className={styles.consequences} aria-labelledby="close-effects-title">
          <h3 id="close-effects-title">What will happen</h3>
          <ul>
            <li>The project stays at the {stageLabel} stage.</li>
            <li>
              {openWorkCount === 0
                ? "No remaining Project Work needs to be cancelled."
                : `${openWorkCount} open or blocked Project Work item${openWorkCount === 1 ? "" : "s"} will be cancelled safely.`}
            </li>
            <li>The project leaves the active Work Queue.</li>
            <li>No customer message is sent.</li>
          </ul>
          {path === "COMPLETE" ? (
            <p>
              The server will reject Complete if required schedule or payment
              conditions are not satisfied.
            </p>
          ) : null}
        </section>
      </div>
    </PipelineModal>
  );
}
