import type { ProjectClosedOutcome } from './types';

const LOST_CLOSE_CANCELLATION_REASON = {
  LOST_NO_RESPONSE: 'Project closed as Lost - No response.',
  LOST_BUDGET_PRICE: 'Project closed as Lost - Budget or price.',
  LOST_OTHER_SUPPLIER: 'Project closed as Lost - Chose another supplier.',
  LOST_TIMING_DEFERRED: 'Project closed as Lost - Timing or deferred.',
  LOST_NOT_SUITABLE: 'Project closed as Lost - Not suitable.',
} as const satisfies Partial<Record<ProjectClosedOutcome, string>>;

export type ProjectLostClosedOutcome = keyof typeof LOST_CLOSE_CANCELLATION_REASON;

export function isProjectLostClosedOutcome(
  value: unknown,
): value is ProjectLostClosedOutcome {
  return (
    typeof value === 'string' &&
    Object.hasOwn(LOST_CLOSE_CANCELLATION_REASON, value)
  );
}

export function defaultLostCloseCancellationReason(
  outcome: ProjectLostClosedOutcome,
): string {
  return LOST_CLOSE_CANCELLATION_REASON[outcome];
}
