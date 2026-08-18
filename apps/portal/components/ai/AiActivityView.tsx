import type { AiApprovalStatus, AiTaskStatus } from '@sp/ai';
import PageHeader from '@/components/layout/PageHeader';
import { Badge, Card, EmptyState, PageLayout } from '@/components/ui/foundation';
import type {
  AiActivityTaskDetail,
  AiActivityTaskSummary,
} from '@/lib/ai/activityContract';
import styles from './AiActivityView.module.css';

const DATE_FORMAT = new Intl.DateTimeFormat('en-NZ', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Pacific/Auckland',
});

function label(value: string): string {
  return value.replaceAll('_', ' ').replaceAll('.', ' · ');
}

function formatDate(value: string): string {
  return DATE_FORMAT.format(new Date(value));
}

function taskTone(status: AiTaskStatus): 'neutral' | 'success' | 'warning' | 'error' | 'info' {
  if (status === 'succeeded' || status === 'evaluated') return 'success';
  if (status === 'failed' || status === 'rejected') return 'error';
  if (status === 'needs_attention' || status === 'awaiting_approval') return 'warning';
  if (status === 'running' || status === 'queued' || status === 'approved') return 'info';
  return 'neutral';
}

function approvalTone(status: AiApprovalStatus): 'neutral' | 'success' | 'warning' | 'error' | 'info' {
  if (status === 'approved' || status === 'consumed') return 'success';
  if (status === 'rejected' || status === 'invalidated') return 'error';
  if (status === 'pending') return 'warning';
  return 'neutral';
}

function TaskList({ tasks, selectedTaskId }: {
  tasks: readonly AiActivityTaskSummary[];
  selectedTaskId: string | null;
}) {
  if (!tasks.length) {
    return (
      <EmptyState
        compact
        title="No synthetic tasks"
        description="No RLS-visible AI activity matches this read-only view."
      />
    );
  }
  return (
    <ol className={styles.taskList} aria-label="Synthetic AI tasks">
      {tasks.map((task) => (
        <li key={task.taskId} data-selected={task.taskId === selectedTaskId || undefined}>
          <div className={styles.taskRowHeader}>
            <strong>{task.objective}</strong>
            <Badge tone={taskTone(task.status)}>{label(task.status)}</Badge>
          </div>
          <span>{label(task.capabilityKey)}</span>
          <small>Updated {formatDate(task.updatedAt)}</small>
        </li>
      ))}
    </ol>
  );
}

function TaskSummary({ task }: { task: AiActivityTaskSummary }) {
  return (
    <dl className={styles.summaryGrid} aria-label="Selected task summary">
      <div><dt>Status</dt><dd><Badge tone={taskTone(task.status)}>{label(task.status)}</Badge></dd></div>
      <div><dt>Risk</dt><dd>{label(task.riskClass)}</dd></div>
      <div><dt>Data</dt><dd>{label(task.dataClassification)}</dd></div>
      <div><dt>Cost</dt><dd>{task.actualCostCents} / {task.maxCostCents} cents</dd></div>
      <div><dt>Agent</dt><dd>{label(task.agentKey)} · v{task.agentVersion}</dd></div>
      <div><dt>Policy</dt><dd>v{task.policyVersion}</dd></div>
      <div className={styles.summaryWide}><dt>Capability</dt><dd>{label(task.capabilityKey)} · v{task.capabilityVersion}</dd></div>
      <div className={styles.summaryWide}><dt>Task ID</dt><dd><code>{task.taskId}</code></dd></div>
    </dl>
  );
}

function TaskTimeline({ detail }: { detail: AiActivityTaskDetail }) {
  if (!detail.events.length) {
    return <p className={styles.muted}>No safe events have been recorded.</p>;
  }
  return (
    <ol className={styles.timeline} aria-label="Task event timeline">
      {detail.events.map((event) => (
        <li key={event.eventKey}>
          <span className={styles.timelineMarker} aria-hidden="true" />
          <div className={styles.timelineHeading}>
            <strong>{label(event.eventType)}</strong>
            <time dateTime={event.occurredAt}>{formatDate(event.occurredAt)}</time>
          </div>
          <p>{event.safeSummary ?? `${label(event.actorKind)} · ${label(event.actorKey)}`}</p>
          {event.fromStatus && event.toStatus ? (
            <small>{label(event.fromStatus)} → {label(event.toStatus)}</small>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function ApprovalEvidence({ detail }: { detail: AiActivityTaskDetail }) {
  if (!detail.approvals.length) {
    return <p className={styles.muted}>No approval evidence is attached to this task.</p>;
  }
  return (
    <div className={styles.approvals}>
      {detail.approvals.map((approval) => (
        <article key={approval.approvalId}>
          <header>
            <div>
              <strong>{approval.payloadSummary}</strong>
              <small>
                {label(approval.actionType)} · {approval.status === 'expired' ? 'expired' : 'expires'} {formatDate(approval.expiresAt)}
              </small>
            </div>
            <Badge tone={approvalTone(approval.status)}>{label(approval.status)}</Badge>
          </header>
          <ul aria-label="Approval impact">
            {approval.impact.map((impact) => <li key={impact}>{impact}</li>)}
          </ul>
          <dl className={styles.validations} aria-label="Approval validations">
            {approval.validations.map((validation) => (
              <div key={validation.validationKey}>
                <dt>{label(validation.validationKey)}</dt>
                <dd><Badge tone={validation.passed ? 'success' : 'error'}>{validation.passed ? 'passed' : 'failed'}</Badge></dd>
              </div>
            ))}
          </dl>
          <p className={styles.fingerprint}>Payload fingerprint <code>{approval.payloadHash.slice(0, 20)}…</code></p>
        </article>
      ))}
    </div>
  );
}

export default function AiActivityView({ tasks, detail }: {
  tasks: readonly AiActivityTaskSummary[];
  detail: AiActivityTaskDetail | null;
}) {
  return (
    <PageLayout width="full" density="compact" className={styles.page} data-ai-activity-view="true">
      <PageHeader
        variant="index"
        eyebrow="Synthetic operations"
        title="AI Activity"
        count={tasks.length}
        description="Read-only task, event, and approval evidence. No controls on this page can run an AI task or create an external effect."
      />
      <p className={styles.safetyNote}>
        Safe projection only. Private prompts, payloads, credentials, and command receipts are never loaded here.
      </p>
      <div className={styles.layout}>
        <Card title="Visible tasks" eyebrow="RLS-scoped" padding="none" className={styles.taskCard}>
          <TaskList tasks={tasks} selectedTaskId={detail?.task.taskId ?? null} />
        </Card>
        <div className={styles.detailColumn}>
          {detail ? (
            <>
              <Card title={detail.task.objective} eyebrow={label(detail.task.taskType)} padding="compact">
                <TaskSummary task={detail.task} />
                {detail.task.safeFailureSummary ? (
                  <p className={styles.failure}>{detail.task.safeFailureSummary}</p>
                ) : null}
              </Card>
              <Card title="Activity timeline" eyebrow={`${detail.events.length} safe events`} padding="compact">
                <TaskTimeline detail={detail} />
              </Card>
              <Card title="Approval evidence" eyebrow={`${detail.approvals.length} envelopes`} padding="compact">
                <ApprovalEvidence detail={detail} />
              </Card>
            </>
          ) : (
            <Card title="Task detail" eyebrow="Read-only" padding="compact">
              <EmptyState
                compact
                title="Select a visible task"
                description="Task detail is intentionally absent when no RLS-visible record is selected."
              />
            </Card>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
