import { describe, expect, it } from 'vitest';
import { isDeferredProjectFollowUp } from './deferredFollowUps';
describe('owner-deferred follow-up workflow', () => {
  it('excludes automatic cadence, including legacy source keys, but preserves manual commitments', () => {
    expect(isDeferredProjectFollowUp({ sourceType: 'LEAD_CADENCE' })).toBe(true);
    expect(isDeferredProjectFollowUp({ sourceType: 'QUOTE_CADENCE' })).toBe(true);
    expect(isDeferredProjectFollowUp({ sourceKey: 'quote:follow-up:fixture' })).toBe(true);
    expect(isDeferredProjectFollowUp({ sourceType: 'MANUAL', sourceKey: null })).toBe(false);
  });
});
