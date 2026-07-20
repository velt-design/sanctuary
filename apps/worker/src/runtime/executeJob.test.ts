import {
  getBackgroundJobDefinition,
  type BackgroundJobClaim,
  type BackgroundJobKind,
  type BackgroundJobRuntimeContext,
  type BackgroundJobSafeRecord,
  type BackgroundJobWorkerEffect,
} from '@sp/jobs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BackgroundJobConcurrencyController } from './concurrency';
import type { RuntimeBackgroundJobsRpc, RuntimeLogger } from './contracts';
import { systemRuntimeClock } from './contracts';
import { BackgroundJobAbortError, BackgroundJobHandlerError } from './errors';
import { BackgroundJobFatalExitInvokedError, executeBackgroundJob } from './executeJob';

const NOW = Date.parse('2026-07-20T01:02:03.000Z');
const JOB_ID = '11111111-1111-4111-8111-111111111111';
const LEASE_TOKEN = '22222222-2222-4222-8222-222222222222';
const HASH = 'a'.repeat(64);

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function claim(
  kind: BackgroundJobKind = 'automation_event',
  overrides: Partial<BackgroundJobClaim> = {},
): BackgroundJobClaim {
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

function safeJob(jobClaim: BackgroundJobClaim, overrides: Partial<BackgroundJobSafeRecord> = {}): BackgroundJobSafeRecord {
  return {
    id: jobClaim.jobId,
    kind: jobClaim.kind,
    contractVersion: jobClaim.contractVersion,
    subjectType: 'background_job_test',
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
    ...overrides,
  };
}

function runtimeContext(jobClaim: BackgroundJobClaim): BackgroundJobRuntimeContext {
  return {
    jobId: jobClaim.jobId,
    kind: jobClaim.kind,
    contractVersion: jobClaim.contractVersion,
    status: jobClaim.status,
    currentPhase: jobClaim.currentPhase,
    attemptCount: jobClaim.attemptNumber,
    maxAttempts: jobClaim.maxAttempts,
    startedAt: new Date(NOW).toISOString(),
    cancellationRequestedAt: jobClaim.cancellationRequestedAt,
    rolloutMode: jobClaim.rolloutMode,
    executionOwner: jobClaim.executionOwner,
  };
}

function logger(): RuntimeLogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function rpcFixture(jobClaim: BackgroundJobClaim, initialEffects: readonly BackgroundJobWorkerEffect[] = []) {
  let effects = [...initialEffects];
  const record = safeJob(jobClaim);
  const rpc = {
    claim: vi.fn(async () => []),
    readPayload: vi.fn(async () => ({ contractVersion: jobClaim.contractVersion, payloadHash: HASH, payload: {} })),
    readEffects: vi.fn(async () => effects),
    readRuntimeContext: vi.fn(async () => runtimeContext(jobClaim)),
    getSafeJob: vi.fn(async () => record),
    heartbeat: vi.fn(async () => record),
    recordProgress: vi.fn(async () => record),
    recordEffectCheckpoint: vi.fn(async (input: { effectKey: string; effectKind: string; state: BackgroundJobWorkerEffect['state']; payloadHash: string; providerName?: string | null; providerIdempotencyKey?: string | null; providerIdempotencyExpiresAt?: string | null; providerMessageId?: string | null; safeMetadata?: BackgroundJobWorkerEffect['safeMetadata'] }) => {
      const effect: BackgroundJobWorkerEffect = {
        effectKey: input.effectKey,
        effectKind: input.effectKind,
        state: input.state,
        payloadHash: input.payloadHash,
        providerName: input.providerName ?? null,
        providerIdempotencyKey: input.providerIdempotencyKey ?? null,
        providerIdempotencyExpiresAt: input.providerIdempotencyExpiresAt ?? null,
        providerMessageId: input.providerMessageId ?? null,
        safeMetadata: input.safeMetadata ?? {},
      };
      effects = [...effects.filter((candidate) => candidate.effectKey !== effect.effectKey), effect];
      return effect;
    }),
    complete: vi.fn(async () => record),
    scheduleRetry: vi.fn(async () => record),
    markNeedsAttention: vi.fn(async () => record),
    markPermanentFailure: vi.fn(async () => record),
    acknowledgeCancellation: vi.fn(async () => record),
    releaseLease: vi.fn(async () => record),
    workerHeartbeat: vi.fn(),
    recoverExpiredLeases: vi.fn(async () => 0),
    reconcile: vi.fn(async () => ({ archivedMessages: 0, repairedMessages: 0, recoveredLeases: 0 })),
    queueHealth: vi.fn(),
    runtimeMetrics: vi.fn(),
    workersListSafe: vi.fn(async () => []),
  } as unknown as RuntimeBackgroundJobsRpc;
  return { rpc, effects: () => effects };
}

function executeInput(
  jobClaim: BackgroundJobClaim,
  rpc: RuntimeBackgroundJobsRpc,
  handler: Parameters<typeof executeBackgroundJob>[0]['handler'],
  overrides: Partial<Parameters<typeof executeBackgroundJob>[0]> = {},
) {
  return {
    claim: jobClaim,
    workerId: 'worker-1',
    rpc,
    logger: logger(),
    clock: systemRuntimeClock,
    handler,
    concurrency: new BackgroundJobConcurrencyController({ global: 1 }),
    visibilityTimeoutSeconds: 120,
    heartbeatIntervalMs: 1_000,
    abortSettleGraceMs: 500,
    forceAbortSignal: new AbortController().signal,
    onUnhealthy: vi.fn(),
    fatalExit: (errorCode: string): never => {
      throw new Error(errorCode);
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('executeBackgroundJob', () => {
  it('keeps renewing the lease through the durable completion mutation', async () => {
    const jobClaim = claim();
    const { rpc } = rpcFixture(jobClaim);
    const completion = deferred<BackgroundJobSafeRecord>();
    vi.mocked(rpc.complete).mockImplementation(() => completion.promise);

    const execution = executeBackgroundJob(executeInput(jobClaim, rpc, async () => ({ safeResult: { resultCode: 'ok' } })));
    await vi.waitFor(() => expect(rpc.complete).toHaveBeenCalledOnce());
    const heartbeatsBeforeCompletion = vi.mocked(rpc.heartbeat).mock.calls.length;
    await vi.advanceTimersByTimeAsync(1_000);
    expect(rpc.heartbeat).toHaveBeenCalledTimes(heartbeatsBeforeCompletion + 1);

    completion.resolve(safeJob(jobClaim, { status: 'succeeded' }));
    await expect(execution).resolves.toMatchObject({ outcome: 'succeeded', errorCode: null });
  });

  it('uses shared deterministic jitter and stops at retry exhaustion', async () => {
    const retryable = new BackgroundJobHandlerError({ code: 'TRANSIENT_FAILURE', disposition: 'retry' });
    const firstClaim = claim();
    const firstFixture = rpcFixture(firstClaim);
    const first = await executeBackgroundJob(executeInput(firstClaim, firstFixture.rpc, async () => {
      throw retryable;
    }));
    expect(first.outcome).toBe('retrying');
    expect(first.delaySeconds).toBeGreaterThanOrEqual(12);
    expect(first.delaySeconds).toBeLessThanOrEqual(15);
    expect(firstFixture.rpc.scheduleRetry).toHaveBeenCalledWith(expect.objectContaining({
      delaySeconds: first.delaySeconds,
      errorCode: 'TRANSIENT_FAILURE',
    }));

    const exhaustedClaim = claim('automation_event', {
      attemptNumber: getBackgroundJobDefinition('automation_event').retry.maxAttempts,
    });
    const exhaustedFixture = rpcFixture(exhaustedClaim);
    await expect(executeBackgroundJob(executeInput(exhaustedClaim, exhaustedFixture.rpc, async () => {
      throw retryable;
    }))).resolves.toMatchObject({ outcome: 'permanent_failed' });
    expect(exhaustedFixture.rpc.markPermanentFailure).toHaveBeenCalledOnce();
    expect(exhaustedFixture.rpc.scheduleRetry).not.toHaveBeenCalled();
  });

  it('resumes provider-accepted work monotonically without replaying preparation', async () => {
    const jobClaim = claim('quote_send', { status: 'provider_accepted', currentPhase: 'provider_accepted' });
    const acceptedEffect: BackgroundJobWorkerEffect = {
      effectKey: 'quote-1-email-1',
      effectKind: 'email_dispatch',
      state: 'provider_accepted',
      payloadHash: HASH,
      providerName: 'resend',
      providerIdempotencyKey: 'quote-1-email-1',
      providerIdempotencyExpiresAt: new Date(NOW + 60_000).toISOString(),
      providerMessageId: 'provider-1',
      safeMetadata: { effectKind: 'email_dispatch', checkpoint: 'provider_accepted' },
    };
    const { rpc } = rpcFixture(jobClaim, [acceptedEffect]);

    const execution = await executeBackgroundJob(executeInput(jobClaim, rpc, async ({ rpc: handlerRpc }) => {
      await handlerRpc.recordEffectCheckpoint({
        effectKey: acceptedEffect.effectKey,
        effectKind: acceptedEffect.effectKind,
        state: 'finalised',
        payloadHash: HASH,
        providerName: 'resend',
        providerIdempotencyKey: acceptedEffect.providerIdempotencyKey,
        providerIdempotencyExpiresAt: acceptedEffect.providerIdempotencyExpiresAt,
        providerMessageId: acceptedEffect.providerMessageId,
        safeMetadata: { effectKind: 'email_dispatch', checkpoint: 'finalised' },
      });
      return { safeResult: { providerAccepted: true } };
    }));

    expect(execution.outcome).toBe('succeeded');
    expect(rpc.recordProgress).toHaveBeenCalledOnce();
    expect(rpc.recordProgress).toHaveBeenCalledWith(expect.objectContaining({
      status: 'finalising',
      phase: 'finalising',
    }));
    expect(vi.mocked(rpc.recordProgress).mock.calls.some(([input]) => input.status === 'preparing')).toBe(false);
    expect(rpc.recordEffectCheckpoint).toHaveBeenCalledWith(expect.objectContaining({ state: 'finalised' }));
    expect(rpc.complete).toHaveBeenCalledOnce();
  });

  it('blocks effect regression while resuming finalisation', async () => {
    const jobClaim = claim('quote_send', { status: 'finalising', currentPhase: 'business_finalising' });
    const acceptedEffect: BackgroundJobWorkerEffect = {
      effectKey: 'quote-1-email-1',
      effectKind: 'email_dispatch',
      state: 'provider_accepted',
      payloadHash: HASH,
      providerName: 'resend',
      providerIdempotencyKey: 'quote-1-email-1',
      providerIdempotencyExpiresAt: new Date(NOW + 60_000).toISOString(),
      providerMessageId: 'provider-1',
      safeMetadata: {},
    };
    const { rpc } = rpcFixture(jobClaim, [acceptedEffect]);

    await expect(executeBackgroundJob(executeInput(jobClaim, rpc, async ({ rpc: handlerRpc }) => {
      await handlerRpc.recordEffectCheckpoint({
        effectKey: acceptedEffect.effectKey,
        effectKind: acceptedEffect.effectKind,
        state: 'prepared',
        payloadHash: HASH,
      });
      return {};
    }))).resolves.toMatchObject({ outcome: 'needs_attention', errorCode: 'FINALISATION_EFFECT_REGRESSION' });
    expect(rpc.recordEffectCheckpoint).not.toHaveBeenCalled();
    expect(rpc.markNeedsAttention).toHaveBeenCalledWith(expect.objectContaining({
      safeDetail: { phase: 'needs_attention', progressCode: 'handler_needs_attention', retryable: false },
    }));
  });

  it('does not release a shutdown-aborted lease after dispatch starts', async () => {
    const jobClaim = claim('quote_send');
    const { rpc } = rpcFixture(jobClaim);
    const forceAbort = new AbortController();

    const execution = executeBackgroundJob(executeInput(jobClaim, rpc, async (context) => {
      await context.rpc.recordEffectCheckpoint({
        effectKey: 'quote-1-email-1',
        effectKind: 'email_dispatch',
        state: 'dispatch_started',
        payloadHash: HASH,
        providerName: 'resend',
        providerIdempotencyKey: 'quote-1-email-1',
        providerIdempotencyExpiresAt: new Date(NOW + 60_000).toISOString(),
      });
      forceAbort.abort(new BackgroundJobAbortError('shutdown'));
      throw context.signal.reason;
    }, { forceAbortSignal: forceAbort.signal }));

    await expect(execution).resolves.toMatchObject({
      outcome: 'deferred',
      errorCode: 'SHUTDOWN_REQUIRES_RECONCILIATION',
    });
    expect(rpc.releaseLease).not.toHaveBeenCalled();
    expect(rpc.scheduleRetry).not.toHaveBeenCalled();
  });

  it('fatal-exits before terminal writes when a timed-out handler ignores abort', async () => {
    const jobClaim = claim();
    const { rpc } = rpcFixture(jobClaim);
    const handlerGate = deferred<{ safeResult: {} }>();
    const onUnhealthy = vi.fn();
    const fatalExit = vi.fn((errorCode: string): never => {
      throw new Error(errorCode);
    });
    const execution = executeBackgroundJob(executeInput(
      jobClaim,
      rpc,
      () => handlerGate.promise,
      { onUnhealthy, fatalExit },
    ));
    const fatalResult = expect(execution).rejects.toBeInstanceOf(BackgroundJobFatalExitInvokedError);

    await vi.waitFor(() => expect(rpc.heartbeat).toHaveBeenCalled());
    await vi.advanceTimersByTimeAsync(getBackgroundJobDefinition(jobClaim.kind).timeoutMs + 500);
    await fatalResult;
    expect(onUnhealthy).toHaveBeenCalledWith('HANDLER_ABORT_UNSETTLED');
    expect(fatalExit).toHaveBeenCalledWith('HANDLER_ABORT_UNSETTLED');
    expect(rpc.scheduleRetry).not.toHaveBeenCalled();
    expect(rpc.releaseLease).not.toHaveBeenCalled();
    expect(rpc.markNeedsAttention).not.toHaveBeenCalled();
  });

  it('does not complete when a cooperative handler resolves after execution timeout', async () => {
    const jobClaim = claim();
    const { rpc } = rpcFixture(jobClaim);
    const execution = executeBackgroundJob(executeInput(jobClaim, rpc, ({ signal }) =>
      new Promise((resolve) => {
        signal.addEventListener('abort', () => resolve({}), { once: true });
      })));

    await vi.waitFor(() => expect(rpc.heartbeat).toHaveBeenCalled());
    await vi.advanceTimersByTimeAsync(getBackgroundJobDefinition(jobClaim.kind).timeoutMs);
    await expect(execution).resolves.toMatchObject({ outcome: 'retrying', errorCode: 'EXECUTION_TIMEOUT' });
    expect(rpc.complete).not.toHaveBeenCalled();
    expect(rpc.scheduleRetry).toHaveBeenCalledOnce();
  });

  it('releases only pre-dispatch work when a cooperative handler resolves after forced shutdown', async () => {
    const jobClaim = claim();
    const { rpc } = rpcFixture(jobClaim);
    const forceAbort = new AbortController();
    const execution = executeBackgroundJob(executeInput(jobClaim, rpc, ({ signal }) =>
      new Promise((resolve) => {
        signal.addEventListener('abort', () => resolve({}), { once: true });
      }), { forceAbortSignal: forceAbort.signal }));

    await vi.waitFor(() => expect(rpc.heartbeat).toHaveBeenCalled());
    forceAbort.abort('SIGTERM');
    await expect(execution).resolves.toMatchObject({ outcome: 'lease_released', errorCode: 'WORKER_SHUTDOWN' });
    expect(rpc.complete).not.toHaveBeenCalled();
    expect(rpc.releaseLease).toHaveBeenCalledOnce();
  });

  it('never invokes the handler when shutdown wins during setup progress', async () => {
    const jobClaim = claim();
    const { rpc } = rpcFixture(jobClaim);
    const forceAbort = new AbortController();
    const handler = vi.fn(async () => ({}));
    vi.mocked(rpc.recordProgress).mockImplementationOnce(async () => {
      forceAbort.abort(new BackgroundJobAbortError('shutdown'));
      return safeJob(jobClaim, { status: 'preparing', currentPhase: 'preparing' });
    });

    await expect(executeBackgroundJob(executeInput(jobClaim, rpc, handler, {
      forceAbortSignal: forceAbort.signal,
    }))).resolves.toMatchObject({ outcome: 'lease_released', errorCode: 'WORKER_SHUTDOWN' });
    expect(handler).not.toHaveBeenCalled();
    expect(rpc.recordProgress).toHaveBeenCalledOnce();
    expect(rpc.complete).not.toHaveBeenCalled();
    expect(rpc.releaseLease).toHaveBeenCalledOnce();
  });

  it('blocks handler checkpoints attempted after lease heartbeat loss', async () => {
    const jobClaim = claim('quote_send');
    const { rpc } = rpcFixture(jobClaim);
    vi.mocked(rpc.heartbeat)
      .mockResolvedValueOnce(safeJob(jobClaim))
      .mockRejectedValueOnce(new Error('lease renewal unavailable'));
    const handler = vi.fn(async (
      context: Parameters<NonNullable<Parameters<typeof executeBackgroundJob>[0]['handler']>>[0],
    ) => {
      await new Promise<void>((resolve) => {
        context.signal.addEventListener('abort', () => resolve(), { once: true });
      });
      await context.rpc.recordEffectCheckpoint({
        effectKey: 'quote-1-email-1',
        effectKind: 'email_dispatch',
        state: 'prepared',
        payloadHash: HASH,
      });
      return {};
    });

    const execution = executeBackgroundJob(executeInput(jobClaim, rpc, handler));
    await vi.waitFor(() => expect(handler).toHaveBeenCalledOnce());
    await vi.advanceTimersByTimeAsync(1_000);

    await expect(execution).resolves.toMatchObject({
      outcome: 'deferred',
      errorCode: 'LEASE_HEARTBEAT_FAILED',
    });
    expect(rpc.recordEffectCheckpoint).not.toHaveBeenCalled();
    expect(rpc.complete).not.toHaveBeenCalled();
  });

  it('does not complete after lease heartbeat loss during finalising progress', async () => {
    const jobClaim = claim();
    const { rpc } = rpcFixture(jobClaim);
    const finalising = deferred<BackgroundJobSafeRecord>();
    vi.mocked(rpc.heartbeat)
      .mockResolvedValueOnce(safeJob(jobClaim))
      .mockRejectedValueOnce(new Error('lease renewal unavailable'));
    vi.mocked(rpc.recordProgress).mockImplementation(async (input) => {
      if (input.status === 'finalising') return finalising.promise;
      return safeJob(jobClaim, { status: input.status, currentPhase: input.phase });
    });

    const execution = executeBackgroundJob(executeInput(jobClaim, rpc, async () => ({})));
    await vi.waitFor(() => expect(rpc.recordProgress).toHaveBeenCalledWith(expect.objectContaining({
      status: 'finalising',
    })));
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.waitFor(() => expect(rpc.heartbeat).toHaveBeenCalledTimes(2));
    finalising.resolve(safeJob(jobClaim, { status: 'finalising', currentPhase: 'finalising' }));

    await expect(execution).resolves.toMatchObject({
      outcome: 'deferred',
      errorCode: 'LEASE_HEARTBEAT_FAILED',
    });
    expect(rpc.complete).not.toHaveBeenCalled();
  });

  it('allows a settled handler to finish finalisation during graceful shutdown', async () => {
    const jobClaim = claim();
    const { rpc } = rpcFixture(jobClaim);
    const forceAbort = new AbortController();
    const finalising = deferred<BackgroundJobSafeRecord>();
    vi.mocked(rpc.recordProgress).mockImplementation(async (input) => {
      if (input.status === 'finalising') return finalising.promise;
      return safeJob(jobClaim, { status: input.status, currentPhase: input.phase });
    });

    const execution = executeBackgroundJob(executeInput(
      jobClaim,
      rpc,
      async () => ({}),
      { forceAbortSignal: forceAbort.signal },
    ));
    await vi.waitFor(() => expect(rpc.recordProgress).toHaveBeenCalledWith(expect.objectContaining({
      status: 'finalising',
    })));
    forceAbort.abort(new BackgroundJobAbortError('shutdown'));
    finalising.resolve(safeJob(jobClaim, { status: 'finalising', currentPhase: 'finalising' }));

    await expect(execution).resolves.toMatchObject({ outcome: 'succeeded', errorCode: null });
    expect(rpc.complete).toHaveBeenCalledOnce();
    expect(rpc.releaseLease).not.toHaveBeenCalled();
  });

  it('stops durable writes and poisons the worker after lease heartbeat loss', async () => {
    const jobClaim = claim();
    const fixture = rpcFixture(jobClaim);
    vi.mocked(fixture.rpc.heartbeat)
      .mockResolvedValueOnce(safeJob(jobClaim))
      .mockRejectedValueOnce(new Error('network unavailable'));
    const onUnhealthy = vi.fn();
    const execution = executeBackgroundJob(executeInput(jobClaim, fixture.rpc, ({ signal }) =>
      new Promise((_, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      }), { onUnhealthy }));

    await vi.waitFor(() => expect(fixture.rpc.heartbeat).toHaveBeenCalledOnce());
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(execution).resolves.toMatchObject({ outcome: 'deferred', errorCode: 'LEASE_HEARTBEAT_FAILED' });
    expect(onUnhealthy).toHaveBeenCalledWith('LEASE_HEARTBEAT_FAILED');
    expect(fixture.rpc.scheduleRetry).not.toHaveBeenCalled();
    expect(fixture.rpc.releaseLease).not.toHaveBeenCalled();
    expect(fixture.rpc.markNeedsAttention).not.toHaveBeenCalled();
  });
});
