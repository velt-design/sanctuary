import { describe, expect, it } from 'vitest';
import {
  BACKGROUND_JOB_KINDS,
  BACKGROUND_JOB_PROTECTED_PAYLOAD_MAX_BYTES,
  BACKGROUND_JOB_STATUSES,
  BACKGROUND_JOB_WORKER_LIFECYCLE_STATES,
  BACKGROUND_JOB_WORKER_MODES,
  parseBackgroundJobClaim,
  parseBackgroundJobClaims,
  parseBackgroundJobProtectedPayload,
  parseBackgroundJobReconciliationResult,
  parseBackgroundJobRuntimeContext,
  parseBackgroundJobSafeEventRecord,
  parseBackgroundJobSafeEventRecords,
  parseBackgroundJobSafeRecord,
  parseBackgroundJobSafeRecords,
  parseBackgroundJobsQueueHealth,
  parseBackgroundJobsRuntimeMetrics,
  parseBackgroundJobWorkerEffect,
  parseBackgroundJobWorkerEffects,
  parseBackgroundJobWorkerHeartbeat,
  parseBackgroundWorkerSafeRecord,
  parseBackgroundWorkerSafeRecords,
} from '@sp/jobs';

const JOB_ID = '8b50378a-70c5-4c63-a47d-f31f27ed30ee';
const PROJECT_ID = '2d6f06f1-81d7-45fb-9758-13dc0c096cec';
const LEASE_TOKEN = '5be5319b-e4e8-4cbf-81b5-eabbe79bc3f2';
const TIMESTAMP = '2026-07-20T01:02:03.456Z';
const LATER_TIMESTAMP = '2026-07-20T11:03:04+10:00';
const HASH = 'a'.repeat(64);

function claimRow() {
  return {
    job_id: JOB_ID,
    kind: 'quote_send',
    contract_version: 1,
    status: 'claimed',
    current_phase: 'claimed',
    attempt_number: 1,
    max_attempts: 6,
    queue_message_id: 42,
    lease_token: LEASE_TOKEN,
    lease_expires_at: LATER_TIMESTAMP,
    cancellation_requested_at: null,
    rollout_mode: 'worker_enabled',
    execution_owner: 'worker',
  };
}

function safeJobRow() {
  return {
    id: JOB_ID,
    kind: 'quote_send',
    contract_version: 1,
    subject_type: 'quote',
    subject_id: 'quote-123',
    project_id: PROJECT_ID,
    status: 'retrying',
    current_phase: 'retry_wait',
    priority: 100,
    attempt_count: 2,
    max_attempts: 6,
    next_attempt_at: LATER_TIMESTAMP,
    cancellation_requested_at: null,
    rollout_mode: 'worker_enabled',
    execution_owner: 'worker',
    safe_progress: { phase: 'retry_wait', completedCount: 1 },
    safe_result: {},
    error_code: 'PROVIDER_TEMPORARY',
    created_at: TIMESTAMP,
    updated_at: LATER_TIMESTAMP,
    started_at: TIMESTAMP,
    completed_at: null,
  };
}

function effectRow() {
  return {
    effect_key: 'quote-123/email-1',
    effect_kind: 'email_dispatch',
    state: 'provider_accepted',
    payload_hash: HASH,
    provider_name: 'resend',
    provider_idempotency_key: 'quote-123/send-1',
    provider_idempotency_expires_at: LATER_TIMESTAMP,
    provider_message_id: 'provider-message-123',
    safe_metadata: {
      effectKind: 'email_dispatch',
      checkpoint: 'provider_accepted',
      providerName: 'resend',
      providerAccepted: true,
    },
  };
}

function workerRow() {
  return {
    worker_id: 'worker.1:test',
    mode: 'dark',
    lifecycle_state: 'ready',
    build_version: 'wave-03.1',
    global_concurrency: 8,
    active_job_count: 2,
    safe_metadata: {
      mode: 'dark',
      lifecycleState: 'ready',
      globalConcurrency: 8,
      activeJobCount: 2,
      acceptingJobs: false,
    },
    started_at: TIMESTAMP,
    last_heartbeat_at: LATER_TIMESTAMP,
    shutdown_requested_at: null,
    stopped_at: null,
    updated_at: LATER_TIMESTAMP,
  };
}

function statusCounts() {
  return Object.fromEntries(BACKGROUND_JOB_STATUSES.map((status, index) => [status, index]));
}

function kindCounts() {
  return Object.fromEntries(BACKGROUND_JOB_KINDS.map((kind, index) => [kind, index]));
}

function workerLifecycleCounts() {
  return Object.fromEntries(
    BACKGROUND_JOB_WORKER_LIFECYCLE_STATES.map((state, index) => [state, index]),
  );
}

