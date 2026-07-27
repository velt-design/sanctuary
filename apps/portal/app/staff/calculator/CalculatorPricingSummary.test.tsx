import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import CalculatorPricingSummary, { type CalculatorPricingSummaryProps } from './CalculatorPricingSummary';
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
  it('shows the full customer price and collapsed admin-only internal costing', () => {
    const { container, unmount } = renderIntoDocument(<CalculatorPricingSummary {...baseProps} />);

    expect(container.textContent).toContain('Customer price (inc GST)$18,138');
    expect(container.textContent).toContain('Customer price (ex GST) $15,772');
    expect(container.textContent).not.toContain('1.25× internal true cost');
    expect(container.textContent).not.toContain('Customer quote add-ons');
    const details = container.querySelector('details');
    expect(details?.open).toBe(false);
    expect(details?.querySelector('summary')?.textContent).toBe('Internal costing');
    expect(details?.textContent).toContain('True cost (ex GST)$12671.51');
    expect(details?.querySelectorAll('[data-pricing-metric]')).toHaveLength(7);
    unmount();
  });

  it('removes all internal-cost markup for staff', () => {
    const { container, unmount } = renderIntoDocument(
      <CalculatorPricingSummary {...baseProps} canViewInternalCosts={false} />,
    );

    expect(container.textContent).toContain('$18,138');
    expect(container.textContent).not.toContain('Internal costing');
    expect(container.textContent).not.toContain('True cost');
    expect(container.querySelector('details')).toBeNull();
    unmount();
  });

  it('shows discount scope and the complete before-discount customer total', () => {
    const { container, unmount } = renderIntoDocument(
      <CalculatorPricingSummary
        {...baseProps}
        quoteDiscountPct={10}
        undiscountedTotalIncGstCents={2_000_000}
      />,
    );

    expect(container.textContent).toContain('10% quote discount applied to pergola and site prices only');
    expect(container.textContent).toContain('Before discount $20,000 inc GST');
    unmount();
  });

  it('labels totals as incomplete when an item is unpriced', () => {
    const { container, unmount } = renderIntoDocument(
      <CalculatorPricingSummary {...baseProps} unpricedItemCount={1} />,
    );

    expect(container.textContent).toContain('Customer price (priced items only, inc GST)$18,138');
    unmount();
  });

  it('renders the same full total in the compact responsive presentation', () => {
    const { container, unmount } = renderIntoDocument(
      <CalculatorPricingSummary {...baseProps} variant="compact" />,
    );

    expect(container.textContent).toContain('Customer price (inc GST)$18,138');
    expect(container.textContent).toContain('Ex GST $15,772');
    expect(container.textContent).not.toContain('Internal costing');
    unmount();
  });

  it('keeps the customer price and freshness concise in the inspector presentation', () => {
    const { container, unmount } = renderIntoDocument(
      <CalculatorPricingSummary
        {...baseProps}
        variant="inspector"
        resultFreshness="stale"
        quoteDiscountPct={5}
      />,
    );

    expect(container.querySelector('[data-pricing-summary-variant="inspector"]')).not.toBeNull();
    expect(container.textContent).toContain('Last valid customer price (inc GST)$18,138');
    expect(container.textContent).toContain('Last valid result');
    expect(container.textContent).toContain('Ex GST $15,772');
    expect(container.textContent).toContain('5% discount');
    expect(container.textContent).not.toContain('Internal costing');
    unmount();
  });

  it('opens existing issues from the pricing summary', () => {
    const onOpenIssues = vi.fn();
    const { container, unmount } = renderIntoDocument(
      <CalculatorPricingSummary {...baseProps} issuesCount={2} onOpenIssues={onOpenIssues} />,
    );

    const button = container.querySelector('button');
    act(() => button?.click());
    expect(onOpenIssues).toHaveBeenCalledOnce();
    unmount();
  });

  it.each<CalculatorResultFreshness>(['waiting', 'calculating', 'current', 'stale', 'invalid', 'error'])(
    'keeps the %s price context truthful',
    (resultFreshness) => {
      const { container, unmount } = renderIntoDocument(
        <CalculatorPricingSummary {...baseProps} resultFreshness={resultFreshness} />,
      );

      if (resultFreshness === 'current') {
        expect(container.textContent).not.toContain('Last valid customer price');
      } else {
        expect(container.textContent).toContain('Last valid customer price (inc GST)$18,138');
      }
      unmount();
    },
  );

  it('shows unavailable values without inventing a customer price', () => {
    const { container, unmount } = renderIntoDocument(
      <CalculatorPricingSummary {...baseProps} resultFreshness="waiting" hasCustomerPricing={false} />,
    );

    expect(container.textContent).toContain('Customer price (inc GST)—');
    expect(container.textContent).not.toContain('Last valid customer price');
    unmount();
  });
});
