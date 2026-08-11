import { describe, expect, it } from 'vitest';
import { commercialScopeKey, commercialScopeKind, normalizeCommercialScopeId } from './scope';

describe('commercial scopes', () => {
  it('keeps the original contract on the base scope', () => {
    expect(commercialScopeKind(null)).toBe('base');
    expect(commercialScopeKey(null)).toBe('base');
  });

  it('normalizes a stable add-on scope UUID', () => {
    const id = '742B51D5-5F31-479B-8E5D-2276E53D5139';
    expect(normalizeCommercialScopeId(id)).toBe(id.toLowerCase());
    expect(commercialScopeKind(id)).toBe('add_on');
  });
});
