import {
  BACKGROUND_JOB_EFFECT_STATES,
  BACKGROUND_JOB_EVENT_TYPES,
  BACKGROUND_JOB_EXECUTION_OWNERS,
  BACKGROUND_JOB_KINDS,
  BACKGROUND_JOB_ROLLOUT_MODES,
  BACKGROUND_JOB_STATUSES,
  isBackgroundJobSafeEffectSummary,
  isBackgroundJobSafeEventSummary,
  isBackgroundJobSafeProgressSummary,
  isBackgroundJobSafeResultSummary,
  isBackgroundJobSafeWorkerSummary,
  type BackgroundJobEffectState,
  type BackgroundJobEventType,
  type BackgroundJobExecutionOwner,
  type BackgroundJobKind,
  type BackgroundJobRolloutMode,
  type BackgroundJobSafeEffectSummary,
  type BackgroundJobSafeEventSummary,
  type BackgroundJobSafeProgressSummary,
  type BackgroundJobSafeRecord,
  type BackgroundJobSafeResultSummary,
  type BackgroundJobStatus,
} from './contracts';
import { BACKGROUND_JOB_REGISTRY, getBackgroundJobDefinition } from './registry';
import { LEASED_BACKGROUND_JOB_STATUSES } from './stateMachine';
import {
  BACKGROUND_JOB_PROTECTED_PAYLOAD_MAX_BYTES,
  BACKGROUND_JOB_WORKER_LIFECYCLE_STATES,
  BACKGROUND_JOB_WORKER_MODES,
  type BackgroundJobClaim,
  type BackgroundJobJsonObject,
  type BackgroundJobJsonValue,
  type BackgroundJobProtectedPayload,
  type BackgroundJobReconciliationResult,
  type BackgroundJobRuntimeContext,
  type BackgroundJobsQueueHealth,
  type BackgroundJobsRuntimeMetrics,
  type BackgroundJobSafeEventRecord,
  type BackgroundJobWorkerEffect,
  type BackgroundJobWorkerHeartbeat,
  type BackgroundWorkerSafeRecord,
} from './workerContractTypes';

type BackgroundWorkerRecord = BackgroundJobWorkerHeartbeat;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH_PATTERN = /^[0-9a-f]{64}$/;
const PHASE_PATTERN = /^[a-z][a-z0-9_]{1,63}$/;
const SUBJECT_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const EFFECT_KEY_PATTERN = /^[A-Za-z0-9._:/-]{1,256}$/;
const EFFECT_KIND_PATTERN = /^[a-z][a-z0-9_]{1,63}$/;
const PROVIDER_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
const PROVIDER_KEY_PATTERN = /^[A-Za-z0-9._:/-]{1,256}$/;
const PROVIDER_MESSAGE_PATTERN = /^[A-Za-z0-9._:-]{1,256}$/;
const ERROR_CODE_PATTERN = /^[A-Z0-9_]{1,96}$/;
const BUILD_OR_WORKER_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const ALLOWED_EFFECT_KINDS = new Set<string>(
  Object.values(BACKGROUND_JOB_REGISTRY).flatMap((definition) => [...definition.allowedEffectCheckpoints]),
);
const TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|([+-])(\d{2}):(\d{2}))$/;

function invalid(label: string, detail: string): never {
  throw new TypeError(`Invalid ${label} contract: ${detail}`);
}

function exactRecord(value: unknown, fields: readonly string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(label, 'expected an object');
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) invalid(label, 'expected a plain object');

  const expected = new Set(fields);
  const keys = Reflect.ownKeys(value);
  if (keys.length !== fields.length || keys.some((key) => typeof key !== 'string' || !expected.has(key))) {
    invalid(label, `expected exactly ${fields.join(', ')}`);
  }

  const snapshot: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const field of fields) {
    const descriptor = Object.getOwnPropertyDescriptor(value, field);
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
      invalid(label, `${field} must be an enumerable data property`);
    }
    snapshot[field] = descriptor.value;
  }
  return snapshot;
}

