import type { BackgroundJobEffectState, BackgroundJobStatus } from './contracts';

const statusTransitions = {
  queued: ['claimed', 'provider_accepted', 'cancelled', 'needs_attention', 'permanent_failed'],
  claimed: [
    'preparing',
    'running',
    'provider_accepted',
    'retrying',
    'cancelled',
    'needs_attention',
    'permanent_failed',
  ],
  preparing: [
    'running',
    'dispatching',
    'provider_accepted',
    'retrying',
    'cancelled',
    'needs_attention',
    'permanent_failed',
  ],
  running: [
    'dispatching',
    'provider_accepted',
    'finalising',
    'retrying',
    'cancelled',
    'needs_attention',
    'permanent_failed',
  ],
  dispatching: ['provider_accepted', 'retrying', 'needs_attention', 'permanent_failed'],
  provider_accepted: ['finalising', 'needs_attention', 'permanent_failed'],
  finalising: ['succeeded', 'retrying', 'needs_attention', 'permanent_failed'],
  retrying: ['claimed', 'queued', 'provider_accepted', 'cancelled', 'needs_attention', 'permanent_failed'],
  // Signature-verified provider evidence may reveal a late delivery conflict
  // after an otherwise terminal outcome. Only reconciliation owns these
  // exceptional transitions; worker progress remains lease-fenced.
  succeeded: ['needs_attention'],
  cancelled: ['needs_attention'],
  needs_attention: ['queued', 'provider_accepted'],
  permanent_failed: ['queued', 'provider_accepted'],
} as const satisfies Record<BackgroundJobStatus, readonly BackgroundJobStatus[]>;

const effectTransitions = {
  prepared: ['dispatch_started', 'failed'],
  dispatch_started: ['provider_accepted', 'uncertain', 'failed'],
  provider_accepted: ['finalised'],
  finalised: [],
  uncertain: ['dispatch_started', 'provider_accepted', 'failed'],
  failed: ['dispatch_started', 'provider_accepted'],
} as const satisfies Record<BackgroundJobEffectState, readonly BackgroundJobEffectState[]>;

export const TERMINAL_BACKGROUND_JOB_STATUSES = [
  'succeeded',
  'cancelled',
  'needs_attention',
  'permanent_failed',
] as const satisfies readonly BackgroundJobStatus[];

export const LEASED_BACKGROUND_JOB_STATUSES = [
  'claimed',
  'preparing',
  'running',
  'dispatching',
  'provider_accepted',
  'finalising',
] as const satisfies readonly BackgroundJobStatus[];

export function backgroundJobTransitionAllowed(from: BackgroundJobStatus, to: BackgroundJobStatus): boolean {
  return from === to || (statusTransitions[from] as readonly BackgroundJobStatus[]).includes(to);
}

export function backgroundJobEffectTransitionAllowed(
  from: BackgroundJobEffectState,
  to: BackgroundJobEffectState,
): boolean {
  return from === to || (effectTransitions[from] as readonly BackgroundJobEffectState[]).includes(to);
}

export function isTerminalBackgroundJobStatus(status: BackgroundJobStatus): boolean {
  return (TERMINAL_BACKGROUND_JOB_STATUSES as readonly BackgroundJobStatus[]).includes(status);
}

export function isLeasedBackgroundJobStatus(status: BackgroundJobStatus): boolean {
  return (LEASED_BACKGROUND_JOB_STATUSES as readonly BackgroundJobStatus[]).includes(status);
}

export function assertBackgroundJobTransition(from: BackgroundJobStatus, to: BackgroundJobStatus): void {
  if (!backgroundJobTransitionAllowed(from, to)) {
    throw new Error(`Invalid background-job transition: ${from} -> ${to}`);
  }
}

export function assertBackgroundJobEffectTransition(
  from: BackgroundJobEffectState,
  to: BackgroundJobEffectState,
): void {
  if (!backgroundJobEffectTransitionAllowed(from, to)) {
    throw new Error(`Invalid background-job effect transition: ${from} -> ${to}`);
  }
}
