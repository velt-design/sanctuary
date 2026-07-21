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
import {
  ActionPanel,
  ActivityTimeline,
  ActivityTimelineItem,
  AlertBanner,
  Badge,
  Button,
  Card,
  EmptyState,
  KeyValueGrid,
  Select,
} from '@/components/ui/foundation';
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

function AuditItems({ entries }: { entries: ProjectCommandAuditEntry[] }) {
  return <>{entries.map((entry) => (
    <ActivityTimelineItem
      key={entry.id}
      marker={<Badge tone="neutral">{eventLabel(entry.eventType)}</Badge>}
      meta={`${entry.actor?.displayName ?? 'Staff'} · ${auditTimestamp(entry.createdAt)}`}
      footer={entry.reason || undefined}
    >
      {entry.reason ? 'Reason recorded' : 'Project command updated'}
    </ActivityTimelineItem>
  ))}</>;
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

  const actionTone = current?.isCritical ? 'error' : current?.dueState === 'overdue' ? 'warning' : 'neutral';

  return (
    <Card
      className={styles.card}
      data-primary-action-card="true"
      aria-label="Project command"
      title="Project command"
      eyebrow="Primary next action"
      padding="compact"
      action={current ? <Badge tone={actionTone}>{current.isCritical ? 'Critical' : current.dueLabel}</Badge> : null}
    >
      <div className={styles.stack}>
        <div className={styles.ownerSection} aria-label="Project ownership" data-project-owner>
          <KeyValueGrid
            columns={1}
            items={[{
              label: 'Project owner',
              value: operations.owner.owner?.displayName ?? <span className={styles.missing}>Unassigned</span>,
            }]}
          />
          {operations.owner.permissions.canManage ? (
            <Button type="button" variant="secondary" size="small" disabled={disabled} aria-expanded={ownersOpen} onClick={() => setOwnersOpen((open) => !open)}>
              {ownersOpen ? 'Close owner control' : 'Manage project owner'}
            </Button>
          ) : null}
          {ownersOpen ? (
            <Suspense fallback={<AlertBanner tone="info" title="Loading owner controls" />}>
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
          <AlertBanner tone="blocking" title="Primary-action review required">
            <p>{operations.selectionConflict.challenger.title} now outranks the selected action.</p>
            {operations.permissions.canResolveConflict ? (
              <div className={styles.inlineActions}>
                <Button variant="secondary" size="small" disabled={disabled} onClick={() => current && void executeCommand({
                  command: 'resolve_conflict', resolution: 'keep_current', ...actionRef(current),
                })}>Keep current</Button>
                <Select
                  label="Outranking action"
                  value={conflictCandidateKey || `${operations.selectionConflict.challenger.sourceKind}:${operations.selectionConflict.challenger.sourceId}`}
                  disabled={disabled}
                  onChange={(event) => setConflictCandidateKey(event.target.value)}
                >
                  {operations.selectionConflict.outrankingCandidates.map((candidate) => (
                    <option key={`${candidate.sourceKind}:${candidate.sourceId}`} value={`${candidate.sourceKind}:${candidate.sourceId}`}>
                      {candidate.title}
                    </option>
                  ))}
                </Select>
                <Button size="small" disabled={disabled || !conflictCandidate} onClick={() => conflictCandidate && void executeCommand({
                  command: 'resolve_conflict', resolution: 'select_candidate', ...actionRef(conflictCandidate),
                })}>Use selected action</Button>
              </div>
            ) : <p>An admin must resolve this. You can still complete the current action.</p>}
          </AlertBanner>
        ) : null}

        {current ? (
          <ActionPanel
            title={current.title}
            eyebrow={current.sourceLabel}
            tone={current.isCritical ? 'critical' : 'inverse'}
            data-primary-action-source={current.sourceKind}
            status={<Badge tone={actionTone}>{current.isCritical ? 'Critical' : current.dueLabel}</Badge>}
            footer={(
              <Button
                loading={pending}
                disabled={disabled || !operations.permissions.canComplete}
                onClick={() => void executeCommand({ command: 'complete', ...actionRef(current) })}
              >
                Complete
              </Button>
            )}
          >
            <KeyValueGrid
              columns={3}
              items={[
                { label: 'Owner', value: current.owner?.displayName ?? 'Unassigned' },
                { label: 'Due', value: current.dueLabel },
                { label: 'Category', value: current.category },
              ]}
            />
            {current.isCritical && current.criticalReason ? (
              <AlertBanner tone="blocking" title="Critical action">{current.criticalReason}</AlertBanner>
            ) : null}
          </ActionPanel>
        ) : (
          <div data-primary-action-state="empty">
            <EmptyState
              compact
              title="No next action has been set"
              description={operations.candidates.some((candidate) => candidate.requiresDueDate)
                ? 'Due date required. Select open work or create an action; undated work needs a date before it can become primary.'
                : 'Select open work or create a concrete action.'}
            />
          </div>
        )}

        {operations.permissions.canSelect || operations.permissions.canCreate
          || operations.permissions.canReschedule || operations.permissions.canReassign
          || operations.permissions.canSetCritical ? (
            <div className={styles.controlsSection}>
              <Button type="button" variant="secondary" disabled={disabled} aria-expanded={controlsOpen} onClick={() => setControlsOpen((open) => !open)}>
                {controlsOpen ? 'Close action controls' : 'Manage next action'}
              </Button>
              {controlsOpen ? (
                <Suspense fallback={<AlertBanner tone="info" title="Loading action controls" />}>
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

        {stale ? <AlertBanner tone="warning" title="Action controls paused">Refresh the Overview before changing the primary action.</AlertBanner> : null}
        {message ? <AlertBanner tone="info" title="Project command saved">{message}</AlertBanner> : null}
        {error ? <AlertBanner tone="error" title="Project command not saved">{error}</AlertBanner> : null}

        {operations.audit.length ? (
          <section className={styles.history} aria-label="Recent project command changes">
            <div className={styles.historyHeader}>
              <h3>Recent changes</h3>
              {operations.audit.length > 5 ? <Button variant="tertiary" size="small" onClick={() => setHistoryOpen(true)}>View recent history</Button> : null}
            </div>
            <ActivityTimeline ariaLabel="Recent project command changes"><AuditItems entries={operations.audit.slice(0, 5)} /></ActivityTimeline>
          </section>
        ) : null}

        {historyOpen ? (
          <Suspense fallback={null}>
            <ProjectCommandHistoryModal onClose={() => setHistoryOpen(false)}>
              <AuditItems entries={operations.audit} />
            </ProjectCommandHistoryModal>
          </Suspense>
        ) : null}
      </div>
    </Card>
  );
}
