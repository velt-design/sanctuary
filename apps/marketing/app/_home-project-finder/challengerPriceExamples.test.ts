import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ChallengerPriceExamples, { CHALLENGER_EXAMPLE_SELECTIONS, formatChallengerExampleAmount } from './ChallengerPriceExamples';
import { useProductExampleEstimate } from '../../components/products/useProductExampleEstimate';
import { PRODUCT_FORM_CHOICES } from '../../components/products/productDesigns';
import { parseProductSelection, productSelectionDraft } from '../../components/products/productSelection';
import { solvePergolaPreview } from '../../components/configurator-prototype/solvePreview';

vi.mock('../../components/products/useProductExampleEstimate', () => ({ useProductExampleEstimate: vi.fn() }));

describe('challenger representative examples', () => {
  it.each([[9049, '$9,000'], [9050, '$9,100'], [9099, '$9,100'], [15362, '$15,400'], [10000, '$10,000']])('rounds approved amount %s to %s for the approximate comparison only', (amount, displayed) => {
    expect(formatChallengerExampleAmount(amount as number)).toBe(displayed);
  });
  it.each(PRODUCT_FORM_CHOICES)('$type supports every displayed size through the shared draft and geometry owners', ({ type }) => {
    for (const selection of CHALLENGER_EXAMPLE_SELECTIONS) {
      expect(parseProductSelection(selection)).toEqual(selection);
      const { draft, issue } = productSelectionDraft(selection, type);
      expect(issue).toBeNull();
      expect(draft.input.widthMm).toBe(selection.widthMm);
      expect(draft.input.projectionMm).toBe(selection.projectionMm);
      expect(solvePergolaPreview(draft.input, draft.roof).geometry).toBeDefined();
    }
  });
});

describe('example commercial states', () => {
  const markup = (value: ReturnType<typeof useProductExampleEstimate>) => {
    vi.mocked(useProductExampleEstimate).mockReturnValue(value);
    return renderToStaticMarkup(React.createElement(ChallengerPriceExamples, { type: 'pitched' }));
  };
  it('keeps a complete development-only price visibly labelled as draft', () => {
    const html = markup({ estimate: { amount: 10000, draft: true, excluded: [], breakdown: [] }, complete: true, retry: vi.fn() });
    expect(html.match(/Draft · review only/g)).toHaveLength(3);
    expect(html.match(/Approximately /g)).toHaveLength(3);
  });
  it('does not present incomplete review amounts or tailored quotes as prices', () => {
    for (const estimate of [
      { amount: 10000, draft: true, excluded: ['site work'], breakdown: [] },
      { message: 'Your design needs a tailored quote.' },
    ]) {
      const html = markup({ estimate, complete: false, retry: vi.fn() });
      expect(html.match(/Tailored quote/g)).toHaveLength(3);
      expect(html).not.toContain('$10,000');
      expect(html).not.toContain('data-priced');
    }
  });
});