function exactArray(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value) || Object.getOwnPropertySymbols(value).length > 0) {
    return invalid(label, 'expected an array');
  }
  const names = Object.getOwnPropertyNames(value);
  if (names.length !== value.length + 1 || !names.includes('length')) {
    return invalid(label, 'expected a dense array');
  }
  const items: unknown[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
      return invalid(label, `item ${index} must be an enumerable data property`);
    }
    items.push(descriptor.value);
  }
  return items;
}

function oneOf<const Values extends readonly string[]>(
  value: unknown,
  values: Values,
  label: string,
): Values[number] {
  if (typeof value !== 'string' || !(values as readonly string[]).includes(value)) {
    return invalid(label, `expected one of ${values.join(', ')}`);
  }
  return value as Values[number];
}

function stringMatching(value: unknown, pattern: RegExp, label: string): string {
  if (typeof value !== 'string' || !pattern.test(value)) return invalid(label, 'unexpected string value');
  return value;
}

function integerBetween(value: unknown, minimum: number, maximum: number, label: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    return invalid(label, `expected an integer from ${minimum} to ${maximum}`);
  }
  return Number(value);
}

function nullable<T>(value: unknown, parse: (candidate: unknown) => T): T | null {
  return value === null ? null : parse(value);
}

function timestamp(value: unknown, label: string): string {
  if (typeof value !== 'string') return invalid(label, 'expected an ISO timestamp');
  const match = TIMESTAMP_PATTERN.exec(value);
  if (!match) return invalid(label, 'expected an ISO timestamp');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = Number(match[10] ?? 0);
  const offsetMinute = Number(match[11] ?? 0);
  if (
    year < 2_000 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > new Date(Date.UTC(year, month, 0)).getUTCDate() ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHour > 14 ||
    offsetMinute > 59 ||
    (offsetHour === 14 && offsetMinute !== 0) ||
    !Number.isFinite(Date.parse(value))
  ) {
    return invalid(label, 'expected a valid ISO timestamp');
  }
  return value;
}

function jsonValue(value: unknown, label: string, ancestors = new WeakSet<object>(), depth = 0): BackgroundJobJsonValue {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return invalid(label, 'JSON numbers must be finite');
    return value;
  }
  if (!value || typeof value !== 'object') return invalid(label, 'expected JSON data');
  if (depth >= 64) return invalid(label, 'JSON nesting exceeds 64 levels');
  if (ancestors.has(value)) return invalid(label, 'JSON data must not be cyclic');
  ancestors.add(value);

  let result: BackgroundJobJsonValue;
  if (Array.isArray(value)) {
    result = Object.freeze(
      exactArray(value, label).map((item, index) => jsonValue(item, `${label}[${index}]`, ancestors, depth + 1)),
    );
  } else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return invalid(label, 'expected plain JSON objects');
    const entries: [string, BackgroundJobJsonValue][] = [];
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== 'string') return invalid(label, 'JSON objects cannot have symbol keys');
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) {
        return invalid(label, `${key} must be an enumerable data property`);
      }
      entries.push([key, jsonValue(descriptor.value, `${label}.${key}`, ancestors, depth + 1)]);
    }
    result = Object.freeze(Object.fromEntries(entries)) as Readonly<Record<string, BackgroundJobJsonValue>>;
  }
  ancestors.delete(value);
  return result;
}

function jsonObject(value: unknown, label: string): BackgroundJobJsonObject {
  const parsed = jsonValue(value, label);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return invalid(label, 'expected a JSON object');
  const serialized = JSON.stringify(parsed);
  if (new TextEncoder().encode(serialized).byteLength > BACKGROUND_JOB_PROTECTED_PAYLOAD_MAX_BYTES) {
    return invalid(label, `JSON object exceeds ${BACKGROUND_JOB_PROTECTED_PAYLOAD_MAX_BYTES} bytes`);
  }
  return parsed as BackgroundJobJsonObject;
}

function safeSummary<T>(value: unknown, validate: (candidate: unknown) => candidate is T, label: string): T {
  if (!validate(value)) return invalid(label, 'unsafe summary');
  return jsonValue(value, label) as T;
}

function jobKind(value: unknown, label: string): BackgroundJobKind {
  return oneOf(value, BACKGROUND_JOB_KINDS, label);
}

