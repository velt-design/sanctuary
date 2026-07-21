'use client';

import { lazy, Suspense, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { qk } from '@/lib/queries/keys';
import {
  runProjectActionCommand,
  type ProjectCommandMutationResponse,
} from '@/lib/projects/commandCentre/client';
import type {
  ProjectCommandActionSummary,
  ProjectCommandAuditEntry,
  ProjectCommandCentreOperations,
  ProjectCommandStaffSummary,
} from '@/lib/projects/commandCentre/types';
import styles from './ProjectPrimaryActionCard.module.css';

const ProjectPrimaryActionControls = lazy(() => import('./ProjectPrimaryActionControls'));
const ProjectOwnerControls = lazy(() => import('./ProjectOwnerControls'));
const ProjectCommandHistoryModal = lazy(() => import('./ProjectCommandHistoryModal'));

function commandId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (part) => {
    const random = Math.floor(Math.random() * 16);
    const value = part === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function eventLabel(eventType: string): string {
  return eventType.replace(/^primary_action_/, '').replaceAll('_', ' ').replace(/^./, (value) => value.toUpperCase());
}

function auditTimestamp(value: string): string {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.valueOf())) return 'Time unavailable';
  return new Intl.DateTimeFormat('en-NZ', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Pacific/Auckland',
  }).format(parsed);
}

function AuditItems({ entries, detailed = false }: { entries: ProjectCommandAuditEntry[]; detailed?: boolean }) {
  return <>{entries.map((entry) => <li key={entry.id}>
    {detailed ? <strong>{eventLabel(entry.eventType)}</strong> : <span>{eventLabel(entry.eventType)}</span>}
    {detailed
      ? <span>{entry.actor?.displayName ?? 'Staff'} · {auditTimestamp(entry.createdAt)}</span>
      : <small>{entry.actor?.displayName ?? 'Staff'} · {auditTimestamp(entry.createdAt)}</small>}
    {entry.reason ? <em>{entry.reason}</em> : null}
  </li>)}</>;
}

