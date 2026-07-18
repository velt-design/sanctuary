export type CalculatorResultFreshness =
  | 'waiting'
  | 'calculating'
  | 'current'
  | 'stale'
  | 'invalid'
  | 'error';

export function deriveCalculatorResultFreshness({
  readyToCalculate,
  isCalculating,
  engineError,
  hasResult,
  requestPayloadJson,
  lastSuccessfulRequestPayloadJson,
}: {
  readyToCalculate: boolean;
  isCalculating: boolean;
  engineError: string | null | undefined;
  hasResult: boolean;
  requestPayloadJson: string;
  lastSuccessfulRequestPayloadJson: string | null;
}): CalculatorResultFreshness {
  if (!readyToCalculate) return hasResult ? 'invalid' : 'waiting';
  if (engineError) return 'error';
  if (isCalculating) return 'calculating';
  if (hasResult && lastSuccessfulRequestPayloadJson === requestPayloadJson) return 'current';
  if (hasResult) return 'stale';
  return 'waiting';
}

export function calculatorResultFreshnessLabel(freshness: CalculatorResultFreshness): string {
  switch (freshness) {
    case 'current':
      return 'Live';
    case 'calculating':
      return 'Updating…';
    case 'invalid':
      return 'Last valid result — fix inputs';
    case 'stale':
      return 'Last valid result — recalculation pending';
    case 'error':
      return 'Last valid result — update failed';
    case 'waiting':
      return 'Waiting for valid inputs';
  }
}
