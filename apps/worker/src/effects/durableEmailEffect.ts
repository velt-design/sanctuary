import {
  DurableResendDispatchError,
  RESEND_PROVIDER_NAME,
  ResendGatewayConfigurationError,
  createDurableResendEmailDispatch,
  createResendIdempotencyExpiresAt,
  type DurableResendEmailDispatch,
  type EmailMessageInput,
  type NormalizedEmailMessage,
  type ResendDispatchOutcome,
  type ResendEmailGateway,
} from '@sp/email-provider';
import type {
  BackgroundJobSafeEffectSummary,
  BackgroundJobWorkerEffect,
} from '@sp/jobs';

import type {
  BackgroundJobHandlerRpc,
  RuntimeClock,
} from '../runtime/contracts';
import { BackgroundJobHandlerError } from '../runtime/errors';

const DURABLE_EMAIL_EFFECT_KIND = 'email_dispatch' as const;
export const DURABLE_EMAIL_PROVIDER_TIMEOUT_MS = 15_000;

type DurableEmailEffectState = 'provider_accepted' | 'finalised';

type DurableEmailProviderAcceptance = Readonly<{
  dispatch: DurableResendEmailDispatch;
  effect: BackgroundJobWorkerEffect & Readonly<{ state: DurableEmailEffectState }>;
  providerMessageId: string;
}>;

type DispatchDurableEmailEffectInput = Readonly<{
  jobId: string;
  effectKey: string;
  message: EmailMessageInput | NormalizedEmailMessage;
  effects: readonly BackgroundJobWorkerEffect[];
  rpc: BackgroundJobHandlerRpc;
  gateway: ResendEmailGateway;
  clock: RuntimeClock;
  signal: AbortSignal;
  timeoutMs?: number;
}>;

type FinaliseDurableEmailEffectInput<Result> = Readonly<{
  acceptance: DurableEmailProviderAcceptance;
  rpc: BackgroundJobHandlerRpc;
  /** Must be transactionally idempotent because a crash can lose the local return. */
  finalise(input: Readonly<{
    providerMessageId: string;
    dispatch: DurableResendEmailDispatch;
  }>): Promise<Result>;
}>;

type DurableEmailFinalisation<Result> = Readonly<{
  effect: BackgroundJobWorkerEffect & Readonly<{ state: 'finalised' }>;
  alreadyFinalised: boolean;
  result: Result | null;
}>;

const PREPARED_METADATA = Object.freeze({
  effectKind: DURABLE_EMAIL_EFFECT_KIND,
  checkpoint: 'prepared',
  providerName: RESEND_PROVIDER_NAME,
}) satisfies BackgroundJobSafeEffectSummary;

const DISPATCH_STARTED_METADATA = Object.freeze({
  effectKind: DURABLE_EMAIL_EFFECT_KIND,
  checkpoint: 'dispatch_started',
  providerName: RESEND_PROVIDER_NAME,
}) satisfies BackgroundJobSafeEffectSummary;

const UNCERTAIN_METADATA = Object.freeze({
  effectKind: DURABLE_EMAIL_EFFECT_KIND,
  checkpoint: 'uncertain',
  providerName: RESEND_PROVIDER_NAME,
}) satisfies BackgroundJobSafeEffectSummary;

const FAILED_METADATA = Object.freeze({
  effectKind: DURABLE_EMAIL_EFFECT_KIND,
  checkpoint: 'failed',
  providerName: RESEND_PROVIDER_NAME,
}) satisfies BackgroundJobSafeEffectSummary;

/** Must exactly match the out-of-band webhook reconciliation checkpoint. */
export const PROVIDER_ACCEPTED_EMAIL_METADATA = Object.freeze({
  effectKind: DURABLE_EMAIL_EFFECT_KIND,
  checkpoint: 'provider_accepted',
  providerName: RESEND_PROVIDER_NAME,
  providerAccepted: true,
}) satisfies BackgroundJobSafeEffectSummary;

const FINALISED_METADATA = Object.freeze({
  effectKind: DURABLE_EMAIL_EFFECT_KIND,
  checkpoint: 'finalised',
  providerName: RESEND_PROVIDER_NAME,
  providerAccepted: true,
}) satisfies BackgroundJobSafeEffectSummary;

function handlerError(
  code: string,
  disposition: 'retry' | 'needs_attention' | 'permanent_failure',
  cause?: unknown,
): BackgroundJobHandlerError {
  return new BackgroundJobHandlerError({ code, disposition, cause });
}

