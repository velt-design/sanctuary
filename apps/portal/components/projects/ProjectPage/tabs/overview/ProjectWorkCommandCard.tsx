'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ProjectCommandOwnerSummary } from '@/lib/projects/commandCentre/types';
import type { ProjectCommandMutationResponse } from '@/lib/projects/commandCentre/client';
import {
  runProjectConfirmationCommand,
  runProjectStateCommand,
  runProjectWorkItemCommand,
  type ProjectWorkMutationResponse,
} from '@/lib/projects/workItems/client';
import type {
  ProjectClosedOutcome,
  ProjectOperationalState,
  ProjectWorkItem,
  ProjectWorkProjection,
  ProjectWorkResponsibilityArea,
} from '@/lib/projects/workItems/types';
import {
  projectCommandIntent,
  StableCommandAttempt,
} from '@/lib/projects/workItems/stableCommandAttempt';
import { parseAucklandDateTimeLocal } from '@/lib/time/aucklandDateTime';
import { qk } from '@/lib/queries/keys';
import {
  invalidateProjectWorkReads,
  patchProjectWorkProjectionCaches,
} from '@/lib/queries/projectWorkCache';
import {
  ActionPanel,
  AlertBanner,
  Badge,
  Button,
  ButtonLink,
  Card,
  Input,
  KeyValueGrid,
  Select,
  Textarea,
} from '@/components/ui/foundation';
import styles from './ProjectWorkCommandCard.module.css';
import ProjectOwnerControls from './ProjectOwnerControls';
import ConfirmationCorrectionControls from '@/components/projects/workQueue/ConfirmationCorrectionControls.client';

const RESPONSIBILITY_AREAS: Array<{
  value: ProjectWorkResponsibilityArea;
  label: string;
}> = [
  { value: 'CUSTOMER', label: 'Customer' },
  { value: 'DESIGN', label: 'Design' },
  { value: 'COMMERCIAL', label: 'Commercial' },
  { value: 'OPERATIONS', label: 'Operations' },
  { value: 'ADMIN', label: 'Admin' },
];

const CLOSED_OUTCOMES: Array<{ value: ProjectClosedOutcome; label: string }> = [
  { value: 'LOST_NO_RESPONSE', label: 'Lost — no response' },
  { value: 'LOST_BUDGET_PRICE', label: 'Lost — budget or price' },
  { value: 'LOST_OTHER_SUPPLIER', label: 'Lost — chose another supplier' },
  { value: 'LOST_TIMING_DEFERRED', label: 'Lost — timing or deferred' },
  { value: 'LOST_NOT_SUITABLE', label: 'Lost — not suitable' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'COMPLETE', label: 'Complete' },
];

function dueLabel(value: string): string {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.valueOf())) return 'Due time unavailable';
  return new Intl.DateTimeFormat('en-NZ', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Pacific/Auckland',
  }).format(parsed);
}

function stateLabel(state: ProjectWorkProjection['effectiveState']): string {
  if (state === 'ARCHIVED') return 'Archived';
  return state[0] + state.slice(1).toLowerCase();
}

function sentCommand(item: ProjectWorkItem): string | null {
  if (item.sourceKey?.startsWith('lead:first-email:')) return 'RECORD_FIRST_ENQUIRY_EMAIL_SENT';
  if (item.sourceKey?.startsWith('lead:follow-up:')) return 'RECORD_ENQUIRY_FOLLOW_UP_EMAIL_SENT';
  if (item.sourceKey?.startsWith('quote:follow-up:')) return 'RECORD_QUOTE_FOLLOW_UP_EMAIL_SENT';
  return null;
}

function isDecisionReview(item: ProjectWorkItem): boolean {
  return Boolean(
    item.sourceKey?.startsWith('lead:close-review:')
    || item.sourceKey?.startsWith('quote:outcome-review:'),
  );
}

