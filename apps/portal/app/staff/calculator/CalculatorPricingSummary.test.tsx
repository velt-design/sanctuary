import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import CalculatorPricingSummary, {
  type CalculatorPricingSummaryProps,
} from './CalculatorPricingSummary';
import type { CalculatorResultFreshness } from './calculatorResultFreshness';

const baseProps: CalculatorPricingSummaryProps = {
  resultFreshness: 'current',
  issuesCount: 0,
  onOpenIssues: vi.fn(),
  customerTotalIncGstCents: 1_813_800,
  customerTotalExGstCents: 1_577_217,
  undiscountedTotalIncGstCents: null,
  quoteDiscountPct: 0,
  unpricedItemCount: 0,
  hasCustomerPricing: true,
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
  vi.clearAllMocks();
});

describe('CalculatorPricingSummary', () => {
  it.each(['compact', 'inspector'] as const)(
    'shows one explicitly rounded customer summary in the %s view',
    (variant) => {
      const { container, unmount } = renderIntoDocument(
        <CalculatorPricingSummary {...baseProps} variant={variant} />,
      );

      expect(container.querySelectorAll('[data-rounded-customer-summary]')).toHaveLength(1);
      expect(container.textContent).toContain('Customer price (rounded, inc GST)$18,138');
      expect(container.textContent).toContain('Customer price (rounded, ex GST) $15,772');
      expect(container.textContent).toContain('Live');
      expect(container.textContent).not.toContain('$18,138.00');
      expect(container.textContent).not.toContain('Internal costing');
      expect(container.textContent).not.toContain('Before discount');
      unmount();
    },
  );

  it('keeps retained, unpriced, and discount truth visible together', () => {
    const { container, unmount } = renderIntoDocument(
      <CalculatorPricingSummary
        {...baseProps}
        variant="inspector"
        resultFreshness="invalid"
        unpricedItemCount={2}
        quoteDiscountPct={5}
      />,
    );

    expect(container.textContent).toContain(
      'Last valid customer price for priced items (rounded, inc GST)$18,138',
    );
    expect(container.textContent).toContain('Last valid result');
    expect(container.textContent).toContain('2 unpriced items');
    expect(container.textContent).toContain('5% discount applied');
    unmount();
  });

  it.each<CalculatorResultFreshness>(['waiting', 'calculating', 'current', 'stale', 'invalid', 'error'])(
    'keeps the %s price context truthful',
    (resultFreshness) => {
      const { container, unmount } = renderIntoDocument(
        <CalculatorPricingSummary
          {...baseProps}
          variant="compact"
          resultFreshness={resultFreshness}
        />,
      );

      if (resultFreshness === 'current') {
        expect(container.textContent).not.toContain('Last valid customer price');
      } else {
        expect(container.textContent).toContain(
          'Last valid customer price (rounded, inc GST)$18,138',
        );
      }
      unmount();
    },
  );

  it('shows unavailable values without inventing a customer price', () => {
    const { container, unmount } = renderIntoDocument(
      <CalculatorPricingSummary
        {...baseProps}
        variant="compact"
        resultFreshness="waiting"
        hasCustomerPricing={false}
      />,
    );

    expect(container.textContent).toContain('Customer price (rounded, inc GST)\u2014');
    expect(container.textContent).toContain('Customer price (rounded, ex GST) \u2014');
    expect(container.textContent).not.toContain('Last valid customer price');
    unmount();
  });
});
