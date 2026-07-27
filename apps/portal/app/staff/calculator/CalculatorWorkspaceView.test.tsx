import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderIntoDocument } from '../../../../../test/reactHarness';
import CalculatorWorkspaceView, { type CalculatorWorkspaceViewProps } from './CalculatorWorkspaceView';

vi.mock('./CalculatorCommandBar', () => ({ default: () => <div data-testid="command-bar" /> }));
vi.mock('./CalculatorModuleNavigator', () => ({ default: () => <div data-testid="module-navigator" /> }));
vi.mock('./CalculatorPricingSummary', () => ({ default: () => <div data-testid="pricing-summary" /> }));
vi.mock('./CalculatorJobTemplatePicker', () => ({ default: () => <div data-testid="job-template" /> }));
vi.mock('./CalculatorConfigurationForm', () => ({ default: () => <div data-testid="configuration-form" /> }));
vi.mock('./CalculatorResultInspector', () => ({
  default: ({
    actualCostEstimateId,
    priceImpact,
  }: {
    actualCostEstimateId: string | null;
    priceImpact: unknown;
  }) => (
    <div
      data-testid="result-inspector"
      data-actual-cost-estimate-id={actualCostEstimateId ?? ''}
      data-has-price-impact={priceImpact ? 'true' : 'false'}
    />
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
    pricingSummary: {} as CalculatorWorkspaceViewProps['pricingSummary'],
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
    expect(document.querySelector('[data-testid="result-inspector"]')?.getAttribute('data-actual-cost-estimate-id')).toBe('');
    expect(document.querySelector('[data-testid="result-inspector"]')?.getAttribute('data-has-price-impact')).toBe('false');
    expect(document.querySelector('[data-testid="project-picker"]')).toBeNull();

    act(() => rendered.unmount());
  });
});