function contractVersion(value: unknown, kind: BackgroundJobKind, label: string): number {
  const parsed = integerBetween(value, 1, 2_147_483_647, label);
  getBackgroundJobDefinition(kind, parsed);
  return parsed;
}

function countMap<const Keys extends readonly string[]>(
  value: unknown,
  keys: Keys,
  label: string,
): Readonly<Record<Keys[number], number>> {
  const record = exactRecord(value, keys, label);
  return Object.freeze(
    Object.fromEntries(keys.map((key) => [key, integerBetween(record[key], 0, Number.MAX_SAFE_INTEGER, `${label}.${key}`)])),
  ) as Readonly<Record<Keys[number], number>>;
}

function parseWorkerBase(value: unknown, includeStale: boolean): BackgroundWorkerRecord & { isStale?: boolean } {
  const fields = [
    'worker_id',
    'mode',
    'lifecycle_state',
    'build_version',
    'global_concurrency',
    'active_job_count',
    'safe_metadata',
    'started_at',
    'last_heartbeat_at',
    'shutdown_requested_at',
    'stopped_at',
    'updated_at',
    ...(includeStale ? ['is_stale'] : []),
  ];
  const row = exactRecord(value, fields, includeStale ? 'background-worker safe record' : 'background-worker heartbeat');
  const parsed = {
    workerId: stringMatching(row.worker_id, BUILD_OR_WORKER_ID_PATTERN, 'worker_id'),
    mode: oneOf(row.mode, BACKGROUND_JOB_WORKER_MODES, 'mode'),
    lifecycleState: oneOf(row.lifecycle_state, BACKGROUND_JOB_WORKER_LIFECYCLE_STATES, 'lifecycle_state'),
    buildVersion: nullable(row.build_version, (item) => stringMatching(item, BUILD_OR_WORKER_ID_PATTERN, 'build_version')),
    globalConcurrency: integerBetween(row.global_concurrency, 1, 100, 'global_concurrency'),
    activeJobCount: integerBetween(row.active_job_count, 0, 100, 'active_job_count'),
    safeMetadata: safeSummary(row.safe_metadata, isBackgroundJobSafeWorkerSummary, 'safe_metadata'),
    startedAt: timestamp(row.started_at, 'started_at'),
    lastHeartbeatAt: timestamp(row.last_heartbeat_at, 'last_heartbeat_at'),
    shutdownRequestedAt: nullable(row.shutdown_requested_at, (item) => timestamp(item, 'shutdown_requested_at')),
    stoppedAt: nullable(row.stopped_at, (item) => timestamp(item, 'stopped_at')),
    updatedAt: timestamp(row.updated_at, 'updated_at'),
    ...(includeStale
      ? {
          isStale:
            typeof row.is_stale === 'boolean'
              ? row.is_stale
              : invalid('is_stale', 'expected a boolean'),
        }
      : {}),
  };
  return Object.freeze(parsed);
}

export function parseBackgroundJobClaim(value: unknown): BackgroundJobClaim {
  const row = exactRecord(
    value,
    [
      'job_id',
      'kind',
      'contract_version',
      'status',
      'current_phase',
      'attempt_number',
      'max_attempts',
      'queue_message_id',
      'lease_token',
      'lease_expires_at',
      'cancellation_requested_at',
      'rollout_mode',
      'execution_owner',
    ],
    'background-job claim',
  );
  const kind = jobKind(row.kind, 'kind');
  const status = oneOf(row.status, BACKGROUND_JOB_STATUSES, 'status');
  if (!(LEASED_BACKGROUND_JOB_STATUSES as readonly BackgroundJobStatus[]).includes(status)) {
    return invalid('background-job claim', 'status must hold an active lease');
  }
  const attemptNumber = integerBetween(row.attempt_number, 1, 100, 'attempt_number');
  const maxAttempts = integerBetween(row.max_attempts, 1, 100, 'max_attempts');
  if (attemptNumber > maxAttempts) return invalid('background-job claim', 'attempt exceeds maximum attempts');
  return Object.freeze({
    jobId: stringMatching(row.job_id, UUID_PATTERN, 'job_id'),
    kind,
    contractVersion: contractVersion(row.contract_version, kind, 'contract_version'),
    status,
    currentPhase: stringMatching(row.current_phase, PHASE_PATTERN, 'current_phase'),
    attemptNumber,
    maxAttempts,
    queueMessageId: integerBetween(row.queue_message_id, 1, Number.MAX_SAFE_INTEGER, 'queue_message_id'),
    leaseToken: stringMatching(row.lease_token, UUID_PATTERN, 'lease_token'),
    leaseExpiresAt: timestamp(row.lease_expires_at, 'lease_expires_at'),
    cancellationRequestedAt: nullable(row.cancellation_requested_at, (item) =>
      timestamp(item, 'cancellation_requested_at'),
    ),
    rolloutMode: oneOf(row.rollout_mode, BACKGROUND_JOB_ROLLOUT_MODES, 'rollout_mode'),
    executionOwner: oneOf(row.execution_owner, BACKGROUND_JOB_EXECUTION_OWNERS, 'execution_owner'),
  });
}

