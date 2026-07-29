import { describe, expect, it } from 'vitest';
import { evaluateConsentQuickCheck } from './consentChecker';

describe('evaluateConsentQuickCheck', () => {
  it.each([
    {
      roofed: false,
      attached: 'freestanding' as const,
      level: 'second_plus' as const,
      publicAccess: 'yes' as const,
      areaM2: 48,
    },
    {
      roofed: true,
      attached: 'attached' as const,
      level: 'ground' as const,
      publicAccess: 'no' as const,
      areaM2: 16,
    },
  ])('returns a neutral project review without a categorical consent verdict', (input) => {
    const result = evaluateConsentQuickCheck(input);

    expect(result.code).toBe('project_specific_review');
    expect(result.title).toBe('Project-specific review');
    expect(result.nextStep).toBe(
      "Consent depends on the final design and property. We'll identify the checks needed for your project."
    );
    expect(result.areaM2).toBe(input.areaM2);
  });
});
