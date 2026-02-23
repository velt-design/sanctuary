import { describe, expect, it } from 'vitest';
import type { InfillLineItem } from '@/lib/types/calculator';
import { resolveInfillUiState } from './infillCompute';

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

describe('infill compute draft state', () => {
  it('returns draft status when width draft is missing', () => {
    const infill = makeBaseInfill();
    const state = resolveInfillUiState(infill, 0.9, { widthM: '' });

    expect(state.status).toBe('draft');
    expect(state.validation.errors.widthM).toBeTruthy();
    expect(state.missingFields).toContain('widthM');
  });

  it('keeps invalid numeric drafts in draft mode', () => {
    const infill = makeBaseInfill();
    const state = resolveInfillUiState(infill, 0.9, { widthM: '12abc' });

    expect(state.status).toBe('draft');
    expect(state.validation.errors.widthM).toBeTruthy();
    expect(state.missingFields).toContain('widthM');
  });

  it('returns valid status with panel counts for complete inputs', () => {
    const infill = makeBaseInfill();
    const state = resolveInfillUiState(infill, 0.9);

    expect(state.status).toBe('valid');
    expect(state.estimate.panelCountEach).toBeGreaterThan(0);
    expect(state.estimate.bayBoundariesM.length).toBe(state.estimate.panelCountEach + 1);
  });

  it('emits actionable warning targets', () => {
    const infill = makeBaseInfill({
      panelOrientation: 'auto',
      shape: {
        type: 'rect',
        widthM: '4.2',
        heightM: '4.2',
        bottomOffsetM: '0',
      },
    });

    const state = resolveInfillUiState(infill, 0.9);

    expect(state.warnings.some((warning) => warning.target.section === 'basic' && warning.target.fieldKey === 'acrylic')).toBe(true);
    expect(state.warnings.some((warning) => warning.target.section === 'basic' && warning.target.fieldKey === 'joiner-direction')).toBe(true);
    expect(state.warnings.some((warning) => warning.target.section === 'supports' && warning.target.fieldKey === 'support-internal-mode')).toBe(true);
  });

  it('tracks unsupported joiners in both estimate and warnings', () => {
    const infill = makeBaseInfill({
      shape: {
        type: 'rect',
        widthM: '3.6',
        heightM: '2.1',
        bottomOffsetM: '0',
      },
      support: {
        hasTop: true,
        hasBottom: true,
        hasLeft: true,
        hasRight: true,
        internalSupportMode: 'none',
        internalSupportPositionsM: [],
      },
    });

    const state = resolveInfillUiState(infill, 0.9);
    expect(state.estimate.unsupportedInternalIndicesEach.length).toBe(state.estimate.unsupportedInternalEach);
    expect(state.warnings.some((warning) => warning.id === 'unsupported-joiners')).toBe(state.estimate.unsupportedInternalEach > 0);
  });

  it('returns cut list rows aligned with summary counts', () => {
    const infill = makeBaseInfill({
      acrylicSource: 'strip_620',
      shape: {
        type: 'rect',
        widthM: '2.4',
        heightM: '2.1',
        bottomOffsetM: '0',
      },
    });

    const state = resolveInfillUiState(infill, 0.9);
    const cutRows = state.estimate.cutListRows;
    const stripRow = cutRows.find((row) => row.part === 'Acrylic strip 620');
    const internalJoinerRow = cutRows.find((row) => row.part === 'Internal joiner');

    expect(stripRow?.qty).toBe(state.estimate.panelCountTotal);
    if (state.estimate.internalJoinerLinesTotal > 0) {
      expect(internalJoinerRow?.qty).toBe(state.estimate.internalJoinerLinesTotal);
    }
  });

  it('adds deterministic fixes when warnings can be auto-resolved', () => {
    const infill = makeBaseInfill({
      acrylicSource: 'sheet_panels',
      panelOrientation: 'vertical',
      shape: {
        type: 'rect',
        widthM: '2.4',
        heightM: '3.4',
        bottomOffsetM: '0',
      },
    });

    const state = resolveInfillUiState(infill, 0.9);
    const autoSwitchWarning = state.warnings.find((warning) => warning.id === 'acrylic-source-auto-switched');

    expect(autoSwitchWarning?.fix).toEqual({ type: 'setPreferredAcrylic', value: 'strip_620' });
  });
});
