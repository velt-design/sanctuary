'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  runProjectConfirmationCommand,
  runProjectWorkItemCommand,
} from '@/lib/projects/workItems/client';
import type { ProjectWorkItem, ProjectWorkProjection } from '@/lib/projects/workItems/types';
import {
  projectCommandIntent,
  StableCommandAttempt,
} from '@/lib/projects/workItems/stableCommandAttempt';
import { projectOwnerOption } from '@/lib/projects/commandCentre/projectOwners';
import {
  invalidateProjectWorkReads,
  patchProjectWorkProjectionCaches,
} from '@/lib/queries/projectWorkCache';
import {
  AlertBanner,
  Badge,
  Button,
  EmptyState,
  TaskList,
  TaskRow,
} from '@/components/ui/foundation';
import styles from './ProjectTasksSidebar.module.css';

function dueLabel(value: string): string {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.valueOf())) return 'Due time unavailable';
  return new Intl.DateTimeFormat('en-NZ', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Pacific/Auckland',
  }).format(parsed);
}

function sentCommand(item: ProjectWorkItem): string | null {
  if (item.sourceKey?.startsWith('lead:first-email:')) return 'RECORD_FIRST_ENQUIRY_EMAIL_SENT';
  if (item.sourceKey?.startsWith('lead:follow-up:')) return 'RECORD_ENQUIRY_FOLLOW_UP_EMAIL_SENT';
  if (item.sourceKey?.startsWith('quote:follow-up:')) return 'RECORD_QUOTE_FOLLOW_UP_EMAIL_SENT';
  return null;
}

function isReviewItem(item: ProjectWorkItem): boolean {
  return item.sourceKey?.startsWith('lead:close-review:')
    || item.sourceKey?.startsWith('quote:outcome-review:')
    || false;
}

function assigneeLabel(item: ProjectWorkItem): string {
  if (item.effectiveAssignee.kind === 'staff') return 'Assigned staff';
  if (item.effectiveAssignee.kind === 'projectOwner') {
    return projectOwnerOption(item.effectiveAssignee.ownerKey)?.displayName ?? 'Project owner';
  }
  return 'Unassigned';
}

export default function ProjectWorkItemsSidebar({
  projectId,
  projectWork,
  host,
  stale,
}: {
  projectId: string;
  projectWork: ProjectWorkProjection;
  host: string;
  stale: boolean;
}) {
  const queryClient = useQueryClient();
  const commandAttempts = useRef(new StableCommandAttempt()).current;
  const [projection, setProjection] = useState(projectWork);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setProjection(projectWork), [projectWork]);

  const commit = async (
    item: ProjectWorkItem,
    action: 'sent' | 'reply' | 'complete',
  ) => {
    if (pendingId || stale) return;
    setPendingId(item.id);
    setMessage(null);
    setError(null);
    try {
      const command = action === 'complete'
        ? 'COMPLETE'
        : action === 'sent'
          ? sentCommand(item)
          : item.sourceType === 'QUOTE_CADENCE'
            ? 'RECORD_QUOTE_CUSTOMER_REPLY'
            : 'RECORD_ENQUIRY_CUSTOMER_REPLY';
      if (!command) throw new Error('This work item has no valid completion command.');
      const payload = action === 'complete'
        ? {
            command,
            workItemId: item.id,
            expectedRowVersion: item.rowVersion,
          }
        : {
            command,
            ...(item.subjectId ? { subjectId: item.subjectId } : {}),
          };
      const intent = projectCommandIntent(command, payload);
      const id = commandAttempts.commandIdFor(intent);
      const response = action === 'complete'
        ? await runProjectWorkItemCommand(projectId, {
            commandId: id,
            ...payload,
          })
        : await runProjectConfirmationCommand(projectId, {
            commandId: id,
            ...payload,
          });
      commandAttempts.committed(intent);
      if (response.projectWork) {
        setProjection(response.projectWork);
        patchProjectWorkProjectionCaches(
          queryClient,
          host,
          projectId,
          response.projectWork,
        );
      }
      await invalidateProjectWorkReads(queryClient, host, projectId);
      setMessage(response.command.replayed ? 'Already saved on the server.' : 'Saved on the server.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The work item could not be saved.');
    } finally {
      setPendingId(null);
    }
  };

  const items = [...projection.openItems, ...projection.blockedItems];

  return (
    <div className={styles.tasks} data-project-work-model="v2">
      <div className={styles.summary}>
        <Badge tone={projection.openItems.length ? 'warning' : 'success'}>
          {projection.openItems.length} open
        </Badge>
        {projection.blockedItems.length ? (
          <Badge tone="error">{projection.blockedItems.length} blocked</Badge>
        ) : null}
      </div>

      {message ? <AlertBanner tone="info" title="Project work updated">{message}</AlertBanner> : null}
      {error ? <AlertBanner tone="error" title="Project work not saved">{error}</AlertBanner> : null}
      {stale ? (
        <AlertBanner tone="warning" title="Work controls paused">
          Refresh the Overview before changing project work.
        </AlertBanner>
      ) : null}

      {items.length ? (
        <TaskList ariaLabel="Project work items">
          {items.map((item) => {
            const sendAction = sentCommand(item);
            const pending = pendingId === item.id;
            const blocked = item.status === 'BLOCKED';
            const cadence = item.sourceType === 'LEAD_CADENCE' || item.sourceType === 'QUOTE_CADENCE';
            const ownerLabel = assigneeLabel(item);
            const description = blocked
              ? `${item.blockedReason ?? 'This work is blocked.'} · ${ownerLabel}`
              : `${item.responsibilityArea.toLowerCase()} · ${ownerLabel} · Due ${dueLabel(item.dueAt)}`;
            return (
              <TaskRow
                key={item.id}
                checked={false}
                showControl={false}
                label={item.title}
                description={description}
                status={(
                  <div className={styles.summary}>
                    {item.priority === 'CRITICAL' ? <Badge tone="error">Critical</Badge> : null}
                    {blocked ? <Badge tone="error">Blocked</Badge> : null}
                    {!blocked && sendAction ? (
                      <Button
                        size="small"
                        disabled={Boolean(pendingId) || stale}
                        loading={pending}
                        onClick={() => void commit(item, 'sent')}
                      >
                        Email sent
                      </Button>
                    ) : null}
                    {!blocked && cadence ? (
                      <Button
                        size="small"
                        variant="secondary"
                        disabled={Boolean(pendingId) || stale}
                        onClick={() => void commit(item, 'reply')}
                      >
                        Customer replied
                      </Button>
                    ) : null}
                    {!blocked && item.sourceType === 'MANUAL' ? (
                      <Button
                        size="small"
                        disabled={Boolean(pendingId) || stale}
                        loading={pending}
                        onClick={() => void commit(item, 'complete')}
                      >
                        Complete
                      </Button>
                    ) : null}
                    {!blocked && isReviewItem(item) ? <Badge tone="warning">Decision required</Badge> : null}
                  </div>
                )}
              />
            );
          })}
        </TaskList>
      ) : (
        <EmptyState
          compact
          title="No current project work"
          description="The Project command shows the next specialist action or whether this project needs triage."
        />
      )}
    </div>
  );
}
