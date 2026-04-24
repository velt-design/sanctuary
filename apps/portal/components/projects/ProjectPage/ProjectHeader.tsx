'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useState } from 'react';
import type { ProjectPageSnapshot } from '@/lib/projects/types';
import legacy from '@/app/(portal)/staff/projects/projects.module.css';
import Modal from '@/components/ui/modal/Modal';
import { usePortalSession } from '@/components/auth/PortalAuthProvider';
import { useToast } from '@/components/ui/toast/ToastProvider';
import { deleteProject } from '@/lib/repo/projectsRepo';
import { PIPELINE_STAGE_LABELS } from '@/lib/projects/pipelineDefinition';
import styles from './ProjectPage.module.css';

const EXTRA_DELETE_CONFIRM_STAGES = new Set(['deposit', 'scheduled', 'completed', 'paid']);

function requiredDeleteConfirmation(projectId: string, stage: string): string {
  return EXTRA_DELETE_CONFIRM_STAGES.has(stage) ? `DELETE ${projectId}` : 'DELETE';
}

export default function ProjectHeader({
  project,
  currentStage,
  mode = 'expanded',
  pipeline,
}: {
  project: ProjectPageSnapshot['project'];
  currentStage: ProjectPageSnapshot['pipeline']['stage'];
  mode?: 'expanded' | 'compact';
  pipeline?: ReactNode;
}) {
  const router = useRouter();
  const toast = useToast();
  const { role } = usePortalSession();
  const isAdmin = role === 'admin';

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);

  const subtext = [project.contactName, project.region].filter(Boolean).join(' / ');
  const stageLabel = PIPELINE_STAGE_LABELS[currentStage] ?? String(currentStage);
  const requiredText = requiredDeleteConfirmation(project.id, currentStage);
  const isCompact = mode === 'compact';

  const closeDeleteModal = () => {
    if (deleteBusy) return;
    setDeleteOpen(false);
    setDeleteConfirmText('');
    setDeleteReason('');
  };

  return (
    <section className={styles.masthead} aria-label="Project summary" data-project-masthead-mode={mode}>
      <div className={styles.mastheadTop}>
        <div className={styles.mastheadIdentity}>
          <div className={styles.mastheadTitleRow}>
            <h1 className={styles.mastheadTitle}>{project.name}</h1>
            <span className={styles.mastheadStagePill}>{stageLabel}</span>
            {!isCompact && subtext ? <p className={styles.mastheadMeta}>{subtext}</p> : null}
          </div>
        </div>

        {!isCompact ? (
          <div className={styles.mastheadActions}>
            <Link href="/staff/projects" className={`${legacy.buttonSecondary} ${styles.mastheadAction}`}>
              Projects
            </Link>
            <Link
              href={`/staff/projects/${encodeURIComponent(project.id)}/design-workbench`}
              className={`${legacy.buttonSecondary} ${styles.mastheadAction}`}
            >
              Design Workbench
            </Link>
            {isAdmin ? (
              <button
                type="button"
                className={`${legacy.buttonDanger} ${styles.mastheadAction}`}
                onClick={() => {
                  setDeleteConfirmText('');
                  setDeleteReason('');
                  setDeleteOpen(true);
                }}
              >
                Delete project
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {!isCompact && pipeline ? <div className={styles.mastheadPipeline}>{pipeline}</div> : null}

      {deleteOpen ? (
        <Modal
          open
          ariaLabel="Delete project confirmation"
          onClose={closeDeleteModal}
          overlayClassName={legacy.modalOverlay}
          panelClassName={legacy.modal}
          maxWidthPx={560}
        >
          <div className={legacy.modalHeader}>
            <h2 className={legacy.modalTitle}>Delete project?</h2>
            <button type="button" className={legacy.modalClose} onClick={closeDeleteModal}>
              Close
            </button>
          </div>

          <p className={legacy.note}>This is a hard delete. Project data and linked records are permanently removed.</p>
          <p className={legacy.note} style={{ marginTop: 8 }}>
            Stage: <strong>{stageLabel}</strong>
          </p>
          <p className={legacy.note} style={{ marginTop: 8 }}>
            Type <strong>{requiredText}</strong> to confirm.
          </p>

          <div className={legacy.field} style={{ marginTop: 12 }}>
            <label htmlFor="header-delete-confirm">Confirmation</label>
            <input
              id="header-delete-confirm"
              className={legacy.inlineInput}
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              autoComplete="off"
            />
          </div>

          <div className={legacy.field} style={{ marginTop: 10 }}>
            <label htmlFor="header-delete-reason">Reason (optional)</label>
            <input
              id="header-delete-reason"
              className={legacy.inlineInput}
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
            />
          </div>

          <div className={legacy.modalFooter}>
            <button type="button" className={legacy.buttonSecondary} onClick={closeDeleteModal} disabled={deleteBusy}>
              Cancel
            </button>
            <button
              type="button"
              className={legacy.buttonDanger}
              disabled={deleteBusy || deleteConfirmText.trim().toUpperCase() !== requiredText.toUpperCase()}
              onClick={() => {
                if (deleteBusy) return;
                setDeleteBusy(true);
                void (async () => {
                  try {
                    await deleteProject(project.id, {
                      confirmText: deleteConfirmText.trim(),
                      reason: deleteReason.trim() || null,
                    });
                    toast.success('Project deleted.');
                    router.push('/staff/projects?toast=project_deleted');
                  } catch (err) {
                    const msg = err instanceof Error ? err.message : 'Failed to delete project';
                    toast.error(msg);
                  } finally {
                    setDeleteBusy(false);
                  }
                })();
              }}
            >
              {deleteBusy ? 'Deleting...' : 'Delete project'}
            </button>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
