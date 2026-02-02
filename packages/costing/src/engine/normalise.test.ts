import { describe, expect, it } from 'vitest';
import { normaliseProfile } from './normalise';

describe('normaliseProfile', () => {
  it('normalises common profile variants', () => {
    expect(normaliseProfile('80x 50')).toBe('80x50');
    expect(normaliseProfile('80×50')).toBe('80x50');
    expect(normaliseProfile(' 80 X 50 ')).toBe('80x50');
  });
});

