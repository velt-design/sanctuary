import {
  BACKGROUND_JOB_KINDS,
  BACKGROUND_JOB_STATUSES,
  BACKGROUND_JOB_WORKER_LIFECYCLE_STATES,
  type BackgroundJobKind,
  type BackgroundJobStatus,
  type BackgroundJobWorkerLifecycleState,
} from '@sp/jobs';
import { describe, expect, it } from 'vitest';

import {
  BACKGROUND_JOB_EFFECT_COLUMNS,
  BACKGROUND_JOB_SAFE_COLUMNS,
  BACKGROUND_JOBS_RPC_NAMES,
  BACKGROUND_WORKER_HEARTBEAT_COLUMNS,
  BackgroundJobsRpcError,
  createBackgroundJobsRpc,
  type BackgroundJobsRpcName,
  type BackgroundJobsRpcTransport,
} from './backgroundJobsRpcClient';

const jobId = '11111111-1111-4111-8111-111111111111';
const projectId = '22222222-2222-4222-8222-222222222222';
const leaseToken = '33333333-3333-4333-8333-333333333333';
const timestamp = '2026-07-20T01:02:03.000Z';
const hash = 'a'.repeat(64);

const safeJobRow = {
  id: jobId,
  kind: 'quote_send',
  contract_version: 1,
  subject_type: 'quote',
  subject_id: 'quote-1',
  project_id: projectId,
  status: 'running',
  current_phase: 'rendering',
  priority: 100,
  attempt_count: 1,
  max_attempts: 6,
  next_attempt_at: timestamp,
  cancellation_requested_at: null,
  rollout_mode: 'worker_enabled',
  execution_owner: 'worker',
  safe_progress: { phase: 'rendering' },
  safe_result: {},
  error_code: null,
  created_at: timestamp,
  updated_at: timestamp,
  started_at: timestamp,
  completed_at: null,
} as const;

const claimRow = {
  job_id: jobId,
  kind: 'quote_send',
  contract_version: 1,
  status: 'claimed',
  current_phase: 'claimed',
  attempt_number: 1,
  max_attempts: 6,
  queue_message_id: 42,
  lease_token: leaseToken,
  lease_expires_at: timestamp,
  cancellation_requested_at: null,
  rollout_mode: 'worker_enabled',
  execution_owner: 'worker',
} as const;

const effectRow = {
  effect_key: 'quote-1/email-1',
  effect_kind: 'email_dispatch',
  state: 'prepared',
  payload_hash: hash,
  provider_name: 'resend',
  provider_idempotency_key: 'quote-1/email-1',
  provider_idempotency_expires_at: '2026-07-20T02:02:03.000Z',
  provider_message_id: null,
  safe_metadata: { effectKind: 'email_dispatch', checkpoint: 'prepared' },
} as const;

const workerRow = {
  worker_id: 'worker-1',
  mode: 'dark',
  lifecycle_state: 'ready',
  build_version: 'build-1',
  global_concurrency: 4,
  active_job_count: 0,
  safe_metadata: { mode: 'dark', lifecycleState: 'ready' },
  started_at: timestamp,
  last_heartbeat_at: timestamp,
  shutdown_requested_at: null,
  stopped_at: null,
  updated_at: timestamp,
} as const;

const runtimeContextRow = {
  job_id: jobId,
  kind: 'quote_send',
  contract_version: 1,
  status: 'running',
  current_phase: 'rendering',
  attempt_count: 1,
  max_attempts: 6,
  started_at: timestamp,
  cancellation_requested_at: null,
  rollout_mode: 'worker_enabled',
  execution_owner: 'worker',
} as const;

type CapturedCall = Readonly<{
  name: BackgroundJobsRpcName;
  parameters: Readonly<Record<string, unknown>>;
  selectedColumns?: string;
}>;

function countMap<Values extends readonly string[]>(values: Values): Record<Values[number], number> {
  return Object.fromEntries(values.map((value) => [value, 0])) as Record<Values[number], number>;
}

function transportWithResponses(responses: Partial<Record<BackgroundJobsRpcName, unknown>>) {
  const calls: CapturedCall[] = [];
  const transport: BackgroundJobsRpcTransport = {
    async call(name, parameters, selectedColumns) {
      calls.push({ name, parameters, ...(selectedColumns ? { selectedColumns } : {}) });
      return { data: responses[name] ?? null, error: null };
    },
  };
  return { calls, transport };
}

