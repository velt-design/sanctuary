import {
  backgroundJobEffectAllowed,
  backgroundJobEffectTransitionAllowed,
  backgroundJobTransitionAllowed,
  getBackgroundJobAutomaticRetryDecision,
  getBackgroundJobDefinition,
  type BackgroundJobClaim,
  type BackgroundJobRuntimeContext,
  type BackgroundJobStatus,
  type BackgroundJobWorkerEffect,
} from '@sp/jobs';

import { BackgroundJobConcurrencyController } from './concurrency';
import type {
  BackgroundJobExecutionResult,
  BackgroundJobHandler,
  BackgroundJobHandlerResult,
  BackgroundJobHandlerRpc,
  RuntimeBackgroundJobsRpc,
  RuntimeClock,
  RuntimeLogger,
} from './contracts';
import {
  BackgroundJobAbortError,
  BackgroundJobHandlerError,
  toBackgroundJobHandlerError,
} from './errors';
import {
  startBackgroundJobLeaseHeartbeat,
  type BackgroundJobLeaseHeartbeat,
} from './leaseHeartbeat';

type ExecuteBackgroundJobInput = Readonly<{
  claim: BackgroundJobClaim;
  workerId: string;
  rpc: RuntimeBackgroundJobsRpc;
  logger: RuntimeLogger;
  clock: RuntimeClock;
  handler: BackgroundJobHandler | undefined;
  concurrency: BackgroundJobConcurrencyController;
  visibilityTimeoutSeconds: number;
  heartbeatIntervalMs: number;
  abortSettleGraceMs: number;
  forceAbortSignal: AbortSignal;
  onUnhealthy(errorCode: string): void;
  fatalExit(errorCode: string): never;
}>;

type HandlerSettlement =
  | Readonly<{ settled: true; fulfilled: true; value: BackgroundJobHandlerResult }>
  | Readonly<{ settled: true; fulfilled: false; error: unknown }>
  | Readonly<{ settled: false }>;

export class BackgroundJobFatalExitInvokedError extends Error {
  constructor(errorCode: string, options?: ErrorOptions) {
    super(errorCode, options);
    this.name = 'BackgroundJobFatalExitInvokedError';
  }
}

function ownedJob(claim: BackgroundJobClaim, workerId: string) {
  return { jobId: claim.jobId, workerId, leaseToken: claim.leaseToken } as const;
}

function result(
  claim: BackgroundJobClaim,
  outcome: BackgroundJobExecutionResult['outcome'],
  errorCode: string | null = null,
  delaySeconds: number | null = null,
): BackgroundJobExecutionResult {
  return { jobId: claim.jobId, kind: claim.kind, outcome, errorCode, delaySeconds };
}

function runtimeContextMatchesClaim(context: BackgroundJobRuntimeContext, claim: BackgroundJobClaim): boolean {
  return (
    context.jobId === claim.jobId &&
    context.kind === claim.kind &&
    context.contractVersion === claim.contractVersion &&
    context.status === claim.status &&
    context.currentPhase === claim.currentPhase &&
    context.attemptCount === claim.attemptNumber &&
    context.maxAttempts === claim.maxAttempts &&
    context.rolloutMode === claim.rolloutMode &&
    context.executionOwner === claim.executionOwner
  );
}

function isResumedFinalisation(claim: BackgroundJobClaim): boolean {
  return claim.status === 'provider_accepted' || claim.status === 'finalising';
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw signal.reason;
}

function throwIfCompletionLeaseIsUnsafe(signal: AbortSignal): void {
  if (
    signal.aborted &&
    signal.reason instanceof BackgroundJobAbortError &&
    ['heartbeat_failed', 'cancellation'].includes(signal.reason.reason)
  ) {
    throw signal.reason;
  }
}

