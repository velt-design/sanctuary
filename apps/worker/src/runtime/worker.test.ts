import {
  BACKGROUND_JOB_KINDS,
  BACKGROUND_JOB_STATUSES,
  BACKGROUND_JOB_WORKER_LIFECYCLE_STATES,
  getBackgroundJobDefinition,
  type BackgroundJobClaim,
  type BackgroundJobKind,
  type BackgroundJobSafeRecord,
  type BackgroundJobStatus,
  type BackgroundJobWorkerLifecycleState,
} from '@sp/jobs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  BackgroundJobHandler,
  BackgroundJobHandlerRegistry,
  BackgroundJobWorkerConfig,
  RuntimeBackgroundJobsRpc,
  RuntimeLogger,
} from './contracts';
import { createBackgroundJobWorker } from './worker';

const NOW = Date.parse('2026-07-20T01:02:03.000Z');
const JOB_ID = '11111111-1111-4111-8111-111111111111';
const LEASE_TOKEN = '22222222-2222-4222-8222-222222222222';

function config(mode: BackgroundJobWorkerConfig['mode'], overrides: Partial<BackgroundJobWorkerConfig> = {}): BackgroundJobWorkerConfig {
  return {
    workerId: 'worker-1',
    buildVersion: 'build-1',
    mode,
    globalConcurrency: 2,
    concurrencyByClass: { email: 1, documents: 1, orchestration: 1 },
    concurrencyByKind: {},
    claimBatchSize: 2,
    visibilityTimeoutSeconds: 120,
    heartbeatIntervalMs: 10_000,
    workerHeartbeatIntervalMs: 1_000,
    pollIntervalMs: 100,
    reconciliationIntervalMs: 1_000,
    reconciliationLimit: 100,
    shutdownGraceMs: 1_000,
    abortSettleGraceMs: 500,
    rpcTimeoutMs: 5_000,
    ...overrides,
  };
}

function claim(kind: BackgroundJobKind = 'automation_event', overrides: Partial<BackgroundJobClaim> = {}): BackgroundJobClaim {
  const definition = getBackgroundJobDefinition(kind);
  return {
    jobId: JOB_ID,
    kind,
    contractVersion: definition.payloadContractVersion,
    status: 'claimed',
    currentPhase: 'claimed',
    attemptNumber: 1,
    maxAttempts: definition.retry.maxAttempts,
    queueMessageId: 42,
    leaseToken: LEASE_TOKEN,
    leaseExpiresAt: new Date(NOW + 120_000).toISOString(),
    cancellationRequestedAt: null,
    rolloutMode: 'worker_enabled',
    executionOwner: 'worker',
    ...overrides,
  };
}

function safeJob(jobClaim: BackgroundJobClaim): BackgroundJobSafeRecord {
  return {
    id: jobClaim.jobId,
    kind: jobClaim.kind,
    contractVersion: jobClaim.contractVersion,
    subjectType: 'worker_test',
    subjectId: 'subject-1',
    projectId: null,
    status: jobClaim.status,
    currentPhase: jobClaim.currentPhase,
    priority: 100,
    attemptCount: jobClaim.attemptNumber,
    maxAttempts: jobClaim.maxAttempts,
    nextAttemptAt: new Date(NOW).toISOString(),
    cancellationRequestedAt: jobClaim.cancellationRequestedAt,
    rolloutMode: jobClaim.rolloutMode,
    executionOwner: jobClaim.executionOwner,
    safeProgress: {},
    safeResult: {},
    errorCode: null,
    createdAt: new Date(NOW).toISOString(),
    updatedAt: new Date(NOW).toISOString(),
    startedAt: new Date(NOW).toISOString(),
    completedAt: null,
  };
}

function countMap<Values extends readonly string[]>(values: Values): Record<Values[number], number> {
  return Object.fromEntries(values.map((value) => [value, 0])) as Record<Values[number], number>;
}

