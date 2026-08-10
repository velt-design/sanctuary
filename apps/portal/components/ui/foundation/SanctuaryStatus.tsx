import { Check } from 'lucide-react';
import {
  PIPELINE_STAGES,
  PIPELINE_STAGE_LABELS,
  type PipelineStageKey,
} from '@/lib/projects/pipelineDefinition';
import type { QuoteStatus } from '@/lib/quotes/types';
import type { EstimateStatus } from '@/lib/estimates/types';
import styles from './SanctuaryStatus.module.css';

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export function ProjectStageBadge({
  stage,
  compact = false,
  className,
}: {
  stage: PipelineStageKey;
  compact?: boolean;
  className?: string;
}) {
  return (
    <span className={cx(styles.stageBadge, compact && styles.compact, className)} data-stage={stage}>
      <span aria-hidden="true" />
      {PIPELINE_STAGE_LABELS[stage]}
    </span>
  );
}

export function ProjectStageTracker({
  currentStage,
  onStageChange,
  ariaLabel = 'Project stage',
}: {
  currentStage: PipelineStageKey;
  onStageChange?: (stage: PipelineStageKey) => void;
  ariaLabel?: string;
}) {
  const currentIndex = PIPELINE_STAGES.findIndex((stage) => stage.key === currentStage);
  return (
    <ol className={styles.tracker} aria-label={ariaLabel}>
      {PIPELINE_STAGES.map((stage, index) => {
        const state = index < currentIndex ? 'completed' : index === currentIndex ? 'current' : 'future';
        const content = (
          <>
            <span className={styles.trackerDot} aria-hidden="true">
              {state === 'completed' ? <Check /> : null}
            </span>
            <span className={styles.trackerLabel}>{stage.label}</span>
          </>
        );
        return (
          <li key={stage.key} data-state={state} data-stage={stage.key} aria-current={state === 'current' ? 'step' : undefined}>
            {onStageChange ? (
              <button type="button" onClick={() => onStageChange(stage.key)} aria-label={`Set stage to ${stage.label}`}>
                {content}
              </button>
            ) : (
              <div>{content}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

type StatusTone = 'neutral' | 'success' | 'warning' | 'error' | 'info';
type StatusPresentation = { label: string; detail: string; tone: StatusTone };

export const QUOTE_STATUS_PRESENTATION = {
  DRAFT: { label: 'Draft', detail: 'Internal', tone: 'neutral' },
  SENT: { label: 'Sent', detail: 'With client', tone: 'warning' },
  ACCEPTED: { label: 'Accepted', detail: 'Approved', tone: 'success' },
  DECLINED: { label: 'Declined', detail: 'Rejected', tone: 'error' },
  SUPERSEDED: { label: 'Superseded', detail: 'Historical', tone: 'neutral' },
} satisfies Record<QuoteStatus, StatusPresentation>;

export const ESTIMATE_STATUS_PRESENTATION = {
  draft: { label: 'Draft', detail: 'In progress', tone: 'neutral' },
  archived: { label: 'Archived', detail: 'Historical', tone: 'neutral' },
} satisfies Record<EstimateStatus, StatusPresentation>;

function StatusBadge({
  label,
  detail,
  tone,
  reference,
}: {
  label: string;
  detail: string;
  tone: StatusTone;
  reference?: string;
}) {
  return (
    <span className={styles.statusRow} data-tone={tone}>
      <span className={styles.statusBadge}>
        <span aria-hidden="true" />
        {label}
      </span>
      <span className={styles.statusDetail}>{detail}</span>
      {reference ? <span className={styles.statusReference}>{reference}</span> : null}
    </span>
  );
}

export function QuoteStatusBadge({ status, detail }: { status: QuoteStatus; detail?: string }) {
  const meta = QUOTE_STATUS_PRESENTATION[status];
  return <StatusBadge label={meta.label} detail={detail ?? meta.detail} tone={meta.tone} />;
}

export function EstimateStatusBadge({
  status,
  detail,
}: {
  status: EstimateStatus;
  detail?: string;
}) {
  const meta = ESTIMATE_STATUS_PRESENTATION[status];
  return (
    <StatusBadge
      label={meta.label}
      detail={detail ?? meta.detail}
      tone={meta.tone}
    />
  );
}
