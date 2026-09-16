import { describe, expect, it } from 'vitest';
import { calculateCostV1 } from './calculate';
import { loadCostingConfigV1 } from './config';
import type { CostInputsV1 } from './types';

const base: CostInputsV1 = {
  length_m: 6, projection_m: 3, post_cut_height_m: 2.4, post_count: 6,
  pergola_style: 'gable', roof_material: 'acrylic', extrusion_colour: 'Black',
  house_connection_type: 'none', post_connection_type: 'pile_1_5m',
  access: 'normal', height: 'single_storey',
};
const config = (version = 'v2.9') => {
  const cfg = structuredClone(loadCostingConfigV1());
  cfg.appliedControlManifestVersion = version;
  cfg.installActions.basis.crew_hour_rate_ex_gst = 75;
  return cfg;
};

describe('approved 400mm x 1.5m pile costing', () => {
  it.each([4, 6, 8])('splits %s freestanding posts into four piles and remaining brackets', post_count => {
    const result = calculateCostV1({ ...base, post_count }, config());
    expect(result.install.actions.find(row => row.id === 'posts.pile_1_5m_per_post')?.qty).toBe(4);
    expect(result.install.actions.find(row => row.id === 'posts.deck_bracket_per_post')?.qty ?? 0).toBe(post_count - 4);
    expect(result.materials.lines.find(row => row.id === 'foundation.pile_1_5m.concrete')?.qty).toBe(4);
    expect(result.materials.lines.find(row => row.id.includes('deck_bracket'))?.qty ?? 0).toBe(post_count - 4);
  });

  it('keeps explicitly pile-supported attached designs on piles', () => {
    const result = calculateCostV1({ ...base, house_connection_type: 'facade' }, config());
    expect(result.install.actions.find(row => row.id === 'posts.pile_1_5m_per_post')?.qty).toBe(6);
    expect(result.install.actions.some(row => row.id === 'posts.deck_bracket_per_post')).toBe(false);
  });
  it('costs four buried corner posts and two bracket posts without double charges', () => {
    const result = calculateCostV1(base, config());
    const previous = calculateCostV1(base, config('v2.8'));
    expect(result.materials.totals.bars_by_profile['100x100'].bars_used).toBe(5);
    expect(result.materials.totals.waste_m_by_profile['100x100']).toBeCloseTo(10);
    expect(previous.materials.totals.bars_by_profile['100x100'].bars_used).toBe(3);
    expect(result.inputs_normalized.post_cut_height_m).toBe(previous.inputs_normalized.post_cut_height_m);
    const foundation = result.materials.lines.filter(line => line.id.startsWith('foundation.pile_1_5m.'));
    expect(foundation).toHaveLength(3);
    expect(foundation.reduce((sum, line) => sum + line.line_cost_ex_gst, 0)).toBe(1000);
    expect(result.materials.lines.find(line => line.id.includes('deck_bracket'))?.qty).toBe(2);
    expect(result.install.actions.find(row => row.id === 'posts.deck_bracket_per_post')?.qty).toBe(2);
    const action = result.install.actions.filter(row => row.id === 'posts.pile_1_5m_per_post');
    expect(action).toHaveLength(1);
    expect(action[0].minutes).toBe(480);
    expect(action[0].cost_ex_gst).toBe(600);
    expect(result.totals.cost_ex_gst).toBeGreaterThan(previous.totals.cost_ex_gst);
  });

  it('retains deck brackets and old pricing versions without pile allowances', () => {
    for (const result of [calculateCostV1({ ...base, post_connection_type: 'deck_bracket' }, config()), calculateCostV1(base, config('v2.8'))]) {
      expect(result.materials.lines.some(line => line.id.startsWith('foundation.pile_1_5m.'))).toBe(false);
      expect(result.materials.totals.bars_by_profile['100x100'].bars_used).toBe(3);
    }
  });
});

