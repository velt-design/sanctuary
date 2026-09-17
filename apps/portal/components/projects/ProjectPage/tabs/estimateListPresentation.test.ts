import { describe, expect, it } from 'vitest';
import type { EstimateMeta } from '@/lib/estimates/types';
import type { QuoteVersion } from '@/lib/quotes/types';
import { acceptedEstimateQuoteIds, estimateDisplayName, quotesForEstimate } from './estimateListPresentation';

const estimate = { id: 'est_1', versionLabel: 'V1', createdAt: '2026-08-11T00:00:00Z' } as EstimateMeta;
const quote = { id: 'q1', quoteId: 'family', sourceEstimateVersionId: 'est_1', status: 'ACCEPTED', versionNumber: 1, createdAt: '2026-08-01', acceptedAt: '2026-08-02' } as QuoteVersion;

describe('estimate list context', () => {
  it('distinguishes repeated version labels while preserving names and versions', () => {
    const other = { ...estimate, id: 'est_2', createdAt: '2026-08-11T02:00:00Z' };
    expect(estimateDisplayName(estimate, [estimate, other])).not.toBe(estimateDisplayName(other, [estimate, other]));
    expect(estimateDisplayName({ ...estimate, internalName: 'Wider roof' }, [estimate, other])).toBe('Wider roof');
    expect(estimateDisplayName(estimate, [estimate])).toBe('Estimate V1');
  });

  it('does not revive an earlier acceptance when a later accepted revision was superseded', () => {
    const quotes = [quote, { ...quote, id: 'q2', status: 'SUPERSEDED' as const, versionNumber: 2 }];
    expect([...acceptedEstimateQuoteIds(quotes)]).toEqual([]);
  });

  it('links only the exact source estimate and prioritises its current accepted version', () => {
    const quotes = [quote, { ...quote, id: 'draft', status: 'DRAFT' as const, acceptedAt: null, versionNumber: 3, createdAt: '2026-08-12' }, { ...quote, id: 'other', quoteId: 'other', sourceEstimateVersionId: 'est_2' }];
    expect(quotesForEstimate('est_1', quotes, acceptedEstimateQuoteIds(quotes)).map((item) => item.id)).toEqual(['q1', 'draft']);
  });
});
