import type {
  LegacyContactedClosedOutcome,
  LegacyContactedDisposition,
  LegacyContactedProject,
  LegacyContactedReasonCode,
  LegacyContactedRecommendation,
} from '@/lib/projects/workItems/legacyTriage/types';
import type { ProjectWorkResponsibilityArea } from '@/lib/projects/workItems/types';
import { parseAucklandDateTimeLocal } from '@/lib/time/aucklandDateTime';

export type LegacyMigrationDraft = {
  disposition: LegacyContactedDisposition;
  reason: string;
  title: string;
  responsibilityArea: ProjectWorkResponsibilityArea;
  dueAt: string;
  waitingUntil: string;
  closedOutcome: LegacyContactedClosedOutcome;
};

export const RECOMMENDATION_COPY: Record<
  LegacyContactedRecommendation,
  { label: string; description: string }
> = {
  ACTIVE_EVIDENCE: {
    label: 'Active evidence',
    description: 'Current project records suggest this still needs active work.',
  },
  WAITING_CANDIDATE: {
    label: 'Waiting candidate',
    description: 'A future follow-up date suggests a deliberate waiting state.',
  },
  LOST_NO_RESPONSE_CANDIDATE: {
    label: 'No-response candidate',
    description: 'A sent email and past follow-up date support a reviewed close decision.',
  },
  MANUAL_CLASSIFICATION: {
    label: 'Manual review',
    description: 'The stored evidence is not strong enough to recommend a disposition.',
  },
};

const REASON_LABELS: Record<LegacyContactedReasonCode, string> = {
  CURRENT_QUOTE: 'Current quote',
  CURRENT_INVOICE: 'Current deposit invoice',
  CURRENT_DESIGN: 'Current design work',
  CURRENT_SCHEDULE: 'Scheduled work',
  RUNNING_JOB: 'Running-job activity',
  OPEN_OBLIGATION: 'Open legacy obligation',
  SENT_EMAIL_EVIDENCE: 'Follow-up email recorded sent',
  FOLLOW_UP_DUE: 'Follow-up date is due',
  FUTURE_FOLLOW_UP_DATE: 'Future follow-up date',
  FOLLOW_UP_DATE_MISSING: 'No follow-up date',
  INSUFFICIENT_EVIDENCE: 'Insufficient evidence',
};

export function legacyReasonLabel(code: LegacyContactedReasonCode): string {
  return REASON_LABELS[code];
}

export function legacyFollowUpDateLabel(value: string | null): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Not recorded';
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    !Number.isFinite(parsed.valueOf())
    || parsed.toISOString().slice(0, 10) !== value
  ) {
    return 'Not recorded';
  }
  return new Intl.DateTimeFormat('en-NZ', {
    dateStyle: 'medium',
    timeZone: 'Pacific/Auckland',
  }).format(parsed);
}

export function defaultLegacyMigrationDraft(
  project: LegacyContactedProject,
): LegacyMigrationDraft {
  if (project.recommendation === 'WAITING_CANDIDATE') {
    return {
      disposition: 'WAITING',
      reason: '',
      title: '',
      responsibilityArea: 'CUSTOMER',
      dueAt: '',
      waitingUntil: '',
      closedOutcome: 'LOST_NO_RESPONSE',
    };
  }
  if (project.recommendation === 'LOST_NO_RESPONSE_CANDIDATE') {
    return {
      disposition: 'CLOSED',
      reason: '',
      title: '',
      responsibilityArea: 'CUSTOMER',
      dueAt: '',
      waitingUntil: '',
      closedOutcome: 'LOST_NO_RESPONSE',
    };
  }
  return {
    disposition: 'ACTIVE_TRIAGE',
    reason: '',
    title: '',
    responsibilityArea: 'CUSTOMER',
    dueAt: '',
    waitingUntil: '',
    closedOutcome: 'LOST_NO_RESPONSE',
  };
}

function validInstant(value: string): boolean {
  return parseAucklandDateTimeLocal(value) !== null;
}

export function legacyMigrationDraftError(
  draft: LegacyMigrationDraft,
  now = new Date(),
): string | null {
  const reason = draft.reason.trim();
  if (!reason) return 'Record why this disposition is correct.';
  if (reason.length > 1000) return 'Keep the reason to 1000 characters.';
  if (draft.disposition === 'ACTIVE_WORK') {
    if (!draft.title.trim()) return 'Name the work that should be done.';
    if (draft.title.trim().length > 160) return 'Keep the work title to 160 characters.';
    if (!validInstant(draft.dueAt)) return 'Choose a valid due time.';
  }
  if (draft.disposition === 'WAITING') {
    const waitingUntil = parseAucklandDateTimeLocal(draft.waitingUntil);
    if (!waitingUntil) return 'Choose a valid wake-up time.';
    if (Date.parse(waitingUntil) <= now.valueOf()) {
      return 'The wake-up time must be in the future.';
    }
  }
  return null;
}
