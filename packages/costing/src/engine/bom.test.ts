import { describe, expect, it } from 'vitest';
import { calculateCostV1 } from './calculate';
import { __test__ } from './bom';
import type { StockSelectionExplain } from './materials_explain';

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

  it('continuous run prefers fewer splice joins even if total cost is higher', () => {
    const bars = [makeBar(3, 100), makeBar(6, 220)];
    const cuts = [makeCut(6.7, 'Ledger')];

    const result = __test__.selectBestStock(bars, cuts, [6, 3]);

    expect(result.bar?.stock_length_m).toBe(6);
  });

  it('continuous run trace emits splice joins in evaluated and chosen records', () => {
    const bars = [makeBar(3, 100), makeBar(6, 220)];
    const cuts = [makeCut(6.7, 'Ledger')];
    let traceSelection: StockSelectionExplain | null = null;

    __test__.selectBestStock(bars, cuts, [6, 3], {
      groupKey: 'ledger_black_default',
      trace: {
        stockSelection: (_groupKey: string, payload: StockSelectionExplain) => {
          traceSelection = payload;
        },
      } as any,
    });

    expect(traceSelection).toBeTruthy();
    expect(traceSelection?.evaluated.every((candidate) => Number.isFinite(candidate.splice_joins ?? NaN))).toBe(true);
    expect(Number.isFinite(traceSelection?.chosen.splice_joins ?? NaN)).toBe(true);
    expect(traceSelection?.rule).toContain('prefer least splice-joins');
  });

  it('non-continuous group remains costPerM-first', () => {
    const bars = [makeBar(6, 6.6), makeBar(4, 4)];
    const cuts = [makeCut(2.6, 'Rafters', 'single'), makeCut(2.6, 'Rafters', 'single')];

    const result = __test__.selectBestStock(bars, cuts, [6, 4]);

    expect(result.bar?.stock_length_m).toBe(4);
    expect(result.barsUsed).toBe(2);
  });
});