function effectForEmail(
  effects: readonly BackgroundJobWorkerEffect[],
): BackgroundJobWorkerEffect | null {
  const matching = effects.filter((effect) => effect.effectKind === DURABLE_EMAIL_EFFECT_KIND);
  if (matching.length > 1) {
    throw handlerError('EMAIL_EFFECT_DUPLICATED', 'needs_attention');
  }
  return matching[0] ?? null;
}

function timestampMatches(left: string | null, right: string): boolean {
  if (left === null) return false;
  const leftMs = Date.parse(left);
  const rightMs = Date.parse(right);
  return Number.isFinite(leftMs) && leftMs === rightMs;
}

function assertFrozenIdentity(
  effect: BackgroundJobWorkerEffect,
  dispatch: DurableResendEmailDispatch,
): void {
  if (
    effect.effectKey !== dispatch.effectKey ||
    effect.payloadHash !== dispatch.payloadHash ||
    effect.providerName !== dispatch.provider ||
    effect.providerIdempotencyKey !== dispatch.idempotencyKey ||
    !timestampMatches(effect.providerIdempotencyExpiresAt, dispatch.idempotencyExpiresAt)
  ) {
    throw handlerError('EMAIL_EFFECT_IDENTITY_MISMATCH', 'needs_attention');
  }
}

function acceptedEffect(
  effect: BackgroundJobWorkerEffect,
  dispatch: DurableResendEmailDispatch,
): DurableEmailProviderAcceptance | null {
  if (effect.state !== 'provider_accepted' && effect.state !== 'finalised') return null;
  if (!effect.providerMessageId) {
    throw handlerError('EMAIL_PROVIDER_MESSAGE_ID_MISSING', 'needs_attention');
  }
  return {
    dispatch,
    effect: effect as BackgroundJobWorkerEffect & Readonly<{ state: DurableEmailEffectState }>,
    providerMessageId: effect.providerMessageId,
  };
}

function checkpointIdentity(dispatch: DurableResendEmailDispatch) {
  return {
    effectKey: dispatch.effectKey,
    effectKind: DURABLE_EMAIL_EFFECT_KIND,
    payloadHash: dispatch.payloadHash,
    providerName: dispatch.provider,
    providerIdempotencyKey: dispatch.idempotencyKey,
    providerIdempotencyExpiresAt: dispatch.idempotencyExpiresAt,
  } as const;
}

function assertLiveIdempotencyWindow(
  dispatch: DurableResendEmailDispatch,
  nowMs: number,
): void {
  if (Date.parse(dispatch.idempotencyExpiresAt) <= nowMs) {
    throw handlerError('EMAIL_IDEMPOTENCY_WINDOW_EXPIRED', 'needs_attention');
  }
}

async function recordFailureState(
  rpc: BackgroundJobHandlerRpc,
  dispatch: DurableResendEmailDispatch,
  state: 'failed' | 'uncertain',
): Promise<BackgroundJobWorkerEffect> {
  return rpc.recordEffectCheckpoint({
    ...checkpointIdentity(dispatch),
    state,
    safeMetadata: state === 'uncertain' ? UNCERTAIN_METADATA : FAILED_METADATA,
  });
}

async function recordFailureStateOrAcceptance(
  input: DispatchDurableEmailEffectInput,
  dispatch: DurableResendEmailDispatch,
  state: 'failed' | 'uncertain',
): Promise<DurableEmailProviderAcceptance | null> {
  try {
    const effect = await recordFailureState(input.rpc, dispatch, state);
    const acceptance = acceptedEffect(effect, dispatch);
    if (acceptance) return acceptance;
  } catch (error) {
    // A signed webhook can commit provider acceptance while this worker is
    // trying to persist the local failure outcome. Acceptance is the stronger
    // durable fact, so recover it instead of turning the race into operator
    // attention. An aborted handler cannot perform the extra read; lease
    // recovery will resume an out-of-band accepted checkpoint instead.
    if (!input.signal.aborted) {
      const acceptance = await refreshAcceptedEffect(input.rpc, dispatch);
      if (acceptance) return acceptance;
    }
    throw error;
  }

  if (input.signal.aborted) return null;
  return refreshAcceptedEffect(input.rpc, dispatch);
}

