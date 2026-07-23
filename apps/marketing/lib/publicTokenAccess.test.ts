import { describe, expect, it } from 'vitest';
import { publicTokenAccessState } from './publicTokenAccess';

describe('publicTokenAccessState', () => {
  const now = Date.parse('2026-07-23T10:00:00.000Z');

  it('allows missing legacy expiries but fails closed for invalid values', () => {
    expect(publicTokenAccessState(null, now)).toBe('active');
    expect(publicTokenAccessState('not-a-date', now)).toBe('expired');
  });

  it('distinguishes active and expired tokens at one shared boundary', () => {
    expect(publicTokenAccessState('2026-07-23T10:00:01.000Z', now)).toBe('active');
    expect(publicTokenAccessState('2026-07-23T10:00:00.000Z', now)).toBe('expired');
    expect(publicTokenAccessState('2026-07-23T09:59:59.000Z', now)).toBe('expired');
  });
});