export function parseBackgroundJobClaims(value: unknown): readonly BackgroundJobClaim[] {
  return Object.freeze(exactArray(value, 'background-job claims').map(parseBackgroundJobClaim));
}

export function parseBackgroundJobProtectedPayload(value: unknown): BackgroundJobProtectedPayload {
  const row = exactRecord(value, ['contract_version', 'payload_hash', 'payload'], 'background-job protected payload');
  return Object.freeze({
    contractVersion: integerBetween(row.contract_version, 1, 2_147_483_647, 'contract_version'),
    payloadHash: stringMatching(row.payload_hash, HASH_PATTERN, 'payload_hash'),
    payload: jsonObject(row.payload, 'payload'),
  });
}

export function parseBackgroundJobWorkerEffect(value: unknown): BackgroundJobWorkerEffect {
  const row = exactRecord(
    value,
    [
      'effect_key',
      'effect_kind',
      'state',
      'payload_hash',
      'provider_name',
      'provider_idempotency_key',
      'provider_idempotency_expires_at',
      'provider_message_id',
      'safe_metadata',
    ],
    'background-job worker effect',
  );
  const effectKind = stringMatching(row.effect_kind, EFFECT_KIND_PATTERN, 'effect_kind');
  if (!ALLOWED_EFFECT_KINDS.has(effectKind)) {
    return invalid('effect_kind', 'effect is not declared by the shared job registry');
  }
  const state = oneOf(row.state, BACKGROUND_JOB_EFFECT_STATES, 'state');
  const providerName = nullable(row.provider_name, (item) => stringMatching(item, PROVIDER_PATTERN, 'provider_name'));
  const providerIdempotencyKey = nullable(row.provider_idempotency_key, (item) =>
    stringMatching(item, PROVIDER_KEY_PATTERN, 'provider_idempotency_key'),
  );
  const providerIdempotencyExpiresAt = nullable(row.provider_idempotency_expires_at, (item) =>
    timestamp(item, 'provider_idempotency_expires_at'),
  );
  const providerMessageId = nullable(row.provider_message_id, (item) =>
    stringMatching(item, PROVIDER_MESSAGE_PATTERN, 'provider_message_id'),
  );
  const hasCompleteIdentity =
    providerName !== null && providerIdempotencyKey !== null && providerIdempotencyExpiresAt !== null;
  const hasAnyIdentity =
    providerName !== null || providerIdempotencyKey !== null || providerIdempotencyExpiresAt !== null;
  if (hasAnyIdentity && !hasCompleteIdentity) {
    return invalid('background-job worker effect', 'provider identity must be complete or absent');
  }
  if (state !== 'prepared' && !hasCompleteIdentity) {
    return invalid('background-job worker effect', 'non-prepared effects require frozen provider identity');
  }
  if ((state === 'provider_accepted' || state === 'finalised') && providerMessageId === null) {
    return invalid('background-job worker effect', 'accepted effects require a provider message ID');
  }
  if (providerMessageId !== null && providerName === null) {
    return invalid('background-job worker effect', 'provider message ID requires provider identity');
  }
  return Object.freeze({
    effectKey: stringMatching(row.effect_key, EFFECT_KEY_PATTERN, 'effect_key'),
    effectKind,
    state,
    payloadHash: stringMatching(row.payload_hash, HASH_PATTERN, 'payload_hash'),
    providerName,
    providerIdempotencyKey,
    providerIdempotencyExpiresAt,
    providerMessageId,
    safeMetadata: safeSummary(row.safe_metadata, isBackgroundJobSafeEffectSummary, 'safe_metadata'),
  });
}