function createHandlerRpc(
  input: ExecuteBackgroundJobInput,
  effectsRef: { current: readonly BackgroundJobWorkerEffect[] },
  stateRef: { status: BackgroundJobStatus },
  signal: AbortSignal,
): BackgroundJobHandlerRpc {
  const owned = ownedJob(input.claim, input.workerId);
  return Object.freeze({
    progress: async ({ status, phase, safeProgress = {} }) => {
      throwIfAborted(signal);
      if (!backgroundJobTransitionAllowed(stateRef.status, status)) {
        throw new BackgroundJobHandlerError({
          code: 'FINALISATION_STATE_REGRESSION',
          disposition: 'needs_attention',
        });
      }
      const job = await input.rpc.recordProgress({ ...owned, status, phase, safeProgress });
      throwIfAborted(signal);
      stateRef.status = status;
      return job;
    },
    recordEffectCheckpoint: async (checkpoint) => {
      throwIfAborted(signal);
      if (!backgroundJobEffectAllowed(input.claim.kind, checkpoint.effectKind, input.claim.contractVersion)) {
        throw new BackgroundJobHandlerError({
          code: 'UNDECLARED_EFFECT_CHECKPOINT',
          disposition: 'needs_attention',
        });
      }

      const previous = effectsRef.current.find((effect) => effect.effectKey === checkpoint.effectKey);
      if (isResumedFinalisation(input.claim)) {
        if (
          checkpoint.state !== 'finalised' ||
          !previous ||
          !['provider_accepted', 'finalised'].includes(previous.state)
        ) {
          throw new BackgroundJobHandlerError({
            code: 'FINALISATION_EFFECT_REGRESSION',
            disposition: 'needs_attention',
          });
        }
      } else if (previous && !backgroundJobEffectTransitionAllowed(previous.state, checkpoint.state)) {
        throw new BackgroundJobHandlerError({
          code: 'INVALID_EFFECT_TRANSITION',
          disposition: 'needs_attention',
        });
      }

      if (input.claim.executionOwner === 'shadow' && checkpoint.state !== 'prepared') {
        throw new BackgroundJobHandlerError({
          code: 'SHADOW_EFFECT_DISPATCH_BLOCKED',
          disposition: 'needs_attention',
        });
      }

      const effect = await input.rpc.recordEffectCheckpoint({ ...owned, ...checkpoint });
      throwIfAborted(signal);
      effectsRef.current = [
        ...effectsRef.current.filter((candidate) => candidate.effectKey !== effect.effectKey),
        effect,
      ];
      if (checkpoint.state === 'dispatch_started') stateRef.status = 'dispatching';
      if (checkpoint.state === 'provider_accepted') stateRef.status = 'provider_accepted';
      return effect;
    },
    refreshEffects: async () => {
      throwIfAborted(signal);
      const effects = await input.rpc.readEffects(owned);
      throwIfAborted(signal);
      effectsRef.current = effects;
      return effectsRef.current;
    },
  });
}

function abortNotification(signal: AbortSignal): Promise<Readonly<{ aborted: true; reason: unknown }>> {
  if (signal.aborted) return Promise.resolve({ aborted: true, reason: signal.reason });
  return new Promise((resolve) => {
    signal.addEventListener('abort', () => resolve({ aborted: true, reason: signal.reason }), { once: true });
  });
}

async function waitForHandlerAfterAbort(
  monitored: Promise<Exclude<HandlerSettlement, Readonly<{ settled: false }>>>,
  input: ExecuteBackgroundJobInput,
  abortReason: unknown,
): Promise<Exclude<HandlerSettlement, Readonly<{ settled: false }>>> {
  const graceController = new AbortController();
  const graceElapsed = input.clock.sleep(input.abortSettleGraceMs, graceController.signal)
    .then((): HandlerSettlement => ({ settled: false }))
    .catch((): HandlerSettlement => ({ settled: false }));
  const settlement = await Promise.race([monitored, graceElapsed]);
  graceController.abort(new BackgroundJobAbortError('shutdown'));
  if (settlement.settled) return settlement;

  input.onUnhealthy('HANDLER_ABORT_UNSETTLED');
  input.logger.error('background_job.abort_unsettled', {
    workerId: input.workerId,
    jobId: input.claim.jobId,
    kind: input.claim.kind,
    errorCode: 'HANDLER_ABORT_UNSETTLED',
  });
  const errorCode =
    abortReason instanceof BackgroundJobAbortError && abortReason.reason === 'heartbeat_failed'
      ? 'HANDLER_ABORT_UNSETTLED_AFTER_LEASE_LOSS'
      : 'HANDLER_ABORT_UNSETTLED';
  try {
    input.fatalExit(errorCode);
  } catch (error) {
    throw new BackgroundJobFatalExitInvokedError(errorCode, { cause: error });
  }
  throw new BackgroundJobFatalExitInvokedError(errorCode);
}

