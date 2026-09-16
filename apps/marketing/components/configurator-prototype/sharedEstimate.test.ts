import { expect, it } from 'vitest';
import { displayedEstimate, parseSharedEstimate, reopenedEstimateNotice } from './sharedEstimate';

it('only captures complete positive displayed estimates and never captures a subtotal', () => {
  expect(displayedEstimate(null, { status: 'priced', amount: 12000.4, excluded: [], basis: 'test' }))
    .toEqual({ amountIncGst: 12000, basis: 'draft' });
  expect(displayedEstimate(null, { status: 'priced', amount: 12000, excluded: ['lighting'], basis: 'test' })).toBeNull();
  expect(displayedEstimate(null)).toBeNull();
  for (const value of ['published:0', 'published:-1', 'published:Infinity', 'draft:1.5', 'quote:100', 'published:100000000']) expect(parseSharedEstimate(value)).toBeNull();
});

it('explains changed prices, changed basis, unchanged prices and missing historical/current prices', () => {
  const saved = { basis: 'published' as const, amountIncGst: 12000 };
  expect(reopenedEstimateNotice(saved, { ...saved, amountIncGst: 13000 })).toContain('differs');
  expect(reopenedEstimateNotice(saved, { ...saved, basis: 'draft' })).toContain('basis has changed');
  expect(reopenedEstimateNotice(saved, saved)).toContain('matches');
  expect(reopenedEstimateNotice(saved, null)).toContain('not a current quote');
  expect(reopenedEstimateNotice(null, saved)).toContain('current pricing');
});

it('prefers approved configured pricing and never substitutes draft prices for an unavailable public estimate', () => {
  const review = { status: 'priced' as const, amount: 12000, excluded: [], basis: 'review' };
  expect(displayedEstimate(null, review, { status: 'priced', amountIncGst: 14000, currency: 'NZD', includesGst: true,
    versionNumber: 2, calculationRef: 'cf1.ref', breakdown: [{ label: 'Pergola', amountIncGst: 14000 }] })).toEqual({ basis: 'published', amountIncGst: 14000 });
  expect(displayedEstimate(null, review, { status: 'unavailable' })).toBeNull();
  expect(displayedEstimate(null, review, null)).toBeNull();
  expect(displayedEstimate(null, review, { status: 'disabled' })).toEqual({ basis: 'draft', amountIncGst: 12000 });
});
