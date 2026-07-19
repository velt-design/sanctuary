'use client';

import { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Contact } from '@/lib/types/contact';
import type { Project } from '@/lib/types/project';
import { useToast } from '@/components/ui/toast/ToastProvider';
import {
  correctProjectIndexStage,
  saveProjectIndexInlineEdit,
  setProjectIndexArchived,
  type ProjectIndexEditableField,
  type ProjectIndexStageCorrection,
} from './projectsIndexMutations';

function withPendingKey(current: ReadonlySet<string>, key: string, pending: boolean): ReadonlySet<string> {
  const next = new Set(current);
  if (pending) next.add(key);
  else next.delete(key);
  return next;
}

function projectIndexCellKey(projectId: string, field: ProjectIndexEditableField): string {
  return `${projectId}:${field}`;
}

export function useProjectsIndexMutations(host: string) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [pendingCells, setPendingCells] = useState<ReadonlySet<string>>(() => new Set());
  const [pendingStages, setPendingStages] = useState<ReadonlySet<string>>(() => new Set());
  const [pendingArchives, setPendingArchives] = useState<ReadonlySet<string>>(() => new Set());

  const saveInlineEdit = useCallback(
    async (args: {
      project: Project;
      contact: Contact | null;
      field: ProjectIndexEditableField;
      value: string;
    }) => {
      const key = projectIndexCellKey(args.project.id, args.field);
      setPendingCells((current) => withPendingKey(current, key, true));
      try {
        await saveProjectIndexInlineEdit({ queryClient, host, ...args });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to save change.');
      } finally {
        setPendingCells((current) => withPendingKey(current, key, false));
      }
    },
    [host, queryClient, toast],
  );

  const correctStage = useCallback(
    async (project: Project, correction: ProjectIndexStageCorrection, label: string) => {
      setPendingStages((current) => withPendingKey(current, project.id, true));
      try {
        const result = await correctProjectIndexStage({ queryClient, host, project, correction });
        toast.success(
          result.rollback
            ? `Stage corrected to ${label}. Reset ${result.resetManualTaskCount} manual checkmark(s).`
            : `Stage corrected to ${label}.`,
        );
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to update stage.');
      } finally {
        setPendingStages((current) => withPendingKey(current, project.id, false));
      }
    },
    [host, queryClient, toast],
  );

  const setArchived = useCallback(
    async (project: Project, isArchived: boolean) => {
      setPendingArchives((current) => withPendingKey(current, project.id, true));
      try {
        await setProjectIndexArchived({ queryClient, host, project, isArchived });
        toast.success(isArchived ? 'Project archived.' : 'Project restored.');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to update archive state');
      } finally {
        setPendingArchives((current) => withPendingKey(current, project.id, false));
      }
    },
    [host, queryClient, toast],
  );

  return useMemo(
    () => ({
      saveInlineEdit,
      correctStage,
      setArchived,
      isCellPending: (projectId: string, field: ProjectIndexEditableField) =>
        pendingCells.has(projectIndexCellKey(projectId, field)),
      isStagePending: (projectId: string) => pendingStages.has(projectId),
      isArchivePending: (projectId: string) => pendingArchives.has(projectId),
    }),
    [correctStage, pendingArchives, pendingCells, pendingStages, saveInlineEdit, setArchived],
  );
}
