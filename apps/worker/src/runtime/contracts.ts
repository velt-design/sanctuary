import type {
  BackgroundJobClaim,
  BackgroundJobConcurrencyClass,
  BackgroundJobEffectState,
  BackgroundJobKind,
  BackgroundJobProtectedPayload,
  BackgroundJobReconciliationResult,
  BackgroundJobRuntimeContext,
  BackgroundJobSafeEffectSummary,
  BackgroundJobSafeProgressSummary,
  BackgroundJobSafeRecord,
  BackgroundJobSafeResultSummary,
  BackgroundJobStatus,
  BackgroundJobsQueueHealth,
  BackgroundJobsRuntimeMetrics,
  BackgroundJobWorkerEffect,
  BackgroundJobWorkerHeartbeat,
  BackgroundJobWorkerLifecycleState,
  BackgroundJobWorkerMode,
  BackgroundWorkerSafeRecord,
} from '@sp/jobs';

type RuntimeLogFields = Readonly<{
  workerId?: string;
  jobId?: string;
  kind?: BackgroundJobKind;
  mode?: BackgroundJobWorkerMode;
  lifecycleState?: BackgroundJobWorkerLifecycleState;
  phase?: string;
  errorCode?: string;
  reason?: string;
  attemptNumber?: number;
  batchSize?: number;
  activeJobCount?: number;
  globalConcurrency?: number;
  queueDepth?: number;
  dueJobs?: number;
  processedCount?: number;
  succeededCount?: number;
  retryingCount?: number;
  attentionCount?: number;
  failedCount?: number;
  recoveredLeases?: number;
  archivedMessages?: number;
  repairedMessages?: number;
  delaySeconds?: number;
  durationMs?: number;
}>;

/** Deliberately excludes arbitrary objects, exceptions, messages, payloads, and provider responses. */
export interface RuntimeLogger {
  debug(event: string, fields?: RuntimeLogFields): void;
  info(event: string, fields?: RuntimeLogFields): void;
  warn(event: string, fields?: RuntimeLogFields): void;
  error(event: string, fields?: RuntimeLogFields): void;
}

export interface RuntimeClock {
  now(): number;
  sleep(delayMs: number, signal?: AbortSignal): Promise<void>;
}

export const systemRuntimeClock: RuntimeClock = Object.freeze({
  now: () => Date.now(),
  sleep: (delayMs: number, signal?: AbortSignal) => {
    if (!Number.isFinite(delayMs) || delayMs < 0) {
      return Promise.reject(new RangeError('Runtime sleep delay must be finite and non-negative'));
    }
    if (signal?.aborted) return Promise.reject(signal.reason);

    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort);
        resolve();
      }, delayMs);
      const onAbort = () => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        reject(signal?.reason);
      };
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  },
});

type OwnedJobInput = Readonly<{
  jobId: string;
  workerId: string;
  leaseToken: string;
}>;

type RecordProgressInput = OwnedJobInput &
  Readonly<{
    status: BackgroundJobStatus;
    phase: string;
    safeProgress: BackgroundJobSafeProgressSummary;
  }>;

type RecordEffectCheckpointInput = OwnedJobInput &
  Readonly<{
    effectKey: string;
    effectKind: string;
    state: BackgroundJobEffectState;
    payloadHash: string;
    providerName?: string | null;
    providerIdempotencyKey?: string | null;
    providerIdempotencyExpiresAt?: string | null;
    providerMessageId?: string | null;
    safeMetadata?: BackgroundJobSafeEffectSummary;
  }>;

export interface RuntimeBackgroundJobsRpc {
  claim(input: Readonly<{
    workerId: string;
    batchSize: number;
    visibilityTimeoutSeconds: number;
  }>): Promise<readonly BackgroundJobClaim[]>;
  readPayload(input: OwnedJobInput): Promise<BackgroundJobProtectedPayload>;
  readEffects(input: OwnedJobInput): Promise<readonly BackgroundJobWorkerEffect[]>;
  readRuntimeContext(input: OwnedJobInput): Promise<BackgroundJobRuntimeContext>;
  getSafeJob(jobId: string): Promise<BackgroundJobSafeRecord | null>;
  heartbeat(
    input: OwnedJobInput & Readonly<{ visibilityTimeoutSeconds: number }>,
  ): Promise<BackgroundJobSafeRecord>;
  recordProgress(input: RecordProgressInput): Promise<BackgroundJobSafeRecord>;
  recordEffectCheckpoint(input: RecordEffectCheckpointInput): Promise<BackgroundJobWorkerEffect>;
  complete(input: OwnedJobInput & Readonly<{ safeResult: BackgroundJobSafeResultSummary }>): Promise<BackgroundJobSafeRecord>;
  scheduleRetry(
    input: OwnedJobInput & Readonly<{ delaySeconds: number; errorCode: string }>,
  ): Promise<BackgroundJobSafeRecord>;
  markNeedsAttention(
    input: OwnedJobInput & Readonly<{ errorCode: string; safeDetail: BackgroundJobSafeProgressSummary }>,
  ): Promise<BackgroundJobSafeRecord>;
  markPermanentFailure(input: OwnedJobInput & Readonly<{ errorCode: string }>): Promise<BackgroundJobSafeRecord>;
  acknowledgeCancellation(input: OwnedJobInput): Promise<BackgroundJobSafeRecord>;
  releaseLease(input: OwnedJobInput): Promise<BackgroundJobSafeRecord>;
  workerHeartbeat(input: Readonly<{
    workerId: string;
    mode: BackgroundJobWorkerMode;
    lifecycleState: BackgroundJobWorkerLifecycleState;
    buildVersion: string;
    globalConcurrency: number;
    activeJobCount: number;
    safeMetadata: Readonly<{
      mode: BackgroundJobWorkerMode;
      lifecycleState: BackgroundJobWorkerLifecycleState;
      buildVersion: string;
      supportedKinds: readonly string[];
      concurrencyClasses: readonly string[];
      globalConcurrency: number;
      activeJobCount: number;
      availableConcurrency: number;
      queueDepth?: number;
      processedCount: number;
      succeededCount: number;
      failedCount: number;
      retryingCount: number;
      acceptingJobs: boolean;
      drainRequested: boolean;
      startedAt: string;
      shutdownRequestedAt?: string;
    }>;
  }>): Promise<BackgroundJobWorkerHeartbeat>;
  recoverExpiredLeases(input: Readonly<{ workerId: string; limit: number }>): Promise<number>;
  reconcile(input: Readonly<{ workerId: string; limit: number }>): Promise<BackgroundJobReconciliationResult>;
  queueHealth(): Promise<BackgroundJobsQueueHealth>;
  runtimeMetrics(): Promise<BackgroundJobsRuntimeMetrics>;
  workersListSafe(input: Readonly<{ limit: number }>): Promise<readonly BackgroundWorkerSafeRecord[]>;
}