export function parseBackgroundJobWorkerEffects(value: unknown): readonly BackgroundJobWorkerEffect[] {
  return Object.freeze(exactArray(value, 'background-job worker effects').map(parseBackgroundJobWorkerEffect));
}

export function parseBackgroundJobSafeRecord(value: unknown): BackgroundJobSafeRecord {
  const row = exactRecord(
    value,
    [
      'id',
      'kind',
      'contract_version',
      'subject_type',
      'subject_id',
      'project_id',
      'status',
      'current_phase',
      'priority',
      'attempt_count',
      'max_attempts',
      'next_attempt_at',
      'cancellation_requested_at',
      'rollout_mode',
      'execution_owner',
      'safe_progress',
      'safe_result',
      'error_code',
      'created_at',
      'updated_at',
      'started_at',
      'completed_at',
    ],
    'background-job safe record',
  );
  const kind = jobKind(row.kind, 'kind');
  return Object.freeze({
    id: stringMatching(row.id, UUID_PATTERN, 'id'),
    kind,
    contractVersion: contractVersion(row.contract_version, kind, 'contract_version'),
    subjectType: stringMatching(row.subject_type, PHASE_PATTERN, 'subject_type'),
    subjectId: stringMatching(row.subject_id, SUBJECT_ID_PATTERN, 'subject_id'),
    projectId: nullable(row.project_id, (item) => stringMatching(item, UUID_PATTERN, 'project_id')),
    status: oneOf(row.status, BACKGROUND_JOB_STATUSES, 'status'),
    currentPhase: stringMatching(row.current_phase, PHASE_PATTERN, 'current_phase'),
    priority: integerBetween(row.priority, 0, 1_000, 'priority'),
    attemptCount: integerBetween(row.attempt_count, 0, Number.MAX_SAFE_INTEGER, 'attempt_count'),
    maxAttempts: integerBetween(row.max_attempts, 1, 100, 'max_attempts'),
    nextAttemptAt: timestamp(row.next_attempt_at, 'next_attempt_at'),
    cancellationRequestedAt: nullable(row.cancellation_requested_at, (item) =>
      timestamp(item, 'cancellation_requested_at'),
    ),
    rolloutMode: oneOf(row.rollout_mode, BACKGROUND_JOB_ROLLOUT_MODES, 'rollout_mode'),
    executionOwner: oneOf(row.execution_owner, BACKGROUND_JOB_EXECUTION_OWNERS, 'execution_owner'),
    safeProgress: safeSummary(row.safe_progress, isBackgroundJobSafeProgressSummary, 'safe_progress'),
    safeResult: safeSummary(row.safe_result, isBackgroundJobSafeResultSummary, 'safe_result'),
    errorCode: nullable(row.error_code, (item) => stringMatching(item, ERROR_CODE_PATTERN, 'error_code')),
    createdAt: timestamp(row.created_at, 'created_at'),
    updatedAt: timestamp(row.updated_at, 'updated_at'),
    startedAt: nullable(row.started_at, (item) => timestamp(item, 'started_at')),
    completedAt: nullable(row.completed_at, (item) => timestamp(item, 'completed_at')),
  });
}

export function parseBackgroundJobSafeRecords(value: unknown): readonly BackgroundJobSafeRecord[] {
  return Object.freeze(exactArray(value, 'background-job safe records').map(parseBackgroundJobSafeRecord));
}

