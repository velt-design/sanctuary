'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/toast/ToastProvider';
import { PipelineModal } from '@/components/ui/PipelineModal';
import { AlertBanner, Button, Input, Select } from '@/components/ui/foundation';
import {
  PIPELINE_STAGES,
  PIPELINE_STAGE_LABELS,
  stageKeyToStatus,
} from '@/lib/projects/pipelineDefinition';
import type { ProjectStage } from '@/lib/projects/types';
import { correctProjectStage } from '@/lib/repo/projectsRepo';
import { invalidateProjectReadCaches, patchProjectListItem, patchProjectSnapshot } from '@/lib/queries/projectCache';
import styles from './ProjectStatusDetailsCard.module.css';

const STAGE_ORDER = PIPELINE_STAGES.map((stage) => stage.key);

export default function ProjectStageControl({
  projectId,
  host,
  stage,
}: {
  projectId: string;
  host: string;
  stage: ProjectStage;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [targetStage, setTargetStage] = useState<ProjectStage>(stage);
  const [confirmText, setConfirmText] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const currentIndex = STAGE_ORDER.indexOf(stage);
  const targetIndex = STAGE_ORDER.indexOf(targetStage);
  const rollback = currentIndex >= 0 && targetIndex >= 0 && targetIndex < currentIndex;
  const stageLabel = PIPELINE_STAGE_LABELS[stage] ?? stage;
  const targetLabel = PIPELINE_STAGE_LABELS[targetStage] ?? targetStage;

  const close = () => {
    if (busy) return;
    setOpen(false);
    setTargetStage(stage);
    setConfirmText('');
    setReason('');
  };

  const apply = async () => {
    if (busy || targetStage === stage) return;
    setBusy(true);
    try {
      const result = await correctProjectStage(projectId, stageKeyToStatus(targetStage), {
        reason: reason.trim() || null,
      });
      patchProjectSnapshot(queryClient, host, projectId, (current) => {
        if (!current) return current;
        return {
          ...current,
          generatedAt: new Date().toISOString(),
          snapshot: {
            ...current.snapshot,
            project: { ...current.snapshot.project, stage: targetStage },
            pipeline: { stage: targetStage },
            tasks: { ...current.snapshot.tasks, stage: targetStage },
          },
        };
      });
      patchProjectListItem(queryClient, host, projectId, (project) => ({
        ...project,
        status: stageKeyToStatus(targetStage),
      }));
      void invalidateProjectReadCaches(queryClient, host, projectId);
      toast.success(result.rollback
        ? `Stage corrected to ${targetLabel}. Reset ${result.resetManualTaskCount} manual checkmark(s).`
        : `Stage corrected to ${targetLabel}.`);
      setOpen(false);
      setConfirmText('');
      setReason('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to correct stage');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className={styles.stageControl}>
        <div>
          <span>Pipeline stage</span>
          <strong data-project-stage={stage}>{stageLabel}</strong>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="small"
          onClick={() => {
            setTargetStage(stage);
            setOpen(true);
          }}
        >
          Change stage
        </Button>
      </div>

      {open ? (
        <PipelineModal
          open
          onOpenChange={(nextOpen) => {
            if (!nextOpen) close();
          }}
          title="Change project stage"
          description={`Current stage: ${stageLabel}.`}
          actions={
            <>
              <Button
                type="button"
                fullWidth
                disabled={busy || targetStage === stage || (rollback && confirmText.trim().toUpperCase() !== 'RESET')}
                loading={busy}
                onClick={() => void apply()}
              >
                {`Move to ${targetLabel}`}
              </Button>
              <Button
                type="button"
                variant="tertiary"
                fullWidth
                disabled={busy}
                onClick={close}
              >
                Cancel
              </Button>
            </>
          }
        >
          <Select
            id="project-stage-target"
            label="New stage"
            value={targetStage}
            disabled={busy}
            onChange={(event) => {
              setTargetStage(event.target.value as ProjectStage);
              setConfirmText('');
            }}
          >
            {PIPELINE_STAGES.map((option) => (
              <option key={option.key} value={option.key}>{option.label}</option>
            ))}
          </Select>

          <AlertBanner tone="info" title="Silent correction">
            Silent correction only: this does not trigger automations or customer communications.
          </AlertBanner>

          {rollback ? (
            <Input
              id="project-stage-reset"
              label="Type RESET to confirm rollback"
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
            onChange={(event) => setReason(event.target.value)}
          />
        </PipelineModal>
      ) : null}
    </>
  );
}
