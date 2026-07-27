import { describe, expect, it } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import CalculatorItemPricingBreakdown from './CalculatorItemPricingBreakdown';
import type { CalculatorPricingPreview } from './calculatorPricingPreview';

const preview: CalculatorPricingPreview = {
  rows: [
    {
      id: 'pergola:p1',
      kind: 'pergola',
      label: 'Front patio',
      detail: '2 modules',
      priceIncGstCents: 12_345_67,
      status: 'priced',
    },
    {
      id: 'infill:p1:0:i1',
      kind: 'infill',
      label: 'Front infill',
      detail: 'Front patio · Module 1 · Front',
      priceIncGstCents: null,
      status: 'included',
    },
    {
      id: 'blind:b1',
      kind: 'blind',
      label: 'West blind',
      detail: 'Omni · 2m × 2m',
      priceIncGstCents: 178_250,
      status: 'priced',
    },
    {
      id: 'blind:b2',
      kind: 'blind',
      label: 'Unfinished blind',
      detail: 'Ziptrak · Dimensions required',
      priceIncGstCents: null,
      status: 'unpriced',
    },
  ],
  totalIncGstCents: 1_413_817,
  totalExGstCents: 1_229_406,
  undiscountedTotalIncGstCents: null,
  discountPct: 0,
  unpricedItemCount: 1,
  hasCorePricing: true,
};

describe('CalculatorItemPricingBreakdown', () => {
  it('lists customer items with exact prices and included or unpriced states', () => {
    const { container, unmount } = renderIntoDocument(<CalculatorItemPricingBreakdown preview={preview} />);

    expect(container.textContent).toContain('Price by item');
    expect(container.textContent).toContain('Front patio2 modulesPergola$12,345.67');
    expect(container.textContent).toContain('Front infillFront patio · Module 1 · FrontInfillIncluded in pergola price');
    expect(container.textContent).toContain('West blindOmni · 2m × 2mBlind$1,782.50');
    expect(container.textContent).toContain('Unfinished blindZiptrak · Dimensions requiredBlindNot priced');
    expect(container.textContent).toContain('Priced items total$14,138.17');
    expect(container.textContent).not.toContain('True cost');
    expect(
      container
        .querySelector('[aria-label="Price by item"]')
        ?.getAttribute('data-customer-total-inc-gst-cents'),
    ).toBe('1413817');
    unmount();
  });
});