export function parseBackgroundJobSafeEventRecord(value: unknown): BackgroundJobSafeEventRecord {
  const row = exactRecord(
    value,
    [
      'id',
      'job_id',
      'event_type',
      'from_status',
      'to_status',
      'phase',
      'attempt_number',
      'error_code',
      'safe_detail',
      'created_at',
    ],
    'background-job safe event',
  );
  return Object.freeze({
    id: integerBetween(row.id, 1, Number.MAX_SAFE_INTEGER, 'id'),
    jobId: stringMatching(row.job_id, UUID_PATTERN, 'job_id'),
    eventType: oneOf(row.event_type, BACKGROUND_JOB_EVENT_TYPES, 'event_type'),
    fromStatus: nullable(row.from_status, (item) => oneOf(item, BACKGROUND_JOB_STATUSES, 'from_status')),
    toStatus: nullable(row.to_status, (item) => oneOf(item, BACKGROUND_JOB_STATUSES, 'to_status')),
    phase: nullable(row.phase, (item) => stringMatching(item, PHASE_PATTERN, 'phase')),
    attemptNumber: nullable(row.attempt_number, (item) =>
      integerBetween(item, 0, Number.MAX_SAFE_INTEGER, 'attempt_number'),
    ),
    errorCode: nullable(row.error_code, (item) => stringMatching(item, ERROR_CODE_PATTERN, 'error_code')),
    safeDetail: safeSummary(row.safe_detail, isBackgroundJobSafeEventSummary, 'safe_detail'),
    createdAt: timestamp(row.created_at, 'created_at'),
  });
}

export function parseBackgroundJobSafeEventRecords(value: unknown): readonly BackgroundJobSafeEventRecord[] {
  return Object.freeze(exactArray(value, 'background-job safe events').map(parseBackgroundJobSafeEventRecord));
}

export function parseBackgroundJobRuntimeContext(value: unknown): BackgroundJobRuntimeContext {
  const row = exactRecord(
    value,
    [
      'job_id',
      'kind',
      'contract_version',
      'status',
      'current_phase',
      'attempt_count',
      'max_attempts',
      'started_at',
      'cancellation_requested_at',
      'rollout_mode',
      'execution_owner',
    ],
    'background-job runtime context',
  );
  const kind = jobKind(row.kind, 'kind');
  const status = oneOf(row.status, BACKGROUND_JOB_STATUSES, 'status');
  if (!(LEASED_BACKGROUND_JOB_STATUSES as readonly BackgroundJobStatus[]).includes(status)) {
    return invalid('background-job runtime context', 'status must hold an active lease');
  }
  const attemptCount = integerBetween(row.attempt_count, 1, 100, 'attempt_count');
  const maxAttempts = integerBetween(row.max_attempts, 1, 100, 'max_attempts');
  if (attemptCount > maxAttempts) return invalid('background-job runtime context', 'attempt exceeds maximum attempts');
  return Object.freeze({
    jobId: stringMatching(row.job_id, UUID_PATTERN, 'job_id'),
    kind,
    contractVersion: contractVersion(row.contract_version, kind, 'contract_version'),
    status,
    currentPhase: stringMatching(row.current_phase, PHASE_PATTERN, 'current_phase'),
    attemptCount,
    maxAttempts,
    startedAt: timestamp(row.started_at, 'started_at'),
    cancellationRequestedAt: nullable(row.cancellation_requested_at, (item) =>
      timestamp(item, 'cancellation_requested_at'),
    ),
    rolloutMode: oneOf(row.rollout_mode, BACKGROUND_JOB_ROLLOUT_MODES, 'rollout_mode'),
    executionOwner: oneOf(row.execution_owner, BACKGROUND_JOB_EXECUTION_OWNERS, 'execution_owner'),
  });
}

export function parseBackgroundJobWorkerHeartbeat(value: unknown): BackgroundJobWorkerHeartbeat {
  return parseWorkerBase(value, false);
}

export function parseBackgroundWorkerSafeRecord(value: unknown): BackgroundWorkerSafeRecord {
  return parseWorkerBase(value, true) as BackgroundWorkerSafeRecord;
}

export function parseBackgroundWorkerSafeRecords(value: unknown): readonly BackgroundWorkerSafeRecord[] {
  return Object.freeze(exactArray(value, 'background-worker safe records').map(parseBackgroundWorkerSafeRecord));
}

