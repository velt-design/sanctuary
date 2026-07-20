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
export const BACKGROUND_JOB_SAFE_SUMMARY_MAX_STRING_LENGTH = 128;
export const BACKGROUND_JOB_SAFE_SUMMARY_MAX_ARRAY_LENGTH = 50;

type BackgroundJobSafeSummaryFieldKind =
  | 'identifier'
  | 'identifier_array'
  | 'code'
  | 'nullable_code'
  | 'code_array'
  | 'count'
  | 'percentage'
  | 'boolean'
  | 'timestamp';

type BackgroundJobSafeSummaryFieldValue<Kind extends BackgroundJobSafeSummaryFieldKind> = Kind extends
  | 'identifier'
  | 'code'
  | 'timestamp'
  ? string
  : Kind extends 'nullable_code'
    ? string | null
    : Kind extends 'identifier_array' | 'code_array'
      ? readonly string[]
      : Kind extends 'count' | 'percentage'
        ? number
        : Kind extends 'boolean'
          ? boolean
          : never;

type BackgroundJobSafeSummaryFromFields<Fields extends Record<string, BackgroundJobSafeSummaryFieldKind>> = Readonly<
  Partial<{
    [Key in keyof Fields]: BackgroundJobSafeSummaryFieldValue<Fields[Key]>;
  }>
>;

const BACKGROUND_JOB_SAFE_PROGRESS_SUMMARY_FIELDS = {
  phase: 'code',
  progressCode: 'code',
  completedPhases: 'code_array',
  pendingPhases: 'code_array',
  currentCount: 'count',
  totalCount: 'count',
  processedCount: 'count',
  completedCount: 'count',
  succeededCount: 'count',
  failedCount: 'count',
  skippedCount: 'count',
  artifactCount: 'count',
  fileCount: 'count',
  pageCount: 'count',
  percentComplete: 'percentage',
  cached: 'boolean',
  reused: 'boolean',
  retryable: 'boolean',
  startedAt: 'timestamp',
  updatedAt: 'timestamp',
  completedAt: 'timestamp',
} as const satisfies Record<string, BackgroundJobSafeSummaryFieldKind>;

const BACKGROUND_JOB_SAFE_RESULT_SUMMARY_FIELDS = {
  phase: 'code',
  resultCode: 'code',
  artifactId: 'identifier',
  documentId: 'identifier',
  invoiceId: 'identifier',
  quoteId: 'identifier',
  jobPackId: 'identifier',
  outboxId: 'identifier',
  automationEventId: 'identifier',
  artifactIds: 'identifier_array',
  documentIds: 'identifier_array',
  artifactCount: 'count',
  fileCount: 'count',
  pageCount: 'count',
  processedCount: 'count',
  succeededCount: 'count',
  failedCount: 'count',
  skippedCount: 'count',
  cached: 'boolean',
  reused: 'boolean',
  providerAccepted: 'boolean',
  generatedAt: 'timestamp',
  providerAcceptedAt: 'timestamp',
  completedAt: 'timestamp',
} as const satisfies Record<string, BackgroundJobSafeSummaryFieldKind>;

const BACKGROUND_JOB_SAFE_EFFECT_SUMMARY_FIELDS = {
  effectKind: 'code',
  checkpoint: 'code',
  previousCheckpoint: 'nullable_code',
  resultCode: 'code',
  providerName: 'code',
  effectId: 'identifier',
  providerMessageId: 'identifier',
  attemptNumber: 'count',
  providerStatusCode: 'count',
  durationMs: 'count',
  providerAccepted: 'boolean',
  retryable: 'boolean',
  dispatchStartedAt: 'timestamp',
  providerAcceptedAt: 'timestamp',
  finalisedAt: 'timestamp',
} as const satisfies Record<string, BackgroundJobSafeSummaryFieldKind>;

const BACKGROUND_JOB_SAFE_EVENT_SUMMARY_FIELDS = {
  ...BACKGROUND_JOB_SAFE_PROGRESS_SUMMARY_FIELDS,
  ...BACKGROUND_JOB_SAFE_RESULT_SUMMARY_FIELDS,
  ...BACKGROUND_JOB_SAFE_EFFECT_SUMMARY_FIELDS,
  reason: 'code',
  kind: 'code',
  owner: 'code',
  jobId: 'identifier',
  delaySeconds: 'count',
  queueMessageId: 'count',
  occurredAt: 'timestamp',
} as const satisfies Record<string, BackgroundJobSafeSummaryFieldKind>;

