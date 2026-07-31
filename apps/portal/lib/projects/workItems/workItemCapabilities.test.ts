import { describe, expect, it } from 'vitest';
import { isGenericCompletableWorkSource } from './workItemCapabilities';

describe('work item capabilities', () => {
  it('allows generic completion only for staff-owned work sources', () => {
    expect(isGenericCompletableWorkSource('MANUAL')).toBe(true);
    expect(isGenericCompletableWorkSource('LEGACY_REVIEW')).toBe(false);
    expect(isGenericCompletableWorkSource('STAGE_REVIEW')).toBe(true);
    expect(isGenericCompletableWorkSource('LEAD_CADENCE')).toBe(false);
    expect(isGenericCompletableWorkSource('QUOTE_CADENCE')).toBe(false);
    expect(isGenericCompletableWorkSource(null)).toBe(false);
  });
});
