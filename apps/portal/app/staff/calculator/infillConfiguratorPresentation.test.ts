import { describe, expect, it } from 'vitest';
import type { InfillLineItem } from '@/lib/types/calculator';
import { resolveInfillUiState } from './infillCompute';
import {
  addedSupportSummary,
  canOfferRafterMatching,
  canVisitInfillStage,
  infillResultStatus,
  isInfillOpeningComplete,
  stageForInfillWarning,
} from './infillConfiguratorPresentation';

function makeInfill(overrides: Partial<InfillLineItem> = {}): InfillLineItem {
  const base: InfillLineItem = {
    id: 'infill-1',
    qty: '1',
    location: 'side',
    acrylicSource: 'auto',
    panelOrientation: 'auto',
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
    shape: { type: 'rect', widthM: '2.4', heightM: '2.1', bottomOffsetM: '0' },
  };
  return { ...base, ...overrides, support: { ...base.support, ...(overrides.support ?? {}) }, shape: overrides.shape ?? base.shape };
}

describe('infill configurator presentation', () => {
  it('keeps later stages locked until the opening is complete', () => {
    const incomplete = resolveInfillUiState(makeInfill({ shape: { type: 'rect', widthM: '', heightM: '2.1', bottomOffsetM: '0' } }), 0.9);
    const complete = resolveInfillUiState(makeInfill(), 0.9);

    expect(isInfillOpeningComplete(incomplete)).toBe(false);
    expect(canVisitInfillStage('supports', false)).toBe(false);
    expect(isInfillOpeningComplete(complete)).toBe(true);
    expect(canVisitInfillStage('results', true)).toBe(true);
  });

  it('offers roof-rafter matching only for a full front or house edge', () => {
    expect(canOfferRafterMatching('front', 4.2, 4.2)).toBe(true);
    expect(canOfferRafterMatching('house', 4.2, 4.2)).toBe(true);
    expect(canOfferRafterMatching('front', 3, 4.2)).toBe(false);
    expect(canOfferRafterMatching('side', 4.2, 4.2)).toBe(false);
  });

  it('reports planned supports as a production result', () => {
    const state = resolveInfillUiState(makeInfill({ support: { hasBottom: false } as InfillLineItem['support'] }), 0.9);

    expect(state.warnings).toEqual([]);
    expect(addedSupportSummary(state.estimate.estimatedMullionsTotal)).toContain('The purchase plan includes');
    expect(infillResultStatus(state).title).toBe('Ready for cutting and ordering');
  });

  it('routes critical takeoff errors back to the support stage', () => {
    const state = resolveInfillUiState(makeInfill({
      location: 'side',
      widthMode: 'match_roof_rafters',
      support: { internalSupportMode: 'match_roof_rafters' } as InfillLineItem['support'],
    }), 0.9);
    const blocker = state.warnings.find((warning) => warning.severity === 'error');

    expect(blocker).toBeDefined();
    expect(stageForInfillWarning(blocker!)).toBe('supports');
    expect(infillResultStatus(state).title).toBe('Cannot manufacture');
  });

  it('routes stock-fit blockers back to the opening stage', () => {
    const state = resolveInfillUiState(makeInfill({
      shape: { type: 'rect', widthM: '7', heightM: '7', bottomOffsetM: '0' },
    }), 0.9);
    const blocker = state.warnings.find((warning) => warning.severity === 'error');

    expect(blocker).toBeDefined();
    expect(stageForInfillWarning(blocker!)).toBe('opening');
  });
});