const BACKGROUND_JOB_SAFE_WORKER_SUMMARY_FIELDS = {
  mode: 'code',
  lifecycleState: 'code',
  buildVersion: 'code',
  supportedKinds: 'code_array',
  concurrencyClasses: 'code_array',
  globalConcurrency: 'count',
  activeJobCount: 'count',
  availableConcurrency: 'count',
  queueDepth: 'count',
  processedCount: 'count',
  succeededCount: 'count',
  failedCount: 'count',
  retryingCount: 'count',
  staleLeaseCount: 'count',
  uptimeSeconds: 'count',
  heartbeatIntervalSeconds: 'count',
  acceptingJobs: 'boolean',
  drainRequested: 'boolean',
  startedAt: 'timestamp',
  lastHeartbeatAt: 'timestamp',
  shutdownRequestedAt: 'timestamp',
} as const satisfies Record<string, BackgroundJobSafeSummaryFieldKind>;

export type BackgroundJobSafeProgressSummary = BackgroundJobSafeSummaryFromFields<
  typeof BACKGROUND_JOB_SAFE_PROGRESS_SUMMARY_FIELDS
>;

export type BackgroundJobSafeResultSummary = BackgroundJobSafeSummaryFromFields<
  typeof BACKGROUND_JOB_SAFE_RESULT_SUMMARY_FIELDS
>;

export type BackgroundJobSafeEffectSummary = BackgroundJobSafeSummaryFromFields<
  typeof BACKGROUND_JOB_SAFE_EFFECT_SUMMARY_FIELDS
>;

export type BackgroundJobSafeEventSummary = BackgroundJobSafeSummaryFromFields<
  typeof BACKGROUND_JOB_SAFE_EVENT_SUMMARY_FIELDS
>;

export type BackgroundJobSafeWorkerSummary = BackgroundJobSafeSummaryFromFields<
  typeof BACKGROUND_JOB_SAFE_WORKER_SUMMARY_FIELDS
>;

/** Explicit safe-inspection projection. Protected payload, lease, hash, provider, and raw-error fields are excluded. */
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
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt: string;
  cancellationRequestedAt: string | null;
  rolloutMode: BackgroundJobRolloutMode;
  executionOwner: BackgroundJobExecutionOwner;
  safeProgress: BackgroundJobSafeProgressSummary;
  safeResult: BackgroundJobSafeResultSummary;
  errorCode: string | null;
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

