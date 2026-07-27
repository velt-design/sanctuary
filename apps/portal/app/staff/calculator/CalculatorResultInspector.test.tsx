import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderIntoDocument } from '../../../../../test/reactHarness';
import CalculatorResultInspector, {
  type CalculatorResultInspectorProps,
} from './CalculatorResultInspector';

vi.mock('./CalculatorPricingSummary', () => ({
  default: ({ variant = 'full' }: { variant?: string }) => (
    <div data-testid={`pricing-summary-${variant}`}>{variant}</div>
  ),
}));
vi.mock('./CalculatorItemPricingBreakdown', () => ({
  default: () => <div data-testid="pricing-breakdown" />,
}));
vi.mock('./CalculatorActualCostReview', () => ({
  default: ({ estimateId }: { estimateId: string }) => <div data-testid="actual-cost">{estimateId}</div>,
}));
vi.mock('./ModuleViewsCard', () => ({
  default: () => <div data-testid="module-views" />,
}));
vi.mock('./PriceImpactPanel', () => ({
  default: () => <div data-testid="price-impact" />,
}));
vi.mock('./QuoteStatusCard', () => ({
  default: () => <div data-testid="quote-status" />,
}));
vi.mock('./CalculatorPreviewDetails', () => ({
  default: ({ view }: { view: string }) => <div data-testid={`preview-details-${view}`}>{view}</div>,
}));

function buildProps(
  overrides: Partial<CalculatorResultInspectorProps> = {},
): CalculatorResultInspectorProps {
  return {
    pricingSummary: {
      resultFreshness: 'current',
      issuesCount: 2,
      onOpenIssues: vi.fn(),
      customerTotalIncGstCents: 100_000,
      customerTotalExGstCents: 86_957,
      quoteDiscountPct: 0,
      unpricedItemCount: 0,
      hasCustomerPricing: true,
      canViewInternalCosts: true,
    },
    pricingPreview: {} as CalculatorResultInspectorProps['pricingPreview'],
    actualCostEstimateId: 'estimate-1',
    moduleViews: {} as CalculatorResultInspectorProps['moduleViews'],
    priceImpact: {} as CalculatorResultInspectorProps['priceImpact'],
    quoteStatus: {
      items: [
        { id: 'project', label: 'Project selected', level: 'ok' },
        { id: 'inputs', label: 'Inputs valid', level: 'block' },
      ],
    },
    previewDetails: {} as CalculatorResultInspectorProps['previewDetails'],
    ...overrides,
  };
}

function tab(name: string): HTMLButtonElement {
  const match = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
    .find((button) => button.textContent === name);
  if (!match) throw new Error(`Missing ${name} tab`);
  return match;
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('CalculatorResultInspector', () => {
  it('keeps price, freshness, issue count, and readiness above five output tabs', () => {
    renderIntoDocument(<CalculatorResultInspector {...buildProps()} />);

    expect(document.querySelector('[data-calculator-result-inspector]')?.getAttribute('data-active-result-tab')).toBe('pricing');
    expect(document.querySelectorAll('[role="tab"]')).toHaveLength(5);
    expect(tab('Pricing').getAttribute('aria-selected')).toBe('true');
    expect(document.querySelector('[data-testid="pricing-summary-inspector"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="pricing-summary-full"]')).not.toBeNull();
    expect(document.body.textContent).toContain('1 blocker');
    expect(document.body.textContent).toContain('2 input issues');
  });

  it('routes existing outputs into the matching tab without unmounting inactive panels', () => {
    renderIntoDocument(<CalculatorResultInspector {...buildProps()} />);

    act(() => tab('Materials').click());
    expect(tab('Materials').getAttribute('aria-selected')).toBe('true');
    expect(document.querySelector('[data-testid="preview-details-materials"]')?.closest('[role="tabpanel"]')?.hasAttribute('hidden')).toBe(false);
    expect(document.querySelector('[data-testid="actual-cost"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="actual-cost"]')?.closest('[role="tabpanel"]')?.hasAttribute('hidden')).toBe(true);

    act(() => tab('Workings').click());
    expect(document.querySelector('[data-testid="module-views"]')?.closest('[role="tabpanel"]')?.hasAttribute('hidden')).toBe(false);
    expect(document.querySelector('[data-testid="preview-details-workings"]')?.closest('[role="tabpanel"]')?.hasAttribute('hidden')).toBe(false);

    act(() => tab('Issues').click());
    expect(document.querySelector('[data-testid="quote-status"]')?.closest('[role="tabpanel"]')?.hasAttribute('hidden')).toBe(false);
    expect(document.querySelector('[data-testid="preview-details-issues"]')?.closest('[role="tabpanel"]')?.hasAttribute('hidden')).toBe(false);
  });

  it('opens Issues from the persistent issue count and supports tab arrow keys', () => {
    renderIntoDocument(<CalculatorResultInspector {...buildProps()} />);

    const issueButton = document.querySelector<HTMLButtonElement>('[aria-label^="Show Issues tab"]');
    act(() => issueButton?.click());
    expect(tab('Issues').getAttribute('aria-selected')).toBe('true');

    act(() => tab('Issues').dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true })));
    expect(tab('Pricing').getAttribute('aria-selected')).toBe('true');

    act(() => tab('Pricing').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
    expect(tab('Materials').getAttribute('aria-selected')).toBe('true');
  });

  it('reports review and ready states when there are no blockers', () => {
    const rendered = renderIntoDocument(
      <CalculatorResultInspector
        {...buildProps({
          pricingSummary: { ...buildProps().pricingSummary, issuesCount: 0 },
          quoteStatus: { items: [{ id: 'review', label: 'Review', level: 'review' }] },
        })}
      />,
    );
    expect(document.body.textContent).toContain('1 to review');

    act(() => rendered.rerender(
      <CalculatorResultInspector
        {...buildProps({
          pricingSummary: { ...buildProps().pricingSummary, issuesCount: 0 },
          quoteStatus: { items: [{ id: 'ready', label: 'Ready', level: 'ok' }] },
        })}
      />,
    ));
    expect(document.body.textContent).toContain('Quote ready');
  });
});
