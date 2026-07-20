import type {
  BackgroundJobEffectState,
  BackgroundJobEventType,
  BackgroundJobExecutionOwner,
  BackgroundJobKind,
  BackgroundJobRolloutMode,
  BackgroundJobSafeEffectSummary,
  BackgroundJobSafeEventSummary,
  BackgroundJobSafeWorkerSummary,
  BackgroundJobStatus,
} from './contracts';

export const BACKGROUND_JOB_WORKER_MODES = ['dark', 'active', 'once', 'drain', 'reconcile'] as const;
export type BackgroundJobWorkerMode = (typeof BACKGROUND_JOB_WORKER_MODES)[number];

export const BACKGROUND_JOB_WORKER_LIFECYCLE_STATES = [
  'starting',
  'ready',
  'draining',
  'stopped',
  'unhealthy',
] as const;
export type BackgroundJobWorkerLifecycleState = (typeof BACKGROUND_JOB_WORKER_LIFECYCLE_STATES)[number];

export const BACKGROUND_JOB_PROTECTED_PAYLOAD_MAX_BYTES = 262_144;

export interface BackgroundJobJsonArray extends ReadonlyArray<BackgroundJobJsonValue> {}

export interface BackgroundJobJsonObject {
  readonly [key: string]: BackgroundJobJsonValue;
}

export type BackgroundJobJsonValue = null | boolean | number | string | BackgroundJobJsonArray | BackgroundJobJsonObject;

export type BackgroundJobClaim = Readonly<{
  jobId: string;
  kind: BackgroundJobKind;
  contractVersion: number;
  status: BackgroundJobStatus;
  currentPhase: string;
  attemptNumber: number;
  maxAttempts: number;
  queueMessageId: number;
  leaseToken: string;
  leaseExpiresAt: string;
  cancellationRequestedAt: string | null;
  rolloutMode: BackgroundJobRolloutMode;
  executionOwner: BackgroundJobExecutionOwner;
}>;

export type BackgroundJobProtectedPayload = Readonly<{
  contractVersion: number;
  payloadHash: string;
  payload: BackgroundJobJsonObject;
}>;

export type BackgroundJobWorkerEffect = Readonly<{
  effectKey: string;
  effectKind: string;
  state: BackgroundJobEffectState;
  payloadHash: string;
  providerName: string | null;
  providerIdempotencyKey: string | null;
  providerIdempotencyExpiresAt: string | null;
  providerMessageId: string | null;
  safeMetadata: BackgroundJobSafeEffectSummary;
}>;

export type BackgroundJobSafeEventRecord = Readonly<{
  id: number;
  jobId: string;
  eventType: BackgroundJobEventType;
  fromStatus: BackgroundJobStatus | null;
  toStatus: BackgroundJobStatus | null;
  phase: string | null;
  attemptNumber: number | null;
  errorCode: string | null;
  safeDetail: BackgroundJobSafeEventSummary;
  createdAt: string;
}>;

export type BackgroundJobRuntimeContext = Readonly<{
  jobId: string;
  kind: BackgroundJobKind;
  contractVersion: number;
  status: BackgroundJobStatus;
  currentPhase: string;
  attemptCount: number;
  maxAttempts: number;
  startedAt: string;
  cancellationRequestedAt: string | null;
  rolloutMode: BackgroundJobRolloutMode;
  executionOwner: BackgroundJobExecutionOwner;
}>;

type BackgroundWorkerRecord = Readonly<{
  workerId: string;
  mode: BackgroundJobWorkerMode;
  lifecycleState: BackgroundJobWorkerLifecycleState;
  buildVersion: string | null;
  globalConcurrency: number;
  activeJobCount: number;
  safeMetadata: BackgroundJobSafeWorkerSummary;
  startedAt: string;
  lastHeartbeatAt: string;
  shutdownRequestedAt: string | null;
  stoppedAt: string | null;
  updatedAt: string;
}>;

export type BackgroundJobWorkerHeartbeat = BackgroundWorkerRecord;
export type BackgroundWorkerSafeRecord = BackgroundWorkerRecord & Readonly<{ isStale: boolean }>;

export type BackgroundJobReconciliationResult = Readonly<{
  archivedMessages: number;
  repairedMessages: number;
  recoveredLeases: number;
}>;

export type BackgroundJobsQueueHealth = Readonly<{
  queueDepth: number;
  oldestMessageAgeSeconds: number | null;
  totalMessages: number;
  queuedJobs: number;
  activeJobs: number;
  retryingJobs: number;
  attentionJobs: number;
  staleWorkers: number;
  measuredAt: string;
}>;

export type BackgroundJobsRuntimeMetrics = Readonly<{
  queueDepth: number;
  oldestMessageAgeSeconds: number | null;
  oldestJobAgeSeconds: number;
  dueJobs: number;
  nextDueAt: string | null;
  statusCounts: Readonly<Record<BackgroundJobStatus, number>>;
  kindCounts: Readonly<Record<BackgroundJobKind, number>>;
  workerLifecycleCounts: Readonly<
    Record<BackgroundJobWorkerLifecycleState, number>
  >;
  staleWorkers: number;
  measuredAt: string;
}>;
