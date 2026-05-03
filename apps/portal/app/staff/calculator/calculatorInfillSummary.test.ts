import { describe, expect, it } from 'vitest';
import type { InfillLineItem } from '@/lib/types/calculator';
import { estimateInfillUi, type InfillUiEstimate } from './calculatorInfillUi';
import {
  buildCalculatorInfillSummary,
  buildSelectedInfillSummaryCopy,
} from './calculatorInfillSummary';

function makeBaseInfill(overrides?: Partial<InfillLineItem>): InfillLineItem {
  const base: InfillLineItem = {
    id: 'infill-1',
    qty: '1',
    location: 'side',
    acrylicSource: 'sheet_panels',
    panelOrientation: 'vertical',
    widthMode: 'target_width',
    targetPanelWidthM: '1',
    maxPanelWidthM: '1.2',
    support: {
      hasTop: true,
      hasBottom: true,
      hasLeft: true,
      hasRight: true,
      internalSupportMode: 'none',
      internalSupportPositionsM: [],
    },
    shape: {
      type: 'rect',
      widthM: '2.4',
      heightM: '2.1',
      bottomOffsetM: '0',
    },
  };

  return {
    ...base,
    ...overrides,
    support: { ...base.support, ...(overrides?.support ?? {}) },
    shape: (overrides?.shape as InfillLineItem['shape']) ?? base.shape,
  };
}

function uiById(items: InfillLineItem[], spacingM = 0.9): Map<string, { estimate: InfillUiEstimate }> {
  return new Map(items.map((item) => [item.id, { estimate: estimateInfillUi(item, spacingM) }]));
}

