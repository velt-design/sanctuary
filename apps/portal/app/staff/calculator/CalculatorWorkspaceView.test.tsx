import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderIntoDocument } from '../../../../../test/reactHarness';
import CalculatorWorkspaceView, { type CalculatorWorkspaceViewProps } from './CalculatorWorkspaceView';

vi.mock('./CalculatorCommandBar', () => ({ default: () => <div data-testid="command-bar" /> }));
vi.mock('./CalculatorModuleNavigator', () => ({ default: () => <div data-testid="module-navigator" /> }));
vi.mock('./CalculatorPricingSummary', () => ({ default: () => <div data-testid="pricing-summary" /> }));
vi.mock('./CalculatorJobTemplatePicker', () => ({ default: () => <div data-testid="job-template" /> }));
vi.mock('./CalculatorConfigurationForm', () => ({ default: () => <div data-testid="configuration-form" /> }));
vi.mock('./CalculatorItemPricingBreakdown', () => ({ default: () => <div data-testid="pricing-breakdown" /> }));
vi.mock('./CalculatorActualCostReview', () => ({
  default: ({ estimateId }: { estimateId: string }) => <div data-testid="actual-cost">{estimateId}</div>,
}));
vi.mock('./ModuleViewsCard', () => ({ default: () => <div data-testid="module-views" /> }));
vi.mock('./PriceImpactPanel', () => ({ default: () => <div data-testid="price-impact" /> }));
vi.mock('./QuoteStatusCard', () => ({ default: () => <div data-testid="quote-status" /> }));
vi.mock('./CalculatorPreviewDetails', () => ({ default: () => <div data-testid="preview-details" /> }));
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
    pricingSummary: {} as CalculatorWorkspaceViewProps['pricingSummary'],
    jobTemplatePicker: {} as CalculatorWorkspaceViewProps['jobTemplatePicker'],
    configurationForm: {} as CalculatorWorkspaceViewProps['configurationForm'],
    resultFreshness: 'current',
    pricingPreview: null as unknown as CalculatorWorkspaceViewProps['pricingPreview'],
    actualCostEstimateId: 'estimate-1',
    moduleViews: {} as CalculatorWorkspaceViewProps['moduleViews'],
    priceImpact: {} as CalculatorWorkspaceViewProps['priceImpact'],
    quoteStatus: {} as CalculatorWorkspaceViewProps['quoteStatus'],
    previewDetails: {} as CalculatorWorkspaceViewProps['previewDetails'],
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
    expect(document.querySelectorAll('[data-testid="pricing-summary"]')).toHaveLength(2);
    expect(document.querySelector('[data-testid="actual-cost"]')?.textContent).toBe('estimate-1');
    expect(document.querySelector('[data-testid="price-impact"]')).not.toBeNull();
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
    expect(document.querySelector('[data-testid="actual-cost"]')).toBeNull();
    expect(document.querySelector('[data-testid="price-impact"]')).toBeNull();
    expect(document.querySelector('[data-testid="project-picker"]')).toBeNull();

    act(() => rendered.unmount());
  });
});
