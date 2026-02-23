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
});