const BACKGROUND_JOB_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BACKGROUND_JOB_SAFE_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const BACKGROUND_JOB_LOWER_CODE_PATTERN = /^[a-z][a-z0-9]*(?:[._:-][a-z0-9]+)*$/;
const BACKGROUND_JOB_UPPER_CODE_PATTERN = /^[A-Z][A-Z0-9]*(?:[._:-][A-Z0-9]+)*$/;
const BACKGROUND_JOB_EMAIL_VALUE_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const BACKGROUND_JOB_CREDENTIAL_VALUE_PATTERN = /\b(?:bearer|basic)\s+[A-Za-z0-9+/_=-]{4,}/i;
const BACKGROUND_JOB_URL_VALUE_PATTERN = /\b[A-Z][A-Z0-9+.-]{1,31}:\/\//i;
const BACKGROUND_JOB_DOMAIN_VALUE_PATTERN =
  /(?:^|[^A-Z0-9_-])(?:[A-Z0-9-]+\.)+(?:app|au|co|com|dev|io|net|org|test)(?::\d+)?(?:[/?#]|$)/i;
const BACKGROUND_JOB_QUERY_SECRET_VALUE_PATTERN =
  /(?:^|[?&;\s])(?:access[_-]?token|api[_-]?key|authorization|code|credential|key|secret|signature|sig|token|x-amz-credential|x-amz-signature|x-goog-signature)=/i;
const BACKGROUND_JOB_JWT_VALUE_PATTERN = /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\b/;
const BACKGROUND_JOB_TOKEN_PREFIX_VALUE_PATTERN =
  /^(?:api[_-]?key|bearer|key|pk|secret|sig|sk|token)[._:-][A-Za-z0-9+/_=-]{16,}$/i;
const BACKGROUND_JOB_HEX_TOKEN_VALUE_PATTERN = /^[0-9a-f]{32,}$/i;
const BACKGROUND_JOB_BASE64_TOKEN_VALUE_PATTERN = /^[A-Za-z0-9+/_-]{48,}={0,2}$/;
const BACKGROUND_JOB_PEM_VALUE_PATTERN = /-----BEGIN [A-Z0-9 ]*(?:PRIVATE KEY|CREDENTIAL|TOKEN)-----/i;
const BACKGROUND_JOB_ISO_TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|([+-])(\d{2}):(\d{2}))$/;

/**
 * Defence-in-depth value screen shared by safe summaries, worker logs, and
 * other operational metadata. Callers must still apply their own structural
 * allowlist; this only identifies values that are obviously sensitive.
 */
export function isBackgroundJobObviouslySensitiveString(value: string): boolean {
  const trimmed = value.trim();
  return (
    BACKGROUND_JOB_EMAIL_VALUE_PATTERN.test(trimmed) ||
    BACKGROUND_JOB_CREDENTIAL_VALUE_PATTERN.test(trimmed) ||
    BACKGROUND_JOB_URL_VALUE_PATTERN.test(trimmed) ||
    BACKGROUND_JOB_DOMAIN_VALUE_PATTERN.test(trimmed) ||
    BACKGROUND_JOB_QUERY_SECRET_VALUE_PATTERN.test(trimmed) ||
    BACKGROUND_JOB_JWT_VALUE_PATTERN.test(trimmed) ||
    BACKGROUND_JOB_TOKEN_PREFIX_VALUE_PATTERN.test(trimmed) ||
    BACKGROUND_JOB_HEX_TOKEN_VALUE_PATTERN.test(trimmed) ||
    BACKGROUND_JOB_BASE64_TOKEN_VALUE_PATTERN.test(trimmed) ||
    BACKGROUND_JOB_PEM_VALUE_PATTERN.test(trimmed)
  );
}

function isSafeIdentifier(value: string): boolean {
  return (
    value.length <= BACKGROUND_JOB_SAFE_SUMMARY_MAX_STRING_LENGTH &&
    !isBackgroundJobObviouslySensitiveString(value) &&
    (BACKGROUND_JOB_UUID_PATTERN.test(value) ||
      (BACKGROUND_JOB_SAFE_IDENTIFIER_PATTERN.test(value) && /\d/.test(value)))
  );
}

function isSafeCode(value: string): boolean {
  return (
    value.length <= 96 &&
    !isBackgroundJobObviouslySensitiveString(value) &&
    (BACKGROUND_JOB_LOWER_CODE_PATTERN.test(value) || BACKGROUND_JOB_UPPER_CODE_PATTERN.test(value))
  );
}

function isIsoTimestamp(value: string): boolean {
  if (
    value.length > BACKGROUND_JOB_SAFE_SUMMARY_MAX_STRING_LENGTH ||
    isBackgroundJobObviouslySensitiveString(value)
  ) {
    return false;
  }

  const match = BACKGROUND_JOB_ISO_TIMESTAMP_PATTERN.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = Number(match[10] ?? 0);
  const offsetMinute = Number(match[11] ?? 0);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return (
    year >= 2_000 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth &&
    hour <= 23 &&
    minute <= 59 &&
    second <= 59 &&
    offsetHour <= 14 &&
    offsetMinute <= 59 &&
    (offsetHour < 14 || offsetMinute === 0) &&
    Number.isFinite(Date.parse(value))
  );
}

function isDenseDataArray(value: unknown): value is readonly unknown[] {
  if (!Array.isArray(value) || value.length > BACKGROUND_JOB_SAFE_SUMMARY_MAX_ARRAY_LENGTH) return false;
  if (Object.getOwnPropertySymbols(value).length > 0) return false;

  const names = Object.getOwnPropertyNames(value);
  if (names.length !== value.length + 1 || !names.includes('length')) return false;

  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) return false;
  }
  return true;
}

function hasAtMostSixFractionalDecimalPlaces(value: number): boolean {
  const [coefficient = '', exponentText] = value.toString().split('e');
  const fractionalDigitCount = coefficient.split('.')[1]?.length ?? 0;
  const exponent = exponentText === undefined ? 0 : Number(exponentText);
  return Math.max(0, fractionalDigitCount - exponent) <= 6;
}