function client(transport: BackgroundJobsRpcTransport) {
  return createBackgroundJobsRpc({
    supabaseUrl: 'http://127.0.0.1:54321',
    serviceRoleKey: 'test-only-key',
    transport,
  });
}

describe('background jobs RPC adapter', () => {
  it('maps claim, protected reads, and runtime projections through RPC-only calls', async () => {
    const { calls, transport } = transportWithResponses({
      [BACKGROUND_JOBS_RPC_NAMES.claim]: [claimRow],
      [BACKGROUND_JOBS_RPC_NAMES.readPayload]: [{ contract_version: 1, payload_hash: hash, payload: { quoteId: jobId } }],
      [BACKGROUND_JOBS_RPC_NAMES.readEffects]: [effectRow],
      [BACKGROUND_JOBS_RPC_NAMES.readRuntimeContext]: [runtimeContextRow],
      [BACKGROUND_JOBS_RPC_NAMES.getSafeJob]: [safeJobRow],
    });
    const rpc = client(transport);

    await expect(rpc.claim({ workerId: 'worker-1', batchSize: 2, visibilityTimeoutSeconds: 120 })).resolves.toEqual([
      expect.objectContaining({ jobId, leaseToken, kind: 'quote_send' }),
    ]);
    await expect(rpc.readPayload({ jobId, workerId: 'worker-1', leaseToken })).resolves.toMatchObject({
      payloadHash: hash,
      payload: { quoteId: jobId },
    });
    await expect(rpc.readEffects({ jobId, workerId: 'worker-1', leaseToken })).resolves.toEqual([
      expect.objectContaining({ effectKind: 'email_dispatch', state: 'prepared' }),
    ]);
    await expect(rpc.readRuntimeContext({ jobId, workerId: 'worker-1', leaseToken })).resolves.toMatchObject({
      jobId,
      startedAt: timestamp,
    });
    await expect(rpc.getSafeJob(jobId)).resolves.toMatchObject({ id: jobId, status: 'running' });

    expect(calls[0]).toEqual({
      name: 'background_jobs_claim',
      parameters: { p_worker_id: 'worker-1', p_batch_size: 2, p_visibility_timeout_seconds: 120 },
    });
    expect(calls.find((call) => call.name === BACKGROUND_JOBS_RPC_NAMES.readEffects)?.selectedColumns).toBe(
      BACKGROUND_JOB_EFFECT_COLUMNS,
    );
    expect(calls.find((call) => call.name === BACKGROUND_JOBS_RPC_NAMES.getSafeJob)?.selectedColumns).toBe(
      BACKGROUND_JOB_SAFE_COLUMNS,
    );
    expect(calls.every((call) => !('from' in call.parameters))).toBe(true);
  });

  it('narrows lifecycle, effect, and worker composite RPC responses before parsing', async () => {
    const { calls, transport } = transportWithResponses({
      [BACKGROUND_JOBS_RPC_NAMES.heartbeat]: safeJobRow,
      [BACKGROUND_JOBS_RPC_NAMES.recordProgress]: safeJobRow,
      [BACKGROUND_JOBS_RPC_NAMES.recordEffectCheckpoint]: effectRow,
      [BACKGROUND_JOBS_RPC_NAMES.recordProviderAcceptance]: {
        ...effectRow,
        state: 'provider_accepted',
        provider_message_id: 'resend-message-1',
        safe_metadata: { effectKind: 'email_dispatch', checkpoint: 'provider_accepted' },
      },
      [BACKGROUND_JOBS_RPC_NAMES.complete]: safeJobRow,
      [BACKGROUND_JOBS_RPC_NAMES.scheduleRetry]: safeJobRow,
      [BACKGROUND_JOBS_RPC_NAMES.markNeedsAttention]: safeJobRow,
      [BACKGROUND_JOBS_RPC_NAMES.markPermanentFailure]: safeJobRow,
      [BACKGROUND_JOBS_RPC_NAMES.acknowledgeCancellation]: safeJobRow,
      [BACKGROUND_JOBS_RPC_NAMES.releaseLease]: safeJobRow,
      [BACKGROUND_JOBS_RPC_NAMES.workerHeartbeat]: workerRow,
    });
    const rpc = client(transport);
    const owned = { jobId, workerId: 'worker-1', leaseToken } as const;

    await rpc.heartbeat({ ...owned, visibilityTimeoutSeconds: 120 });
    await rpc.recordProgress({ ...owned, status: 'running', phase: 'rendering', safeProgress: { phase: 'rendering' } });
    await rpc.recordEffectCheckpoint({
      ...owned,
      effectKey: 'quote-1/email-1',
      effectKind: 'email_dispatch',
      state: 'prepared',
      payloadHash: hash,
      providerName: 'resend',
      providerIdempotencyKey: 'quote-1/email-1',
      providerIdempotencyExpiresAt: '2026-07-20T02:02:03.000Z',
      safeMetadata: { effectKind: 'email_dispatch', checkpoint: 'prepared' },
    });
    await rpc.recordEffectCheckpoint({
      ...owned,
      effectKey: 'quote-1/email-1',
      effectKind: 'email_dispatch',
      state: 'provider_accepted',
      payloadHash: hash,
      providerName: 'resend',
      providerIdempotencyKey: 'quote-1/email-1',
      providerIdempotencyExpiresAt: '2026-07-20T02:02:03.000Z',
      providerMessageId: 'resend-message-1',
      safeMetadata: { effectKind: 'email_dispatch', checkpoint: 'provider_accepted' },
    });
    await rpc.complete({ ...owned, safeResult: {} });
    await rpc.scheduleRetry({ ...owned, delaySeconds: 30, errorCode: 'TRANSIENT_FAILURE' });
    await rpc.markNeedsAttention({ ...owned, errorCode: 'OUTCOME_UNKNOWN', safeDetail: { retryable: false } });
    await rpc.markPermanentFailure({ ...owned, errorCode: 'INVALID_INPUT' });
    await rpc.acknowledgeCancellation(owned);
    await rpc.releaseLease(owned);
    await rpc.workerHeartbeat({
      workerId: 'worker-1',
      mode: 'dark',
      lifecycleState: 'ready',
      buildVersion: 'build-1',
      globalConcurrency: 4,
      activeJobCount: 0,
      safeMetadata: {
        mode: 'dark',
        lifecycleState: 'ready',
        buildVersion: 'build-1',
        supportedKinds: [],
        concurrencyClasses: [],
        globalConcurrency: 4,
        activeJobCount: 0,
        availableConcurrency: 4,
        processedCount: 0,
        succeededCount: 0,
        failedCount: 0,
        retryingCount: 0,
        acceptingJobs: false,
        drainRequested: false,
        startedAt: timestamp,
      },
    });

    expect(calls.filter((call) => call.selectedColumns === BACKGROUND_JOB_SAFE_COLUMNS)).toHaveLength(8);
    expect(calls.find((call) => call.name === BACKGROUND_JOBS_RPC_NAMES.recordEffectCheckpoint)?.selectedColumns).toBe(
      BACKGROUND_JOB_EFFECT_COLUMNS,
    );
    const providerAcceptanceCall = calls.find(
      (call) => call.name === BACKGROUND_JOBS_RPC_NAMES.recordProviderAcceptance,
    );
    expect(providerAcceptanceCall?.selectedColumns).toBe(BACKGROUND_JOB_EFFECT_COLUMNS);
    expect(providerAcceptanceCall?.parameters).toEqual({
      p_job_id: jobId,
      p_worker_id: 'worker-1',
      p_lease_token: leaseToken,
      p_effect_key: 'quote-1/email-1',
      p_effect_kind: 'email_dispatch',
      p_payload_hash: hash,
      p_provider_name: 'resend',
      p_provider_idempotency_key: 'quote-1/email-1',
      p_provider_idempotency_expires_at: '2026-07-20T02:02:03.000Z',
      p_provider_message_id: 'resend-message-1',
      p_safe_metadata: { effectKind: 'email_dispatch', checkpoint: 'provider_accepted' },
    });
    expect(calls.find((call) => call.name === BACKGROUND_JOBS_RPC_NAMES.workerHeartbeat)?.selectedColumns).toBe(
      BACKGROUND_WORKER_HEARTBEAT_COLUMNS,
    );
    expect(calls.find((call) => call.name === BACKGROUND_JOBS_RPC_NAMES.scheduleRetry)?.parameters).toMatchObject({
      p_error_code: 'TRANSIENT_FAILURE',
      p_error_message: 'TRANSIENT_FAILURE',
    });
  });

  it('parses aggregate health, recovery, reconciliation, and safe worker projections', async () => {
    const statusCounts = countMap(BACKGROUND_JOB_STATUSES) as Record<BackgroundJobStatus, number>;
    const kindCounts = countMap(BACKGROUND_JOB_KINDS) as Record<BackgroundJobKind, number>;
    const workerLifecycleCounts = countMap(BACKGROUND_JOB_WORKER_LIFECYCLE_STATES) as Record<
      BackgroundJobWorkerLifecycleState,
      number
    >;
    const queueHealthRow = {
      queue_depth: 2,
      oldest_message_age_seconds: 10,
      total_messages: 5,
      queued_jobs: 1,
      active_jobs: 1,
      retrying_jobs: 0,
      attention_jobs: 0,
      stale_workers: 0,
      measured_at: timestamp,
    };
    const { transport } = transportWithResponses({
      [BACKGROUND_JOBS_RPC_NAMES.recoverExpiredLeases]: 3,
      [BACKGROUND_JOBS_RPC_NAMES.reconcile]: { archivedMessages: 1, repairedMessages: 2, recoveredLeases: 3 },
      [BACKGROUND_JOBS_RPC_NAMES.queueHealth]: [queueHealthRow],
      [BACKGROUND_JOBS_RPC_NAMES.runtimeMetrics]: [
        {
          queue_depth: 2,
          oldest_message_age_seconds: 10,
          oldest_job_age_seconds: 20,
          due_jobs: 1,
          next_due_at: timestamp,
          status_counts: statusCounts,
          kind_counts: kindCounts,
          worker_lifecycle_counts: workerLifecycleCounts,
          stale_workers: 0,
          measured_at: timestamp,
        },
      ],
      [BACKGROUND_JOBS_RPC_NAMES.workersListSafe]: [{ ...workerRow, is_stale: false }],
    });
    const rpc = client(transport);

    await expect(rpc.recoverExpiredLeases({ workerId: 'worker-1', limit: 10 })).resolves.toBe(3);
    await expect(rpc.reconcile({ workerId: 'worker-1', limit: 10 })).resolves.toEqual({
      archivedMessages: 1,
      repairedMessages: 2,
      recoveredLeases: 3,
    });
    await expect(rpc.queueHealth()).resolves.toMatchObject({ queueDepth: 2, oldestMessageAgeSeconds: 10 });
    await expect(rpc.runtimeMetrics()).resolves.toMatchObject({ queueDepth: 2, oldestJobAgeSeconds: 20, dueJobs: 1 });
    await expect(rpc.workersListSafe({ limit: 10 })).resolves.toEqual([
      expect.objectContaining({ workerId: 'worker-1', isStale: false }),
    ]);
  });

  it('returns null only for a missing safe record and fails closed for other missing rows', async () => {
    const { transport } = transportWithResponses({
      [BACKGROUND_JOBS_RPC_NAMES.getSafeJob]: [],
      [BACKGROUND_JOBS_RPC_NAMES.readPayload]: [],
    });
    const rpc = client(transport);

    await expect(rpc.getSafeJob(jobId)).resolves.toBeNull();
    await expect(rpc.readPayload({ jobId, workerId: 'worker-1', leaseToken })).rejects.toMatchObject({
      code: 'BACKGROUND_JOBS_RPC_NOT_FOUND',
      rpcName: BACKGROUND_JOBS_RPC_NAMES.readPayload,
    });
  });

  it('never includes database error messages or invalid response data in errors', async () => {
    const secret = 'person@example.com bearer-private-value';
    const failingTransport: BackgroundJobsRpcTransport = {
      async call() {
        return { data: { secret }, error: { code: '55000', message: secret, details: secret } };
      },
    };
    const invalidTransport: BackgroundJobsRpcTransport = {
      async call() {
        return { data: [{ ...claimRow, payload: secret }], error: null };
      },
    };

    const failure = await client(failingTransport)
      .claim({ workerId: 'worker-1', batchSize: 1, visibilityTimeoutSeconds: 120 })
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(BackgroundJobsRpcError);
    expect(JSON.stringify(failure)).not.toContain(secret);
    expect(failure).toMatchObject({ code: 'BACKGROUND_JOBS_RPC_FAILED', databaseCode: '55000' });

    const invalid = await client(invalidTransport)
      .claim({ workerId: 'worker-1', batchSize: 1, visibilityTimeoutSeconds: 120 })
      .catch((error: unknown) => error);
    expect(String(invalid)).not.toContain(secret);
    expect(invalid).toMatchObject({ code: 'BACKGROUND_JOBS_RPC_INVALID_RESPONSE' });
  });
});