async function refreshAcceptedEffect(
  rpc: BackgroundJobHandlerRpc,
  dispatch: DurableResendEmailDispatch,
): Promise<DurableEmailProviderAcceptance | null> {
  const effect = effectForEmail(await rpc.refreshEffects());
  if (!effect) return null;
  assertFrozenIdentity(effect, dispatch);
  return acceptedEffect(effect, dispatch);
}

async function handleProviderOutcome(
  outcome: ResendDispatchOutcome,
  input: DispatchDurableEmailEffectInput,
  dispatch: DurableResendEmailDispatch,
): Promise<DurableEmailProviderAcceptance> {
  if (outcome.outcome === 'accepted') {
    let acceptance: DurableEmailProviderAcceptance | null;
    try {
      const effect = await input.rpc.recordEffectCheckpoint({
        ...checkpointIdentity(dispatch),
        state: 'provider_accepted',
        providerMessageId: outcome.messageId,
        safeMetadata: PROVIDER_ACCEPTED_EMAIL_METADATA,
      });
      acceptance = acceptedEffect(effect, dispatch);
    } catch (error) {
      if (
        error instanceof BackgroundJobHandlerError &&
        error.disposition === 'needs_attention_recorded'
      ) {
        throw error;
      }
      // A response can be lost while a same-message webhook commits the
      // acceptance. Re-read only as a fallback for a rejected checkpoint; the
      // normal accepted-response path always enters the atomic acceptance RPC
      // so a different message cannot bypass durable quarantine.
      try {
        acceptance = await refreshAcceptedEffect(input.rpc, dispatch);
      } catch {
        throw error;
      }
      if (!acceptance) throw error;
    }
    if (!acceptance) {
      throw handlerError('EMAIL_ACCEPTANCE_CHECKPOINT_INVALID', 'needs_attention');
    }
    if (acceptance.providerMessageId !== outcome.messageId) {
      throw handlerError('EMAIL_PROVIDER_MESSAGE_ID_CONFLICT', 'needs_attention');
    }
    return acceptance;
  }

  if (outcome.outcome === 'retryable_rejection') {
    const acceptance = await recordFailureStateOrAcceptance(input, dispatch, 'uncertain');
    if (acceptance) return acceptance;
    throw handlerError(outcome.code, 'retry');
  }

  if (outcome.outcome === 'uncertain') {
    const acceptance = await recordFailureStateOrAcceptance(input, dispatch, 'uncertain');
    if (acceptance) return acceptance;
    throw handlerError(outcome.code, 'retry');
  }

  if (outcome.outcome === 'idempotency_conflict') {
    // A signed callback is still durable evidence that this provider key was
    // accepted, but it cannot explain why the provider reported a different
    // payload for that same key. Preserve both facts and require attention.
    await recordFailureStateOrAcceptance(input, dispatch, 'failed');
    throw handlerError(outcome.code, 'needs_attention');
  }

  if (outcome.outcome === 'terminal_rejection') {
    const acceptance = await recordFailureStateOrAcceptance(input, dispatch, 'failed');
    if (acceptance) return acceptance;
    throw handlerError(outcome.code, 'needs_attention');
  }

  const failureState = outcome.code === 'RESEND_ABORTED_BEFORE_DISPATCH'
    ? 'uncertain'
    : 'failed';
  const acceptance = await recordFailureStateOrAcceptance(input, dispatch, failureState);
  if (acceptance) return acceptance;
  if (outcome.code === 'RESEND_IDEMPOTENCY_EXPIRED') {
    throw handlerError('EMAIL_IDEMPOTENCY_WINDOW_EXPIRED', 'needs_attention');
  }
  if (input.signal.aborted) throw input.signal.reason;
  throw handlerError(outcome.code, 'retry');
}

/**
 * Prepares and dispatches exactly one durable email intent. Every restart
 * reconstructs and verifies the exact wire payload before the provider is
 * called, and an accepted/finalised checkpoint always short-circuits sending.
 */
