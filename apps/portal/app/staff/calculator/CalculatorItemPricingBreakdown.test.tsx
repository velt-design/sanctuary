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
      id: 'module:p1:1',
      kind: 'module',
      parentId: 'pergola:p1',
      label: 'Module 1',
      detail: 'Front patio · 6m × 3m · Allocated share of pergola price',
      priceIncGstCents: 10_000_00,
      status: 'included',
    },
    {
      id: 'infill:p1:0:i1',
      kind: 'infill',
      parentId: 'module:p1:1',
      label: 'Front infill',
      detail: 'Front patio · Module 1 · Front',
      priceIncGstCents: 2_345_67,
      status: 'included',
      internalTrueCost: {
        materialsExGstCents: 80_00,
        labourExGstCents: 45_00,
        overheadExGstCents: 25_00,
        totalExGstCents: 150_00,
      },
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
  it('shows exact included contributions to staff without internal costs', () => {
    const { container, unmount } = renderIntoDocument(<CalculatorItemPricingBreakdown preview={preview} />);

    expect(container.textContent).toContain('Price by item');
    expect(container.textContent).toContain('Front patio2 modulesPergola$12,345.67');
    expect(container.textContent).toContain('Module 1Front patio · 6m × 3m · Allocated share of pergola priceModule$10,000.00allocated module price');
    expect(container.textContent).toContain('Front infillFront patio · Module 1 · FrontInfill$2,345.67included in module price');
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

  it('reveals itemized true costs only for admins', () => {
    const staff = renderIntoDocument(
      <CalculatorItemPricingBreakdown preview={preview} canViewInternalCosts={false} />,
    );
    expect(staff.container.textContent).not.toContain('Internal incremental cost');
    staff.unmount();

    const admin = renderIntoDocument(
      <CalculatorItemPricingBreakdown preview={preview} canViewInternalCosts />,
    );
    expect(admin.container.textContent).toContain('Internal incremental cost');
    expect(admin.container.textContent).toContain('Materials ex GST$80.00');
    expect(admin.container.textContent).toContain('Labour ex GST$45.00');
    expect(admin.container.textContent).toContain('Overhead ex GST$25.00');
    expect(admin.container.textContent).toContain('Total incremental cost ex GST$150.00');
    admin.unmount();
  });
});
