import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderIntoDocument } from '../../../../../test/reactHarness';
import CalculatorStackedResultActions, {
  CalculatorStackedBackAction,
} from './CalculatorStackedResultActions';

vi.mock('./CalculatorPricingSummary', () => ({
  default: ({ variant }: { variant: string }) => (
    <div data-testid="pricing-summary" data-variant={variant} />
  ),
}));

const pricingSummary = {
  resultFreshness: 'current' as const,
  issuesCount: 2,
  onOpenIssues: vi.fn(),
  customerTotalIncGstCents: 123_456,
  customerTotalExGstCents: 107_353,
  quoteDiscountPct: 0,
  unpricedItemCount: 0,
  hasCustomerPricing: true,
  canViewInternalCosts: false,
};

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('CalculatorStackedResultActions', () => {
  it('owns the compact summary and explicit result routes', () => {
    const onViewResults = vi.fn();
    const onReviewIssues = vi.fn();
    renderIntoDocument(
      <CalculatorStackedResultActions
        pricingSummary={pricingSummary}
        onViewResults={onViewResults}
        onReviewIssues={onReviewIssues}
      />,
    );

    expect(document.querySelector('[data-testid="pricing-summary"]')?.getAttribute('data-variant'))
      .toBe('compact');
    (Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent === 'View results',
    ) as HTMLButtonElement).click();
    (Array.from(document.querySelectorAll('button')).find(
      (button) => button.textContent === 'Review issues',
    ) as HTMLButtonElement).click();

    expect(onViewResults).toHaveBeenCalledOnce();
    expect(onReviewIssues).toHaveBeenCalledOnce();
  });

  it('omits the issue route when there are no input issues', () => {
    renderIntoDocument(
      <CalculatorStackedResultActions
        pricingSummary={{ ...pricingSummary, issuesCount: 0 }}
        onViewResults={vi.fn()}
        onReviewIssues={vi.fn()}
      />,
    );

    expect(document.body.textContent).toContain('View results');
    expect(document.body.textContent).not.toContain('Review issues');
  });

  it('provides a separate return action for the stacked Inspector region', () => {
    const onBackToConfiguration = vi.fn();
    renderIntoDocument(
      <CalculatorStackedBackAction onBackToConfiguration={onBackToConfiguration} />,
    );

    const button = document.querySelector<HTMLButtonElement>('button');
    expect(button?.textContent).toBe('Back to configuration');
    button?.click();
    expect(onBackToConfiguration).toHaveBeenCalledOnce();
  });
});
