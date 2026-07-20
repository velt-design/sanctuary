import {
  assertBackgroundJobSafeProgressSummary,
  assertBackgroundJobSafeResultSummary,
  type BackgroundJobKind,
  type BackgroundJobSafeProgressSummary,
  type BackgroundJobSafeRecord,
  type BackgroundJobSafeResultSummary,
  type BackgroundJobStatus,
} from './contracts';
import { getBackgroundJobUserFacingStatus } from './registry';

export type BackgroundJobUserFacingRecord = Readonly<{
  id: string;
  kind: BackgroundJobKind;
  status: BackgroundJobStatus;
  statusLabel: string;
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt: string;
  cancellationRequested: boolean;
  progress: BackgroundJobSafeProgressSummary;
  result: BackgroundJobSafeResultSummary;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}>;

/**
 * Deliberately omits the internal phase and rollout diagnostics that remain in the safe service projection.
 * Protected payload, lease, hash, provider, and raw-error fields are excluded before this boundary.
 */
export function toBackgroundJobUserFacingRecord(record: BackgroundJobSafeRecord): BackgroundJobUserFacingRecord {
  assertBackgroundJobSafeProgressSummary(record.safeProgress);
  assertBackgroundJobSafeResultSummary(record.safeResult);

  return {
    id: record.id,
    kind: record.kind,
    status: record.status,
    statusLabel: getBackgroundJobUserFacingStatus(record.kind, record.status),
    attemptCount: record.attemptCount,
    maxAttempts: record.maxAttempts,
    nextAttemptAt: record.nextAttemptAt,
    cancellationRequested: record.cancellationRequestedAt !== null,
    progress: record.safeProgress,
    result: record.safeResult,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    startedAt: record.startedAt,
    completedAt: record.completedAt,
  };
}
