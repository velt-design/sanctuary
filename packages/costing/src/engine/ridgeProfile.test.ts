import { describe, expect, it } from 'vitest';
import { calculateCostV1 } from './calculate';
import { loadCostingConfigV1 } from './config';
import type { CostInputsV1 } from './types';

const input = (length: number): CostInputsV1 => ({
  length_m: length, projection_m: 3, post_cut_height_m: 2.4, post_count: 4,
  pergola_style: 'gable', box_perimeter_enabled: false, roof_material: 'acrylic',
  extrusion_colour: 'Black', house_connection_type: 'soffit',
  post_connection_type: 'deck_bracket', access: 'normal', height: 'single_storey',
});
const config = (version = 'v2.9') => ({ ...loadCostingConfigV1(), appliedControlManifestVersion: version });

describe('v2.9 automatic gable steel ridge', () => {
  it.each([5.999, 6, 6.001, 7])('uses the full ridge length at %s m', length => {
    const result = calculateCostV1(input(length), config());
    expect(result.derived.ridge_length_m).toBe(length);
    expect(result.derived.ridge_beam_profile_used).toBe(length > 6 ? 'RHS 150x50x3' : null);
    expect(result.materials.lines.some(line => line.profile === 'RHS 150x50x3')).toBe(length > 6);
    expect(result.materials.lines.some(line => line.id === 'hire.hiab_day')).toBe(length > 6);
  });

  it('includes steel material and handling labour in the estimate', () => {
    const before = calculateCostV1(input(7), config('v2.8'));
    const after = calculateCostV1(input(7), config());
    expect(before.derived.ridge_beam_profile_used).toBeNull();
    expect(after.materials.totals.bars_by_profile['RHS 150x50x3']).toEqual({ stock_length_m: 8, bars_used: 1 });
    expect(after.install.actions.find(action => action.id === 'frame.steel_beam_labour_m')?.qty).toBe(7);
    expect(after.install.actions.find(action => action.id === 'roof.install_ridge_beam_m')!.minutes)
      .toBeCloseTo(before.install.actions.find(action => action.id === 'roof.install_ridge_beam_m')!.minutes * 2.5);
  });

  it('does not change pitched roofs or an explicit staff override', () => {
    expect(calculateCostV1({ ...input(7), pergola_style: 'pitched' }, config()).derived.ridge_beam_profile_used).toBeNull();
    expect(calculateCostV1({ ...input(7), overrides: { ridge_beam_profile: '150x50' } }, config())
      .derived.ridge_beam_profile_used).toBe('150x50');
  });

  it('replaces the box-gable ridge once, without double-counting steel', () => {
    const boxed = { ...input(7), pergola_style: 'pitched' as const, box_perimeter_enabled: true, internal_roof_type: 'gable' as const };
    expect(calculateCostV1({ ...boxed, length_m: 6 }, config()).derived.ridge_beam_profile_used).toBe('100x50');
    const result = calculateCostV1(boxed, config());
    expect(result.derived.ridge_beam_profile_used).toBe('RHS 150x50x3');
    expect(result.materials.totals.bars_by_profile['RHS 150x50x3']).toEqual({ stock_length_m: 8, bars_used: 1 });
  });
});
