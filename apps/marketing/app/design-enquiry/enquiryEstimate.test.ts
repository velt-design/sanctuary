import { expect, it } from 'vitest';
import { enquiryEstimate } from './enquiryEstimate';
import type { ReviewPrice } from '../../lib/configuratorReviewPrice';

const draft: ReviewPrice = { status: 'priced', amount: 18561, excluded: [], basis: 'Draft', breakdown: [
  { label: 'Pergola, roof & ceiling', amount: 18561, provisional: false, detail: '' },
] };
it('carries the local candidate total and full breakdown without creating a published reference', () => {
  const result = enquiryEstimate({ status: 'disabled' }, draft, true);
  expect(result.amount).toBe(18561);
  expect(result.breakdown?.reduce((sum, line) => sum + line.amountIncGst, 0)).toBe(result.amount);
  expect(result.draft).toBe(true);
  expect(result).not.toHaveProperty('calculationRef');
});
it('never substitutes draft pricing for a failed, pending or production price', () => {
  expect(enquiryEstimate(null, draft, true).message).toBe('Updating estimate…');
  expect(enquiryEstimate({ status: 'unavailable' }, draft, true).amount).toBeUndefined();
  expect(enquiryEstimate({ status: 'disabled' }, draft, false).amount).toBeUndefined();
});
it('preserves custom-quote status and partial-estimate exclusions', () => {
  expect(enquiryEstimate({ status: 'disabled' }, {status:'custom',reason:'Too large'}, true).message).toContain('tailored quote');
  expect(enquiryEstimate({ status: 'disabled' }, {...draft, excluded:['Lighting']}, true).excluded).toEqual(['Lighting']);
});
it('waits for the new design rather than displaying the preceding draft amount', () => {
  expect(enquiryEstimate({ status: 'disabled' }, null, true).amount).toBeUndefined();
  expect(enquiryEstimate({ status: 'disabled' }, {...draft,amount:19000}, true).amount).toBe(19000);
});

it('uses the published amount when available, even if a different draft exists', () => {
  const result = enquiryEstimate({status:'priced',amountIncGst:20000,currency:'NZD',includesGst:true,
    breakdown:[{label:'Pergola',amountIncGst:20000}],versionNumber:1,calculationRef:'signed-reference'},draft,true);
  expect(result.amount).toBe(20000);
  expect(result.draft).toBe(false);
});
