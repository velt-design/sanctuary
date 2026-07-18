import { describe, expect, it } from 'vitest';
import type { InfillLineItem } from '@/lib/types/calculator';
import type { InfillUiState, InfillWarningItem } from './infillCompute';
import {
  buildCalculatorQuoteStatusUi,
  buildCalculatorUiWarnings,
  groupCalculatorUiWarnings,
  resolveGenerateDesignPreflight,
} from './calculatorQuoteStatusUi';

function makeInfill(overrides?: Partial<InfillLineItem>): InfillLineItem {
  return {
    id: 'infill-1',
    label: 'Front screen',
    qty: '1',
    location: 'front',
    acrylicSource: 'sheet_panels',
    panelOrientation: 'vertical',
    widthMode: 'target_width',
    targetPanelWidthM: '1.2',
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
    ...overrides,
  };
}

function makeWarning(overrides?: Partial<InfillWarningItem>): InfillWarningItem {
  return {
    id: 'support-left',
    severity: 'error',
    message: 'Add left support.',
    target: {
      section: 'supports',
      fieldKey: 'support-left',
    },
    ...overrides,
  };
}

function makeInfillUiState(overrides?: Partial<InfillUiState>): InfillUiState {
  return {
    status: 'valid',
    missingFields: [],
    draftErrors: {},
    estimate: {} as InfillUiState['estimate'],
    validation: {} as InfillUiState['validation'],
    warnings: [],
    ...overrides,
  };
}