export function parseBackgroundJobReconciliationResult(value: unknown): BackgroundJobReconciliationResult {
  const row = exactRecord(
    value,
    ['archivedMessages', 'repairedMessages', 'recoveredLeases'],
    'background-job reconciliation result',
  );
  return Object.freeze({
    archivedMessages: integerBetween(row.archivedMessages, 0, Number.MAX_SAFE_INTEGER, 'archivedMessages'),
    repairedMessages: integerBetween(row.repairedMessages, 0, Number.MAX_SAFE_INTEGER, 'repairedMessages'),
    recoveredLeases: integerBetween(row.recoveredLeases, 0, Number.MAX_SAFE_INTEGER, 'recoveredLeases'),
  });
}

export function parseBackgroundJobsQueueHealth(value: unknown): BackgroundJobsQueueHealth {
  const row = exactRecord(
    value,
    [
      'queue_depth',
      'oldest_message_age_seconds',
      'total_messages',
      'queued_jobs',
      'active_jobs',
      'retrying_jobs',
      'attention_jobs',
      'stale_workers',
      'measured_at',
    ],
    'background-jobs queue health',
  );
  return Object.freeze({
    queueDepth: integerBetween(row.queue_depth, 0, Number.MAX_SAFE_INTEGER, 'queue_depth'),
    oldestMessageAgeSeconds: nullable(row.oldest_message_age_seconds, (item) =>
      integerBetween(item, 0, Number.MAX_SAFE_INTEGER, 'oldest_message_age_seconds'),
    ),
    totalMessages: integerBetween(row.total_messages, 0, Number.MAX_SAFE_INTEGER, 'total_messages'),
    queuedJobs: integerBetween(row.queued_jobs, 0, Number.MAX_SAFE_INTEGER, 'queued_jobs'),
    activeJobs: integerBetween(row.active_jobs, 0, Number.MAX_SAFE_INTEGER, 'active_jobs'),
    retryingJobs: integerBetween(row.retrying_jobs, 0, Number.MAX_SAFE_INTEGER, 'retrying_jobs'),
    attentionJobs: integerBetween(row.attention_jobs, 0, Number.MAX_SAFE_INTEGER, 'attention_jobs'),
    staleWorkers: integerBetween(row.stale_workers, 0, Number.MAX_SAFE_INTEGER, 'stale_workers'),
    measuredAt: timestamp(row.measured_at, 'measured_at'),
  });
}

export function parseBackgroundJobsRuntimeMetrics(value: unknown): BackgroundJobsRuntimeMetrics {
  const row = exactRecord(
    value,
    [
      'queue_depth',
      'oldest_message_age_seconds',
      'oldest_job_age_seconds',
      'due_jobs',
      'next_due_at',
      'status_counts',
      'kind_counts',
      'worker_lifecycle_counts',
      'stale_workers',
      'measured_at',
    ],
    'background-jobs runtime metrics',
  );
  return Object.freeze({
    queueDepth: integerBetween(row.queue_depth, 0, Number.MAX_SAFE_INTEGER, 'queue_depth'),
    oldestMessageAgeSeconds: nullable(row.oldest_message_age_seconds, (item) =>
      integerBetween(item, 0, Number.MAX_SAFE_INTEGER, 'oldest_message_age_seconds'),
    ),
    oldestJobAgeSeconds: integerBetween(
      row.oldest_job_age_seconds,
      0,
      Number.MAX_SAFE_INTEGER,
      'oldest_job_age_seconds',
    ),
    dueJobs: integerBetween(row.due_jobs, 0, Number.MAX_SAFE_INTEGER, 'due_jobs'),
    nextDueAt: nullable(row.next_due_at, (item) => timestamp(item, 'next_due_at')),
    statusCounts: countMap(row.status_counts, BACKGROUND_JOB_STATUSES, 'status_counts'),
    kindCounts: countMap(row.kind_counts, BACKGROUND_JOB_KINDS, 'kind_counts'),
    workerLifecycleCounts: countMap(
      row.worker_lifecycle_counts,
      BACKGROUND_JOB_WORKER_LIFECYCLE_STATES,
      'worker_lifecycle_counts',
    ),
    staleWorkers: integerBetween(row.stale_workers, 0, Number.MAX_SAFE_INTEGER, 'stale_workers'),
    measuredAt: timestamp(row.measured_at, 'measured_at'),
  });
}