async function runHandlerWithAbortSafety(
  handler: BackgroundJobHandler,
  context: Parameters<BackgroundJobHandler>[0],
  input: ExecuteBackgroundJobInput,
  signal: AbortSignal,
): Promise<BackgroundJobHandlerResult> {
  // Setup RPCs yield to the event loop, so lease loss or shutdown can win
  // after the caller's last check. Never enter user code with a stale lease.
  if (signal.aborted) throw signal.reason;
  const monitored = handler(context).then(
    (value) => ({ settled: true, fulfilled: true, value }) as const,
    (error: unknown) => ({ settled: true, fulfilled: false, error }) as const,
  );
  const first = await Promise.race([monitored, abortNotification(signal)]);
  if ('settled' in first) {
    if (signal.aborted) throw signal.reason;
    if (first.fulfilled) return first.value;
    throw first.error;
  }

  const settlement = await waitForHandlerAfterAbort(monitored, input, first.reason);
  const abortReason = first.reason;
  // Once abort wins the race, settlement only proves the old attempt is no
  // longer live. It must not turn a timed-out or shutdown attempt into success.
  // The durable retry/release/cancellation decision remains owned below.
  throw abortReason;
}

async function hasUnsafeStartedEffect(input: ExecuteBackgroundJobInput): Promise<boolean | null> {
  if (isResumedFinalisation(input.claim) || input.claim.status === 'dispatching') return true;
  try {
    const effects = await input.rpc.readEffects(ownedJob(input.claim, input.workerId));
    return effects.some((effect) =>
      ['dispatch_started', 'provider_accepted', 'finalised', 'uncertain'].includes(effect.state),
    );
  } catch {
    return null;
  }
}

async function markNeedsAttention(
  input: ExecuteBackgroundJobInput,
  heartbeat: BackgroundJobLeaseHeartbeat,
  errorCode: string,
  reason: string,
): Promise<BackgroundJobExecutionResult> {
  heartbeat.beginTerminalMutation();
  try {
    await input.rpc.markNeedsAttention({
      ...ownedJob(input.claim, input.workerId),
      errorCode,
      safeDetail: { phase: 'needs_attention', progressCode: reason, retryable: false },
    });
    return result(input.claim, 'needs_attention', errorCode);
  } catch {
    input.onUnhealthy('TERMINAL_WRITE_FAILED');
    input.logger.error('background_job.terminal_write_failed', {
      workerId: input.workerId,
      jobId: input.claim.jobId,
      kind: input.claim.kind,
      errorCode: 'TERMINAL_WRITE_FAILED',
      reason,
    });
    return result(input.claim, 'deferred', 'TERMINAL_WRITE_FAILED');
  }
}

async function markPermanentFailure(
  input: ExecuteBackgroundJobInput,
  heartbeat: BackgroundJobLeaseHeartbeat,
  errorCode: string,
): Promise<BackgroundJobExecutionResult> {
  const unsafeEffect = await hasUnsafeStartedEffect(input);
  if (unsafeEffect !== false) {
    return markNeedsAttention(input, heartbeat, errorCode, 'unsafe_effect_terminal_failure');
  }

  heartbeat.beginTerminalMutation();
  try {
    await input.rpc.markPermanentFailure({ ...ownedJob(input.claim, input.workerId), errorCode });
    return result(input.claim, 'permanent_failed', errorCode);
  } catch {
    input.onUnhealthy('TERMINAL_WRITE_FAILED');
    input.logger.error('background_job.terminal_write_failed', {
      workerId: input.workerId,
      jobId: input.claim.jobId,
      kind: input.claim.kind,
      errorCode: 'TERMINAL_WRITE_FAILED',
    });
    return result(input.claim, 'deferred', 'TERMINAL_WRITE_FAILED');
  }
}