describe('calculator quote status UI helpers', () => {
  it('aggregates engine and infill warnings with existing severity and label fallbacks', () => {
    const infill = makeInfill({ label: '   ' });
    const uiWarnings = buildCalculatorUiWarnings({
      engineWarnings: [
        { level: 'critical', message: 'Engine critical.' },
        { level: 'review', message: 'Engine review.' },
      ],
      infillItems: [infill],
      infillUiById: new Map([
        [
          infill.id,
          makeInfillUiState({
            warnings: [
              makeWarning({ severity: 'error', message: 'Add left support.' }),
              makeWarning({ id: 'centre', severity: 'warning', message: 'Check centres.' }),
              makeWarning({ id: 'note', severity: 'info', message: 'Informational note.' }),
            ],
          }),
        ],
      ]),
    });

    expect(uiWarnings).toMatchObject([
      { id: 'engine-0', severity: 'critical', message: 'Engine critical.', source: 'engine' },
      { id: 'engine-1', severity: 'review', message: 'Engine review.', source: 'engine' },
      { id: 'infill-infill-1-support-left', severity: 'critical', message: 'Infill 1: Add left support.', source: 'infill' },
      { id: 'infill-infill-1-centre', severity: 'review', message: 'Infill 1: Check centres.', source: 'infill' },
      { id: 'infill-infill-1-note', severity: 'info', message: 'Infill 1: Informational note.', source: 'infill' },
    ]);
  });

  it('groups critical, review, and info warning counts and helper text', () => {
    const uiWarnings = buildCalculatorUiWarnings({
      engineWarnings: [{ level: 'review', message: 'Review this.' }],
      infillItems: [makeInfill({ id: 'one' }), makeInfill({ id: 'two' })],
      infillUiById: new Map([
        ['one', makeInfillUiState({ warnings: [makeWarning()] })],
        ['two', makeInfillUiState({ warnings: [makeWarning({ severity: 'info' })] })],
      ]),
    });

    expect(groupCalculatorUiWarnings(uiWarnings)).toMatchObject({
      warningsCount: 3,
      warningsHelperText: 'Critical: 1 (blocks design save)',
      criticalUiWarnings: [{ severity: 'critical' }],
      reviewUiWarnings: [{ severity: 'review' }],
      infoUiWarnings: [{ severity: 'info' }],
    });

    expect(
      groupCalculatorUiWarnings([
        { id: 'info', severity: 'info', message: 'Info.', source: 'engine' },
      ]).warningsHelperText,
    ).toBe('Info: 1');
  });

  it('builds project, contact, input, engine, and draft-infill status rows', () => {
    const draftInfill = makeInfill({ id: 'draft' });
    const ui = buildCalculatorQuoteStatusUi({
      projectId: 'project-1',
      hasProject: true,
      projectHasContact: false,
      hasModuleErrors: true,
      engineError: null,
      resultFreshness: 'calculating',
      infillItems: [draftInfill],
      infillUiById: new Map([[draftInfill.id, makeInfillUiState({ status: 'draft' })]]),
    });

    expect(ui.hasStatusBlockers).toBe(true);
    expect(ui.blockerCount).toBe(4);
    expect(ui.anyInfillDraft).toBe(true);
    expect(ui.items).toMatchObject([
      { id: 'project', level: 'ok', detail: 'Attached' },
      { id: 'contact', level: 'block', detail: 'Missing contact on project', actionKey: 'openProject' },
      { id: 'inputs', level: 'block', detail: 'Fix validation errors', actionKey: 'openIssues' },
      { id: 'engine', level: 'block', detail: 'Updating...' },
      { id: 'infills', level: 'block', detail: 'Finish required infill shape fields', actionKey: 'openInfills' },
    ]);
  });

  it('builds missing-project and waiting-engine status rows without action callbacks', () => {
    const ui = buildCalculatorQuoteStatusUi({
      projectId: '',
      hasProject: false,
      projectHasContact: false,
      hasModuleErrors: false,
      engineError: 'Costing failed',
      resultFreshness: 'error',
      infillItems: [],
      infillUiById: new Map(),
    });

    expect(ui.items).toMatchObject([
      { id: 'project', level: 'block', detail: 'Select a project', actionKey: 'selectProject' },
      { id: 'contact', level: 'review', detail: '—' },
      { id: 'inputs', level: 'ok', detail: 'OK' },
      { id: 'engine', level: 'block', detail: 'Costing failed' },
      { id: 'infills', level: 'ok', detail: 'OK' },
    ]);
  });

  it('keeps save preflight error priority stable', () => {
    const base = {
      projectId: 'project-1',
      hasProject: true,
      readyToCalculate: true,
      hasStatusBlockers: false,
      resultFreshness: 'current' as const,
      warningCount: 0,
    };

    expect(resolveGenerateDesignPreflight({ ...base, projectId: '', hasProject: false })).toEqual({
      kind: 'error',
      message: 'Select a project before saving design.',
    });
    expect(resolveGenerateDesignPreflight({ ...base, hasProject: false })).toEqual({
      kind: 'error',
      message: 'Project not found.',
    });
    expect(resolveGenerateDesignPreflight({ ...base, readyToCalculate: false })).toEqual({
      kind: 'error',
      message: 'Fix validation errors before saving design.',
    });
    expect(resolveGenerateDesignPreflight({ ...base, resultFreshness: 'calculating' })).toEqual({
      kind: 'error',
      message: 'Please wait for calculation to finish.',
    });
    expect(resolveGenerateDesignPreflight({ ...base, resultFreshness: 'error' })).toEqual({
      kind: 'error',
      message: 'Fix cost engine error before saving design.',
    });
    expect(resolveGenerateDesignPreflight({ ...base, resultFreshness: 'stale' })).toEqual({
      kind: 'error',
      message: 'Wait for a current calculated result before saving design.',
    });
    expect(resolveGenerateDesignPreflight({ ...base, hasStatusBlockers: true })).toEqual({
      kind: 'error',
      message: 'Resolve blockers in Quote Status before saving design.',
    });
  });

  it('resolves save-immediate and confirmation preflight branches', () => {
    const base = {
      projectId: 'project-1',
      hasProject: true,
      readyToCalculate: true,
      hasStatusBlockers: false,
      resultFreshness: 'current' as const,
      warningCount: 0,
    };

    expect(resolveGenerateDesignPreflight(base)).toEqual({ kind: 'save' });
    expect(resolveGenerateDesignPreflight({ ...base, warningCount: 1 })).toEqual({ kind: 'confirm' });
  });
});
