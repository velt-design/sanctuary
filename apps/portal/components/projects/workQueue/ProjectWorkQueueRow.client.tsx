'use client';

import Link from 'next/link';
import type { ProjectCommandStaffSummary } from '@/lib/projects/commandCentre/types';
import { normalizePipelineStageKey } from '@/lib/projects/pipelineDefinition';
import {
  Badge,
  Button,
  ButtonLink,
  ProjectStageBadge,
} from '@/components/ui/foundation';
import WorkQueueRowControls from './WorkQueueRowControls';
import ConfirmationReviewResolution from './ConfirmationReviewResolution.client';
import { useWorkQueueItemCommands } from './useWorkQueueItemCommands';
import {
  canManageQueueWorkItem,
  effectiveAssigneeLabel,
  isGenericCompletable,
  queueDueLabel,
  queueEntryReason,
  queueEntryStage,
  replyConfirmationCommand,
  sentConfirmationCommand,
  type WorkQueueEntryView,
} from './workQueuePresentation';
import styles from './ProjectWorkQueue.module.css';

function openLabel(entry: WorkQueueEntryView): string {
  if (
    entry.actionKind === 'recovery'
    && entry.subjectKind === 'CONFIRMATION_EVENT'
  ) {
    return 'Review project';
  }
  if (entry.actionKind === 'specialist' || entry.actionKind === 'recovery') return 'Open workspace';
  if (entry.actionKind === 'stateReview' || entry.actionKind === 'needsTriage') return 'Review project';
  return 'Open project';
}

export default function ProjectWorkQueueRow({
  entry,
  host,
  staff,
  mutationsEnabled,
  reassignmentEnabled,
}: {
  entry: WorkQueueEntryView;
  host: string;
  staff: ProjectCommandStaffSummary[];
  mutationsEnabled: boolean;
  reassignmentEnabled: boolean;
}) {
  const commands = useWorkQueueItemCommands({ entry, host, mutationsEnabled });
  const sentCommand = sentConfirmationCommand(entry);
  const replyCommand = replyConfirmationCommand(entry);
  const genericCompletable = isGenericCompletable(entry);
  const manageable = canManageQueueWorkItem(entry);
  const stage = normalizePipelineStageKey(queueEntryStage(entry));
  const owner = effectiveAssigneeLabel(entry, staff);
  const due = queueDueLabel(entry);
  const primaryBusy = Boolean(commands.pendingAction);
  const isConfirmationReview = (
    entry.actionKind === 'recovery'
    && entry.subjectKind === 'CONFIRMATION_EVENT'
  );

  return (
    <li
      className={styles.row}
      data-queue-group={entry.group}
      data-action-kind={entry.actionKind ?? 'UNKNOWN'}
    >
      <div className={styles.rowMain}>
        <div className={styles.project}>
          <Link href={entry.href} className={styles.projectLink}>{entry.projectName}</Link>
          <div className={styles.projectMeta}>
            {stage ? <ProjectStageBadge stage={stage} compact /> : null}
            <span>{owner}</span>
          </div>
        </div>

        <div className={styles.obligation}>
          <div className={styles.obligationTitle}>
            <strong>{entry.title}</strong>
            {entry.priority === 'CRITICAL' ? <Badge tone="error">Critical</Badge> : null}
          </div>
          <p>{queueEntryReason(entry)}</p>
        </div>

        <div className={styles.due} data-group={entry.group}>
          <span>When</span>
          <strong>{due}</strong>
        </div>

        <div className={styles.actions}>
          {sentCommand ? (
            <Button
              size="small"
              disabled={primaryBusy || !mutationsEnabled}
              loading={commands.pendingAction === 'email-sent'}
              onClick={() => void commands.confirmSent(sentCommand)}
            >
              Email sent
            </Button>
          ) : genericCompletable ? (
            <Button
              size="small"
              disabled={primaryBusy || !mutationsEnabled}
              loading={commands.pendingAction === 'complete'}
              onClick={() => void commands.complete()}
            >
              Complete
            </Button>
          ) : (
            <ButtonLink href={entry.href} size="small">{openLabel(entry)}</ButtonLink>
          )}
          {replyCommand ? (
            <Button
              size="small"
              variant="secondary"
              disabled={primaryBusy || !mutationsEnabled}
              loading={commands.pendingAction === 'customer-reply'}
              onClick={() => void commands.confirmReply(replyCommand)}
            >
              Customer replied
            </Button>
          ) : null}
        </div>
      </div>

      {manageable ? (
        <WorkQueueRowControls
          entry={entry}
          staff={staff}
          commands={commands}
          mutationsEnabled={mutationsEnabled}
          reassignmentEnabled={reassignmentEnabled}
        />
      ) : null}
      {isConfirmationReview
        && entry.repairSignalId
        && entry.repairSignalRowVersion ? (
        <ConfirmationReviewResolution
          projectId={entry.projectId}
          repairSignalId={entry.repairSignalId}
          expectedSignalRowVersion={entry.repairSignalRowVersion}
          host={host}
          disabled={!mutationsEnabled}
        />
      ) : null}

      {commands.message ? (
        <p className={styles.savedMessage} role="status">{commands.message}</p>
      ) : null}
      {commands.error ? (
        <div className={styles.errorMessage} role="alert">
          <span>{commands.error}</span>
          <Button size="small" variant="quiet" onClick={commands.clearFeedback}>Dismiss</Button>
        </div>
      ) : null}
    </li>
  );
}