describe('background-job worker runtime contracts', () => {
  it('keeps worker mode and lifecycle vocabularies explicit', () => {
    expect(BACKGROUND_JOB_WORKER_MODES).toEqual(['dark', 'active', 'once', 'drain', 'reconcile']);
    expect(BACKGROUND_JOB_WORKER_LIFECYCLE_STATES).toEqual([
      'starting',
      'ready',
      'draining',
      'stopped',
      'unhealthy',
    ]);
  });

  it('parses exact claim rows into immutable camel-case contracts', () => {
    const parsed = parseBackgroundJobClaim(claimRow());
    expect(parsed).toEqual({
      jobId: JOB_ID,
      kind: 'quote_send',
      contractVersion: 1,
      status: 'claimed',
      currentPhase: 'claimed',
      attemptNumber: 1,
      maxAttempts: 6,
      queueMessageId: 42,
      leaseToken: LEASE_TOKEN,
      leaseExpiresAt: LATER_TIMESTAMP,
      cancellationRequestedAt: null,
      rolloutMode: 'worker_enabled',
      executionOwner: 'worker',
    });
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(parseBackgroundJobClaims([claimRow()])).toEqual([parsed]);
  });

  it('rejects malformed, unsupported, terminal, accessor-backed, or expanded claims', () => {
    expect(() => parseBackgroundJobClaim({ ...claimRow(), recipient: 'customer@example.test' })).toThrow(
      /expected exactly/i,
    );
    expect(() => parseBackgroundJobClaim({ ...claimRow(), kind: 'unknown' })).toThrow(/kind/i);
    expect(() => parseBackgroundJobClaim({ ...claimRow(), contract_version: 2 })).toThrow(/unsupported/i);
    expect(() => parseBackgroundJobClaim({ ...claimRow(), status: 'succeeded' })).toThrow(/active lease/i);
    expect(() => parseBackgroundJobClaim({ ...claimRow(), attempt_number: 7 })).toThrow(/exceeds maximum/i);
    expect(() => parseBackgroundJobClaim({ ...claimRow(), queue_message_id: 1.5 })).toThrow(/queue_message_id/i);
    expect(() => parseBackgroundJobClaim({ ...claimRow(), lease_expires_at: '2026-02-30T00:00:00Z' })).toThrow(
      /valid ISO timestamp/i,
    );

    const accessorClaim = claimRow();
    Object.defineProperty(accessorClaim, 'job_id', { enumerable: true, get: () => JOB_ID });
    expect(() => parseBackgroundJobClaim(accessorClaim)).toThrow(/enumerable data property/i);

    const sparse = [claimRow(), claimRow()];
    delete sparse[0];
    expect(() => parseBackgroundJobClaims(sparse)).toThrow(/dense array/i);
  });

  it('validates and deeply freezes the private JSON payload without applying public-summary censorship', () => {
    const parsed = parseBackgroundJobProtectedPayload({
      contract_version: 1,
      payload_hash: HASH,
      payload: {
        recipient: 'customer@example.test',
        options: { send: true, pages: [1, 2] },
      },
    });
    expect(parsed.payload.recipient).toBe('customer@example.test');
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.payload)).toBe(true);
    expect(Object.isFrozen(parsed.payload.options)).toBe(true);
  });

  it('rejects payload rows that are not exact, canonical JSON-shaped, hash-valid, and database-bounded', () => {
    expect(() =>
      parseBackgroundJobProtectedPayload({ contract_version: 1, payload_hash: HASH.toUpperCase(), payload: {} }),
    ).toThrow(/payload_hash/i);
    expect(() => parseBackgroundJobProtectedPayload({ contract_version: 1, payload_hash: HASH, payload: [] })).toThrow(
      /JSON object/i,
    );
    expect(() =>
      parseBackgroundJobProtectedPayload({ contract_version: 1, payload_hash: HASH, payload: { count: Number.NaN } }),
    ).toThrow(/finite/i);
    expect(() =>
      parseBackgroundJobProtectedPayload({
        contract_version: 1,
        payload_hash: HASH,
        payload: { body: 'x'.repeat(BACKGROUND_JOB_PROTECTED_PAYLOAD_MAX_BYTES) },
      }),
    ).toThrow(/exceeds/i);

    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(() =>
      parseBackgroundJobProtectedPayload({ contract_version: 1, payload_hash: HASH, payload: cyclic }),
    ).toThrow(/cyclic/i);
  });

  it('parses effect replay identity and rejects unsafe or malformed effect rows', () => {
    const parsed = parseBackgroundJobWorkerEffect(effectRow());
    expect(parsed.effectKind).toBe('email_dispatch');
    expect(parsed.providerIdempotencyKey).toBe('quote-123/send-1');
    expect(parsed.safeMetadata).toEqual(effectRow().safe_metadata);
    expect(Object.isFrozen(parsed.safeMetadata)).toBe(true);
    expect(parseBackgroundJobWorkerEffects([effectRow()])).toEqual([parsed]);

    expect(() => parseBackgroundJobWorkerEffect({ ...effectRow(), provider_payload: {} })).toThrow(/expected exactly/i);
    expect(() => parseBackgroundJobWorkerEffect({ ...effectRow(), state: 'sent' })).toThrow(/state/i);
    expect(() => parseBackgroundJobWorkerEffect({ ...effectRow(), effect_kind: 'undeclared_effect' })).toThrow(
      /shared job registry/i,
    );
    expect(() => parseBackgroundJobWorkerEffect({ ...effectRow(), provider_name: 'bad provider' })).toThrow(
      /provider_name/i,
    );
    expect(() =>
      parseBackgroundJobWorkerEffect({
        ...effectRow(),
        safe_metadata: { providerName: 'customer@example.test' },
      }),
    ).toThrow(/unsafe summary/i);
    expect(() =>
      parseBackgroundJobWorkerEffect({ ...effectRow(), provider_idempotency_expires_at: null }),
    ).toThrow(/complete or absent/i);
    expect(() =>
      parseBackgroundJobWorkerEffect({ ...effectRow(), provider_message_id: null }),
    ).toThrow(/provider message ID/i);
  });

  it('parses safe job inspection rows and refuses internal or sensitive additions', () => {
    const parsed = parseBackgroundJobSafeRecord(safeJobRow());
    expect(parsed.id).toBe(JOB_ID);
    expect(parsed.safeProgress).toEqual({ phase: 'retry_wait', completedCount: 1 });
    expect(parseBackgroundJobSafeRecords([safeJobRow()])).toEqual([parsed]);

    expect(() => parseBackgroundJobSafeRecord({ ...safeJobRow(), lease_token: LEASE_TOKEN })).toThrow(
      /expected exactly/i,
    );
    expect(() =>
      parseBackgroundJobSafeRecord({ ...safeJobRow(), safe_progress: { phase: 'customer@example.test' } }),
    ).toThrow(/unsafe summary/i);
    expect(() => parseBackgroundJobSafeRecord({ ...safeJobRow(), subject_type: 'Quote' })).toThrow(/subject_type/i);
  });

  it('parses safe event history with nullable transitions and strict safe detail', () => {
    const row = {
      id: 9,
      job_id: JOB_ID,
      event_type: 'retry_scheduled',
      from_status: 'running',
      to_status: 'retrying',
      phase: 'retry_wait',
      attempt_number: 2,
      error_code: 'PROVIDER_TEMPORARY',
      safe_detail: { reason: 'provider_temporary', delaySeconds: 30 },
      created_at: TIMESTAMP,
    };
    const parsed = parseBackgroundJobSafeEventRecord(row);
    expect(parsed.eventType).toBe('retry_scheduled');
    expect(parsed.safeDetail).toEqual(row.safe_detail);
    expect(parseBackgroundJobSafeEventRecords([row])).toEqual([parsed]);

    expect(() => parseBackgroundJobSafeEventRecord({ ...row, safe_detail: { recipient: 'customer@example.test' } })).toThrow(
      /unsafe summary/i,
    );
    expect(() => parseBackgroundJobSafeEventRecord({ ...row, event_type: 'email_sent' })).toThrow(/event_type/i);
  });

  it('parses only active lease-fenced runtime contexts', () => {
    const row = {
      job_id: JOB_ID,
      kind: 'quote_send',
      contract_version: 1,
      status: 'running',
      current_phase: 'rendering',
      attempt_count: 2,
      max_attempts: 6,
      started_at: TIMESTAMP,
      cancellation_requested_at: null,
      rollout_mode: 'worker_enabled',
      execution_owner: 'worker',
    };
    expect(parseBackgroundJobRuntimeContext(row)).toEqual({
      jobId: JOB_ID,
      kind: 'quote_send',
      contractVersion: 1,
      status: 'running',
      currentPhase: 'rendering',
      attemptCount: 2,
      maxAttempts: 6,
      startedAt: TIMESTAMP,
      cancellationRequestedAt: null,
      rolloutMode: 'worker_enabled',
      executionOwner: 'worker',
    });
    expect(() => parseBackgroundJobRuntimeContext({ ...row, status: 'retrying' })).toThrow(/active lease/i);
    expect(() => parseBackgroundJobRuntimeContext({ ...row, started_at: null })).toThrow(/started_at/i);
  });

  it('parses heartbeat and safe worker-list projections independently', () => {
    const heartbeat = parseBackgroundJobWorkerHeartbeat(workerRow());
    expect(heartbeat.workerId).toBe('worker.1:test');
    expect(heartbeat.mode).toBe('dark');
    const safeWorker = parseBackgroundWorkerSafeRecord({ ...workerRow(), is_stale: false });
    expect(safeWorker.isStale).toBe(false);
    expect(parseBackgroundWorkerSafeRecords([{ ...workerRow(), is_stale: false }])).toEqual([safeWorker]);

    expect(() => parseBackgroundJobWorkerHeartbeat({ ...workerRow(), mode: 'dry_run' })).toThrow(/mode/i);
    expect(() => parseBackgroundJobWorkerHeartbeat({ ...workerRow(), global_concurrency: 101 })).toThrow(
      /global_concurrency/i,
    );
    expect(() =>
      parseBackgroundJobWorkerHeartbeat({ ...workerRow(), safe_metadata: { buildVersion: 'Bearer synthetic-key' } }),
    ).toThrow(/unsafe summary/i);
    expect(() => parseBackgroundWorkerSafeRecord({ ...workerRow(), is_stale: 0 })).toThrow(/boolean/i);
  });

  it('keeps reconciliation JSON camel-cased and queue-health rows snake-cased', () => {
    expect(
      parseBackgroundJobReconciliationResult({
        archivedMessages: 2,
        repairedMessages: 1,
        recoveredLeases: 3,
      }),
    ).toEqual({ archivedMessages: 2, repairedMessages: 1, recoveredLeases: 3 });
    expect(() =>
      parseBackgroundJobReconciliationResult({
        archived_messages: 2,
        repaired_messages: 1,
        recovered_leases: 3,
      }),
    ).toThrow(/expected exactly/i);

    expect(
      parseBackgroundJobsQueueHealth({
        queue_depth: 4,
        oldest_message_age_seconds: null,
        total_messages: 12,
        queued_jobs: 2,
        active_jobs: 1,
        retrying_jobs: 1,
        attention_jobs: 0,
        stale_workers: 0,
        measured_at: TIMESTAMP,
      }),
    ).toEqual({
      queueDepth: 4,
      oldestMessageAgeSeconds: null,
      totalMessages: 12,
      queuedJobs: 2,
      activeJobs: 1,
      retryingJobs: 1,
      attentionJobs: 0,
      staleWorkers: 0,
      measuredAt: TIMESTAMP,
    });
  });

  it('parses complete enum-keyed runtime metrics and rejects partial or open-ended count maps', () => {
    const row = {
      queue_depth: 6,
      oldest_message_age_seconds: 90,
      oldest_job_age_seconds: 120,
      due_jobs: 3,
      next_due_at: LATER_TIMESTAMP,
      status_counts: statusCounts(),
      kind_counts: kindCounts(),
      worker_lifecycle_counts: workerLifecycleCounts(),
      stale_workers: 1,
      measured_at: TIMESTAMP,
    };
    const parsed = parseBackgroundJobsRuntimeMetrics(row);
    expect(parsed.queueDepth).toBe(6);
    expect(parsed.statusCounts.queued).toBe(0);
    expect(parsed.kindCounts.quote_send).toBe(1);
    expect(parsed.workerLifecycleCounts.unhealthy).toBe(4);
    expect(Object.isFrozen(parsed.statusCounts)).toBe(true);
    expect(Object.isFrozen(parsed.workerLifecycleCounts)).toBe(true);

    const partialStatuses = statusCounts();
    delete partialStatuses.queued;
    expect(() => parseBackgroundJobsRuntimeMetrics({ ...row, status_counts: partialStatuses })).toThrow(
      /expected exactly/i,
    );
    expect(() =>
      parseBackgroundJobsRuntimeMetrics({
        ...row,
        kind_counts: { ...kindCounts(), future_kind: 0 },
      }),
    ).toThrow(/expected exactly/i);
    const partialLifecycleCounts = workerLifecycleCounts();
    delete partialLifecycleCounts.unhealthy;
    expect(() =>
      parseBackgroundJobsRuntimeMetrics({
        ...row,
        worker_lifecycle_counts: partialLifecycleCounts,
      }),
    ).toThrow(/expected exactly/i);
    expect(() =>
      parseBackgroundJobsRuntimeMetrics({
        ...row,
        worker_lifecycle_counts: {
          ...workerLifecycleCounts(),
          future_state: 0,
        },
      }),
    ).toThrow(/expected exactly/i);
    expect(() => parseBackgroundJobsRuntimeMetrics({ ...row, due_jobs: -1 })).toThrow(/due_jobs/i);
  });
});
