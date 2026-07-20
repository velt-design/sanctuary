import {
  isBackgroundJobObviouslySensitiveString,
  type BackgroundJobConcurrencyClass,
  type BackgroundJobExecutionOwner,
  type BackgroundJobKind,
  type BackgroundJobStatus,
  type BackgroundJobWorkerLifecycleState,
  type BackgroundJobWorkerMode,
} from '@sp/jobs';

import type { BackgroundJobsRpcName } from './backgroundJobsRpcClient';

type WorkerLogLevel = 'debug' | 'info' | 'warn' | 'error';

export type SafeWorkerLogFields = Readonly<
  Partial<{
    workerId: string;
    mode: BackgroundJobWorkerMode;
    lifecycleState: BackgroundJobWorkerLifecycleState;
    jobId: string;
    kind: BackgroundJobKind;
    contractVersion: number;
    executionOwner: BackgroundJobExecutionOwner;
    concurrencyClass: BackgroundJobConcurrencyClass;
    status: BackgroundJobStatus;
    phase: string;
    attemptNumber: number;
    batchSize: number;
    activeJobCount: number;
    globalConcurrency: number;
    queueDepth: number;
    oldestMessageAgeSeconds: number;
    oldestJobAgeSeconds: number;
    dueJobs: number;
    staleWorkers: number;
    recoveredLeases: number;
    archivedMessages: number;
    repairedMessages: number;
    durationMs: number;
    delaySeconds: number;
    processedCount: number;
    succeededCount: number;
    failedCount: number;
    retryingCount: number;
    attentionCount: number;
    acceptingJobs: boolean;
    drainRequested: boolean;
    errorCode: string;
    reason: string;
    rpcName: BackgroundJobsRpcName;
    signal: 'SIGTERM' | 'SIGINT';
    exitCode: number;
  }>
>;

interface SafeWorkerLogger {
  debug(event: string, fields?: SafeWorkerLogFields): void;
  info(event: string, fields?: SafeWorkerLogFields): void;
  warn(event: string, fields?: SafeWorkerLogFields): void;
  error(event: string, fields?: SafeWorkerLogFields): void;
}

type LogDestination = Readonly<{ write(chunk: string): unknown }>;

type CreateWorkerLoggerOptions = Readonly<{
  stdout?: LogDestination;
  stderr?: LogDestination;
  now?: () => Date;
  minimumLevel?: WorkerLogLevel;
}>;

const SAFE_CODE_PATTERN = /^[A-Za-z][A-Za-z0-9._:-]{0,127}$/;
const SAFE_EVENT_PATTERN = /^(?:worker[._][a-z0-9_]+|background_job\.[a-z0-9_]+)$/;
const SAFE_PHASE_OR_REASON_PATTERN = /^(?:[a-z][a-z0-9_]{1,63}|[A-Z][A-Z0-9_]{1,95})$/;
const SAFE_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_WORKER_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const SAFE_UPPER_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,95}$/;
const LEVEL_PRIORITY: Readonly<Record<WorkerLogLevel, number>> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const NUMBER_FIELDS = new Set([
  'contractVersion',
  'attemptNumber',
  'batchSize',
  'activeJobCount',
  'globalConcurrency',
  'queueDepth',
  'oldestMessageAgeSeconds',
  'oldestJobAgeSeconds',
  'dueJobs',
  'staleWorkers',
  'recoveredLeases',
  'archivedMessages',
  'repairedMessages',
  'durationMs',
  'delaySeconds',
  'processedCount',
  'succeededCount',
  'failedCount',
  'retryingCount',
  'attentionCount',
  'exitCode',
]);
const BOOLEAN_FIELDS = new Set(['acceptingJobs', 'drainRequested']);
const CODE_FIELDS = new Set([
  'mode',
  'lifecycleState',
  'kind',
  'executionOwner',
  'concurrencyClass',
  'status',
  'rpcName',
  'signal',
]);
const UPPER_CODE_FIELDS = new Set(['errorCode']);

function sanitizeEvent(event: string): string {
  return SAFE_EVENT_PATTERN.test(event) && !isBackgroundJobObviouslySensitiveString(event)
    ? event
    : 'worker_log_event_rejected';
}

export function sanitizeWorkerLogFields(fields: SafeWorkerLogFields | undefined): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return output;

  for (const [key, value] of Object.entries(fields as Readonly<Record<string, unknown>>)) {
    if (NUMBER_FIELDS.has(key) && typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) {
      output[key] = value;
    } else if (BOOLEAN_FIELDS.has(key) && typeof value === 'boolean') {
      output[key] = value;
    } else if (
      CODE_FIELDS.has(key) &&
      typeof value === 'string' &&
      SAFE_CODE_PATTERN.test(value) &&
      !isBackgroundJobObviouslySensitiveString(value)
    ) {
      output[key] = value;
    } else if (
      UPPER_CODE_FIELDS.has(key) &&
      typeof value === 'string' &&
      SAFE_UPPER_CODE_PATTERN.test(value) &&
      !isBackgroundJobObviouslySensitiveString(value)
    ) {
      output[key] = value;
    } else if (
      (key === 'phase' || key === 'reason') &&
      typeof value === 'string' &&
      SAFE_PHASE_OR_REASON_PATTERN.test(value) &&
      !isBackgroundJobObviouslySensitiveString(value)
    ) {
      output[key] = value;
    } else if (
      key === 'workerId' &&
      typeof value === 'string' &&
      SAFE_WORKER_ID_PATTERN.test(value) &&
      !isBackgroundJobObviouslySensitiveString(value)
    ) {
      output.workerId = value;
    } else if (key === 'jobId' && typeof value === 'string' && SAFE_UUID_PATTERN.test(value)) {
      output.jobId = value;
    }
  }
  return output;
}

export function createWorkerLogger(options: CreateWorkerLoggerOptions = {}): SafeWorkerLogger {
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;
  const now = options.now ?? (() => new Date());
  const minimumPriority = LEVEL_PRIORITY[options.minimumLevel ?? 'info'];

  const log = (level: WorkerLogLevel, event: string, fields?: SafeWorkerLogFields): void => {
    if (LEVEL_PRIORITY[level] < minimumPriority) return;
    const record = {
      timestamp: now().toISOString(),
      level,
      event: sanitizeEvent(event),
      ...sanitizeWorkerLogFields(fields),
    };
    try {
      (level === 'error' ? stderr : stdout).write(`${JSON.stringify(record)}\n`);
    } catch {
      // Logging must not interrupt lease or shutdown handling.
    }
  };

  return Object.freeze({
    debug: (event: string, fields?: SafeWorkerLogFields) => log('debug', event, fields),
    info: (event: string, fields?: SafeWorkerLogFields) => log('info', event, fields),
    warn: (event: string, fields?: SafeWorkerLogFields) => log('warn', event, fields),
    error: (event: string, fields?: SafeWorkerLogFields) => log('error', event, fields),
  });
}
