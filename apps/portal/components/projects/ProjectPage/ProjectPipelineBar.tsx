'use client';

import { useMemo, useState } from 'react';
import type { ProjectStage } from '@/lib/projects/types';
import { PIPELINE_STAGES, PIPELINE_STAGE_LABELS, stageKeyToStatus } from '@/lib/projects/pipelineDefinition';
import { correctProjectStage } from '@/lib/repo/projectsRepo';
import { usePortalSession } from '@/components/auth/PortalAuthProvider';
import { useToast } from '@/components/ui/toast/ToastProvider';
import { useQueryClient } from '@tanstack/react-query';
import { PIPELINE_MODAL_ACTION_CLASSES, PipelineModal } from '@/components/ui/PipelineModal';
import legacy from '@/app/staff/projects/projects.module.css';
import { invalidateProjectReadCaches, patchProjectListItem, patchProjectSnapshot } from '@/lib/queries/projectCache';
import { supabaseHostFromUrl, supabaseRuntimeUrl } from '@/lib/supabase/browserClient';
import LegacyChevronPipeline from '@/components/projects/legacyStyle/LegacyChevronPipeline';

type StageConfirmState = {
  next: ProjectStage;
  label: string;
};

export default function ProjectPipelineBar({ projectId, stage }: { projectId: string; stage: ProjectStage }) {
  const toast = useToast();
  const { role } = usePortalSession();
  const isAdmin = role === 'admin';
  const queryClient = useQueryClient();
  const hostKey = supabaseHostFromUrl(supabaseRuntimeUrl()) || 'unknown';

  const [confirm, setConfirm] = useState<StageConfirmState | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const stageOrder = useMemo(() => PIPELINE_STAGES.map((item) => item.key), []);
  const currentIndex = stageOrder.indexOf(stage);
  const nextIndex = confirm ? stageOrder.indexOf(confirm.next) : -1;
  const rollback = Boolean(confirm && currentIndex !== -1 && nextIndex !== -1 && nextIndex < currentIndex);
  const currentLabel = PIPELINE_STAGE_LABELS[stage] ?? String(stage);

  return (
    <section className={legacy.section} aria-label="Pipeline">
      <div className={legacy.sectionHeader}>
        <h2 className={legacy.sectionTitle}>Pipeline</h2>
      </div>
      <div className={legacy.sectionBody}>
        <LegacyChevronPipeline
          stage={stage}
          disabled={busy}
          onRequestChange={
            isAdmin
              ? (next, label) => {
                  setConfirm({ next, label });
                  setConfirmText('');
                  setReason('');
                }
              : undefined
          }
        />
      </div>

      {confirm ? (
        <PipelineModal
          open
          onOpenChange={(open) => {
            if (!open && !busy) {
              setConfirm(null);
              setConfirmText('');
              setReason('');
            }
          }}
          title="Correct stage (admin)"
          description={`Correct from ${currentLabel} to ${confirm.label}.`}
          actions={
            <>
              <button
                type="button"
                className={PIPELINE_MODAL_ACTION_CLASSES.primary}
                disabled={busy || (rollback && confirmText.trim().toUpperCase() !== 'RESET')}
                onClick={() => {
                  if (busy || !confirm) return;
                  setBusy(true);
                  void (async () => {
                    try {
                      const result = await correctProjectStage(projectId, stageKeyToStatus(confirm.next), {
                        reason: reason.trim() || null,
                      });
                      if (result.rollback) {
                        toast.success(`Stage corrected to ${confirm.label}. Reset ${result.resetManualTaskCount} manual checkmark(s).`);
                      } else {
                        toast.success(`Stage corrected to ${confirm.label}.`);
                      }
                      patchProjectSnapshot(queryClient, hostKey, projectId, (current) => {
                        if (!current) return current;
                        return {
                          ...current,
                          generatedAt: new Date().toISOString(),
                          snapshot: {
                            ...current.snapshot,
                            project: { ...current.snapshot.project, stage: confirm.next },
                            pipeline: { stage: confirm.next },
                            tasks: { ...current.snapshot.tasks, stage: confirm.next },
                          },
                        };
                      });
                      patchProjectListItem(queryClient, hostKey, projectId, (project) => ({
                        ...project,
                        status: stageKeyToStatus(confirm.next),
                      }));
                      setConfirm(null);
                      setConfirmText('');
                      setReason('');
                      void invalidateProjectReadCaches(queryClient, hostKey, projectId);
                    } catch (err) {
                      const msg = err instanceof Error ? err.message : 'Failed to correct stage';
                      toast.error(msg);
                    } finally {
                      setBusy(false);
                    }
                  })();
                }}
              >
                {busy ? 'Applying...' : `Move to ${confirm.label}`}
              </button>
              <button
                type="button"
                className={PIPELINE_MODAL_ACTION_CLASSES.secondary}
                disabled={busy}
                onClick={() => {
                  if (busy) return;
                  setConfirm(null);
                  setConfirmText('');
                  setReason('');
                }}
              >
                Cancel
              </button>
            </>
          }
        >
          <p className={legacy.note}>Silent correction only: this does not trigger automations or customer comms.</p>

          {rollback ? (
            <>
              <p className={legacy.note} style={{ marginTop: 10 }}>
                Rollback: manual task checkmarks from this stage and later stages will be reset.
              </p>
              <div className={legacy.field} style={{ marginTop: 10 }}>
                <label htmlFor="stage-correct-confirm-text">Type RESET to confirm rollback</label>
                <input
                  id="stage-correct-confirm-text"
                  className={legacy.inlineInput}
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  autoComplete="off"
                />
              </div>
            </>
          ) : null}

          <div className={legacy.field} style={{ marginTop: 10 }}>
            <label htmlFor="stage-correct-reason">Reason (optional)</label>
            <input
              id="stage-correct-reason"
              className={legacy.inlineInput}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </PipelineModal>
      ) : null}
    </section>
  );
}
