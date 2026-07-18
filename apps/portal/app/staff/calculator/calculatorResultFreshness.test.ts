import { describe, expect, it } from 'vitest';
import {
  calculatorResultFreshnessLabel,
  deriveCalculatorResultFreshness,
  type CalculatorResultFreshness,
} from './calculatorResultFreshness';

type FreshnessArgs = Parameters<typeof deriveCalculatorResultFreshness>[0];

const base: FreshnessArgs = {
  readyToCalculate: true,
  isCalculating: false,
  engineError: null,
  hasResult: true,
  requestPayloadJson: '{"length":6}',
  lastSuccessfulRequestPayloadJson: '{"length":6}',
};

describe('calculator result freshness', () => {
  it.each<[CalculatorResultFreshness, Partial<FreshnessArgs>]>([
    ['invalid', { readyToCalculate: false }],
    ['error', { engineError: 'Costing failed' }],
    ['calculating', { isCalculating: true }],
    ['current', {}],
    ['stale', { requestPayloadJson: '{"length":7}' }],
    ['waiting', { hasResult: false, lastSuccessfulRequestPayloadJson: null }],
  ])('derives %s', (expected, overrides) => {
    expect(deriveCalculatorResultFreshness({ ...base, ...overrides })).toBe(expected);
  });

  it('prioritises invalid inputs over an in-flight result', () => {
    expect(
      deriveCalculatorResultFreshness({ ...base, readyToCalculate: false, isCalculating: true }),
    ).toBe('invalid');
  });

  it('does not claim a last valid result before the first successful calculation', () => {
    expect(
      deriveCalculatorResultFreshness({
        ...base,
        readyToCalculate: false,
        hasResult: false,
        lastSuccessfulRequestPayloadJson: null,
      }),
    ).toBe('waiting');
  });

  it('uses unambiguous user-facing labels', () => {
    expect(calculatorResultFreshnessLabel('current')).toBe('Live');
    expect(calculatorResultFreshnessLabel('invalid')).toContain('Last valid result');
    expect(calculatorResultFreshnessLabel('stale')).toContain('recalculation pending');
    expect(calculatorResultFreshnessLabel('error')).toContain('update failed');
  });
});
