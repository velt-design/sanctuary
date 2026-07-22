import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import CalculatorPricingSummary from './CalculatorPricingSummary';
import type { CalculatorResultFreshness } from './calculatorResultFreshness';

const baseProps = {
  resultFreshness: 'current' as const,
  issuesCount: 0,
  onOpenIssues: vi.fn(),
  internalTrueCostExGst: 100,
  internalTrueCostIncGst: 115,
  materialsExGst: 55,
  installExGst: 25,
  overheadExGst: 20,
  crewHours: 12.5,
  installDays: 2,
  blindCustomerPriceExGst: 400,
  blindCustomerPriceIncGst: 460,
  quoteDiscountPct: '0',
  hasInfills: true,
};

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('CalculatorPricingSummary', () => {
  it('makes the nearest-dollar pergola customer price primary and keeps internal costing at cents', () => {
    const { container, unmount } = renderIntoDocument(<CalculatorPricingSummary {...baseProps} />);

    expect(container.querySelector('h2')?.textContent).toBe('Pricing preview');
    expect(container.textContent).toContain('Customer price (inc GST)$144');
    expect(container.textContent).toContain('Customer price (ex GST) $125');
    expect(container.textContent).toContain('1.25× internal true cost · pergola only');
    expect(container.textContent).toContain('Internal costing');
    expect(container.textContent).toContain('True cost (ex GST)$100.00');
    expect(container.querySelector('[data-pricing-metric-layout="inline"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-pricing-metric]').length).toBe(10);

    unmount();
  });

  it('keeps blind customer pricing and infills separate from the pergola price', () => {
    const { container, unmount } = renderIntoDocument(<CalculatorPricingSummary {...baseProps} />);

    expect(container.textContent).toContain('Customer quote add-ons');
    expect(container.textContent).toContain('Blind customer price (ex GST)$400.00');
    expect(container.textContent).toContain('Blind customer price (inc GST)$460.00');
    expect(container.textContent).toContain('Configured (see BOM)');
    expect(container.textContent).toContain('excluded from pergola true cost');

    unmount();
  });

  it('shows the discounted pergola price and its undiscounted basis', () => {
    const { container, unmount } = renderIntoDocument(
      <CalculatorPricingSummary {...baseProps} quoteDiscountPct="10" />,
    );

    expect(container.textContent).toContain('Customer price (inc GST)$129');
    expect(container.textContent).toContain('Customer price (ex GST) $113');
    expect(container.textContent).toContain('10% quote discount applied to pergola and site price');
    expect(container.textContent).toContain('Before discount $144 inc GST');
    expect(container.textContent).toContain('Blind customer price (inc GST)$460.00');

    unmount();
  });

  it('adds thousands separators while rounding the displayed pergola prices only', () => {
    const { container, unmount } = renderIntoDocument(
      <CalculatorPricingSummary {...baseProps} internalTrueCostExGst={11339.33} internalTrueCostIncGst={13040.23} />,
    );

    expect(container.textContent).toContain('Customer price (inc GST)$16,300');
    expect(container.textContent).toContain('Customer price (ex GST) $14,174');
    expect(container.textContent).toContain('True cost (ex GST)$11339.33');
    expect(container.textContent).toContain('Blind customer price (ex GST)$400.00');

    unmount();
  });

  it('renders the same customer price and freshness in the compact responsive presentation', () => {
    const { container, unmount } = renderIntoDocument(
      <CalculatorPricingSummary {...baseProps} variant="compact" />,
    );

    expect(container.querySelector('[data-pricing-summary-variant="compact"]')).not.toBeNull();
    expect(container.textContent).toContain('Customer price (inc GST)$144');
    expect(container.textContent).toContain('Ex GST $125');
    expect(container.textContent).toContain('Live');
    expect(container.textContent).not.toContain('Internal costing');
    expect(container.textContent).not.toContain('Customer quote add-ons');

    unmount();
  });

  it('collapses empty add-ons and renders only relevant configured add-ons', () => {
    const empty = renderIntoDocument(
      <CalculatorPricingSummary
        {...baseProps}
        blindCustomerPriceExGst={0}
        blindCustomerPriceIncGst={0}
        hasInfills={false}
      />,
    );
    expect(empty.container.textContent).toContain('No customer-priced add-ons configured.');
    expect(empty.container.textContent).not.toContain('Blind customer price');
    expect(empty.container.textContent).not.toContain('Configured (see BOM)');
    empty.unmount();

    const infillsOnly = renderIntoDocument(
      <CalculatorPricingSummary
        {...baseProps}
        blindCustomerPriceExGst={0}
        blindCustomerPriceIncGst={0}
      />,
    );
    expect(infillsOnly.container.textContent).toContain('InfillsConfigured (see BOM)');
    expect(infillsOnly.container.textContent).not.toContain('Blind customer price');
    infillsOnly.unmount();

    const blindOnly = renderIntoDocument(<CalculatorPricingSummary {...baseProps} hasInfills={false} />);
    expect(blindOnly.container.textContent).toContain('Blind customer price (ex GST)$400.00');
    expect(blindOnly.container.textContent).not.toContain('InfillsConfigured');
    blindOnly.unmount();
  });

  it('opens existing issues from the pricing summary', () => {
    const onOpenIssues = vi.fn();
    const { container, unmount } = renderIntoDocument(
      <CalculatorPricingSummary {...baseProps} issuesCount={2} onOpenIssues={onOpenIssues} />,
    );

    const button = container.querySelector('button');
    expect(button?.textContent).toBe('Errors (2)');
    act(() => button?.click());
    expect(onOpenIssues).toHaveBeenCalledOnce();

    unmount();
  });

  it.each<CalculatorResultFreshness>([
    'waiting',
    'calculating',
    'current',
    'stale',
    'invalid',
    'error',
  ])('renders the %s freshness state without hiding the price context', (resultFreshness) => {
    const { container, unmount } = renderIntoDocument(
      <CalculatorPricingSummary {...baseProps} resultFreshness={resultFreshness} />,
    );

    expect(container.querySelector('[data-result-freshness]')?.getAttribute('data-result-freshness')).toBe(resultFreshness);
    if (resultFreshness === 'current') {
      expect(container.textContent).toContain('Customer price (inc GST)');
      expect(container.textContent).not.toContain('Last valid customer price');
    } else {
      expect(container.textContent).toContain('Last valid customer price (inc GST)');
    }

    unmount();
  });

  it('labels a compact stale result as last-valid', () => {
    const { container, unmount } = renderIntoDocument(
      <CalculatorPricingSummary {...baseProps} variant="compact" resultFreshness="stale" />,
    );

    expect(container.textContent).toContain('Last valid customer price (inc GST)$144');
    expect(container.textContent).toContain('recalculation pending');
    unmount();
  });

  it('shows unavailable values without inventing a customer price', () => {
    const { container, unmount } = renderIntoDocument(
      <CalculatorPricingSummary
        {...baseProps}
        resultFreshness="waiting"
        internalTrueCostExGst={undefined}
        internalTrueCostIncGst={undefined}
      />,
    );

    expect(container.textContent).toContain('Customer price (inc GST)—');
    expect(container.textContent).not.toContain('Last valid customer price');

    unmount();
  });
});
