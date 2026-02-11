import { describe, expect, it } from 'vitest';
import { calculateCostV1 } from './calculate';
import { __test__ } from './bom';

const baseInputs = {
  length_m: 3,
  projection_m: 3,
  post_cut_height_m: 2.4,
  post_count: 4,

  pergola_style: 'pitched' as const,
  box_perimeter_enabled: false,
  roof_material: 'acrylic' as const,
  extrusion_colour: 'Black' as const,

  house_connection_type: 'soffit' as const,
  post_connection_type: 'deck_bracket' as const,
  access: 'normal' as const,
  height: 'single_storey' as const,
};

describe('selectBestStock continuous runs', () => {
  const makeBar = (stock_length_m: number, cost_ex_gst: number) =>
    ({
      id: `bar_${stock_length_m}`,
      category: 'aluminium_extrusion',
      unit: 'bar',
      attributes: { length_m: stock_length_m },
      cost_ex_gst,
      stock_length_m,
    }) as any;

  const makeCut = (length_m: number, component: string, join_policy: 'joinable' | 'single' = 'joinable') =>
    ({
      length_m,
      origin_id: `${component.toLowerCase().replace(/\s+/g, '_')}_0`,
      origin_len_m: length_m,
      join_policy,
      segment_index: 0,
      component,
      finish: 'default',
    }) as any;

  it('prefers exact-fit for gutter run', () => {
    const bars = [makeBar(5, 214.14), makeBar(6, 257)];
    const cuts = [makeCut(6, 'SP gutter')];

    const result = __test__.selectBestStock(bars, cuts, [6, 5]);

    expect(result.bar?.stock_length_m).toBe(6);
    expect(result.barsUsed).toBe(1);
  });

  it('continuous run chooses lowest total cost even if costPerM is slightly higher', () => {
    const bars = [makeBar(5, 214.14), makeBar(6, 257)];
    const cuts = [makeCut(5.5, 'Ledger')];

    const result = __test__.selectBestStock(bars, cuts, [6, 5]);

    expect(result.bar?.stock_length_m).toBe(6);
    expect(result.barsUsed).toBe(1);
  });

  it('non-continuous group remains costPerM-first', () => {
    const bars = [makeBar(6, 6.6), makeBar(4, 4)];
    const cuts = [makeCut(2.6, 'Rafters', 'single'), makeCut(2.6, 'Rafters', 'single')];

    const result = __test__.selectBestStock(bars, cuts, [6, 4]);

    expect(result.bar?.stock_length_m).toBe(4);
    expect(result.barsUsed).toBe(2);
  });
});

describe('buildMaterialsV1 splice joins', () => {
  it('does not add splice joins when all joinable members fit stock', () => {
    const result = calculateCostV1({ ...baseInputs, projection_m: 3 });

    expect(result.derived.splice_join_count ?? 0).toBe(0);
    expect(result.materials.lines.some((line) => line.id === 'hardware.splice_join_bracket')).toBe(false);
    expect(result.materials.lines.some((line) => line.id === 'fixing.splice_join_screw_each')).toBe(false);
  });

  it('counts one join per joiner when joiners exceed stock length', () => {
    const result = calculateCostV1({ ...baseInputs, projection_m: 7 });

    const joinerBars = result.materials.totals.bars_by_profile['Joiners'];
    expect(joinerBars).toBeTruthy();

    const stockLen = joinerBars?.stock_length_m ?? 0;
    const joinerLen = Number(result.derived.joiner_piece_length_m ?? 0);
    const joinerRuns = Math.max(0, Math.round(Number(result.derived.joiner_runs_total ?? result.derived.rafter_count)));

    const joinsPerMember = joinerLen > stockLen + 1e-6 ? Math.ceil(joinerLen / stockLen) - 1 : 0;
    expect(joinsPerMember).toBe(1);

    const expectedJoins = joinerRuns * joinsPerMember;
    expect(result.derived.splice_join_count).toBe(expectedJoins);
  });

  it('counts multiple joins per joiner when joiners far exceed stock length', () => {
    const result = calculateCostV1({ ...baseInputs, projection_m: 12.5 });

    const joinerBars = result.materials.totals.bars_by_profile['Joiners'];
    expect(joinerBars).toBeTruthy();

    const stockLen = joinerBars?.stock_length_m ?? 0;
    const joinerLen = Number(result.derived.joiner_piece_length_m ?? 0);
    const joinerRuns = Math.max(0, Math.round(Number(result.derived.joiner_runs_total ?? result.derived.rafter_count)));

    const joinsPerMember = joinerLen > stockLen + 1e-6 ? Math.ceil(joinerLen / stockLen) - 1 : 0;
    expect(joinsPerMember).toBeGreaterThanOrEqual(2);

    const expectedJoins = joinerRuns * joinsPerMember;
    expect(result.derived.splice_join_count).toBe(expectedJoins);
  });
});
