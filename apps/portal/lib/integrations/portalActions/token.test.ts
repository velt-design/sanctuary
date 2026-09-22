import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { hashPortalActionToken, issuePortalActionToken, portalActionBearerHash } from './token';

describe('Portal action credentials', () => {
  it('issues independent 256-bit bearer credentials and stores only their digest', () => {
    const first = issuePortalActionToken();
    const second = issuePortalActionToken();
    expect(first.token).toMatch(/^spa1_[0-9a-f]{64}$/);
    expect(first.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(first.tokenHash).not.toContain(first.token.slice(5));
    expect(first.token).not.toBe(second.token);
    expect(portalActionBearerHash('Bearer ' + first.token)).toBe(first.tokenHash);
    expect(hashPortalActionToken(first.token)).toBe(first.tokenHash);
  });
  it.each([null, '', 'Basic abc', 'Bearer ', 'Bearer ' + 'a'.repeat(69), 'Bearer spa1_' + 'a'.repeat(63), 'Bearer spa1_' + 'g'.repeat(64), 'Bearer spa1_' + 'a'.repeat(64) + ' ', 'Bearer spa1_' + 'a'.repeat(64) + ',Bearer other'])('denies malformed or ambiguous credentials', (value) => {
    expect(portalActionBearerHash(value)).toBeNull();
  });
});
