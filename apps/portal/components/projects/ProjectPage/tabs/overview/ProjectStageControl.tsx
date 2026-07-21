'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/toast/ToastProvider';
import { PIPELINE_MODAL_ACTION_CLASSES, PipelineModal } from '@/components/ui/PipelineModal';
import legacy from '@/app/staff/projects/projects.module.css';
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
        <button
          type="button"
          onClick={() => {
            setTargetStage(stage);
            setOpen(true);
          }}
        >
          Change stage
        </button>
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
              <button
                type="button"
                className={PIPELINE_MODAL_ACTION_CLASSES.primary}
                disabled={busy || targetStage === stage || (rollback && confirmText.trim().toUpperCase() !== 'RESET')}
                onClick={() => void apply()}
              >
                {busy ? 'Applying...' : `Move to ${targetLabel}`}
              </button>
              <button
                type="button"
                className={PIPELINE_MODAL_ACTION_CLASSES.secondary}
                disabled={busy}
                onClick={close}
              >
                Cancel
              </button>
            </>
          }
        >
          <div className={legacy.field}>
            <label htmlFor="project-stage-target">New stage</label>
            <select
              id="project-stage-target"
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
            </select>
          </div>

          <p className={legacy.note} style={{ marginTop: 10 }}>
            Silent correction only: this does not trigger automations or customer communications.
          </p>

          {rollback ? (
            <div className={legacy.field} style={{ marginTop: 10 }}>
              <label htmlFor="project-stage-reset">Type RESET to confirm rollback</label>
              <input
                id="project-stage-reset"
                value={confirmText}
                disabled={busy}
                autoComplete="off"
                onChange={(event) => setConfirmText(event.target.value)}
              />
            </div>
          ) : null}

          <div className={legacy.field} style={{ marginTop: 10 }}>
            <label htmlFor="project-stage-reason">Reason (optional)</label>
            <input
              id="project-stage-reason"
              value={reason}
              disabled={busy}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        </PipelineModal>
      ) : null}
    </>
  );
}