export default function ProjectPrimaryActionCard({
  projectId,
  host,
  operations,
  stale,
  onRefresh,
  initialStaff,
}: {
  projectId: string;
  host: string;
  operations: ProjectCommandCentreOperations;
  stale: boolean;
  onRefresh: () => void;
  initialStaff?: ProjectCommandStaffSummary[];
}) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflictCandidateKey, setConflictCandidateKey] = useState('');
  const [ownersOpen, setOwnersOpen] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const current = operations.primaryAction;
  const conflictCandidate = operations.selectionConflict
    ? operations.selectionConflict.outrankingCandidates.find(
        (candidate) => `${candidate.sourceKind}:${candidate.sourceId}` === conflictCandidateKey,
      ) ?? operations.selectionConflict.challenger
    : null;
  const disabled = pending || stale;

  const commitResponse = async (response: ProjectCommandMutationResponse) => {
    if (response.commandCentre) {
      queryClient.setQueryData(qk.projects.commandCentre(host, projectId), response.commandCentre);
    }
    await Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: qk.projects.summary(host, projectId) }),
      queryClient.invalidateQueries({ queryKey: qk.projects.snapshot(host, projectId) }),
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'data'] }),
      queryClient.invalidateQueries({ queryKey: qk.dashboard.projectExceptions() }),
    ]);
    if (response.refreshRequired) {
      setMessage('Saved. Refresh the Overview to load the confirmed state.');
      onRefresh();
    } else {
      setMessage(response.command.replayed ? 'Already saved.' : 'Saved.');
    }
  };

  const run = async (operation: () => Promise<ProjectCommandMutationResponse>) => {
    if (disabled) return false;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      await commitResponse(await operation());
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The project action could not be saved.');
      return false;
    } finally {
      setPending(false);
    }
  };

  const actionRef = (action: ProjectCommandActionSummary) => ({
    sourceKind: action.sourceKind,
    sourceId: action.sourceId,
    expectedUpdatedAt: action.updatedAt,
    expectedCandidateRevision: operations.candidateRevision,
  });
  const executeCommand = (payload: Record<string, unknown>) => run(() => runProjectActionCommand(projectId, {
    commandId: commandId(),
    ...payload,
  }));

  return (
    <section className={styles.card} data-primary-action-card="true" aria-labelledby="primary-action-title">
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Project command</p>
          <h2 id="primary-action-title">Primary next action</h2>
        </div>
        {current ? (
          <span className={`${styles.statePill} ${current.isCritical ? styles.critical : current.dueState === 'overdue' ? styles.overdue : ''}`}>
            {current.isCritical ? 'Critical' : current.dueLabel}
          </span>
        ) : null}
      </div>

      <div className={styles.owners} aria-label="Project ownership">
        <div className={styles.ownerRow} data-project-owner={operations.owner.owner?.key ?? 'unassigned'}>
          <div>
            <strong>Project Owner</strong>
            <span className={operations.owner.missing ? styles.missing : undefined}>{operations.owner.owner?.displayName ?? 'Unassigned'}</span>
          </div>
        </div>
        {operations.owner.permissions.canManage ? (
          <button type="button" disabled={disabled} aria-expanded={ownersOpen} onClick={() => setOwnersOpen((open) => !open)}>
            {ownersOpen ? 'Close owner control' : 'Manage project owner'}
          </button>
        ) : null}
        {ownersOpen ? (
          <Suspense fallback={<p className={styles.notice}>Loading owner controls…</p>}>
              <ProjectOwnerControls
                projectId={projectId}
                owner={operations.owner}
                disabled={disabled}
                runMutation={run}
            />
          </Suspense>
        ) : null}
      </div>

      {operations.selectionConflict ? (
        <div className={styles.conflict} role="alert" data-action-conflict="true">
          <strong>Primary-action review required</strong>
          <span>{operations.selectionConflict.challenger.title} now outranks the selected action.</span>
          {operations.permissions.canResolveConflict ? (
            <div className={styles.inlineActions}>
              <button type="button" disabled={disabled} onClick={() => current && void executeCommand({
                command: 'resolve_conflict', resolution: 'keep_current', ...actionRef(current),
              })}>Keep current</button>
              <label>Outranking action<select
                value={conflictCandidateKey || `${operations.selectionConflict.challenger.sourceKind}:${operations.selectionConflict.challenger.sourceId}`}
                disabled={disabled}
                onChange={(event) => setConflictCandidateKey(event.target.value)}
              >
                {operations.selectionConflict.outrankingCandidates.map((candidate) => (
                  <option key={`${candidate.sourceKind}:${candidate.sourceId}`} value={`${candidate.sourceKind}:${candidate.sourceId}`}>
                    {candidate.title}
                  </option>
                ))}
              </select></label>
              <button type="button" disabled={disabled || !conflictCandidate} onClick={() => conflictCandidate && void executeCommand({
                command: 'resolve_conflict', resolution: 'select_candidate',
                ...actionRef(conflictCandidate),
              })}>Use selected action</button>
            </div>
          ) : <span>An admin must resolve this. You can still complete the current action.</span>}
        </div>
      ) : null}

      {current ? (
        <div className={styles.current} data-primary-action-source={current.sourceKind}>
          <div className={styles.currentTitle}>
            <h3>{current.title}</h3>
            <span>{current.sourceLabel}</span>
          </div>
          <dl className={styles.facts}>
            <div><dt>Owner</dt><dd>{current.owner?.displayName ?? 'Unassigned'}</dd></div>
            <div><dt>Due</dt><dd>{current.dueLabel}</dd></div>
            <div><dt>Category</dt><dd>{current.category}</dd></div>
          </dl>
          {current.isCritical && current.criticalReason ? <p className={styles.criticalReason}>Critical: {current.criticalReason}</p> : null}
          <div className={styles.inlineActions}>
            <button type="button" disabled={disabled || !operations.permissions.canComplete} onClick={() => void executeCommand({
              command: 'complete', ...actionRef(current),
            })}>{pending ? 'Saving...' : 'Complete'}</button>
          </div>

        </div>
      ) : (
        <div className={styles.empty} data-primary-action-state="empty">
          <strong>No next action has been set.</strong>
          <span>Select open work or create a concrete action.</span>
          {operations.candidates.some((candidate) => candidate.requiresDueDate) ? (
            <span><strong>Due date required:</strong> undated work cannot become primary.</span>
          ) : null}
        </div>
      )}

      {operations.permissions.canSelect || operations.permissions.canCreate
        || operations.permissions.canReschedule || operations.permissions.canReassign
        || operations.permissions.canSetCritical ? (
          <div className={styles.create}>
            <button type="button" disabled={disabled} aria-expanded={controlsOpen} onClick={() => setControlsOpen((open) => !open)}>
              {controlsOpen ? 'Close action controls' : 'Manage next action'}
            </button>
            {controlsOpen ? (
              <Suspense fallback={<p className={styles.notice}>Loading action controls…</p>}>
                <ProjectPrimaryActionControls
                  operations={operations}
                  current={current}
                  disabled={disabled}
                  host={host}
                  initialStaff={initialStaff}
                  executeCommand={executeCommand}
                />
              </Suspense>
            ) : null}
          </div>
        ) : null}

      {stale ? <p className={styles.notice}>Action controls are paused until the Overview refreshes.</p> : null}
      {message ? <p className={styles.success} role="status">{message}</p> : null}
      {error ? <p className={styles.error} role="alert">{error}</p> : null}

      {operations.audit.length ? (
        <div className={styles.history}>
          <div className={styles.historyHeader}><h3>Recent changes</h3>{operations.audit.length > 5 ? <button type="button" onClick={() => setHistoryOpen(true)}>View recent history</button> : null}</div>
          <ul><AuditItems entries={operations.audit.slice(0, 5)} /></ul>
        </div>
      ) : null}

      {historyOpen ? (
        <Suspense fallback={null}>
          <ProjectCommandHistoryModal onClose={() => setHistoryOpen(false)}>
            <AuditItems entries={operations.audit} detailed />
          </ProjectCommandHistoryModal>
        </Suspense>
      ) : null}
    </section>
  );
}