describe('acrylic sheet mode strip-yield enforcement', () => {
  const getSheetQty = (result: ReturnType<typeof calculateCostV1>) =>
    result.materials.lines.find((line) => line.id === 'roofing-sheet_e1f7673c14')?.qty ?? 0;

  it('sheet mode, requiredLen > 2.03 uses strip-yield (not area)', () => {
    const result = calculateCostV1({ ...baseInputs, length_m: 8.5, projection_m: 2.5 });
    const totalBays = Math.max(0, Math.round(Number((result.derived as any).bay_count ?? 0)));
    const expectedSheets = Math.ceil(totalBays / 3);

    const requiredLen = Number((result.derived as any).acrylic_required_downslope_m ?? 0);
    expect(requiredLen).toBeGreaterThan(2.03);
    expect(requiredLen).toBeLessThanOrEqual(3.05 + 1e-6);

    expect(getSheetQty(result)).toBe(expectedSheets);
  });

  it('sheet mode, requiredLen <= 2.03 may use area mode', () => {
    const result = calculateCostV1({ ...baseInputs, length_m: 8.5, projection_m: 2.0 });
    const requiredLen = Number((result.derived as any).acrylic_required_downslope_m ?? 0);
    expect(requiredLen).toBeLessThanOrEqual(2.03 + 1e-6);

    const totalAreaM2 = Number((result.derived as any).acrylic_area_m2 ?? 0);
    const sheetAreaM2 = 3.05 * 2.03;
    const expectedSheets = Math.ceil(totalAreaM2 / sheetAreaM2);

    expect(getSheetQty(result)).toBe(expectedSheets);
  });

  it('regression: 8.5×2.5 and 8.5×3.0 both yield 5 sheets', () => {
    const result25 = calculateCostV1({ ...baseInputs, length_m: 8.5, projection_m: 2.5 });
    const result30 = calculateCostV1({ ...baseInputs, length_m: 8.5, projection_m: 3.0 });

    expect(getSheetQty(result25)).toBe(5);
    expect(getSheetQty(result30)).toBe(5);
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

describe('infill BOM takeoff', () => {
  const baseInfill = {
    id: 'inf-1',
    qty: 1,
    location: 'side' as const,
    acrylic_source: 'sheet_panels' as const,
    panel_orientation: 'vertical' as const,
    width_mode: 'target_width' as const,
    target_panel_width_m: 1,
    max_panel_width_m: 1.2,
    support: {
      has_top: true,
      has_bottom: true,
      has_left: true,
      has_right: true,
      internal_support_mode: 'none' as const,
    },
    shape: {
      type: 'rect' as const,
      width_m: 2.4,
      height_m: 2.0,
    },
  };

  it('sheet mode adds pooled infill acrylic sheet line and joiner bars', () => {
    const result = calculateCostV1({
      ...baseInputs,
      roof_material: 'timber',
      infills: [baseInfill],
    });

    expect(result.materials.lines.some((line) => line.id === 'infill.acrylic_sheet_clear' && line.qty >= 1)).toBe(true);
    expect(result.materials.lines.some((line) => line.profile === 'Joiners')).toBe(true);
  });

  it('strip mode adds Crystalite 620 infill line', () => {
    const result = calculateCostV1({
      ...baseInputs,
      roof_material: 'timber',
      infills: [
        {
          ...baseInfill,
          acrylic_source: 'strip_620',
          width_mode: 'target_width',
        },
      ],
    });

    expect(result.materials.lines.some((line) => /^infill\.crystalite_620_\d+m$/.test(line.id))).toBe(true);
  });

  it('strip mode applies 0.64m short-side limit even when run is 3.0m', () => {
    const result = calculateCostV1({
      ...baseInputs,
      roof_material: 'acrylic',
      infills: [
        {
          ...baseInfill,
          acrylic_source: 'strip_620',
          panel_orientation: 'horizontal',
          shape: { type: 'rect', width_m: 3, height_m: 1 },
          support: {
            ...baseInfill.support,
            internal_support_mode: 'none',
          },
        },
      ],
    });

    expect(result.materials.lines.some((line) => /^infill\.crystalite_620_\d+m$/.test(String(line.id)))).toBe(true);
    expect(result.materials.lines.some((line) => line.profile === '50x50')).toBe(true);
  });

  it('adds 50x50 when internal joiner lines are unsupported', () => {
    const result = calculateCostV1({
      ...baseInputs,
      roof_material: 'acrylic',
      infills: [
        {
          ...baseInfill,
          shape: { type: 'rect', width_m: 3, height_m: 2 },
          width_mode: 'target_width',
          target_panel_width_m: 1,
          support: {
            ...baseInfill.support,
            internal_support_mode: 'none',
          },
        },
      ],
    });

    expect(result.materials.lines.some((line) => line.profile === '50x50')).toBe(true);
  });

  it('front match_roof_rafters infill does not add internal 50x50', () => {
    const unsupported = calculateCostV1({
      ...baseInputs,
      roof_material: 'acrylic',
      infills: [
        {
          ...baseInfill,
          location: 'front',
          shape: { type: 'rect', width_m: 3, height_m: 2 },
          width_mode: 'target_width',
          target_panel_width_m: 1,
          support: {
            ...baseInfill.support,
            internal_support_mode: 'none',
          },
        },
      ],
    });
    const matched = calculateCostV1({
      ...baseInputs,
      roof_material: 'acrylic',
      infills: [
        {
          ...baseInfill,
          location: 'front',
          shape: { type: 'rect', width_m: 3, height_m: 2 },
          width_mode: 'match_roof_rafters',
          support: {
            ...baseInfill.support,
            internal_support_mode: 'none',
          },
        },
      ],
    });

    expect(unsupported.materials.lines.some((line) => line.profile === '50x50')).toBe(true);
    expect(matched.materials.lines.some((line) => line.profile === '50x50')).toBe(false);
  });

  it('auto-switches sheet to strips for 6m horizontal run and avoids internal 50x50 when across <= 0.64m', () => {
    const result = calculateCostV1({
      ...baseInputs,
      roof_material: 'acrylic',
      infills: [
        {
          ...baseInfill,
          acrylic_source: 'sheet_panels',
          panel_orientation: 'horizontal',
          shape: { type: 'rect', width_m: 6, height_m: 0.6 },
          support: {
            ...baseInfill.support,
            internal_support_mode: 'none',
          },
        },
      ],
    });

    expect(result.totals.notes_and_warnings.some((note) => note.includes('auto-switched acrylic source'))).toBe(true);
    expect(result.materials.lines.some((line) => /^infill\.crystalite_620_\d+m$/.test(String(line.id)))).toBe(true);
    expect(result.materials.lines.some((line) => line.profile === '50x50')).toBe(false);
  });

  it('skips infill when run side exceeds both sheet and strip limits', () => {
    const result = calculateCostV1({
      ...baseInputs,
      roof_material: 'acrylic',
      infills: [
        {
          ...baseInfill,
          acrylic_source: 'sheet_panels',
          panel_orientation: 'horizontal',
          shape: { type: 'rect', width_m: 6.2, height_m: 0.7 },
        },
      ],
    });

    expect(result.totals.notes_and_warnings.some((note) => note.includes('exceeds sheet') && note.includes('strip'))).toBe(true);
    expect(result.materials.lines.some((line) => /^infill\./.test(String(line.id)))).toBe(false);
  });
});