describe('calculator infill summary helpers', () => {
  it('builds empty summary view model text and default chips', () => {
    const summary = buildCalculatorInfillSummary([], new Map());

    expect(summary).toMatchObject({
      totals: { panels: 0, mullions: 0 },
      locationCounts: {
        front: 0,
        house: 0,
        side: 0,
        gable_end: 0,
        wall: 0,
        custom: 0,
      },
      systemSummary: 'Not configured',
      usedSpacingSummary: '—',
      hasInfills: false,
      line1: '0 infills added',
      line2: 'Front 0 · Side 0 · Gable 0',
      line3: null,
      text: 'No infills added yet',
    });
    expect(summary.chips).toEqual([
      { key: 'front', label: 'Front', count: 0, alwaysShow: true },
      { key: 'side', label: 'Side', count: 0, alwaysShow: true },
      { key: 'gable', label: 'Gable', count: 0, alwaysShow: true },
      { key: 'house', label: 'House', count: 0, alwaysShow: false },
      { key: 'wall', label: 'Wall', count: 0, alwaysShow: false },
      { key: 'custom', label: 'Custom', count: 0, alwaysShow: false },
    ]);
  });

  it('summarizes sheet-only infills', () => {
    const item = makeBaseInfill();
    const summary = buildCalculatorInfillSummary([item], uiById([item]));

    expect(summary.systemSummary).toBe('Sheet panels');
    expect(summary.usedSpacingSummary).toBe('1.20m');
    expect(summary.line1).toBe('1 infill added');
    expect(summary.line2).toBe('Front 0 · Side 1 · Gable 0');
    expect(summary.line3).toBe(`System: Sheet panels · Panels: ${summary.totals.panels} · Frames: ${summary.totals.mullions}`);
    expect(summary.chips).toEqual([
      { key: 'front', label: 'Front', count: 0, alwaysShow: true },
      { key: 'side', label: 'Side', count: 1, alwaysShow: true },
      { key: 'gable', label: 'Gable', count: 0, alwaysShow: true },
    ]);
  });

  it('summarizes strip-only infills', () => {
    const item = makeBaseInfill({
      acrylicSource: 'strip_620',
      targetPanelWidthM: '0.64',
      maxPanelWidthM: '0.64',
    });
    const summary = buildCalculatorInfillSummary([item], uiById([item]));

    expect(summary.systemSummary).toBe('620 strips');
    expect(summary.usedSpacingSummary).toBe('0.64m');
    expect(summary.line3).toBe(`System: 620 strips · Panels: ${summary.totals.panels} · Frames: ${summary.totals.mullions}`);
  });

  it('summarizes mixed systems and non-default locations', () => {
    const sheet = makeBaseInfill({ id: 'front-sheet', location: 'front' });
    const strip = makeBaseInfill({
      id: 'house-strip',
      location: 'house',
      acrylicSource: 'strip_620',
      targetPanelWidthM: '0.64',
      maxPanelWidthM: '0.64',
    });
    const summary = buildCalculatorInfillSummary([sheet, strip], uiById([sheet, strip]));

    expect(summary.systemSummary).toBe('Mixed systems');
    expect(summary.locationCounts).toMatchObject({ front: 1, house: 1, side: 0, gable_end: 0 });
    expect(summary.line1).toBe('2 infills added');
    expect(summary.line2).toBe('Front 1 · Side 0 · Gable 0 · House 1');
    expect(summary.chips).toContainEqual({ key: 'house', label: 'House', count: 1, alwaysShow: false });
  });

  it('summarizes spacing ranges across infill systems', () => {
    const sheet = makeBaseInfill({ id: 'sheet', maxPanelWidthM: '1.2', targetPanelWidthM: '1.2' });
    const strip = makeBaseInfill({
      id: 'strip',
      acrylicSource: 'strip_620',
      maxPanelWidthM: '0.64',
      targetPanelWidthM: '0.64',
    });
    const summary = buildCalculatorInfillSummary([sheet, strip], uiById([sheet, strip]));

    expect(summary.usedSpacingSummary).toBe('0.64m to 1.20m');
  });

  it('builds selected-infill copy for draft state and auto-switch constraints', () => {
    const lastValidEstimate = estimateInfillUi(makeBaseInfill(), 0.9);
    const selectedInfillEstimate = estimateInfillUi(
      makeBaseInfill({
        shape: {
          type: 'rect',
          widthM: '2.4',
          heightM: '3.4',
          bottomOffsetM: '0',
        },
      }),
      0.9,
    );

    const copy = buildSelectedInfillSummaryCopy({
      selectedInfillEstimate,
      selectedInfillIsDraft: true,
      selectedLastValidEstimate: lastValidEstimate,
    });

    expect(copy.selectedDraftGhostLine).toBe(
      `Last valid: ${lastValidEstimate.panelCountEach} panels each, ${lastValidEstimate.internalJoinerLinesEach} internal joiners, ${lastValidEstimate.sheetAreaEachM2.toFixed(
        2,
      )}m2 area each.`,
    );
    expect(copy.infillRunConstraintLine).toBe('Max run: 3.05m (sheet), 6.00m (strips).');
    expect(copy.infillSpacingConstraintLine).toBe('Max bay spacing: 1.20m (sheet), 0.64m (strips).');
    expect(copy.selectedAutoSwitchInlineHint).toBe('Will auto-switch to 620 strips because run 3.40m exceeds 3.05m.');
  });

  it('omits draft and auto-switch copy for valid unchanged estimates', () => {
    const selectedInfillEstimate = estimateInfillUi(makeBaseInfill(), 0.9);
    const copy = buildSelectedInfillSummaryCopy({
      selectedInfillEstimate,
      selectedInfillIsDraft: false,
      selectedLastValidEstimate: null,
    });

    expect(copy.selectedDraftGhostLine).toBeNull();
    expect(copy.selectedAutoSwitchInlineHint).toBeNull();
    expect(copy.infillRunConstraintLine).toBe('Max run: 3.05m (sheet), 6.00m (strips).');
    expect(copy.infillSpacingConstraintLine).toBe('Max bay spacing: 1.20m (sheet), 0.64m (strips).');
  });
});
