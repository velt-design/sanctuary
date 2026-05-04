import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  IssuesDialogContent,
  SaveConfirmationContent,
  type CalculatorIssue,
  type SaveDialogSummary,
} from './CalculatorSaveDialogs';
import type { UiWarning } from './warnings';

const noop = () => undefined;

const summary: SaveDialogSummary = {
  modules: '2',
  activeModule: 'Module 1: pitched + box perimeter',
  roofSize: '6m × 3m',
  roofMaterial: 'acrylic',
  roofPitch: '5°',
  materialsEx: '$100.00',
  installEx: '$200.00',
  overheadEx: '$50.00',
  coreTotalEx: '$350.00',
  blindsEx: '$25.00',
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
      warnings={{
        uiWarnings: [],
        criticalUiWarnings: [],
        reviewUiWarnings: [],
        infoUiWarnings: [],
      }}
      confirmReady={false}
      confirmAcknowledgeWarnings={false}
      confirmRequestDesign={false}
      confirmRequestDesignPriority="UNPRICED"
      generateError={null}
      isGenerating={false}
      hasStatusBlockers={false}
      hasResult
      onConfirmReadyChange={noop}
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
      fieldId: 'lengthM',
      label: 'Roof length',
      message: 'Enter a roof length.',
    };
    const errorsMarkup = renderToStaticMarkup(<IssuesDialogContent issues={[issue]} onClose={noop} onIssueClick={noop} />);
    const emptyMarkup = renderToStaticMarkup(<IssuesDialogContent issues={[]} onClose={noop} onIssueClick={noop} />);

    expect(errorsMarkup).toContain('Issues');
    expect(errorsMarkup).toContain('Module 2 · Roof length');
    expect(errorsMarkup).toContain('Enter a roof length.');
    expect(errorsMarkup).toContain('Jump');
    expect(emptyMarkup).toContain('No validation errors.');
  });

  it('renders create-save summary copy, no-warning copy, and request design priority select', () => {
    const markup = renderSave({ confirmRequestDesign: true, confirmRequestDesignPriority: 'TIER_2' });

    expect(markup).toContain('This will save the current design draft for this project.');
    expect(markup).toContain('Module 1: pitched + box perimeter');
    expect(markup).toContain('6m × 3m');
    expect(markup).toContain('No warnings for this design.');
    expect(markup).toContain('Request drafting after saving this design');
    expect(markup).toContain('Tier 2');
    expect(markup).not.toContain('Reprice to latest');
  });

  it('renders edit-save copy, warning sections, acknowledgement, and reprice action', () => {
    const markup = renderSave({
      isEditingDesign: true,
      confirmReady: true,
      confirmAcknowledgeWarnings: false,
      warnings: {
        uiWarnings: [criticalWarning, reviewWarning, infoWarning],
        criticalUiWarnings: [criticalWarning],
        reviewUiWarnings: [reviewWarning],
        infoUiWarnings: [infoWarning],
      },
      generateError: 'Save failed.',
    });

    expect(markup).toContain('Save design keeps this estimate on its current pricing.');
    expect(markup).toContain('Critical (blocks saving)');
    expect(markup).toContain('Review (acknowledge to continue)');
    expect(markup).toContain('Info');
    expect(markup).toContain('I acknowledge the review warnings');
    expect(markup).toContain('Reprice to latest');
    expect(markup).toContain('Save failed.');
  });

  it('disables save and reprice buttons from confirmation state and warnings', () => {
    const notReadyMarkup = renderSave({ isEditingDesign: true, confirmReady: false });
    const criticalMarkup = renderSave({
      isEditingDesign: true,
      confirmReady: true,
      warnings: {
        uiWarnings: [criticalWarning],
        criticalUiWarnings: [criticalWarning],
        reviewUiWarnings: [],
        infoUiWarnings: [],
      },
    });
    const enabledMarkup = renderSave({ isEditingDesign: true, confirmReady: true, confirmAcknowledgeWarnings: true });

    expect(notReadyMarkup).toContain('disabled=""');
    expect(criticalMarkup).toContain('Critical warning.');
    expect(criticalMarkup).toContain('disabled=""');
    expect(enabledMarkup).toContain('Reprice to latest');
  });
});
