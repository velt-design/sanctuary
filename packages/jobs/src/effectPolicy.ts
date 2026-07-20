import type {
  BackgroundJobEffectState,
  BackgroundJobExecutionOwner,
  BackgroundJobKind,
} from './contracts';
import { getBackgroundJobDefinition } from './registry';

/**
 * Provider failures that a later, independently verified acceptance proves
 * stale. Identity conflicts and business-finalisation failures are
 * deliberately absent: those still require operator-visible attention even
 * when the provider accepted the original dispatch.
 */
export const BACKGROUND_JOB_PROVIDER_ACCEPTANCE_WINS_ERROR_CODES = Object.freeze([
  'RESEND_AUTH_REJECTED',
  'RESEND_VALIDATION_REJECTED',
  'RESEND_QUOTA_REJECTED',
  'RESEND_REQUEST_REJECTED',
  'EMAIL_PROVIDER_GATEWAY_INVALID',
  'EMAIL_IDEMPOTENCY_WINDOW_EXPIRED',
  'PROVIDER_IDEMPOTENCY_WINDOW_EXPIRED',
  'PROVIDER_OUTCOME_UNCERTAIN',
  'RETRY_EXHAUSTED',
  'RUNTIME_CONTEXT_MISMATCH',
] as const);

const BACKGROUND_JOB_PROVIDER_ACCEPTANCE_WINS_ERROR_CODE_SET = new Set<string>(
  BACKGROUND_JOB_PROVIDER_ACCEPTANCE_WINS_ERROR_CODES,
);

export function backgroundJobProviderAcceptanceWins(errorCode: string): boolean {
  return BACKGROUND_JOB_PROVIDER_ACCEPTANCE_WINS_ERROR_CODE_SET.has(errorCode);
}

export type BackgroundJobEffectCheckpointSnapshot = Readonly<{
  effectKind: string;
  state: BackgroundJobEffectState;
  providerIdempotencyExpiresAt: string | null;
}>;

export type BackgroundJobEffectCompletionIssue =
  | Readonly<{ reason: 'undeclared_effect'; effectKind: string }>
  | Readonly<{ reason: 'duplicate_effect_kind'; effectKind: string }>
  | Readonly<{
      reason: 'effect_not_finalised';
      effectKind: string;
      state: BackgroundJobEffectState;
    }>
  | Readonly<{
      reason: 'shadow_effect_not_prepared';
      effectKind: string;
      state: BackgroundJobEffectState;
    }>
  | Readonly<{ reason: 'missing_required_effect'; effectKind: string }>;

export function backgroundJobEffectAllowed(
  kind: BackgroundJobKind,
  effectKind: string,
  contractVersion?: number,
): boolean {
  const definition = getBackgroundJobDefinition(kind, contractVersion);
  return (definition.allowedEffectCheckpoints as readonly string[]).includes(effectKind);
}

export function getMissingBackgroundJobEffectCheckpoints(
  kind: BackgroundJobKind,
  effects: readonly BackgroundJobEffectCheckpointSnapshot[],
  contractVersion?: number,
  executionOwner: BackgroundJobExecutionOwner = 'worker',
): string[] {
  const definition = getBackgroundJobDefinition(kind, contractVersion);
  if (executionOwner === 'shadow') return [];

  const finalisedKinds = new Set(
    effects.filter((effect) => effect.state === 'finalised').map((effect) => effect.effectKind),
  );
  return definition.requiredEffectCheckpoints.filter((effectKind) => !finalisedKinds.has(effectKind));
}

export function getBackgroundJobEffectCompletionIssues(
  kind: BackgroundJobKind,
  effects: readonly BackgroundJobEffectCheckpointSnapshot[],
  contractVersion?: number,
  executionOwner: BackgroundJobExecutionOwner = 'worker',
): BackgroundJobEffectCompletionIssue[] {
  const definition = getBackgroundJobDefinition(kind, contractVersion);
  const allowedEffects = new Set<string>(definition.allowedEffectCheckpoints);
  const seenEffects = new Set<string>();
  const issues: BackgroundJobEffectCompletionIssue[] = [];

  for (const effect of effects) {
    if (!allowedEffects.has(effect.effectKind)) {
      issues.push({ reason: 'undeclared_effect', effectKind: effect.effectKind });
    }
    if (seenEffects.has(effect.effectKind)) {
      issues.push({ reason: 'duplicate_effect_kind', effectKind: effect.effectKind });
    } else {
      seenEffects.add(effect.effectKind);
    }
    if (executionOwner === 'shadow' && effect.state !== 'prepared') {
      issues.push({
        reason: 'shadow_effect_not_prepared',
        effectKind: effect.effectKind,
        state: effect.state,
      });
    } else if (executionOwner !== 'shadow' && effect.state !== 'finalised') {
      issues.push({
        reason: 'effect_not_finalised',
        effectKind: effect.effectKind,
        state: effect.state,
      });
    }
  }

  for (const effectKind of getMissingBackgroundJobEffectCheckpoints(
    kind,
    effects,
    contractVersion,
    executionOwner,
  )) {
    issues.push({ reason: 'missing_required_effect', effectKind });
  }

  return issues;
}

export function backgroundJobEffectCheckpointsComplete(
  kind: BackgroundJobKind,
  effects: readonly BackgroundJobEffectCheckpointSnapshot[],
  contractVersion?: number,
  executionOwner: BackgroundJobExecutionOwner = 'worker',
): boolean {
  return getBackgroundJobEffectCompletionIssues(kind, effects, contractVersion, executionOwner).length === 0;
}

export function assertBackgroundJobEffectCheckpointsComplete(
  kind: BackgroundJobKind,
  effects: readonly BackgroundJobEffectCheckpointSnapshot[],
  contractVersion?: number,
  executionOwner: BackgroundJobExecutionOwner = 'worker',
): void {
  const issues = getBackgroundJobEffectCompletionIssues(kind, effects, contractVersion, executionOwner);
  if (issues.length === 0) return;

  const details = issues
    .map((issue) =>
      'state' in issue
        ? `${issue.reason}:${issue.effectKind}:${issue.state}`
        : `${issue.reason}:${issue.effectKind}`,
    )
    .join(', ');
  throw new Error(`Background-job effects are not complete: ${details}`);
}
