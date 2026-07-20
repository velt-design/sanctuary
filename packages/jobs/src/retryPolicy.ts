import type {
  BackgroundJobEffectState,
  BackgroundJobExecutionOwner,
  BackgroundJobKind,
} from './contracts';
import type { BackgroundJobEffectCheckpointSnapshot } from './effectPolicy';
import { getBackgroundJobDefinition } from './registry';

export const BACKGROUND_JOB_DATABASE_MAX_RETRY_DELAY_MS = 20 * 60 * 60 * 1_000;
export const BACKGROUND_JOB_RETRY_MINIMUM_JITTER_FACTOR = 0.8;

const REDISPATCHABLE_BACKGROUND_JOB_EFFECT_STATES = new Set<BackgroundJobEffectState>([
  'prepared',
  'dispatch_started',
  'failed',
  'uncertain',
]);

export type BackgroundJobAutomaticRetryBlockReason =
  | 'attempts_exhausted'
  | 'automatic_retry_window_expired'
  | 'provider_already_accepted'
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

export type BackgroundJobRetryJitterContext = Readonly<{
  jitterKey: string;
  kind: BackgroundJobKind;
  attemptNumber: number;
  /** The fully bounded delay before downward-only jitter is applied. */
  maximumDelayMs: number;
}>;

export type BackgroundJobRetryJitterSource = (context: BackgroundJobRetryJitterContext) => number;

export type BackgroundJobAutomaticRetryOptions = Readonly<{
  /** Stable per-job key used to spread retries deterministically across restarts. */
  jitterKey?: string;
  /** Injectable unit-interval source for deterministic tests or an alternative stable sampler. */
  jitterSource?: BackgroundJobRetryJitterSource;
}>;

function blocked(reason: BackgroundJobAutomaticRetryBlockReason): BackgroundJobAutomaticRetryDecision {
  return { retry: false, delayMs: null, reason };
}

function deterministicRetryJitterSample(context: BackgroundJobRetryJitterContext): number {
  const value = `${context.jitterKey}:${context.kind}:${context.attemptNumber}`;
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0) / 4_294_967_296;
}

export function applyBackgroundJobDownwardRetryJitter(maximumDelayMs: number, sample: number): number {
  if (!Number.isSafeInteger(maximumDelayMs) || maximumDelayMs < 1_000) {
    throw new RangeError('Background-job retry jitter maximum delay must be an integer of at least 1000ms');
  }
  if (!Number.isFinite(sample) || sample < 0 || sample > 1) {
    throw new RangeError('Background-job retry jitter sample must be between zero and one');
  }

  const minimumDelayMs = Math.max(
    1_000,
    Math.floor(maximumDelayMs * BACKGROUND_JOB_RETRY_MINIMUM_JITTER_FACTOR),
  );
  return Math.min(
    maximumDelayMs,
    Math.max(1_000, Math.floor(minimumDelayMs + (maximumDelayMs - minimumDelayMs) * sample)),
  );
}

export function getBackgroundJobAutomaticRetryDecision(
  context: BackgroundJobAutomaticRetryContext,
  options: BackgroundJobAutomaticRetryOptions = {},
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
  if (
    options.jitterKey !== undefined &&
    (typeof options.jitterKey !== 'string' || options.jitterKey.length < 1 || options.jitterKey.length > 256)
  ) {
    throw new RangeError('Background-job retry jitter key must contain between 1 and 256 characters');
  }
  if (options.jitterSource !== undefined && typeof options.jitterSource !== 'function') {
    throw new TypeError('Background-job retry jitter source must be a function');
  }

  const executionOwner = context.executionOwner ?? 'worker';
  const definition = getBackgroundJobDefinition(context.kind, context.contractVersion);
  if (context.effects.some((effect) => effect.state === 'provider_accepted' || effect.state === 'finalised')) {
    return blocked('provider_already_accepted');
  }
  if (context.attemptNumber >= definition.retry.maxAttempts) return blocked('attempts_exhausted');

  const remainingWindowMs = definition.retry.automaticRetryWindowMs - context.elapsedSinceFirstAttemptMs;
  const maximumDelayWithinWindowMs = Math.floor((remainingWindowMs - 1) / 1_000) * 1_000;
  if (maximumDelayWithinWindowMs < 1_000) return blocked('automatic_retry_window_expired');

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
  const maximumDelayMs = Math.min(
    exponentialDelayMs,
    definition.retry.maximumDelayMs,
    BACKGROUND_JOB_DATABASE_MAX_RETRY_DELAY_MS,
    maximumDelayWithinWindowMs,
  );
  if (nowMs + maximumDelayMs >= earliestRedispatchableExpiryMs) {
    return blocked('provider_idempotency_window_expired');
  }

  const shouldJitter = options.jitterKey !== undefined || options.jitterSource !== undefined;
  const jitterContext: BackgroundJobRetryJitterContext = {
    jitterKey: options.jitterKey ?? '',
    kind: context.kind,
    attemptNumber: context.attemptNumber,
    maximumDelayMs,
  };
  const delayMs = shouldJitter
    ? applyBackgroundJobDownwardRetryJitter(
        maximumDelayMs,
        (options.jitterSource ?? deterministicRetryJitterSample)(jitterContext),
      )
    : maximumDelayMs;

  return { retry: true, delayMs, reason: null };
}