async function handleAbort(
  input: ExecuteBackgroundJobInput,
  heartbeat: BackgroundJobLeaseHeartbeat,
  error: BackgroundJobAbortError,
): Promise<BackgroundJobExecutionResult> {
  if (error.reason === 'heartbeat_failed') {
    // Lease ownership is uncertain, so only database recovery may transition the job.
    return result(input.claim, 'deferred', 'LEASE_HEARTBEAT_FAILED');
  }

  const unsafeEffect = await hasUnsafeStartedEffect(input);
  if (unsafeEffect !== false) {
    // Do not release or cancel work after dispatch starts. Lease expiry/reconciliation is the safe owner.
    return result(
      input.claim,
      'deferred',
      error.reason === 'shutdown' ? 'SHUTDOWN_REQUIRES_RECONCILIATION' : 'CANCELLATION_REQUIRES_RECONCILIATION',
    );
  }

  heartbeat.beginTerminalMutation();
  if (error.reason === 'cancellation') {
    try {
      await input.rpc.acknowledgeCancellation(ownedJob(input.claim, input.workerId));
      return result(input.claim, 'cancelled', 'CANCELLATION_REQUESTED');
    } catch {
      input.onUnhealthy('CANCELLATION_ACKNOWLEDGEMENT_FAILED');
      return result(input.claim, 'deferred', 'CANCELLATION_ACKNOWLEDGEMENT_FAILED');
    }
  }
  if (error.reason === 'shutdown') {
    try {
      await input.rpc.releaseLease(ownedJob(input.claim, input.workerId));
      return result(input.claim, 'lease_released', 'WORKER_SHUTDOWN');
    } catch {
      input.onUnhealthy('LEASE_RELEASE_FAILED');
      return result(input.claim, 'deferred', 'LEASE_RELEASE_FAILED');
    }
  }
  return result(input.claim, 'deferred', 'EXECUTION_TIMEOUT');
}

async function handleFailure(
  input: ExecuteBackgroundJobInput,
  heartbeat: BackgroundJobLeaseHeartbeat,
  error: unknown,
  runtimeContext: BackgroundJobRuntimeContext | null,
): Promise<BackgroundJobExecutionResult> {
  if (error instanceof BackgroundJobAbortError && error.reason !== 'timeout') {
    return handleAbort(input, heartbeat, error);
  }

  const handlerError = toBackgroundJobHandlerError(error);
  if (handlerError.disposition === 'needs_attention') {
    return markNeedsAttention(input, heartbeat, handlerError.code, 'handler_needs_attention');
  }
  if (handlerError.disposition === 'permanent_failure') {
    return markPermanentFailure(input, heartbeat, handlerError.code);
  }

  let effects: readonly BackgroundJobWorkerEffect[];
  try {
    effects = await input.rpc.readEffects(ownedJob(input.claim, input.workerId));
  } catch {
    return markNeedsAttention(input, heartbeat, 'EFFECT_STATE_UNAVAILABLE', 'effect_state_unavailable');
  }
  if (!runtimeContext) {
    return markNeedsAttention(input, heartbeat, 'RUNTIME_CONTEXT_UNAVAILABLE', 'runtime_context_unavailable');
  }

  const nowMs = input.clock.now();
  const startedAtMs = Date.parse(runtimeContext.startedAt);
  if (!Number.isFinite(startedAtMs) || startedAtMs > nowMs) {
    return markNeedsAttention(input, heartbeat, 'RETRY_CLOCK_INVALID', 'retry_clock_invalid');
  }

  let retryDecision;
  try {
    retryDecision = getBackgroundJobAutomaticRetryDecision(
      {
        kind: input.claim.kind,
        contractVersion: input.claim.contractVersion,
        executionOwner: input.claim.executionOwner,
        attemptNumber: input.claim.attemptNumber,
        elapsedSinceFirstAttemptMs: nowMs - startedAtMs,
        effects,
        nowMs,
      },
      { jitterKey: input.claim.jobId },
    );
  } catch {
    return markNeedsAttention(input, heartbeat, 'RETRY_POLICY_INVALID', 'retry_policy_invalid');
  }

  if (!retryDecision.retry) {
    if (
      retryDecision.reason === 'provider_already_accepted' ||
      retryDecision.reason === 'provider_outcome_unknown' ||
      retryDecision.reason === 'provider_idempotency_window_expired'
    ) {
      return markNeedsAttention(input, heartbeat, handlerError.code, retryDecision.reason);
    }
    return markPermanentFailure(input, heartbeat, handlerError.code);
  }

  const delaySeconds = Math.max(1, Math.ceil(retryDecision.delayMs / 1_000));
  heartbeat.beginTerminalMutation();
  try {
    await input.rpc.scheduleRetry({
      ...ownedJob(input.claim, input.workerId),
      delaySeconds,
      errorCode: handlerError.code,
    });
    return result(input.claim, 'retrying', handlerError.code, delaySeconds);
  } catch {
    input.onUnhealthy('RETRY_WRITE_FAILED');
    input.logger.error('background_job.retry_write_failed', {
      workerId: input.workerId,
      jobId: input.claim.jobId,
      kind: input.claim.kind,
      errorCode: 'RETRY_WRITE_FAILED',
    });
    return result(input.claim, 'deferred', 'RETRY_WRITE_FAILED');
  }
}

