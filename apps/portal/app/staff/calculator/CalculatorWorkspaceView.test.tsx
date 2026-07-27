import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderIntoDocument } from '../../../../../test/reactHarness';
import CalculatorWorkspaceView, { type CalculatorWorkspaceViewProps } from './CalculatorWorkspaceView';

vi.mock('./CalculatorCommandBar', () => ({ default: () => <div data-testid="command-bar" /> }));
vi.mock('./CalculatorModuleNavigator', () => ({ default: () => <div data-testid="module-navigator" /> }));
vi.mock('./CalculatorPricingSummary', () => ({ default: () => <div data-testid="pricing-summary" /> }));
vi.mock('./CalculatorJobTemplatePicker', () => ({ default: () => <div data-testid="job-template" /> }));
vi.mock('./CalculatorConfigurationForm', () => ({
  default: ({ isEmbedded }: { isEmbedded?: boolean }) => (
    <div
      data-testid="configuration-form"
      data-calculator-configuration-form
      data-is-embedded={isEmbedded ? 'true' : 'false'}
    >
      <div data-calculator-field="first">
        <input aria-label="First configuration field" />
      </div>
      <div data-calculator-field="second">
        <input aria-label="Second configuration field" />
      </div>
    </div>
  ),
}));
vi.mock('./CalculatorResultInspector', () => ({
  default: ({
    activeTab,
    onActiveTabChange,
    actualCostEstimateId,
    priceImpact,
  }: {
    activeTab: string;
    onActiveTabChange: (tab: 'pricing' | 'materials' | 'labour' | 'workings' | 'issues') => void;
    actualCostEstimateId: string | null;
    priceImpact: unknown;
  }) => (
    <div
      data-testid="result-inspector"
      data-actual-cost-estimate-id={actualCostEstimateId ?? ''}
      data-has-price-impact={priceImpact ? 'true' : 'false'}
    >
      {(['pricing', 'materials', 'labour', 'workings', 'issues'] as const).map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={activeTab === tab}
          aria-controls={`mock-${tab}-panel`}
          onClick={() => onActiveTabChange(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  ),
}));
vi.mock('./CalculatorInfillWorkspace', () => ({ default: () => <div data-testid="infill-workspace" /> }));
vi.mock('./CalculatorSaveDialogs', () => ({ default: () => <div data-testid="save-dialogs" /> }));
vi.mock('./CalculatorSaveOutcomeDialog', () => ({ default: () => <div data-testid="save-outcome" /> }));
vi.mock('./CalculatorProjectPicker', () => ({ default: () => <div data-testid="project-picker" /> }));

function buildProps(overrides: Partial<CalculatorWorkspaceViewProps> = {}): CalculatorWorkspaceViewProps {
  const noop = vi.fn();
  return {
    embedded: false,
    commandBar: {} as CalculatorWorkspaceViewProps['commandBar'],
    previewSplit: {
      splitRef: { current: null },
      splitStyle: {},
      isDragging: false,
      rightWidthPx: 520,
      rightWidthMaxPx: 900,
      onPointerDown: noop,
      onPointerMove: noop,
      onPointerUp: noop,
      onPointerCancel: noop,
      onLostPointerCapture: noop,
      onKeyDown: noop,
    } as CalculatorWorkspaceViewProps['previewSplit'],
    moduleNavigator: {} as CalculatorWorkspaceViewProps['moduleNavigator'],
    pricingSummary: {
      resultFreshness: 'current',
      issuesCount: 2,
      onOpenIssues: vi.fn(),
      customerTotalIncGstCents: 123_456,
      customerTotalExGstCents: 107_353,
      quoteDiscountPct: 0,
      unpricedItemCount: 0,
      hasCustomerPricing: true,
      canViewInternalCosts: false,
    },
    jobTemplatePicker: {} as CalculatorWorkspaceViewProps['jobTemplatePicker'],
    configurationForm: {} as CalculatorWorkspaceViewProps['configurationForm'],
    resultFreshness: 'current',
    pricingPreview: null as unknown as CalculatorWorkspaceViewProps['pricingPreview'],
    actualCostEstimateId: 'estimate-1',
    moduleViews: {} as CalculatorWorkspaceViewProps['moduleViews'],
    priceImpact: {} as CalculatorWorkspaceViewProps['priceImpact'],
    quoteStatus: { items: [] } as CalculatorWorkspaceViewProps['quoteStatus'],
    previewDetails: {} as CalculatorWorkspaceViewProps['previewDetails'],
    rafterExplanation: {
      moduleLabel: 'Pergola 1 / Module 1',
      explanation: null,
      resultFreshness: 'current',
    },
    infillWorkspace: {} as CalculatorWorkspaceViewProps['infillWorkspace'],
    saveDialogs: {} as CalculatorWorkspaceViewProps['saveDialogs'],
    saveOutcome: {} as CalculatorWorkspaceViewProps['saveOutcome'],
    projectPicker: {} as CalculatorWorkspaceViewProps['projectPicker'],
    ...overrides,
  };
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('CalculatorWorkspaceView', () => {
  it('owns the standalone workspace layout and optional internal-cost surfaces', () => {
    const rendered = renderIntoDocument(<CalculatorWorkspaceView {...buildProps()} />);
    const root = document.querySelector('[data-calculator-workspace="standalone"]');

    expect(root?.tagName).toBe('MAIN');
    expect(root?.getAttribute('data-ui-density')).toBe('compact');
    expect(document.querySelector('[role="separator"]')?.getAttribute('aria-valuenow')).toBe('520');
    expect(document.querySelectorAll('[data-testid="pricing-summary"]')).toHaveLength(1);
    expect(document.querySelector('[data-testid="configuration-form"]')?.getAttribute('data-is-embedded')).toBe('false');
    expect(document.querySelector('[data-testid="result-inspector"]')?.getAttribute('data-actual-cost-estimate-id')).toBe('estimate-1');
    expect(document.querySelector('[data-testid="result-inspector"]')?.getAttribute('data-has-price-impact')).toBe('true');
    expect(document.querySelector('[data-testid="project-picker"]')).not.toBeNull();

    rendered.unmount();
  });

  it('uses the embedded root and omits standalone or unavailable optional surfaces', () => {
    const rendered = renderIntoDocument(
      <CalculatorWorkspaceView
        {...buildProps({
          embedded: true,
          resultFreshness: 'stale',
          actualCostEstimateId: null,
          priceImpact: null,
          projectPicker: null,
        })}
      />,
    );
    const root = document.querySelector('[data-calculator-workspace="project"]');

    expect(root?.tagName).toBe('SECTION');
    expect(document.querySelector('[aria-label="Preview outputs"]')?.getAttribute('data-result-freshness')).toBe('stale');
    expect(document.querySelector('[data-testid="configuration-form"]')?.getAttribute('data-is-embedded')).toBe('true');
    expect(document.querySelector('[data-testid="result-inspector"]')?.getAttribute('data-actual-cost-estimate-id')).toBe('');
    expect(document.querySelector('[data-testid="result-inspector"]')?.getAttribute('data-has-price-impact')).toBe('false');
    expect(document.querySelector('[data-testid="project-picker"]')).toBeNull();

    act(() => rendered.unmount());
  });

  it('resets only the independent result rail on a genuine Inspector tab change', () => {
    renderIntoDocument(<CalculatorWorkspaceView {...buildProps()} />);
    const resultRail = document.querySelector<HTMLElement>('[aria-label="Preview outputs"]');
    if (!resultRail) throw new Error('Missing result rail');
    resultRail.style.overflowY = 'auto';
    const scrollTo = vi.fn();
    resultRail.scrollTo = scrollTo;

    const materialsTab = Array.from(
      document.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
    ).find((button) => button.textContent === 'materials');
    act(() => materialsTab?.click());
    expect(scrollTo).toHaveBeenCalledOnce();
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: 'auto' });

    act(() => materialsTab?.click());
    expect(scrollTo).toHaveBeenCalledOnce();
  });

  it('preserves the active outer scroll owner across a stacked tab change', () => {
    renderIntoDocument(<CalculatorWorkspaceView {...buildProps()} />);
    const workspace = document.querySelector<HTMLElement>('[data-calculator-workspace]');
    const resultRail = document.querySelector<HTMLElement>('[aria-label="Preview outputs"]');
    if (!workspace || !resultRail) throw new Error('Missing Calculator scroll surfaces');
    workspace.style.overflowY = 'auto';
    resultRail.style.overflowY = 'visible';
    Object.defineProperties(workspace, {
      clientHeight: { configurable: true, value: 600 },
      scrollHeight: { configurable: true, value: 2400 },
      scrollTop: { configurable: true, writable: true, value: 420 },
    });
    const scrollTo = vi.fn();
    workspace.scrollTo = scrollTo;

    const materialsTab = Array.from(
      document.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
    ).find((button) => button.textContent === 'materials');
    act(() => materialsTab?.click());

    expect(scrollTo).toHaveBeenCalledOnce();
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 420, behavior: 'auto' });
  });

  it('routes stacked result shortcuts to the selected tab and back to the last field', () => {
    const frames = new Map<number, FrameRequestCallback>();
    let nextFrame = 0;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      nextFrame += 1;
      frames.set(nextFrame, callback);
      return nextFrame;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((frame) => {
      frames.delete(frame);
    });
    renderIntoDocument(<CalculatorWorkspaceView {...buildProps()} />);

    const secondField = document.querySelector<HTMLInputElement>(
      '[aria-label="Second configuration field"]',
    );
    act(() => secondField?.focus());
    expect(document.activeElement).toBe(secondField);

    const reviewIssues = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent === 'Review issues');
    act(() => reviewIssues?.click());
    act(() => frames.get(1)?.(0));
    act(() => frames.get(2)?.(0));

    const issuesTab = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
      .find((button) => button.textContent === 'issues');
    expect(issuesTab?.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(issuesTab);

    const back = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent === 'Back to configuration');
    act(() => back?.click());
    act(() => frames.get(3)?.(0));
    act(() => frames.get(4)?.(0));
    expect(document.activeElement).toBe(secondField);
  });
});
