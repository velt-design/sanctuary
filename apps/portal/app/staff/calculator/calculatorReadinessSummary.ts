import type { CalculatorResultFreshness } from './calculatorResultFreshness';

export type CalculatorReadinessBlockedBy = 'inputs';

type CalculatorReadinessItem = {
  id: string;
  level: 'ok' | 'review' | 'block';
  blockedBy?: CalculatorReadinessBlockedBy;
  causeCount?: number;
};

export type CalculatorReadinessSummary = {
  tone: 'ready' | 'review' | 'waiting' | 'blocked';
  label: string;
  accessibleLabel: string;
  rootCauseCount: number;
  blockedCheckCount: number;
  reviewCount: number;
};

function normalizedCauseCount(item: CalculatorReadinessItem): number {
  if (item.blockedBy) return 0;
  if (typeof item.causeCount !== 'number' || !Number.isFinite(item.causeCount)) return 1;
  return Math.max(0, Math.round(item.causeCount));
}

function readinessCheckLabel(count: number): string {
  return `${count} readiness check${count === 1 ? '' : 's'} blocked`;
}

function issueLabel(count: number): string {
  return `${count} issue${count === 1 ? ' blocks' : 's block'} Save`;
}

function inputIssueLabel(count: number): string {
  return `${count} input issue${count === 1 ? ' blocks' : 's block'} Save`;
}

function reviewLabel(count: number): string {
  return `${count} item${count === 1 ? '' : 's'} to review`;
}

export function buildCalculatorReadinessSummary({
  items,
  resultFreshness,
}: {
  items: readonly CalculatorReadinessItem[];
  resultFreshness: CalculatorResultFreshness;
}): CalculatorReadinessSummary {
  const blockedItems = items.filter((item) => item.level === 'block');
  const blockedCheckCount = blockedItems.length;
  const reviewCount = items.filter((item) => item.level === 'review').length;
  const rootCauseCount = blockedItems.reduce(
    (total, item) => total + normalizedCauseCount(item),
    0,
  );
  const inputCauseCount = normalizedCauseCount(
    items.find((item) => item.id === 'inputs' && item.level === 'block')
      ?? { id: 'inputs', level: 'ok', causeCount: 0 },
  );
  const engineIsOnlyRootCause =
    resultFreshness === 'error'
    && rootCauseCount === 1
    && blockedItems.some(
      (item) =>
        item.id === 'engine'
        && !item.blockedBy
        && normalizedCauseCount(item) === 1,
    );

  let tone: CalculatorReadinessSummary['tone'];
  let label: string;

  if (rootCauseCount > 0) {
    tone = 'blocked';
    if (inputCauseCount > 0 && inputCauseCount === rootCauseCount) {
      label = inputIssueLabel(inputCauseCount);
    } else if (engineIsOnlyRootCause) {
      label = 'Engine error blocks Save';
    } else {
      label = issueLabel(rootCauseCount);
    }
  } else if (blockedCheckCount > 0) {
    tone = 'waiting';
    if (resultFreshness === 'calculating') {
      label = 'Updating - Save waits for a current result';
    } else if (resultFreshness === 'stale') {
      label = 'Recalculation pending - Save waits for a current result';
    } else {
      label = 'Waiting - Save needs a valid result';
    }
  } else if (reviewCount > 0) {
    tone = 'review';
    label = reviewLabel(reviewCount);
  } else {
    tone = 'ready';
    label = 'Ready to save';
  }

  return {
    tone,
    label,
    accessibleLabel: blockedCheckCount > 0
      ? `${label}. ${readinessCheckLabel(blockedCheckCount)}.`
      : label,
    rootCauseCount,
    blockedCheckCount,
    reviewCount,
  };
}
