"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { Button } from "@/components/ui/foundation";
import ProjectStageCorrectionDialog, {
  type ProjectStageCorrectionInput,
} from "@/components/projects/ProjectStageCorrectionDialog";
import {
  PIPELINE_STAGE_LABELS,
  stageKeyToStatus,
} from "@/lib/projects/pipelineDefinition";
import type { ProjectStage } from "@/lib/projects/types";
import { correctProjectStage } from "@/lib/repo/projectsRepo";
import {
  invalidateProjectReadCaches,
  patchProjectListItem,
  patchProjectSnapshot,
} from "@/lib/queries/projectCache";
import styles from "./ProjectStatusDetailsCard.module.css";

export default function ProjectStageControl({
  projectId,
  host,
  stage,
  presentation = "status",
}: {
  projectId: string;
  host: string;
  stage: ProjectStage;
  presentation?: "status" | "action-only";
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const stageLabel = PIPELINE_STAGE_LABELS[stage] ?? stage;

  const close = () => {
    if (busy) return;
    setOpen(false);
  };

  const apply = async ({
    nextStage,
    reason,
  }: ProjectStageCorrectionInput): Promise<boolean> => {
    if (busy || nextStage === stage) return false;
    const targetLabel = PIPELINE_STAGE_LABELS[nextStage] ?? nextStage;
    setBusy(true);
    try {
      await correctProjectStage(
        projectId,
        stageKeyToStatus(nextStage),
        { reason },
      );
      patchProjectSnapshot(queryClient, host, projectId, (current) => {
        if (!current) return current;
        return {
          ...current,
          generatedAt: new Date().toISOString(),
          snapshot: {
            ...current.snapshot,
            project: { ...current.snapshot.project, stage: nextStage },
            pipeline: { stage: nextStage },
          },
        };
      });
      patchProjectListItem(queryClient, host, projectId, (project) => ({
        ...project,
        status: stageKeyToStatus(nextStage),
      }));
      void invalidateProjectReadCaches(queryClient, host, projectId);
      toast.success(`Stage corrected to ${targetLabel}.`);
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to correct stage",
      );
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div
        className={
          presentation === "action-only"
            ? styles.stageActionOnly
            : styles.stageControl
        }
        data-stage-control-presentation={presentation}
      >
        {presentation === "status" ? (
          <div>
            <span>Pipeline stage</span>
            <strong data-project-stage={stage}>{stageLabel}</strong>
          </div>
        ) : null}
        <Button
          type="button"
          variant="secondary"
          size="small"
          onClick={() => setOpen(true)}
        >
          Correct stage
        </Button>
      </div>

      <ProjectStageCorrectionDialog
        open={open}
        currentStage={stage}
        busy={busy}
        onClose={close}
        onApply={apply}
      />
    </>
  );
}
