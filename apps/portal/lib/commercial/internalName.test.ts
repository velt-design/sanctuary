import { describe, expect, it } from 'vitest';
import {
  COMMERCIAL_INTERNAL_NAME_MAX_LENGTH,
  copiedCommercialInternalName,
  normalizeCommercialInternalName,
  validateCommercialInternalName,
} from './internalName';

describe('commercial internal names', () => {
  it('normalizes staff-only names without inventing a customer value', () => {
    expect(normalizeCommercialInternalName('  Front   deck\npergola  ')).toBe('Front deck pergola');
    expect(normalizeCommercialInternalName('   ')).toBeNull();
  });

  it('enforces the shared storage and UI length limit', () => {
    expect(validateCommercialInternalName('x'.repeat(COMMERCIAL_INTERNAL_NAME_MAX_LENGTH))).toEqual({
      ok: true,
      value: 'x'.repeat(COMMERCIAL_INTERNAL_NAME_MAX_LENGTH),
    });
    expect(validateCommercialInternalName('x'.repeat(COMMERCIAL_INTERNAL_NAME_MAX_LENGTH + 1))).toEqual({
      ok: false,
      error: `Internal name must be ${COMMERCIAL_INTERNAL_NAME_MAX_LENGTH} characters or fewer`,
    });
  });

  it('creates bounded copy names with a useful identifier fallback', () => {
    expect(copiedCommercialInternalName('Front deck pergola', 'Estimate V2')).toBe('Copy of Front deck pergola');
    expect(copiedCommercialInternalName(null, 'Estimate V2')).toBe('Copy of Estimate V2');
    expect(copiedCommercialInternalName('x'.repeat(200), 'Estimate V2')).toHaveLength(COMMERCIAL_INTERNAL_NAME_MAX_LENGTH);
  });
});