function isSafeSummaryFieldValue(kind: BackgroundJobSafeSummaryFieldKind, value: unknown): boolean {
  switch (kind) {
    case 'identifier':
      return typeof value === 'string' && isSafeIdentifier(value);
    case 'identifier_array':
      return isDenseDataArray(value) && value.every((item) => typeof item === 'string' && isSafeIdentifier(item));
    case 'code':
      return typeof value === 'string' && isSafeCode(value);
    case 'nullable_code':
      return value === null || (typeof value === 'string' && isSafeCode(value));
    case 'code_array':
      return isDenseDataArray(value) && value.every((item) => typeof item === 'string' && isSafeCode(item));
    case 'count':
      return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
    case 'percentage':
      return (
        typeof value === 'number' &&
        Number.isFinite(value) &&
        value >= 0 &&
        value <= 100 &&
        hasAtMostSixFractionalDecimalPlaces(value)
      );
    case 'boolean':
      return typeof value === 'boolean';
    case 'timestamp':
      return typeof value === 'string' && isIsoTimestamp(value);
  }
}

function isBackgroundJobSafeSummaryForFields(
  value: unknown,
  fields: Readonly<Record<string, BackgroundJobSafeSummaryFieldKind>>,
): boolean {
  try {
    if (!isPlainRecord(value) || Object.getOwnPropertySymbols(value).length > 0) return false;

    const propertyNames = Object.getOwnPropertyNames(value);
    for (const key of propertyNames) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) return false;
      const kind = fields[key];
      if (!kind || !isSafeSummaryFieldValue(kind, descriptor.value)) return false;
    }

    const serialized = JSON.stringify(value);
    return (
      typeof serialized === 'string' &&
      new TextEncoder().encode(serialized).byteLength <= BACKGROUND_JOB_SAFE_SUMMARY_MAX_BYTES
    );
  } catch {
    return false;
  }
}

export function isBackgroundJobSafeProgressSummary(value: unknown): value is BackgroundJobSafeProgressSummary {
  return isBackgroundJobSafeSummaryForFields(value, BACKGROUND_JOB_SAFE_PROGRESS_SUMMARY_FIELDS);
}

export function assertBackgroundJobSafeProgressSummary(
  value: unknown,
): asserts value is BackgroundJobSafeProgressSummary {
  if (!isBackgroundJobSafeProgressSummary(value)) {
    throw new Error('Unsafe background-job progress summary');
  }
}

export function isBackgroundJobSafeResultSummary(value: unknown): value is BackgroundJobSafeResultSummary {
  return isBackgroundJobSafeSummaryForFields(value, BACKGROUND_JOB_SAFE_RESULT_SUMMARY_FIELDS);
}

export function assertBackgroundJobSafeResultSummary(value: unknown): asserts value is BackgroundJobSafeResultSummary {
  if (!isBackgroundJobSafeResultSummary(value)) {
    throw new Error('Unsafe background-job result summary');
  }
}

export function isBackgroundJobSafeEffectSummary(value: unknown): value is BackgroundJobSafeEffectSummary {
  return isBackgroundJobSafeSummaryForFields(value, BACKGROUND_JOB_SAFE_EFFECT_SUMMARY_FIELDS);
}

export function assertBackgroundJobSafeEffectSummary(value: unknown): asserts value is BackgroundJobSafeEffectSummary {
  if (!isBackgroundJobSafeEffectSummary(value)) {
    throw new Error('Unsafe background-job effect summary');
  }
}

export function isBackgroundJobSafeEventSummary(value: unknown): value is BackgroundJobSafeEventSummary {
  return isBackgroundJobSafeSummaryForFields(value, BACKGROUND_JOB_SAFE_EVENT_SUMMARY_FIELDS);
}

export function assertBackgroundJobSafeEventSummary(value: unknown): asserts value is BackgroundJobSafeEventSummary {
  if (!isBackgroundJobSafeEventSummary(value)) {
    throw new Error('Unsafe background-job event summary');
  }
}

export function isBackgroundJobSafeWorkerSummary(value: unknown): value is BackgroundJobSafeWorkerSummary {
  return isBackgroundJobSafeSummaryForFields(value, BACKGROUND_JOB_SAFE_WORKER_SUMMARY_FIELDS);
}

export function assertBackgroundJobSafeWorkerSummary(value: unknown): asserts value is BackgroundJobSafeWorkerSummary {
  if (!isBackgroundJobSafeWorkerSummary(value)) {
    throw new Error('Unsafe background-job worker summary');
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
    BACKGROUND_JOB_UUID_PATTERN.test(record.jobId) &&
    Number.isInteger(record.contractVersion) &&
    Number(record.contractVersion) > 0 &&
    Number(record.contractVersion) <= 2_147_483_647
  );
}
