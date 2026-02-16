import { describe, expect, it } from 'vitest';
import { evaluateConsentQuickCheck } from './consentChecker';

describe('evaluateConsentQuickCheck', () => {
  it('returns unroofed pergola exemption when not roofed', () => {
    const result = evaluateConsentQuickCheck({
      roofed: false,
      attached: 'freestanding',
      level: 'second_plus',
      publicAccess: 'yes',
      areaM2: 48,
    });

    expect(result.code).toBe('likely_exempt_unroofed_pergola');
    expect(result.title).toContain('pergola - unroofed');
  });

  it('returns building consent likely required when public access is yes', () => {
    const result = evaluateConsentQuickCheck({
      roofed: true,
      attached: 'attached',
      level: 'ground',
      publicAccess: 'yes',
      areaM2: 16,
    });

    expect(result.code).toBe('building_consent_likely_required');
    expect(result.title).toBe('Building consent likely required');
  });

  it('returns attached-check required message when freestanding or unsure', () => {
    const result = evaluateConsentQuickCheck({
      roofed: true,
      attached: 'freestanding',
      level: 'ground',
      publicAccess: 'no',
      areaM2: 12,
    });

    expect(result.code).toBe('building_consent_likely_required');
    expect(result.title).toContain('or needs checking');
  });

  it('returns <=20m^2 likely exempt for attached ground/first roofed structures', () => {
    const result = evaluateConsentQuickCheck({
      roofed: true,
      attached: 'attached',
      level: 'first',
      publicAccess: 'no',
      areaM2: 20,
    });

    expect(result.code).toBe('likely_exempt_porch_veranda_upto_20');
    expect(result.title).toContain('<=20m^2');
  });

  it('returns 20-30m^2 professional sign-off pathway at ground level', () => {
    const result = evaluateConsentQuickCheck({
      roofed: true,
      attached: 'attached',
      level: 'ground',
      publicAccess: 'no',
      areaM2: 26,
    });

    expect(result.code).toBe('possibly_exempt_with_professional_signoff_20_to_30');
    expect(result.title).toContain('20-30m^2');
  });

  it('returns required for area >30m^2', () => {
    const result = evaluateConsentQuickCheck({
      roofed: true,
      attached: 'attached',
      level: 'ground',
      publicAccess: 'no',
      areaM2: 31,
    });

    expect(result.code).toBe('building_consent_likely_required');
    expect(result.title).toBe('Building consent likely required');
  });
});
