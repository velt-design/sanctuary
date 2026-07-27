import { afterEach, describe, expect, it } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import CalculatorPricingDetails, {
  type CalculatorPricingDetailsProps,
} from './CalculatorPricingDetails';

const baseProps: CalculatorPricingDetailsProps = {
  undiscountedTotalIncGstCents: null,
  quoteDiscountPct: 0,
  unpricedItemCount: 0,
  canViewInternalCosts: true,
  internalTrueCostExGst: 12_671.51,
  internalTrueCostIncGst: 14_572.24,
  materialsExGst: 4_848.85,
  installExGst: 2_768.3,
  overheadExGst: 5_054.36,
  crewHours: 36.91,
  installDays: 5,
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('CalculatorPricingDetails', () => {
  it('keeps the existing admin-only internal costing disclosure collapsed', () => {
    const { container, unmount } = renderIntoDocument(
      <CalculatorPricingDetails {...baseProps} />,
    );

    const details = container.querySelector('details');
    expect(details?.open).toBe(false);
    expect(details?.querySelector('summary')?.textContent).toBe('Internal costing');
    expect(details?.textContent).toContain('True cost (ex GST)$12671.51');
    expect(details?.querySelectorAll('[data-pricing-metric]')).toHaveLength(7);
    expect(container.querySelector('[data-rounded-customer-summary]')).toBeNull();
    unmount();
  });

  it('removes every internal-cost node for staff without that permission', () => {
    const { container, unmount } = renderIntoDocument(
      <CalculatorPricingDetails
        {...baseProps}
        canViewInternalCosts={false}
        quoteDiscountPct={10}
      />,
    );

    expect(container.textContent).toContain('10% quote discount');
    expect(container.textContent).not.toContain('Internal costing');
    expect(container.textContent).not.toContain('True cost');
    expect(container.querySelector('details')).toBeNull();
    unmount();
  });

  it('shows discount scope and the exact before-discount context without a total hero', () => {
    const { container, unmount } = renderIntoDocument(
      <CalculatorPricingDetails
        {...baseProps}
        quoteDiscountPct={10}
        undiscountedTotalIncGstCents={2_000_055}
      />,
    );

    expect(container.textContent).toContain(
      '10% quote discount applies to pergola and site prices only.',
    );
    expect(container.textContent).toContain('Before discount (inc GST)$20,000.55');
    expect(container.querySelector('[data-rounded-customer-summary]')).toBeNull();
    unmount();
  });

  it.each([
    [1, '1 item is not priced. Totals include priced items only.'],
    [2, '2 items are not priced. Totals include priced items only.'],
  ] as const)('qualifies totals when %i item(s) are unpriced', (unpricedItemCount, message) => {
    const { container, unmount } = renderIntoDocument(
      <CalculatorPricingDetails
        {...baseProps}
        canViewInternalCosts={false}
        unpricedItemCount={unpricedItemCount}
      />,
    );

    expect(container.textContent).toContain(message);
    unmount();
  });

  it('renders nothing when there is no customer context or permitted internal disclosure', () => {
    const { container, unmount } = renderIntoDocument(
      <CalculatorPricingDetails {...baseProps} canViewInternalCosts={false} />,
    );

    expect(container.innerHTML).toBe('');
    unmount();
  });
});