async function executeOwnedJob(
  input: ExecuteBackgroundJobInput,
  executionController: AbortController,
  heartbeat: BackgroundJobLeaseHeartbeat,
): Promise<BackgroundJobExecutionResult> {
  const definition = getBackgroundJobDefinition(input.claim.kind, input.claim.contractVersion);
  let runtimeContext: BackgroundJobRuntimeContext | null = null;

  try {
    runtimeContext = await input.rpc.readRuntimeContext(ownedJob(input.claim, input.workerId));
    if (!runtimeContextMatchesClaim(runtimeContext, input.claim)) {
      throw new BackgroundJobHandlerError({ code: 'RUNTIME_CONTEXT_MISMATCH', disposition: 'needs_attention' });
    }
    if (input.claim.executionOwner === 'legacy') {
      throw new BackgroundJobHandlerError({ code: 'INVALID_EXECUTION_OWNER', disposition: 'needs_attention' });
    }
    if (input.claim.maxAttempts !== definition.retry.maxAttempts) {
      throw new BackgroundJobHandlerError({ code: 'RETRY_POLICY_MISMATCH', disposition: 'needs_attention' });
    }
    if (runtimeContext.cancellationRequestedAt || input.claim.cancellationRequestedAt) {
      executionController.abort(new BackgroundJobAbortError('cancellation'));
      throw executionController.signal.reason;
    }
    if (!input.handler) {
      throw new BackgroundJobHandlerError({ code: 'UNSUPPORTED_JOB_KIND', disposition: 'needs_attention' });
    }

    if (input.claim.status === 'dispatching') {
      throw new BackgroundJobHandlerError({ code: 'PROVIDER_OUTCOME_UNCERTAIN', disposition: 'needs_attention' });
    }
    if (input.claim.status === 'queued' || input.claim.status === 'retrying') {
      throw new BackgroundJobHandlerError({ code: 'INVALID_CLAIM_STATUS', disposition: 'needs_attention' });
    }

    const [payload, initialEffects] = await Promise.all([
      input.rpc.readPayload(ownedJob(input.claim, input.workerId)),
      input.rpc.readEffects(ownedJob(input.claim, input.workerId)),
    ]);
    if (payload.contractVersion !== input.claim.contractVersion) {
      throw new BackgroundJobHandlerError({ code: 'PAYLOAD_CONTRACT_MISMATCH', disposition: 'needs_attention' });
    }

    // Setup can consume a meaningful part of the original claim lease. Renew
    // immediately before any handler work, rather than waiting for the timer.
    await heartbeat.renewNow();
    if (executionController.signal.aborted) throw executionController.signal.reason;

    const stateRef = { status: input.claim.status };
    if (stateRef.status === 'claimed') {
      await input.rpc.recordProgress({
        ...ownedJob(input.claim, input.workerId),
        status: 'preparing',
        phase: 'preparing',
        safeProgress: { phase: 'preparing', startedAt: new Date(input.clock.now()).toISOString() },
      });
      stateRef.status = 'preparing';
      if (executionController.signal.aborted) throw executionController.signal.reason;
    }
    if (stateRef.status === 'preparing') {
      await input.rpc.recordProgress({
        ...ownedJob(input.claim, input.workerId),
        status: 'running',
        phase: 'running',
        safeProgress: { phase: 'running', updatedAt: new Date(input.clock.now()).toISOString() },
      });
      stateRef.status = 'running';
      if (executionController.signal.aborted) throw executionController.signal.reason;
    }

    const effectsRef = { current: initialEffects };
    const timeoutController = new AbortController();
    const timeoutTask = input.clock.sleep(definition.timeoutMs, timeoutController.signal)
      .then(() => {
        if (!executionController.signal.aborted) {
          executionController.abort(new BackgroundJobAbortError('timeout'));
        }
      })
      .catch(() => undefined);

    let handlerResult: BackgroundJobHandlerResult;
    try {
      handlerResult = await runHandlerWithAbortSafety(
        input.handler,
        {
          claim: input.claim,
          payload,
          effects: effectsRef.current,
          signal: executionController.signal,
          rpc: createHandlerRpc(input, effectsRef, stateRef, executionController.signal),
          logger: input.logger,
          clock: input.clock,
        },
        input,
        executionController.signal,
      );
    } finally {
      timeoutController.abort(new BackgroundJobAbortError('shutdown'));
      await timeoutTask;
    }

    // A settled handler may finish finalisation during graceful shutdown, but
    // lease loss or cancellation must never flow into a completion mutation.
    throwIfCompletionLeaseIsUnsafe(executionController.signal);
    if (stateRef.status !== 'finalising') {
      if (!backgroundJobTransitionAllowed(stateRef.status, 'finalising')) {
        throw new BackgroundJobHandlerError({
          code: 'HANDLER_FINALISATION_INVALID',
          disposition: 'needs_attention',
        });
      }
      await input.rpc.recordProgress({
        ...ownedJob(input.claim, input.workerId),
        status: 'finalising',
        phase: 'finalising',
        safeProgress: { phase: 'finalising', updatedAt: new Date(input.clock.now()).toISOString() },
      });
      stateRef.status = 'finalising';
      throwIfCompletionLeaseIsUnsafe(executionController.signal);
    }

    heartbeat.beginTerminalMutation();
    try {
      await input.rpc.complete({
        ...ownedJob(input.claim, input.workerId),
        safeResult: handlerResult.safeResult ?? {},
      });
      return result(input.claim, 'succeeded');
    } catch {
      input.onUnhealthy('COMPLETION_WRITE_FAILED');
      input.logger.error('background_job.completion_write_failed', {
        workerId: input.workerId,
        jobId: input.claim.jobId,
        kind: input.claim.kind,
        errorCode: 'COMPLETION_WRITE_FAILED',
      });
      return result(input.claim, 'deferred', 'COMPLETION_WRITE_FAILED');
    }
  } catch (error) {
    if (error instanceof BackgroundJobFatalExitInvokedError) throw error;
    return handleFailure(input, heartbeat, error, runtimeContext);
  }
}

