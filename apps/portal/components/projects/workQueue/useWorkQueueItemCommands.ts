'use client';

import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  runProjectConfirmationCommand,
  runProjectWorkItemCommand,
  type ProjectWorkMutationResponse,
} from '@/lib/projects/workItems/client';
import {
  projectCommandIntent,
  StableCommandAttempt,
} from '@/lib/projects/workItems/stableCommandAttempt';
import { invalidateProjectWorkReads } from '@/lib/queries/projectWorkCache';
import type { WorkQueueEntryView } from './workQueuePresentation';

type WorkItemCommand = 'COMPLETE' | 'RESCHEDULE' | 'REASSIGN' | 'BLOCK' | 'UNBLOCK';

export function useWorkQueueItemCommands({
  entry,
  host,
  mutationsEnabled,
}: {
  entry: WorkQueueEntryView;
  host: string;
  mutationsEnabled: boolean;
}) {
  const queryClient = useQueryClient();
  const attempts = useRef(new StableCommandAttempt()).current;
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshReads = async () => {
    await invalidateProjectWorkReads(queryClient, host, entry.projectId);
  };

  const commit = async (
    label: string,
    command: string,
    payload: Record<string, unknown>,
    operation: (commandId: string) => Promise<ProjectWorkMutationResponse>,
  ) => {
    if (pendingAction || !mutationsEnabled) return false;
    const intent = projectCommandIntent(command, payload);
    setPendingAction(label);
    setMessage(null);
    setError(null);
    try {
      const result = await operation(attempts.commandIdFor(intent));
      attempts.committed(intent);
      await refreshReads();
      setMessage(result.command.replayed ? 'Already saved on the server.' : 'Saved on the server.');
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The project work could not be saved.');
      return false;
    } finally {
      setPendingAction(null);
    }
  };

  const workItemCommand = (
    label: string,
    command: WorkItemCommand,
    extra: Record<string, unknown> = {},
  ) => {
    if (!entry.workItemId || !entry.workItemRowVersion) return Promise.resolve(false);
    const payload = {
      workItemId: entry.workItemId,
      expectedRowVersion: entry.workItemRowVersion,
      ...extra,
    };
    return commit(label, command, payload, (commandId) =>
      runProjectWorkItemCommand(entry.projectId, {
        commandId,
        command,
        ...payload,
      }));
  };

  const confirmationCommand = (label: string, command: string) => {
    const payload = {
      ...(entry.subjectId ? { subjectId: entry.subjectId } : {}),
    };
    return commit(label, command, payload, (commandId) =>
      runProjectConfirmationCommand(entry.projectId, {
        commandId,
        command,
        ...payload,
      }));
  };

  return {
    pendingAction,
    message,
    error,
    clearFeedback() {
      setMessage(null);
      setError(null);
    },
    complete: () => workItemCommand('complete', 'COMPLETE'),
    reschedule: (dueAt: string, reason?: string) =>
      workItemCommand('reschedule', 'RESCHEDULE', {
        dueAt,
        ...(reason?.trim() ? { reason: reason.trim() } : {}),
      }),
    reassign: (assigneeUserId: string | null) =>
      workItemCommand('reassign', 'REASSIGN', { assigneeUserId }),
    block: (reason: string) =>
      workItemCommand('block', 'BLOCK', { reason: reason.trim() }),
    unblock: () => workItemCommand('unblock', 'UNBLOCK'),
    confirmSent: (command: string) => confirmationCommand('email-sent', command),
    confirmReply: (command: string) => confirmationCommand('customer-reply', command),
  };
}
