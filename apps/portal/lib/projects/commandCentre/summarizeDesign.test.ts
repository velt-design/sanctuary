import { describe, expect, it } from 'vitest';
import {
  resolveCommandCentreCostingState,
  summarizeCommandCentreDesign,
} from './summarizeDesign';

describe('summarizeCommandCentreDesign', () => {
  it('uses the largest module and reports the remaining module count', () => {
    expect(summarizeCommandCentreDesign({
      modules: [
        { lengthM: '2', projectionM: '2', pergolaStyle: 'mono', roofMaterial: 'steel' },
        { lengthM: '6', projectionM: '4', pergolaStyle: 'gable', roofMaterial: 'acrylic' },
        { lengthM: '3', projectionM: '2', pergolaStyle: 'hip', roofMaterial: 'timber' },
      ],
    })).toEqual({
      size: '6m x 4m',
      shape: 'Gable',
      roofing: 'Acrylic',
      additionalModuleCount: 2,
    });
  });

  it('returns explicit unknown labels when no module detail is stored', () => {
    expect(summarizeCommandCentreDesign({})).toEqual({
      size: 'Size not recorded',
      shape: 'Shape not recorded',
      roofing: 'Roofing not recorded',
      additionalModuleCount: 0,
    });
  });
});

describe('resolveCommandCentreCostingState', () => {
  it.each([
    [{ pricing_sync_state: 'current' }, 'current'],
    [{ pricing_sync_state: 'stale' }, 'may_be_stale'],
    [{ total: 1234 }, 'stored'],
    [{}, 'unavailable'],
    [null, 'unavailable'],
  ] as const)('maps stored outputs %j to %s', (outputs, expected) => {
    expect(resolveCommandCentreCostingState(outputs)).toBe(expected);
  });
});
