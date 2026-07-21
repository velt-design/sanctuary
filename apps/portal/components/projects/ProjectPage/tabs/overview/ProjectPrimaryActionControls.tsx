'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { qk } from '@/lib/queries/keys';
import { fetchProjectStaffDirectory } from '@/lib/projects/commandCentre/client';
import type {
  ProjectCommandActionCategory,
  ProjectCommandActionSummary,
  ProjectCommandCentreOperations,
  ProjectCommandStaffSummary,
} from '@/lib/projects/commandCentre/types';
import { Button, Input, Select } from '@/components/ui/foundation';
import styles from './ProjectPrimaryActionCard.module.css';

const CATEGORIES: ProjectCommandActionCategory[] = ['Call', 'Site visit', 'Design', 'Estimate', 'Quote', 'Follow-up', 'Other'];

type Props = {
  operations: ProjectCommandCentreOperations;
  current: ProjectCommandActionSummary | null;
  disabled: boolean;
  host: string;
  initialStaff?: ProjectCommandStaffSummary[];
  executeCommand: (payload: Record<string, unknown>) => Promise<boolean>;
};

const sourceKey = (action: ProjectCommandActionSummary) => `${action.sourceKind}:${action.sourceId}`;

export default function ProjectPrimaryActionControls({
  operations,
  current,
  disabled,
  host,
  initialStaff,
  executeCommand,
}: Props) {
  const [manualTitle, setManualTitle] = useState('');
  const [manualCategory, setManualCategory] = useState<ProjectCommandActionCategory>('Follow-up');
  const [manualDueDate, setManualDueDate] = useState('');
  const [selectionDueDate, setSelectionDueDate] = useState('');
  const [selectedCandidateKey, setSelectedCandidateKey] = useState('');
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [criticalReason, setCriticalReason] = useState('');
  const [actionOwnerSelection, setActionOwnerSelection] = useState<{ sourceKey: string; ownerId: string } | null>(null);
  const staffQuery = useQuery({
    queryKey: qk.staff.directory(host),
    queryFn: fetchProjectStaffDirectory,
    staleTime: 5 * 60 * 1000,
    ...(initialStaff ? { initialData: initialStaff, enabled: false } : null),
  });
  const staff = staffQuery.data ?? [];

  const selectedCandidate = useMemo(() => operations.candidates.find(
    (candidate) => sourceKey(candidate) === selectedCandidateKey,
  ) ?? null, [operations.candidates, selectedCandidateKey]);
  const currentSourceKey = current ? sourceKey(current) : '';
  const selectedActionOwnerId = actionOwnerSelection?.sourceKey === currentSourceKey
    ? actionOwnerSelection.ownerId
    : current?.ownerSource === 'source_assignee' ? current.owner?.userId ?? '' : '';
  const actionRef = (action: ProjectCommandActionSummary) => ({
    sourceKind: action.sourceKind,
    sourceId: action.sourceId,
    expectedUpdatedAt: action.updatedAt,
    expectedCandidateRevision: operations.candidateRevision,
  });

  return <div className={styles.controlStack} data-primary-action-controls="true">
    {current && operations.permissions.canReschedule ? (
      <div className={styles.controlRow}>
        <Input label="New due date" type="date" value={rescheduleDate} onChange={(event) => setRescheduleDate(event.target.value)} disabled={disabled} />
        <Input label={`Reason ${current.rescheduleCount >= 2 ? '(required)' : '(optional)'}`} value={rescheduleReason} maxLength={500} onChange={(event) => setRescheduleReason(event.target.value)} disabled={disabled} />
        <Button type="button" disabled={disabled || !rescheduleDate || (current.rescheduleCount >= 2 && !rescheduleReason.trim())} onClick={() => void executeCommand({
          command: 'reschedule', dueDate: rescheduleDate, reason: rescheduleReason, ...actionRef(current),
        })}>Reschedule</Button>
      </div>
    ) : null}

    {current && operations.permissions.canReassign ? (
      <div className={styles.controlRow}>
        <Select label="Action owner" value={selectedActionOwnerId} onChange={(event) => setActionOwnerSelection({ sourceKey: currentSourceKey, ownerId: event.target.value })} disabled={disabled || staffQuery.isPending}>
          <option value="">{current.ownerSource === 'project_owner' && current.owner ? `Project owner (${current.owner.displayName})` : 'Unassigned'}</option>
          {staff.map((person) => <option key={person.userId} value={person.userId}>{person.displayName}</option>)}
        </Select>
        <Button type="button" disabled={disabled} onClick={() => void executeCommand({
          command: 'reassign', ownerUserId: selectedActionOwnerId || null, ...actionRef(current),
        })}>Reassign</Button>
      </div>
    ) : null}

    {current && operations.permissions.canSetCritical ? (
      <div className={styles.controlRow}>
        <Input label="Criticality reason" value={criticalReason} maxLength={500} onChange={(event) => setCriticalReason(event.target.value)} disabled={disabled} />
        <Button variant={current.isCritical ? 'secondary' : 'destructive'} type="button" disabled={disabled || !criticalReason.trim()} onClick={() => void executeCommand({
          command: 'set_critical', critical: !current.isCritical, reason: criticalReason, ...actionRef(current),
        })}>{current.isCritical ? 'Clear critical' : 'Mark critical'}</Button>
      </div>
    ) : null}

    {operations.permissions.canSelect && operations.candidates.length ? (
      <div className={styles.controlRow}>
        <Select label="Select open work" value={selectedCandidateKey} onChange={(event) => setSelectedCandidateKey(event.target.value)} disabled={disabled}>
          <option value="">Choose an action</option>
          {operations.candidates.map((candidate) => (
            <option key={sourceKey(candidate)} value={sourceKey(candidate)}>
              {candidate.title}{candidate.requiresDueDate ? ' — due date required' : ''}
            </option>
          ))}
        </Select>
        {selectedCandidate?.requiresDueDate ? <Input label="Due date" type="date" value={selectionDueDate} onChange={(event) => setSelectionDueDate(event.target.value)} /> : null}
        <Button type="button" disabled={disabled || !selectedCandidate || (selectedCandidate.requiresDueDate && !selectionDueDate)} onClick={() => selectedCandidate && void executeCommand({
          command: 'select', dueDate: selectionDueDate || undefined, ...actionRef(selectedCandidate),
        })}>Make primary</Button>
      </div>
    ) : null}

    {operations.permissions.canCreate ? (
      <details className={styles.create} open={!current}>
        <summary>Create manual action</summary>
        <div className={styles.createGrid}>
          <Input label="Action title" value={manualTitle} maxLength={160} onChange={(event) => setManualTitle(event.target.value)} disabled={disabled} />
          <Select label="Category" value={manualCategory} onChange={(event) => setManualCategory(event.target.value as ProjectCommandActionCategory)} disabled={disabled}>
            {CATEGORIES.map((category) => <option key={category}>{category}</option>)}
          </Select>
          <Input label="Due date" type="date" value={manualDueDate} onChange={(event) => setManualDueDate(event.target.value)} disabled={disabled} />
          <Button type="button" disabled={disabled || !manualTitle.trim() || !manualDueDate} onClick={() => void executeCommand({
            command: 'create_manual', title: manualTitle, category: manualCategory, dueDate: manualDueDate,
            expectedCandidateRevision: operations.candidateRevision,
          }).then((saved) => { if (saved) { setManualTitle(''); setManualDueDate(''); } })}>Create and select</Button>
        </div>
      </details>
    ) : null}
  </div>;
}