export default function ProjectWorkCommandCard({
  projectId,
  host,
  projectWork,
  owner,
  pipelineStage,
  stale,
  onRefresh,
}: {
  projectId: string;
  host: string;
  projectWork: ProjectWorkProjection;
  owner: ProjectCommandOwnerSummary;
  pipelineStage: string;
  stale: boolean;
  onRefresh: () => void;
}) {
  const queryClient = useQueryClient();
  const commandAttempts = useRef(new StableCommandAttempt()).current;
  const [projection, setProjection] = useState(projectWork);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualArea, setManualArea] = useState<ProjectWorkResponsibilityArea>('CUSTOMER');
  const [manualDueAt, setManualDueAt] = useState('');
  const [manualReason, setManualReason] = useState('');
  const [stateChoice, setStateChoice] = useState<ProjectOperationalState>(projectWork.operationalState);
  const [waitingUntil, setWaitingUntil] = useState('');
  const [stateReason, setStateReason] = useState('');
  const [closedOutcome, setClosedOutcome] = useState<ProjectClosedOutcome>('LOST_NO_RESPONSE');
  const [closedNote, setClosedNote] = useState('');

  useEffect(() => {
    setProjection(projectWork);
    setStateChoice(projectWork.operationalState);
  }, [projectWork]);

  const commit = async (operation: () => Promise<ProjectWorkMutationResponse>) => {
    if (pending || stale) return false;
    setPending(true);
    setMessage(null);
    setError(null);
    try {
      const response = await operation();
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
      if (response.refreshRequired) onRefresh();
      setMessage(response.command.replayed ? 'Already saved on the server.' : 'Saved on the server.');
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The project command could not be saved.');
      return false;
    } finally {
      setPending(false);
    }
  };

  const commitCommand = async (
    intent: string,
    operation: (commandId: string) => Promise<ProjectWorkMutationResponse>,
  ) => {
    const saved = await commit(() => operation(commandAttempts.commandIdFor(intent)));
    if (saved) commandAttempts.committed(intent);
    return saved;
  };

  const commitOwner = async (operation: () => Promise<ProjectCommandMutationResponse>) => {
    if (pending || stale) return false;
    setPending(true);
    setMessage(null);
    setError(null);
    try {
      const response = await operation();
      if (response.commandCentre) {
        queryClient.setQueryData(
          qk.projects.commandCentre(host, projectId),
          response.commandCentre,
        );
      }
      await invalidateProjectWorkReads(queryClient, host, projectId);
      if (response.refreshRequired) onRefresh();
      setMessage(response.command.replayed ? 'Already saved on the server.' : 'Saved on the server.');
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The project owner could not be saved.');
      return false;
    } finally {
      setPending(false);
    }
  };

  const primary = projection.primaryAction;
  const primaryItem = primary.kind === 'workItem' ? primary.item : null;
  const primaryTitle = primary.kind === 'workItem'
    ? primary.item.title
    : primary.title;
  const primaryReason = primary.kind === 'workItem'
    ? `${primary.item.responsibilityArea.toLowerCase()} work due ${dueLabel(primary.item.dueAt)}`
    : primary.reason;
  const primaryHref = primary.kind === 'recovery' || primary.kind === 'specialist'
    ? primary.href
    : null;
  const primaryTone = primary.kind === 'workItem' && primary.dueState === 'critical'
    ? 'critical'
    : 'inverse';
  const primaryBadge = primary.kind === 'workItem'
    ? primary.dueState === 'critical'
      ? 'Critical'
      : primary.dueState === 'overdue'
        ? 'Overdue'
        : primary.dueState === 'today'
          ? 'Due today'
          : dueLabel(primary.item.dueAt)
    : primary.kind === 'needsTriage' || primary.kind === 'stateReview'
      ? 'Review'
      : primary.kind === 'none'
        ? 'Status'
      : 'Ready';

  const confirmPrimary = (command: string) => {
    if (!primaryItem) return Promise.resolve(false);
    const payload = {
      command,
      ...(primaryItem.subjectId ? { subjectId: primaryItem.subjectId } : {}),
    };
    return commitCommand(
      projectCommandIntent(command, payload),
      (id) => runProjectConfirmationCommand(projectId, {
        commandId: id,
        ...payload,
      }),
    );
  };

  const createManualItem = async () => {
    const dueAt = parseAucklandDateTimeLocal(manualDueAt);
    if (!manualTitle.trim() || !dueAt) {
      setError('Enter a title and valid due time.');
      return;
    }
    const reviewItem = primaryItem && isDecisionReview(primaryItem) ? primaryItem : null;
    if (reviewItem && !manualReason.trim()) {
      setError('Record why the project is staying Active.');
      return;
    }
    const payload = {
      command: reviewItem ? 'REPLACE_REVIEW' : 'CREATE',
      ...(reviewItem ? {
        workItemId: reviewItem.id,
        expectedRowVersion: reviewItem.rowVersion,
        reason: manualReason.trim(),
      } : {}),
      title: manualTitle.trim(),
      responsibilityArea: manualArea,
      dueAt,
    };
    const saved = await commitCommand(
      projectCommandIntent(payload.command, payload),
      (id) => runProjectWorkItemCommand(projectId, {
        commandId: id,
        ...payload,
      }),
    );
    if (saved) {
      setManualTitle('');
      setManualDueAt('');
      setManualReason('');
    }
  };

  const updateState = async () => {
    if (stateChoice === projection.operationalState) {
      setError('Choose a different project state.');
      return;
    }
    const base = {
      expectedRowVersion: projection.stateRowVersion,
    };
    if (stateChoice === 'ACTIVE') {
      const command = projection.operationalState === 'CLOSED' ? 'REOPEN' : 'ACTIVATE';
      const payload = {
        ...base,
        command,
        reason: stateReason.trim() || undefined,
      };
      await commitCommand(
        projectCommandIntent(command, payload),
        (id) => runProjectStateCommand(projectId, { commandId: id, ...payload }),
      );
      return;
    }
    if (!stateReason.trim()) {
      setError('Record why the current work is being ended.');
      return;
    }
    if (stateChoice === 'WAITING') {
      const waiting = parseAucklandDateTimeLocal(waitingUntil);
      if (!waiting) {
        setError('Choose a valid wake-up time.');
        return;
      }
      const payload = {
        ...base,
        command: 'WAIT',
        waitingUntil: waiting,
        reason: stateReason.trim(),
        cancellationReason: stateReason.trim(),
      };
      await commitCommand(
        projectCommandIntent('WAIT', payload),
        (id) => runProjectStateCommand(projectId, { commandId: id, ...payload }),
      );
      return;
    }
    const payload = {
      ...base,
      command: 'CLOSE',
      outcome: closedOutcome,
      note: closedNote.trim() || undefined,
      cancellationReason: stateReason.trim(),
    };
    await commitCommand(
      projectCommandIntent('CLOSE', payload),
      (id) => runProjectStateCommand(projectId, { commandId: id, ...payload }),
    );
  };

  const primarySentCommand = primaryItem ? sentCommand(primaryItem) : null;
  const primaryCanRecordReply = primaryItem
    && (primaryItem.sourceType === 'LEAD_CADENCE' || primaryItem.sourceType === 'QUOTE_CADENCE');
  const siteVisitCompleted = projection.confirmedFacts.some(
    (fact) => fact.type === 'SITE_VISIT_COMPLETED',
  );

  return (
    <Card
      className={styles.card}
      data-project-work-command="v2"
      aria-label="Project command"
      title="Project command"
      eyebrow="Primary next action"
      padding="compact"
      action={<Badge tone={projection.effectiveState === 'ACTIVE' ? 'success' : 'neutral'}>{stateLabel(projection.effectiveState)}</Badge>}
    >
      <div className={styles.stack}>
        <KeyValueGrid
          columns={2}
          ariaLabel="Project work state"
          items={[
            { label: 'Operational state', value: stateLabel(projection.effectiveState) },
            {
              label: 'Current work',
              value: `${projection.openItems.length} open · ${projection.blockedItems.length} blocked`,
            },
          ]}
        />
        <div className={styles.ownerSection} aria-label="Project ownership">
          <KeyValueGrid
            columns={1}
            items={[{
              label: 'Project owner',
              value: owner.owner?.displayName ?? 'Unassigned',
            }]}
          />
          {owner.permissions.canManage ? (
            <ProjectOwnerControls
              projectId={projectId}
              owner={owner}
              disabled={pending || stale}
              runMutation={commitOwner}
            />
          ) : null}
        </div>

        <ActionPanel
          title={primaryTitle}
          eyebrow={primary.kind === 'workItem' ? 'Project work' : 'Project state'}
          tone={primaryTone}
          status={<Badge tone={primaryBadge === 'Critical' ? 'error' : primaryBadge === 'Overdue' ? 'warning' : 'neutral'}>{primaryBadge}</Badge>}
          footer={(
            <div className={styles.inlineActions}>
              {primaryHref ? <ButtonLink href={primaryHref}>Open</ButtonLink> : null}
              {primaryItem?.sourceType === 'MANUAL' ? (
                <Button
                  loading={pending}
                  disabled={stale}
                  onClick={() => {
                    const payload = {
                      command: 'COMPLETE',
                      workItemId: primaryItem.id,
                      expectedRowVersion: primaryItem.rowVersion,
                    };
                    void commitCommand(
                      projectCommandIntent('COMPLETE', payload),
                      (id) => runProjectWorkItemCommand(projectId, {
                        commandId: id,
                        ...payload,
                      }),
                    );
                  }}
                >
                  Complete
                </Button>
              ) : null}
              {primarySentCommand ? (
                <Button loading={pending} disabled={stale} onClick={() => void confirmPrimary(primarySentCommand)}>
                  Email sent
                </Button>
              ) : null}
              {primaryCanRecordReply ? (
                <Button
                  variant="secondary"
                  disabled={pending || stale}
                  onClick={() => void confirmPrimary(
                    primaryItem.sourceType === 'QUOTE_CADENCE'
                      ? 'RECORD_QUOTE_CUSTOMER_REPLY'
                      : 'RECORD_ENQUIRY_CUSTOMER_REPLY',
                  )}
                >
                  Customer replied
                </Button>
              ) : null}
            </div>
          )}
        >
          <p className={styles.reason}>{primaryReason}</p>
          {primary.kind === 'specialist' ? (
            <KeyValueGrid
              columns={2}
              items={[
                { label: 'Owner', value: primary.owner },
                { label: 'Expected result', value: primary.expectedResult },
              ]}
            />
          ) : null}
          {primaryItem?.priority === 'CRITICAL' && primaryItem.priorityReason ? (
            <AlertBanner tone="blocking" title="Critical work">{primaryItem.priorityReason}</AlertBanner>
          ) : null}
          {primaryItem && isDecisionReview(primaryItem) ? (
            <AlertBanner tone="warning" title="A staff decision is required">
              Keep the project Active with new work, move it to Waiting, or close it with an outcome. Nothing happens automatically.
            </AlertBanner>
          ) : null}
        </ActionPanel>

        <div className={styles.controlsSection}>
          <Button
            type="button"
            variant="secondary"
            disabled={stale}
            aria-expanded={controlsOpen}
            onClick={() => setControlsOpen((open) => !open)}
          >
            {controlsOpen ? 'Close work controls' : 'Manage project work'}
          </Button>
          {controlsOpen ? (
            <div className={styles.controlStack}>
              <details className={styles.disclosure}>
                <summary>
                  {primaryItem && isDecisionReview(primaryItem)
                    ? 'Keep Active with new work'
                    : 'Create manual work'}
                </summary>
                <div className={styles.formGrid}>
                  {primaryItem && isDecisionReview(primaryItem) ? (
                    <Textarea
                      label="Why the project is staying Active"
                      value={manualReason}
                      maxLength={500}
                      disabled={pending || stale}
                      onChange={(event) => setManualReason(event.target.value)}
                    />
                  ) : null}
                  <Input
                    label="Work to do"
                    value={manualTitle}
                    maxLength={160}
                    disabled={pending || stale}
                    onChange={(event) => setManualTitle(event.target.value)}
                  />
                  <Select
                    label="Responsibility"
                    value={manualArea}
                    disabled={pending || stale}
                    onChange={(event) => setManualArea(event.target.value as ProjectWorkResponsibilityArea)}
                  >
                    {RESPONSIBILITY_AREAS.map((area) => <option key={area.value} value={area.value}>{area.label}</option>)}
                  </Select>
                  <Input
                    label="Due in Auckland"
                    type="datetime-local"
                    value={manualDueAt}
                    disabled={pending || stale}
                    onChange={(event) => setManualDueAt(event.target.value)}
                  />
                  <Button disabled={stale} loading={pending} onClick={() => void createManualItem()}>
                    {primaryItem && isDecisionReview(primaryItem)
                      ? 'Replace review with work'
                      : 'Create work'}
                  </Button>
                </div>
              </details>

              {projection.effectiveState !== 'ARCHIVED' ? (
                <details className={styles.disclosure}>
                  <summary>Change operational state</summary>
                  <div className={styles.formGrid}>
                    <Select
                      label="State"
                      value={stateChoice}
                      disabled={pending || stale}
                      onChange={(event) => setStateChoice(event.target.value as ProjectOperationalState)}
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="WAITING">Waiting</option>
                      <option value="CLOSED">Closed</option>
                    </Select>
                    {stateChoice === 'WAITING' ? (
                      <Input
                        label="Wake-up time in Auckland"
                        type="datetime-local"
                        value={waitingUntil}
                        disabled={pending || stale}
                        onChange={(event) => setWaitingUntil(event.target.value)}
                      />
                    ) : null}
                    {stateChoice === 'CLOSED' ? (
                      <Select
                        label="Outcome"
                        value={closedOutcome}
                        disabled={pending || stale}
                        onChange={(event) => setClosedOutcome(event.target.value as ProjectClosedOutcome)}
                      >
                        {CLOSED_OUTCOMES.map((outcome) => (
                          <option key={outcome.value} value={outcome.value}>{outcome.label}</option>
                        ))}
                      </Select>
                    ) : null}
                    <Textarea
                      label={stateChoice === 'ACTIVE' ? 'Reason (optional)' : 'Reason'}
                      value={stateReason}
                      maxLength={500}
                      disabled={pending || stale}
                      onChange={(event) => setStateReason(event.target.value)}
                    />
                    {stateChoice === 'CLOSED' ? (
                      <Textarea
                        label="Outcome note (optional)"
                        value={closedNote}
                        maxLength={1000}
                        disabled={pending || stale}
                        onChange={(event) => setClosedNote(event.target.value)}
                      />
                    ) : null}
                    <Button disabled={stale} loading={pending} onClick={() => void updateState()}>Save state</Button>
                  </div>
                </details>
              ) : null}
              <ConfirmationCorrectionControls
                projectId={projectId}
                host={host}
                facts={projection.confirmedFacts}
                disabled={pending || stale}
                onRefresh={onRefresh}
              />
              {pipelineStage.toLowerCase() === 'site_visit' ? (
                <div className={styles.manualFact}>
                  <div>
                    <strong>Site visit complete</strong>
                    <p>Record this manually here. The hidden Site Visits page does not control project work.</p>
                  </div>
                  {siteVisitCompleted ? (
                    <Badge tone="success">Recorded complete</Badge>
                  ) : (
                    <Button
                      variant="secondary"
                      loading={pending}
                      disabled={stale}
                      onClick={() => {
                        const payload = { command: 'RECORD_SITE_VISIT_COMPLETED' };
                        void commitCommand(
                          projectCommandIntent(payload.command, payload),
                          (id) => runProjectConfirmationCommand(projectId, {
                            commandId: id,
                            ...payload,
                          }),
                        );
                      }}
                    >
                      Mark complete
                    </Button>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {stale ? <AlertBanner tone="warning" title="Work controls paused">Refresh the Overview before changing project work.</AlertBanner> : null}
        {message ? <AlertBanner tone="info" title="Project work updated">{message}</AlertBanner> : null}
        {error ? <AlertBanner tone="error" title="Project work not saved">{error}</AlertBanner> : null}
      </div>
    </Card>
  );
}