export async function executeBackgroundJob(input: ExecuteBackgroundJobInput): Promise<BackgroundJobExecutionResult> {
  const executionController = new AbortController();
  const onForceAbort = () => {
    if (!executionController.signal.aborted) {
      const reason = input.forceAbortSignal.reason;
      executionController.abort(
        reason instanceof BackgroundJobAbortError ? reason : new BackgroundJobAbortError('shutdown'),
      );
    }
  };
  input.forceAbortSignal.addEventListener('abort', onForceAbort, { once: true });
  if (input.forceAbortSignal.aborted) onForceAbort();

  const heartbeat = startBackgroundJobLeaseHeartbeat(input, executionController);
  const startedAt = input.clock.now();
  input.logger.info('background_job.execution_started', {
    workerId: input.workerId,
    jobId: input.claim.jobId,
    kind: input.claim.kind,
    attemptNumber: input.claim.attemptNumber,
  });

  try {
    const executionResult = await input.concurrency.run(input.claim.kind, executionController.signal, () =>
      executeOwnedJob(input, executionController, heartbeat),
    );
    input.logger.info('background_job.execution_finished', {
      workerId: input.workerId,
      jobId: input.claim.jobId,
      kind: input.claim.kind,
      attemptNumber: input.claim.attemptNumber,
      errorCode: executionResult.errorCode ?? undefined,
      durationMs: Math.max(0, input.clock.now() - startedAt),
    });
    return executionResult;
  } catch (error) {
    if (error instanceof BackgroundJobFatalExitInvokedError) throw error;
    return handleFailure(input, heartbeat, error, null);
  } finally {
    await heartbeat.stop();
    input.forceAbortSignal.removeEventListener('abort', onForceAbort);
  }
}
