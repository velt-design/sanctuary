import {
  assertBackgroundJobSafeSummary,
  type BackgroundJobKind,
  type BackgroundJobSafeRecord,
  type BackgroundJobSafeSummary,
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
  progress: BackgroundJobSafeSummary;
  result: BackgroundJobSafeSummary;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}>;

/**
 * Deliberately omits intent/input hashes, phases, leases, provider identity, and raw errors.
 * Those fields remain service-owned diagnostics and must not leak through staff-facing payloads.
 */
export function toBackgroundJobUserFacingRecord(record: BackgroundJobSafeRecord): BackgroundJobUserFacingRecord {
  assertBackgroundJobSafeSummary(record.safeProgress);
  assertBackgroundJobSafeSummary(record.safeResult);

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