export async function dispatchDurableEmailEffect(
  input: DispatchDurableEmailEffectInput,
): Promise<DurableEmailProviderAcceptance> {
  let effects = input.effects;
  let existing = effectForEmail(effects);

  if (existing) {
    effects = await input.rpc.refreshEffects();
    existing = effectForEmail(effects);
  }

  const idempotencyExpiresAt = existing?.providerIdempotencyExpiresAt ??
    createResendIdempotencyExpiresAt(input.clock.now());
  if (!idempotencyExpiresAt) {
    throw handlerError('EMAIL_IDEMPOTENCY_EXPIRY_MISSING', 'needs_attention');
  }

  let dispatch: DurableResendEmailDispatch;
  try {
    dispatch = createDurableResendEmailDispatch({
      jobId: input.jobId,
      effectKey: input.effectKey,
      idempotencyExpiresAt,
      message: input.message,
    });
  } catch (error) {
    throw handlerError('EMAIL_EFFECT_CONTRACT_INVALID', 'needs_attention', error);
  }

  if (existing) {
    assertFrozenIdentity(existing, dispatch);
    const acceptance = acceptedEffect(existing, dispatch);
    if (acceptance) return acceptance;
  } else {
    if (input.signal.aborted) throw input.signal.reason;
    await input.rpc.recordEffectCheckpoint({
      ...checkpointIdentity(dispatch),
      state: 'prepared',
      safeMetadata: PREPARED_METADATA,
    });
  }

  assertLiveIdempotencyWindow(dispatch, input.clock.now());

  await input.rpc.recordEffectCheckpoint({
    ...checkpointIdentity(dispatch),
    state: 'dispatch_started',
    safeMetadata: DISPATCH_STARTED_METADATA,
  });

  const reconciled = await refreshAcceptedEffect(input.rpc, dispatch);
  if (reconciled) return reconciled;

  let outcome: ResendDispatchOutcome;
  try {
    outcome = await input.gateway.dispatchDurable(dispatch, {
      timeoutMs: input.timeoutMs ?? DURABLE_EMAIL_PROVIDER_TIMEOUT_MS,
      signal: input.signal,
    });
  } catch (error) {
    if (
      error instanceof DurableResendDispatchError ||
      error instanceof ResendGatewayConfigurationError
    ) {
      const acceptance = await recordFailureStateOrAcceptance(input, dispatch, 'failed');
      if (acceptance) return acceptance;
      throw handlerError('EMAIL_PROVIDER_GATEWAY_INVALID', 'needs_attention', error);
    }
    const acceptance = await recordFailureStateOrAcceptance(input, dispatch, 'uncertain');
    if (acceptance) return acceptance;
    throw handlerError('EMAIL_PROVIDER_GATEWAY_FAILED', 'retry', error);
  }

  return handleProviderOutcome(outcome, input, dispatch);
}

/**
 * Runs the business finaliser after durable provider acceptance, then records
 * the finalised effect. The callback must tolerate replay after a lost return.
 */
export async function finaliseDurableEmailEffect<Result>(
  input: FinaliseDurableEmailEffectInput<Result>,
): Promise<DurableEmailFinalisation<Result>> {
  const { acceptance } = input;
  assertFrozenIdentity(acceptance.effect, acceptance.dispatch);
  if (acceptance.effect.providerMessageId !== acceptance.providerMessageId) {
    throw handlerError('EMAIL_PROVIDER_MESSAGE_ID_CONFLICT', 'needs_attention');
  }
  if (acceptance.effect.state === 'finalised') {
    return {
      effect: acceptance.effect as BackgroundJobWorkerEffect & Readonly<{ state: 'finalised' }>,
      alreadyFinalised: true,
      result: null,
    };
  }

  const result = await input.finalise({
    providerMessageId: acceptance.providerMessageId,
    dispatch: acceptance.dispatch,
  });

  const latest = effectForEmail(await input.rpc.refreshEffects());
  if (!latest) {
    throw handlerError('EMAIL_EFFECT_CHECKPOINT_MISSING', 'needs_attention');
  }
  assertFrozenIdentity(latest, acceptance.dispatch);
  if (latest.state === 'finalised') {
    return {
      effect: latest as BackgroundJobWorkerEffect & Readonly<{ state: 'finalised' }>,
      alreadyFinalised: true,
      result,
    };
  }
  if (latest.state !== 'provider_accepted' || latest.providerMessageId !== acceptance.providerMessageId) {
    throw handlerError('EMAIL_FINALISATION_STATE_INVALID', 'needs_attention');
  }

  const effect = await input.rpc.recordEffectCheckpoint({
    ...checkpointIdentity(acceptance.dispatch),
    state: 'finalised',
    providerMessageId: acceptance.providerMessageId,
    safeMetadata: FINALISED_METADATA,
  });
  if (effect.state !== 'finalised') {
    throw handlerError('EMAIL_FINALISATION_CHECKPOINT_INVALID', 'needs_attention');
  }

  return {
    effect: effect as BackgroundJobWorkerEffect & Readonly<{ state: 'finalised' }>,
    alreadyFinalised: false,
    result,
  };
}
