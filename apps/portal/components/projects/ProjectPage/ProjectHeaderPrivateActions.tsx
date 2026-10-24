'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { usePortalSession } from '@/components/auth/PortalAuthProvider';
import { useToast } from '@/components/ui/toast/ToastProvider';
import {
  DestructiveConfirmation,
  Input,
  OverflowMenu,
} from '@/components/ui/foundation';
import { deleteProject } from '@/lib/repo/projectsRepo';
import type { ProjectPageSnapshot } from '@/lib/projects/types';
const EXTRA_DELETE_CONFIRM_STAGES = new Set(['deposit', 'scheduled', 'completed', 'paid']);

function requiredDeleteConfirmation(projectId: string, stage: string): string {
  return EXTRA_DELETE_CONFIRM_STAGES.has(stage) ? `DELETE ${projectId}` : 'DELETE';
}

export default function PrivateProjectHeaderActions({ project, projectId = project?.id ?? '', disabled = false }: { project: ProjectPageSnapshot['project'] | null; projectId?: string; disabled?: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const { role } = usePortalSession();
  const isAdmin = role === 'admin';
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);

  const requiredText = project ? requiredDeleteConfirmation(project.id, project.stage) : 'DELETE';

  const closeDeleteModal = () => {
    if (deleteBusy) return;
    setDeleteOpen(false);
    setDeleteConfirmText('');
    setDeleteReason('');
  };

  const openDeleteModal = () => {
    if (disabled || !project) return;
    setDeleteConfirmText('');
    setDeleteReason('');
    setDeleteOpen(true);
  };

  return (
    <>
      {isAdmin ? (
        <OverflowMenu
          label="More"
          menuLabel="Project actions"
          visibleLabel
          items={[{
            label: 'Delete project',
            disabled: !project,
            icon: <Trash2 aria-hidden="true" />,
            destructive: true,
            onSelect: openDeleteModal,
          }]}
        />
      ) : null}

      <DestructiveConfirmation
        open={deleteOpen && Boolean(project)}
        title="Delete project?"
        description="Project data and linked records will be permanently removed."
        confirmationText={requiredText}
        value={deleteConfirmText}
        onValueChange={setDeleteConfirmText}
        pending={deleteBusy}
        onCancel={closeDeleteModal}
        consequences="This is a hard delete and cannot be recovered."
        additionalContent={(
          <Input
            id="header-delete-reason"
            label="Reason (optional)"
            value={deleteReason}
            onChange={(event) => setDeleteReason(event.target.value)}
            disabled={deleteBusy}
          />
        )}
        onConfirm={() => {
          if (disabled || !project || deleteBusy || deleteConfirmText.trim().toUpperCase() !== requiredText.toUpperCase()) return;
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
      />
    </>
  );
}