export type BackgroundJobHandlerRpc = Readonly<{
  progress(input: Readonly<{
    status: BackgroundJobStatus;
    phase: string;
    safeProgress?: BackgroundJobSafeProgressSummary;
  }>): Promise<BackgroundJobSafeRecord>;
  recordEffectCheckpoint(
    input: Omit<RecordEffectCheckpointInput, keyof OwnedJobInput>,
  ): Promise<BackgroundJobWorkerEffect>;
  refreshEffects(): Promise<readonly BackgroundJobWorkerEffect[]>;
}>;

type BackgroundJobHandlerContext = Readonly<{
  claim: BackgroundJobClaim;
  payload: BackgroundJobProtectedPayload;
  effects: readonly BackgroundJobWorkerEffect[];
  signal: AbortSignal;
  rpc: BackgroundJobHandlerRpc;
  logger: RuntimeLogger;
  clock: RuntimeClock;
}>;

export type BackgroundJobHandlerResult = Readonly<{
  safeResult?: BackgroundJobSafeResultSummary;
}>;

export type BackgroundJobHandler = (
  context: BackgroundJobHandlerContext,
) => Promise<BackgroundJobHandlerResult>;
// Handler implementations must remain asynchronous, yield to the event loop
// within the heartbeat budget, and settle promptly after AbortSignal. CPU-heavy
// document work must yield or be offloaded so lease timers can run.

export type BackgroundJobHandlerRegistry = Readonly<Partial<Record<BackgroundJobKind, BackgroundJobHandler>>>;

export type BackgroundJobWorkerConfig = Readonly<{
  workerId: string;
  buildVersion: string;
  mode: BackgroundJobWorkerMode;
  globalConcurrency: number;
  concurrencyByClass?: Readonly<Partial<Record<BackgroundJobConcurrencyClass, number>>>;
  concurrencyByKind?: Readonly<Partial<Record<BackgroundJobKind, number>>>;
  claimBatchSize: number;
  visibilityTimeoutSeconds: number;
  heartbeatIntervalMs: number;
  workerHeartbeatIntervalMs: number;
  pollIntervalMs: number;
  reconciliationIntervalMs: number;
  reconciliationLimit: number;
  shutdownGraceMs: number;
  abortSettleGraceMs: number;
  rpcTimeoutMs: number;
}>;

type BackgroundJobExecutionOutcome =
  | 'succeeded'
  | 'cancelled'
  | 'retrying'
  | 'needs_attention'
  | 'permanent_failed'
  | 'lease_released'
  | 'deferred';

export type BackgroundJobExecutionResult = Readonly<{
  jobId: string;
  kind: BackgroundJobKind;
  outcome: BackgroundJobExecutionOutcome;
  errorCode: string | null;
  delaySeconds: number | null;
}>;

export type BackgroundJobWorkerSnapshot = Readonly<{
  workerId: string;
  mode: BackgroundJobWorkerMode;
  lifecycleState: BackgroundJobWorkerLifecycleState;
  acceptingJobs: boolean;
  activeJobCount: number;
  globalConcurrency: number;
  processedCount: number;
  succeededCount: number;
  retryingCount: number;
  attentionCount: number;
  failedCount: number;
  lastQueueHealth: BackgroundJobsQueueHealth | null;
  lastRuntimeMetrics: BackgroundJobsRuntimeMetrics | null;
  startedAt: string;
  shutdownRequestedAt: string | null;
}>;

export type BackgroundJobWorkerRunResult = Readonly<{
  mode: BackgroundJobWorkerMode;
  processedCount: number;
  succeededCount: number;
  retryingCount: number;
  attentionCount: number;
  failedCount: number;
}>;

export interface BackgroundJobWorker {
  run(): Promise<BackgroundJobWorkerRunResult>;
  requestShutdown(reason?: string): void;
  snapshot(): BackgroundJobWorkerSnapshot;
}
