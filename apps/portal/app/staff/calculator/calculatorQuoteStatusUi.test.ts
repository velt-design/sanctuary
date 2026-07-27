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
      inputIssueCount: 2,
      invalidBlindCount: 2,
      engineError: null,
      resultFreshness: 'invalid',
      infillItems: [draftInfill],
      infillUiById: new Map([[draftInfill.id, makeInfillUiState({ status: 'draft' })]]),
    });

    expect(ui.hasStatusBlockers).toBe(true);
    expect(ui.blockerCount).toBe(5);
    expect(ui.anyInfillDraft).toBe(true);
    expect(ui.readinessSummary).toMatchObject({
      label: '6 issues block Save',
      rootCauseCount: 6,
      blockedCheckCount: 5,
    });
    expect(ui.items).toMatchObject([
      { id: 'project', level: 'ok', detail: 'Attached' },
      { id: 'contact', level: 'block', detail: 'Missing contact on project', actionKey: 'openProject' },
      { id: 'inputs', level: 'block', detail: '2 input issues to fix', actionKey: 'openIssues', causeCount: 2 },
      { id: 'blinds', level: 'block', detail: '2 blinds need valid dimensions and selections', actionKey: 'openBlinds' },
      { id: 'engine', level: 'block', detail: 'Fix inputs to refresh result', blockedBy: 'inputs', causeCount: 0 },
      { id: 'infills', level: 'block', detail: 'Finish required infill shape fields', actionKey: 'openInfills' },
    ]);
  });

  it('builds missing-project and waiting-engine status rows without action callbacks', () => {
    const ui = buildCalculatorQuoteStatusUi({
      projectId: '',
      hasProject: false,
      projectHasContact: false,
      inputIssueCount: 0,
      invalidBlindCount: 0,
      engineError: 'Costing failed',
      resultFreshness: 'error',
      infillItems: [],
      infillUiById: new Map(),
    });

    expect(ui.items).toMatchObject([
      { id: 'project', level: 'block', detail: 'Select a project', actionKey: 'selectProject' },
      { id: 'contact', level: 'review', detail: '—' },
      { id: 'inputs', level: 'ok', detail: 'OK' },
      { id: 'blinds', level: 'ok', detail: 'OK' },
      { id: 'engine', level: 'block', detail: 'Costing failed' },
      { id: 'infills', level: 'ok', detail: 'OK' },
    ]);
    expect(ui.blockerCount).toBe(2);
    expect(ui.readinessSummary).toMatchObject({
      label: '2 issues block Save',
      rootCauseCount: 2,
      blockedCheckCount: 2,
    });
  });

  it('counts an input failure once when it also blocks the engine check', () => {
    const ui = buildCalculatorQuoteStatusUi({
      projectId: 'project-1',
      hasProject: true,
      projectHasContact: true,
      inputIssueCount: 1,
      invalidBlindCount: 0,
      engineError: null,
      resultFreshness: 'invalid',
      infillItems: [],
      infillUiById: new Map(),
    });

    expect(ui.blockerCount).toBe(2);
    expect(ui.hasStatusBlockers).toBe(true);
    expect(ui.items.find((item) => item.id === 'engine')).toMatchObject({
      level: 'block',
      blockedBy: 'inputs',
      causeCount: 0,
    });
    expect(ui.readinessSummary).toMatchObject({
      tone: 'blocked',
      label: '1 input issue blocks Save',
      rootCauseCount: 1,
      blockedCheckCount: 2,
    });
  });

  it('models an update as a wait state rather than an independent defect', () => {
    const ui = buildCalculatorQuoteStatusUi({
      projectId: 'project-1',
      hasProject: true,
      projectHasContact: true,
      inputIssueCount: 0,
      invalidBlindCount: 0,
      engineError: null,
      resultFreshness: 'calculating',
      infillItems: [],
      infillUiById: new Map(),
    });

    expect(ui.blockerCount).toBe(1);
    expect(ui.readinessSummary).toMatchObject({
      tone: 'waiting',
      label: 'Updating - Save waits for a current result',
      rootCauseCount: 0,
      blockedCheckCount: 1,
    });
  });

  it('keeps an engine error as an independent cause and uses singular blind grammar', () => {
    const engineUi = buildCalculatorQuoteStatusUi({
      projectId: 'project-1',
      hasProject: true,
      projectHasContact: true,
      inputIssueCount: 0,
      invalidBlindCount: 0,
      engineError: 'Costing failed',
      resultFreshness: 'error',
      infillItems: [],
      infillUiById: new Map(),
    });
    expect(engineUi.readinessSummary).toMatchObject({
      tone: 'blocked',
      label: 'Engine error blocks Save',
      rootCauseCount: 1,
      blockedCheckCount: 1,
    });

    const blindUi = buildCalculatorQuoteStatusUi({
      projectId: 'project-1',
      hasProject: true,
      projectHasContact: true,
      inputIssueCount: 0,
      invalidBlindCount: 1,
      engineError: null,
      resultFreshness: 'current',
      infillItems: [],
      infillUiById: new Map(),
    });
    expect(blindUi.items.find((item) => item.id === 'blinds')?.detail).toBe(
      '1 blind needs valid dimensions and selections',
    );
  });

  it('keeps save preflight error priority stable', () => {
    const base = {
      projectId: 'project-1',
      hasProject: true,
      readyToCalculate: true,
      hasStatusBlockers: false,
      resultFreshness: 'current' as const,
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

  it('always resolves valid saves through the confirmation decision', () => {
    const base = {
      projectId: 'project-1',
      hasProject: true,
      readyToCalculate: true,
      hasStatusBlockers: false,
      resultFreshness: 'current' as const,
    };

    expect(resolveGenerateDesignPreflight(base)).toEqual({ kind: 'confirm' });
  });
});
