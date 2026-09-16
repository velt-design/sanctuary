import { expect, it } from 'vitest';
import { normalizeEnquiryProjectPreferences as normalize } from './enquiryProjectPreferences';

it('accepts optional preferences and ignores inappropriate or invalid budget input', () => {
  expect(normalize(null, true)).toEqual({ preferredTiming: null, budgetPreference: null, budgetHint: null });
  expect(normalize({ preferredTiming: ' Summer\n2027 ', budgetPreference: 'provided', budgetHint: ' $20,000 ' }, true))
    .toEqual({ preferredTiming: 'Summer 2027', budgetPreference: 'provided', budgetHint: '$20,000' });
  expect(normalize({ budgetPreference: 'provided', budgetHint: '100' }, false).budgetHint).toBeNull();
  expect(normalize({ budgetPreference: 'not-sure', budgetHint: 'stale value' }, true))
    .toMatchObject({ budgetPreference: 'not-sure', budgetHint: null });
  expect(normalize({ preferredTiming: {}, budgetPreference: 'unexpected', budgetHint: 100 }, true))
    .toEqual({ preferredTiming: null, budgetPreference: null, budgetHint: null });
  expect(normalize({ preferredTiming: 'x'.repeat(200) }, false).preferredTiming).toHaveLength(160);
});
