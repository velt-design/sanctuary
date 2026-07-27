import { act, createRef, type Ref, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderIntoDocument } from '../../../../../test/reactHarness';
import CalculatorResultInspector, {
  type CalculatorResultInspectorHandle,
  type CalculatorResultInspectorProps,
  type CalculatorResultInspectorTab,
} from './CalculatorResultInspector';

vi.mock('./CalculatorPricingSummary', () => ({
  default: ({ variant }: { variant: string }) => (
    <div data-testid={`pricing-summary-${variant}`}>{variant}</div>
  ),
}));
vi.mock('./CalculatorPricingDetails', () => ({
  default: () => <div data-testid="pricing-details" />,
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
vi.mock('./CalculatorRafterExplanation', () => ({
  default: ({ moduleLabel }: { moduleLabel: string }) => (
    <div data-testid="rafter-explanation">{moduleLabel}</div>
  ),
}));

function buildProps(
  overrides: Partial<CalculatorResultInspectorProps> = {},
): CalculatorResultInspectorProps {
  return {
    activeTab: 'pricing',
    onActiveTabChange: vi.fn(),
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
        { id: 'inputs', label: 'Inputs valid', level: 'block', causeCount: 2 },
      ],
      readinessSummary: {
        tone: 'blocked',
        label: '2 input issues block Save',
        accessibleLabel: '2 input issues block Save. 1 readiness check blocked.',
        rootCauseCount: 2,
        blockedCheckCount: 1,
        reviewCount: 0,
      },
    },
    previewDetails: {} as CalculatorResultInspectorProps['previewDetails'],
    rafterExplanation: {
      moduleLabel: 'Pergola 1 / Module 1',
      explanation: null,
      resultFreshness: 'current',
    },
    ...overrides,
  };
}

function ControlledInspector({
  inspectorRef,
  onActiveTabChange = vi.fn(),
  props = buildProps(),
}: {
  inspectorRef?: Ref<CalculatorResultInspectorHandle>;
  onActiveTabChange?: (tab: CalculatorResultInspectorTab) => void;
  props?: CalculatorResultInspectorProps;
}) {
  const [activeTab, setActiveTab] = useState(props.activeTab);

  return (
    <CalculatorResultInspector
      {...props}
      ref={inspectorRef}
      activeTab={activeTab}
      onActiveTabChange={(nextTab) => {
        onActiveTabChange(nextTab);
        setActiveTab(nextTab);
      }}
    />
  );
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
    expect(document.querySelector('[data-testid="pricing-details"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="pricing-summary-full"]')).toBeNull();
    expect(document.body.textContent).toContain('2 input issues block Save');
    expect(document.body.textContent).toContain('2 input issues');
  });

  it('routes existing outputs into the matching tab without unmounting inactive panels', () => {
    renderIntoDocument(<ControlledInspector />);

    act(() => tab('Materials').click());
    expect(tab('Materials').getAttribute('aria-selected')).toBe('true');
    expect(document.querySelector('[data-testid="preview-details-materials"]')?.closest('[role="tabpanel"]')?.hasAttribute('hidden')).toBe(false);
    expect(document.querySelector('[data-testid="actual-cost"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="actual-cost"]')?.closest('[role="tabpanel"]')?.hasAttribute('hidden')).toBe(true);

    act(() => tab('Workings').click());
    const moduleViews = document.querySelector<HTMLElement>('[data-testid="module-views"]');
    const rafterExplanation = document.querySelector<HTMLElement>('[data-testid="rafter-explanation"]');
    expect(moduleViews?.closest('[role="tabpanel"]')?.hasAttribute('hidden')).toBe(false);
    expect(document.querySelector('[data-testid="rafter-explanation"]')?.textContent).toBe('Pergola 1 / Module 1');
    expect(document.querySelector('[data-testid="preview-details-workings"]')?.closest('[role="tabpanel"]')?.hasAttribute('hidden')).toBe(false);
    expect(
      rafterExplanation?.compareDocumentPosition(moduleViews as Node)
        ?? Node.DOCUMENT_POSITION_PRECEDING,
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    act(() => tab('Issues').click());
    expect(document.querySelector('[data-testid="quote-status"]')?.closest('[role="tabpanel"]')?.hasAttribute('hidden')).toBe(false);
    expect(document.querySelector('[data-testid="preview-details-issues"]')?.closest('[role="tabpanel"]')?.hasAttribute('hidden')).toBe(false);
  });

  it('does not change its selected tab until the controlled prop changes', () => {
    const onActiveTabChange = vi.fn();
    const props = buildProps({ onActiveTabChange });
    const rendered = renderIntoDocument(<CalculatorResultInspector {...props} />);

    act(() => tab('Materials').click());
    expect(onActiveTabChange).toHaveBeenCalledOnce();
    expect(onActiveTabChange).toHaveBeenLastCalledWith('materials');
    expect(tab('Pricing').getAttribute('aria-selected')).toBe('true');
    expect(tab('Materials').getAttribute('aria-selected')).toBe('false');

    rendered.rerender(
      <CalculatorResultInspector
        {...props}
        activeTab="materials"
      />,
    );
    expect(tab('Materials').getAttribute('aria-selected')).toBe('true');
    expect(tab('Materials').tabIndex).toBe(0);
    expect(tab('Pricing').tabIndex).toBe(-1);
  });

  it('is controlled, treats same-tab selection as a no-op, and supports tab arrow keys', () => {
    const onActiveTabChange = vi.fn();
    renderIntoDocument(
      <ControlledInspector
        onActiveTabChange={onActiveTabChange}
        props={buildProps({ activeTab: 'materials' })}
      />,
    );

    act(() => tab('Materials').click());
    expect(onActiveTabChange).not.toHaveBeenCalled();

    act(() => tab('Workings').click());
    expect(onActiveTabChange).toHaveBeenLastCalledWith('workings');
    expect(tab('Workings').getAttribute('aria-selected')).toBe('true');

    const issueButton = document.querySelector<HTMLButtonElement>('[aria-label^="Show Issues tab"]');
    act(() => issueButton?.click());
    expect(tab('Issues').getAttribute('aria-selected')).toBe('true');

    act(() => tab('Issues').dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true })));
    expect(tab('Pricing').getAttribute('aria-selected')).toBe('true');

    act(() => tab('Pricing').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
    expect(tab('Materials').getAttribute('aria-selected')).toBe('true');
  });

  it('focuses and horizontally reveals an imperative tab without moving the outer page', () => {
    const inspectorRef = createRef<CalculatorResultInspectorHandle>();
    const onActiveTabChange = vi.fn();
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);

    renderIntoDocument(
      <ControlledInspector
        inspectorRef={inspectorRef}
        onActiveTabChange={onActiveTabChange}
      />,
    );

    const tabList = document.querySelector<HTMLElement>('[role="tablist"]');
    const issuesTab = tab('Issues');
    if (!tabList) throw new Error('Missing tablist');
    tabList.getBoundingClientRect = () => ({
      left: 20,
      right: 220,
    }) as DOMRect;
    issuesTab.getBoundingClientRect = () => ({
      left: 240,
      right: 320,
    }) as DOMRect;
    tabList.scrollLeft = 0;
    const outerScroll = { x: window.scrollX, y: window.scrollY };

    act(() => inspectorRef.current?.focusTab('issues'));
    expect(onActiveTabChange).toHaveBeenCalledOnce();
    expect(onActiveTabChange).toHaveBeenLastCalledWith('issues');
    expect(tab('Issues').getAttribute('aria-selected')).toBe('true');

    act(() => frames.shift()?.(0));
    expect(document.activeElement).toBe(issuesTab);
    expect(tabList.scrollLeft).toBe(100);
    expect({ x: window.scrollX, y: window.scrollY }).toEqual(outerScroll);

    act(() => inspectorRef.current?.focusTab('issues'));
    expect(onActiveTabChange).toHaveBeenCalledOnce();
    act(() => frames.shift()?.(0));
    expect(document.activeElement).toBe(issuesTab);
  });

  it('reports review and ready states when there are no blockers', () => {
    const rendered = renderIntoDocument(
      <CalculatorResultInspector
        {...buildProps({
          pricingSummary: { ...buildProps().pricingSummary, issuesCount: 0 },
          quoteStatus: {
            items: [{ id: 'review', label: 'Review', level: 'review' }],
            readinessSummary: {
              tone: 'review',
              label: '1 item to review',
              accessibleLabel: '1 item to review',
              rootCauseCount: 0,
              blockedCheckCount: 0,
              reviewCount: 1,
            },
          },
        })}
      />,
    );
    expect(document.body.textContent).toContain('1 item to review');

    act(() => rendered.rerender(
      <CalculatorResultInspector
        {...buildProps({
          pricingSummary: { ...buildProps().pricingSummary, issuesCount: 0 },
          quoteStatus: {
            items: [{ id: 'ready', label: 'Ready', level: 'ok' }],
            readinessSummary: {
              tone: 'ready',
              label: 'Ready to save',
              accessibleLabel: 'Ready to save',
              rootCauseCount: 0,
              blockedCheckCount: 0,
              reviewCount: 0,
            },
          },
        })}
      />,
    ));
    expect(document.body.textContent).toContain('Ready to save');
  });
});
