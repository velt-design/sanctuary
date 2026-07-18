import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  IssuesDialogContent,
  SaveConfirmationContent,
  type CalculatorIssue,
  type SaveDialogSummary,
} from './CalculatorSaveDialogs';
import type { UiWarning } from './warnings';
import type { CalculatorPricingComparison } from './calculatorPricingComparison';

const noop = () => undefined;

const summary: SaveDialogSummary = {
  modules: '2',
  activeModule: 'Pergola 1 · Module 1: pitched + box perimeter',
  roofSize: '6m × 3m',
  roofMaterial: 'acrylic',
  roofPitch: '5°',
  materialsEx: '$100.00',
  installEx: '$200.00',
  overheadEx: '$50.00',
  trueCostEx: '$350.00',
  blindCustomerEx: '$25.00',
};

const pricingComparison: CalculatorPricingComparison = {
  stored: { materialsEx: 90, installEx: 190, overheadEx: 45, trueCostEx: 325, trueCostInc: 373.75 },
  live: { materialsEx: 100, installEx: 200, overheadEx: 50, trueCostEx: 350, trueCostInc: 402.5 },
  difference: { materialsEx: 10, installEx: 10, overheadEx: 5, trueCostEx: 25, trueCostInc: 28.75 },
  pricingInputsChanged: true,
  storedPricingState: 'current',
};

const criticalWarning: UiWarning = {
  id: 'critical',
  severity: 'critical',
  message: 'Critical warning.',
  source: 'engine',
};

const reviewWarning: UiWarning = {
  id: 'review',
  severity: 'review',
  message: 'Review warning.',
  source: 'engine',
};

const infoWarning: UiWarning = {
  id: 'info',
  severity: 'info',
  message: 'Info warning.',
  source: 'engine',
};

function renderSave(overrides?: Partial<Parameters<typeof SaveConfirmationContent>[0]>): string {
  return renderToStaticMarkup(
    <SaveConfirmationContent
      isEditingDesign={false}
      summary={summary}
      pricingComparison={null}
      warnings={{
        uiWarnings: [],
        criticalUiWarnings: [],
        reviewUiWarnings: [],
        infoUiWarnings: [],
      }}
      confirmAcknowledgeWarnings={false}
      confirmRequestDesign={false}
      confirmRequestDesignPriority="UNPRICED"
      generateError={null}
      isGenerating={false}
      hasStatusBlockers={false}
      hasResult
      onConfirmAcknowledgeWarningsChange={noop}
      onConfirmRequestDesignChange={noop}
      onConfirmRequestDesignPriorityChange={noop}
      onCancel={noop}
      onSave={noop}
      onRepriceLatest={noop}
      {...overrides}
    />,
  );
}

describe('CalculatorSaveDialogs', () => {
  it('renders issues list and empty issues state', () => {
    const issue: CalculatorIssue = {
      moduleIndex: 1,
      moduleLabel: 'Pergola 2 · Module 1',
      fieldId: 'lengthM',
      label: 'Roof length',
      message: 'Enter a roof length.',
    };
    const errorsMarkup = renderToStaticMarkup(<IssuesDialogContent issues={[issue]} onClose={noop} onIssueClick={noop} />);
    const emptyMarkup = renderToStaticMarkup(<IssuesDialogContent issues={[]} onClose={noop} onIssueClick={noop} />);

    expect(errorsMarkup).toContain('Issues');
    expect(errorsMarkup).toContain('Pergola 2 · Module 1 · Roof length');
    expect(errorsMarkup).toContain('Enter a roof length.');
    expect(errorsMarkup).toContain('Jump');
    expect(emptyMarkup).toContain('No validation errors.');
  });

  it('renders create-save summary copy, no-warning copy, and request design priority select', () => {
    const markup = renderSave({ confirmRequestDesign: true, confirmRequestDesignPriority: 'TIER_2' });

    expect(markup).toContain('This will save the current design draft for this project.');
    expect(markup).toContain('Pergola 1 · Module 1: pitched + box perimeter');
    expect(markup).toContain('6m × 3m');
    expect(markup).toContain('No warnings for this design.');
    expect(markup).toContain('Internal true cost (ex‑GST)');
    expect(markup).toContain('Blind customer price (ex‑GST)');
    expect(markup).toContain('excluded from pergola true cost');
    expect(markup).toContain('Request drafting after saving this design');
    expect(markup).toContain('Tier 2');
    expect(markup).not.toContain('Reprice and save');
  });

  it('renders edit-save copy, warning sections, acknowledgement, and reprice action', () => {
    const markup = renderSave({
      isEditingDesign: true,
      pricingComparison,
      confirmAcknowledgeWarnings: false,
      warnings: {
        uiWarnings: [criticalWarning, reviewWarning, infoWarning],
        criticalUiWarnings: [criticalWarning],
        reviewUiWarnings: [reviewWarning],
        infoUiWarnings: [infoWarning],
      },
      generateError: 'Save failed.',
    });

    expect(markup).toContain('Choose whether to keep the estimate’s stored costing basis');
    expect(markup).toContain('Stored estimate');
    expect(markup).toContain('Live calculator');
    expect(markup).toContain('+$25.00');
    expect(markup).toContain('Cost-affecting design inputs have changed.');
    expect(markup).toContain('Critical (blocks saving)');
    expect(markup).toContain('Review (acknowledge to continue)');
    expect(markup).toContain('Info');
    expect(markup).toContain('I acknowledge the review warnings');
    expect(markup).toContain('Save design — keep stored costing');
    expect(markup).toContain('Reprice and save');
    expect(markup).toContain('Save failed.');
  });

  it('disables save actions from freshness, blockers, and warnings without a redundant ready checkbox', () => {
    const staleMarkup = renderSave({ isEditingDesign: true, pricingComparison, hasResult: false });
    const criticalMarkup = renderSave({
      isEditingDesign: true,
      pricingComparison,
      warnings: {
        uiWarnings: [criticalWarning],
        criticalUiWarnings: [criticalWarning],
        reviewUiWarnings: [],
        infoUiWarnings: [],
      },
    });
    const enabledMarkup = renderSave({ isEditingDesign: true, pricingComparison, confirmAcknowledgeWarnings: true });

    expect(staleMarkup).toContain('disabled=""');
    expect(criticalMarkup).toContain('Critical warning.');
    expect(criticalMarkup).toContain('disabled=""');
    expect(enabledMarkup).toContain('Reprice and save');
    expect(enabledMarkup).not.toContain('I confirm this design is ready to save');
  });
});