function metrics(overrides: Partial<Awaited<ReturnType<RuntimeBackgroundJobsRpc['runtimeMetrics']>>> = {}) {
  return {
    queueDepth: 0,
    oldestMessageAgeSeconds: null,
    oldestJobAgeSeconds: 0,
    dueJobs: 0,
    nextDueAt: null,
    statusCounts: countMap(BACKGROUND_JOB_STATUSES) as Record<BackgroundJobStatus, number>,
    kindCounts: countMap(BACKGROUND_JOB_KINDS) as Record<BackgroundJobKind, number>,
    workerLifecycleCounts: countMap(BACKGROUND_JOB_WORKER_LIFECYCLE_STATES) as Record<
      BackgroundJobWorkerLifecycleState,
      number
    >,
    staleWorkers: 0,
    measuredAt: new Date(Date.now()).toISOString(),
    ...overrides,
  };
}

function logger(): RuntimeLogger {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function fullHandlers(handler: BackgroundJobHandler = async () => ({})): BackgroundJobHandlerRegistry {
  return Object.freeze(Object.fromEntries(BACKGROUND_JOB_KINDS.map((kind) => [kind, handler]))) as BackgroundJobHandlerRegistry;
}

function rpcFixture(options: Readonly<{
  claims?: () => Promise<readonly BackgroundJobClaim[]>;
  runtimeMetrics?: () => Promise<ReturnType<typeof metrics>>;
}> = {}) {
  const defaultClaim = claim();
  const record = safeJob(defaultClaim);
  const rpc = {
    claim: vi.fn(options.claims ?? (async () => [])),
    readPayload: vi.fn(async (input: { jobId: string }) => ({ contractVersion: 1, payloadHash: 'a'.repeat(64), payload: { jobId: input.jobId } })),
    readEffects: vi.fn(async () => []),
    readRuntimeContext: vi.fn(async () => ({
      jobId: defaultClaim.jobId,
      kind: defaultClaim.kind,
      contractVersion: defaultClaim.contractVersion,
      status: defaultClaim.status,
      currentPhase: defaultClaim.currentPhase,
      attemptCount: defaultClaim.attemptNumber,
      maxAttempts: defaultClaim.maxAttempts,
      startedAt: new Date(NOW).toISOString(),
      cancellationRequestedAt: null,
      rolloutMode: defaultClaim.rolloutMode,
      executionOwner: defaultClaim.executionOwner,
    })),
    getSafeJob: vi.fn(async () => record),
    heartbeat: vi.fn(async () => record),
    recordProgress: vi.fn(async () => record),
    recordEffectCheckpoint: vi.fn(),
    complete: vi.fn(async () => record),
    scheduleRetry: vi.fn(async () => record),
    markNeedsAttention: vi.fn(async () => record),
    markPermanentFailure: vi.fn(async () => record),
    acknowledgeCancellation: vi.fn(async () => record),
    releaseLease: vi.fn(async () => record),
    workerHeartbeat: vi.fn(async (input: { workerId: string; mode: string; lifecycleState: string; buildVersion: string; globalConcurrency: number; activeJobCount: number; safeMetadata: {} }) => ({
      ...input,
      safeMetadata: input.safeMetadata,
      startedAt: new Date(NOW).toISOString(),
      lastHeartbeatAt: new Date(Date.now()).toISOString(),
      shutdownRequestedAt: null,
      stoppedAt: null,
      updatedAt: new Date(Date.now()).toISOString(),
    })),
    recoverExpiredLeases: vi.fn(async () => 0),
    reconcile: vi.fn(async () => ({ archivedMessages: 0, repairedMessages: 0, recoveredLeases: 0 })),
    queueHealth: vi.fn(async () => ({
      queueDepth: 0,
      oldestMessageAgeSeconds: null,
      totalMessages: 0,
      queuedJobs: 0,
      activeJobs: 0,
      retryingJobs: 0,
      attentionJobs: 0,
      staleWorkers: 0,
      measuredAt: new Date(Date.now()).toISOString(),
    })),
    runtimeMetrics: vi.fn(options.runtimeMetrics ?? (async () => metrics())),
    workersListSafe: vi.fn(async () => []),
  } as unknown as RuntimeBackgroundJobsRpc;
  return rpc;
}

function workerOptions(
  workerConfig: BackgroundJobWorkerConfig,
  rpc: RuntimeBackgroundJobsRpc,
  handlers: BackgroundJobHandlerRegistry,
) {
  return {
    config: workerConfig,
    rpc,
    handlers,
    logger: logger(),
    fatalExit: (errorCode: string): never => {
      throw new Error(errorCode);
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createBackgroundJobWorker', () => {
  it.each(['active', 'once', 'drain'] as const)('refuses %s mode without worker-routed handler coverage', (mode) => {
    expect(() => createBackgroundJobWorker(workerOptions(config(mode), rpcFixture(), {}))).toThrow(
      'WORKER_HANDLER_COVERAGE_INCOMPLETE',
    );
  });

  it.each(['active', 'once', 'drain'] as const)(
    'allows %s mode when every worker-routed kind has a handler while legacy kinds stay dark',
    (mode) => {
      expect(() => createBackgroundJobWorker(workerOptions(config(mode), rpcFixture(), {
        ai_synthetic_v1: async () => ({}),
      }))).not.toThrow();
    },
  );

  it('runs dark without claiming or reconciling and shuts down idle without a grace timer', async () => {
    const rpc = rpcFixture();
    const worker = createBackgroundJobWorker(workerOptions(config('dark'), rpc, {}));
    const run = worker.run();
    await vi.waitFor(() => expect(worker.snapshot().lifecycleState).toBe('ready'));
    expect(rpc.claim).not.toHaveBeenCalled();
    expect(rpc.reconcile).not.toHaveBeenCalled();

    worker.requestShutdown('test');
    await expect(run).resolves.toMatchObject({ mode: 'dark', processedCount: 0 });
    expect(worker.snapshot().lifecycleState).toBe('stopped');
    expect(vi.mocked(rpc.workerHeartbeat).mock.calls.map(([input]) => input.lifecycleState).slice(-2)).toEqual([
      'draining',
      'stopped',
    ]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('processes exactly one claimed batch in once mode', async () => {
    let claimed = false;
    const jobClaim = claim();
    const rpc = rpcFixture({ claims: async () => {
      if (claimed) return [];
      claimed = true;
      return [jobClaim];
    } });
    const worker = createBackgroundJobWorker(workerOptions(config('once'), rpc, fullHandlers()));

    await expect(worker.run()).resolves.toMatchObject({ processedCount: 1, succeededCount: 1 });
    expect(rpc.claim).toHaveBeenCalledOnce();
    expect(rpc.complete).toHaveBeenCalledOnce();
    expect(rpc.reconcile).not.toHaveBeenCalled();
  });

  it('exits unhealthy and nonzero-equivalent when once-mode claim fails', async () => {
    const rpc = rpcFixture({ claims: async () => {
      throw new Error('database unavailable');
    } });
    const worker = createBackgroundJobWorker(workerOptions(config('once'), rpc, fullHandlers()));

    await expect(worker.run()).rejects.toThrow('CLAIM_FAILED');
    expect(worker.snapshot().lifecycleState).toBe('unhealthy');
    expect(rpc.readPayload).not.toHaveBeenCalled();
  });

  it('keeps drain mode alive until delayed accepted work becomes due and terminal', async () => {
    let completed = false;
    let claimed = false;
    const jobClaim = claim();
    const retryingCounts = countMap(BACKGROUND_JOB_STATUSES) as Record<BackgroundJobStatus, number>;
    retryingCounts.retrying = 1;
    const rpc = rpcFixture({
      claims: async () => {
        if (!claimed && Date.now() >= NOW + 500) {
          claimed = true;
          return [jobClaim];
        }
        return [];
      },
      runtimeMetrics: async () => completed
        ? metrics()
        : metrics({ queueDepth: 1, dueJobs: Date.now() >= NOW + 500 ? 1 : 0, nextDueAt: new Date(NOW + 500).toISOString(), statusCounts: retryingCounts }),
    });
    vi.mocked(rpc.complete).mockImplementation(async () => {
      completed = true;
      return safeJob(jobClaim);
    });
    const worker = createBackgroundJobWorker(workerOptions(config('drain'), rpc, fullHandlers()));
    let settled = false;
    const run = worker.run().then((value) => {
      settled = true;
      return value;
    });

    await vi.advanceTimersByTimeAsync(400);
    expect(settled).toBe(false);
    expect(rpc.complete).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(200);
    await expect(run).resolves.toMatchObject({ processedCount: 1, succeededCount: 1 });
    expect(rpc.reconcile).toHaveBeenCalled();
  });

  it('runs one SQL-owned reconciliation sweep without a duplicate recovery call', async () => {
    const rpc = rpcFixture();
    const worker = createBackgroundJobWorker(workerOptions(config('reconcile'), rpc, {}));
    await expect(worker.run()).resolves.toMatchObject({ mode: 'reconcile', processedCount: 0 });
    expect(rpc.reconcile).toHaveBeenCalledOnce();
    expect(rpc.recoverExpiredLeases).not.toHaveBeenCalled();
    expect(rpc.claim).not.toHaveBeenCalled();
  });

  it('does not claim until all runtime readiness probes recover', async () => {
    let metricsCalls = 0;
    const rpc = rpcFixture({ runtimeMetrics: async () => {
      metricsCalls += 1;
      if (metricsCalls === 1) throw new Error('migration unavailable');
      return metrics();
    } });
    const worker = createBackgroundJobWorker(workerOptions(config('active', { workerHeartbeatIntervalMs: 100 }), rpc, fullHandlers()));
    const run = worker.run();
    await vi.waitFor(() => expect(worker.snapshot().lifecycleState).toBe('unhealthy'));
    expect(rpc.claim).not.toHaveBeenCalled();
    expect(worker.snapshot().lastRuntimeMetrics).toBeNull();

    await vi.advanceTimersByTimeAsync(200);
    await vi.waitFor(() => expect(rpc.claim).toHaveBeenCalled());
    worker.requestShutdown();
    await run;
  });

  it('releases a claim returned after shutdown without dispatching its handler', async () => {
    const jobClaim = claim();
    let resolveClaim!: (claims: readonly BackgroundJobClaim[]) => void;
    const pendingClaim = new Promise<readonly BackgroundJobClaim[]>((resolve) => {
      resolveClaim = resolve;
    });
    let handlerCalls = 0;
    const handler: BackgroundJobHandler = async () => {
      handlerCalls += 1;
      return {};
    };
    const rpc = rpcFixture({ claims: async () => pendingClaim });
    const worker = createBackgroundJobWorker(workerOptions(config('active'), rpc, fullHandlers(handler)));
    const run = worker.run();
    await vi.waitFor(() => expect(rpc.claim).toHaveBeenCalledOnce());

    worker.requestShutdown('SIGTERM');
    resolveClaim([jobClaim]);

    await expect(run).resolves.toMatchObject({ processedCount: 0 });
    expect(rpc.releaseLease).toHaveBeenCalledWith({
      jobId: jobClaim.jobId,
      workerId: 'worker-1',
      leaseToken: jobClaim.leaseToken,
    });
    expect(rpc.readPayload).not.toHaveBeenCalled();
    expect(handlerCalls).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['once', 'drain', 'reconcile'] as const)(
    'fails %s startup when the ready-state probe fails after the initial probe',
    async (mode) => {
      let metricsCalls = 0;
      const rpc = rpcFixture({ runtimeMetrics: async () => {
        metricsCalls += 1;
        if (metricsCalls === 2) throw new Error('ready probe failed');
        return metrics();
      } });
      const worker = createBackgroundJobWorker(workerOptions(config(mode), rpc, fullHandlers()));

      await expect(worker.run()).rejects.toThrow('WORKER_STARTUP_UNHEALTHY');
      expect(worker.snapshot().lifecycleState).toBe('unhealthy');
      expect(rpc.claim).not.toHaveBeenCalled();
    },
  );

  it.each([
    {
      name: 'overlong',
      claims: [
        claim('automation_event', { jobId: '11111111-1111-4111-8111-111111111111' }),
        claim('job_pack_generate', { jobId: '22222222-2222-4222-8222-222222222222', leaseToken: '33333333-3333-4333-8333-333333333333' }),
        claim('quote_send', { jobId: '44444444-4444-4444-8444-444444444444', leaseToken: '55555555-5555-4555-8555-555555555555' }),
      ],
    },
    {
      name: 'duplicate job with different leases',
      claims: [
        claim('automation_event'),
        claim('automation_event', { leaseToken: '33333333-3333-4333-8333-333333333333' }),
      ],
    },
  ])('fails closed on a $name claim response without executing any row', async ({ claims }) => {
    const rpc = rpcFixture({ claims: async () => claims });
    const worker = createBackgroundJobWorker(workerOptions(config('once'), rpc, fullHandlers()));
    const run = worker.run();
    await expect(run).rejects.toThrow('CLAIM_RESPONSE_INVALID');
    expect(rpc.readPayload).not.toHaveBeenCalled();
    expect(rpc.recordProgress).not.toHaveBeenCalled();
    expect(rpc.complete).not.toHaveBeenCalled();
  });

  it('cancels the shutdown grace timer when active work settles cooperatively', async () => {
    const jobClaim = claim();
    let claimed = false;
    let releaseHandler!: () => void;
    const handlerGate = new Promise<void>((resolve) => {
      releaseHandler = resolve;
    });
    const handler: BackgroundJobHandler = async () => {
      await handlerGate;
      return {};
    };
    const rpc = rpcFixture({ claims: async () => {
      if (claimed) return [];
      claimed = true;
      return [jobClaim];
    } });
    const worker = createBackgroundJobWorker(workerOptions(config('active'), rpc, fullHandlers(handler)));
    const run = worker.run();
    await vi.waitFor(() => expect(rpc.readPayload).toHaveBeenCalled());

    worker.requestShutdown('SIGTERM');
    releaseHandler();
    await expect(run).resolves.toMatchObject({ succeededCount: 1 });
    expect(rpc.releaseLease).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('still force-aborts a later active batch after an earlier batch completed normally', async () => {
    const firstClaim = claim();
    const secondClaim = claim('automation_event', { leaseToken: '33333333-3333-4333-8333-333333333333' });
    let claimCall = 0;
    let handlerCall = 0;
    const handler: BackgroundJobHandler = async ({ signal }) => {
      handlerCall += 1;
      if (handlerCall === 1) return {};
      return new Promise((_, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
    };
    const rpc = rpcFixture({ claims: async () => {
      claimCall += 1;
      if (claimCall === 1) return [firstClaim];
      if (claimCall === 2) return [secondClaim];
      return [];
    } });
    const worker = createBackgroundJobWorker(workerOptions(
      config('active', { globalConcurrency: 1, claimBatchSize: 1 }),
      rpc,
      fullHandlers(handler),
    ));
    const run = worker.run();
    await vi.waitFor(() => expect(handlerCall).toBe(2));

    worker.requestShutdown('SIGTERM');
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(run).resolves.toMatchObject({ succeededCount: 1, retryingCount: 1 });
    expect(rpc.releaseLease).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});
