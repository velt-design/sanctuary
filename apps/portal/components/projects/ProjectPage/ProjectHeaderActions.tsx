'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import ProjectsIndexLink from '@/components/navigation/ProjectsIndexLink';
import Modal from '@/components/ui/modal/Modal';
import { usePortalSession } from '@/components/auth/PortalAuthProvider';
import { useToast } from '@/components/ui/toast/ToastProvider';
import { deleteProject } from '@/lib/repo/projectsRepo';
import type { ProjectPageSnapshot } from '@/lib/projects/types';
import { PIPELINE_STAGE_LABELS } from '@/lib/projects/pipelineDefinition';
import legacy from '@/app/staff/projects/projects.module.css';
import styles from './ProjectPage.module.css';

const EXTRA_DELETE_CONFIRM_STAGES = new Set(['deposit', 'scheduled', 'completed', 'paid']);

function requiredDeleteConfirmation(projectId: string, stage: string): string {
  return EXTRA_DELETE_CONFIRM_STAGES.has(stage) ? `DELETE ${projectId}` : 'DELETE';
}

export default function ProjectHeaderActions({ project }: { project: ProjectPageSnapshot['project'] }) {
  const router = useRouter();
  const toast = useToast();
  const { role } = usePortalSession();
  const isAdmin = role === 'admin';
  const moreButtonRef = useRef<HTMLButtonElement | null>(null);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);

  const stageLabel = PIPELINE_STAGE_LABELS[project.stage] ?? String(project.stage);
  const requiredText = requiredDeleteConfirmation(project.id, project.stage);

  useEffect(() => {
    if (!moreOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (moreMenuRef.current?.contains(target) || moreButtonRef.current?.contains(target)) return;
      setMoreOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMoreOpen(false);
      moreButtonRef.current?.focus();
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [moreOpen]);

  const openMoreMenu = () => {
    setMoreOpen(true);
    window.requestAnimationFrame(() => {
      const preferredAction = typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 760px)').matches
        ? 'workbench'
        : isAdmin
          ? 'delete'
          : 'workbench';
      const menu = moreMenuRef.current;
      const preferredItem = menu?.querySelector<HTMLElement>(`[data-project-header-menuitem="${preferredAction}"]`);
      (preferredItem ?? menu?.querySelector<HTMLElement>('[role="menuitem"]'))?.focus();
    });
  };

  const closeDeleteModal = () => {
    if (deleteBusy) return;
    setDeleteOpen(false);
    setDeleteConfirmText('');
    setDeleteReason('');
  };

  const openDeleteModal = () => {
    setMoreOpen(false);
    setDeleteConfirmText('');
    setDeleteReason('');
    setDeleteOpen(true);
  };

  return (
    <div className={styles.mastheadActions}>
      <ProjectsIndexLink href="/staff/projects" className={`${legacy.buttonSecondary} ${styles.mastheadAction}`}>
        <span aria-hidden="true">&larr; </span>Projects
      </ProjectsIndexLink>
      <Link
        href={`/staff/projects/${encodeURIComponent(project.id)}/design-workbench`}
        className={`${legacy.buttonSecondary} ${styles.mastheadAction} ${styles.mastheadWorkbenchAction}`}
      >
        Design Workbench
      </Link>
      <button
        ref={moreButtonRef}
        type="button"
        className={`${legacy.buttonSecondary} ${styles.mastheadAction} ${styles.mastheadMoreAction}${isAdmin ? '' : ` ${styles.mastheadMoreActionMobileOnly}`}`}
        aria-haspopup="menu"
        aria-expanded={moreOpen}
        aria-controls="project-header-more-menu"
        onClick={() => {
          if (moreOpen) setMoreOpen(false);
          else openMoreMenu();
        }}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowDown' || moreOpen) return;
          event.preventDefault();
          openMoreMenu();
        }}
      >
        More
      </button>

      {moreOpen ? (
        <div
          ref={moreMenuRef}
          id="project-header-more-menu"
          className={styles.mastheadMoreMenu}
          role="menu"
          aria-label="Project actions"
        >
          <Link
            href={`/staff/projects/${encodeURIComponent(project.id)}/design-workbench`}
            className={styles.mastheadMoreMenuWorkbench}
            role="menuitem"
            data-project-header-menuitem="workbench"
            onClick={() => setMoreOpen(false)}
          >
            Design Workbench
          </Link>
          {isAdmin ? (
            <button
              type="button"
              role="menuitem"
              className={styles.mastheadMoreMenuDanger}
              data-project-header-menuitem="delete"
              onClick={openDeleteModal}
            >
              Delete project
            </button>
          ) : null}
        </div>
      ) : null}

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
              onChange={(event) => setDeleteConfirmText(event.target.value)}
              autoComplete="off"
            />
          </div>

          <div className={legacy.field} style={{ marginTop: 10 }}>
            <label htmlFor="header-delete-reason">Reason (optional)</label>
            <input
              id="header-delete-reason"
              className={legacy.inlineInput}
              value={deleteReason}
              onChange={(event) => setDeleteReason(event.target.value)}
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
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : 'Failed to delete project');
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
    </div>
  );
}
