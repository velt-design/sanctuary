'use client';

import { useEffect, useState } from 'react';
import type { ProjectCommandStaffSummary } from '@/lib/projects/commandCentre/types';
import { Button, Input, Select, Textarea } from '@/components/ui/foundation';
import type { WorkQueueEntryView } from './workQueuePresentation';
import {
  aucklandLocalDateTimeToIso,
  toLocalDateTimeValue,
} from './workQueuePresentation';
import { useWorkQueueItemCommands } from './useWorkQueueItemCommands';
import styles from './ProjectWorkQueue.module.css';

export default function WorkQueueRowControls({
  entry,
  staff,
  commands,
  mutationsEnabled,
  reassignmentEnabled,
}: {
  entry: WorkQueueEntryView;
  staff: ProjectCommandStaffSummary[];
  commands: ReturnType<typeof useWorkQueueItemCommands>;
  mutationsEnabled: boolean;
  reassignmentEnabled: boolean;
}) {
  const [dueAt, setDueAt] = useState(() => toLocalDateTimeValue(entry.dueAt));
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [assignee, setAssignee] = useState(
    entry.effectiveAssignee.kind === 'staff' ? entry.effectiveAssignee.userId : '',
  );
  const [blockedReason, setBlockedReason] = useState('');

  useEffect(() => setDueAt(toLocalDateTimeValue(entry.dueAt)), [entry.dueAt]);
  useEffect(() => {
    setAssignee(entry.effectiveAssignee.kind === 'staff' ? entry.effectiveAssignee.userId : '');
  }, [entry.effectiveAssignee]);

  const disabled = Boolean(commands.pendingAction) || !mutationsEnabled;
  const isBlocked = entry.group === 'blocked' || Boolean(entry.blockedReason);

  return (
    <details className={styles.manage}>
      <summary>Manage work</summary>
      <div className={styles.manageGrid}>
        <div className={styles.controlGroup}>
          <Select
            label="Assigned staff"
            value={assignee}
            disabled={disabled || !reassignmentEnabled}
            onChange={(event) => setAssignee(event.target.value)}
          >
            <option value="">Use project owner</option>
            {staff.map((person) => (
              <option key={person.userId} value={person.userId}>{person.displayName}</option>
            ))}
          </Select>
          <Button
            size="small"
            variant="secondary"
            disabled={disabled || !reassignmentEnabled}
            loading={commands.pendingAction === 'reassign'}
            onClick={() => void commands.reassign(assignee || null)}
          >
            Save assignment
          </Button>
        </div>

        <div className={styles.controlGroup}>
          <Input
            label="Due in Auckland"
            type="datetime-local"
            value={dueAt}
            disabled={disabled}
            onChange={(event) => setDueAt(event.target.value)}
          />
          <Input
            label="Reason (optional)"
            value={rescheduleReason}
            maxLength={500}
            disabled={disabled}
            onChange={(event) => setRescheduleReason(event.target.value)}
          />
          <Button
            size="small"
            variant="secondary"
            disabled={disabled || !dueAt}
            loading={commands.pendingAction === 'reschedule'}
            onClick={() => {
              const instant = aucklandLocalDateTimeToIso(dueAt);
              if (instant) void commands.reschedule(instant, rescheduleReason);
            }}
          >
            Reschedule
          </Button>
        </div>

        {isBlocked ? (
          <div className={styles.controlGroup}>
            <p className={styles.controlExplanation}>
              {entry.blockedReason || 'This item is currently blocked.'}
            </p>
            <Button
              size="small"
              variant="secondary"
              disabled={disabled}
              loading={commands.pendingAction === 'unblock'}
              onClick={() => void commands.unblock()}
            >
              Unblock
            </Button>
          </div>
        ) : (
          <div className={styles.controlGroup}>
            <Textarea
              label="Why is this blocked?"
              value={blockedReason}
              maxLength={500}
              disabled={disabled}
              onChange={(event) => setBlockedReason(event.target.value)}
            />
            <Button
              size="small"
              variant="secondary"
              disabled={disabled || !blockedReason.trim()}
              loading={commands.pendingAction === 'block'}
              onClick={() => void commands.block(blockedReason)}
            >
              Mark blocked
            </Button>
          </div>
        )}
      </div>
      <span className={styles.timeHint}>Dates and times use Auckland business time.</span>
    </details>
  );
}
