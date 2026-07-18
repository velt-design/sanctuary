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

  it('keeps automatic choices and planned supports out of actionable warnings', () => {
    const infill = makeBaseInfill({
      acrylicSource: 'auto',
      panelOrientation: 'auto',
      shape: {
        type: 'rect',
        widthM: '4.2',
        heightM: '4.2',
        bottomOffsetM: '0',
      },
    });

    const state = resolveInfillUiState(infill, 0.9);

    expect(state.warnings).toEqual([]);
    expect(state.estimate.estimatedMullionsTotal).toBeGreaterThan(0);
  });

  it('tracks unsupported joiners as planned supports rather than warnings', () => {
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
    expect(state.estimate.unsupportedInternalEach).toBeGreaterThan(0);
    expect(state.warnings.some((warning) => warning.id === 'unsupported-joiners')).toBe(false);
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
    const panelRows = cutRows.filter((row) => row.group === 'piece' && row.part.startsWith('Acrylic panel'));
    const internalJoinerRows = cutRows.filter((row) => row.group === 'piece' && row.part.startsWith('Joiner') && row.part.includes('Internal'));
    const stripPurchase = cutRows.find((row) => row.group === 'purchase' && row.part.startsWith('Crystalite 620'));

    expect(panelRows).toHaveLength(state.estimate.panelCountTotal);
    expect(stripPurchase?.qty).toBeGreaterThan(0);
    if (state.estimate.internalJoinerLinesTotal > 0) {
      expect(internalJoinerRows).toHaveLength(state.estimate.internalJoinerLinesTotal);
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

  it('derives the opposite mono-slope edge from pitch mode', () => {
    const infill = makeBaseInfill({
      shape: {
        type: 'mono_slope',
        widthM: '2',
        heightLowM: '1',
        heightHighM: '0',
        bottomOffsetM: '0',
        slopeMode: 'pitch',
        slopeDeg: '45',
        slopeAnchor: 'left',
      },
    });

    const state = resolveInfillUiState(infill, 0.9);

    expect(state.status).toBe('valid');
    expect(state.validation.errors.slopeDeg).toBeUndefined();
    expect(state.estimate.maxHeightM).toBeCloseTo(3, 6);
  });

  it('requires slope degrees in mono-slope pitch mode', () => {
    const infill = makeBaseInfill({
      shape: {
        type: 'mono_slope',
        widthM: '2',
        heightLowM: '1',
        heightHighM: '0',
        bottomOffsetM: '0',
        slopeMode: 'pitch',
        slopeDeg: '',
        slopeAnchor: 'left',
      },
    });

    const state = resolveInfillUiState(infill, 0.9);

    expect(state.status).toBe('draft');
    expect(state.validation.errors.slopeDeg).toBeTruthy();
    expect(state.warnings.some((warning) => warning.target.fieldKey === 'shape-slope')).toBe(true);
  });

  it('shows the exact canonical rows for a 2.4m by 2.1m vertical sheet infill', () => {
    const state = resolveInfillUiState(makeBaseInfill(), 0.9);
    const rows = state.estimate.cutListRows;

    expect(state.status).toBe('valid');
    expect(rows.filter((row) => row.group === 'piece' && row.part.startsWith('Acrylic panel'))).toHaveLength(2);
    expect(rows.find((row) => row.group === 'purchase' && row.part.startsWith('Plexi sheet'))?.qty).toBe(2);
    expect(rows.filter((row) => row.group === 'piece' && row.part.startsWith('Joiner')).reduce((sum, row) => sum + (typeof row.lengthM === 'number' ? row.lengthM : 0), 0)).toBeCloseTo(11.1, 6);
  });

  it('shows two 4m purchases for a 3m by 1m horizontal strip infill because of kerf', () => {
    const state = resolveInfillUiState(makeBaseInfill({
      acrylicSource: 'strip_620',
      panelOrientation: 'horizontal',
      shape: { type: 'rect', widthM: '3', heightM: '1', bottomOffsetM: '0' },
    }), 0.9);
    const rows = state.estimate.cutListRows;

    expect(rows.filter((row) => row.group === 'piece' && row.part.startsWith('Acrylic panel'))).toHaveLength(2);
    expect(rows.find((row) => row.group === 'purchase' && row.part === 'Crystalite 620 · 4m')?.qty).toBe(2);
    expect(rows.filter((row) => row.group === 'piece' && row.part.startsWith('Joiner')).reduce((sum, row) => sum + (typeof row.lengthM === 'number' ? row.lengthM : 0), 0)).toBeCloseTo(11, 6);
  });

  it('blocks a partial-edge roof-rafter match from save and export', () => {
    const state = resolveInfillUiState(makeBaseInfill({
      location: 'front',
      widthMode: 'match_roof_rafters',
      support: { ...makeBaseInfill().support, internalSupportMode: 'match_roof_rafters' },
    }), 0.6, undefined, 3);

    expect(state.status).toBe('draft');
    expect(state.estimate.takeoffStatus).toBe('blocked');
    expect(state.estimate.cutListRows).toHaveLength(0);
    expect(state.warnings.some((warning) => warning.severity === 'error' && /full 3m edge/i.test(warning.message))).toBe(true);
  });
});
