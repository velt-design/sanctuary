import type {
  BackgroundJobEffectState,
  BackgroundJobExecutionOwner,
  BackgroundJobKind,
} from './contracts';
import type { BackgroundJobEffectCheckpointSnapshot } from './effectPolicy';
import { getBackgroundJobDefinition } from './registry';

export const BACKGROUND_JOB_DATABASE_MAX_RETRY_DELAY_MS = 20 * 60 * 60 * 1_000;

const REDISPATCHABLE_BACKGROUND_JOB_EFFECT_STATES = new Set<BackgroundJobEffectState>([
  'prepared',
  'failed',
  'uncertain',
]);

export type BackgroundJobAutomaticRetryBlockReason =
  | 'attempts_exhausted'
  | 'automatic_retry_window_expired'
  | 'provider_already_accepted'
  | 'provider_outcome_unknown'
  | 'provider_idempotency_window_expired';

export type BackgroundJobAutomaticRetryDecision =
  | Readonly<{ retry: true; delayMs: number; reason: null }>
  | Readonly<{ retry: false; delayMs: null; reason: BackgroundJobAutomaticRetryBlockReason }>;

export type BackgroundJobAutomaticRetryContext = Readonly<{
  kind: BackgroundJobKind;
  /** Validate persisted work against the currently registered payload contract when supplied. */
  contractVersion?: number;
  /** Shadow work prepares effects without dispatching them. Defaults to worker semantics. */
  executionOwner?: BackgroundJobExecutionOwner;
  /** One-based attempt number returned by `background_jobs_claim`. */
  attemptNumber: number;
  /** Elapsed time from the first claimed attempt (`background_jobs.started_at`). */
  elapsedSinceFirstAttemptMs: number;
  effects: readonly BackgroundJobEffectCheckpointSnapshot[];
  nowMs?: number;
}>;

function blocked(reason: BackgroundJobAutomaticRetryBlockReason): BackgroundJobAutomaticRetryDecision {
  return { retry: false, delayMs: null, reason };
}

export function getBackgroundJobAutomaticRetryDecision(
  context: BackgroundJobAutomaticRetryContext,
): BackgroundJobAutomaticRetryDecision {
  if (!Number.isInteger(context.attemptNumber) || context.attemptNumber < 1) {
    throw new RangeError('Background-job attempt number must be a positive integer');
  }
  if (!Number.isFinite(context.elapsedSinceFirstAttemptMs) || context.elapsedSinceFirstAttemptMs < 0) {
    throw new RangeError('Background-job retry elapsed time must be finite and non-negative');
  }
  if (context.nowMs !== undefined && !Number.isFinite(context.nowMs)) {
    throw new RangeError('Background-job retry clock must be finite');
  }

  const executionOwner = context.executionOwner ?? 'worker';
  const definition = getBackgroundJobDefinition(context.kind, context.contractVersion);
  if (context.attemptNumber >= definition.retry.maxAttempts) return blocked('attempts_exhausted');

  const remainingWindowMs = definition.retry.automaticRetryWindowMs - context.elapsedSinceFirstAttemptMs;
  const maximumDelayWithinWindowMs = Math.floor((remainingWindowMs - 1) / 1_000) * 1_000;
  if (maximumDelayWithinWindowMs < 1_000) return blocked('automatic_retry_window_expired');

  if (context.effects.some((effect) => effect.state === 'provider_accepted' || effect.state === 'finalised')) {
    return blocked('provider_already_accepted');
  }
  if (context.effects.some((effect) => effect.state === 'dispatch_started')) {
    return blocked('provider_outcome_unknown');
  }

  const nowMs = context.nowMs ?? Date.now();
  let earliestRedispatchableExpiryMs = Number.POSITIVE_INFINITY;
  for (const effect of context.effects) {
    if (!REDISPATCHABLE_BACKGROUND_JOB_EFFECT_STATES.has(effect.state)) {
      continue;
    }
    if (executionOwner === 'shadow' && effect.state === 'prepared') {
      continue;
    }
    const expiresAtMs = effect.providerIdempotencyExpiresAt
      ? Date.parse(effect.providerIdempotencyExpiresAt)
      : Number.NaN;
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs) {
      return blocked('provider_idempotency_window_expired');
    }
    earliestRedispatchableExpiryMs = Math.min(earliestRedispatchableExpiryMs, expiresAtMs);
  }

  const exponent = Math.min(context.attemptNumber - 1, 30);
  const exponentialDelayMs = definition.retry.baseDelayMs * 2 ** exponent;
  const delayMs = Math.min(
    exponentialDelayMs,
    definition.retry.maximumDelayMs,
    BACKGROUND_JOB_DATABASE_MAX_RETRY_DELAY_MS,
    maximumDelayWithinWindowMs,
  );
  if (nowMs + delayMs >= earliestRedispatchableExpiryMs) {
    return blocked('provider_idempotency_window_expired');
  }

  return { retry: true, delayMs, reason: null };
}
