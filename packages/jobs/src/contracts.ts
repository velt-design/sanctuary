export const BACKGROUND_JOB_KINDS = [
  'deposit_invoice_prepare_and_send',
  'quote_send',
  'quote_resend',
  'job_pack_generate',
  'automation_event',
  'email_outbox_deliver',
] as const;

export type BackgroundJobKind = (typeof BACKGROUND_JOB_KINDS)[number];

export const BACKGROUND_JOB_STATUSES = [
  'queued',
  'claimed',
  'preparing',
  'running',
  'dispatching',
  'provider_accepted',
  'finalising',
  'retrying',
  'succeeded',
  'cancelled',
  'needs_attention',
  'permanent_failed',
] as const;

export type BackgroundJobStatus = (typeof BACKGROUND_JOB_STATUSES)[number];

export const BACKGROUND_JOB_EFFECT_STATES = [
  'prepared',
  'dispatch_started',
  'provider_accepted',
  'finalised',
  'uncertain',
  'failed',
] as const;

export type BackgroundJobEffectState = (typeof BACKGROUND_JOB_EFFECT_STATES)[number];

export const BACKGROUND_JOB_ROLLOUT_MODES = [
  'disabled',
  'legacy',
  'shadow',
  'worker_cohort',
  'worker_enabled',
] as const;

export type BackgroundJobRolloutMode = (typeof BACKGROUND_JOB_ROLLOUT_MODES)[number];

export const BACKGROUND_JOB_EXECUTION_OWNERS = ['legacy', 'shadow', 'worker'] as const;

export type BackgroundJobExecutionOwner = (typeof BACKGROUND_JOB_EXECUTION_OWNERS)[number];

export const BACKGROUND_JOB_EVENT_TYPES = [
  'enqueued',
  'duplicate_enqueue',
  'claimed',
  'phase_progress',
  'heartbeat',
  'effect_checkpoint',
  'retry_scheduled',
  'lease_expired',
  'provider_dispatch',
  'provider_accepted',
  'finalised',
  'succeeded',
  'needs_attention',
  'permanent_failed',
  'manual_retry',
  'cancellation_requested',
  'cancelled',
  'reconciled',
  'queue_repaired',
  'duplicate_message',
  'orphaned_message',
  'queue_archive_missing',
] as const;

export type BackgroundJobEventType = (typeof BACKGROUND_JOB_EVENT_TYPES)[number];

export const BACKGROUND_JOB_SAFE_SUMMARY_MAX_BYTES = 8_192;
export const BACKGROUND_JOB_SAFE_SUMMARY_MAX_STRING_LENGTH = 1_024;

const BACKGROUND_JOB_UNSAFE_SUMMARY_KEY =
  /(email|recipient|token|secret|password|body|html|attachment|content|api.?key)/i;

export type BackgroundJobSafeValue =
  | string
  | number
  | boolean
  | null
  | BackgroundJobSafeSummary
  | readonly BackgroundJobSafeValue[];

export interface BackgroundJobSafeSummary {
  readonly [key: string]: BackgroundJobSafeValue;
}

/** Service-side payload-excluded record. Use `toBackgroundJobUserFacingRecord` before UI/API exposure. */
export type BackgroundJobSafeRecord = Readonly<{
  id: string;
  kind: BackgroundJobKind;
  contractVersion: number;
  subjectType: string;
  subjectId: string;
  projectId: string | null;
  status: BackgroundJobStatus;
  currentPhase: string;
  priority: number;
  intentKey: string;
  inputHash: string;
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt: string;
  leaseOwner: string | null;
  leaseExpiresAt: string | null;
  lastHeartbeatAt: string | null;
  cancellationRequestedAt: string | null;
  rolloutMode: BackgroundJobRolloutMode;
  executionOwner: BackgroundJobExecutionOwner;
  safeProgress: BackgroundJobSafeSummary;
  safeResult: BackgroundJobSafeSummary;
  errorCode: string | null;
  errorMessage: string | null;
  providerName: string | null;
  providerMessageId: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}>;

export type BackgroundJobQueueMessage = Readonly<{
  jobId: string;
  contractVersion: number;
}>;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isSafeSummaryValue(value: unknown, ancestors: Set<object>): boolean {
  if (value === null || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string') return value.length <= BACKGROUND_JOB_SAFE_SUMMARY_MAX_STRING_LENGTH;
  if (typeof value !== 'object' || !value || ancestors.has(value)) return false;

  ancestors.add(value);
  const safe = Array.isArray(value)
    ? value.every((item) => isSafeSummaryValue(item, ancestors))
    : isPlainRecord(value) &&
      Object.entries(value).every(
        ([key, child]) => !BACKGROUND_JOB_UNSAFE_SUMMARY_KEY.test(key) && isSafeSummaryValue(child, ancestors),
      );
  ancestors.delete(value);
  return safe;
}

export function isBackgroundJobSafeSummary(value: unknown): value is BackgroundJobSafeSummary {
  try {
    if (!isPlainRecord(value) || !isSafeSummaryValue(value, new Set())) return false;
    const serialized = JSON.stringify(value);
    return new TextEncoder().encode(serialized).byteLength <= BACKGROUND_JOB_SAFE_SUMMARY_MAX_BYTES;
  } catch {
    return false;
  }
}

export function assertBackgroundJobSafeSummary(value: unknown): asserts value is BackgroundJobSafeSummary {
  if (!isBackgroundJobSafeSummary(value)) {
    throw new Error('Unsafe background-job summary');
  }
}

export function isBackgroundJobQueueMessage(value: unknown): value is BackgroundJobQueueMessage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return (
    keys.length === 2 &&
    keys[0] === 'contractVersion' &&
    keys[1] === 'jobId' &&
    typeof record.jobId === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(record.jobId) &&
    Number.isInteger(record.contractVersion) &&
    Number(record.contractVersion) > 0 &&
    Number(record.contractVersion) <= 2_147_483_647
  );
}
