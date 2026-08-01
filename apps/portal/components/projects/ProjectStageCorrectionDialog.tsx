"use client";

import { useEffect, useMemo, useState } from "react";
import { PipelineModal } from "@/components/ui/PipelineModal";
import { AlertBanner, Button, Input, Select } from "@/components/ui/foundation";
import {
  PIPELINE_STAGES,
  PIPELINE_STAGE_LABELS,
  type PipelineStageKey,
} from "@/lib/projects/pipelineDefinition";
import styles from "./ProjectStageCorrectionDialog.module.css";

export type ProjectStageCorrectionInput = {
  nextStage: PipelineStageKey;
  reason: string | null;
};

export default function ProjectStageCorrectionDialog({
  open,
  currentStage,
  busy,
  onClose,
  onApply,
}: {
  open: boolean;
  currentStage: PipelineStageKey;
  busy: boolean;
  onClose: () => void;
  onApply: (input: ProjectStageCorrectionInput) => Promise<boolean> | boolean;
}) {
  const [targetStage, setTargetStage] = useState<PipelineStageKey>(currentStage);
  const [confirmText, setConfirmText] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!open) return;
    setTargetStage(currentStage);
    setConfirmText("");
    setReason("");
  }, [currentStage, open]);

  const currentIndex = useMemo(
    () => PIPELINE_STAGES.findIndex((stage) => stage.key === currentStage),
    [currentStage],
  );
  const targetIndex = useMemo(
    () => PIPELINE_STAGES.findIndex((stage) => stage.key === targetStage),
    [targetStage],
  );
  const rollback =
    currentIndex >= 0 && targetIndex >= 0 && targetIndex < currentIndex;
  const stageLabel = PIPELINE_STAGE_LABELS[currentStage] ?? currentStage;
  const targetLabel = PIPELINE_STAGE_LABELS[targetStage] ?? targetStage;
  const canApply =
    !busy &&
    targetStage !== currentStage &&
    (!rollback || confirmText.trim().toUpperCase() === "RESET");

  if (!open) return null;

  return (
    <PipelineModal
      open
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !busy) onClose();
      }}
      title="Correct project stage"
      description={`Current stage: ${stageLabel}.`}
      actions={
        <>
          <Button
            type="button"
            fullWidth
            disabled={!canApply}
            loading={busy}
            onClick={() => {
              if (!canApply) return;
              void Promise.resolve(
                onApply({
                  nextStage: targetStage,
                  reason: reason.trim() || null,
                }),
              ).then((saved) => {
                if (saved) onClose();
              });
            }}
          >
            {`Correct to ${targetLabel}`}
          </Button>
          <Button
            type="button"
            variant="tertiary"
            fullWidth
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </Button>
        </>
      }
    >
      <div className={styles.content}>
        <Select
          id="project-stage-target"
          label="Correct stage to"
          value={targetStage}
          disabled={busy}
          onChange={(event) => {
            setTargetStage(event.target.value as PipelineStageKey);
            setConfirmText("");
          }}
        >
          {PIPELINE_STAGES.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </Select>

        <AlertBanner tone="info" title="Project Work will be recalculated">
          No customer email is sent. The server replaces the previous stage
          review for the corrected stage when appropriate and preserves
          stronger customer, commercial, design, confirmation, and specialist
          work.
        </AlertBanner>

        {rollback ? (
          <Input
            id="project-stage-reset"
            label="Type RESET to confirm moving backwards"
            value={confirmText}
            disabled={busy}
            autoComplete="off"
            onChange={(event) => setConfirmText(event.target.value)}
          />
        ) : null}

        <Input
          id="project-stage-reason"
          label="Reason (optional)"
          value={reason}
          disabled={busy}
          maxLength={500}
          onChange={(event) => setReason(event.target.value)}
        />
      </div>
    </PipelineModal>
  );
}
